import { useEffect, useRef, useState } from 'react';
import { fetchPlaylists } from '../services/playlists';
import type { PlaylistSummary } from '../types/media';
import { subscribeToMediaRefresh } from '../utils/mediaEvents';

const mergePlaylists = (
  current: PlaylistSummary[],
  incoming: PlaylistSummary[]
) => {
  const seen = new Set(current.map((item) => item.id));
  const next = [...current];

  incoming.forEach((playlist) => {
    if (seen.has(playlist.id)) {
      return;
    }
    seen.add(playlist.id);
    next.push(playlist);
  });

  return next;
};

export const usePlaylistsFeed = (limit = 24) => {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const playlistsRef = useRef<PlaylistSummary[]>([]);
  const refreshRef = useRef(refreshTick);

  useEffect(() => {
    let cancelled = false;
    const shouldReset =
      refreshRef.current !== refreshTick || limit < playlistsRef.current.length;
    const offset = shouldReset ? 0 : playlistsRef.current.length;
    const nextLimit = shouldReset ? limit : limit - playlistsRef.current.length;

    if (nextLimit <= 0) {
      setIsLoading(false);
      refreshRef.current = refreshTick;
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchPlaylists({
          limit: nextLimit,
          offset,
        });
        if (!cancelled) {
          const nextPlaylists = shouldReset
            ? result
            : mergePlaylists(playlistsRef.current, result);
          playlistsRef.current = nextPlaylists;
          setPlaylists(nextPlaylists);
          refreshRef.current = refreshTick;
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
