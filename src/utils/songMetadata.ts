const LABEL_ORDER = [
  'title',
  'author',
  'album',
  'genre',
  'mood',
  'language',
  'notes',
  'publishedDate',
];

const LABELS: Record<string, string> = {
  title: 'TITLE',
  author: 'ARTIST',
  album: 'ALBUM',
  genre: 'GENRE',
  mood: 'MOOD',
  language: 'LANGUAGE',
  notes: 'NOTES',
  publishedDate: 'PUBLISHED DATE',
};

const decodeMetadataValue = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const encodeSongMetadataValue = (value: string) =>
  encodeURIComponent(value.trim().replace(/\s+/g, ' '));

const truncateText = (value: string, maxLength?: number) => {
  if (!maxLength || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

export interface ParsedSongMetadata {
  title?: string;
  author?: string;
  album?: string;
  genre?: string;
  mood?: string;
  language?: string;
  notes?: string;
  publishedDate?: string;
}

export const parseSongMetadata = (description?: string): ParsedSongMetadata => {
  const parsed: ParsedSongMetadata = {};
  if (!description) {
    return parsed;
  }

  description.split(';').forEach((pair) => {
    const [rawKey, ...rawValueParts] = pair.split('=');
    if (!rawKey || rawValueParts.length === 0) {
      return;
    }

    const raw = rawKey.trim().toLowerCase();
    const key = raw === 'publisheddate' ? 'publishedDate' : raw;
    const value = decodeMetadataValue(rawValueParts.join('=').trim());
    if (!value || !(key in LABELS)) {
      return;
    }

    parsed[key as keyof ParsedSongMetadata] = value;
  });

  return parsed;
};

export const formatSongCardMetadata = (params: {
  title: string;
  publisher: string;
  description?: string;
  notesMaxLength?: number;
}) => {
  const parsed = parseSongMetadata(params.description);
  const publishedLine = parsed.publishedDate
    ? `PUBLISHED @ ${params.publisher} • ${parsed.publishedDate}`
    : `PUBLISHED @ ${params.publisher}`;
  const lines = [publishedLine, `TITLE: ${parsed.title || params.title}`];

  LABEL_ORDER.forEach((key) => {
    const value = parsed[key as keyof ParsedSongMetadata];
    if (!value || key === 'title') {
      return;
    }

    lines.push(
      `${LABELS[key]}: ${
        key === 'notes' ? truncateText(value, params.notesMaxLength) : value
      }`
    );
  });

  return lines.join('\n');
};
