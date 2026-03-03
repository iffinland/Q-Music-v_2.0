import type { QdnSearchResource } from '../types/media';

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
}

interface FetchQdnResourceParams {
  name: string;
  service: string;
  identifier: string;
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
const inflightCache = new Map<string, Promise<unknown>>();

const normalize = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const stableKey = (payload: Record<string, unknown>) => {
  const ordered = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});

  return JSON.stringify(ordered);
};

const getCached = <T>(key: string): T | null => {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    resultCache.delete(key);
    return null;
  }
  return entry.value as T;
};

const setCached = (key: string, value: unknown, ttlMs: number) => {
  resultCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
};

const runCached = async <T>(
  payload: Record<string, unknown>,
  ttlMs: number
): Promise<T> => {
  const key = stableKey(payload);
  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  const inflight = inflightCache.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const request = qortalRequest(payload as never)
    .then((result) => {
      setCached(key, result, ttlMs);
      inflightCache.delete(key);
      return result as T;
    })
    .catch((error) => {
      inflightCache.delete(key);
      throw error;
    });

  inflightCache.set(key, request);

  return request;
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
  params: SearchQdnResourcesParams
): Promise<QdnSearchResource[]> => {
  const result = await runCached<unknown>(
    {
      action: 'SEARCH_QDN_RESOURCES',
      ...params,
    },
    60_000
  );

  return Array.isArray(result) ? (result as QdnSearchResource[]) : [];
};

export const fetchQdnResource = async <T>(
  params: FetchQdnResourceParams
): Promise<T | null> => {
  const result = await runCached<unknown>(
    {
      action: 'FETCH_QDN_RESOURCE',
      ...params,
    },
    30_000
  );

  if (
    !result ||
    (typeof result === 'object' && 'error' in (result as object))
  ) {
    return null;
  }

  return result as T;
};

export const getQdnResourceUrl = async (
  service: string,
  name: string,
  identifier: string
): Promise<string | null> => {
  const result = await runCached<unknown>(
    {
      action: 'GET_QDN_RESOURCE_URL',
      service,
      name,
      identifier,
    },
    5 * 60_000
  );

  return typeof result === 'string' && result !== 'Resource does not exist'
    ? result
    : null;
};
