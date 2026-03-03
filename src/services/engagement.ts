import { objectToBase64 } from 'qapp-core';
import { fetchQdnResource, searchQdnResources } from './qdn';
import type { MediaComment, MediaModerationState } from '../types/engagement';

const SONG_LIKE_PREFIX = 'song_like_';
const PLAYLIST_LIKE_PREFIX = 'playlist_like_';
const SONG_COMMENT_PREFIX = 'enjoymusic_song_comment_';
const PLAYLIST_COMMENT_PREFIX = 'enjoymusic_playlist_comment_';
const SONG_MODERATION_PREFIX = 'enjoymusic_song_moderation_';
const PLAYLIST_MODERATION_PREFIX = 'enjoymusic_playlist_moderation_';
const FETCH_LIMIT = 50;

const buildShortId = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

const hashEntityId = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

const buildEntityKey = (entityId: string) => {
  const compact = entityId.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const prefix = compact.slice(0, 16) || 'entity';
  return `${prefix}_${hashEntityId(entityId)}`;
};

const extractRequestError = (result: unknown): string | null => {
  if (typeof result === 'string') {
    const normalized = result.trim();
    if (!normalized) return null;
    if (/declined|denied|failed|error|cancel/i.test(normalized)) {
      return normalized;
    }
    return null;
  }

  if (!result || typeof result !== 'object') {
    return null;
  }

  if ('error' in result) {
    const error = (result as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    }
  }

  if ('message' in result) {
    const message = (result as { message?: unknown }).message;
    if (
      typeof message === 'string' &&
      /declined|denied|failed|error|cancel/i.test(message)
    ) {
      return message.trim();
    }
  }

  return null;
};

const performQortalRequest = async (
  payload: Record<string, unknown>,
  fallbackMessage: string
) => {
  const result = await qortalRequest(payload as never);
  const error = extractRequestError(result);
  if (error) {
    throw new Error(error);
  }

  if (result === false) {
    throw new Error(fallbackMessage);
  }

  return result;
};

const deleteQdnResource = async (name: string, identifier: string) => {
  await performQortalRequest(
    {
      action: 'DELETE_QDN_RESOURCE',
      name,
      service: 'DOCUMENT',
      identifier,
    },
    'Failed to delete QDN resource.'
  );
};

const getLikePrefix = (entityType: 'song' | 'playlist') =>
  entityType === 'song' ? SONG_LIKE_PREFIX : PLAYLIST_LIKE_PREFIX;

const getCommentPrefix = (entityType: 'song' | 'playlist') =>
  entityType === 'song' ? SONG_COMMENT_PREFIX : PLAYLIST_COMMENT_PREFIX;

const getModerationPrefix = (entityType: 'song' | 'playlist') =>
  entityType === 'song' ? SONG_MODERATION_PREFIX : PLAYLIST_MODERATION_PREFIX;

export const buildLikeIdentifier = (
  entityType: 'song' | 'playlist',
  entityId: string
) => `${getLikePrefix(entityType)}${buildEntityKey(entityId)}`;

const buildModerationIdentifier = (
  entityType: 'song' | 'playlist',
  entityId: string
) => `${getModerationPrefix(entityType)}${buildEntityKey(entityId)}`;

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
  const result = await fetchQdnResource<Record<string, unknown>>({
    name: username,
    service: 'DOCUMENT',
    identifier: buildLikeIdentifier(entityType, entityId),
  });

  return Boolean(result);
};

export const likeEntity = async (params: {
  entityType: 'song' | 'playlist';
  username: string;
  entityId: string;
  entityPublisher: string;
  title: string;
}) => {
  const identifier = buildLikeIdentifier(params.entityType, params.entityId);
  const data64 = await objectToBase64({
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
};

export const unlikeEntity = async (
  entityType: 'song' | 'playlist',
  username: string,
  entityId: string
) => {
  await deleteQdnResource(username, buildLikeIdentifier(entityType, entityId));
};

export const fetchComments = async (
  entityType: 'song' | 'playlist',
  entityPublisher: string,
  entityId: string
): Promise<MediaComment[]> => {
  const prefix = getCommentPrefix(entityType);
  let offset = 0;
  const comments: MediaComment[] = [];

  while (true) {
    const page = await searchQdnResources({
      mode: 'ALL',
      service: 'DOCUMENT',
      query: prefix,
      limit: FETCH_LIMIT,
      offset,
      reverse: true,
      includeMetadata: true,
      includeStatus: false,
      excludeBlocked: true,
    });

    if (!page.length) break;

    const resolved = await Promise.all(
      page.map(async (entry) => {
        const identifier =
          typeof entry.identifier === 'string' ? entry.identifier : '';
        if (!identifier) return null;

        const payload = await fetchQdnResource<Partial<MediaComment>>({
          name: entry.name || '',
          service: 'DOCUMENT',
          identifier,
        });

        if (!payload?.entityId || payload.entityId !== entityId) return null;
        if (payload.entityType !== entityType) return null;

        const comment: MediaComment = {
          id: identifier,
          entityType,
          entityId,
          entityPublisher,
          author: payload.author || entry.name || 'unknown',
          message: payload.message || '',
          parentId:
            typeof payload.parentId === 'string' ? payload.parentId : undefined,
          created:
            typeof payload.created === 'number'
              ? payload.created
              : typeof entry.created === 'number'
                ? entry.created
                : Date.now(),
          updated:
            typeof payload.updated === 'number' ? payload.updated : undefined,
        };

        return comment;
      })
    );

    comments.push(
      ...resolved.filter((comment): comment is MediaComment => Boolean(comment))
    );

    if (page.length < FETCH_LIMIT) break;
    offset += page.length;
  }

  return comments.sort(
    (left, right) => (right.created || 0) - (left.created || 0)
  );
};

export const publishComment = async (params: {
  entityType: 'song' | 'playlist';
  entityId: string;
  entityPublisher: string;
  author: string;
  message: string;
  title: string;
  parentId?: string;
}) => {
  const identifier = `${getCommentPrefix(params.entityType)}${buildEntityKey(params.entityId)}_${buildShortId()}`;
  const timestamp = Date.now();
  const payload: MediaComment = {
    id: identifier,
    entityType: params.entityType,
    entityId: params.entityId,
    entityPublisher: params.entityPublisher,
    author: params.author,
    message: params.message,
    parentId: params.parentId,
    created: timestamp,
    updated: timestamp,
  };

  await performQortalRequest(
    {
      action: 'PUBLISH_QDN_RESOURCE',
      name: params.author,
      service: 'DOCUMENT',
      identifier,
      data64: await objectToBase64(payload),
      encoding: 'base64',
      title: `Comment on ${params.title}`.slice(0, 55),
      description: params.message.slice(0, 4000),
    },
    'Failed to publish comment.'
  );

  return payload;
};

export const deleteComment = async (author: string, identifier: string) => {
  await deleteQdnResource(author, identifier);
};

export const updateComment = async (params: {
  entityType: 'song' | 'playlist';
  entityId: string;
  entityPublisher: string;
  author: string;
  identifier: string;
  message: string;
  title: string;
  parentId?: string;
  created: number;
}) => {
  const payload: MediaComment = {
    id: params.identifier,
    entityType: params.entityType,
    entityId: params.entityId,
    entityPublisher: params.entityPublisher,
    author: params.author,
    message: params.message,
    parentId: params.parentId,
    created: params.created,
    updated: Date.now(),
  };

  await performQortalRequest(
    {
      action: 'PUBLISH_QDN_RESOURCE',
      name: params.author,
      service: 'DOCUMENT',
      identifier: params.identifier,
      data64: await objectToBase64(payload),
      encoding: 'base64',
      title: `Comment on ${params.title}`.slice(0, 55),
      description: params.message.slice(0, 4000),
    },
    'Failed to update comment.'
  );

  return payload;
};

export const fetchModerationState = async (
  entityType: 'song' | 'playlist',
  entityPublisher: string,
  entityId: string
): Promise<MediaModerationState> => {
  const result = await fetchQdnResource<Partial<MediaModerationState>>({
    name: entityPublisher,
    service: 'DOCUMENT',
    identifier: buildModerationIdentifier(entityType, entityId),
  });

  return {
    entityType,
    entityId,
    entityPublisher,
    hiddenCommentIds: Array.isArray(result?.hiddenCommentIds)
      ? result.hiddenCommentIds.filter(
          (commentId): commentId is string => typeof commentId === 'string'
        )
      : [],
    updated: typeof result?.updated === 'number' ? result.updated : 0,
  };
};

export const saveModerationState = async (params: {
  entityType: 'song' | 'playlist';
  entityId: string;
  entityPublisher: string;
  moderator: string;
  hiddenCommentIds: string[];
}) => {
  const payload: MediaModerationState = {
    entityType: params.entityType,
    entityId: params.entityId,
    entityPublisher: params.entityPublisher,
    hiddenCommentIds: params.hiddenCommentIds,
    updated: Date.now(),
  };

  await performQortalRequest(
    {
      action: 'PUBLISH_QDN_RESOURCE',
      name: params.moderator,
      service: 'DOCUMENT',
      identifier: buildModerationIdentifier(params.entityType, params.entityId),
      data64: await objectToBase64(payload),
      encoding: 'base64',
      title: `Moderation: ${params.entityId}`.slice(0, 55),
      description: `Hidden comments: ${params.hiddenCommentIds.length}`.slice(
        0,
        4000
      ),
    },
    'Failed to save moderation state.'
  );

  return payload;
};
