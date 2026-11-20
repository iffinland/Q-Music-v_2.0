import { useEffect, useState } from 'react';
import type { PlaylistSummary } from '../types/media';
import { resolvePlaylistSongCount } from '../services/playlists';

export const usePlaylistCounts = (
  playlists: PlaylistSummary[],
  enabled: boolean
) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    let index = 0;
    setIsLoading(true);
    const worker = async () => {
      while (!controller.signal.aborted && index < playlists.length) {
        const playlist = playlists[index++];
        try {
          const count = await resolvePlaylistSongCount(
            playlist.publisher,
            playlist.identifier,
            { signal: controller.signal, priority: 'background' }
          );
          if (!controller.signal.aborted)
            setCounts((current) => ({ ...current, [playlist.id]: count }));
        } catch {
          /* An unavailable count must not hide a playable playlist. */
        }
      }
    };
    void Promise.all([worker(), worker()]).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [enabled, playlists]);
  return { counts, isLoading };
};
