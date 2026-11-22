import { useEffect, useRef, useState } from 'react';
import { fetchPlaylistDetail } from '../services/playlists';
import { isAbortError, requestError } from '../services/qdnRequests';
import type { PlaylistSummary } from '../types/media';
import { useMiniPlayer } from './useMiniPlayer';

// Only a deliberate Play click reads the playlist payload; cards never preload tracks.
export const usePlaylistPlayback = () => {
  const { playQueue, currentTrack } = useMiniPlayer();
  const pending = useRef<AbortController | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Another selected song wins over a still-loading playlist.
    pending.current?.abort();
    pending.current = null;
    setLoadingId(null);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [currentTrack?.key]);
  const play = async (item: PlaylistSummary) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoadingId(item.id);
    setError(null);
    const deadline = setTimeout(() => controller.abort(), 60_000);
    try {
      const detail = await fetchPlaylistDetail(
        item.publisher,
        item.identifier,
        { signal: controller.signal, priority: 'playback' }
      );
      if (controller.signal.aborted) return;
      if (!detail?.songs.length)
        throw new Error(
          'This playlist has no available tracks. Open its details or try another playlist.'
        );
      playQueue(
        detail.songs.map((song, index) => ({
          key: `${song.publisher}:${song.identifier}:${index}`,
          id: song.identifier,
          identifier: song.identifier,
          publisher: song.publisher,
          service: 'AUDIO',
          title: song.title || song.identifier,
          artist: song.artist || song.publisher,
          context: detail.title,
        }))
      );
    } catch (failure) {
      if (pending.current === controller)
        setError(
          isAbortError(failure)
            ? 'Playlist loading took too long. Please try again.'
            : requestError(
                failure,
                'Playlist could not be loaded. Please try again.'
              )
        );
    } finally {
      clearTimeout(deadline);
      if (pending.current === controller) {
        pending.current = null;
        setLoadingId(null);
      }
    }
  };
  return { play, loadingId, error };
};
