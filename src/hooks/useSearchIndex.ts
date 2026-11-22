import { useEffect, useRef, useState } from 'react';
import { fetchSongsPage } from '../services/songs';
import { fetchPlaylistsPage } from '../services/playlists';
import type { MediaCursor } from '../services/mediaPages';
import { isAbortError, requestError } from '../services/qdnRequests';
import { mergeMedia } from '../utils/mediaIdentity';
import type { PlaylistSummary, SongSummary } from '../types/media';

const source = <T>() => ({
  items: [] as T[],
  cursor: undefined as MediaCursor | undefined,
  offset: 0,
  hasMore: true,
});
const initial = () => ({
  before: Date.now() + 1,
  songs: source<SongSummary>(),
  playlists: source<PlaylistSummary>(),
});
// One shared incremental index for all result categories and query edits. Only
// explicit continuation requests another 50-row page per available source.
export const useSearchIndex = () => {
  const state = useRef(initial());
  const [snapshot, setSnapshot] = useState(state.current);
  const [isLoading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 30_000);
    setLoading(true);
    setErrors([]);
    const failed = (kind: string, failure: unknown) => {
      if (active)
        setErrors((previous) => [
          ...previous,
          `${kind}: ${isAbortError(failure) ? 'The node is taking too long. Continue or retry shortly.' : requestError(failure, 'Search is incomplete. Continue or retry.')}`,
        ]);
    };
    const songs = async () => {
      const current = state.current.songs;
      if (!current.hasMore) return;
      try {
        const page = await fetchSongsPage({
          cursor: current.cursor,
          offset: current.offset,
          before: state.current.before,
          limit: 50,
          priority: 'background',
          signal: controller.signal,
        });
        if (!active || controller.signal.aborted) return;
        state.current = {
          ...state.current,
          songs: {
            items: mergeMedia(current.items, page.items),
            cursor: page.nextCursor,
            offset: page.nextOffset,
            hasMore: page.hasMore,
          },
        };
        setSnapshot({ ...state.current });
      } catch (failure) {
        failed('Songs', failure);
      }
    };
    const playlists = async () => {
      const current = state.current.playlists;
      if (!current.hasMore) return;
      try {
        const page = await fetchPlaylistsPage({
          cursor: current.cursor,
          offset: current.offset,
          before: state.current.before,
          limit: 50,
          priority: 'background',
          signal: controller.signal,
        });
        if (!active || controller.signal.aborted) return;
        state.current = {
          ...state.current,
          playlists: {
            items: mergeMedia(current.items, page.items),
            cursor: page.nextCursor,
            offset: page.nextOffset,
            hasMore: page.hasMore,
          },
        };
        setSnapshot({ ...state.current });
      } catch (failure) {
        failed('Playlists', failure);
      }
    };
    void Promise.allSettled([songs(), playlists()]).finally(() => {
      clearTimeout(timer);
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [revision]);
  return {
    songs: snapshot.songs.items,
    playlists: snapshot.playlists.items,
    hasMore: snapshot.songs.hasMore || snapshot.playlists.hasMore,
    isLoading,
    errors,
    loadMore: () => setRevision((value) => value + 1),
    refresh: () => {
      state.current = initial();
      setSnapshot(state.current);
      setRevision((value) => value + 1);
    },
  };
};
