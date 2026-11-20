import type { QdnSearchResource } from '../types/media';
import type { MediaComment } from '../types/engagement';
import type { ReadOptions } from './qdnRequests';
import {
  commentPrefix,
  legacyCommentPrefix,
  sameTarget,
  socialId,
  prepareSocial,
  sendSocial,
  type Actor,
  type Target,
} from './engagement/shared';
import {
  mapSocial,
  readSocial,
  searchSocial,
  socialMetadata,
  socialReadBudget,
} from './engagement/read';
export interface CommentCursor {
  before: number;
  modern: number;
  legacy: number;
  modernDone: boolean;
  legacyDone: boolean;
  retry: QdnSearchResource[];
}
export const initialCommentCursor = (): CommentCursor => ({
  before: Date.now() + 1,
  modern: 0,
  legacy: 0,
  modernDone: false,
  legacyDone: false,
  retry: [],
});
export const commentFromPayload = (
  name: string,
  identifier: string,
  payload: Record<string, unknown>,
  target: Target
): MediaComment | null => {
  if (
    !sameTarget(payload as Partial<Target>, target) ||
    (payload.author &&
      String(payload.author).toLowerCase() !== name.toLowerCase()) ||
    typeof payload.message !== 'string' ||
    typeof payload.created !== 'number' ||
    !Number.isFinite(payload.created) ||
    payload.created < 0 ||
    payload.created > 8.64e15 ||
    payload.message.length > 8192
  )
    return null;
  return {
    id: socialId(name, identifier),
    resourceId: identifier,
    ...target,
    author: name,
    message: payload.message,
    created: payload.created,
    updated: typeof payload.updated === 'number' ? payload.updated : undefined,
    parentId:
      typeof payload.parentId === 'string' ? payload.parentId : undefined,
    deleted: payload.deleted === true,
    revision:
      typeof payload.revision === 'string' ? payload.revision : undefined,
  };
};
const readCommentsPage = async (
  target: Target,
  actor: Actor,
  cursor = initialCommentCursor(),
  options: ReadOptions = {}
) => {
  const confirmed: { identifier: string; revision: string }[] = [];
  const next: CommentCursor = { ...cursor, retry: cursor.retry.slice(10) },
    resources = cursor.retry.slice(0, 10);
  const prefixes = [commentPrefix(target), legacyCommentPrefix(target)];
  for (const [index, prefix] of prefixes.entries()) {
    const offsetKey = index ? 'legacy' : 'modern',
      doneKey = index ? 'legacyDone' : 'modernDone';
    if (cursor[doneKey]) continue;
    const page = await searchSocial(
      prefix,
      10,
      cursor[offsetKey],
      options,
      undefined,
      cursor.before
    );
    next[offsetKey] += page.length;
    next[doneKey] = page.length < 10;
    resources.push(
      ...page.filter(
        (entry) => entry.name && entry.identifier?.startsWith(prefix)
      )
    );
  }
  const unique = [
    ...new Map(
      resources
        .filter((entry) => entry.name && entry.identifier)
        .map((entry) => [socialId(entry.name!, entry.identifier!), entry])
    ).values(),
  ];
  const resolved = await mapSocial(unique, async (entry) => {
    try {
      const data = await readSocial(entry, options);
      if (!data) {
        next.retry.push(entry);
        return null;
      }
      const indexed = socialMetadata(entry, 'comment');
      if (
        indexed &&
        (data.revision !== indexed.revision ||
          indexed.active === (data.deleted === true))
      ) {
        next.retry.push(entry);
        return null;
      }
      const comment = commentFromPayload(
        entry.name!,
        entry.identifier!,
        data,
        target
      );
      if (
        comment?.revision &&
        comment.author.toLowerCase() === actor.name.toLowerCase()
      )
        confirmed.push({
          identifier: comment.resourceId!,
          revision: comment.revision,
        });
      return comment;
    } catch {
      next.retry.push(entry);
      return null;
    }
  });
  return {
    comments: resolved.filter((comment): comment is MediaComment =>
      Boolean(comment)
    ),
    cursor: next,
    confirmed,
    hasMore: !next.modernDone || !next.legacyDone || next.retry.length > 0,
    warning: next.retry.length
      ? 'Some comments are unavailable on this node. Loaded comments are kept; refresh or load more to retry.'
      : '',
  };
};
export const fetchComments = (
  target: Target,
  actor: Actor,
  cursor = initialCommentCursor(),
  options: ReadOptions = {}
) =>
  socialReadBudget(options, (bounded) =>
    readCommentsPage(target, actor, cursor, bounded)
  );
export const publishComment = (
  target: Target,
  actor: Actor,
  message: string,
  parentId: string | undefined,
  isCurrent: () => boolean
) =>
  sendSocial(
    prepareSocial('comment', actor, target, {
      message: message.trim(),
      parentId,
    }),
    isCurrent
  );
export const changeComment = (
  target: Target,
  actor: Actor,
  comment: MediaComment,
  message: string,
  deleted: boolean,
  isCurrent: () => boolean
) => {
  if (
    !sameTarget(comment, target) ||
    comment.author.toLowerCase() !== actor.name.toLowerCase() ||
    !comment.resourceId
  )
    throw new Error(
      'Only the author can change this comment on its original page.'
    );
  return sendSocial(
    prepareSocial('comment', actor, target, {
      identifier: comment.resourceId,
      message: message.trim(),
      deleted,
      parentId: comment.parentId,
      created: comment.created,
    }),
    isCurrent
  );
};
