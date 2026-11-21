import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPlaybackSession } from '../src/services/audioPlaybackSession';
import { prepareAudioRecovery } from '../src/services/audioRecovery';
import type { AudioUpdate } from '../src/services/audioSession';
import { invalidateQdnCache } from '../src/services/qdn';

class FakeAudio extends EventTarget {
  src = '';
  paused = true;
  currentTime = 0;
  duration = 120;
  volume = 1;
  preload = '';
  error: { code: number } | null = null;
  load = vi.fn();
  pause = vi.fn(() => {
    this.paused = true;
  });
  play = vi.fn(async () => {
    this.paused = false;
  });
  removeAttribute = vi.fn(() => {
    this.src = '';
  });
}
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const setup = () => {
  const elements: FakeAudio[] = [];
  const updates: AudioUpdate[] = [];
  const initial = vi.fn(async () => 'https://node/original');
  const recovery = vi.fn(async () => 'https://node/retried');
  const session = new AudioPlaybackSession(
    () => {
      const audio = new FakeAudio();
      elements.push(audio);
      return audio as unknown as HTMLAudioElement;
    },
    initial,
    recovery,
    (value) => updates.push(value)
  );
  const error = (code = 4) => {
    const audio = elements.at(-1)!;
    audio.error = { code };
    audio.dispatchEvent(new Event('error'));
  };
  return { session, elements, updates, initial, recovery, error };
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('bounded selected-song cold-start recovery', () => {
  it('takes the direct path on normal playback without status reads/recovery', async () => {
    const b = setup();
    b.session.setPlaying(true);
    await b.session.start();
    expect(b.initial).toHaveBeenCalledOnce();
    expect(b.recovery).not.toHaveBeenCalled();
    b.session.dispose();
  });
  it('retries up to twice with fresh isolated elements, then offers an honest finite error', async () => {
    const b = setup();
    b.session.setPlaying(true);
    await b.session.start();
    b.error();
    await flush();
    b.error(3);
    await flush();
    b.error(4);
    await flush();
    expect(b.recovery).toHaveBeenCalledTimes(2);
    expect(b.elements).toHaveLength(3);
    expect(b.updates.at(-1)).toMatchObject({
      playing: false,
      buffering: false,
    });
    expect(b.updates.at(-1)?.error).toContain('current node');
    expect(b.updates.at(-1)?.error).not.toMatch(/format|not supported/i);
    expect(b.elements[0].src).toBe('');
    expect(b.elements[1].src).toBe('');
    b.session.dispose();
  });
  it('keeps playback intent while preparing and preserves volume on the replacement', async () => {
    let resolve!: (url: string) => void;
    const b = setup();
    b.recovery.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    b.session.setVolume(0.3);
    b.session.setPlaying(true);
    await b.session.start();
    b.error();
    expect(b.updates.at(-1)).toMatchObject({ error: null, buffering: true });
    resolve('https://node/retry');
    await flush();
    expect(b.elements[1].volume).toBe(0.3);
    expect(b.elements[1].play).toHaveBeenCalledOnce();
    b.session.dispose();
  });
  it('does not reset an already-playing song to zero on a later connection error', async () => {
    const b = setup();
    b.session.setPlaying(true);
    await b.session.start();
    b.elements[0].dispatchEvent(new Event('playing'));
    b.error(2);
    expect(b.recovery).not.toHaveBeenCalled();
    expect(b.updates.at(-1)?.playing).toBe(false);
    b.session.dispose();
  });
  it('does not retry abort events or recover a media error while paused', async () => {
    const b = setup();
    await b.session.start();
    b.error();
    expect(b.recovery).not.toHaveBeenCalled();
    b.session.dispose();
    const c = setup();
    c.session.setPlaying(true);
    await c.session.start();
    c.error(1);
    expect(c.recovery).not.toHaveBeenCalled();
    c.session.dispose();
  });
  it('ignores late recovery after Close/track switch and aborts its readiness consumer', async () => {
    let resolve!: (url: string) => void;
    const b = setup();
    b.recovery.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    b.session.setPlaying(true);
    await b.session.start();
    b.error();
    b.session.dispose();
    const count = b.updates.length;
    expect(b.recovery.mock.calls[0][0].signal.aborted).toBe(true);
    resolve('https://old/retry');
    await flush();
    expect(b.elements).toHaveLength(1);
    expect(b.updates).toHaveLength(count);
  });
  it('can resume with a fresh direct attempt after Pause cancelled preparation', async () => {
    const b = setup();
    b.recovery.mockImplementationOnce(() => new Promise(() => {}));
    b.session.setPlaying(true);
    await b.session.start();
    b.error();
    b.session.setPlaying(false);
    b.session.setPlaying(true);
    await flush();
    expect(b.elements).toHaveLength(2);
    expect(b.elements[1].play).toHaveBeenCalledOnce();
    b.session.dispose();
  });
  it('does not automatically retry autoplay denial and keeps user-gesture Play working', async () => {
    const b = setup();
    b.session.setPlaying(true);
    // Factory element is created by start; reject its play before the resolver finishes.
    const pending = b.session.start();
    b.elements[0].play.mockRejectedValueOnce(
      new DOMException('Activation required', 'NotAllowedError')
    );
    await pending;
    await flush();
    expect(b.recovery).not.toHaveBeenCalled();
    expect(b.updates.at(-1)?.error).toContain('Press Play');
    b.session.setPlaying(true);
    expect(b.elements[0].play).toHaveBeenCalledTimes(2);
    b.session.dispose();
  });
  it('treats play() NotSupportedError as an uncertain media load, without surfacing a format verdict', async () => {
    const b = setup();
    b.session.setPlaying(true);
    const pending = b.session.start();
    b.elements[0].play.mockRejectedValueOnce(
      new DOMException('No supported source', 'NotSupportedError')
    );
    await pending;
    await flush();
    expect(b.recovery).toHaveBeenCalledOnce();
    expect(b.elements).toHaveLength(2);
    b.session.dispose();
  });
});

const native = vi.fn();
beforeEach(() => {
  invalidateQdnCache(() => true);
  native.mockReset();
});
describe('QDN preparation after a browser failure', () => {
  it('waits for download/build readiness, then obtains a fresh URL without downloading audio into JS', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('qortalRequest', native);
    const status = ['PUBLISHED', 'DOWNLOADING', 'READY'];
    native.mockImplementation(async (p) =>
      p.action === 'GET_QDN_RESOURCE_STATUS'
        ? { status: status.shift(), percentLoaded: 50 }
        : 'https://node/arbitrary/AUDIO/A/id?path=song.mp3'
    );
    const labels: string[] = [];
    const pending = prepareAudioRecovery('A', 'id', {
      signal: new AbortController().signal,
      attempt: 1,
      timeoutMs: 10000,
      onStatus: (label) => labels.push(label),
    });
    await vi.advanceTimersByTimeAsync(3501);
    const url = new URL(await pending);
    expect(url.pathname).toBe('/arbitrary/AUDIO/A/id');
    expect(url.searchParams.get('path')).toBe('song.mp3');
    expect(url.searchParams.has('_qmusic_retry')).toBe(true);
    expect(native.mock.calls.map(([p]) => p.action)).toEqual([
      'GET_QDN_RESOURCE_STATUS',
      'GET_QDN_RESOURCE_STATUS',
      'GET_QDN_RESOURCE_STATUS',
      'GET_QDN_RESOURCE_URL',
    ]);
    expect(native.mock.calls[1][0].build).toBe(true);
    expect(labels.some((label) => label.includes('50%'))).toBe(true);
  });
  it('does not retry an unavailable/failed resource as though it were READY', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('qortalRequest', native);
    native.mockResolvedValue({ status: 'NOT_PUBLISHED' });
    const pending = prepareAudioRecovery('A', 'id', {
      signal: new AbortController().signal,
      attempt: 1,
      timeoutMs: 10000,
      onStatus: () => {},
    });
    const rejected = expect(pending).rejects.toThrow('not ready');
    await vi.advanceTimersByTimeAsync(1501);
    await rejected;
    expect(native).toHaveBeenCalledOnce();
  });
  it('cancels before the retry delay without any native request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('qortalRequest', native);
    const controller = new AbortController();
    const pending = prepareAudioRecovery('A', 'id', {
      signal: controller.signal,
      attempt: 1,
      timeoutMs: 10000,
      onStatus: () => {},
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(native).not.toHaveBeenCalled();
  });
  it('bounds a hung readiness lookup with an honest error and no follow-up URL request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('qortalRequest', native);
    let resolve!: (v: unknown) => void;
    native.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const pending = prepareAudioRecovery('A', 'id', {
      signal: new AbortController().signal,
      attempt: 1,
      timeoutMs: 2500,
      onStatus: () => {},
    });
    const rejected = expect(pending).rejects.toThrow('taking too long');
    await vi.advanceTimersByTimeAsync(2501);
    await rejected;
    expect(native).toHaveBeenCalledOnce();
    resolve({ status: 'READY' });
    await flush();
    expect(native).toHaveBeenCalledOnce();
  });
});
