import {
  getQdnResourceProperties,
  getQdnResourceStatus,
  getQdnResourceUrl,
  type QdnResourceStatus,
  searchQdnResources,
  shouldTriggerQdnBuild,
  shouldHideQdnResource,
} from './qdn';
import type { QdnSearchResource, SongSummary } from '../types/media';
import { buildTitleFromIdentifier } from '../utils/mediaTitles';

const SONG_PREFIX = 'enjoymusic_song_';
const URL_RETRY_COUNT = 2;
const URL_RETRY_DELAY_MS = 800;
const STREAM_RESOLVE_TIMEOUT_MS = 45_000;
const STATUS_POLL_INTERVAL_MS = 1_500;

const descriptionCache = new Map<string, Record<string, string>>();

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

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

const decodeBase64ToBytes = (value: string) => {
  const normalized = value.includes(',') ? value.split(',').pop() || '' : value;
  const binary = window.atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
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

const primeResourceUrlResolution = async (
  service: 'AUDIO' | 'DOCUMENT',
  publisher: string,
  identifier: string
) => {
  await getQdnResourceProperties({
    service,
    name: publisher,
    identifier,
  });
};

const resolvePlayableResourceUrl = async (
  service: 'AUDIO' | 'DOCUMENT',
  publisher: string,
  identifier: string
) => {
  await primeResourceUrlResolution(service, publisher, identifier);

  return getQdnResourceUrl(service, publisher, identifier, {
    retries: URL_RETRY_COUNT,
    retryDelayMs: URL_RETRY_DELAY_MS,
  });
};

const resolveStreamUrlForService = async (
  service: 'AUDIO' | 'DOCUMENT',
  publisher: string,
  identifier: string,
  onStatusChange?: (status: string, progress?: number) => void
) => {
  const startedAt = Date.now();
  let buildTriggered = false;

  while (Date.now() - startedAt <= STREAM_RESOLVE_TIMEOUT_MS) {
    let latestStatus: QdnResourceStatus | null = null;

    try {
      latestStatus = await getQdnResourceStatus({
        service,
        name: publisher,
        identifier,
      });
      onStatusChange?.(latestStatus.status, latestStatus.percentLoaded);

      if (!buildTriggered && shouldTriggerQdnBuild(latestStatus.status)) {
        buildTriggered = true;
        latestStatus = await getQdnResourceStatus({
          service,
          name: publisher,
          identifier,
          build: true,
        });
        onStatusChange?.(latestStatus.status, latestStatus.percentLoaded);
      }
    } catch {
      // Ignore transient status polling failures and keep trying URL resolution.
    }

    const nextUrl = await resolvePlayableResourceUrl(
      service,
      publisher,
      identifier
    );
    if (nextUrl) {
      return nextUrl;
    }

    const normalizedStatus = latestStatus?.status?.trim().toUpperCase() || '';
    if (
      normalizedStatus === 'UNSUPPORTED' ||
      normalizedStatus === 'BLOCKED' ||
      normalizedStatus === 'NOT_PUBLISHED' ||
      normalizedStatus === 'MISSING_DATA'
    ) {
      return null;
    }

    await sleep(STATUS_POLL_INTERVAL_MS);
  }

  return null;
};

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
      if (
        key !== 'title' &&
        key !== 'author' &&
        key !== 'album' &&
        key !== 'publishedDate'
      )
        return;
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
  const resourceTitle =
    typeof resource.title === 'string' ? resource.title.trim() : '';

  return {
    id: identifier,
    identifier,
    publisher,
    title:
      metadataTitle ||
      resourceTitle ||
      parsedDescription.title ||
      buildTitleFromIdentifier(identifier, SONG_PREFIX),
    artist: parsedDescription.author || publisher,
    album: parsedDescription.album,
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

export const loadExistingSongAudioFile = async (params: {
  publisher: string;
  identifier: string;
  onStatusChange?: (status: string) => void;
}) => {
  params.onStatusChange?.('Looking up the current QDN audio file...');

  const properties = await getQdnResourceProperties({
    name: params.publisher,
    service: 'AUDIO',
    identifier: params.identifier,
  });
  const resourceFilename =
    (typeof properties?.filename === 'string' && properties.filename.trim()) ||
    (typeof properties?.fileName === 'string' && properties.fileName.trim()) ||
    (typeof properties?.name === 'string' && properties.name.trim()) ||
    undefined;

  if (typeof qortalRequest === 'function') {
    for (const service of ['AUDIO', 'DOCUMENT'] as const) {
      try {
        params.onStatusChange?.(
          service === 'AUDIO'
            ? 'Reusing the current QDN audio file...'
            : 'Retrying with the alternate QDN resource source...'
        );

        const result = await qortalRequest({
          action: 'FETCH_QDN_RESOURCE',
          service,
          name: params.publisher,
          identifier: params.identifier,
          encoding: 'base64',
        } as never);

        if (typeof result !== 'string' || !result.trim()) {
          continue;
        }

        const mimeType = inferAudioMimeType(resourceFilename);
        return new File(
          [decodeBase64ToBytes(result)],
          resolveAudioFilename(params.identifier, resourceFilename, mimeType),
          { type: mimeType }
        );
      } catch {
        // Fall through to the next recovery path.
      }
    }
  }

  params.onStatusChange?.(
    'Waiting for the current QDN audio file to become available...'
  );
  const streamUrl = await resolveSongStreamUrl(
    params.publisher,
    params.identifier,
    {
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
  const response = await fetch(streamUrl);
  if (!response.ok) {
    throw new Error(
      'The current audio file could not be reused for this edit. Select a replacement audio file to save changes.'
    );
  }

  const blob = await response.blob();
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
  options?: {
    waitUntilReady?: boolean;
    onStatusChange?: (status: string, progress?: number) => void;
  }
): Promise<string | null> => {
  if (options?.waitUntilReady) {
    const audioUrl = await resolveStreamUrlForService(
      'AUDIO',
      publisher,
      identifier,
      options.onStatusChange
    );
    if (audioUrl) {
      return audioUrl;
    }

    return resolveStreamUrlForService(
      'DOCUMENT',
      publisher,
      identifier,
      options.onStatusChange
    );
  }

  const audioUrl = await getQdnResourceUrl('AUDIO', publisher, identifier);
  if (audioUrl) return audioUrl;
  return getQdnResourceUrl('DOCUMENT', publisher, identifier);
};
