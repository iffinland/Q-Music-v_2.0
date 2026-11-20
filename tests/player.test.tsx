import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingMiniPlayer } from '../src/components/player/FloatingMiniPlayer';
import {
  currentTrackAtom,
  isPlayingAtom,
  queueAtom,
} from '../src/state/player';

const resolve = vi.hoisted(() => vi.fn());
vi.mock('../src/services/songs', () => ({ resolveSongStreamUrl: resolve }));
const elements: TestAudio[] = [];
class TestAudio extends EventTarget {
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
  constructor() {
    super();
    elements.push(this);
  }
}
const track = (id: string) => ({
  key: `publisher:${id}`,
  id,
  identifier: id,
  publisher: 'publisher',
  title: id,
  artist: 'Artist',
  service: 'AUDIO' as const,
});
const setup = () => {
  const store = createStore();
  store.set(currentTrackAtom, track('first'));
  store.set(queueAtom, [track('first'), track('second')]);
  store.set(isPlayingAtom, true);
  const view = render(
    <Provider store={store}>
      <FloatingMiniPlayer />
    </Provider>
  );
  return { store, ...view };
};
beforeEach(() => {
  elements.length = 0;
  resolve
    .mockReset()
    .mockImplementation(async (_name, id) => `http://node/${id}`);
  vi.stubGlobal('Audio', TestAudio);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('player UI and real playback hook', () => {
  it('stops the previous element on Next and advances the correct track', async () => {
    const user = userEvent.setup();
    const { store } = setup();
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    await user.click(screen.getByRole('button', { name: 'Next song' }));
    await waitFor(() => expect(elements[1]?.src).toContain('/second'));
    expect(elements[0].pause).toHaveBeenCalled();
    expect(elements[0].src).toBe('');
    expect(store.get(currentTrackAtom)?.identifier).toBe('second');
  });
  it('advances repeated occurrences of the same song using distinct queue keys', async () => {
    const store = createStore();
    const first = { ...track('same'), key: 'same:0' };
    const second = { ...track('same'), key: 'same:1' };
    store.set(currentTrackAtom, first);
    store.set(queueAtom, [first, second]);
    store.set(isPlayingAtom, true);
    render(
      <Provider store={store}>
        <FloatingMiniPlayer />
      </Provider>
    );
    await waitFor(() => expect(elements[0].src).toContain('/same'));
    act(() => elements[0].dispatchEvent(new Event('ended')));
    await waitFor(() =>
      expect(store.get(currentTrackAtom)?.key).toBe('same:1')
    );
    expect(elements[1].src).toContain('/same');
  });
  it('retries the same failed track with a fresh load attempt', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    act(() => {
      elements[0].error = { code: 2 };
      elements[0].dispatchEvent(new Event('error'));
    });
    expect(screen.getByText(/audio connection failed/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(elements[1]?.src).toContain('/first'));
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(elements[0].src).toBe('');
  });
  it('cancels pending resolution and clears the queue on Close', async () => {
    resolve.mockImplementation(
      (_name, _id, options) =>
        new Promise((_r, reject) =>
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          )
        )
    );
    const user = userEvent.setup();
    const { store } = setup();
    await user.click(screen.getByRole('button', { name: 'Close player' }));
    expect(store.get(currentTrackAtom)).toBeNull();
    expect(store.get(queueAtom)).toEqual([]);
    expect(resolve.mock.calls[0][2].signal.aborted).toBe(true);
    expect(screen.queryByRole('button', { name: 'Close player' })).toBeNull();
  });
});
