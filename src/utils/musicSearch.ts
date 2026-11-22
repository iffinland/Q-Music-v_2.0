import type { PlaylistSummary, SongSummary } from '../types/media';
import { artistNameKey } from './creators';

const normalized = (text: string) => text.normalize('NFC').toLowerCase();
export const matchesMusicText = (text: string, query: string) => {
  const haystack = normalized(text);
  return normalized(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
};
export const buildSongSearchText = (song: SongSummary) =>
  [
    song.title,
    song.artist,
    song.publisher,
    song.identifier,
    song.album,
    song.genre,
    song.mood,
    song.language,
    song.notes,
    song.publishedDate,
    song.description,
    ...(song.tags || []),
  ]
    .filter(Boolean)
    .join(' ');
export const buildPlaylistSearchText = (playlist: PlaylistSummary) =>
  [
    playlist.title,
    playlist.publisher,
    playlist.identifier,
    playlist.description,
    playlist.publishedDate,
    ...(playlist.tags || []),
  ]
    .filter(Boolean)
    .join(' ');
export const indexTags = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value
        .filter(
          (tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())
        )
        .map((tag) => tag.trim())
    : undefined;
export interface CreatorResult {
  name: string;
  songs: number;
  playlists: number;
}
export const searchCreators = (
  songs: SongSummary[],
  playlists: PlaylistSummary[],
  query: string,
  kind: 'artist' | 'publisher'
): CreatorResult[] => {
  const groups = new Map<string, CreatorResult>();
  const add = (name: string, type: 'songs' | 'playlists') => {
    if (!name.trim() || !matchesMusicText(name, query)) return;
    const key = artistNameKey(name);
    const value = groups.get(key) || {
      name: name.trim(),
      songs: 0,
      playlists: 0,
    };
    value[type]++;
    groups.set(key, value);
  };
  songs.forEach((song) =>
    add(kind === 'artist' ? song.artist : song.publisher, 'songs')
  );
  if (kind === 'publisher')
    playlists.forEach((playlist) => add(playlist.publisher, 'playlists'));
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
};
