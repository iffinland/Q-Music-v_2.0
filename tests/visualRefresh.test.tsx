import { getDefaultStore } from 'jotai';
import { skinAtom } from '../src/state/appearance';
import React, { useEffect, useState } from 'react';
import { transferableAbortController } from 'node:util';
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
  useParams,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from '../src/pages/HomePage';
import { SongsPage } from '../src/pages/SongsPage';
import { PlaylistsPage } from '../src/pages/PlaylistsPage';
import { MediaDetailOutlet } from '../src/components/common/MediaDetailOutlet';
import { MediaCard } from '../src/components/common/MediaCard';
import type { SongSummary } from '../src/types/media';

const m = vi.hoisted(() => ({
  songs: [] as SongSummary[],
  playlists: [] as object[],
  feed: vi.fn(),
  catalog: vi.fn(),
  play: vi.fn(),
  detail: vi.fn(),
  recent: vi.fn(),
  mounts: vi.fn(),
}));
vi.mock('../src/hooks/useSongsFeed', () => ({
  useSongsFeed: (limit: number) => {
    m.feed(limit);
    return {
      songs: m.songs.slice(0, limit),
      isLoading: false,
      error: null,
      hasMore: m.songs.length > limit,
      retry: vi.fn(),
    };
  },
}));
vi.mock('../src/hooks/usePlaylistsFeed', () => ({
  usePlaylistsFeed: (limit: number) => ({
    playlists: m.playlists.slice(0, limit),
    isLoading: false,
    error: null,
    hasMore: m.playlists.length > limit,
    retry: vi.fn(),
  }),
}));
vi.mock('../src/hooks/useMediaCatalog', () => ({
  useMediaCatalog: (_: unknown, enabled: boolean) => {
    m.catalog(enabled);
    return {
      items: enabled ? m.songs : [],
      complete: true,
      isLoading: false,
      error: null,
      retry: vi.fn(),
    };
  },
}));
vi.mock('../src/hooks/useLibrary', () => ({
  useLibrary: () => ({ addRecentSong: m.recent }),
}));
vi.mock('../src/hooks/useMiniPlayer', () => ({
  useMiniPlayer: () => ({ playQueue: m.play }),
}));
vi.mock('../src/services/playlists', () => ({
  fetchPlaylistDetail: m.detail,
  fetchAllPlaylists: vi.fn(),
}));
vi.mock('../src/hooks/usePlaylistCounts', () => ({
  usePlaylistCounts: () => ({ counts: {}, isLoading: false }),
}));
vi.mock('../src/components/common/ArtworkThumb', () => ({
  ArtworkThumb: () => <div aria-label="Cover placeholder" />,
}));
const song = (index: number): SongSummary => ({
  id: `song-${index}`,
  identifier: `enjoymusic_song_${index}`,
  publisher: 'Publisher',
  title: `Song ${String(index).padStart(2, '0')}`,
  artist: 'Artist',
  service: 'AUDIO',
  mediaType: 'SONG',
});
beforeEach(() => {
  getDefaultStore().set(skinAtom, 'modern');
  vi.stubGlobal(
    'AbortController',
    class {
      constructor() {
        return transferableAbortController();
      }
    }
  );
  vi.clearAllMocks();
  m.songs = Array.from({ length: 45 }, (_, i) => song(i));
  m.playlists = Array.from({ length: 30 }, (_, i) => ({
    id: `playlist-${i}`,
    identifier: `earbump_playlist_${i}`,
    publisher: 'Owner',
    title: `Playlist ${i}`,
    description: 'A playlist description',
    songCount: null,
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('shared cards and bounded page rendering', () => {
  it('renders 15 songs and 15 playlists on Home without starting full-catalog or playlist-payload reads', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getAllByRole('article')).toHaveLength(30)
    );
    expect(
      within(
        screen.getByRole('region', { name: 'Scroll latest songs' })
      ).getAllByRole('article')
    ).toHaveLength(15);
    expect(
      within(
        screen.getByRole('region', { name: 'Scroll latest playlists' })
      ).getAllByRole('article')
    ).toHaveLength(15);
    expect(m.detail).not.toHaveBeenCalled();
    expect(m.catalog).not.toHaveBeenCalled();
    expect(m.feed).toHaveBeenLastCalledWith(15);
  });
  it('shows 20 songs per page, loads only the requested next batch, and reuses it on Previous', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SongsPage />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getAllByRole('article')).toHaveLength(20)
    );
    expect(m.catalog).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await waitFor(() =>
      expect(screen.getAllByRole('article')).toHaveLength(20)
    );
    expect(screen.queryByRole('heading', { name: 'Song 00' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Song 20' })).toBeTruthy();
    expect(m.feed).toHaveBeenLastCalledWith(40);
    await user.click(screen.getByRole('button', { name: 'Go to page 1' }));
    expect(m.feed).toHaveBeenLastCalledWith(40);
    expect(screen.getByRole('heading', { name: 'Song 00' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Go to page 3' }));
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(
      screen
        .getByRole('button', { name: 'Go to next page' })
        .hasAttribute('disabled')
    ).toBe(true);
    await user.type(screen.getByLabelText('Search songs'), 'Song 00');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Page 1')).toBeTruthy();
  });
  it('shows 20 playlist cards and no count/payload reads on default browsing', async () => {
    render(
      <MemoryRouter>
        <PlaylistsPage />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getAllByRole('article')).toHaveLength(20)
    );
    expect(m.detail).not.toHaveBeenCalled();
    expect(m.catalog).toHaveBeenLastCalledWith(false);
    expect(screen.getByText('Jump by playlist title')).toBeTruthy();
  });
});

const Origin = () => {
  const [filter, setFilter] = useState('');
  useEffect(() => {
    m.mounts();
  }, []);
  return (
    <>
      <input
        aria-label="Preserved filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <MediaCard kind="song" item={song(0)} onPlay={m.play} />
    </>
  );
};
const Detail = () => <div>Full metadata: {useParams().identifier}</div>;
const routes = [
  {
    path: '/',
    element: <MediaDetailOutlet />,
    children: [
      { index: true, element: <Origin /> },
      { path: 'songs', element: <Origin /> },
      { path: 'songs/:publisher/:identifier', element: <Detail /> },
    ],
  },
];
describe('detail dialog routing', () => {
  it('opens a real detail URL, preserves the underlying page/filter and supports Back', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(routes);
    render(<RouterProvider router={router} />);
    await user.type(screen.getByLabelText('Preserved filter'), 'my filter');
    await user.click(screen.getByRole('link', { name: 'Details: Song 00' }));
    expect(router.state.location.pathname).toBe(
      '/songs/Publisher/enjoymusic_song_0'
    );
    expect(screen.getByRole('dialog', { name: 'Song details' })).toBeTruthy();
    expect(screen.getByText('Full metadata: enjoymusic_song_0')).toBeTruthy();
    expect(m.play).not.toHaveBeenCalled();
    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      (screen.getByLabelText('Preserved filter') as HTMLInputElement).value
    ).toBe('my filter');
    expect(m.mounts).toHaveBeenCalledTimes(1);
  });
  it('opens a direct/reloaded modal link once and closes to Browse safely', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(routes, {
      initialEntries: [
        {
          pathname: '/songs/Publisher/enjoymusic_song_0',
          state: { mediaModal: true },
        },
      ],
    });
    render(<RouterProvider router={router} />);
    expect(
      screen.getAllByText('Full metadata: enjoymusic_song_0')
    ).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/songs'));
  });
});
