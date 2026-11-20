import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaFeed } from '../src/hooks/useMediaFeed';
import { useMediaCatalog } from '../src/hooks/useMediaCatalog';
import type { MediaPageOptions } from '../src/services/mediaPages';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
afterEach(cleanup);

describe('paged feed and catalog hooks', () => {
  it('uses the raw nextOffset and preserves already loaded cards during Load more', async () => {
    const second = deferred<{
      items: { id: string }[];
      nextOffset: number;
      hasMore: boolean;
    }>();
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'first' }],
        nextOffset: 3,
        hasMore: true,
      })
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ limit }) => useMediaFeed(load, limit),
      { initialProps: { limit: 1 } }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    rerender({ limit: 2 });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(result.current.items).toEqual([{ id: 'first' }]);
    expect(load.mock.calls[1][0].offset).toBe(3);
    await act(async () =>
      second.resolve({ items: [{ id: 'last' }], nextOffset: 4, hasMore: false })
    );
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
    expect(load.mock.calls[0][0].before).toBe(load.mock.calls[1][0].before);
  });
  it('retries a failed page without losing previous songs', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'first' }],
        nextOffset: 1,
        hasMore: true,
      })
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({
        items: [{ id: 'second' }],
        nextOffset: 2,
        hasMore: false,
      });
    const { result, rerender } = renderHook(
      ({ limit }) => useMediaFeed(load, limit),
      { initialProps: { limit: 1 } }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    rerender({ limit: 2 });
    await waitFor(() => expect(result.current.error).toBe('Offline'));
    expect(result.current.items).toHaveLength(1);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.error).toBeNull();
  });
  it('ignores a late previous-publisher result', async () => {
    const old = deferred<{
      items: { id: string }[];
      nextOffset: number;
      hasMore: boolean;
    }>();
    const load = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({
        items: [{ id: 'B-song' }],
        nextOffset: 1,
        hasMore: false,
      });
    const { result, rerender } = renderHook(
      ({ publisher }) => useMediaFeed(load, 1, publisher),
      { initialProps: { publisher: 'A' } }
    );
    rerender({ publisher: 'B' });
    await waitFor(() => expect(result.current.items[0]?.id).toBe('B-song'));
    await act(async () =>
      old.resolve({ items: [{ id: 'A-song' }], nextOffset: 1, hasMore: false })
    );
    expect(result.current.items[0]?.id).toBe('B-song');
    expect(load.mock.calls[0][0].signal.aborted).toBe(true);
  });
  it('does not search all publishers for a signed-out My Music page', async () => {
    const load = vi.fn();
    const { result } = renderHook(() => useMediaFeed(load, 24, ''));
    expect(load).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
  it('starts the full catalog only on demand and exposes partial results on error', async () => {
    const load = vi.fn(
      async (
        options: MediaPageOptions & {
          onPage?: (items: { id: string }[]) => void;
        }
      ) => {
        options.onPage?.([{ id: 'partial' }]);
        throw new Error('Node busy');
      }
    );
    const { result, rerender } = renderHook(
      ({ enabled }) => useMediaCatalog(load, enabled),
      { initialProps: { enabled: false } }
    );
    expect(load).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.error).toBe('Node busy'));
    expect(result.current.items).toEqual([{ id: 'partial' }]);
    expect(result.current.complete).toBe(false);
  });
  it('leaves the loading state when a full-catalog search is disabled', async () => {
    const load = vi.fn(() => new Promise<{ id: string }[]>(() => {}));
    const { result, rerender } = renderHook(
      ({ enabled }) => useMediaCatalog(load, enabled),
      { initialProps: { enabled: true } }
    );
    expect(result.current.isLoading).toBe(true);
    rerender({ enabled: false });
    expect(result.current.isLoading).toBe(false);
  });
  it('aborts a catalog scan on unmount', async () => {
    let signal: AbortSignal | undefined;
    const load = vi.fn((options: MediaPageOptions) => {
      signal = options.signal;
      return new Promise<{ id: string }[]>(() => {});
    });
    const { unmount } = renderHook(() => useMediaCatalog(load, true));
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
