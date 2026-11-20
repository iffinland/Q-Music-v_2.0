import {
  findExactQdnResource,
  getQdnResourceStatus,
  getQdnResourceUrl,
} from '../qdn';
import { requestError, throwIfAborted } from '../qdnRequests';
import { mediaKey } from '../../utils/mediaIdentity';
import { emitMediaRefresh } from '../../utils/mediaEvents';
import {
  hashBlob,
  hashBytes,
  base64Bytes,
  hashResponse,
  randomPublishId,
} from './content';
import { getPublishNodeLimit, validateAudio } from './limits';
import { loadPublishJobs, savePublishJob } from './storage';
import {
  publishItemKey,
  type PublishItem,
  type PublishJob,
  type PublishResource,
  type PublishResult,
} from './types';
import {
  MAX_JOB_FILES,
  MAX_JOB_FILE_BYTES,
  MAX_THUMBNAIL_SIZE,
} from '../../utils/publishLimits';

export interface PublishSnapshot {
  jobs: PublishJob[];
  publisher: string;
  activeJobId: string | null;
  waitingJobIds: string[];
  activity: string;
  open: boolean;
  error: string | null;
}
let snapshot: PublishSnapshot = {
  jobs: [],
  publisher: '',
  activeJobId: null,
  waitingJobIds: [],
  activity: '',
  open: false,
  error: null,
};
const listeners = new Set<() => void>();
const update = (patch: Partial<PublishSnapshot>) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
};
export const getPublishSnapshot = () => snapshot;
export const subscribePublish = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const openPublishCenter = () => update({ open: true });
export const closePublishCenter = () => update({ open: false });
let tail: Promise<unknown> = Promise.resolve();
export const withPublishLock = <T>(work: () => Promise<T>): Promise<T> => {
  const execute = async () => {
    if (typeof navigator === 'undefined' || !navigator.locks?.request) {
      return work();
    }
    let entered = false;
    try {
      return await navigator.locks.request('qmusic-publish-executor', () => {
        entered = true;
        return work();
      });
    } catch (error) {
      // Some embedded contexts expose Web Locks but deny access. Only fall back
      // before work begins: retrying a failed publish could send it twice.
      if (
        !entered &&
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        ['SecurityError', 'NotSupportedError'].includes(String(error.name))
      ) {
        return work();
      }
      throw error;
    }
  };
  const result = tail.then(execute, execute);
  tail = result.catch(() => undefined);
  return result;
};
const operations = new Map<string, Promise<PublishResult>>();
const withJobLock = (
  id: string,
  work: () => Promise<PublishResult>
): Promise<PublishResult> => {
  const existing = operations.get(id);
  if (existing) return existing;
  update({ waitingJobIds: [...snapshot.waitingJobIds, id] });
  const result = withPublishLock(work).finally(() => {
    operations.delete(id);
    update({
      waitingJobIds: snapshot.waitingJobIds.filter((value) => value !== id),
    });
  });
  operations.set(id, result);
  return result;
};
let preparing = false;
const assertAccount = (publisher: string) => {
  if (
    !snapshot.publisher ||
    snapshot.publisher.toLowerCase() !== publisher.toLowerCase()
  )
    throw new Error(
      'Publishing paused because the Qortal account changed. Reopen this job with its original account.'
    );
};
const replaceJob = (job: PublishJob) =>
  update({
    jobs: [job, ...snapshot.jobs.filter((item) => item.id !== job.id)].sort(
      (a, b) => b.created - a.created
    ),
  });
const persist = async (job: PublishJob) => {
  job.updated = Date.now();
  replaceJob({ ...job, items: job.items.map((item) => ({ ...item })) });
  await savePublishJob(job);
};
const jobById = (id: string) => {
  const job = snapshot.jobs.find((item) => item.id === id);
  if (!job) throw new Error('The publishing job could not be found.');
  return { ...job, items: job.items.map((item) => ({ ...item })) };
};
let restoredPublisher = '';
let accountEpoch = 0;
export const activatePublishAccount = async (publisher: string) => {
  if (publisher === snapshot.publisher && restoredPublisher === publisher)
    return;
  const epoch = ++accountEpoch;
  restoredPublisher = '';
  update({ publisher, open: false, error: null });
  if (!publisher) return;
  try {
    const stored = await loadPublishJobs(publisher);
    if (snapshot.publisher !== publisher || epoch !== accountEpoch) return;
    restoredPublisher = publisher;
    const live = new Map(snapshot.jobs.map((job) => [job.id, job]));
    stored.forEach((job) => {
      if (!live.has(job.id)) live.set(job.id, job);
    });
    update({ jobs: [...live.values()].sort((a, b) => b.created - a.created) });
  } catch (error) {
    if (snapshot.publisher === publisher && epoch === accountEpoch)
      update({
        error: requestError(
          error,
          'Saved publishing jobs could not be opened.'
        ),
      });
  }
};

const accepted = (item: PublishItem) =>
  item.state === 'submitted' || item.state === 'verified';
export const summarizeJob = (job: PublishJob): PublishResult => {
  const submitted = job.items.filter(accepted).length;
  const complete = submitted === job.items.length;
  const verified = job.items.every((item) => item.state === 'verified');
  return {
    jobId: job.id,
    complete,
    verified,
    submitted,
    total: job.items.length,
    message: verified
      ? 'Publication is available on this node.'
      : complete
        ? 'Publication sent. It may take a little time to appear across the network.'
        : `${submitted} of ${job.items.length} resources sent. Continue the saved publication from the Publish page.`,
  };
};

export const assertCanStartJob = (publisher: string) => {
  assertAccount(publisher);
  if (restoredPublisher.toLowerCase() !== publisher.toLowerCase())
    throw new Error(
      'Saved publishing jobs are still loading or unavailable. Open your publications from the Publish page and retry.'
    );
  if (preparing || snapshot.activeJobId || snapshot.waitingJobIds.length)
    throw new Error('Wait for the current publishing operation to finish.');
  if (
    snapshot.jobs.some(
      (job) =>
        job.publisher.toLowerCase() === publisher.toLowerCase() &&
        !job.archived &&
        !summarizeJob(job).complete
    )
  ) {
    openPublishCenter();
    throw new Error(
      'An unfinished publishing job is saved. Continue it or set it aside from the Publish page before starting another.'
    );
  }
};
export const createPublishJob = async (
  title: string,
  resources: PublishResource[]
): Promise<PublishJob> => {
  if (!resources.length) throw new Error('There are no resources to publish.');
  const publisher = resources[0].name;
  assertCanStartJob(publisher);
  if (
    resources.some(
      (item) => item.name.toLowerCase() !== publisher.toLowerCase()
    )
  )
    throw new Error('All resources must belong to the current account.');
  if (new Set(resources.map(publishItemKey)).size !== resources.length)
    throw new Error(
      'The publishing job contains duplicate resource identities.'
    );
  const files = resources.filter((item) => item.file);
  if (
    files.length > MAX_JOB_FILES ||
    files.reduce((total, item) => total + item.file!.size, 0) >
      MAX_JOB_FILE_BYTES
  )
    throw new Error(
      'Split this folder into batches of at most 200 audio files and 4000 MiB total.'
    );
  preparing = true;
  update({
    open: true,
    error: null,
    activity: 'Preparing and saving resources…',
  });
  try {
    const items: PublishItem[] = [];
    for (const resource of resources) {
      if (
        !resource.identifier ||
        new TextEncoder().encode(resource.identifier).length > 64
      )
        throw new Error('A resource identifier is invalid.');
      if (!resource.file && !resource.data64)
        throw new Error('A publishing resource has no content.');
      const bytes = resource.file?.size ?? base64Bytes(resource.data64!).length;
      if (resource.service === 'THUMBNAIL' && bytes > MAX_THUMBNAIL_SIZE)
        throw new Error('A generated cover exceeds 500 KiB.');
      items.push({
        ...resource,
        bytes,
        sha256: resource.file
          ? await hashBlob(resource.file)
          : hashBytes(base64Bytes(resource.data64!)),
        state: 'prepared',
      });
    }
    const job: PublishJob = {
      id: randomPublishId(),
      publisher,
      title,
      created: Date.now(),
      updated: Date.now(),
      items,
    };
    await persist(job); // Durable identities/content precede the first wallet action.
    return job;
  } catch (error) {
    update({ error: requestError(error) });
    throw error;
  } finally {
    preparing = false;
    update({ activity: '' });
  }
};

type FailureItem = {
  name: string;
  service: string;
  identifier: string;
  reason?: string;
};
const failuresFrom = (value: unknown): FailureItem[] | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.unsuccessfulPublishes))
    return record.unsuccessfulPublishes.filter((item): item is FailureItem =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof item.name === 'string' &&
          typeof item.service === 'string' &&
          typeof item.identifier === 'string'
      )
    );
  return record.error && record.error !== value
    ? failuresFrom(record.error)
    : null;
};
const send = async (resources: PublishResource[], timeoutMs?: number) => {
  const payload = {
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources: resources.map(
      ({
        name,
        service,
        identifier,
        title,
        description,
        filename,
        file,
        data64,
      }) => ({
        name,
        service,
        identifier,
        title,
        description,
        filename,
        file,
        data64,
      })
    ),
  };
  if (typeof qortalRequestWithTimeout !== 'function')
    throw new Error(
      'This Qortal client does not support the publishing bridge.'
    );
  // Hub retains control of the actual send. Minimize never claims to cancel it.
  return qortalRequestWithTimeout(
    payload as never,
    timeoutMs ?? Math.max(60 * 60_000, resources.length * 30 * 60_000)
  );
};
export const publishAuxiliary = (
  resources: PublishResource[],
  beforeSend?: () => Promise<void>,
  timeoutMs?: number
) =>
  withPublishLock(async () => {
    if (!resources.length) return [];
    await beforeSend?.();
    assertAccount(resources[0].name);
    const result: unknown = await send(resources, timeoutMs);
    if (
      !Array.isArray(result) ||
      result.length !== resources.length ||
      result.some(
        (item) => !item || typeof item.signature !== 'string' || !item.signature
      )
    )
      throw new Error(
        requestError(
          result,
          'The publish did not return complete transaction receipts.'
        )
      );
    return result;
  });

const applyResponse = (
  items: PublishItem[],
  result: unknown,
  rejected: boolean
) => {
  const failures = failuresFrom(result);
  if (
    failures &&
    failures.length &&
    failures.every((failure) =>
      items.some((item) => publishItemKey(item) === publishItemKey(failure))
    )
  ) {
    for (const item of items) {
      const failure = failures.find(
        (entry) => publishItemKey(entry) === publishItemKey(item)
      );
      item.state = failure ? 'failed' : 'uncertain';
      item.error = failure
        ? failure.reason || 'This resource was not accepted by Hub.'
        : 'Hub returned a partial result without a receipt for this resource. Check availability before retrying.';
    }
    return;
  }
  if (
    !rejected &&
    Array.isArray(result) &&
    result.length === items.length &&
    result.every(
      (entry) => entry && typeof entry.signature === 'string' && entry.signature
    )
  ) {
    items.forEach((item, index) => {
      item.state = 'submitted';
      item.signature = result[index].signature;
      item.receipts = [
        ...new Set([...(item.receipts || []), result[index].signature]),
      ];
      item.error = undefined;
    });
    return;
  }
  const message = requestError(
    result,
    'No complete transaction receipt was returned. Check availability before retrying.'
  );
  const declined =
    /user.*declin|user.*denied|cancell?ed|rejected by user/i.test(message);
  items.forEach((item) => {
    item.state = declined ? 'failed' : 'uncertain';
    item.error = message;
  });
};

export const runPublishJob = (id: string): Promise<PublishResult> =>
  withJobLock(id, async () => {
    const job = jobById(id);
    assertAccount(job.publisher);
    if (
      job.items.some(
        (item) => item.state === 'uncertain' || item.state === 'sending'
      )
    )
      throw new Error(
        'Check the uncertain resources before sending again. A previous transaction may still complete.'
      );
    update({
      activeJobId: id,
      activity: 'Checking publish limits…',
      error: null,
      open: true,
    });
    try {
      const limit = await getPublishNodeLimit();
      for (const item of job.items)
        if (item.file && item.service === 'AUDIO')
          validateAudio(item.file, limit);
      const stages = [
        ...new Set(job.items.map((item) => item.stage ?? 0)),
      ].sort((a, b) => a - b);
      for (const stage of stages) {
        while (true) {
          assertAccount(job.publisher);
          const pending = job.items.filter(
            (item) => (item.stage ?? 0) === stage && !accepted(item)
          );
          if (!pending.length) break;
          // A bounded batch keeps confirmation useful without materializing an
          // entire album in a single oversized bridge payload.
          const batch: PublishItem[] = [];
          let bytes = 0;
          for (const item of pending) {
            if (
              batch.length &&
              (batch.length >= 10 || bytes + item.bytes > 500 * 1024 * 1024)
            )
              break;
            batch.push(item);
            bytes += item.bytes;
          }
          batch.forEach((item) => {
            item.state = 'sending';
            item.error = undefined;
            item.chunks = 0;
            item.totalChunks = 0;
          });
          await persist(job);
          assertAccount(job.publisher);
          update({
            activity: `Waiting for Hub approval or sending ${batch.length} resource(s)…`,
          });
          try {
            applyResponse(batch, await send(batch), false);
          } catch (error) {
            applyResponse(batch, error, true);
          }
          await persist(job);
          emitMediaRefresh();
          if (batch.some((item) => !accepted(item))) return summarizeJob(job);
        }
      }
      return summarizeJob(job);
    } catch (error) {
      update({ error: requestError(error) });
      throw error;
    } finally {
      update({ activeJobId: null, activity: '' });
    }
  });

const inspectItem = async (
  item: PublishItem,
  signal: AbortSignal
): Promise<boolean> => {
  const resource = await findExactQdnResource(
    item.service,
    item.name,
    item.identifier,
    { fresh: true, signal }
  );
  if (!resource) return false;
  if (item.title !== undefined && resource.metadata?.title !== item.title)
    return false;
  if (
    item.description !== undefined &&
    (resource.metadata?.description ?? '') !== item.description
  )
    return false;
  let status = await getQdnResourceStatus(
    { service: item.service, name: item.name, identifier: item.identifier },
    { signal }
  );
  if (['PUBLISHED', 'DOWNLOADED', 'MISSING_DATA'].includes(status.status))
    status = await getQdnResourceStatus(
      {
        service: item.service,
        name: item.name,
        identifier: item.identifier,
        build: true,
      },
      { signal }
    );
  if (status.status !== 'READY') return false;
  const url = await getQdnResourceUrl(
    item.service,
    item.name,
    item.identifier,
    { signal }
  );
  if (!url) return false;
  const response = await fetch(url, { signal, cache: 'no-store' });
  return (await hashResponse(response, item.bytes, signal)) === item.sha256;
};
let verificationController: AbortController | undefined;
export const stopPublishVerification = () => verificationController?.abort();
export const checkPublishJob = (
  id: string,
  onlyUnfinished = false
): Promise<PublishResult> =>
  withJobLock(id, async () => {
    const job = jobById(id);
    assertAccount(job.publisher);
    const controller = new AbortController();
    verificationController = controller;
    update({
      activeJobId: id,
      activity: 'Verifying exact resources and bytes…',
      error: null,
    });
    try {
      for (const item of job.items) {
        throwIfAborted(controller.signal);
        if (
          item.state === 'prepared' ||
          item.state === 'verified' ||
          (onlyUnfinished && accepted(item))
        )
          continue;
        update({ activity: `Verifying ${item.filename || item.identifier}…` });
        const timeout = setTimeout(
          () => controller.abort(),
          Math.min(30 * 60_000, 60_000 + (item.bytes / (128 * 1024)) * 1000)
        );
        try {
          const matches = await inspectItem(item, controller.signal);
          if (matches) {
            item.state = 'verified';
            item.error = undefined;
          } else
            item.error =
              'Not verified yet. Data may still be propagating, or this node has a different version.';
        } catch (error) {
          if (controller.signal.aborted) break;
          item.error = requestError(
            error,
            'Availability could not be checked.'
          );
        } finally {
          clearTimeout(timeout);
        }
        await persist(job);
      }
      if (job.items.every((item) => item.state === 'verified')) {
        job.items.forEach((item) => {
          item.file = undefined;
          item.data64 = undefined;
        });
        await persist(job);
      }
      return summarizeJob(job);
    } finally {
      verificationController = undefined;
      update({ activeJobId: null, activity: '' });
      emitMediaRefresh();
    }
  });

export const continuePublishJob = async (id: string) => {
  await checkPublishJob(id, true); // Never resend a resource that read-back proves is already correct.
  return runPublishJob(id);
};
export const archivePublishJob = async (id: string) => {
  const job = jobById(id);
  assertAccount(job.publisher);
  if (snapshot.activeJobId === id || snapshot.waitingJobIds.includes(id))
    throw new Error('Wait for the active send to finish before archiving.');
  job.archived = !job.archived;
  await persist(job);
};
export const recordPublishProgress = (payload: unknown) => {
  if (!payload || typeof payload !== 'object' || !snapshot.activeJobId) return;
  const data = payload as {
    publishLocation?: {
      name?: unknown;
      service?: unknown;
      identifier?: unknown;
    };
    chunks?: unknown;
    totalChunks?: unknown;
  };
  const location = data.publishLocation;
  if (
    !location ||
    typeof location.name !== 'string' ||
    typeof location.service !== 'string' ||
    typeof location.identifier !== 'string'
  )
    return;
  const job = jobById(snapshot.activeJobId);
  const item = job.items.find(
    (entry) =>
      entry.state === 'sending' &&
      mediaKey(entry.service, entry.name, entry.identifier) ===
        mediaKey(
          String(location.service),
          String(location.name),
          String(location.identifier)
        )
  );
  if (!item) return;
  if (typeof data.chunks === 'number' && Number.isFinite(data.chunks))
    item.chunks = Math.max(0, data.chunks);
  if (typeof data.totalChunks === 'number' && Number.isFinite(data.totalChunks))
    item.totalChunks = Math.max(0, data.totalChunks);
  // Progress is display-only. Only receipts and read-back change completion.
  replaceJob(job);
};
export const authorizePublishResend = async (id: string) => {
  const job = jobById(id);
  assertAccount(job.publisher);
  if (snapshot.activeJobId || snapshot.waitingJobIds.length)
    throw new Error('Wait for the active publishing operation to finish.');
  job.items.forEach((item) => {
    if (
      (item.state === 'uncertain' || item.state === 'submitted') &&
      (item.file || item.data64)
    ) {
      item.state = 'failed';
      item.error =
        'Explicit resend authorized. Continue uses the same resource ID.';
    }
  });
  await persist(job);
};
