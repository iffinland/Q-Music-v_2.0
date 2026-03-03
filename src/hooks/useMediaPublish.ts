import { objectToBase64, useGlobal, usePublish } from 'qapp-core';
import { searchQdnResources } from '../services/qdn';
import type { PlaylistSongReference, SongSummary } from '../types/media';

export interface CoverCropSettings {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

interface PublishSongInput {
  title: string;
  artist: string;
  genre?: string;
  mood?: string;
  language?: string;
  notes?: string;
  audioFile: File;
  coverFile?: File | null;
  coverCrop?: CoverCropSettings;
  existingIdentifier?: string;
}

interface PublishPlaylistInput {
  title: string;
  description?: string;
  songs: PlaylistSongReference[];
  coverFile?: File | null;
  coverCrop?: CoverCropSettings;
  existingIdentifier?: string;
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
    ['genre', sanitizeText(input.genre || '')],
    ['mood', sanitizeText(input.mood || '')],
    ['language', sanitizeText(input.language || '')],
    ['notes', sanitizeText(input.notes || '')],
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

  const ensurePublisher = () => {
    const publisher = auth?.name?.trim();
    if (!publisher) {
      throw new Error('You must be logged in to publish.');
    }
    return publisher;
  };

  const publishWithVerification = async (params: {
    resources: Parameters<typeof publishMultipleResources>[0];
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

  const publishSong = async (input: PublishSongInput) => {
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
      genre: input.genre,
      mood: input.mood,
      language: input.language,
      notes: input.notes,
    });
    const extension = input.audioFile.name.split('.').pop() || 'audio';
    const filename = `${identifierSegment}.${extension}`;

    const resources: Parameters<typeof publishMultipleResources>[0] = [
      {
        name: publisher,
        service: 'AUDIO',
        identifier,
        title,
        description,
        file: input.audioFile,
        filename,
      },
    ];

    if (input.coverFile) {
      resources.push({
        name: publisher,
        service: 'THUMBNAIL',
        identifier,
        data64: await processCoverImage(input.coverFile, input.coverCrop),
      });
    }

    await publishWithVerification({
      resources,
      verifyService: 'AUDIO',
      publisher,
      identifier,
    });

    return {
      identifier,
      publisher,
      title,
      artist,
      description,
    };
  };

  const publishPlaylist = async (input: PublishPlaylistInput) => {
    const publisher = ensurePublisher();
    const title = sanitizeText(input.title);
    const description = sanitizeText(input.description || '');

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
      songs: input.songs,
    };

    const resources: Parameters<typeof publishMultipleResources>[0] = [
      {
        name: publisher,
        service: 'PLAYLIST',
        identifier,
        title,
        description,
        data64: await objectToBase64(payload),
      },
    ];

    if (input.coverFile) {
      resources.push({
        name: publisher,
        service: 'THUMBNAIL',
        identifier,
        data64: await processCoverImage(input.coverFile, input.coverCrop),
      });
    }

    await publishWithVerification({
      resources,
      verifyService: 'PLAYLIST',
      publisher,
      identifier,
    });

    return {
      identifier,
      publisher,
      title,
      description,
      songs: input.songs,
    };
  };

  return {
    publisher: auth?.name || null,
    publishSong,
    publishPlaylist,
  };
};
