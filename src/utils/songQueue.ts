import type { SongSummary } from '../types/media';
import type { MiniPlayerTrack } from '../state/player';
export const songQueue = (songs: SongSummary[]): MiniPlayerTrack[] =>
  songs.map((track) => ({
    key: `${track.publisher}:${track.identifier}`,
    id: track.id,
    identifier: track.identifier,
    publisher: track.publisher,
    service: 'AUDIO',
    title: track.title,
    artist: track.artist,
    context: track.publisher,
  }));
