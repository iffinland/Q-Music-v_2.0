import { MemoryRouter } from 'react-router-dom';
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
  volumeAtom,
} from '../src/state/player';

const resolve = vi.hoisted(() => vi.fn());
const recover = vi.hoisted(() => vi.fn());
vi.mock('../src/services/audioRecovery', () => ({
  AUDIO_LOAD_ERROR:
    'Audio could not be loaded from the current node. Please retry shortly or try another song.',
  prepareAudioRecovery: recover,
}));
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
      <MemoryRouter>
        <FloatingMiniPlayer />
      </MemoryRouter>
    </Provider>
  );
  return { store, ...view };
};
beforeEach(() => {
  elements.length = 0;
  resolve
    .mockReset()
    .mockImplementation(async (_name, id) => `http://node/${id}`);
  recover
    .mockReset()
    .mockRejectedValue(new Error('The audio connection failed. Please retry.'));
  vi.stubGlobal('Audio', TestAudio);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('player UI and real playback hook', () => {
  it('opens linked artist/publisher routes without restarting the selected audio', async () => {
    const user = userEvent.setup();
    const { store } = setup();
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    expect(
      screen
        .getByRole('link', { name: 'Publisher: @publisher' })
        .getAttribute('href')
    ).toBe('/publishers/publisher');
    await user.click(screen.getByRole('link', { name: 'Artist: Artist' }));
    expect(elements).toHaveLength(1);
    expect(elements[0].play).toHaveBeenCalledOnce();
    expect(store.get(currentTrackAtom)?.identifier).toBe('first');
    expect(store.get(isPlayingAtom)).toBe(true);
  });

  it('repeats one on ended, then continues normally when repeat is disabled', async () => {
    const user = userEvent.setup();
    const { store } = setup();
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    await user.click(screen.getByRole('button', { name: 'Repeat: off' }));
    await user.click(screen.getByRole('button', { name: 'Repeat queue' }));
    act(() => elements[0].dispatchEvent(new Event('ended')));
    await waitFor(() => expect(elements[1]?.src).toContain('/first'));
    expect(store.get(currentTrackAtom)?.identifier).toBe('first');
    await user.click(screen.getByRole('button', { name: 'Repeat one' }));
    act(() => elements[1].dispatchEvent(new Event('ended')));
    await waitFor(() => expect(elements[2]?.src).toContain('/second'));
    act(() => elements[2].dispatchEvent(new Event('ended')));
    expect(store.get(isPlayingAtom)).toBe(false);
  });
  it('wraps the queue after its last song when repeat queue is enabled', async () => {
    const user = userEvent.setup();
    const { store } = setup();
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    await user.click(screen.getByRole('button', { name: 'Next song' }));
    await waitFor(() => expect(elements[1]?.src).toContain('/second'));
    await user.click(screen.getByRole('button', { name: 'Repeat: off' }));
    act(() => elements[1].dispatchEvent(new Event('ended')));
    await waitFor(() => expect(elements[2]?.src).toContain('/first'));
    expect(store.get(isPlayingAtom)).toBe(true);
  });
  it('toggles shuffle without restarting audio and preserves queue order with actual listening history', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const user = userEvent.setup();
    const { store } = setup();
    act(() =>
      store.set(queueAtom, [track('first'), track('second'), track('third')])
    );
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    await user.click(
      screen.getByRole('button', { name: 'Shuffle', exact: true })
    );
    expect(elements).toHaveLength(1);
    expect(
      screen
        .getByRole('button', { name: 'Shuffle', exact: true })
        .getAttribute('aria-pressed')
    ).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Next song' }));
    await waitFor(() => expect(elements[1]?.src).toContain('/second'));
    await user.click(screen.getByRole('button', { name: 'Previous song' }));
    await waitFor(() => expect(elements[2]?.src).toContain('/first'));
    await user.click(screen.getByRole('button', { name: 'Next song' }));
    await waitFor(() => expect(elements[3]?.src).toContain('/second'));
    await user.click(screen.getByRole('button', { name: 'Next song' }));
    await waitFor(() => expect(elements[4]?.src).toContain('/third'));
    expect(store.get(queueAtom).map((item) => item.identifier)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(
      (screen.getByRole('button', { name: 'Next song' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('seeks with the position control while playing and paused without restarting playback', async () => {
    const user = userEvent.setup();
    const { store } = setup();
    const position = screen.getByRole('slider', { name: 'Song position' });
    expect((position as HTMLInputElement).disabled).toBe(true);
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    act(() => elements[0].dispatchEvent(new Event('loadedmetadata')));
    position.focus();
    await user.keyboard('{End}');
    expect(elements[0].currentTime).toBe(123);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    position.focus();
    await user.keyboard('{Home}{ArrowRight}');
    expect(elements[0].currentTime).toBe(1);
    expect(store.get(isPlayingAtom)).toBe(false);
    expect(elements[0].play).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledOnce();
  });
  it('changes volume, mutes/restores it and keeps it on the next track and floating player', async () => {
    const user = userEvent.setup();
    const { store } = setup();
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    expect(screen.queryByRole('slider', { name: 'Volume' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Volume controls' }));
    const volume = screen.getByRole('slider', { name: 'Volume' });
    volume.focus();
    await user.keyboard('{Home}{ArrowRight}');
    expect(elements[0].volume).toBe(0.01);
    await user.click(screen.getByRole('button', { name: 'Mute' }));
    expect(elements[0].volume).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Unmute' }));
    expect(elements[0].volume).toBe(0.01);
    expect(store.get(volumeAtom)).toBe(0.01);
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Volume controls' })
      ).toBeNull()
    );
    expect(store.get(isPlayingAtom)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Next song' }));
    await waitFor(() => expect(elements[1]?.src).toContain('/second'));
    expect(elements[1].volume).toBe(0.01);
    await user.click(screen.getByRole('button', { name: 'Float player' }));
    expect(screen.getByRole('slider', { name: 'Song position' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Volume controls' }));
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeTruthy();
  });
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
        <MemoryRouter>
          <FloatingMiniPlayer />
        </MemoryRouter>
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
    await waitFor(() =>
      expect(screen.getByText(/audio connection failed/i)).toBeTruthy()
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(elements[1]?.src).toContain('/first'));
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(elements[0].src).toBe('');
  });
  it('recovers a cold-start media error on the same song without a user Retry click', async () => {
    let done!: (url: string) => void;
    recover.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve;
        })
    );
    const { store } = setup();
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    act(() => {
      elements[0].error = { code: 4 };
      elements[0].dispatchEvent(new Event('error'));
    });
    expect(screen.queryByText(/format is not supported/i)).toBeNull();
    expect(store.get(isPlayingAtom)).toBe(true);
    expect(elements[0].src).toBe('');
    await act(async () => {
      done('http://node/first?_qmusic_retry=1');
    });
    await waitFor(() => expect(elements[1]?.src).toContain('_qmusic_retry'));
    expect(store.get(currentTrackAtom)?.identifier).toBe('first');
    expect(elements[1].play).toHaveBeenCalledTimes(1);
  });
  it('Pause cancels pending auto-recovery and late readiness cannot restart audio', async () => {
    let done!: (url: string) => void;
    recover.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve;
        })
    );
    const user = userEvent.setup();
    const { store } = setup();
    await waitFor(() => expect(elements[0].src).toContain('/first'));
    act(() => {
      elements[0].error = { code: 4 };
      elements[0].dispatchEvent(new Event('error'));
    });
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(recover.mock.calls[0][2].signal.aborted).toBe(true);
    await act(async () => {
      done('http://late/first');
    });
    expect(elements).toHaveLength(1);
    expect(store.get(isPlayingAtom)).toBe(false);
    expect(store.get(currentTrackAtom)?.identifier).toBe('first');
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
