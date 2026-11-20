import { loadSongDocument } from '../services/songDescriptors';
import { useEffect, useState } from 'react';
import { isAbortError } from '../services/qdnRequests';
import { fetchSongByIdentifier } from '../services/songs';
import type { SongSummary } from '../types/media';

export const useSongDetail = (publisher?: string, identifier?: string) => {
  const [song, setSong] = useState<SongSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      if (!publisher || !identifier) {
        setSong(null);
        setIsLoading(false);
        setError('Song identifier is missing.');
        return;
      }

      setSong(null);
      setMetadataError(null);
      setIsMetadataLoading(false);
      setIsLoading(true);
      setError(null);

      try {
        const resolvedSong = await fetchSongByIdentifier(
          publisher,
          identifier,
          { signal: controller.signal, fresh: true }
        );

        if (cancelled) return;

        if (!resolvedSong) {
          setSong(null);
          setError('Song was not found.');
          return;
        }

        setSong(resolvedSong);
        setIsLoading(false);
        if (resolvedSong.metadataRevision) {
          setIsMetadataLoading(true);
          try {
            const fullSong = await loadSongDocument(resolvedSong, {
              signal: controller.signal,
              fresh: true,
              priority: 'background',
            });
            if (!cancelled) setSong(fullSong);
          } catch (failure) {
            if (!cancelled && !isAbortError(failure))
              setMetadataError(
                failure instanceof Error
                  ? failure.message
                  : 'Full song details could not be loaded.'
              );
          } finally {
            if (!cancelled) setIsMetadataLoading(false);
          }
        }
      } catch (loadError) {
        if (!cancelled && !isAbortError(loadError)) {
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
      controller.abort();
    };
  }, [identifier, publisher, attempt]);

  return {
    song,
    isLoading,
    error,
    isMetadataLoading,
    metadataError,
    retry: () => setAttempt((value) => value + 1),
  };
};
