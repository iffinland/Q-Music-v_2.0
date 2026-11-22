export const MAX_AUDIO_FILE_SIZE = 2000 * 1024 * 1024;
export const MAX_PUBLIC_AUDIO_FILE_SIZE = 500 * 1024 * 1024;
export const MAX_THUMBNAIL_SIZE = 500 * 1024;
export const MAX_COVER_PIXELS = 40_000_000;
export const MAX_JOB_FILE_BYTES = 4000 * 1024 * 1024;
export const MAX_JOB_FILES = 200;
export const MAX_SONG_METADATA_BYTES = 256 * 1024;
export const MAX_COVER_FILE_SIZE = 12 * 1024 * 1024;
export const COVER_SIZE = 1200;
export const MIN_CROP_ZOOM = 1;
export const MAX_CROP_ZOOM = 2.5;

export const AUDIO_INPUT_ACCEPT =
  'audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a,.opus,.webm,.aiff,.aif,.alac,.wma';
export const IMAGE_INPUT_ACCEPT = 'image/*';

export const FOLDER_AUDIO_EXTENSIONS = [
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
  'webm',
  'aif',
] as const;

export const FOLDER_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
] as const;

export const AUDIO_FORMATS_HELP = `Audio files: ${FOLDER_AUDIO_EXTENSIONS.map((extension) => extension.toUpperCase()).join(', ')}. Other files identified as audio may also be accepted for single-file publishing. Playback depends on your device and codec; audio is not converted.`;
export const COVER_FORMATS_HELP =
  'Cover images: JPG/JPEG, PNG, WebP, GIF or BMP that your device can open. Maximum 12 MiB and 40 megapixels. Covers are optional and are prepared as square JPEG images.';

export const AUDIO_LIMIT_TEXT =
  'Audio limits: 500 MiB on public nodes; 2000 MiB on your own node. Playback support depends on the browser and audio codec.';
export const COVER_LIMIT_TEXT =
  'Supported image files only. Maximum size: 12 MB.';
export const COVER_PROCESSING_TEXT =
  'Covers are cropped to square JPEG thumbnails, up to 1200x1200 and 500 KiB. Crop zoom range: 1x to 2.5x.';
export const PLAYLIST_LIMIT_TEXT =
  'Playlist publishing requires a title and at least one selected song.';
export const NEW_PLAYLIST_LIMIT_TEXT =
  'New playlist publishing requires a title, a short description, and at least one selected song.';
export const FOLDER_REQUIRED_TEXT =
  'Each imported song must include a title and artist before publishing.';
export const FOLDER_AUDIO_EXTENSIONS_TEXT = `Supported folder audio extensions: ${FOLDER_AUDIO_EXTENSIONS.join(', ')}.`;
export const FOLDER_IMAGE_EXTENSIONS_TEXT = `Supported folder cover extensions: ${FOLDER_IMAGE_EXTENSIONS.join(', ')}.`;
