import { objectToBase64 } from 'qapp-core';
import {
  fetchQdnResource,
  invalidateQdnCache,
  searchQdnResources,
  shouldHideQdnResource,
  waitForQdnResourceReady,
} from './qdn';
import { performQortalRequest } from './entityEngagementShared';

const CHANGE_LOG_IDENTIFIER = 'qmusic_change_log';
const CHANGE_LOG_SERVICE = 'DOCUMENT' as const;
const CHANGE_LOG_TITLE = 'Q-Music Change Log';
const MAX_CHANGE_LOG_ENTRIES = 50;

interface ChangeLogPayload {
  entries?: ChangeLogHistoryEntry[];
  html?: string;
  updatedAt?: number;
}

export interface ChangeLogHistoryEntry {
  id: string;
  html: string;
  publishedAt: number;
}

export interface ChangeLogDocument {
  publisher: string;
  identifier: string;
  entries: ChangeLogHistoryEntry[];
  updatedAt: number;
}

const normalizeHtml = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const invalidateChangeLogCache = () => {
  invalidateQdnCache((payload) => {
    if (payload.service !== CHANGE_LOG_SERVICE) {
      return false;
    }

    if (payload.identifier !== CHANGE_LOG_IDENTIFIER) {
      return false;
    }

    return (
      payload.action === 'SEARCH_QDN_RESOURCES' ||
      payload.action === 'FETCH_QDN_RESOURCE' ||
      payload.action === 'GET_QDN_RESOURCE_STATUS'
    );
  });
};

const normalizeEntries = (payload: ChangeLogPayload | null) => {
  const entries = Array.isArray(payload?.entries)
    ? payload.entries
        .map((entry) => {
          const html = normalizeHtml(entry?.html);
          if (!html) {
            return null;
          }

          return {
            id:
              typeof entry?.id === 'string' && entry.id.trim()
                ? entry.id.trim()
                : `${entry?.publishedAt || Date.now()}`,
            html,
            publishedAt:
              typeof entry?.publishedAt === 'number'
                ? entry.publishedAt
                : Date.now(),
          } satisfies ChangeLogHistoryEntry;
        })
        .filter((entry): entry is ChangeLogHistoryEntry => Boolean(entry))
    : [];

  if (entries.length > 0) {
    return [...entries].sort(
      (left, right) => right.publishedAt - left.publishedAt
    );
  }

  const legacyHtml = normalizeHtml(payload?.html);
  if (!legacyHtml) {
    return [];
  }

  return [
    {
      id: `legacy-${payload?.updatedAt || Date.now()}`,
      html: legacyHtml,
      publishedAt:
        typeof payload?.updatedAt === 'number' ? payload.updatedAt : Date.now(),
    },
  ] satisfies ChangeLogHistoryEntry[];
};

export const fetchChangeLog = async (): Promise<ChangeLogDocument | null> => {
  const resources = await searchQdnResources({
    mode: 'ALL',
    service: CHANGE_LOG_SERVICE,
    identifier: CHANGE_LOG_IDENTIFIER,
    query: CHANGE_LOG_IDENTIFIER,
    limit: 1,
    offset: 0,
    reverse: true,
    includeMetadata: true,
    includeStatus: true,
    excludeBlocked: true,
  });

  const resource = resources.find((entry) => !shouldHideQdnResource(entry));
  if (!resource?.name || !resource.identifier) {
    return null;
  }

  await waitForQdnResourceReady({
    name: resource.name,
    service: CHANGE_LOG_SERVICE,
    identifier: resource.identifier,
    timeoutMs: 20_000,
  });

  const payload = await fetchQdnResource<ChangeLogPayload>({
    name: resource.name,
    service: CHANGE_LOG_SERVICE,
    identifier: resource.identifier,
  });
  const entries = normalizeEntries(payload);

  return {
    publisher: resource.name,
    identifier: resource.identifier,
    entries,
    updatedAt:
      typeof payload?.updatedAt === 'number'
        ? payload.updatedAt
        : resource.updated || resource.created || Date.now(),
  };
};

export const publishChangeLog = async (params: {
  publisher: string;
  html: string;
}) => {
  const html = normalizeHtml(params.html);
  const current = await fetchChangeLog();
  const nextEntry: ChangeLogHistoryEntry = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}`,
    html,
    publishedAt: Date.now(),
  };
  const entries = [nextEntry, ...(current?.entries || [])].slice(
    0,
    MAX_CHANGE_LOG_ENTRIES
  );

  await performQortalRequest(
    {
      action: 'PUBLISH_QDN_RESOURCE',
      name: params.publisher,
      service: CHANGE_LOG_SERVICE,
      identifier: CHANGE_LOG_IDENTIFIER,
      title: CHANGE_LOG_TITLE,
      description: 'Latest Q-Music release notes and updates.',
      data64: await objectToBase64({
        entries,
        updatedAt: Date.now(),
      } satisfies ChangeLogPayload),
      encoding: 'base64',
    },
    'Failed to publish the change log.'
  );

  invalidateChangeLogCache();
};
