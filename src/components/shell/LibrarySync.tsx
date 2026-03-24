import { objectToBase64, useGlobal, usePublish } from 'qapp-core';
import { useAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import {
  favoritePlaylistsAtom,
  favoriteSongsAtom,
  libraryHydratedForAtom,
  librarySyncStateAtom,
  recentSongsAtom,
} from '../../state/library';
import {
  getLibraryMetadata,
  loadRemoteLibrary,
  mergeLibraryStates,
  refreshPlaylistCounters,
} from '../../services/library';

export const LibrarySync = () => {
  const { auth } = useGlobal();
  const { publishMultipleResources } = usePublish();
  const [favoriteSongs, setFavoriteSongs] = useAtom(favoriteSongsAtom);
  const [favoritePlaylists, setFavoritePlaylists] = useAtom(
    favoritePlaylistsAtom
  );
  const [recentSongs, setRecentSongs] = useAtom(recentSongsAtom);
  const [libraryHydratedFor, setLibraryHydratedFor] = useAtom(
    libraryHydratedForAtom
  );
  const [, setLibrarySyncState] = useAtom(librarySyncStateAtom);
  const saveTimeoutRef = useRef<number | null>(null);
  const latestSerializedRef = useRef('');
  const recentSongsRef = useRef(recentSongs);

  const serializeLibrarySyncTrigger = useMemo(
    () =>
      (payload: {
        favoriteSongs: typeof favoriteSongs;
        favoritePlaylists: typeof favoritePlaylists;
      }) =>
        JSON.stringify({
          favoriteSongs: payload.favoriteSongs,
          favoritePlaylists: payload.favoritePlaylists,
        }),
    []
  );

  const publisher = auth?.name?.trim() || '';
  const currentState = useMemo(
    () => ({
      favoriteSongs,
      favoritePlaylists,
      recentSongs,
      updatedAt: Date.now(),
    }),
    [favoritePlaylists, favoriteSongs, recentSongs]
  );

  useEffect(() => {
    recentSongsRef.current = recentSongs;
  }, [recentSongs]);

  useEffect(() => {
    if (!publisher || libraryHydratedFor === publisher) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLibrarySyncState('loading');
      try {
        const remoteState = await loadRemoteLibrary(publisher);
        if (cancelled) return;

        const merged = mergeLibraryStates(currentState, remoteState);
        const refreshedFavoritePlaylists = await refreshPlaylistCounters(
          merged.favoritePlaylists
        );
        if (cancelled) return;

        const nextState = {
          ...merged,
          favoritePlaylists: refreshedFavoritePlaylists,
        };
        const nextSerialized = serializeLibrarySyncTrigger({
          favoriteSongs: nextState.favoriteSongs,
          favoritePlaylists: nextState.favoritePlaylists,
        });

        setFavoriteSongs(nextState.favoriteSongs);
        setFavoritePlaylists(nextState.favoritePlaylists);
        setRecentSongs(nextState.recentSongs);
        setLibraryHydratedFor(publisher);
        latestSerializedRef.current = nextSerialized;
        setLibrarySyncState('idle');
      } catch {
        if (!cancelled) {
          setLibraryHydratedFor(publisher);
          setLibrarySyncState('error');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    currentState,
    libraryHydratedFor,
    publisher,
    setFavoritePlaylists,
    setFavoriteSongs,
    setLibraryHydratedFor,
    setLibrarySyncState,
    setRecentSongs,
    serializeLibrarySyncTrigger,
  ]);

  useEffect(() => {
    if (!publisher || libraryHydratedFor !== publisher) {
      return;
    }

    const serialized = serializeLibrarySyncTrigger({
      favoriteSongs,
      favoritePlaylists,
    });

    if (serialized === latestSerializedRef.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      const persist = async () => {
        try {
          setLibrarySyncState('saving');
          const data64 = await objectToBase64({
            favoriteSongs,
            favoritePlaylists,
            recentSongs: recentSongsRef.current,
            updatedAt: Date.now(),
          });
          const result = await publishMultipleResources([
            {
              ...getLibraryMetadata(publisher),
              title: 'Q-Music Library',
              description: 'Saved songs, playlists and recent audio history',
              data64,
            },
          ]);

          if (result instanceof Error) {
            throw result;
          }

          latestSerializedRef.current = serialized;
          setLibrarySyncState('idle');
        } catch {
          setLibrarySyncState('error');
        }
      };

      void persist();
    }, 900);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    favoritePlaylists,
    favoriteSongs,
    libraryHydratedFor,
    publisher,
    publishMultipleResources,
    serializeLibrarySyncTrigger,
    setLibrarySyncState,
  ]);

  return null;
};
