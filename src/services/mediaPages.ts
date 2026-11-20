import type { QdnSearchResource } from '../types/media';
import { searchQdnResources, shouldHideQdnResource } from './qdn';
import { throwIfAborted, type ReadOptions } from './qdnRequests';
import { mediaKey } from '../utils/mediaIdentity';

export interface MediaPage<T> {
  items: T[];
  nextOffset: number;
  hasMore: boolean;
}
export interface MediaPageOptions extends ReadOptions {
  limit?: number;
  offset?: number;
  publisher?: string;
  before?: number;
}

export const readMediaPage = async <T extends { id: string }>(
  service: string,
  prefix: string,
  map: (resource: QdnSearchResource) => T | null,
  options: MediaPageOptions = {}
): Promise<MediaPage<T>> => {
  const target = Math.max(1, options.limit ?? 24);
  let offset = options.offset ?? 0;
  let hasMore = true;
  const items = new Map<string, T>();
  while (items.size < target && hasMore) {
    throwIfAborted(options.signal);
    const limit = Math.min(100, target - items.size);
    const page = await searchQdnResources(
      {
        mode: 'ALL',
        service,
        identifier: prefix,
        prefix: true,
        ...(options.publisher
          ? { name: options.publisher.trim(), exactMatchNames: true }
          : {}),
        ...(options.before ? { before: options.before } : {}),
        limit,
        offset,
        reverse: true,
        includeMetadata: true,
        includeStatus: false,
        excludeBlocked: true,
      },
      options
    );
    offset += page.length;
    hasMore = page.length === limit;
    for (const resource of page) {
      if (
        !resource.identifier?.startsWith(prefix) ||
        !resource.name ||
        shouldHideQdnResource(resource)
      )
        continue;
      const item = map(resource);
      if (item)
        items.set(mediaKey(service, resource.name, resource.identifier), item);
    }
  }
  return { items: [...items.values()], nextOffset: offset, hasMore };
};
