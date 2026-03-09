export interface ImportedSongMetadata {
  file?: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  language?: string;
  mood?: string;
  notes?: string;
  publishedDate?: string;
  cover?: string;
}

export interface FolderSongImportDraft {
  id: string;
  file: File;
  relativePath: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  language: string;
  mood: string;
  notes: string;
  publishedDate: string;
  coverFile: File | null;
  metadataSource?: string;
}

export interface FolderImportResult {
  songs: FolderSongImportDraft[];
  metadataFiles: string[];
  warnings: string[];
}

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'flac',
  'aac',
  'm4a',
  'opus',
  'aiff',
  'alac',
  'wma',
]);

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
]);

const normalizePath = (value: string) =>
  value.replace(/\\/g, '/').replace(/^\/+/, '').trim();

const getRelativePath = (file: File) =>
  normalizePath(
    'webkitRelativePath' in file && typeof file.webkitRelativePath === 'string'
      ? file.webkitRelativePath
      : file.name
  );

const getFileExtension = (name: string) => {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1]?.toLowerCase() || '' : '';
};

const getBaseName = (name: string) =>
  name.replace(/\.[^/.]+$/, '').trim().toLowerCase();

const sanitizeText = (value?: string) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const inferTitleFromFilename = (name: string) =>
  name
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripQuotes = (value: string) => {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    trimmed.startsWith('"') &&
    trimmed.endsWith('"')
  ) {
    return trimmed.slice(1, -1).replace(/""/g, '"').trim();
  }
  return trimmed;
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(stripQuotes(current));
      current = '';
      continue;
    }

    current += char;
  }

  values.push(stripQuotes(current));
  return values;
};

const parseCsvMetadata = (content: string): ImportedSongMetadata[] => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase()
  );

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<ImportedSongMetadata>((acc, header, index) => {
      const value = values[index];
      if (!value) {
        return acc;
      }

      acc[header as keyof ImportedSongMetadata] = value;
      return acc;
    }, {});
  });
};

const parseTxtMetadata = (content: string): ImportedSongMetadata[] => {
  const blocks = content
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) =>
      block.split(/\r?\n/).reduce<ImportedSongMetadata>((acc, line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
          return acc;
        }

        const key = line.slice(0, separatorIndex).trim().toLowerCase();
        const value = line.slice(separatorIndex + 1).trim();
        if (!key || !value) {
          return acc;
        }

        acc[key as keyof ImportedSongMetadata] = value;
        return acc;
      }, {})
    )
    .filter((item) => Object.keys(item).length > 0);
};

const buildMetadataLookup = (rows: ImportedSongMetadata[]) => {
  const byPath = new Map<string, ImportedSongMetadata>();
  const byName = new Map<string, ImportedSongMetadata>();
  const byBaseName = new Map<string, ImportedSongMetadata>();

  rows.forEach((row) => {
    const filePath = normalizePath(row.file || '');
    if (filePath) {
      byPath.set(filePath.toLowerCase(), row);
      const pathParts = filePath.split('/');
      byName.set(pathParts[pathParts.length - 1]?.toLowerCase() || '', row);
      byBaseName.set(getBaseName(filePath), row);
    }
  });

  return { byPath, byName, byBaseName };
};

const resolveMetadataForAudio = (
  file: File,
  lookup: ReturnType<typeof buildMetadataLookup>
) => {
  const relativePath = getRelativePath(file);
  const fileName = file.name.toLowerCase();
  const baseName = getBaseName(file.name);

  return (
    lookup.byPath.get(relativePath.toLowerCase()) ||
    lookup.byName.get(fileName) ||
    lookup.byBaseName.get(baseName)
  );
};

const resolveCoverFile = (
  metadata: ImportedSongMetadata | undefined,
  audioFile: File,
  imagesByPath: Map<string, File>,
  imagesByBaseName: Map<string, File>
) => {
  const requestedCover = normalizePath(metadata?.cover || '');
  if (requestedCover) {
    return (
      imagesByPath.get(requestedCover.toLowerCase()) ||
      imagesByPath.get(
        normalizePath(
          `${getRelativePath(audioFile).split('/').slice(0, -1).join('/')}/${requestedCover}`
        ).toLowerCase()
      ) ||
      null
    );
  }

  return imagesByBaseName.get(getBaseName(audioFile.name)) || null;
};

export const parseFolderSelection = async (
  inputFiles: File[],
  defaults?: {
    defaultArtist?: string;
    defaultGenre?: string;
  }
): Promise<FolderImportResult> => {
  const files = [...inputFiles];
  const audioFiles = files.filter((file) =>
    AUDIO_EXTENSIONS.has(getFileExtension(file.name))
  );
  const imageFiles = files.filter((file) =>
    IMAGE_EXTENSIONS.has(getFileExtension(file.name))
  );
  const metadataFiles = files.filter((file) => {
    const extension = getFileExtension(file.name);
    return extension === 'csv' || extension === 'txt';
  });

  const importedMetadataRows = (
    await Promise.all(
      metadataFiles.map(async (file) => {
        const content = await file.text();
        const extension = getFileExtension(file.name);
        return extension === 'csv'
          ? parseCsvMetadata(content)
          : parseTxtMetadata(content);
      })
    )
  ).flat();

  const metadataLookup = buildMetadataLookup(importedMetadataRows);
  const imagesByPath = new Map<string, File>();
  const imagesByBaseName = new Map<string, File>();

  imageFiles.forEach((file) => {
    imagesByPath.set(getRelativePath(file).toLowerCase(), file);
    imagesByBaseName.set(getBaseName(file.name), file);
  });

  const warnings: string[] = [];
  if (!audioFiles.length) {
    warnings.push('No supported audio files were found in the selected folder.');
  }

  return {
    songs: audioFiles.map((file, index) => {
      const metadata = resolveMetadataForAudio(file, metadataLookup);
      if (!metadata && importedMetadataRows.length > 0) {
        warnings.push(`No metadata row matched ${getRelativePath(file)}.`);
      }

      return {
        id: `${getRelativePath(file)}:${index}`,
        file,
        relativePath: getRelativePath(file),
        title: sanitizeText(metadata?.title) || inferTitleFromFilename(file.name),
        artist: sanitizeText(metadata?.artist) || defaults?.defaultArtist || '',
        album: sanitizeText(metadata?.album),
        genre: sanitizeText(metadata?.genre) || defaults?.defaultGenre || '',
        language: sanitizeText(metadata?.language),
        mood: sanitizeText(metadata?.mood),
        notes: sanitizeText(metadata?.notes),
        publishedDate: sanitizeText(metadata?.publishedDate),
        coverFile: resolveCoverFile(
          metadata,
          file,
          imagesByPath,
          imagesByBaseName
        ),
        metadataSource: metadata?.file ? sanitizeText(metadata.file) : undefined,
      };
    }),
    metadataFiles: metadataFiles.map((file) => getRelativePath(file)),
    warnings,
  };
};
