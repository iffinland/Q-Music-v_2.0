import React from 'react';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from '../src/pages/SearchPage';
import { useSearchIndex } from '../src/hooks/useSearchIndex';
import {
  buildSongSearchText,
  matchesMusicText,
  indexTags,
  searchCreators,
} from '../src/utils/musicSearch';
import type { SongSummary, PlaylistSummary } from '../src/types/media';
const m = vi.hoisted(() => ({
  songs: vi.fn(),
  playlists: vi.fn(),
  play: vi.fn(),
}));
vi.mock('../src/services/songs', () => ({ fetchSongsPage: m.songs }));
vi.mock('../src/services/playlists', () => ({
  fetchPlaylistsPage: m.playlists,
}));
vi.mock('../src/hooks/useMiniPlayer', () => ({
  useMiniPlayer: () => ({ playQueue: m.play }),
}));
vi.mock('../src/hooks/useLibrary', () => ({
  useLibrary: () => ({ addRecentSong: vi.fn() }),
}));
vi.mock('../src/hooks/usePlaylistPlayback', () => ({
  usePlaylistPlayback: () => ({ play: vi.fn(), error: null }),
}));
vi.mock('../src/components/common/ArtworkThumb', () => ({
  ArtworkThumb: () => null,
}));
const song = (id: string, artist = 'Alice'): SongSummary => ({
  id,
  identifier: `enjoymusic_song_${id}`,
  title: id,
  artist,
  publisher: 'Alice',
  service: 'AUDIO',
  mediaType: 'SONG',
});
const playlist: PlaylistSummary = {
  id: 'list',
  identifier: 'enjoymusic_playlist_list',
  title: 'Alice collection',
  publisher: 'Alice',
  songCount: null,
};
const page = <T,>(items: T[], offset = items.length, hasMore = false) => ({
  items,
  nextOffset: offset,
  nextCursor: { source: { offset, hasMore, buffer: [] } },
  hasMore,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.songs.mockReset().mockResolvedValue(page([song('Alice song')], 50, true));
  m.playlists.mockReset().mockResolvedValue(page([playlist]));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('incremental music search', () => {
  it('matches all words across deep indexed details, preserves accents and sanitizes tags', () => {
    const item = {
      ...song('Beyoncé'),
      tags: ['night'],
      notes: 'acoustic recording',
    };
    expect(matchesMusicText(buildSongSearchText(item), 'NIGHT acoustic')).toBe(
      true
    );
    expect(matchesMusicText(buildSongSearchText(item), 'Beyonce\u0301')).toBe(
      true
    );
    expect(matchesMusicText(buildSongSearchText(item), 'Beyonce')).toBe(false);
    expect(indexTags([' tag ', 7, '', null])).toEqual(['tag']);
    expect(indexTags('wrong')).toBeUndefined();
    expect(searchCreators([item], [playlist], 'recording', 'artist')).toEqual(
      []
    );
    expect(
      searchCreators(
        [item, song('two', ' ALICE ')],
        [playlist],
        'alice',
        'artist'
      )
    ).toEqual([{ name: 'Alice', songs: 2, playlists: 0 }]);
    expect(
      searchCreators([item], [playlist], 'alice', 'publisher')[0]
    ).toMatchObject({ songs: 1, playlists: 1 });
  });
  it('requests nothing for an empty search or typing, then reuses the index across tabs and submitted queries', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/search']}>
        <SearchPage />
      </MemoryRouter>
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Search all music' }),
      'Alice'
    );
    expect(m.songs).not.toHaveBeenCalled();
    expect(m.playlists).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Search music' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Checked 1 indexed songs and 1 playlists'
      )
    );
    expect(m.songs).toHaveBeenCalledOnce();
    expect(m.playlists).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('tab', { name: 'Artists (1)' }));
    expect(
      screen.getByRole('link', { name: 'Artist: Alice' }).getAttribute('href')
    ).toBe('/artists/Alice');
    const input = screen.getByRole('textbox', { name: 'Search all music' });
    await user.clear(input);
    await user.type(input, 'collection');
    await user.click(screen.getByRole('button', { name: 'Search music' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Playlists (1)' })).toBeTruthy()
    );
    expect(m.songs).toHaveBeenCalledOnce();
    expect(m.playlists).toHaveBeenCalledOnce();
    m.songs.mockResolvedValueOnce(page([song('another')], 51));
    await user.click(screen.getByRole('button', { name: 'Search more music' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Index search complete'
      )
    );
    expect(m.songs.mock.calls[1][0]).toMatchObject({ offset: 50, limit: 50 });
    expect(m.playlists).toHaveBeenCalledOnce();
  });
  it('plays the selected matching result with the displayed result order', async () => {
    m.songs.mockResolvedValueOnce(
      page([
        song('Alice first'),
        song('unrelated', 'Other'),
        song('Alice second'),
      ])
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/search?q=second&type=songs']}>
        <SearchPage />
      </MemoryRouter>
    );
    await screen.findByRole(
      'link',
      { name: 'Details: Alice second' },
      { timeout: 5000 }
    );
    await user.click(screen.getByRole('button', { name: 'Play', exact: true }));
    const [queue, selected] = m.play.mock.calls[0];
    expect(
      queue.map((item: { identifier: string }) => item.identifier)
    ).toEqual(['enjoymusic_song_Alice second']);
    expect(selected).toBe(0);
  });
  it('preserves successful source results and resumes independent cursors after a failure', async () => {
    m.songs.mockRejectedValueOnce(new Error('Offline'));
    const { result } = renderHook(() => useSearchIndex());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.errors[0]).toContain('Offline');
    expect(result.current.playlists).toHaveLength(1);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.songs).toHaveLength(1));
    expect(m.songs.mock.calls[1][0].offset).toBe(0);
    expect(m.playlists).toHaveBeenCalledOnce();
    expect(m.songs.mock.calls[1][0].before).toBe(
      m.songs.mock.calls[0][0].before
    );
    act(() => result.current.refresh());
    await waitFor(() => expect(m.playlists).toHaveBeenCalledTimes(2));
    expect(m.songs.mock.calls[2][0].offset).toBe(0);
  });
  it('shows a successful source while another waits, then exposes a deadline and permits retry', async () => {
    vi.useFakeTimers();
    m.songs.mockImplementationOnce(
      ({ signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          )
        )
    );
    const { result } = renderHook(() => useSearchIndex());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errors[0]).toContain('taking too long');
    expect(result.current.hasMore).toBe(true);
    expect(m.songs).toHaveBeenCalledOnce();
  });
  it('aborts on unmount and ignores a late response', async () => {
    let finish!: (value: ReturnType<typeof page<SongSummary>>) => void;
    m.songs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result, unmount } = renderHook(() => useSearchIndex());
    const signal = m.songs.mock.calls[0][0].signal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      finish(page([song('late')]));
    });
    expect(result.current.songs).toEqual([]);
  });
});
