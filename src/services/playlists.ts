import {
  fetchQdnResource,
  getQdnResourceUrl,
  searchQdnResources,
  shouldHideQdnResource,
  waitForQdnResourceReady,
} from './qdn';
import { fetchSongByIdentifier } from './songs';
import type {
  PlaylistDetail,
  PlaylistSongReference,
  PlaylistSummary,
  QdnSearchResource,
} from '../types/media';

const PLAYLIST_PREFIX = 'enjoymusic_playlist_';

interface RawPlaylistSong {
  identifier?: string;
  id?: string;
  name?: string;
  publisher?: string;
  title?: string;
  author?: string;
  artist?: string;
}

interface RawPlaylistPayload {
  songs?: RawPlaylistSong[];
  title?: string;
  description?: string;
}

const normalizeString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const mapPlaylistSummary = (
  resource: QdnSearchResource
): PlaylistSummary | null => {
  const identifier = normalizeString(resource.identifier);
  const publisher = normalizeString(resource.name);
  if (!identifier || !publisher) return null;

  const title =
    normalizeString(resource.metadata?.title) ||
    normalizeString(resource.title) ||
    identifier.replace(PLAYLIST_PREFIX, '').replace(/[_-]+/g, ' ').trim();

  const description =
    normalizeString(resource.metadata?.description) ||
    normalizeString(resource.description);

  return {
    id: identifier,
    identifier,
    publisher,
    title: title || 'Untitled playlist',
    description: description || undefined,
    created: resource.created,
    updated: resource.updated,
    status: resource.status,
    songCount: 0,
  };
};

const sortByLatest = (items: QdnSearchResource[]) => {
  return [...items].sort((a, b) => {
    const aTime =
      typeof a.updated === 'number'
        ? a.updated
        : typeof a.created === 'number'
          ? a.created
          : 0;
    const bTime =
      typeof b.updated === 'number'
        ? b.updated
        : typeof b.created === 'number'
          ? b.created
          : 0;
    return bTime - aTime;
  });
};

const uniqueByIdentifier = (items: QdnSearchResource[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const identifier = normalizeString(item.identifier);
    if (!identifier || seen.has(identifier)) return false;
    seen.add(identifier);
    return true;
  });
};

const mapPlaylistSongReference = async (
  song: RawPlaylistSong
): Promise<PlaylistSongReference | null> => {
  const identifier = normalizeString(song.identifier || song.id);
  const publisher = normalizeString(song.name || song.publisher);
  if (!identifier || !publisher) return null;

  const fallbackTitle = normalizeString(song.title);
  const fallbackArtist = normalizeString(song.author || song.artist);
  if (fallbackTitle || fallbackArtist) {
    return {
      identifier,
      publisher,
      title: fallbackTitle || undefined,
      artist: fallbackArtist || undefined,
    };
  }

  let resolvedSong = null;
  try {
    resolvedSong = await fetchSongByIdentifier(publisher, identifier);
  } catch {
    resolvedSong = null;
  }

  return {
    identifier,
    publisher,
    title: resolvedSong?.title || undefined,
    artist: resolvedSong?.artist || undefined,
  };
};

export const fetchPlaylists = async (options?: {
  limit?: number;
  offset?: number;
  publisher?: string;
}): Promise<PlaylistSummary[]> => {
  const limit = options?.limit ?? 24;
  const offset = options?.offset ?? 0;
  const publisher = options?.publisher?.trim();

  const resources = await searchQdnResources({
    mode: 'ALL',
    service: 'PLAYLIST',
    query: PLAYLIST_PREFIX,
    ...(publisher ? { name: publisher, exactMatchNames: true } : {}),
    limit,
    offset,
    reverse: true,
    includeMetadata: true,
    includeStatus: true,
    excludeBlocked: true,
  });

  const summaries = uniqueByIdentifier(sortByLatest(resources))
    .filter((resource) => {
      const identifier = normalizeString(resource.identifier);
      return (
        identifier.startsWith(PLAYLIST_PREFIX) &&
        !shouldHideQdnResource(resource)
      );
    })
    .map(mapPlaylistSummary)
    .filter((item): item is PlaylistSummary => Boolean(item));

  return summaries;
};

export const fetchPlaylistsByPublisher = async (
  publisher: string,
  options?: { limit?: number; offset?: number }
) => {
  return fetchPlaylists({
    ...options,
    publisher,
  });
};

export const fetchPlaylistDetail = async (
  publisher: string,
  identifier: string
): Promise<PlaylistDetail | null> => {
  const resources = await searchQdnResources({
    mode: 'ALL',
    service: 'PLAYLIST',
    name: publisher,
    identifier,
    query: identifier,
    limit: 1,
    offset: 0,
    reverse: true,
    includeMetadata: true,
    includeStatus: true,
    excludeBlocked: true,
    exactMatchNames: true,
  });

  const resource = resources.find((entry) => !shouldHideQdnResource(entry));
  const summary = resource ? mapPlaylistSummary(resource) : null;
  if (!summary) return null;

  await waitForQdnResourceReady({
    name: publisher,
    service: 'PLAYLIST',
    identifier,
    timeoutMs: 30_000,
  });

  let payload: RawPlaylistPayload | null = null;
  try {
    payload = await fetchQdnResource<RawPlaylistPayload>({
      name: publisher,
      service: 'PLAYLIST',
      identifier,
    });
  } catch {
    payload = null;
  }

  const rawSongs = Array.isArray(payload?.songs) ? payload.songs : [];
  const resolvedSongs = await Promise.all(
    rawSongs.map(async (song) => {
      try {
        return await mapPlaylistSongReference(song);
      } catch {
        return null;
      }
    })
  );
  const songs = resolvedSongs.filter((item): item is PlaylistSongReference =>
    Boolean(item)
  );

  return {
    ...summary,
    title: normalizeString(payload?.title) || summary.title,
    description: normalizeString(payload?.description) || summary.description,
    songCount: songs.length,
    songs,
  };
};

export const resolvePlaylistArtwork = async (
  publisher: string,
  identifier: string
): Promise<string | null> => {
  return getQdnResourceUrl('THUMBNAIL', publisher, identifier);
};
