import { useMemo, useSyncExternalStore } from 'react';
import { useGlobal } from '../qortal';
import type { PlaylistSummary, SongSummary } from '../types/media';
import { libraryAccount, libraryFingerprint } from '../services/library/model';
import {
  changeLibrary,
  getLibrarySnapshot,
  subscribeLibrary,
} from '../services/library/store';
import { refreshLibrary, saveLibraryToQdn } from '../services/library/sync';
export const useLibrary = () => {
  const { auth } = useGlobal();
  const account = useMemo(
    () => libraryAccount({ address: auth?.address, name: auth?.name }),
    [auth?.address, auth?.name]
  );
  const state = useSyncExternalStore(subscribeLibrary, () =>
    getLibrarySnapshot(account)
  );
  const { favoriteSongs, favoritePlaylists, recentSongs } = state.data;
  const pending = state.remote
    ? libraryFingerprint(state.data) !== libraryFingerprint(state.remote)
    : Object.keys(state.data.entries || {}).length > 0;
  return {
    account,
    favoriteSongs,
    favoritePlaylists,
    recentSongs,
    syncState: state.phase,
    syncError: state.error,
    storageError: state.storageError,
    pending,
    uncertainSave: Boolean(state.attempt && state.attempt.state !== 'sent'),
    sentUnchanged: Boolean(
      state.attempt?.state === 'sent' &&
        libraryFingerprint(state.attempt.data) ===
          libraryFingerprint(state.data)
    ),
    isSongFavorite: (id: string) =>
      favoriteSongs.some((item) => item.id === id),
    isPlaylistFavorite: (id: string) =>
      favoritePlaylists.some((item) => item.id === id),
    toggleSong: (song: SongSummary) => changeLibrary(account, 'song', song),
    togglePlaylist: (playlist: PlaylistSummary) =>
      changeLibrary(account, 'playlist', playlist),
    addRecentSong: (song: SongSummary) => {
      changeLibrary(account, 'recent', song, false);
    },
    refresh: () => refreshLibrary(account),
    save: (allowResend = false) => saveLibraryToQdn(account, allowResend),
  };
};
