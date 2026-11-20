import { useEffect, useState } from 'react';
import { getQdnResourceUrl, type QdnResourceStatus } from '../services/qdn';
import { requestError } from '../services/qdnRequests';

interface UseQdnResourceParams {
  service: string;
  name?: string;
  identifier?: string;
  enabled?: boolean;
  timeoutMs?: number;
}

export const useQdnResource = ({
  service,
  name,
  identifier,
  enabled = true,
  timeoutMs = 30_000,
}: UseQdnResourceParams) => {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<QdnResourceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setUrl(null);
    setError(null);
    setStatus(null);
    if (!enabled || !name || !identifier) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const timer = setTimeout(() => {
      controller.abort();
      if (active) {
        setIsLoading(false);
        setError('Artwork is taking too long to load.');
      }
    }, timeoutMs);
    // The image request starts the resource download. Do not occupy bridge
    // slots with a polling/build loop for every visible piece of artwork.
    void getQdnResourceUrl(service, name, identifier, {
      signal: controller.signal,
      priority: 'background',
    })
      .then((nextUrl) => {
        if (!controller.signal.aborted) {
          setUrl(nextUrl);
          setStatus({ status: 'LOADING' });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(requestError(failure, 'Artwork is unavailable.'));
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, identifier, name, service, timeoutMs]);
  return {
    url,
    status,
    isLoading,
    error,
    progress: status?.percentLoaded,
    isReady: status?.status === 'READY',
    onLoad: () => setStatus({ status: 'READY' }),
    onError: () => {
      setUrl(null);
      setStatus({ status: 'UNAVAILABLE' });
      setError('Artwork is unavailable.');
    },
  };
};
