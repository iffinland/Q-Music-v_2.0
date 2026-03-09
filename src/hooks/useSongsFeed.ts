import { useEffect, useRef, useState } from 'react';
import { fetchSongs } from '../services/songs';
import type { SongSummary } from '../types/media';
import { subscribeToMediaRefresh } from '../utils/mediaEvents';

const mergeSongs = (current: SongSummary[], incoming: SongSummary[]) => {
  const seen = new Set(current.map((item) => item.id));
  const next = [...current];

  incoming.forEach((song) => {
    if (seen.has(song.id)) {
      return;
    }
    seen.add(song.id);
    next.push(song);
  });

  return next;
};

export const useSongsFeed = (limit = 24) => {
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const songsRef = useRef<SongSummary[]>([]);
  const refreshRef = useRef(refreshTick);

  useEffect(() => {
    let cancelled = false;
    const shouldReset =
      refreshRef.current !== refreshTick || limit < songsRef.current.length;
    const offset = shouldReset ? 0 : songsRef.current.length;
    const nextLimit = shouldReset ? limit : limit - songsRef.current.length;

    if (nextLimit <= 0) {
      setIsLoading(false);
      refreshRef.current = refreshTick;
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchSongs({
          limit: nextLimit,
          offset,
        });
        if (!cancelled) {
          const nextSongs = shouldReset
            ? result
            : mergeSongs(songsRef.current, result);
          songsRef.current = nextSongs;
          setSongs(nextSongs);
          refreshRef.current = refreshTick;
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
