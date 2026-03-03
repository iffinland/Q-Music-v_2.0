const LABEL_ORDER = ['title', 'author', 'genre', 'mood', 'language', 'notes'];

const LABELS: Record<string, string> = {
  title: 'TITLE',
  author: 'ARTIST',
  genre: 'GENRE',
  mood: 'MOOD',
  language: 'LANGUAGE',
  notes: 'NOTES',
};

export interface ParsedSongMetadata {
  title?: string;
  author?: string;
  genre?: string;
  mood?: string;
  language?: string;
  notes?: string;
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
  const lines = [
    `PUBLISHED @ ${params.publisher}`,
    `TITLE: ${parsed.title || params.title}`,
  ];

  LABEL_ORDER.forEach((key) => {
    const value = parsed[key as keyof ParsedSongMetadata];
    if (!value || key === 'title') {
      return;
    }

    lines.push(`${LABELS[key]}: ${value}`);
  });

  return lines.join('\n');
};
