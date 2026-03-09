import {
  fetchQdnResource,
  searchQdnResources,
  waitForQdnResourceReady,
} from './qdn';
import type { PlaylistSummary, SongSummary } from '../types/media';

const LIBRARY_IDENTIFIER = 'enjoymusic_library_state';
const LIBRARY_SERVICE = 'DOCUMENT' as const;

export interface RemoteLibraryState {
  favoriteSongs: SongSummary[];
  favoritePlaylists: PlaylistSummary[];
  recentSongs: SongSummary[];
  updatedAt: number;
}

const emptyLibraryState = (): RemoteLibraryState => ({
  favoriteSongs: [],
  favoritePlaylists: [],
  recentSongs: [],
  updatedAt: 0,
});

const normalizeSong = (song: Partial<SongSummary>): SongSummary | null => {
  if (
    !song.id ||
    !song.identifier ||
    !song.publisher ||
    !song.title ||
    !song.artist
  ) {
    return null;
  }

  return {
    id: song.id,
    identifier: song.identifier,
    publisher: song.publisher,
    title: song.title,
    artist: song.artist,
    description: song.description,
    created: song.created,
    updated: song.updated,
    status: song.status,
    service: 'AUDIO',
    mediaType: 'SONG',
  };
};

const normalizePlaylist = (
  playlist: Partial<PlaylistSummary>
): PlaylistSummary | null => {
  if (
    !playlist.id ||
    !playlist.identifier ||
    !playlist.publisher ||
    !playlist.title
  ) {
    return null;
  }

  return {
    id: playlist.id,
    identifier: playlist.identifier,
    publisher: playlist.publisher,
    title: playlist.title,
    description: playlist.description,
    created: playlist.created,
    updated: playlist.updated,
    status: playlist.status,
    songCount: playlist.songCount ?? 0,
  };
};

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
};

export const getLibraryMetadata = (publisher: string) => ({
  name: publisher,
  service: LIBRARY_SERVICE,
  identifier: LIBRARY_IDENTIFIER,
});

export const loadRemoteLibrary = async (
  publisher: string
): Promise<RemoteLibraryState | null> => {
  const resources = await searchQdnResources({
    mode: 'ALL',
    service: LIBRARY_SERVICE,
    name: publisher,
    identifier: LIBRARY_IDENTIFIER,
    query: LIBRARY_IDENTIFIER,
    limit: 1,
    offset: 0,
    reverse: true,
    includeMetadata: true,
    includeStatus: true,
    excludeBlocked: true,
    exactMatchNames: true,
  });

  if (!resources.length) {
    return null;
  }

  await waitForQdnResourceReady({
    name: publisher,
    service: LIBRARY_SERVICE,
    identifier: LIBRARY_IDENTIFIER,
    timeoutMs: 20_000,
  });

  const payload = await fetchQdnResource<Partial<RemoteLibraryState>>(
    getLibraryMetadata(publisher)
  );

  if (!payload) {
    return null;
  }

  return {
    favoriteSongs: uniqueById(
      (payload.favoriteSongs || [])
        .map((song) => normalizeSong(song))
        .filter((song): song is SongSummary => Boolean(song))
    ),
    favoritePlaylists: uniqueById(
      (payload.favoritePlaylists || [])
        .map((playlist) => normalizePlaylist(playlist))
        .filter((playlist): playlist is PlaylistSummary => Boolean(playlist))
    ),
    recentSongs: uniqueById(
      (payload.recentSongs || [])
        .map((song) => normalizeSong(song))
        .filter((song): song is SongSummary => Boolean(song))
    ).slice(0, 12),
    updatedAt:
      typeof payload.updatedAt === 'number' ? payload.updatedAt : Date.now(),
  };
};

export const mergeLibraryStates = (
  localState: RemoteLibraryState,
  remoteState: RemoteLibraryState | null
): RemoteLibraryState => {
  const remote = remoteState || emptyLibraryState();

  return {
    favoriteSongs: uniqueById([
      ...remote.favoriteSongs,
      ...localState.favoriteSongs,
    ]),
    favoritePlaylists: uniqueById([
      ...remote.favoritePlaylists,
      ...localState.favoritePlaylists,
    ]),
    recentSongs: uniqueById([
      ...remote.recentSongs,
      ...localState.recentSongs,
    ]).slice(0, 12),
    updatedAt: Math.max(remote.updatedAt || 0, localState.updatedAt || 0),
  };
};
