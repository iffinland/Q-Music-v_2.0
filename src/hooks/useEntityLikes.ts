import { useCallback, useEffect, useState } from 'react';
import { useGlobal } from 'qapp-core';
import {
  fetchLikeCount,
  hasUserLiked,
  likeEntity,
  unlikeEntity,
} from '../services/entityLikes';

export const useEntityLikes = (params: {
  entityType: 'song' | 'playlist';
  entityId?: string;
  entityPublisher?: string;
  title?: string;
  enabled?: boolean;
}) => {
  const { auth } = useGlobal();
  const [likeCount, setLikeCount] = useState(0);
  const [hasLike, setHasLike] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);

  const refreshLikes = useCallback(async () => {
    if (!params.enabled || !params.entityId) {
      setLikeCount(0);
      setHasLike(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const count = await fetchLikeCount(params.entityType, params.entityId);
      setLikeCount(count);
    } catch {
      setLikeCount(0);
      setError('Failed to load likes.');
    }

    if (!auth?.name) {
      setHasLike(false);
      setIsLoading(false);
      return;
    }

    try {
      const liked = await hasUserLiked(params.entityType, auth.name, params.entityId);
      setHasLike(liked);
    } catch {
      setHasLike(false);
      setError((current) => current ?? 'Failed to load likes.');
    } finally {
      setIsLoading(false);
    }
  }, [auth?.name, params.enabled, params.entityId, params.entityType]);

  useEffect(() => {
    if (!params.enabled) {
      setLikeCount(0);
      setHasLike(false);
      setIsLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshLikes();
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [params.enabled, refreshLikes]);

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

      await refreshLikes();
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
    refreshLikes,
  ]);

  return {
    likeCount,
    hasLike,
    isLoading,
    error,
    isUpdatingLike,
    toggleLike,
    refreshLikes,
  };
};
