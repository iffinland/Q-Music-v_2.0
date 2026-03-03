import { useAtom } from 'jotai';
import {
  favoritePlaylistsAtom,
  favoriteSongsAtom,
  recentSongsAtom,
} from '../state/library';
import type { PlaylistSummary, SongSummary } from '../types/media';

const upsertById = <T extends { id: string }>(items: T[], nextItem: T) => {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex === -1) {
    return [...items, nextItem];
  }

  const next = [...items];
  next[existingIndex] = nextItem;
  return next;
};

export const useLibrary = () => {
  const [favoriteSongs, setFavoriteSongs] = useAtom(favoriteSongsAtom);
  const [favoritePlaylists, setFavoritePlaylists] = useAtom(
    favoritePlaylistsAtom
  );
  const [recentSongs, setRecentSongs] = useAtom(recentSongsAtom);

  const toggleSong = (song: SongSummary) => {
    const exists = favoriteSongs.some((item) => item.id === song.id);
    if (exists) {
      setFavoriteSongs(favoriteSongs.filter((item) => item.id !== song.id));
      return false;
    }
    setFavoriteSongs(upsertById(favoriteSongs, song));
    return true;
  };

  const togglePlaylist = (playlist: PlaylistSummary) => {
    const exists = favoritePlaylists.some((item) => item.id === playlist.id);
    if (exists) {
      setFavoritePlaylists(
        favoritePlaylists.filter((item) => item.id !== playlist.id)
      );
      return false;
    }
    setFavoritePlaylists(upsertById(favoritePlaylists, playlist));
    return true;
  };

  const addRecentSong = (song: SongSummary) => {
    const next = [song, ...recentSongs.filter((item) => item.id !== song.id)];
    setRecentSongs(next.slice(0, 12));
  };

  return {
    favoriteSongs,
    favoritePlaylists,
    recentSongs,
    isSongFavorite: (songId: string) =>
      favoriteSongs.some((item) => item.id === songId),
    isPlaylistFavorite: (playlistId: string) =>
      favoritePlaylists.some((item) => item.id === playlistId),
    addRecentSong,
    toggleSong,
    togglePlaylist,
  };
};
