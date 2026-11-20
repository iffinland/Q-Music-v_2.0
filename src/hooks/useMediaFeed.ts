import { useEffect, useRef, useState } from 'react';
import type { MediaPage, MediaPageOptions } from '../services/mediaPages';
import { isAbortError, requestError } from '../services/qdnRequests';
import { mergeMedia } from '../utils/mediaIdentity';
import { subscribeToMediaRefresh } from '../utils/mediaEvents';

export const useMediaFeed = <T extends { id: string }>(
  loadPage: (options: MediaPageOptions) => Promise<MediaPage<T>>,
  limit: number,
  publisher?: string
) => {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const cursor = useRef({
    items: [] as T[],
    offset: 0,
    hasMore: true,
    before: Date.now() + 1,
    refreshTick: 0,
    publisher,
  });

  useEffect(() => {
    if (
      cursor.current.refreshTick !== refreshTick ||
      cursor.current.publisher !== publisher
    ) {
      cursor.current = {
        items: [],
        offset: 0,
        hasMore: true,
        before: Date.now() + 1,
        refreshTick,
        publisher,
      };
      setItems([]);
    }
    if (publisher === '') {
      setItems([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        while (cursor.current.items.length < limit && cursor.current.hasMore) {
          const page = await loadPage({
            limit: Math.min(100, limit - cursor.current.items.length),
            offset: cursor.current.offset,
            before: cursor.current.before,
            publisher,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          cursor.current.items = mergeMedia(cursor.current.items, page.items);
          cursor.current.offset = page.nextOffset;
          cursor.current.hasMore = page.hasMore;
          setItems([...cursor.current.items]);
        }
        if (!controller.signal.aborted) setHasMore(cursor.current.hasMore);
      } catch (failure) {
        if (!controller.signal.aborted && !isAbortError(failure))
          setError(
            requestError(failure, 'Music could not be loaded. Please retry.')
          );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [limit, loadPage, publisher, refreshTick, retryTick]);

  useEffect(
    () => subscribeToMediaRefresh(() => setRefreshTick((value) => value + 1)),
    []
  );
  return {
    items,
    isLoading,
    error,
    hasMore,
    retry: () => setRetryTick((value) => value + 1),
    refresh: () => setRefreshTick((value) => value + 1),
  };
};
