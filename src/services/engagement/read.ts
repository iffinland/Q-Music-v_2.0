import { fetchQdnResource, searchQdnResources } from '../qdn';
import { withAbort, type ReadOptions } from '../qdnRequests';
import type { QdnSearchResource } from '../../types/media';
export const searchSocial = (
  identifier: string,
  limit: number,
  offset: number,
  options: ReadOptions,
  name?: string,
  before?: number
) =>
  searchQdnResources(
    {
      mode: 'ALL',
      service: 'DOCUMENT',
      identifier,
      prefix: true,
      name,
      before,
      exactMatchNames: Boolean(name),
      limit,
      offset,
      reverse: true,
      includeMetadata: true,
      includeStatus: false,
      excludeBlocked: true,
    },
    { ...options, fresh: true, priority: 'background' }
  );
export const readSocial = async (
  resource: QdnSearchResource,
  options: ReadOptions
) => {
  const controller = new AbortController(),
    abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 8_000);
  try {
    return await withAbort(
      fetchQdnResource<Record<string, unknown>>(
        {
          name: resource.name!,
          service: 'DOCUMENT',
          identifier: resource.identifier!,
        },
        {
          ...options,
          signal: controller.signal,
          fresh: true,
          priority: 'background',
        }
      ),
      controller.signal
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
};
export const socialMetadata = (resource: QdnSearchResource, kind: string) => {
  const desc =
    typeof resource.metadata?.description === 'string'
      ? resource.metadata.description
      : resource.description;
  const match = desc?.match(
    /^qm-social:1:(like|comment):([01]):([a-f0-9]{32})$/
  );
  return match && match[1] === kind
    ? { active: match[2] === '1', revision: match[3] }
    : null;
};
export const mapSocial = async <T>(
  items: QdnSearchResource[],
  work: (item: QdnSearchResource) => Promise<T>
) => {
  const output: T[] = new Array(items.length);
  let offset = 0;
  const worker = async () => {
    while (offset < items.length) {
      const index = offset++;
      output[index] = await work(items[index]);
    }
  };
  await Promise.all([worker(), worker()]);
  return output;
};
export const socialReadBudget = async <T>(
  options: ReadOptions,
  work: (options: ReadOptions) => Promise<T>
): Promise<T> => {
  const controller = new AbortController();
  let expired = false;
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, 15_000);
  try {
    return await work({ ...options, signal: controller.signal });
  } catch (error) {
    if (expired)
      throw new Error(
        'Activity loading timed out. Previously loaded information has been kept; refresh to retry.'
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
};
