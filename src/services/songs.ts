import {
  getQdnResourceUrl,
  isQdnResourceReady,
  searchQdnResources,
  shouldHideQdnResource,
  waitForQdnResourceReady,
} from './qdn';
import type { QdnSearchResource, SongSummary } from '../types/media';

const SONG_PREFIX = 'enjoymusic_song_';

const descriptionCache = new Map<string, Record<string, string>>();

const parseDescriptionMap = (description: unknown, cacheKey?: string) => {
  if (cacheKey && descriptionCache.has(cacheKey)) {
    return descriptionCache.get(cacheKey) as Record<string, string>;
  }

  const parsed: Record<string, string> = {};
  if (typeof description === 'string') {
    description.split(';').forEach((pair) => {
      const [rawKey, rawValue] = pair.split('=');
      if (!rawKey || !rawValue) return;
      const key = rawKey.trim();
      if (key !== 'title' && key !== 'author') return;
      parsed[key] = rawValue.trim();
    });
  }

  if (cacheKey) {
    descriptionCache.set(cacheKey, parsed);
  }

  return parsed;
};

const mapSongResource = (resource: QdnSearchResource): SongSummary | null => {
  const identifier =
    typeof resource.identifier === 'string' ? resource.identifier : '';
  const publisher = typeof resource.name === 'string' ? resource.name : '';
  if (!identifier || !publisher) return null;

  const parsedDescription = parseDescriptionMap(
    resource.metadata?.description,
    `${publisher}:${identifier}`
  );

  const metadataTitle =
    typeof resource.metadata?.title === 'string'
      ? resource.metadata.title.trim()
      : '';

  return {
    id: identifier,
    identifier,
    publisher,
    title:
      metadataTitle ||
      parsedDescription.title ||
      identifier.replace(SONG_PREFIX, '').replace(/[_-]+/g, ' ').trim(),
    artist: parsedDescription.author || publisher,
    description:
      typeof resource.metadata?.description === 'string'
        ? resource.metadata.description
        : undefined,
    created: resource.created,
    updated: resource.updated,
    status: resource.status,
    service: 'AUDIO',
    mediaType: 'SONG',
  };
};

const uniqueByIdentifier = (items: QdnSearchResource[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const identifier =
      typeof item.identifier === 'string' ? item.identifier : '';
    if (!identifier || seen.has(identifier)) {
      return false;
    }
    seen.add(identifier);
    return true;
  });
};

export const fetchSongs = async (options?: {
  limit?: number;
  offset?: number;
  publisher?: string;
}): Promise<SongSummary[]> => {
  const limit = options?.limit ?? 24;
  const offset = options?.offset ?? 0;
  const publisher = options?.publisher?.trim();

  const resources = await searchQdnResources({
    mode: 'ALL',
    service: 'AUDIO',
    query: SONG_PREFIX,
    ...(publisher ? { name: publisher, exactMatchNames: true } : {}),
    limit,
    offset,
    reverse: true,
    includeMetadata: true,
    includeStatus: true,
    excludeBlocked: true,
  });

  return uniqueByIdentifier(resources)
    .filter((resource) => {
      const identifier =
        typeof resource.identifier === 'string' ? resource.identifier : '';
      return (
        identifier.startsWith(SONG_PREFIX) && !shouldHideQdnResource(resource)
      );
    })
    .map(mapSongResource)
    .filter((item): item is SongSummary => Boolean(item));
};

export const fetchSongsByPublisher = async (
  publisher: string,
  options?: { limit?: number; offset?: number }
) => {
  return fetchSongs({
    ...options,
    publisher,
  });
};

export const fetchSongByIdentifier = async (
  publisher: string,
  identifier: string
): Promise<SongSummary | null> => {
  const resources = await searchQdnResources({
    mode: 'ALL',
    service: 'AUDIO',
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
  return resource ? mapSongResource(resource) : null;
};

export const resolveSongArtwork = async (
  publisher: string,
  identifier: string
): Promise<string | null> => {
  return getQdnResourceUrl('THUMBNAIL', publisher, identifier);
};

export const resolveSongStreamUrl = async (
  publisher: string,
  identifier: string,
  options?: {
    waitUntilReady?: boolean;
    onStatusChange?: (status: string, progress?: number) => void;
  }
): Promise<string | null> => {
  if (options?.waitUntilReady) {
    const audioStatus = await waitForQdnResourceReady({
      service: 'AUDIO',
      name: publisher,
      identifier,
      onStatusChange: (status) =>
        options.onStatusChange?.(status.status, status.percentLoaded),
    });

    if (isQdnResourceReady(audioStatus.status)) {
      return getQdnResourceUrl('AUDIO', publisher, identifier);
    }

    const documentStatus = await waitForQdnResourceReady({
      service: 'DOCUMENT',
      name: publisher,
      identifier,
      onStatusChange: (status) =>
        options.onStatusChange?.(status.status, status.percentLoaded),
    });

    if (isQdnResourceReady(documentStatus.status)) {
      return getQdnResourceUrl('DOCUMENT', publisher, identifier);
    }

    return null;
  }

  const audioUrl = await getQdnResourceUrl('AUDIO', publisher, identifier);
  if (audioUrl) return audioUrl;
  return getQdnResourceUrl('DOCUMENT', publisher, identifier);
};
