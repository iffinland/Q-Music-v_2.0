import { useCallback, useEffect, useState } from 'react';
import { useGlobal } from 'qapp-core';
import {
  deleteComment,
  fetchComments,
  fetchLikeCount,
  fetchModerationState,
  hasUserLiked,
  likeEntity,
  publishComment,
  saveModerationState,
  unlikeEntity,
  updateComment,
} from '../services/engagement';
import type { MediaComment } from '../types/engagement';

export const useEngagement = (params: {
  entityType: 'song' | 'playlist';
  entityId?: string;
  entityPublisher?: string;
  title?: string;
}) => {
  const { auth } = useGlobal();
  const [likeCount, setLikeCount] = useState(0);
  const [hasLike, setHasLike] = useState(false);
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [hiddenCommentIds, setHiddenCommentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const isModerator =
    Boolean(auth?.name) &&
    Boolean(params.entityPublisher) &&
    auth?.name?.toLowerCase() === params.entityPublisher?.toLowerCase();

  const refresh = useCallback(async () => {
    if (!params.entityId || !params.entityPublisher) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [count, loadedComments, liked, moderationState] = await Promise.all(
        [
          fetchLikeCount(params.entityType, params.entityId),
          fetchComments(
            params.entityType,
            params.entityPublisher,
            params.entityId
          ),
          auth?.name
            ? hasUserLiked(params.entityType, auth.name, params.entityId)
            : Promise.resolve(false),
          fetchModerationState(
            params.entityType,
            params.entityPublisher,
            params.entityId
          ),
        ]
      );

      setLikeCount(count);
      setComments(loadedComments);
      setHasLike(liked);
      setHiddenCommentIds(moderationState.hiddenCommentIds);
    } catch {
      setError('Failed to load comments, likes and moderation state.');
    } finally {
      setIsLoading(false);
    }
  }, [auth?.name, params.entityId, params.entityPublisher, params.entityType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleLike = useCallback(async () => {
    if (
      !auth?.name ||
      !params.entityId ||
      !params.entityPublisher ||
      !params.title
    ) {
      setError('Log in to use likes.');
      return;
    }

    setIsUpdatingLike(true);
    setError(null);
    try {
      if (hasLike) {
        await unlikeEntity(params.entityType, auth.name, params.entityId);
        setHasLike(false);
        setLikeCount((value) => Math.max(0, value - 1));
      } else {
        await likeEntity({
          entityType: params.entityType,
          username: auth.name,
          entityId: params.entityId,
          entityPublisher: params.entityPublisher,
          title: params.title,
        });
        setHasLike(true);
        setLikeCount((value) => value + 1);
      }
    } catch (likeError) {
      setError(
        likeError instanceof Error
          ? likeError.message
          : 'Failed to update like status.'
      );
    } finally {
      setIsUpdatingLike(false);
    }
  }, [
    auth?.name,
    hasLike,
    params.entityId,
    params.entityPublisher,
    params.entityType,
    params.title,
  ]);

  const addComment = useCallback(
    async (message: string, parentId?: string) => {
      const normalizedMessage = message.trim();
      if (
        !auth?.name ||
        !params.entityId ||
        !params.entityPublisher ||
        !params.title
      ) {
        setError('Log in to comment.');
        return false;
      }

      if (!normalizedMessage) {
        setError('Comment cannot be empty.');
        return false;
      }

      setIsSubmittingComment(true);
      setError(null);
      try {
        await publishComment({
          entityType: params.entityType,
          entityId: params.entityId,
          entityPublisher: params.entityPublisher,
          author: auth.name,
          message: normalizedMessage,
          title: params.title,
          parentId,
        });
        await refresh();
        return true;
      } catch (commentError) {
        setError(
          commentError instanceof Error
            ? commentError.message
            : 'Failed to publish comment.'
        );
        return false;
      } finally {
        setIsSubmittingComment(false);
      }
    },
    [
      auth?.name,
      params.entityId,
      params.entityPublisher,
      params.entityType,
      params.title,
      refresh,
    ]
  );

  const removeComment = useCallback(
    async (comment: MediaComment) => {
      if (!auth?.name || auth.name !== comment.author) {
        setError('Only the comment author can delete it.');
        return false;
      }

      try {
        await deleteComment(comment.author, comment.id);
        await refresh();
        return true;
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : 'Failed to delete comment.'
        );
        return false;
      }
    },
    [auth?.name, refresh]
  );

  const editComment = useCallback(
    async (comment: MediaComment, message: string) => {
      const normalizedMessage = message.trim();
      if (
        !auth?.name ||
        auth.name !== comment.author ||
        !params.entityId ||
        !params.entityPublisher ||
        !params.title
      ) {
        setError('Only the comment author can edit it.');
        return false;
      }

      if (!normalizedMessage) {
        setError('Comment cannot be empty.');
        return false;
      }

      setIsEditingComment(true);
      setError(null);
      try {
        await updateComment({
          entityType: params.entityType,
          entityId: params.entityId,
          entityPublisher: params.entityPublisher,
          author: auth.name,
          identifier: comment.id,
          message: normalizedMessage,
          title: params.title,
          parentId: comment.parentId,
          created: comment.created,
        });
        await refresh();
        return true;
      } catch (updateError) {
        setError(
          updateError instanceof Error
            ? updateError.message
            : 'Failed to update comment.'
        );
        return false;
      } finally {
        setIsEditingComment(false);
      }
    },
    [
      auth?.name,
      params.entityId,
      params.entityPublisher,
      params.entityType,
      params.title,
      refresh,
    ]
  );

  const toggleCommentVisibility = useCallback(
    async (commentId: string) => {
      if (
        !auth?.name ||
        !params.entityId ||
        !params.entityPublisher ||
        !isModerator
      ) {
        setError('Only the owner can moderate comments.');
        return false;
      }

      setIsModerating(true);
      setError(null);
      try {
        const nextHidden = hiddenCommentIds.includes(commentId)
          ? hiddenCommentIds.filter((entry) => entry !== commentId)
          : [...hiddenCommentIds, commentId];

        await saveModerationState({
          entityType: params.entityType,
          entityId: params.entityId,
          entityPublisher: params.entityPublisher,
          moderator: auth.name,
          hiddenCommentIds: nextHidden,
        });
        setHiddenCommentIds(nextHidden);
        return true;
      } catch (moderationError) {
        setError(
          moderationError instanceof Error
            ? moderationError.message
            : 'Failed to update moderation.'
        );
        return false;
      } finally {
        setIsModerating(false);
      }
    },
    [
      auth?.name,
      hiddenCommentIds,
      isModerator,
      params.entityId,
      params.entityPublisher,
      params.entityType,
    ]
  );

  return {
    likeCount,
    hasLike,
    comments,
    hiddenCommentIds,
    isModerator,
    isLoading,
    error,
    isUpdatingLike,
    isSubmittingComment,
    isEditingComment,
    isModerating,
    toggleLike,
    addComment,
    removeComment,
    editComment,
    toggleCommentVisibility,
    refresh,
  };
};
