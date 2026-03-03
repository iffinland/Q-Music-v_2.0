import { useEffect, useState } from 'react';
import { fetchPlaylists } from '../services/playlists';
import type { PlaylistSummary } from '../types/media';
import { subscribeToMediaRefresh } from '../utils/mediaEvents';

export const usePlaylistsFeed = (limit = 24) => {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchPlaylists({ limit });
        if (!cancelled) {
          setPlaylists(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load playlists from QDN.'
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
  }, [limit, refreshTick]);

  useEffect(() => {
    return subscribeToMediaRefresh(() => {
      setRefreshTick((current) => current + 1);
    });
  }, []);

  return { playlists, isLoading, error };
};
