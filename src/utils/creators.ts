export const artistNameKey = (name: string) =>
  name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
export const creatorPath = (
  kind: 'artist' | 'publisher',
  name: string
): string | null => {
  const value = name.trim();
  if (!value || value.length > 512) return null;
  try {
    return `/${kind === 'artist' ? 'artists' : 'publishers'}/${encodeURIComponent(value)}`;
  } catch {
    return null;
  }
};
