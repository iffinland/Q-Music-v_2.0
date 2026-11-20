import { throwIfAborted } from '../services/qdnRequests';
import { useGlobal } from '../qortal';
import { useRef } from 'react';
import type { PlaylistSongReference, SongSummary } from '../types/media';
import {
  assertCanStartJob,
  createPublishJob,
  runPublishJob,
} from '../services/publishing/engine';
import type { PublishResource } from '../services/publishing/types';
import {
  hashBlob,
  jsonBase64,
  utf8Bytes,
  limitUtf8,
  randomPublishId,
} from '../services/publishing/content';
import {
  audioMime,
  getPublishNodeLimit,
  validateAudio,
  validateCover,
} from '../services/publishing/limits';
import { processCoverImage } from '../services/publishing/covers';
import {
  compactSongDescription,
  encodeFullSongDescription,
  indexedSongTitle,
  songMetadataIdentifier,
  type SongDocument,
} from '../services/songDescriptors';
import { MAX_SONG_METADATA_BYTES } from '../utils/publishLimits';

export interface CoverCropSettings {
  zoom: number;
  offsetX: number;
  offsetY: number;
}
export interface PublishSongInput {
  signal?: AbortSignal;
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
  audioResource: PublishResource;
  metadataResource: PublishResource;
  thumbnailResource?: PublishResource;
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
  playlistResource: PublishResource;
  thumbnailResource?: PublishResource;
}
const text = (value: string) => value.trim().replace(/\s+/g, ' ');
const segment = (title: string) =>
  text(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'audio';
const id = () => randomPublishId().slice(0, 16);
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
  const limitPromise = useRef<Promise<number> | null>(null);
  const ensurePublisher = () => {
    const publisher = auth?.name?.trim();
    if (!publisher) throw new Error('Log in through Qortal before publishing.');
    assertCanStartJob(publisher);
    return publisher;
  };
  const buildSongPublish = async (
    input: PublishSongInput
  ): Promise<PreparedSongPublish> => {
    const publisher = ensurePublisher(),
      title = text(input.title),
      artist = text(input.artist);
    if (!title || !artist) throw new Error('Title and artist are required.');
    if (!limitPromise.current) limitPromise.current = getPublishNodeLimit();
    validateAudio(input.audioFile, await limitPromise.current);
    if (input.coverFile) validateCover(input.coverFile);
    const identifier =
      input.existingIdentifier ||
      `enjoymusic_song_${segment(title)}_${id().slice(0, 8)}`;
    const revision = id();
    const fields = {
      title,
      author: artist,
      album: text(input.album || ''),
      genre: text(input.genre || ''),
      mood: text(input.mood || ''),
      language: text(input.language || ''),
      notes: input.notes?.trim() || '',
      publishedDate: text(input.publishedDate || ''),
    };
    if (
      utf8Bytes(JSON.stringify(fields)).length >
      MAX_SONG_METADATA_BYTES - 4096
    )
      throw new Error(
        'Song details are too long. Shorten the notes before publishing.'
      );
    const filename = `${segment(title)}.${input.audioFile.name.split('.').pop()?.toLowerCase() || 'audio'}`;
    const document: SongDocument = {
      schema: 'qmusic.song.v2',
      publisher,
      identifier,
      revision,
      fields,
      audio: {
        sha256: await hashBlob(input.audioFile, input.signal),
        bytes: input.audioFile.size,
        filename,
        mimeType: input.audioFile.type || audioMime(input.audioFile.name),
      },
    };
    if (utf8Bytes(JSON.stringify(document)).length > MAX_SONG_METADATA_BYTES)
      throw new Error(
        'Song details exceed 256 KiB. Shorten the notes before publishing.'
      );
    const audioResource: PublishResource = {
      name: publisher,
      service: 'AUDIO',
      identifier,
      title: indexedSongTitle(title),
      description: compactSongDescription(fields, revision),
      file: input.audioFile,
      filename,
      stage: 0,
    };
    const metadataResource: PublishResource = {
      name: publisher,
      service: 'DOCUMENT',
      identifier: songMetadataIdentifier(identifier),
      title: 'Q-Music song details',
      description: `Full metadata for ${identifier}`,
      data64: jsonBase64(document),
      stage: 1,
    };
    const thumbnailResource: PublishResource | undefined = input.coverFile
      ? {
          name: publisher,
          service: 'THUMBNAIL',
          identifier,
          data64: await processCoverImage(input.coverFile, input.coverCrop),
          stage: 2,
        }
      : undefined;
    return {
      identifier,
      publisher,
      title,
      artist,
      album: fields.album || undefined,
      description: encodeFullSongDescription(fields),
      audioFile: input.audioFile,
      coverFile: input.coverFile,
      coverCrop: input.coverCrop,
      audioResource,
      metadataResource,
      thumbnailResource,
    };
  };
  const buildPlaylistPublish = async (
    input: PublishPlaylistInput
  ): Promise<PreparedPlaylistPublish> => {
    const publisher = ensurePublisher(),
      title = text(input.title),
      description = input.description?.trim() || '';
    if (!title || !input.songs.length)
      throw new Error('A playlist needs a title and at least one song.');
    if (input.songs.some((song) => !song.publisher || !song.identifier))
      throw new Error('A playlist song reference is invalid.');
    const identifier =
      input.existingIdentifier ||
      `enjoymusic_playlist_${segment(title)}_${id().slice(0, 8)}`;
    const payload = {
      title,
      description,
      publishedDate: input.publishedDate || undefined,
      songs: input.songs,
    };
    if (utf8Bytes(JSON.stringify(payload)).length > 1024 * 1024)
      throw new Error(
        'Split this playlist into smaller playlists (maximum 1 MiB of playlist details).'
      );
    const playlistResource: PublishResource = {
      name: publisher,
      service: 'PLAYLIST',
      identifier,
      title: indexedSongTitle(title),
      description: limitUtf8(description, 240),
      data64: jsonBase64(payload),
      stage: 3,
    };
    const thumbnailResource: PublishResource | undefined = input.coverFile
      ? {
          name: publisher,
          service: 'THUMBNAIL',
          identifier,
          data64: await processCoverImage(input.coverFile, input.coverCrop),
          stage: 4,
        }
      : undefined;
    return {
      identifier,
      publisher,
      title,
      description,
      songs: input.songs,
      publishedDate: input.publishedDate,
      coverFile: input.coverFile,
      coverCrop: input.coverCrop,
      playlistResource,
      thumbnailResource,
    };
  };
  const publishResourceBatch = async (
    resources: PublishResource[],
    title = 'Q-Music publish'
  ) => {
    ensurePublisher();
    const job = await createPublishJob(title, resources);
    return runPublishJob(job.id);
  };
  const publishSong = async (input: PublishSongInput) => {
    throwIfAborted(input.signal);
    const prepared = await buildSongPublish(input);
    throwIfAborted(input.signal);
    const resources = [
      prepared.audioResource,
      prepared.metadataResource,
      ...(prepared.thumbnailResource ? [prepared.thumbnailResource] : []),
    ];
    const outcome = await publishResourceBatch(
      resources,
      `Song: ${prepared.title}`
    );
    return {
      identifier: prepared.identifier,
      publisher: prepared.publisher,
      title: prepared.title,
      artist: prepared.artist,
      album: prepared.album,
      description: prepared.description,
      outcome,
    };
  };
  const publishPlaylist = async (input: PublishPlaylistInput) => {
    const prepared = await buildPlaylistPublish(input);
    const outcome = await publishResourceBatch(
      [
        prepared.playlistResource,
        ...(prepared.thumbnailResource ? [prepared.thumbnailResource] : []),
      ],
      `Playlist: ${prepared.title}`
    );
    return {
      identifier: prepared.identifier,
      publisher: prepared.publisher,
      title: prepared.title,
      description: prepared.description,
      songs: prepared.songs,
      outcome,
    };
  };
  return {
    publisher: auth?.name || null,
    buildSongPublish,
    buildPlaylistPublish,
    publishResourceBatch,
    publishSong,
    publishPlaylist,
  };
};
