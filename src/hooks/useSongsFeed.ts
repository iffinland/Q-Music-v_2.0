import { useEffect, useState } from 'react';
import { fetchSongs } from '../services/songs';
import type { SongSummary } from '../types/media';
import { subscribeToMediaRefresh } from '../utils/mediaEvents';

export const useSongsFeed = (limit = 24) => {
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchSongs({ limit });
        if (!cancelled) {
          setSongs(result);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load songs from QDN.');
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

  return { songs, isLoading, error };
};
