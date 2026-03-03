import { useEffect, useState } from 'react';
import {
  fetchPlaylistDetail,
  resolvePlaylistArtwork,
} from '../services/playlists';
import type { PlaylistDetail } from '../types/media';

export const usePlaylistDetail = (publisher?: string, identifier?: string) => {
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!publisher || !identifier) {
        setPlaylist(null);
        setArtworkUrl(null);
        setError('Playlist identifier is missing.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchPlaylistDetail(publisher, identifier);
        if (cancelled) return;

        if (!result) {
          setPlaylist(null);
          setArtworkUrl(null);
          setError('Playlist was not found.');
          return;
        }

        setPlaylist(result);
        try {
          const artwork = await resolvePlaylistArtwork(publisher, identifier);
          if (!cancelled) {
            setArtworkUrl(artwork);
          }
        } catch {
          if (!cancelled) {
            setArtworkUrl(null);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
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
    };
  }, [identifier, publisher]);

  return { playlist, artworkUrl, isLoading, error };
};
