import { useEffect, useState } from 'react';
import { isAbortError } from '../services/qdnRequests';
import { fetchPlaylistDetail } from '../services/playlists';
import type { PlaylistDetail } from '../types/media';

export const usePlaylistDetail = (publisher?: string, identifier?: string) => {
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      if (!publisher || !identifier) {
        setPlaylist(null);
        setError('Playlist identifier is missing.');
        setIsLoading(false);
        return;
      }

      setPlaylist(null);
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchPlaylistDetail(publisher, identifier, {
          signal: controller.signal,
          fresh: true,
        });
        if (cancelled) return;

        if (!result) {
          setPlaylist(null);
          setError('Playlist was not found.');
          return;
        }

        setPlaylist(result);
      } catch (loadError) {
        if (!cancelled && !isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load playlist details.'
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
      controller.abort();
    };
  }, [identifier, publisher, attempt]);

  return {
    playlist,
    isLoading,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
};
