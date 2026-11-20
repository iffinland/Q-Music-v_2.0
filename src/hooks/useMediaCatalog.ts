import { useEffect, useState } from 'react';
import { isAbortError, requestError } from '../services/qdnRequests';
import type { MediaPageOptions } from '../services/mediaPages';
import { subscribeToMediaRefresh } from '../utils/mediaEvents';

type CatalogLoader<T> = (
  options: MediaPageOptions & { onPage?: (items: T[]) => void }
) => Promise<T[]>;
export const useMediaCatalog = <T>(
  loader: CatalogLoader<T>,
  enabled: boolean
) => {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(
    () => subscribeToMediaRefresh(() => setRevision((value) => value + 1)),
    []
  );
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    setItems([]);
    setComplete(false);
    setIsLoading(true);
    setError(null);
    void loader({
      signal: controller.signal,
      priority: 'background',
      onPage: (page) => {
        if (!controller.signal.aborted) setItems(page);
      },
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result);
          setComplete(true);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted && !isAbortError(failure))
          setError(
            requestError(failure, 'Search is incomplete. Please retry.')
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [enabled, loader, revision]);
  return {
    items,
    isLoading,
    complete,
    error,
    retry: () => setRevision((value) => value + 1),
  };
};
