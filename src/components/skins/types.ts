import type { ReactNode } from 'react';
import type { PlaylistSummary, SongSummary } from '../../types/media';
export interface MediaCardProps {
  kind: 'song' | 'playlist';
  item: SongSummary | PlaylistSummary;
  onPlay: () => void;
  busy?: boolean;
  actions?: ReactNode;
}
export interface HomeViewProps {
  songs: SongSummary[];
  playlists: PlaylistSummary[];
  songsLoading: boolean;
  playlistsLoading: boolean;
  playlistLoadingId: string | null;
  onPlaySong: (song: SongSummary, index: number) => void;
  onPlayPlaylist: (playlist: PlaylistSummary) => void;
  libraryCounts: { songs: number; playlists: number; recent: number };
}
