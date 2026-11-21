export const SONG_PREFIXES = ['enjoymusic_song_', 'earbump_song_'] as const;
export const PLAYLIST_PREFIXES = [
  'enjoymusic_playlist_',
  'earbump_playlist_',
] as const;
export const isEarBumpIdentifier = (identifier?: string) =>
  Boolean(
    identifier &&
      ['earbump_song_', 'earbump_playlist_'].some(
        (prefix) =>
          identifier.startsWith(prefix) && identifier.length > prefix.length
      )
  );
export const publicationOrigin = (
  identifier?: string
): 'Ear-Bump' | 'Q-Music' | undefined => {
  if (isEarBumpIdentifier(identifier)) return 'Ear-Bump';
  if (
    identifier &&
    ['enjoymusic_song_', 'enjoymusic_playlist_'].some(
      (prefix) =>
        identifier.startsWith(prefix) && identifier.length > prefix.length
    )
  )
    return 'Q-Music';
  return undefined;
};
export const matchingMediaPrefix = (
  identifier: string,
  kind: 'song' | 'playlist'
) =>
  (kind === 'song' ? SONG_PREFIXES : PLAYLIST_PREFIXES).find((prefix) =>
    identifier.startsWith(prefix)
  ) || '';
// Ear-Bump embeds raster covers in playlist JSON. Never load arbitrary remote
// URLs or SVG/HTML from that field; keep list cards independent of payload reads.
export const safeEarBumpImage = (value: unknown): string | undefined =>
  typeof value === 'string' &&
  value.length <= 2 * 1024 * 1024 &&
  /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value)
    ? value
    : undefined;
