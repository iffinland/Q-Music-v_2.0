import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSession, type AudioUpdate } from '../src/services/audioSession';

class FakeAudio extends EventTarget {
  src = '';
  paused = true;
  volume = 1;
  currentTime = 0;
  duration = 123;
  preload = '';
  error: { code: number } | null = null;
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
  play = vi.fn(async () => {
    this.paused = false;
  });
  removeAttribute = vi.fn(() => {
    this.src = '';
  });
}
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((r, j) => {
    resolve = r;
    reject = j;
  });
  return { promise, resolve, reject };
};
const setup = (resolve = async () => 'http://node/audio') => {
  const audio = new FakeAudio();
  const updates: AudioUpdate[] = [];
  const session = new AudioSession(
    audio as unknown as HTMLAudioElement,
    resolve,
    (value) => updates.push(value),
    1000
  );
  return { audio, session, updates };
};
afterEach(() => vi.useRealTimers());

describe('selected-song lifecycle', () => {
  it('does not claim Playing before the actual media event', async () => {
    const { audio, session, updates } = setup();
    session.setPlaying(true);
    await session.start();
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(updates.some((update) => update.label === 'Playing')).toBe(false);
    audio.dispatchEvent(new Event('playing'));
    expect(updates.at(-1)).toMatchObject({
      label: 'Playing',
      buffering: false,
    });
    session.dispose();
  });
  it('honors Pause while URL resolution is pending', async () => {
    const response = deferred<string>();
    const { audio, session, updates } = setup(() => response.promise);
    session.setPlaying(true);
    const loading = session.start();
    session.setPlaying(false);
    response.resolve('http://node/audio');
    await loading;
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.paused).toBe(true);
    expect(updates.at(-1)).toMatchObject({ label: 'Paused', buffering: false });
    session.dispose();
  });
  it('stops the old sound immediately and discards its delayed URL on track switch', async () => {
    const response = deferred<string>();
    const { audio, session, updates } = setup(() => response.promise);
    const loading = session.start();
    session.dispose();
    const count = updates.length;
    response.resolve('http://old/audio');
    await loading;
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.src).toBe('');
    expect(updates).toHaveLength(count);
  });
  it('ignores a previous play rejection after pause or disposal', async () => {
    const response = deferred<void>();
    const { audio, session, updates } = setup();
    audio.play.mockImplementationOnce(() => response.promise);
    session.setPlaying(true);
    await session.start();
    session.setPlaying(false);
    session.dispose();
    const count = updates.length;
    response.reject(new DOMException('Interrupted', 'AbortError'));
    await Promise.resolve();
    await Promise.resolve();
    expect(updates).toHaveLength(count);
  });
  it('surfaces a codec/media error and stops playing', async () => {
    const { audio, session, updates } = setup();
    session.setPlaying(true);
    await session.start();
    audio.error = { code: 4 };
    audio.dispatchEvent(new Event('error'));
    expect(updates.at(-1)).toMatchObject({ playing: false, buffering: false });
    expect(updates.at(-1)?.error).toContain('not supported');
    session.dispose();
  });
  it('provides buffering events and a finite stall timeout', async () => {
    vi.useFakeTimers();
    const { audio, session, updates } = setup();
    session.setPlaying(true);
    await session.start();
    audio.dispatchEvent(new Event('playing'));
    audio.dispatchEvent(new Event('waiting'));
    expect(updates.at(-1)?.buffering).toBe(true);
    await vi.advanceTimersByTimeAsync(1001);
    expect(updates.at(-1)?.error).toContain('taking too long');
    session.dispose();
  });
  it('clears the stall timer on playing and removes listeners on close', async () => {
    vi.useFakeTimers();
    const { audio, session, updates } = setup();
    session.setPlaying(true);
    await session.start();
    audio.dispatchEvent(new Event('playing'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(updates.some((update) => update.error)).toBe(false);
    session.dispose();
    const count = updates.length;
    audio.dispatchEvent(new Event('error'));
    expect(updates).toHaveLength(count);
  });
  it('allows a user gesture to resume after autoplay denial', async () => {
    const { audio, session, updates } = setup();
    audio.play.mockRejectedValueOnce(
      new DOMException('User activation required', 'NotAllowedError')
    );
    session.setPlaying(true);
    await session.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(updates.at(-1)?.error).toContain('Press Play');
    session.setPlaying(true);
    expect(audio.play).toHaveBeenCalledTimes(2);
    session.dispose();
  });
  it('dispatches ended to the queue owner, not to a disposed track', async () => {
    const { audio, session, updates } = setup();
    await session.start();
    audio.dispatchEvent(new Event('ended'));
    expect(updates.at(-1)?.ended).toBe(true);
    session.dispose();
    const count = updates.length;
    audio.dispatchEvent(new Event('ended'));
    expect(updates).toHaveLength(count);
  });
});
