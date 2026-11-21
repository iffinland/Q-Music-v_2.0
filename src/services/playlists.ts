import {
  PLAYLIST_PREFIXES,
  matchingMediaPrefix,
  isEarBumpIdentifier,
  safeEarBumpImage,
} from '../utils/mediaOrigin';
import {
  fetchQdnResource,
  getQdnResourceUrl,
  findExactQdnResource,
  isQdnResourceReady,
  waitForQdnResourceReady,
} from './qdn';
import { mediaKey, mergeMedia } from '../utils/mediaIdentity';
import {
  readMediaPrefixesPage,
  type MediaPageOptions,
  type MediaCursor,
} from './mediaPages';
import { throwIfAborted, type ReadOptions } from './qdnRequests';
import type {
  PlaylistDetail,
  PlaylistSongReference,
  PlaylistSummary,
  QdnSearchResource,
} from '../types/media';
import { buildTitleFromIdentifier } from '../utils/mediaTitles';

interface RawPlaylistSong {
  service?: string;
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
  image?: unknown;
  title?: string;
  description?: string;
  publishedDate?: string;
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
    buildTitleFromIdentifier(
      identifier,
      matchingMediaPrefix(identifier, 'playlist')
    );

  const description =
    normalizeString(resource.metadata?.description) ||
    normalizeString(resource.description);

  return {
    id: mediaKey('PLAYLIST', publisher, identifier),
    identifier,
    publisher,
    title: title || 'Untitled playlist',
    description: description || undefined,
    publishedDate: normalizeString(resource.metadata?.publishedDate),
    created: resource.created,
    updated: resource.updated,
    status: resource.status,
    songCount: null,
  };
};

const loadPlaylistPayload = async (
  publisher: string,
  identifier: string,
  options: ReadOptions = {}
) => {
  const status = await waitForQdnResourceReady({
    name: publisher,
    service: 'PLAYLIST',
    identifier,
    timeoutMs: 60_000,
    signal: options.signal,
    priority: options.priority,
  });
  if (!isQdnResourceReady(status.status))
    throw new Error(
      `Playlist is not available yet (${status.status}). Please retry.`
    );
  const payload = await fetchQdnResource<RawPlaylistPayload>(
    { name: publisher, service: 'PLAYLIST', identifier },
    options
  );
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.songs))
    throw new Error(
      'Playlist could not be read. Please retry; its saved tracks have not been changed.'
    );
  return payload;
};

export const resolvePlaylistSongCount = async (
  publisher: string,
  identifier: string,
  options: ReadOptions = {}
) =>
  (await loadPlaylistPayload(publisher, identifier, options))
    .songs!.map(mapPlaylistSongReference)
    .filter(Boolean).length;

const mapPlaylistSongReference = (
  song: RawPlaylistSong
): PlaylistSongReference | null => {
  if (
    !song ||
    typeof song !== 'object' ||
    (song.service && song.service !== 'AUDIO')
  )
    return null;
  const identifier = normalizeString(song.identifier || song.id);
  const publisher = normalizeString(song.name || song.publisher);
  if (!identifier || !publisher) return null;
  // Older playlists can omit titles. They remain playable without one search
  // per track (and without blocking the entire playlist on those searches).
  return {
    identifier,
    publisher,
    title:
      normalizeString(song.title) ||
      buildTitleFromIdentifier(
        identifier,
        matchingMediaPrefix(identifier, 'song')
      ),
    artist: normalizeString(song.author || song.artist) || publisher,
  };
};

export const fetchPlaylistsPage = (options: MediaPageOptions = {}) =>
  readMediaPrefixesPage(
    'PLAYLIST',
    PLAYLIST_PREFIXES,
    mapPlaylistSummary,
    options
  );
export const fetchPlaylists = async (
  options: MediaPageOptions = {}
): Promise<PlaylistSummary[]> => (await fetchPlaylistsPage(options)).items;
export const fetchPlaylistsByPublisher = (
  publisher: string,
  options: MediaPageOptions = {}
) => fetchPlaylists({ ...options, publisher });
export const fetchAllPlaylists = async (
  options: MediaPageOptions & {
    onPage?: (items: PlaylistSummary[]) => void;
  } = {}
) => {
  let items: PlaylistSummary[] = [];
  let offset = 0;
  let cursor: MediaCursor | undefined;
  const before = options.before ?? Date.now() + 1;
  while (true) {
    const page = await fetchPlaylistsPage({
      ...options,
      before,
      limit: 100,
      offset,
      cursor,
    });
    throwIfAborted(options.signal);
    items = mergeMedia(items, page.items);
    options.onPage?.(items);
    if (!page.hasMore) return items;
    offset = page.nextOffset;
    cursor = page.nextCursor;
  }
};
export const fetchPlaylistDetail = async (
  publisher: string,
  identifier: string,
  options: ReadOptions = {}
): Promise<PlaylistDetail | null> => {
  const resource = await findExactQdnResource(
    'PLAYLIST',
    publisher,
    identifier,
    options
  );
  const summary = resource ? mapPlaylistSummary(resource) : null;
  if (!summary) return null;
  const payload = await loadPlaylistPayload(publisher, identifier, options);
  const songs = payload
    .songs!.map(mapPlaylistSongReference)
    .filter((item): item is PlaylistSongReference => Boolean(item));
  return {
    ...summary,
    title: normalizeString(payload.title) || summary.title,
    description: normalizeString(payload.description) || summary.description,
    publishedDate:
      normalizeString(payload.publishedDate) || summary.publishedDate,
    image: isEarBumpIdentifier(identifier)
      ? safeEarBumpImage(payload.image)
      : undefined,
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
