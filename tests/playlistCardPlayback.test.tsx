import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlaylistPlayback } from '../src/hooks/usePlaylistPlayback';
const m = vi.hoisted(() => ({
  fetch: vi.fn(),
  play: vi.fn(),
  currentTrack: undefined as { key: string } | undefined,
}));
vi.mock('../src/services/playlists', () => ({ fetchPlaylistDetail: m.fetch }));
vi.mock('../src/hooks/useMiniPlayer', () => ({
  useMiniPlayer: () => ({ playQueue: m.play, currentTrack: m.currentTrack }),
}));
const item = {
  id: 'playlist',
  identifier: 'earbump_playlist_1',
  publisher: 'Owner',
  title: 'List',
  songCount: null,
};
const detail = {
  ...item,
  songs: [
    { publisher: 'Author', identifier: 'earbump_song_a', title: 'A' },
    { publisher: 'Author', identifier: 'earbump_song_a', title: 'A' },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  m.currentTrack = undefined;
});
afterEach(() => cleanup());
describe('explicit playlist card playback', () => {
  it('reads no payload before Play and preserves duplicate occurrences in the queue', async () => {
    m.fetch.mockResolvedValue(detail);
    const { result } = renderHook(() => usePlaylistPlayback());
    expect(m.fetch).not.toHaveBeenCalled();
    await act(async () => result.current.play(item));
    const queue = m.play.mock.calls[0][0];
    expect(queue).toHaveLength(2);
    expect(queue[0].key).not.toBe(queue[1].key);
    expect(queue[0].identifier).toBe('earbump_song_a');
    expect(m.fetch.mock.calls[0][2].priority).toBe('playback');
  });
  it('does not start a stale playlist after selecting a different song', async () => {
    let done!: (data: typeof detail) => void;
    m.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve;
        })
    );
    const { result, rerender } = renderHook(() => usePlaylistPlayback());
    let loading!: Promise<void>;
    act(() => {
      loading = result.current.play(item);
    });
    m.currentTrack = { key: 'another-song' };
    rerender();
    expect(m.fetch.mock.calls[0][2].signal.aborted).toBe(true);
    await act(async () => {
      done(detail);
      await loading;
    });
    expect(m.play).not.toHaveBeenCalled();
  });
  it('keeps the current queue untouched on unavailable or empty playlists', async () => {
    m.fetch.mockRejectedValueOnce(new Error('Unavailable'));
    const { result } = renderHook(() => usePlaylistPlayback());
    await act(async () => result.current.play(item));
    expect(result.current.error).toBe('Unavailable');
    m.fetch.mockResolvedValueOnce({ ...detail, songs: [] });
    await act(async () => result.current.play(item));
    expect(result.current.error).toContain('no available tracks');
    expect(m.play).not.toHaveBeenCalled();
  });
});
