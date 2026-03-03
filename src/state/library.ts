import { atomWithStorage } from 'jotai/utils';
import { atom } from 'jotai';
import type { PlaylistSummary, SongSummary } from '../types/media';

export const favoriteSongsAtom = atomWithStorage<SongSummary[]>(
  'qmusic20.favoriteSongs',
  []
);

export const favoritePlaylistsAtom = atomWithStorage<PlaylistSummary[]>(
  'qmusic20.favoritePlaylists',
  []
);

export const recentSongsAtom = atomWithStorage<SongSummary[]>(
  'qmusic20.recentSongs',
  []
);

export const libraryHydratedForAtom = atom<string | null>(null);
export const librarySyncStateAtom = atom<
  'idle' | 'loading' | 'saving' | 'error'
>('idle');
