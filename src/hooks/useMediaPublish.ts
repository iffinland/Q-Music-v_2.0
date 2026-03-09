import {
  objectToBase64,
  useAllResourceStatus,
  useGlobal,
  usePublish,
} from 'qapp-core';
import { searchQdnResources } from '../services/qdn';
import type { PlaylistSongReference, SongSummary } from '../types/media';

type ResourceToPublish =
  Parameters<ReturnType<typeof usePublish>['publishMultipleResources']>[0][number];

export interface CoverCropSettings {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface PublishSongInput {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  mood?: string;
  language?: string;
  notes?: string;
  publishedDate?: string;
  audioFile: File;
  coverFile?: File | null;
  coverCrop?: CoverCropSettings;
  existingIdentifier?: string;
}

export interface PublishPlaylistInput {
  title: string;
  description?: string;
  songs: PlaylistSongReference[];
  publishedDate?: string;
  coverFile?: File | null;
  coverCrop?: CoverCropSettings;
  existingIdentifier?: string;
}

export interface PreparedSongPublish {
  identifier: string;
  publisher: string;
  title: string;
  artist: string;
  album?: string;
  description: string;
  audioFile: File;
  coverFile?: File | null;
  coverCrop?: CoverCropSettings;
  audioResource: ResourceToPublish;
  thumbnailResource?: ResourceToPublish;
}

export interface PreparedPlaylistPublish {
  identifier: string;
  publisher: string;
  title: string;
  description: string;
  songs: PlaylistSongReference[];
  publishedDate?: string;
  coverFile?: File | null;
  coverCrop?: CoverCropSettings;
  playlistResource: ResourceToPublish;
  thumbnailResource?: ResourceToPublish;
}

const sanitizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024;
const MAX_COVER_FILE_SIZE = 12 * 1024 * 1024;
const COVER_SIZE = 1200;
const MIN_CROP_ZOOM = 1;
const MAX_CROP_ZOOM = 2.5;

const sanitizeTitleForIdentifier = (value: string) =>
  sanitizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const buildShortId = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const verifyResourcePublished = async (params: {
  service: 'AUDIO' | 'PLAYLIST';
  publisher: string;
  identifier: string;
}) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const resources = await searchQdnResources({
      mode: 'ALL',
      service: params.service,
      name: params.publisher,
      identifier: params.identifier,
      query: params.identifier,
      limit: 1,
      offset: 0,
      reverse: true,
      includeMetadata: false,
      includeStatus: true,
      excludeBlocked: true,
      exactMatchNames: true,
    });

    const found = resources.some(
      (resource) =>
        resource.identifier === params.identifier &&
        resource.name === params.publisher
    );

    if (found) {
      return true;
    }

    await wait(1_500);
  }

  return false;
};

const loadImageFromFile = async (file: File): Promise<HTMLImageElement> => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image could not be processed.'));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const processCoverImage = async (
  file: File,
  crop?: CoverCropSettings
): Promise<string> => {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = COVER_SIZE;
  canvas.height = COVER_SIZE;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Image processing is not available.');
  }

  const zoom = clamp(crop?.zoom ?? 1, MIN_CROP_ZOOM, MAX_CROP_ZOOM);
  const sourceSize = Math.max(1, Math.min(image.width, image.height) / zoom);
  const maxSourceX = Math.max(0, image.width - sourceSize);
  const maxSourceY = Math.max(0, image.height - sourceSize);
  const sourceX = clamp(
    maxSourceX / 2 + (crop?.offsetX ?? 0) * (maxSourceX / 2),
    0,
    maxSourceX
  );
  const sourceY = clamp(
    maxSourceY / 2 + (crop?.offsetY ?? 0) * (maxSourceY / 2),
    0,
    maxSourceY
  );

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    COVER_SIZE,
    COVER_SIZE
  );

  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
};

const validateAudioFile = (file: File) => {
  if (!file.type.startsWith('audio/')) {
    throw new Error('Selected file is not a supported audio file.');
  }

  if (file.size > MAX_AUDIO_FILE_SIZE) {
    throw new Error('Audio file is too large. Keep it below 100 MB.');
  }
};

const validateCoverFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Cover file must be an image.');
  }

  if (file.size > MAX_COVER_FILE_SIZE) {
    throw new Error('Cover image is too large. Keep it below 12 MB.');
  }
};

const buildSongDescription = (
  input: Omit<PublishSongInput, 'audioFile' | 'coverFile'>
) => {
  const entries = [
    ['title', sanitizeText(input.title)],
    ['author', sanitizeText(input.artist)],
    ['album', sanitizeText(input.album || '')],
    ['genre', sanitizeText(input.genre || '')],
    ['mood', sanitizeText(input.mood || '')],
    ['language', sanitizeText(input.language || '')],
    ['notes', sanitizeText(input.notes || '')],
    ['publishedDate', sanitizeText(input.publishedDate || '')],
  ].filter(([, value]) => value.length > 0);

  return entries.map(([key, value]) => `${key}=${value}`).join(';');
};

export const mapSongToPlaylistReference = (
  song: SongSummary
): PlaylistSongReference => ({
  identifier: song.identifier,
  publisher: song.publisher,
  title: song.title,
  artist: song.artist,
});

export const useMediaPublish = () => {
  const { auth } = useGlobal();
  const { publishMultipleResources } = usePublish();
  const resourceStatuses = useAllResourceStatus();

  const ensurePublisher = () => {
    const publisher = auth?.name?.trim();
    if (!publisher) {
      throw new Error('You must be logged in to publish.');
    }
    return publisher;
  };

  const publishWithVerification = async (params: {
    resources: ResourceToPublish[];
    verifyService: 'AUDIO' | 'PLAYLIST';
    publisher: string;
    identifier: string;
  }) => {
    try {
      const result = await publishMultipleResources(params.resources);
      if (result instanceof Error) {
        throw result;
      }
      return result;
    } catch (error) {
      const wasPublished = await verifyResourcePublished({
        service: params.verifyService,
        publisher: params.publisher,
        identifier: params.identifier,
      });

      if (wasPublished) {
        return [];
      }

      throw error;
    }
  };

  const buildSongPublish = async (input: PublishSongInput) => {
    const publisher = ensurePublisher();
    const title = sanitizeText(input.title);
    const artist = sanitizeText(input.artist);

    if (!title || !artist) {
      throw new Error('Title and artist are required.');
    }

    validateAudioFile(input.audioFile);
    if (input.coverFile) {
      validateCoverFile(input.coverFile);
    }

    const uniqueId = buildShortId();
    const identifierSegment =
      sanitizeTitleForIdentifier(title).slice(0, 20) || `song_${uniqueId}`;
    const identifier =
      input.existingIdentifier ||
      `enjoymusic_song_${identifierSegment}_${uniqueId}`;
    const description = buildSongDescription({
      title,
      artist,
      album: input.album,
      genre: input.genre,
      mood: input.mood,
      language: input.language,
      notes: input.notes,
      publishedDate: input.publishedDate,
    });
    const extension = input.audioFile.name.split('.').pop() || 'audio';
    const filename = `${identifierSegment}.${extension}`;

    const audioResource: ResourceToPublish = {
      name: publisher,
      service: 'AUDIO',
      identifier,
      title,
      description,
      file: input.audioFile,
      filename,
    };

    const thumbnailResource = input.coverFile
      ? ({
          name: publisher,
          service: 'THUMBNAIL',
          identifier,
          data64: await processCoverImage(input.coverFile, input.coverCrop),
        } as ResourceToPublish)
      : undefined;

    return {
      identifier,
      publisher,
      title,
      artist,
      album: sanitizeText(input.album || '') || undefined,
      description,
      audioFile: input.audioFile,
      coverFile: input.coverFile,
      coverCrop: input.coverCrop,
      audioResource,
      thumbnailResource,
    } satisfies PreparedSongPublish;
  };

  const buildPlaylistPublish = async (input: PublishPlaylistInput) => {
    const publisher = ensurePublisher();
    const title = sanitizeText(input.title);
    const description = sanitizeText(input.description || '');
    const publishedDate = sanitizeText(input.publishedDate || '');

    if (!title) {
      throw new Error('Playlist title is required.');
    }

    if (!input.songs.length) {
      throw new Error('Playlist must include at least one song.');
    }

    if (input.coverFile) {
      validateCoverFile(input.coverFile);
    }

    const uniqueId = buildShortId();
    const identifierSegment =
      sanitizeTitleForIdentifier(title).slice(0, 20) || `playlist_${uniqueId}`;
    const identifier =
      input.existingIdentifier ||
      `enjoymusic_playlist_${identifierSegment}_${uniqueId}`;

    const payload = {
      title,
      description,
      publishedDate: publishedDate || undefined,
      songs: input.songs,
    };

    const playlistResource: ResourceToPublish = {
      name: publisher,
      service: 'PLAYLIST',
      identifier,
      title,
      description,
      data64: await objectToBase64(payload),
    };

    const thumbnailResource = input.coverFile
      ? ({
          name: publisher,
          service: 'THUMBNAIL',
          identifier,
          data64: await processCoverImage(input.coverFile, input.coverCrop),
        } as ResourceToPublish)
      : undefined;

    return {
      identifier,
      publisher,
      title,
      description,
      songs: input.songs,
      publishedDate: publishedDate || undefined,
      coverFile: input.coverFile,
      coverCrop: input.coverCrop,
      playlistResource,
      thumbnailResource,
    } satisfies PreparedPlaylistPublish;
  };

  const publishResourceBatch = async (resources: ResourceToPublish[]) => {
    if (!resources.length) {
      return [];
    }

    const result = await publishMultipleResources(resources);
    if (result instanceof Error) {
      throw result;
    }

    return result;
  };

  const publishSong = async (input: PublishSongInput) => {
    const prepared = await buildSongPublish(input);
    const resources: ResourceToPublish[] = [prepared.audioResource];

    if (prepared.thumbnailResource) {
      resources.push(prepared.thumbnailResource);
    }

    await publishWithVerification({
      resources,
      verifyService: 'AUDIO',
      publisher: prepared.publisher,
      identifier: prepared.identifier,
    });

    return {
      identifier: prepared.identifier,
      publisher: prepared.publisher,
      title: prepared.title,
      artist: prepared.artist,
      album: prepared.album,
      description: prepared.description,
    };
  };

  const publishPlaylist = async (input: PublishPlaylistInput) => {
    const prepared = await buildPlaylistPublish(input);
    const resources: ResourceToPublish[] = [prepared.playlistResource];

    if (prepared.thumbnailResource) {
      resources.push(prepared.thumbnailResource);
    }

    await publishWithVerification({
      resources,
      verifyService: 'PLAYLIST',
      publisher: prepared.publisher,
      identifier: prepared.identifier,
    });

    return {
      identifier: prepared.identifier,
      publisher: prepared.publisher,
      title: prepared.title,
      description: prepared.description,
      songs: prepared.songs,
    };
  };

  const publishSongAudioBatch = async (songs: PreparedSongPublish[]) => {
    await publishResourceBatch(songs.map((song) => song.audioResource));
    return songs.map((song) => ({
      identifier: song.identifier,
      publisher: song.publisher,
      title: song.title,
      artist: song.artist,
      album: song.album,
      description: song.description,
    }));
  };

  const publishSongThumbnailBatch = async (songs: PreparedSongPublish[]) => {
    const resources = songs
      .map((song) => song.thumbnailResource)
      .filter((item): item is ResourceToPublish => Boolean(item));

    await publishResourceBatch(resources);
    return resources.length;
  };

  const publishPlaylistResourceBatch = async (
    playlist: PreparedPlaylistPublish
  ) => {
    await publishResourceBatch([playlist.playlistResource]);
    return {
      identifier: playlist.identifier,
      publisher: playlist.publisher,
      title: playlist.title,
      description: playlist.description,
      songs: playlist.songs,
    };
  };

  const publishPlaylistThumbnailBatch = async (
    playlist: PreparedPlaylistPublish
  ) => {
    if (!playlist.thumbnailResource) {
      return 0;
    }

    await publishResourceBatch([playlist.thumbnailResource]);
    return 1;
  };

  const getBatchStatuses = (identifiers: string[]) => {
    if (!identifiers.length) {
      return [];
    }

    const identifierSet = new Set(identifiers);
    return resourceStatuses.filter((status) =>
      identifierSet.has(status.metadata.identifier)
    );
  };

  return {
    publisher: auth?.name || null,
    buildSongPublish,
    buildPlaylistPublish,
    publishResourceBatch,
    publishSongAudioBatch,
    publishSongThumbnailBatch,
    publishPlaylistResourceBatch,
    publishPlaylistThumbnailBatch,
    getBatchStatuses,
    publishSong,
    publishPlaylist,
  };
};
