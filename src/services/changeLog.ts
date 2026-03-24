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

interface ChangeLogPayload {
  html?: string;
  updatedAt?: number;
}

export interface ChangeLogEntry {
  publisher: string;
  identifier: string;
  html: string;
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

export const fetchChangeLog = async (): Promise<ChangeLogEntry | null> => {
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

  const html = normalizeHtml(payload?.html);

  return {
    publisher: resource.name,
    identifier: resource.identifier,
    html,
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

  await performQortalRequest(
    {
      action: 'PUBLISH_QDN_RESOURCE',
      name: params.publisher,
      service: CHANGE_LOG_SERVICE,
      identifier: CHANGE_LOG_IDENTIFIER,
      title: CHANGE_LOG_TITLE,
      description: 'Latest Q-Music release notes and updates.',
      data64: await objectToBase64({
        html,
        updatedAt: Date.now(),
      } satisfies ChangeLogPayload),
      encoding: 'base64',
    },
    'Failed to publish the change log.'
  );

  invalidateChangeLogCache();
};
