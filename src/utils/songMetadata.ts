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

    const key = rawKey.trim().toLowerCase();
    const value = rawValueParts.join('=').trim();
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

    lines.push(`${LABELS[key]}: ${value}`);
  });

  return lines.join('\n');
};
