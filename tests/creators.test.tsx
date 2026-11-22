import React from 'react';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { transferableAbortController } from 'node:util';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatorLink } from '../src/components/common/CreatorLink';
import { MediaCard } from '../src/components/common/MediaCard';
import { PublisherPage } from '../src/pages/PublisherPage';
import { ArtistPage } from '../src/pages/ArtistPage';
import { skinAtom } from '../src/state/appearance';
import { artistNameKey, creatorPath } from '../src/utils/creators';

const m = vi.hoisted(() => ({
  songFeed: vi.fn(),
  playlistFeed: vi.fn(),
  play: vi.fn(),
  recent: vi.fn(),
  artistScan: vi.fn(),
  name: 'Alice',
}));
const song = (i: number) => ({
  id: `song-${i}`,
  identifier: `enjoymusic_song_${i}`,
  title: `Song ${i}`,
  publisher: m.name,
  artist: 'An Artist',
  service: 'AUDIO' as const,
  mediaType: 'SONG' as const,
});
vi.mock('../src/hooks/useSongsFeed', () => ({
  useSongsFeed: (limit: number, publisher: string) => {
    m.songFeed(limit, publisher);
    return {
      songs: Array.from({ length: Math.min(limit, 25) }, (_, i) => song(i)),
      hasMore: limit < 25,
      isLoading: false,
      error: null,
      retry: vi.fn(),
      refresh: vi.fn(),
    };
  },
}));
vi.mock('../src/hooks/usePlaylistsFeed', () => ({
  usePlaylistsFeed: (limit: number, publisher: string) => {
    m.playlistFeed(limit, publisher);
    return {
      playlists: [],
      hasMore: false,
      isLoading: false,
      error: null,
      retry: vi.fn(),
      refresh: vi.fn(),
    };
  },
}));
vi.mock('../src/hooks/useArtistFeed', () => ({
  useArtistFeed: () => ({
    items: [],
    scanned: 100,
    hasMore: true,
    isLoading: false,
    error: null,
    loadMore: m.artistScan,
    refresh: vi.fn(),
  }),
}));
vi.mock('../src/hooks/useMiniPlayer', () => ({
  useMiniPlayer: () => ({ playQueue: m.play }),
}));
vi.mock('../src/hooks/useLibrary', () => ({
  useLibrary: () => ({ addRecentSong: m.recent }),
}));
vi.mock('../src/services/playlists', () => ({ fetchPlaylistDetail: vi.fn() }));
vi.mock('../src/components/common/ArtworkThumb', () => ({
  ArtworkThumb: () => null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.name = 'Alice';
  vi.stubGlobal(
    'AbortController',
    class {
      constructor() {
        return transferableAbortController();
      }
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const Path = () => <span data-testid="path">{useLocation().pathname}</span>;

describe('creator identities and navigation', () => {
  it('keeps names inside encoded internal routes and normalizes only case/spacing/Unicode form', () => {
    expect(creatorPath('artist', 'AC/DC & Friends')).toBe(
      '/artists/AC%2FDC%20%26%20Friends'
    );
    expect(creatorPath('publisher', 'https://example.test')).toBe(
      '/publishers/https%3A%2F%2Fexample.test'
    );
    expect(creatorPath('artist', ' ')).toBeNull();
    expect(creatorPath('artist', '\ud800')).toBeNull();
    expect(artistNameKey(' A  BAND ')).toBe(artistNameKey('a band'));
    expect(artistNameKey('Beyonce')).not.toBe(artistNameKey('Beyoncé'));
  });
  it.each(['classic', 'modern'] as const)(
    'links card names separately from details/play without nested anchors in %s',
    async (skin) => {
      const store = createStore();
      store.set(skinAtom, skin);
      const user = userEvent.setup();
      const view = render(
        <Provider store={store}>
          <MemoryRouter>
            <MediaCard kind="song" item={song(0)} onPlay={m.play} />
            <Path />
          </MemoryRouter>
        </Provider>
      );
      await screen.findByRole(
        'link',
        { name: 'Artist: An Artist' },
        { timeout: 4000 }
      );
      expect(view.container.querySelectorAll('a a')).toHaveLength(0);
      expect(
        screen
          .getByRole('link', { name: 'Details: Song 0' })
          .getAttribute('href')
      ).toBe('/songs/Alice/enjoymusic_song_0');
      await user.click(screen.getByRole('link', { name: 'Artist: An Artist' }));
      expect(screen.getByTestId('path').textContent).toBe(
        '/artists/An%20Artist'
      );
      expect(m.play).not.toHaveBeenCalled();
      await user.click(
        screen.getAllByRole('link', { name: 'Publisher: @Alice' })[0]
      );
      expect(screen.getByTestId('path').textContent).toBe('/publishers/Alice');
    }
  );
  it('opens publisher-specific feeds, pages independently and resets when the route name changes', async () => {
    const store = createStore();
    store.set(skinAtom, 'modern');
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [{ path: '/publishers/:publisher', element: <PublisherPage /> }],
      { initialEntries: ['/publishers/Alice'] }
    );
    render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    );
    await screen.findByRole('heading', { name: 'Song 0' });
    expect(m.songFeed).toHaveBeenLastCalledWith(20, 'Alice');
    expect(m.playlistFeed).toHaveBeenLastCalledWith(20, 'Alice');
    const section = screen.getByRole('region', { name: 'Published Songs' });
    await user.click(
      within(section).getByRole('button', { name: 'Go to page 2' })
    );
    expect(m.songFeed).toHaveBeenLastCalledWith(40, 'Alice');
    expect(m.playlistFeed).toHaveBeenLastCalledWith(20, 'Alice');
    m.name = 'Bob';
    await act(async () => {
      await router.navigate('/publishers/Bob');
    });
    await waitFor(() => expect(m.songFeed).toHaveBeenLastCalledWith(20, 'Bob'));
    expect(screen.getByRole('heading', { name: '@Bob' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Song 20' })).toBeNull();
  });
  it('labels artist results as incomplete/unverified and continues only when requested', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [{ path: '/artists/:artist', element: <ArtistPage /> }],
      { initialEntries: ['/artists/AC%2FDC'] }
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('heading', { name: 'AC/DC' })).toBeTruthy();
    expect(screen.getByText(/not a verified artist account/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('incomplete');
    expect(m.artistScan).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Search more songs' }));
    expect(m.artistScan).toHaveBeenCalledOnce();
  });
  it('does not make a link for a missing name', () => {
    render(
      <MemoryRouter>
        <CreatorLink kind="artist" name="" />
      </MemoryRouter>
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});
