import { AudioSession, type AudioUpdate } from './audioSession';
import { AUDIO_LOAD_ERROR, type AudioRecoveryOptions } from './audioRecovery';
import { isAbortError, requestError } from './qdnRequests';

// Owns a selected song across a bounded cold-start recovery. Each actual media
// attempt still gets its own AudioSession/element, so old events stay isolated.
export class AudioPlaybackSession {
  private current: AudioSession | null = null;
  private recovery: AbortController | null = null;
  private desired = false;
  private started = false;
  private disposed = false;
  private hasPlayed = false;
  private volume = 1;
  private generation = 0;
  private retries = 0;
  private recoveryStarted: number | undefined;

  constructor(
    private createAudio: () => HTMLAudioElement,
    private resolveUrl: (signal: AbortSignal) => Promise<string | null>,
    private recoverUrl: (options: AudioRecoveryOptions) => Promise<string>,
    private update: (value: AudioUpdate) => void,
    private budgetMs = 60_000
  ) {}

  async start() {
    if (this.started || this.disposed) return;
    this.started = true;
    await this.launch();
  }
  private async launch(url?: string) {
    if (this.disposed) return;
    const generation = ++this.generation;
    const inner = new AudioSession(
      this.createAudio(),
      url ? async () => url : this.resolveUrl,
      (value) => {
        if (this.disposed || generation !== this.generation) return;
        if (value.playing === true || (value.time ?? 0) > 0)
          this.hasPlayed = true;
        if (value.ended) this.desired = false;
        if (
          value.error &&
          this.desired &&
          !this.hasPlayed &&
          [2, 3, 4].includes(value.mediaErrorCode ?? 0) &&
          this.retries < 2 &&
          (this.recoveryStarted === undefined ||
            Date.now() - this.recoveryStarted < this.budgetMs)
        ) {
          void this.recover();
          return;
        }
        if (value.error) this.desired = false;
        this.update(value);
      }
    );
    this.current = inner;
    inner.setVolume(this.volume);
    inner.setPlaying(this.desired);
    await inner.start();
  }
  private async recover() {
    const generation = ++this.generation;
    this.current?.dispose();
    this.current = null;
    const controller = new AbortController();
    this.recovery?.abort();
    this.recovery = controller;
    this.recoveryStarted ??= Date.now();
    const remaining = Math.max(
      1,
      this.budgetMs - (Date.now() - this.recoveryStarted)
    );
    const attempt = ++this.retries;
    this.update({
      error: null,
      url: null,
      buffering: true,
      label: `Preparing audio. Retry ${attempt}/2…`,
    });
    const active = () =>
      !this.disposed &&
      !controller.signal.aborted &&
      generation === this.generation &&
      this.desired;
    try {
      const url = await this.recoverUrl({
        signal: controller.signal,
        attempt,
        timeoutMs: remaining,
        onStatus: (label) => {
          if (active())
            this.update({ label: `${label} (${attempt}/2)`, buffering: true });
        },
      });
      if (!active()) return;
      this.recovery = null;
      await this.launch(url);
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      this.recovery = null;
      this.desired = false;
      this.update({
        error: requestError(error, AUDIO_LOAD_ERROR),
        playing: false,
        buffering: false,
        label: 'Audio unavailable',
      });
    }
  }
  setPlaying(value: boolean) {
    if (this.disposed) return;
    this.desired = value;
    if (!value && this.recovery) {
      ++this.generation;
      this.recovery.abort();
      this.recovery = null;
      this.update({ buffering: false, label: 'Paused' });
    }
    if (this.current) this.current.setPlaying(value);
    else if (value && this.started && !this.recovery) void this.launch();
  }
  setVolume(value: number) {
    this.volume = value;
    this.current?.setVolume(value);
  }
  seek(seconds: number): boolean {
    return this.current?.seek(seconds) ?? false;
  }
  dispose() {
    this.disposed = true;
    ++this.generation;
    this.recovery?.abort();
    this.recovery = null;
    this.current?.dispose();
    this.current = null;
  }
}
