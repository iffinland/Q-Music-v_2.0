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
const inflightCache = new Map<string, Promise<unknown>>();
const SESSION_CACHE_PREFIX = 'qmusic20.qdn.cache:';
const QDN_READY_STATUS = 'READY';
const QDN_BUILDABLE_STATUSES = new Set([
  'PUBLISHED',
  'DOWNLOADING',
  'DOWNLOADED',
  'BUILDING',
]);
const QDN_TERMINAL_ERROR_STATUSES = new Set([
  'UNSUPPORTED',
  'BLOCKED',
  'NOT_PUBLISHED',
  'MISSING_DATA',
]);

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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getSessionStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getPersistedCache = <T>(key: string): T | null => {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const rawValue = storage.getItem(`${SESSION_CACHE_PREFIX}${key}`);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as {
      expiresAt?: number;
      value?: T;
    };

    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt < Date.now()) {
      storage.removeItem(`${SESSION_CACHE_PREFIX}${key}`);
      return null;
    }

    return parsed.value ?? null;
  } catch {
    return null;
  }
};

const setPersistedCache = (key: string, value: unknown, ttlMs: number) => {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(
      `${SESSION_CACHE_PREFIX}${key}`,
      JSON.stringify({
        expiresAt: Date.now() + ttlMs,
        value,
      })
    );
  } catch {
    // Ignore storage quota and private-mode failures.
  }
};

const getCached = <T>(key: string): T | null => {
  const entry = resultCache.get(key);
  if (entry) {
    if (entry.expiresAt < Date.now()) {
      resultCache.delete(key);
    } else {
      return entry.value as T;
    }
  }

  const persistedValue = getPersistedCache<T>(key);
  if (persistedValue !== null) {
    return persistedValue;
  }

  return null;
};

const setCached = (key: string, value: unknown, ttlMs: number) => {
  resultCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
  setPersistedCache(key, value, ttlMs);
};

const clearCached = (key: string) => {
  resultCache.delete(key);
  inflightCache.delete(key);

  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(`${SESSION_CACHE_PREFIX}${key}`);
  } catch {
    // Ignore storage access failures.
  }
};

const parseStableKey = (key: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(key);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const invalidateQdnCache = (
  predicate: (payload: Record<string, unknown>) => boolean
) => {
  for (const key of resultCache.keys()) {
    const payload = parseStableKey(key);
    if (payload && predicate(payload)) {
      resultCache.delete(key);
    }
  }

  for (const key of inflightCache.keys()) {
    const payload = parseStableKey(key);
    if (payload && predicate(payload)) {
      inflightCache.delete(key);
    }
  }

  const storage = getSessionStorage();
  if (!storage) return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const storageKey = storage.key(index);
    if (!storageKey?.startsWith(SESSION_CACHE_PREFIX)) {
      continue;
    }

    const payload = parseStableKey(storageKey.slice(SESSION_CACHE_PREFIX.length));
    if (payload && predicate(payload)) {
      keysToRemove.push(storageKey);
    }
  }

  keysToRemove.forEach((key) => {
    storage.removeItem(key);
  });
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

export const getQdnResourceProperties = async (
  params: QdnResourcePropertiesParams
): Promise<Record<string, unknown> | null> => {
  try {
    const result = await qortalRequest({
      action: 'GET_QDN_RESOURCE_PROPERTIES',
      name: params.name,
      service: params.service,
      identifier: params.identifier,
    } as never);

    return result && typeof result === 'object'
      ? (result as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const getQdnResourceStatus = async (
  params: QdnResourceStatusParams
): Promise<QdnResourceStatus> => {
  const result = await qortalRequest({
    action: 'GET_QDN_RESOURCE_STATUS',
    name: params.name,
    service: params.service,
    identifier: params.identifier,
    ...(params.build ? { build: true } : {}),
  } as never);

  return normalizeQdnStatus(result);
};

export const isQdnResourceReady = (status?: string) =>
  normalizeStatusField(status) === QDN_READY_STATUS;

export const shouldTriggerQdnBuild = (status?: string) =>
  QDN_BUILDABLE_STATUSES.has(normalizeStatusField(status));

export const waitForQdnResourceReady = async (
  params: QdnResourceStatusParams & {
    timeoutMs?: number;
    pollIntervalMs?: number;
    onStatusChange?: (status: QdnResourceStatus) => void;
  }
): Promise<QdnResourceStatus> => {
  const timeoutMs = params.timeoutMs ?? 45_000;
  const pollIntervalMs = params.pollIntervalMs ?? 1_500;
  const startedAt = Date.now();
  let buildTriggered = false;
  let latestStatus: QdnResourceStatus = { status: 'UNKNOWN' };

  while (Date.now() - startedAt <= timeoutMs) {
    latestStatus = await getQdnResourceStatus({
      name: params.name,
      service: params.service,
      identifier: params.identifier,
      ...(buildTriggered ? { build: false } : {}),
    });
    params.onStatusChange?.(latestStatus);

    if (isQdnResourceReady(latestStatus.status)) {
      return latestStatus;
    }

    if (!buildTriggered && shouldTriggerQdnBuild(latestStatus.status)) {
      buildTriggered = true;
      latestStatus = await getQdnResourceStatus({
        name: params.name,
        service: params.service,
        identifier: params.identifier,
        build: true,
      });
      params.onStatusChange?.(latestStatus);

      if (isQdnResourceReady(latestStatus.status)) {
        return latestStatus;
      }
    }

    if (
      QDN_TERMINAL_ERROR_STATUSES.has(normalizeStatusField(latestStatus.status))
    ) {
      return latestStatus;
    }

    await sleep(pollIntervalMs);
  }

  return latestStatus;
};

export const getQdnResourceUrl = async (
  service: string,
  name: string,
  identifier: string,
  options?: {
    retries?: number;
    retryDelayMs?: number;
  }
): Promise<string | null> => {
  const payload = {
    action: 'GET_QDN_RESOURCE_URL',
    service,
    name,
    identifier,
  } as const;
  const cacheKey = stableKey(payload);
  const retries = Math.max(0, options?.retries ?? 0);
  const retryDelayMs = Math.max(0, options?.retryDelayMs ?? 750);

  const cached = getCached<unknown>(cacheKey);
  if (typeof cached === 'string' && cached !== 'Resource does not exist') {
    return cached;
  }
  if (cached === 'Resource does not exist') {
    clearCached(cacheKey);
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const inflight = inflightCache.get(cacheKey);
    const request =
      inflight ??
      qortalRequest(payload as never)
        .finally(() => {
          inflightCache.delete(cacheKey);
        });

    if (!inflight) {
      inflightCache.set(cacheKey, request);
    }

    const result = await request;
    if (typeof result === 'string' && result !== 'Resource does not exist') {
      setCached(cacheKey, result, 5 * 60_000);
      return result;
    }

    clearCached(cacheKey);
    if (attempt < retries) {
      await sleep(retryDelayMs);
    }
  }

  return null;
};
