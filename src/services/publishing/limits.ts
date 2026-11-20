import {
  FOLDER_AUDIO_EXTENSIONS,
  MAX_AUDIO_FILE_SIZE,
  MAX_COVER_FILE_SIZE,
  MAX_PUBLIC_AUDIO_FILE_SIZE,
  FOLDER_IMAGE_EXTENSIONS,
} from '../../utils/publishLimits';
import { requestError } from '../qdnRequests';

export const audioMime = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const types: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    opus: 'audio/ogg',
    webm: 'audio/webm',
    aiff: 'audio/aiff',
    aif: 'audio/aiff',
    alac: 'audio/mp4',
    wma: 'audio/x-ms-wma',
  };
  return types[ext] || '';
};
export const validateAudio = (file: File, maxBytes = MAX_AUDIO_FILE_SIZE) => {
  const ext = file.name.trim().split('.').pop()?.toLowerCase() || '';
  if (!file.size) throw new Error('The selected audio file is empty.');
  if (
    !file.type.startsWith('audio/') &&
    !(FOLDER_AUDIO_EXTENSIONS as readonly string[]).includes(ext)
  )
    throw new Error('Select a supported audio file.');
  if (file.size > maxBytes)
    throw new Error(
      `Audio exceeds this node's ${Math.floor(maxBytes / 1024 / 1024)} MiB limit.`
    );
};
export const validateCover = (file: File) => {
  const ext = file.name.trim().split('.').pop()?.toLowerCase() || '';
  if (
    !file.size ||
    (!file.type.startsWith('image/') &&
      !(FOLDER_IMAGE_EXTENSIONS as readonly string[]).includes(ext))
  )
    throw new Error('Select a supported cover image.');
  if (file.size > MAX_COVER_FILE_SIZE)
    throw new Error('Cover image exceeds 12 MiB.');
};
export const getPublishNodeLimit = async () => {
  try {
    const result = await qortalRequest({
      action: 'IS_USING_PUBLIC_NODE',
    } as never);
    if (typeof result !== 'boolean') throw new Error(requestError(result));
    return result ? MAX_PUBLIC_AUDIO_FILE_SIZE : MAX_AUDIO_FILE_SIZE;
  } catch {
    // Do not promise the larger limit when the hosting environment cannot be established.
    return MAX_PUBLIC_AUDIO_FILE_SIZE;
  }
};
