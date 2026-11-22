import { useEffect, useRef, useState } from 'react';
import { fetchSongsPage } from '../services/songs';
import type { MediaCursor } from '../services/mediaPages';
import { isAbortError, requestError } from '../services/qdnRequests';
import type { SongSummary } from '../types/media';
import { artistNameKey } from '../utils/creators';
import { mergeMedia } from '../utils/mediaIdentity';

const initial = (name: string) => ({
  name,
  items: [] as SongSummary[],
  cursor: undefined as MediaCursor | undefined,
  offset: 0,
  before: Date.now() + 1,
  hasMore: true,
  scanned: 0,
});
// Artist is free-text metadata, not a Core name filter. Scan index rows only,
// at most two 50-item batches per explicit continuation; never read every payload.
export const useArtistFeed = (artist: string) => {
  const key = artistNameKey(artist);
  const state = useRef(initial(key));
  const [snapshot, setSnapshot] = useState(state.current);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (state.current.name !== key) state.current = initial(key);
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 30_000);
    setSnapshot({ ...state.current });
    setLoading(true);
    setError(null);
    const scan = async () => {
      try {
        for (
          let batch = 0;
          batch < 2 && state.current.hasMore && key;
          batch++
        ) {
          const current = state.current;
          const page = await fetchSongsPage({
            cursor: current.cursor,
            offset: current.offset,
            before: current.before,
            limit: 50,
            priority: 'background',
            signal: controller.signal,
          });
          if (!active || controller.signal.aborted) return;
          state.current = {
            ...current,
            cursor: page.nextCursor,
            offset: page.nextOffset,
            hasMore: page.hasMore,
            scanned: current.scanned + page.items.length,
            items: mergeMedia(
              current.items,
              page.items.filter((song) => artistNameKey(song.artist) === key)
            ),
          };
          setSnapshot({ ...state.current });
        }
      } catch (failure) {
        if (active)
          setError(
            isAbortError(failure)
              ? 'Artist search is taking too long. Continue or retry when your node is ready.'
              : requestError(
                  failure,
                  'Artist search is incomplete. Please continue or retry.'
                )
          );
      } finally {
        clearTimeout(timer);
        if (active) setLoading(false);
      }
    };
    void scan();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, revision]);
  return {
    items: snapshot.name === key ? snapshot.items : [],
    scanned: snapshot.name === key ? snapshot.scanned : 0,
    hasMore: snapshot.name !== key || snapshot.hasMore,
    isLoading: snapshot.name !== key || loading,
    error,
    loadMore: () => setRevision((value) => value + 1),
    refresh: () => {
      state.current = initial(key);
      setSnapshot(state.current);
      setRevision((value) => value + 1);
    },
  };
};
