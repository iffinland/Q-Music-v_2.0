import {
  invalidateQdnCache,
  searchQdnResources,
  waitForQdnResourceReady,
} from './qdn';
import {
  FETCH_LIMIT,
  LIKE_PROPAGATION_POLL_MS,
  LIKE_PROPAGATION_TIMEOUT_MS,
  buildEntityKey,
  deleteQdnResource,
  encodeObject,
  performQortalRequest,
  sleep,
} from './entityEngagementShared';

const SONG_LIKE_PREFIX = 'song_like_';
const PLAYLIST_LIKE_PREFIX = 'playlist_like_';

const getLikePrefix = (entityType: 'song' | 'playlist') =>
  entityType === 'song' ? SONG_LIKE_PREFIX : PLAYLIST_LIKE_PREFIX;

export const buildLikeIdentifier = (
  entityType: 'song' | 'playlist',
  entityId: string
) => `${getLikePrefix(entityType)}${buildEntityKey(entityId)}`;

const invalidateLikeQueries = (
  entityType: 'song' | 'playlist',
  entityId: string,
  username?: string
) => {
  const identifier = buildLikeIdentifier(entityType, entityId);

  invalidateQdnCache((payload) => {
    if (payload.service !== 'DOCUMENT') {
      return false;
    }

    if (payload.identifier !== identifier) {
      return false;
    }

    if (payload.action === 'SEARCH_QDN_RESOURCES') {
      return true;
    }

    if (payload.action === 'GET_QDN_RESOURCE_STATUS') {
      return payload.name === username;
    }

    if (payload.action === 'FETCH_QDN_RESOURCE') {
      return username ? payload.name === username : true;
    }

    return false;
  });
};

const waitForLikeRemoval = async (
  entityType: 'song' | 'playlist',
  username: string,
  entityId: string
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= LIKE_PROPAGATION_TIMEOUT_MS) {
    invalidateLikeQueries(entityType, entityId, username);
    const result = await searchQdnResources({
      mode: 'ALL',
      service: 'DOCUMENT',
      name: username,
      identifier: buildLikeIdentifier(entityType, entityId),
      query: buildLikeIdentifier(entityType, entityId),
      limit: 1,
      offset: 0,
      includeMetadata: false,
      includeStatus: true,
      excludeBlocked: true,
      exactMatchNames: true,
    });

    if (result.length === 0) {
      return;
    }

    await sleep(LIKE_PROPAGATION_POLL_MS);
  }
};

export const fetchLikeCount = async (
  entityType: 'song' | 'playlist',
  entityId: string
): Promise<number> => {
  let total = 0;
  let offset = 0;

  while (true) {
    const page = await searchQdnResources({
      mode: 'ALL',
      service: 'DOCUMENT',
      identifier: buildLikeIdentifier(entityType, entityId),
      limit: FETCH_LIMIT,
      offset,
      includeMetadata: false,
      includeStatus: false,
      excludeBlocked: true,
    });

    if (!page.length) break;
    total += page.length;
    if (page.length < FETCH_LIMIT) break;
    offset += FETCH_LIMIT;
  }

  return total;
};

export const hasUserLiked = async (
  entityType: 'song' | 'playlist',
  username: string,
  entityId: string
): Promise<boolean> => {
  const identifier = buildLikeIdentifier(entityType, entityId);
  const resources = await searchQdnResources({
    mode: 'ALL',
    service: 'DOCUMENT',
    name: username,
    identifier,
    query: identifier,
    limit: 1,
    offset: 0,
    includeMetadata: false,
    includeStatus: true,
    excludeBlocked: true,
    exactMatchNames: true,
  });

  return resources.some(
    (resource) => resource.name === username && resource.identifier === identifier
  );
};

export const likeEntity = async (params: {
  entityType: 'song' | 'playlist';
  username: string;
  entityId: string;
  entityPublisher: string;
  title: string;
}) => {
  const identifier = buildLikeIdentifier(params.entityType, params.entityId);
  const data64 = await encodeObject({
    entityId: params.entityId,
    entityPublisher: params.entityPublisher,
    title: params.title,
    likedAt: Date.now(),
  });

  await performQortalRequest(
    {
      action: 'PUBLISH_QDN_RESOURCE',
      name: params.username,
      service: 'DOCUMENT',
      identifier,
      data64,
      encoding: 'base64',
      title: `Like: ${params.title}`.slice(0, 55),
      description:
        `${params.entityType} like for ${params.entityPublisher}/${params.entityId}`.slice(
          0,
          4000
        ),
    },
    'Failed to publish like.'
  );

  invalidateLikeQueries(params.entityType, params.entityId, params.username);
  await waitForQdnResourceReady({
    name: params.username,
    service: 'DOCUMENT',
    identifier,
    timeoutMs: LIKE_PROPAGATION_TIMEOUT_MS,
    pollIntervalMs: LIKE_PROPAGATION_POLL_MS,
  });
  invalidateLikeQueries(params.entityType, params.entityId, params.username);
};

export const unlikeEntity = async (
  entityType: 'song' | 'playlist',
  username: string,
  entityId: string
) => {
  await deleteQdnResource(username, buildLikeIdentifier(entityType, entityId));
  invalidateLikeQueries(entityType, entityId, username);
  await waitForLikeRemoval(entityType, username, entityId);
  invalidateLikeQueries(entityType, entityId, username);
};
