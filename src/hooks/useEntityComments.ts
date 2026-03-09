import { useCallback, useEffect, useState } from 'react';
import { useGlobal } from 'qapp-core';
import {
  deleteComment,
  fetchComments,
  publishComment,
  updateComment,
} from '../services/entityComments';
import type { MediaComment } from '../types/engagement';

export const useEntityComments = (params: {
  entityType: 'song' | 'playlist';
  entityId?: string;
  entityPublisher?: string;
  title?: string;
  enabled?: boolean;
}) => {
  const COMMENT_PAGE_SIZE = 5;
  const { auth } = useGlobal();
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentLimit, setCommentLimit] = useState(COMMENT_PAGE_SIZE);

  const refreshComments = useCallback(async () => {
    if (!params.enabled || !params.entityId || !params.entityPublisher) {
      setComments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const loadedComments = await fetchComments(
        params.entityType,
        params.entityPublisher,
        params.entityId,
        { limit: commentLimit }
      );
      setComments(loadedComments);
    } catch {
      setComments([]);
      setError('Failed to load comments.');
    } finally {
      setIsLoading(false);
    }
  }, [
    commentLimit,
    params.enabled,
    params.entityId,
    params.entityPublisher,
    params.entityType,
  ]);

  useEffect(() => {
    if (!params.enabled) {
      setComments([]);
      setIsLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshComments();
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [params.enabled, refreshComments]);

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
        await refreshComments();
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
      refreshComments,
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
        await refreshComments();
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
    [auth?.name, refreshComments]
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
        await refreshComments();
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
      refreshComments,
    ]
  );

  return {
    comments,
    isLoading,
    error,
    isSubmittingComment,
    isEditingComment,
    addComment,
    removeComment,
    editComment,
    refreshComments,
    commentLimit,
    canLoadMoreComments: comments.length >= commentLimit,
    loadMoreComments: () =>
      setCommentLimit((current) => current + COMMENT_PAGE_SIZE),
  };
};
