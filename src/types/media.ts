export interface QdnSearchResource {
  identifier?: string;
  name?: string;
  created?: number;
  updated?: number;
  status?: string;
  size?: number;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface SongSummary {
  id: string;
  identifier: string;
  publisher: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  mood?: string;
  language?: string;
  notes?: string;
  publishedDate?: string;
  description?: string;
  created?: number;
  updated?: number;
  status?: string;
  service: 'AUDIO';
  mediaType: 'SONG';
}

export interface PlaylistSongReference {
  identifier: string;
  publisher: string;
  title?: string;
  artist?: string;
}

export interface PlaylistSummary {
  id: string;
  identifier: string;
  publisher: string;
  title: string;
  description?: string;
  publishedDate?: string;
  created?: number;
  updated?: number;
  status?: string;
  songCount: number;
}

export interface PlaylistDetail extends PlaylistSummary {
  songs: PlaylistSongReference[];
}
