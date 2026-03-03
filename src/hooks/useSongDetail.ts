import { useEffect, useState } from 'react';
import { fetchSongByIdentifier, resolveSongArtwork } from '../services/songs';
import type { SongSummary } from '../types/media';

export const useSongDetail = (publisher?: string, identifier?: string) => {
  const [song, setSong] = useState<SongSummary | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!publisher || !identifier) {
        setSong(null);
        setArtworkUrl(null);
        setIsLoading(false);
        setError('Song identifier is missing.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const resolvedSong = await fetchSongByIdentifier(publisher, identifier);

        if (cancelled) return;

        if (!resolvedSong) {
          setSong(null);
          setArtworkUrl(null);
          setError('Song was not found.');
          return;
        }

        setSong(resolvedSong);
        try {
          const resolvedArtwork = await resolveSongArtwork(
            publisher,
            identifier
          );
          if (!cancelled) {
            setArtworkUrl(resolvedArtwork);
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
              : 'Failed to load song details.'
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

  return { song, artworkUrl, isLoading, error };
};
