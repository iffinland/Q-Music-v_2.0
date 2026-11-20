export type ReadPriority = 'playback' | 'normal' | 'background';
export interface ReadOptions {
  signal?: AbortSignal;
  priority?: ReadPriority;
  fresh?: boolean;
}

export const abortError = () =>
  new DOMException('Loading cancelled.', 'AbortError');
export const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError();
};
export const isAbortError = (error: unknown) =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError'
  );

export const withAbort = <T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> => {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortError());
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
};

export const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    throwIfAborted(signal);
    const abort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });

// Reserve capacity for a selected song; artwork must not fill the bridge queue.
// Active bridge requests cannot be cancelled by a Q-App. Keep their slot until
// the actual bridge Promise settles, even when every UI consumer has left.
export class ReadQueue {
  private active = 0;
  private backgroundActive = 0;
  private nonPlaybackActive = 0;
  private pending: {
    priority: ReadPriority;
    start: () => void;
    signal?: AbortSignal;
  }[] = [];

  run<T>(task: () => Promise<T>, options: ReadOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const priority = options.priority ?? 'normal';
      const entry = {
        priority,
        signal: options.signal,
        start: () => {
          options.signal?.removeEventListener('abort', cancel);
          this.active++;
          if (priority !== 'playback') this.nonPlaybackActive++;
          if (priority === 'background') this.backgroundActive++;
          Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              if (priority !== 'playback') this.nonPlaybackActive--;
              if (priority === 'background') this.backgroundActive--;
              this.drain();
            });
        },
      };
      const cancel = () => {
        const index = this.pending.indexOf(entry);
        if (index >= 0) {
          this.pending.splice(index, 1);
          reject(abortError());
        }
      };
      if (options.signal?.aborted) {
        reject(abortError());
        return;
      }
      options.signal?.addEventListener('abort', cancel, { once: true });
      this.pending.push(entry);
      this.drain();
    });
  }

  private drain() {
    const rank = { playback: 0, normal: 1, background: 2 };
    this.pending.sort((a, b) => rank[a.priority] - rank[b.priority]);
    while (this.active < 4) {
      const index = this.pending.findIndex(
        (item) =>
          item.priority === 'playback' ||
          (this.nonPlaybackActive < 3 &&
            (item.priority !== 'background' || this.backgroundActive < 2))
      );
      if (index < 0) return;
      const [entry] = this.pending.splice(index, 1);
      entry.start();
    }
  }
}

export const readQueue = new ReadQueue();
export const requestError = (
  error: unknown,
  fallback = 'QDN request failed.'
): string => {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const data = error as { message?: unknown; error?: unknown };
    if (typeof data.message === 'string' && data.message.trim())
      return data.message;
    if (data.error) return requestError(data.error, fallback);
  }
  return fallback;
};
