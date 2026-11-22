import type { QdnSearchResource } from '../types/media';
import { searchQdnResources, shouldHideQdnResource } from './qdn';
import { throwIfAborted, type ReadOptions } from './qdnRequests';

export interface MediaPage<T> {
  items: T[];
  nextOffset: number;
  nextCursor?: MediaCursor;
  hasMore: boolean;
}
export interface MediaPageOptions extends ReadOptions {
  cursor?: MediaCursor;
  limit?: number;
  offset?: number;
  publisher?: string;
  before?: number;
  reverse?: boolean;
}

export interface PrefixCursor {
  offset: number;
  hasMore: boolean;
  buffer: QdnSearchResource[];
}
export type MediaCursor = Record<string, PrefixCursor>;

// Merge bounded, independently paged source indexes by creation time. Unconsumed
// rows stay in the caller-owned cursor; a numeric aggregate offset cannot resume
// two different prefixes without skipping resources.
export const readMediaPrefixesPage = async <T extends { id: string }>(
  service: string,
  prefixes: readonly string[],
  map: (resource: QdnSearchResource) => T | null,
  options: MediaPageOptions = {}
): Promise<MediaPage<T>> => {
  if (options.offset && !options.cursor)
    throw new Error(
      'A combined music catalog requires its source cursor. Refresh the catalog.'
    );
  const target = Math.max(1, Math.min(100, options.limit ?? 24));
  const cursor: MediaCursor = Object.fromEntries(
    prefixes.map((prefix) => {
      const old = options.cursor?.[prefix];
      return [
        prefix,
        old
          ? { ...old, buffer: [...old.buffer] }
          : { offset: 0, hasMore: true, buffer: [] },
      ];
    })
  );
  const items = new Map<string, T>();
  const head = async (
    prefix: string
  ): Promise<{ resource: QdnSearchResource; item: T } | null> => {
    const state = cursor[prefix];
    while (true) {
      throwIfAborted(options.signal);
      while (state.buffer.length) {
        const resource = state.buffer[0];
        const valid =
          resource.identifier?.startsWith(prefix) &&
          resource.identifier.length > prefix.length &&
          resource.name &&
          (!resourceService(resource) ||
            resourceService(resource) === service) &&
          (!options.publisher ||
            resource.name.toLowerCase() ===
              options.publisher.trim().toLowerCase()) &&
          !shouldHideQdnResource(resource);
        const item = valid ? map(resource) : null;
        if (item) return { resource, item };
        state.buffer.shift();
      }
      if (!state.hasMore) return null;
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
          limit: target,
          offset: state.offset,
          reverse: options.reverse ?? true,
          includeMetadata: true,
          includeStatus: false,
          excludeBlocked: true,
        },
        options
      );
      throwIfAborted(options.signal);
      state.offset += page.length;
      state.hasMore = page.length === target;
      state.buffer = [...page];
    }
  };
  while (items.size < target) {
    // At most one read per source at a time; the shared bridge queue still owns
    // total concurrency and reserves capacity for active playback.
    const candidates = (
      await Promise.all(
        prefixes.map(async (prefix) => ({ prefix, value: await head(prefix) }))
      )
    ).filter(
      (
        row
      ): row is {
        prefix: string;
        value: { resource: QdnSearchResource; item: T };
      } => Boolean(row.value)
    );
    throwIfAborted(options.signal);
    if (!candidates.length) break;
    candidates.sort(
      (a, b) =>
        ((options.reverse ?? true) ? -1 : 1) *
          ((a.value.resource.created || 0) - (b.value.resource.created || 0)) ||
        a.value.item.id.localeCompare(b.value.item.id)
    );
    const chosen = candidates[0];
    cursor[chosen.prefix].buffer.shift();
    items.set(chosen.value.item.id, chosen.value.item);
  }
  return {
    items: [...items.values()],
    nextOffset: Object.values(cursor).reduce(
      (sum, state) => sum + state.offset,
      0
    ),
    nextCursor: cursor,
    hasMore: Object.values(cursor).some(
      (state) => state.hasMore || state.buffer.length > 0
    ),
  };
};
const resourceService = (resource: QdnSearchResource) =>
  (resource as QdnSearchResource & { service?: string }).service;
