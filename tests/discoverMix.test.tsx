import React from 'react';
import { cleanup, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discoverMix, shuffleSongs } from '../src/services/discoverMix';
import { DiscoverPage } from '../src/pages/DiscoverPage';
import type { SongSummary } from '../src/types/media';
const m = vi.hoisted(() => ({
  fetch: vi.fn(),
  play: vi.fn(),
  recent: vi.fn(),
}));
vi.mock('../src/services/songs', () => ({ fetchSongsPage: m.fetch }));
vi.mock('../src/hooks/useMiniPlayer', () => ({
  useMiniPlayer: () => ({ playQueue: m.play }),
}));
vi.mock('../src/hooks/useLibrary', () => ({
  useLibrary: () => ({ addRecentSong: m.recent }),
}));
vi.mock('../src/components/common/ArtworkThumb', () => ({
  ArtworkThumb: () => null,
}));
const song = (id: string, created = 100): SongSummary => ({
  id,
  created,
  title: id,
  identifier: `enjoymusic_song_${id}`,
  artist: 'Artist',
  publisher: 'Publisher',
  service: 'AUDIO',
  mediaType: 'SONG',
});
const page = (items: SongSummary[]) => ({
  items,
  hasMore: false,
  nextOffset: items.length,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.fetch.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('bounded chronological discovery', () => {
  it('uses an oldest-row probe, one recent and three random older windows, then deduplicates and caps the mix', async () => {
    m.fetch.mockResolvedValueOnce(page([song('oldest', 100)]));
    for (let n = 0; n < 4; n++)
      m.fetch.mockResolvedValueOnce(
        page(Array.from({ length: 10 }, (_, i) => song(`${n}-${i}`)))
      );
    const result = await discoverMix({}, () => 0.5, 1000);
    expect(m.fetch).toHaveBeenCalledTimes(5);
    expect(m.fetch.mock.calls[0][0]).toMatchObject({
      limit: 1,
      reverse: false,
      priority: 'background',
    });
    expect(m.fetch.mock.calls[1][0]).toMatchObject({ limit: 10, before: 1001 });
    expect(m.fetch.mock.calls.slice(2).map(([p]) => p.before)).toEqual([
      551, 551, 551,
    ]);
    expect(result.items).toHaveLength(20);
    expect(new Set(result.items.map((item) => item.id)).size).toBe(20);
    expect(result.oldest).toBe(100);
    expect(result.partial).toBe(false);
  });
  it('reuses the range, excludes the previous preview and leaves input arrays unchanged', async () => {
    const original = [song('excluded'), song('new')];
    m.fetch.mockResolvedValue(page(original));
    const result = await discoverMix(
      { oldest: 100, exclude: ['excluded'] },
      () => 0,
      1000
    );
    expect(m.fetch).toHaveBeenCalledTimes(4);
    expect(result.items.map((item) => item.id)).toEqual(['new']);
    expect(original.map((item) => item.id)).toEqual(['excluded', 'new']);
    expect(shuffleSongs([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
  it('returns successful windows after partial failures, but propagates all-window failure', async () => {
    m.fetch
      .mockRejectedValueOnce(new Error('One window unavailable'))
      .mockResolvedValue(page([song('found')]));
    const result = await discoverMix({ oldest: 100 }, () => 0.5, 1000);
    expect(result.items.map((item) => item.id)).toEqual(['found']);
    expect(result.partial).toBe(true);
    m.fetch.mockRejectedValue(new Error('Offline'));
    await expect(discoverMix({ oldest: 100 })).rejects.toThrow('Offline');
  });
  it('retains completed windows when a later window reaches the deadline', async () => {
    const controller = new AbortController();
    m.fetch.mockResolvedValueOnce(page([song('saved')]));
    m.fetch.mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException('Cancelled', 'AbortError');
    });
    const result = await discoverMix({
      oldest: 100,
      signal: controller.signal,
    });
    expect(result.items.map((item) => item.id)).toEqual(['saved']);
    expect(result.partial).toBe(true);
    expect(m.fetch).toHaveBeenCalledTimes(2);
  });
  it('handles an empty index without looping and aborts before another window can start', async () => {
    m.fetch.mockResolvedValueOnce(page([]));
    expect((await discoverMix()).items).toEqual([]);
    expect(m.fetch).toHaveBeenCalledOnce();
    const controller = new AbortController();
    m.fetch.mockReset().mockImplementationOnce(async () => {
      controller.abort();
      return page([song('late')]);
    });
    await expect(
      discoverMix({ oldest: 100, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(m.fetch).toHaveBeenCalledOnce();
  });
});
describe('Discover Mix preview and playback', () => {
  it('does no work until requested and only replaces playback after an explicit Play action', async () => {
    const user = userEvent.setup();
    m.fetch.mockResolvedValue(page([song('Found song')]));
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>
    );
    expect(m.fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Find a mix' }));
    await screen.findByRole('button', { name: 'Play mix' });
    expect(m.play).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Play mix' }));
    expect(m.play.mock.calls[0][0][0]).toMatchObject({
      title: 'Found song',
      publisher: 'Publisher',
    });
    expect(m.recent).toHaveBeenCalledWith(song('Found song'));
    m.fetch.mockRejectedValue(new Error('Offline'));
    await user.click(screen.getByRole('button', { name: 'Find another mix' }));
    await screen.findByText('Offline');
    expect(screen.getByRole('button', { name: 'Play mix' })).toBeTruthy();
    expect(m.play).toHaveBeenCalledOnce();
  });
  it('keeps the old preview when another bounded sample contains only duplicates', async () => {
    const user = userEvent.setup();
    m.fetch.mockResolvedValue(page([song('Same song')]));
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: 'Find a mix' }));
    await screen.findByRole('button', { name: 'Play mix' });
    await user.click(screen.getByRole('button', { name: 'Find another mix' }));
    await screen.findByText(/No different songs found/);
    expect(screen.getByRole('button', { name: 'Play mix' })).toBeTruthy();
    expect(m.fetch).toHaveBeenCalledTimes(9);
    expect(m.play).not.toHaveBeenCalled();
  });
  it('has a retryable deadline and cancels when leaving the page', async () => {
    vi.useFakeTimers();
    m.fetch.mockImplementation(
      ({ signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          )
        )
    );
    const view = render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>
    );
    await act(async () => {
      screen.getByRole('button', { name: 'Find a mix' }).click();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_001);
    });
    expect(screen.getByText(/Finding music took too long/)).toBeTruthy();
    expect(m.play).not.toHaveBeenCalled();
    await act(async () => {
      screen.getByRole('button', { name: 'Find a mix' }).click();
    });
    const signal = m.fetch.mock.calls[1][0].signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(m.play).not.toHaveBeenCalled();
  });
});
