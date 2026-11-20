import { fetchQdnResource, findExactQdnResource } from './qdn';
import type { ReadOptions } from './qdnRequests';
import type { SongSummary } from '../types/media';
import { type ParsedSongMetadata } from '../utils/songMetadata';
import { limitUtf8, utf8Bytes, hashBytes } from './publishing/content';
import { MAX_SONG_METADATA_BYTES } from '../utils/publishLimits';

export const songMetadataIdentifier = (identifier: string) =>
  utf8Bytes(`qmusic_meta_${identifier}`).length <= 64
    ? `qmusic_meta_${identifier}`
    : `qmusic_meta_${hashBytes(utf8Bytes(identifier)).slice(0, 48)}`;
export interface SongDocument {
  schema: 'qmusic.song.v2';
  publisher: string;
  identifier: string;
  revision: string;
  fields: ParsedSongMetadata;
  audio: { sha256: string; bytes: number; filename: string; mimeType: string };
}
export const encodeFullSongDescription = (fields: ParsedSongMetadata) =>
  Object.entries(fields)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => `${key}=${encodeURIComponent(value!)}`)
    .join(';');
export const metadataRevision = (description?: string) =>
  description?.match(/(?:^|;)rev=([a-zA-Z0-9]+)/)?.[1];
const descriptors = new Map<string, SongDocument>();
const key = (publisher: string, identifier: string, revision: string) =>
  `${publisher.toLowerCase()}:${identifier}:${revision}`;
export const rememberSongDocument = (document: SongDocument) => {
  if (descriptors.size >= 128)
    descriptors.delete(descriptors.keys().next().value!);
  descriptors.set(
    key(document.publisher, document.identifier, document.revision),
    document
  );
};
export const enrichKnownSong = (song: SongSummary): SongSummary => {
  const doc = song.metadataRevision
    ? descriptors.get(
        key(song.publisher, song.identifier, song.metadataRevision)
      )
    : undefined;
  if (!doc) return song;
  return {
    ...song,
    ...doc.fields,
    title: doc.fields.title || song.title,
    artist: doc.fields.author || song.artist,
    description: encodeFullSongDescription(doc.fields),
  };
};
export const compactSongDescription = (
  fields: ParsedSongMetadata,
  revision: string
) => {
  let description = `v=2;rev=${revision}`;
  const budgets: [keyof ParsedSongMetadata, number][] = [
    ['author', 70],
    ['publishedDate', 30],
    ['genre', 30],
    ['language', 20],
    ['album', 35],
    ['mood', 20],
  ];
  for (const [field, budget] of budgets) {
    const raw = fields[field];
    if (!raw) continue;
    const remaining = 240 - utf8Bytes(description + `;${field}=`).length;
    if (remaining < 1) continue;
    let encoded = '';
    for (const char of raw) {
      const next = encodeURIComponent(char);
      if (encoded.length + next.length > Math.min(budget, remaining)) break;
      encoded += next;
    }
    if (encoded) description += `;${field}=${encoded}`;
  }
  return description;
};
export const loadSongDocument = async (
  song: SongSummary,
  options: ReadOptions = {}
): Promise<SongSummary> => {
  if (!song.metadataRevision) return song;
  const known = descriptors.get(
    key(song.publisher, song.identifier, song.metadataRevision)
  );
  if (known) return enrichKnownSong(song);
  const identifier = songMetadataIdentifier(song.identifier);
  const resource = await findExactQdnResource(
    'DOCUMENT',
    song.publisher,
    identifier,
    options
  );
  if (!resource || (resource.size && resource.size > MAX_SONG_METADATA_BYTES))
    throw new Error(
      'Full song details are not available yet. Please retry before editing.'
    );
  const doc = await fetchQdnResource<SongDocument>(
    { service: 'DOCUMENT', name: song.publisher, identifier },
    options
  );
  if (
    !doc ||
    doc.schema !== 'qmusic.song.v2' ||
    doc.identifier !== song.identifier ||
    doc.publisher?.toLowerCase() !== song.publisher.toLowerCase() ||
    doc.revision !== song.metadataRevision ||
    !doc.fields ||
    typeof doc.fields !== 'object'
  )
    throw new Error(
      'Full song details are still propagating. Please retry before editing.'
    );
  const allowed = [
    'title',
    'author',
    'album',
    'genre',
    'mood',
    'language',
    'notes',
    'publishedDate',
  ];
  if (
    Object.entries(doc.fields).some(
      ([field, value]) => !allowed.includes(field) || typeof value !== 'string'
    )
  )
    throw new Error('The full song metadata is invalid.');
  rememberSongDocument(doc);
  return enrichKnownSong(song);
};
export const indexedSongTitle = (title: string) => limitUtf8(title, 80);
