import { fetchQdnResource, searchQdnResources } from './qdn';
import type { MediaComment } from '../types/engagement';
import {
  FETCH_LIMIT,
  buildEntityKey,
  buildShortId,
  deleteQdnResource,
  encodeObject,
  performQortalRequest,
} from './entityEngagementShared';

const SONG_COMMENT_PREFIX = 'enjoymusic_song_comment_';
const PLAYLIST_COMMENT_PREFIX = 'enjoymusic_playlist_comment_';

const getCommentPrefix = (entityType: 'song' | 'playlist') =>
  entityType === 'song' ? SONG_COMMENT_PREFIX : PLAYLIST_COMMENT_PREFIX;

export const fetchComments = async (
  entityType: 'song' | 'playlist',
  entityPublisher: string,
  entityId: string,
  options?: { limit?: number }
): Promise<MediaComment[]> => {
  const prefix = getCommentPrefix(entityType);
  const maxComments = options?.limit ?? 25;
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
        try {
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
        } catch {
          return null;
        }
      })
    );

    comments.push(
      ...resolved.filter((comment): comment is MediaComment => Boolean(comment))
    );

    if (comments.length >= maxComments) {
      break;
    }

    if (page.length < FETCH_LIMIT) break;
    offset += page.length;
  }

  return comments
    .sort((left, right) => (right.created || 0) - (left.created || 0))
    .slice(0, maxComments);
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
      data64: await encodeObject(payload),
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
      data64: await encodeObject(payload),
      encoding: 'base64',
      title: `Comment on ${params.title}`.slice(0, 55),
      description: params.message.slice(0, 4000),
    },
    'Failed to update comment.'
  );

  return payload;
};
