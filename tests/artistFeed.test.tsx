import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useArtistFeed } from '../src/hooks/useArtistFeed';
import type { SongSummary } from '../src/types/media';
const fetchPage = vi.hoisted(() => vi.fn());
vi.mock('../src/services/songs', () => ({ fetchSongsPage: fetchPage }));
const song = (
  id: string,
  artist = 'Other',
  publisher = 'Publisher'
): SongSummary => ({
  id,
  identifier: `enjoymusic_song_${id}`,
  publisher,
  title: id,
  artist,
  service: 'AUDIO',
  mediaType: 'SONG',
});
const page = (items: SongSummary[], offset: number, hasMore = true) => ({
  items,
  nextOffset: offset,
  nextCursor: { source: { offset, hasMore, buffer: [] } },
  hasMore,
});
beforeEach(() => fetchPage.mockReset());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('bounded artist index search', () => {
  it('checks at most 100 indexed rows initially, matches exact normalized names across publishers and continues on demand', async () => {
    const first = Array.from({ length: 50 }, (_, i) => song(`first-${i}`));
    first[0] = song('match1', ' ALICE ', 'A');
    first[1] = song('tribute', 'Alice Tribute');
    const second = Array.from({ length: 50 }, (_, i) => song(`second-${i}`));
    fetchPage
      .mockResolvedValueOnce(page(first, 50))
      .mockResolvedValueOnce(page(second, 100))
      .mockResolvedValueOnce(page([song('match2', 'alice', 'B')], 101, false));
    const { result } = renderHook(() => useArtistFeed('Alice'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.current.scanned).toBe(100);
    expect(result.current.items.map((item) => item.id)).toEqual(['match1']);
    expect(result.current.hasMore).toBe(true);
    expect(fetchPage.mock.calls[0][0]).toMatchObject({
      limit: 50,
      priority: 'background',
      offset: 0,
    });
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.items.map((item) => item.publisher)).toEqual([
      'A',
      'B',
    ]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls[2][0].cursor.source.offset).toBe(100);
    expect(fetchPage.mock.calls[2][0].before).toBe(
      fetchPage.mock.calls[0][0].before
    );
  });
  it('preserves a successful batch and resumes its cursor after a later read fails', async () => {
    fetchPage
      .mockResolvedValueOnce(page([song('saved', 'Alice')], 50))
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(page([song('later', 'Alice')], 100, false));
    const { result } = renderHook(() => useArtistFeed('Alice'));
    await waitFor(() => expect(result.current.error).toBe('Offline'));
    expect(result.current.items.map((item) => item.id)).toEqual(['saved']);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(fetchPage.mock.calls[2][0].offset).toBe(50);
    expect(result.current.items.map((item) => item.id)).toEqual([
      'saved',
      'later',
    ]);
  });
  it('aborts a prior artist and ignores a late result after navigation', async () => {
    let finish!: (value: ReturnType<typeof page>) => void;
    fetchPage
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValueOnce(page([song('Bob-song', 'Bob')], 1, false));
    const { result, rerender } = renderHook(({ name }) => useArtistFeed(name), {
      initialProps: { name: 'Alice' },
    });
    const oldSignal = fetchPage.mock.calls[0][0].signal;
    rerender({ name: 'Bob' });
    await waitFor(() => expect(result.current.items[0]?.id).toBe('Bob-song'));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      finish(page([song('Alice-song', 'Alice')], 1, false));
    });
    expect(result.current.items.map((item) => item.id)).toEqual(['Bob-song']);
  });
  it('bounds an unresponsive index request and exposes a retryable incomplete result', async () => {
    vi.useFakeTimers();
    fetchPage.mockImplementationOnce(
      ({ signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          )
        )
    );
    const { result } = renderHook(() => useArtistFeed('Alice'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30001);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toContain('taking too long');
    expect(result.current.hasMore).toBe(true);
    expect(fetchPage).toHaveBeenCalledOnce();
  });
});
