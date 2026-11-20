import { getQdnResourceProperties } from '../services/qdn';

const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/x-flac': 'flac',
  'audio/x-m4a': 'm4a',
  'audio/x-mpeg': 'mp3',
  'audio/x-ms-wma': 'wma',
  'audio/x-wav': 'wav',
};

const sanitizeFilenameSegment = (value: string) =>
  value
    .trim()
    // Strip control characters from filesystem names as well as reserved punctuation.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 120);

const getFilenameExtension = (filename: string) => {
  const cleanName = filename.trim().split('?')[0].split('#')[0];
  const dotIndex = cleanName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === cleanName.length - 1) {
    return '';
  }

  return cleanName.slice(dotIndex + 1).toLowerCase();
};

const hasExtension = (filename: string) =>
  Boolean(getFilenameExtension(filename));

const extractFilenameFromUrl = (resourceUrl: string) => {
  try {
    const url = new URL(resourceUrl, window.location.href);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    return lastSegment ? decodeURIComponent(lastSegment) : '';
  } catch {
    return '';
  }
};

const resolveExtensionFromMimeType = (mimeType: string) => {
  const normalizedMime = mimeType.trim().toLowerCase().split(';')[0];
  return AUDIO_EXTENSION_BY_MIME[normalizedMime] || '';
};

const pickFirstString = (
  source: Record<string, unknown> | null,
  keys: string[]
) => {
  if (!source) return '';

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const buildDownloadFilename = (params: {
  title: string;
  identifier: string;
  resourceUrl: string;
  properties: Record<string, unknown> | null;
  mimeType: string;
}) => {
  const propertyFilename = pickFirstString(params.properties, [
    'filename',
    'fileName',
    'name',
    'filepath',
    'filePath',
    'path',
  ]);
  const urlFilename = extractFilenameFromUrl(params.resourceUrl);
  const candidateFilename = sanitizeFilenameSegment(
    propertyFilename || urlFilename || params.title || params.identifier
  );
  const mimeExtension = resolveExtensionFromMimeType(params.mimeType);
  const existingExtension = getFilenameExtension(candidateFilename);

  if (existingExtension) {
    return candidateFilename;
  }

  const fallbackExtension =
    mimeExtension || getFilenameExtension(urlFilename) || 'audio';
  return `${candidateFilename}.${fallbackExtension}`;
};

export const downloadQdnAudioResource = async (params: {
  publisher: string;
  identifier: string;
  title: string;
  resourceUrl: string;
  signal?: AbortSignal;
}) => {
  const controller = new AbortController(),
    abort = () => controller.abort();
  params.signal?.addEventListener('abort', abort, { once: true });
  if (params.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 8000);
  let properties: Record<string, unknown> | null = null;
  try {
    properties = await getQdnResourceProperties(
      {
        name: params.publisher,
        service: 'AUDIO',
        identifier: params.identifier,
      },
      { signal: controller.signal, priority: 'background' }
    );
  } catch {
    /* Missing optional filename information must not buffer the audio. */
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', abort);
  }
  if (params.signal?.aborted)
    throw new DOMException('Download cancelled.', 'AbortError');
  const url = new URL(params.resourceUrl, window.location.href);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('The audio download URL is invalid.');
  const filename = buildDownloadFilename({
    ...params,
    properties,
    mimeType: pickFirstString(properties, ['mimeType', 'mimetype', 'type']),
  });
  // Core's attachment endpoint sets Content-Disposition. The browser/Hub streams
  // it to its download handler; Q-Music never fetches or retains the full audio.
  url.searchParams.delete('async');
  url.searchParams.set('attachment', 'true');
  if (filename && hasExtension(filename))
    url.searchParams.set('attachmentFilename', filename);
  const anchor = document.createElement('a');
  anchor.href = url.href;
  anchor.download = filename;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return filename;
};
