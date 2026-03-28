export const MAX_AUDIO_FILE_SIZE = 2 * 1024 * 1024 * 1024;
export const MAX_COVER_FILE_SIZE = 12 * 1024 * 1024;
export const COVER_SIZE = 1200;
export const MIN_CROP_ZOOM = 1;
export const MAX_CROP_ZOOM = 2.5;

export const AUDIO_INPUT_ACCEPT = 'audio/*';
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
] as const;

export const FOLDER_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
] as const;

export const AUDIO_LIMIT_TEXT = 'Supported audio files only. Maximum size: 2 GB.';
export const COVER_LIMIT_TEXT =
  'Supported image files only. Maximum size: 12 MB.';
export const COVER_PROCESSING_TEXT =
  'Cover images are published as square 1200x1200 JPEG thumbnails. Crop zoom range: 1x to 2.5x.';
export const PLAYLIST_LIMIT_TEXT =
  'Playlist publishing requires a title and at least one selected song.';
export const NEW_PLAYLIST_LIMIT_TEXT =
  'New playlist publishing requires a title, a short description, and at least one selected song.';
export const FOLDER_REQUIRED_TEXT =
  'Each imported song must include a title and artist before publishing.';
export const FOLDER_AUDIO_EXTENSIONS_TEXT = `Supported folder audio extensions: ${FOLDER_AUDIO_EXTENSIONS.join(', ')}.`;
export const FOLDER_IMAGE_EXTENSIONS_TEXT = `Supported folder cover extensions: ${FOLDER_IMAGE_EXTENSIONS.join(', ')}.`;
