import type { QdnSearchResource } from '../types/media';
import {
  abortError,
  delay,
  readQueue,
  requestError,
  throwIfAborted,
  withAbort,
  type ReadOptions,
} from './qdnRequests';

interface SearchQdnResourcesParams {
  mode?: 'ALL' | 'LATEST' | 'RANDOM' | string;
  service: string;
  query?: string;
  name?: string;
  identifier?: string;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  includeMetadata?: boolean;
  includeStatus?: boolean;
  excludeBlocked?: boolean;
  exactMatchNames?: boolean;
  prefix?: boolean;
  before?: number;
}

interface FetchQdnResourceParams {
  name: string;
  service: string;
  identifier: string;
}

interface QdnResourcePropertiesParams {
  name: string;
  service: string;
  identifier: string;
}

interface QdnResourceStatusParams {
  name: string;
  service: string;
  identifier: string;
  build?: boolean;
}

export interface QdnResourceStatus {
  id?: string;
  status: string;
  description?: string;
  localChunkCount?: number;
  totalChunkCount?: number;
  percentLoaded?: number;
}

const TRACKING_PREFIXES = ['enjoymusic_', 'qmusic_'];
const LIKE_ARTIFACT_PREFIXES = [
  'song_like_',
  'playlist_like_',
  'podcast_like_',
  'video_like_',
  'audiobook_like_',
  'enjoymusic_request_like_',
  'qm_discussion_like_',
];
const DELETED_MARKER = 'deleted';

const resultCache = new Map<string, { expiresAt: number; value: unknown }>();
interface PendingRead {
  promise: Promise<unknown>;
  controller: AbortController;
  users: number;
}
const inflightCache = new Map<string, PendingRead>();
let cacheGeneration = 0;
const QDN_READY_STATUS = 'READY';
const QDN_BUILDABLE_STATUSES = new Set([
  'PUBLISHED',
  'DOWNLOADED',
  'MISSING_DATA',
]);
const QDN_TERMINAL_ERROR_STATUSES = new Set([
  'UNSUPPORTED',
  'BLOCKED',
  'NOT_PUBLISHED',
  'BUILD_FAILED',
]);
const normalize = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';
const stableKey = (payload: Record<string, unknown>) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))
    )
  );

export const invalidateQdnCache = (
  predicate: (payload: Record<string, unknown>) => boolean
) => {
  cacheGeneration++;
  for (const key of resultCache.keys()) {
    if (predicate(JSON.parse(key))) resultCache.delete(key);
  }
  for (const [key, entry] of inflightCache) {
    if (predicate(JSON.parse(key))) {
      entry.controller.abort();
      inflightCache.delete(key);
    }
  }
};

const normalizeStatusField = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const normalizeQdnStatus = (value: unknown): QdnResourceStatus => {
  if (typeof value === 'string') {
    return {
      status: normalizeStatusField(value) || 'UNKNOWN',
      description: value,
    };
  }

  if (!value || typeof value !== 'object') {
    return { status: 'UNKNOWN' };
  }

  const payload = value as Record<string, unknown>;
  const localChunkCount =
    toFiniteNumber(payload.localChunkCount) ??
    toFiniteNumber(payload.localChunk_count) ??
    toFiniteNumber(payload.localChunk);
  const totalChunkCount =
    toFiniteNumber(payload.totalChunkCount) ??
    toFiniteNumber(payload.totalChunk_count) ??
    toFiniteNumber(payload.totalChunk);
  const percentLoaded =
    toFiniteNumber(payload.percentLoaded) ??
    toFiniteNumber(payload.percent_loaded) ??
    (localChunkCount !== undefined &&
    totalChunkCount !== undefined &&
    totalChunkCount > 0
      ? Math.round((localChunkCount / totalChunkCount) * 100)
      : undefined);

  return {
    id: typeof payload.id === 'string' ? payload.id : undefined,
    status:
      normalizeStatusField(payload.status) ||
      normalizeStatusField(payload.localStatus) ||
      'UNKNOWN',
    description:
      typeof payload.description === 'string' ? payload.description : undefined,
    localChunkCount,
    totalChunkCount,
    percentLoaded,
  };
};

const runCached = async <T>(
  payload: Record<string, unknown>,
  ttlMs: number,
  validate: (value: unknown) => T,
  options: ReadOptions = {}
): Promise<T> => {
  throwIfAborted(options.signal);
  const key = stableKey(payload);
  const cached = resultCache.get(key);
  if (!options.fresh && cached && cached.expiresAt > Date.now())
    return cached.value as T;
  resultCache.delete(key);
  let entry = inflightCache.get(key);
  if (!entry || entry.controller.signal.aborted) {
    const controller = new AbortController();
    const generation = cacheGeneration;
    const created: PendingRead = {
      controller,
      users: 0,
      promise: Promise.resolve(),
    };
    created.promise = readQueue
      .run(
        async () => {
          throwIfAborted(controller.signal);
          if (typeof qortalRequest !== 'function')
            throw new Error('Open Q-Music in Qortal Hub to load music.');
          const result = await qortalRequest(payload as never);
          throwIfAborted(controller.signal);
          if (result && typeof result === 'object' && 'error' in result)
            throw new Error(requestError(result));
          const value = validate(result);
          if (ttlMs > 0 && generation === cacheGeneration) {
            if (resultCache.size >= 256)
              resultCache.delete(resultCache.keys().next().value!);
            resultCache.set(key, { expiresAt: Date.now() + ttlMs, value });
          }
          return value;
        },
        { ...options, signal: controller.signal }
      )
      .finally(() => {
        if (inflightCache.get(key) === created) inflightCache.delete(key);
      });
    entry = created;
    inflightCache.set(key, entry);
  }
  const shared = entry;
  shared.users++;
  try {
    return await withAbort(shared.promise as Promise<T>, options.signal);
  } finally {
    shared.users--;
    if (shared.users === 0) shared.controller.abort();
  }
};

const hasStringValue = (value: unknown): boolean => {
  const normalized = normalize(value);
  return normalized.length > 0 && normalized !== DELETED_MARKER;
};

const hasDeletedMarker = (resource: QdnSearchResource): boolean => {
  return [
    resource.name,
    resource.identifier,
    resource.metadata?.title,
    resource.metadata?.description,
  ].some((candidate) => normalize(candidate) === DELETED_MARKER);
};

const hasMeaningfulMetadata = (resource: QdnSearchResource): boolean => {
  const metadata = resource.metadata ?? {};
  if (hasStringValue(metadata.title) || hasStringValue(resource.title))
    return true;
  if (
    hasStringValue(metadata.description) ||
    hasStringValue(resource.description)
  ) {
    return true;
  }

  return Object.entries(metadata).some(([key, value]) => {
    if (key === 'title' || key === 'description') return false;
    if (Array.isArray(value)) return value.length > 0;
    return hasStringValue(value);
  });
};

export const shouldHideQdnResource = (resource: QdnSearchResource): boolean => {
  const identifier = normalize(resource.identifier);

  if (!identifier) return false;
  if (!TRACKING_PREFIXES.some((prefix) => identifier.startsWith(prefix)))
    return false;
  if (LIKE_ARTIFACT_PREFIXES.some((prefix) => identifier.startsWith(prefix)))
    return true;
  if (hasDeletedMarker(resource)) return true;

  const metadataKeys = resource.metadata ? Object.keys(resource.metadata) : [];
  const hasZeroSize = typeof resource.size === 'number' && resource.size <= 0;
  if (metadataKeys.length === 0 && hasZeroSize) return true;

  if (
    typeof resource.size === 'number' &&
    resource.size <= 1024 &&
    !hasMeaningfulMetadata(resource)
  ) {
    return true;
  }

  return false;
};

export const searchQdnResources = async (
  params: SearchQdnResourcesParams,
  options: ReadOptions = {}
): Promise<QdnSearchResource[]> =>
  runCached(
    { action: 'SEARCH_QDN_RESOURCES', ...params },
    30_000,
    (value) => {
      if (
        !Array.isArray(value) ||
        value.some(
          (item) => !item || typeof item !== 'object' || Array.isArray(item)
        )
      )
        throw new Error(
          'The node returned an invalid music list. Please retry.'
        );
      return value as QdnSearchResource[];
    },
    options
  );

export const fetchQdnResource = async <T>(
  params: FetchQdnResourceParams,
  options: ReadOptions = {}
): Promise<T | null> =>
  runCached(
    { action: 'FETCH_QDN_RESOURCE', ...params },
    30_000,
    (value) => (value ?? null) as T | null,
    options
  );

export const getQdnResourceProperties = async (
  params: QdnResourcePropertiesParams,
  options: ReadOptions = {}
): Promise<Record<string, unknown> | null> => {
  try {
    return await runCached(
      { action: 'GET_QDN_RESOURCE_PROPERTIES', ...params },
      0,
      (value) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)
          : null,
      options
    );
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return null;
  }
};

export const getQdnResourceStatus = async (
  params: QdnResourceStatusParams,
  options: ReadOptions = {}
): Promise<QdnResourceStatus> =>
  runCached(
    { action: 'GET_QDN_RESOURCE_STATUS', ...params },
    0,
    normalizeQdnStatus,
    options
  );

export const isQdnResourceReady = (status?: string) =>
  normalizeStatusField(status) === QDN_READY_STATUS;
export const shouldTriggerQdnBuild = (status?: string) =>
  QDN_BUILDABLE_STATUSES.has(normalizeStatusField(status));

export const waitForQdnResourceReady = async (
  params: QdnResourceStatusParams & {
    timeoutMs?: number;
    pollIntervalMs?: number;
    signal?: AbortSignal;
    priority?: ReadOptions['priority'];
    onStatusChange?: (status: QdnResourceStatus) => void;
  }
): Promise<QdnResourceStatus> => {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  params.signal?.addEventListener('abort', onAbort, { once: true });
  if (params.signal?.aborted) controller.abort();
  const timer = setTimeout(
    () => controller.abort(),
    params.timeoutMs ?? 45_000
  );
  let latestStatus: QdnResourceStatus = { status: 'UNKNOWN' };
  let buildTriggered = false;
  try {
    while (!controller.signal.aborted) {
      latestStatus = await getQdnResourceStatus(
        {
          name: params.name,
          service: params.service,
          identifier: params.identifier,
        },
        { signal: controller.signal, priority: params.priority }
      );
      params.onStatusChange?.(latestStatus);
      if (
        isQdnResourceReady(latestStatus.status) ||
        QDN_TERMINAL_ERROR_STATUSES.has(latestStatus.status)
      )
        return latestStatus;
      if (!buildTriggered && shouldTriggerQdnBuild(latestStatus.status)) {
        buildTriggered = true;
        latestStatus = await getQdnResourceStatus(
          {
            name: params.name,
            service: params.service,
            identifier: params.identifier,
            build: true,
          },
          { signal: controller.signal, priority: params.priority }
        );
        params.onStatusChange?.(latestStatus);
        if (
          isQdnResourceReady(latestStatus.status) ||
          QDN_TERMINAL_ERROR_STATUSES.has(latestStatus.status)
        )
          return latestStatus;
      }
      await delay(params.pollIntervalMs ?? 2_000, controller.signal);
    }
    return latestStatus;
  } catch (error) {
    if (params.signal?.aborted) throw abortError();
    if (controller.signal.aborted) return latestStatus;
    throw error;
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', onAbort);
  }
};

export const getQdnResourceUrl = async (
  service: string,
  name: string,
  identifier: string,
  options: ReadOptions & { retries?: number; retryDelayMs?: number } = {}
): Promise<string | null> => {
  // URLs are node-specific; never retain a previous node's URL in storage.
  for (let attempt = 0; ; attempt++) {
    throwIfAborted(options.signal);
    try {
      return await runCached(
        { action: 'GET_QDN_RESOURCE_URL', service, name, identifier },
        0,
        (value) => {
          if (
            typeof value !== 'string' ||
            !value.trim() ||
            value === 'Resource does not exist'
          )
            throw new Error('Resource does not exist');
          const url = new URL(value, window.location.href);
          if (!['http:', 'https:'].includes(url.protocol))
            throw new Error('The node returned an invalid resource URL.');
          return url.href;
        },
        options
      );
    } catch (error) {
      throwIfAborted(options.signal);
      if (attempt >= (options.retries ?? 0))
        throw new Error(
          requestError(error, 'Audio could not be loaded. Please retry.')
        );
      await delay(options.retryDelayMs ?? 750, options.signal);
    }
  }
};

export const findExactQdnResource = async (
  service: string,
  name: string,
  identifier: string,
  options: ReadOptions = {}
) => {
  let offset = 0;
  while (true) {
    const page = await searchQdnResources(
      {
        mode: 'ALL',
        service,
        name,
        exactMatchNames: true,
        identifier,
        prefix: true,
        limit: 100,
        offset,
        reverse: true,
        includeMetadata: true,
        includeStatus: false,
        excludeBlocked: true,
      },
      options
    );
    const match = page.find(
      (item) =>
        item.name?.toLowerCase() === name.toLowerCase() &&
        item.identifier === identifier
    );
    if (match) return shouldHideQdnResource(match) ? null : match;
    if (page.length < 100) return null;
    offset += page.length;
    throwIfAborted(options.signal);
  }
};
