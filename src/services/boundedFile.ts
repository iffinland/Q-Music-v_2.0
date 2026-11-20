import { throwIfAborted } from './qdnRequests';
export const MAX_AUTOMATIC_AUDIO_REUSE_BYTES = 64 * 1024 * 1024;
export const readBoundedAudio = async (
  response: Response,
  signal: AbortSignal,
  max = MAX_AUTOMATIC_AUDIO_REUSE_BYTES
): Promise<Blob> => {
  if (!response.ok || response.status === 206) {
    await response.body?.cancel();
    throw new Error(
      'A complete audio file could not be read. Choose the original audio file from your device.'
    );
  }
  const declared = Number(response.headers.get('content-length'));
  if (declared > max) {
    await response.body?.cancel();
    throw new Error(
      'Automatic audio reuse is limited to 64 MiB to protect device memory. Select the original audio file from your device to edit a larger song.'
    );
  }
  if (!response.body)
    throw new Error(
      'Streaming file reads are unavailable. Select the original audio file from your device.'
    );
  const reader = response.body.getReader(),
    parts: BlobPart[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      throwIfAborted(signal);
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > max)
        throw new Error(
          'Automatic audio reuse exceeds the device memory limit. Select the original audio file from your device.'
        );
      parts.push(new Uint8Array(next.value).buffer);
    }
    throwIfAborted(signal);
    if (!size || (declared > 0 && size !== declared))
      throw new Error(
        'The audio file is empty or incomplete. Retry or select the original file from your device.'
      );
    return new Blob(parts, {
      type: response.headers.get('content-type') || '',
    });
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
};
