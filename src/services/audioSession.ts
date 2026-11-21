import { AUDIO_LOAD_ERROR } from './audioRecovery';
import { isAbortError, requestError } from './qdnRequests';

export interface AudioUpdate {
  label?: string;
  buffering?: boolean;
  error?: string | null;
  mediaErrorCode?: number;
  url?: string | null;
  time?: number;
  duration?: number;
  playing?: boolean;
  ended?: boolean;
}

// One element per load attempt isolates old network/media events and play()
// completions from the selected song. Dispose stops the old sound immediately.
export class AudioSession {
  private controller = new AbortController();
  private intent = false;
  private ready = false;
  private disposed = false;
  private playAttempt = 0;
  private playPending = false;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private listeners: [string, EventListener][] = [];

  constructor(
    readonly audio: HTMLAudioElement,
    private resolveUrl: (signal: AbortSignal) => Promise<string | null>,
    private update: (state: AudioUpdate) => void,
    private stallTimeoutMs = 120_000
  ) {
    audio.preload = 'metadata';
    this.listen('timeupdate', () =>
      this.update({
        time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      })
    );
    this.listen('loadedmetadata', () =>
      this.update({
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      })
    );
    this.listen('durationchange', () =>
      this.update({
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      })
    );
    this.listen('canplay', () => {
      this.clearWatchdog();
      this.update({ buffering: false, label: 'Ready' });
    });
    this.listen('playing', () => {
      if (!this.intent) {
        this.audio.pause();
        return;
      }
      this.clearWatchdog();
      this.update({
        buffering: false,
        label: 'Playing',
        error: null,
        playing: true,
      });
    });
    this.listen('waiting', () => {
      if (this.intent) this.buffer('Buffering audio…');
    });
    this.listen('stalled', () => {
      if (this.intent) this.buffer('Waiting for audio data…');
    });
    this.listen('error', () => {
      const messages: Record<number, string> = {
        1: 'Audio loading was interrupted. Please retry.',
        2: 'The audio connection failed. Please retry.',
        3: AUDIO_LOAD_ERROR,
        4: AUDIO_LOAD_ERROR,
      };
      this.fail(
        messages[audio.error?.code ?? 0] || AUDIO_LOAD_ERROR,
        audio.error?.code
      );
    });
    this.listen('ended', () => {
      this.intent = false;
      this.clearWatchdog();
      this.update({ buffering: false, label: 'Finished', ended: true });
    });
  }

  private listen(name: string, handler: () => void) {
    const listener: EventListener = () => {
      if (!this.disposed) handler();
    };
    this.audio.addEventListener(name, listener);
    this.listeners.push([name, listener]);
  }

  async start() {
    this.update({ error: null, url: null, time: 0, duration: 0 });
    this.buffer('Connecting to audio…');
    try {
      const url = await this.resolveUrl(this.controller.signal);
      if (this.disposed) return;
      if (!url) throw new Error('Audio could not be found. Please retry.');
      this.audio.src = url;
      this.audio.load();
      this.ready = true;
      this.update({
        url,
        label: this.intent ? 'Loading audio from QDN…' : 'Paused',
        buffering: this.intent,
      });
      if (this.intent) this.play();
      else this.clearWatchdog();
    } catch (error) {
      if (!this.disposed && !isAbortError(error))
        this.fail(
          requestError(error, 'Audio could not be loaded. Please retry.')
        );
    }
  }

  setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  seek(seconds: number): boolean {
    if (
      this.disposed ||
      !this.ready ||
      !Number.isFinite(seconds) ||
      !Number.isFinite(this.audio.duration) ||
      this.audio.duration <= 0
    )
      return false;
    try {
      this.audio.currentTime = Math.max(
        0,
        Math.min(this.audio.duration, seconds)
      );
      this.update({ time: this.audio.currentTime });
      return true;
    } catch {
      return false;
    }
  }

  setPlaying(playing: boolean) {
    if (this.disposed) return;
    this.intent = playing;
    if (!playing) {
      this.playAttempt++;
      this.playPending = false;
      this.audio.pause();
      this.clearWatchdog();
      this.update({ buffering: false, label: 'Paused' });
    } else if (this.ready && !this.playPending && this.audio.paused) {
      this.play();
    }
  }

  private play() {
    const attempt = ++this.playAttempt;
    this.playPending = true;
    this.update({ error: null });
    this.buffer('Starting audio…');
    void this.audio
      .play()
      .then(() => {
        if (attempt === this.playAttempt) this.playPending = false;
      })
      .catch((error) => {
        if (this.disposed || !this.intent || attempt !== this.playAttempt)
          return;
        this.playPending = false;
        const unsupportedSource =
          error &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'NotSupportedError';
        const message = unsupportedSource
          ? AUDIO_LOAD_ERROR
          : error &&
              typeof error === 'object' &&
              'name' in error &&
              error.name === 'NotAllowedError'
            ? 'Press Play to allow audio in this browser.'
            : requestError(
                error,
                'Playback could not be started. Please retry.'
              );
        this.fail(message, unsupportedSource ? 4 : undefined);
      });
  }

  private buffer(label: string) {
    this.update({ buffering: true, label });
    if (!this.watchdog)
      this.watchdog = setTimeout(() => {
        this.watchdog = undefined;
        this.fail(
          'Audio is taking too long to load. Please retry or choose another song.'
        );
      }, this.stallTimeoutMs);
  }
  private clearWatchdog() {
    clearTimeout(this.watchdog);
    this.watchdog = undefined;
  }
  private fail(error: string, mediaErrorCode?: number) {
    if (this.disposed) return;
    this.intent = false;
    this.playAttempt++;
    this.playPending = false;
    this.audio.pause();
    this.clearWatchdog();
    this.update({
      error,
      mediaErrorCode,
      playing: false,
      buffering: false,
      label: 'Audio unavailable',
    });
  }
  dispose() {
    this.disposed = true;
    this.playAttempt++;
    this.controller.abort();
    this.clearWatchdog();
    for (const [name, listener] of this.listeners)
      this.audio.removeEventListener(name, listener);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
