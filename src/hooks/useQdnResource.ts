import { useEffect, useState } from 'react';
import {
  getQdnResourceUrl,
  isQdnResourceReady,
  type QdnResourceStatus,
  waitForQdnResourceReady,
} from '../services/qdn';

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
  timeoutMs,
}: UseQdnResourceParams) => {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<QdnResourceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!enabled || !name || !identifier) {
        setUrl(null);
        setStatus(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setUrl(null);

      try {
        const readyStatus = await waitForQdnResourceReady({
          service,
          name,
          identifier,
          timeoutMs,
          onStatusChange: (nextStatus) => {
            if (!cancelled) {
              setStatus(nextStatus);
            }
          },
        });

        if (cancelled) return;

        if (!isQdnResourceReady(readyStatus.status)) {
          setError(`Resource is not ready (${readyStatus.status}).`);
          setIsLoading(false);
          return;
        }

        const nextUrl = await getQdnResourceUrl(service, name, identifier);
        if (cancelled) return;

        if (!nextUrl) {
          setError('Resource URL could not be resolved.');
          setIsLoading(false);
          return;
        }

        setUrl(nextUrl);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'QDN resource loading failed.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, identifier, name, service, timeoutMs]);

  return {
    url,
    status,
    isLoading,
    error,
    progress: status?.percentLoaded,
    isReady: isQdnResourceReady(status?.status),
  };
};
