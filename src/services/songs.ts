import { SONG_PREFIXES, matchingMediaPrefix } from '../utils/mediaOrigin';
import {
  MAX_AUTOMATIC_AUDIO_REUSE_BYTES,
  readBoundedAudio,
} from './boundedFile';
import { enrichKnownSong, metadataRevision } from './songDescriptors';
import {
  findExactQdnResource,
  getQdnResourceProperties,
  getQdnResourceUrl,
} from './qdn';
import type { QdnSearchResource, SongSummary } from '../types/media';
import { buildTitleFromIdentifier } from '../utils/mediaTitles';
import { parseSongMetadata } from '../utils/songMetadata';
import { mediaKey, mergeMedia } from '../utils/mediaIdentity';
import {
  readMediaPrefixesPage,
  type MediaPageOptions,
  type MediaCursor,
} from './mediaPages';
import { throwIfAborted, type ReadOptions } from './qdnRequests';

const inferAudioExtension = (contentType?: string) => {
  if (!contentType) return 'mp3';
  if (contentType.includes('mpeg')) return 'mp3';
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('flac')) return 'flac';
  if (contentType.includes('aac')) return 'aac';
  return 'audio';
};

const inferAudioMimeType = (filename?: string, fallbackType?: string) => {
  if (fallbackType?.startsWith('audio/')) {
    return fallbackType;
  }

  const extension = filename?.split('.').pop()?.trim().toLowerCase();
  switch (extension) {
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    case 'm4a':
      return 'audio/mp4';
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    default:
      return fallbackType || 'audio/mpeg';
  }
};

const resolveAudioFilename = (
  identifier: string,
  resourceFilename?: string,
  mimeType?: string
) => {
  const normalizedFilename = resourceFilename?.trim();
  if (normalizedFilename) {
    return normalizedFilename;
  }

  return `${identifier}.${inferAudioExtension(mimeType)}`;
};

const mapSongResource = (resource: QdnSearchResource): SongSummary | null => {
  const identifier =
    typeof resource.identifier === 'string' ? resource.identifier : '';
  const publisher = typeof resource.name === 'string' ? resource.name : '';
  if (!identifier || !publisher) return null;

  const parsedDescription = parseSongMetadata(
    typeof resource.metadata?.description === 'string'
      ? resource.metadata.description
      : resource.description
  );

  const metadataTitle =
    typeof resource.metadata?.title === 'string'
      ? resource.metadata.title.trim()
      : '';
  const resourceTitle =
    typeof resource.title === 'string' ? resource.title.trim() : '';

  return enrichKnownSong({
    id: mediaKey('AUDIO', publisher, identifier),
    identifier,
    publisher,
    title:
      metadataTitle ||
      resourceTitle ||
      parsedDescription.title ||
      buildTitleFromIdentifier(
        identifier,
        matchingMediaPrefix(identifier, 'song')
      ),
    artist: parsedDescription.author || publisher,
    album: parsedDescription.album,
    genre: parsedDescription.genre,
    mood: parsedDescription.mood,
    language: parsedDescription.language,
    notes: parsedDescription.notes,
    description:
      typeof resource.metadata?.description === 'string'
        ? resource.metadata.description
        : undefined,
    publishedDate: parsedDescription.publishedDate,
    created: resource.created,
    updated: resource.updated,
    status: resource.status,
    service: 'AUDIO',
    mediaType: 'SONG',
    metadataRevision: metadataRevision(
      typeof resource.metadata?.description === 'string'
        ? resource.metadata.description
        : resource.description
    ),
  });
};

export const fetchSongsPage = (options: MediaPageOptions = {}) =>
  readMediaPrefixesPage('AUDIO', SONG_PREFIXES, mapSongResource, options);
export const fetchSongs = async (options: MediaPageOptions = {}) =>
  (await fetchSongsPage(options)).items;
export const fetchAllSongs = async (
  options: MediaPageOptions & { onPage?: (songs: SongSummary[]) => void } = {}
): Promise<SongSummary[]> => {
  let allSongs: SongSummary[] = [];
  let offset = 0;
  let cursor: MediaCursor | undefined;
  const before = options.before ?? Date.now() + 1;
  while (true) {
    const page = await fetchSongsPage({
      ...options,
      before,
      limit: 100,
      offset,
      cursor,
    });
    throwIfAborted(options.signal);
    allSongs = mergeMedia(allSongs, page.items);
    options.onPage?.(allSongs);
    if (!page.hasMore) return allSongs;
    offset = page.nextOffset;
    cursor = page.nextCursor;
  }
};
export const fetchSongsByPublisher = (
  publisher: string,
  options: MediaPageOptions = {}
) => fetchSongs({ ...options, publisher });
export const fetchSongByIdentifier = async (
  publisher: string,
  identifier: string,
  options: ReadOptions = {}
): Promise<SongSummary | null> => {
  const resource = await findExactQdnResource(
    'AUDIO',
    publisher,
    identifier,
    options
  );
  return resource ? mapSongResource(resource) : null;
};

export const resolveSongArtwork = async (
  publisher: string,
  identifier: string
): Promise<string | null> => {
  return getQdnResourceUrl('THUMBNAIL', publisher, identifier);
};

export const loadExistingSongAudioFile = async (params: {
  publisher: string;
  identifier: string;
  onStatusChange?: (status: string) => void;
  signal?: AbortSignal;
}) => {
  params.onStatusChange?.('Looking up the current QDN audio file...');

  throwIfAborted(params.signal);
  const properties = await getQdnResourceProperties(
    { name: params.publisher, service: 'AUDIO', identifier: params.identifier },
    { signal: params.signal }
  );
  if (
    typeof properties?.size === 'number' &&
    properties.size > MAX_AUTOMATIC_AUDIO_REUSE_BYTES
  )
    throw new Error(
      'For audio larger than 64 MiB, select the original file from your device to save this edit.'
    );
  const resourceFilename =
    (typeof properties?.filename === 'string' && properties.filename.trim()) ||
    (typeof properties?.fileName === 'string' && properties.fileName.trim()) ||
    (typeof properties?.name === 'string' && properties.name.trim()) ||
    undefined;

  params.onStatusChange?.(
    'Waiting for the current QDN audio file to become available...'
  );
  const streamUrl = await resolveSongStreamUrl(
    params.publisher,
    params.identifier,
    {
      signal: params.signal,
      waitUntilReady: true,
      onStatusChange: (resourceStatus, progress) => {
        params.onStatusChange?.(
          progress
            ? `Loading the current QDN audio file (${progress}%)...`
            : `Loading the current QDN audio file: ${resourceStatus}...`
        );
      },
    }
  );

  if (!streamUrl) {
    throw new Error(
      'The current audio file could not be loaded. Select a replacement audio file to save changes.'
    );
  }

  params.onStatusChange?.(
    'Downloading the current QDN audio file for reuse...'
  );
  const controller = new AbortController();
  const abort = () => controller.abort();
  params.signal?.addEventListener('abort', abort, { once: true });
  if (params.signal?.aborted) controller.abort();
  const bytes = typeof properties?.size === 'number' ? properties.size : 0;
  const timer = setTimeout(
    () => controller.abort(),
    Math.min(30 * 60_000, 60_000 + (bytes / (128 * 1024)) * 1000)
  );
  let response: Response;
  try {
    response = await fetch(streamUrl, {
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', abort);
    throw error;
  }
  if (!response.ok) {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', abort);
    throw new Error(
      'The current audio file could not be reused for this edit. Select a replacement audio file to save changes.'
    );
  }

  let blob: Blob;
  try {
    blob = await readBoundedAudio(response, controller.signal);
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', abort);
  }
  const mimeType = inferAudioMimeType(resourceFilename, blob.type);

  return new File(
    [blob],
    resolveAudioFilename(params.identifier, resourceFilename, mimeType),
    {
      type: mimeType,
    }
  );
};

export const resolveSongStreamUrl = async (
  publisher: string,
  identifier: string,
  options: ReadOptions & {
    waitUntilReady?: boolean;
    onStatusChange?: (status: string, progress?: number) => void;
  } = {}
): Promise<string | null> => {
  // Core's URL endpoint checks existence. The media request itself starts the
  // download/build; properties/build preflight would unnecessarily block Play.
  options.onStatusChange?.('Connecting');
  return getQdnResourceUrl('AUDIO', publisher, identifier, {
    ...options,
    priority: 'playback',
    retries: 1,
  });
};
