import {
  getQdnResourceUrl,
  isQdnResourceReady,
  waitForQdnResourceReady,
} from './qdn';
import { abortError, delay, throwIfAborted } from './qdnRequests';

export const AUDIO_LOAD_ERROR =
  'Audio could not be loaded from the current node. Please retry shortly or try another song.';
export interface AudioRecoveryOptions {
  signal: AbortSignal;
  attempt: number;
  timeoutMs: number;
  onStatus: (label: string) => void;
}

// Only used after an initial browser/media failure. Normal playback retains its
// direct URL path; catalog cards never trigger audio readiness polling.
export const prepareAudioRecovery = async (
  publisher: string,
  identifier: string,
  options: AudioRecoveryOptions
): Promise<string> => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal.addEventListener('abort', abort, { once: true });
  if (options.signal.aborted) controller.abort();
  const deadline = Date.now() + options.timeoutMs;
  let deadlineExpired = false;
  const timer = setTimeout(() => {
    deadlineExpired = true;
    controller.abort();
  }, options.timeoutMs);
  try {
    throwIfAborted(controller.signal);
    // Do not hammer a still-cold resource or immediately reuse a failed response.
    await delay(options.attempt === 1 ? 1500 : 3000, controller.signal);
    const status = await waitForQdnResourceReady({
      name: publisher,
      service: 'AUDIO',
      identifier,
      signal: controller.signal,
      priority: 'playback',
      timeoutMs: Math.max(1, deadline - Date.now()),
      pollIntervalMs: 2000,
      onStatusChange: (value) => {
        const progress = value.percentLoaded;
        options.onStatus(
          value.status === 'READY'
            ? 'Audio ready. Retrying playback…'
            : value.status === 'DOWNLOADING' ||
                value.status === 'DOWNLOADED' ||
                value.status === 'BUILDING' ||
                value.status === 'PUBLISHED' ||
                value.status === 'MISSING_DATA'
              ? `Preparing audio on this node${typeof progress === 'number' && Number.isFinite(progress) ? ` (${Math.round(Math.max(0, Math.min(100, progress)))}%)` : ''}…`
              : 'Checking audio availability on this node…'
        );
      },
    });
    throwIfAborted(controller.signal);
    if (!isQdnResourceReady(status.status))
      throw new Error(
        'The audio is not ready on the current node yet. Please retry shortly or choose another song.'
      );
    const value = await getQdnResourceUrl('AUDIO', publisher, identifier, {
      signal: controller.signal,
      priority: 'playback',
      fresh: true,
      retries: 0,
    });
    throwIfAborted(controller.signal);
    if (!value) throw new Error(AUDIO_LOAD_ERROR);
    const url = new URL(value, window.location.href);
    // These Core file endpoints ignore unknown query fields. A fresh attempt
    // should not reuse a browser-cached non-audio/error response from the first GET.
    url.searchParams.set('_qmusic_retry', `${Date.now()}-${options.attempt}`);
    return url.href;
  } catch (error) {
    if (options.signal.aborted) throw abortError();
    if (deadlineExpired)
      throw new Error(
        'Audio preparation is taking too long. Please retry shortly or choose another song.'
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener('abort', abort);
  }
};
