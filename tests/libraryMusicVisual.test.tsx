import { getDefaultStore } from 'jotai';
import { skinAtom } from '../src/state/appearance';
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryPage } from '../src/pages/LibraryPage';
import { MyMusicPage } from '../src/pages/MyMusicPage';
import type { PlaylistSummary, SongSummary } from '../src/types/media';

const m = vi.hoisted(() => ({
  accountKey: 'Wallet:Alice',
  name: 'Alice' as string | undefined,
  songs: [] as SongSummary[],
  recent: [] as SongSummary[],
  playlists: [] as PlaylistSummary[],
  ownerSongs: [] as SongSummary[],
  ownerPlaylists: [] as PlaylistSummary[],
  feed: vi.fn(),
  playlistFeed: vi.fn(),
  detail: vi.fn(),
  play: vi.fn(),
  addRecent: vi.fn(),
  save: vi.fn(),
}));
vi.mock('../src/qortal', () => ({
  useGlobal: () => ({ auth: { name: m.name } }),
}));
vi.mock('../src/hooks/useLibrary', () => ({
  useLibrary: () => ({
    account: { key: m.accountKey },
    favoriteSongs: m.songs,
    recentSongs: m.recent,
    favoritePlaylists: m.playlists,
    addRecentSong: m.addRecent,
  }),
}));
vi.mock('../src/components/shell/LibraryControls', () => ({
  LibraryControls: () => <button onClick={m.save}>Save to QDN</button>,
}));
vi.mock('../src/hooks/useMiniPlayer', () => ({
  useMiniPlayer: () => ({ playQueue: m.play }),
}));
vi.mock('../src/services/playlists', () => ({ fetchPlaylistDetail: m.detail }));
vi.mock('../src/components/common/ArtworkThumb', () => ({
  ArtworkThumb: () => <div aria-label="Cover placeholder" />,
}));
vi.mock('../src/hooks/useSongsFeed', () => ({
  useSongsFeed: (limit: number, publisher: string) => {
    m.feed(limit, publisher);
    return {
      songs: m.ownerSongs.slice(0, limit),
      hasMore: m.ownerSongs.length > limit,
      isLoading: false,
      error: null,
      retry: vi.fn(),
    };
  },
}));
vi.mock('../src/hooks/usePlaylistsFeed', () => ({
  usePlaylistsFeed: (limit: number, publisher: string) => {
    m.playlistFeed(limit, publisher);
    return {
      playlists: m.ownerPlaylists.slice(0, limit),
      hasMore: m.ownerPlaylists.length > limit,
      isLoading: false,
      error: null,
      retry: vi.fn(),
    };
  },
}));
const song = (i: number): SongSummary => ({
  id: `song-${i}`,
  identifier: `enjoymusic_song_${i}`,
  publisher: 'Alice',
  title: `Track ${i}`,
  artist: 'Artist',
  service: 'AUDIO',
  mediaType: 'SONG',
});
const playlist = (i: number): PlaylistSummary => ({
  id: `playlist-${i}`,
  identifier: `enjoymusic_playlist_${i}`,
  publisher: 'Alice',
  title: `Collection ${i}`,
  songCount: null,
});
beforeEach(() => {
  getDefaultStore().set(skinAtom, 'modern');
  vi.clearAllMocks();
  m.accountKey = 'Wallet:Alice';
  m.name = 'Alice';
  m.songs = Array.from({ length: 25 }, (_, i) => song(i));
  m.recent = [song(99)];
  m.playlists = Array.from({ length: 22 }, (_, i) => playlist(i));
  m.ownerSongs = m.songs;
  m.ownerPlaylists = m.playlists;
});
afterEach(() => cleanup());
const library = () => (
  <MemoryRouter>
    <LibraryPage />
  </MemoryRouter>
);
const myMusic = () => (
  <MemoryRouter>
    <MyMusicPage />
  </MemoryRouter>
);

describe('Library uses the shared cards without extra reads', () => {
  it('pages saved collections independently and retains explicit sync controls', async () => {
    const user = userEvent.setup();
    render(library());
    await screen.findByRole('heading', { name: 'Track 0' }, { timeout: 5000 });
    const saved = screen.getByRole('region', { name: 'Saved Songs' });
    const lists = screen.getByRole('region', { name: 'Saved Playlists' });
    expect(within(saved).getAllByRole('article')).toHaveLength(20);
    expect(within(lists).getAllByRole('article')).toHaveLength(20);
    expect(m.feed).not.toHaveBeenCalled();
    expect(m.playlistFeed).not.toHaveBeenCalled();
    expect(m.detail).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
    await user.click(
      within(saved).getByRole('button', { name: 'Go to page 2' })
    );
    expect(within(saved).getAllByRole('article')).toHaveLength(5);
    expect(within(lists).getAllByRole('article')).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: 'Save to QDN' }));
    expect(m.save).toHaveBeenCalledOnce();
  });
  it('plays the clicked visible item with its page order and keeps full detail links', async () => {
    const user = userEvent.setup();
    render(library());
    await screen.findByRole('heading', { name: 'Track 0' }, { timeout: 5000 });
    const saved = screen.getByRole('region', { name: 'Saved Songs' });
    await user.click(
      within(saved).getByRole('button', { name: 'Go to page 2' })
    );
    await user.click(
      within(saved).getAllByRole('button', { name: 'Play', exact: true })[1]
    );
    const [queue, index] = m.play.mock.calls[0];
    expect(queue[index].identifier).toBe('enjoymusic_song_21');
    expect(queue).toHaveLength(5);
    expect(m.addRecent).toHaveBeenCalledWith(song(21));
    expect(
      within(saved)
        .getByRole('link', { name: 'Details: Track 21' })
        .getAttribute('href')
    ).toBe('/songs/Alice/enjoymusic_song_21');
  });
  it('resets collection pagination for another wallet/name and handles an empty collection', async () => {
    const user = userEvent.setup();
    const view = render(library());
    await screen.findByRole('heading', { name: 'Track 0' }, { timeout: 5000 });
    await user.click(
      within(screen.getByRole('region', { name: 'Saved Songs' })).getByRole(
        'button',
        { name: 'Go to page 2' }
      )
    );
    m.accountKey = 'Wallet:Bob';
    m.songs = [song(100)];
    m.recent = [];
    m.playlists = [];
    view.rerender(library());
    expect(screen.getByRole('heading', { name: 'Track 100' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Track 20' })).toBeNull();
    m.songs = [];
    view.rerender(library());
    expect(screen.getByRole('link', { name: 'Browse music' })).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
  });
});

describe('My Music keeps ownership and editing boundaries', () => {
  it('loads only the named owner, pages songs without expanding playlists, and keeps Edit links', async () => {
    const user = userEvent.setup();
    render(myMusic());
    await screen.findByRole('heading', { name: 'Track 0' }, { timeout: 5000 });
    const songs = screen.getByRole('region', { name: 'Your Songs' });
    expect(within(songs).getAllByRole('article')).toHaveLength(20);
    expect(m.feed).toHaveBeenLastCalledWith(20, 'Alice');
    expect(m.playlistFeed).toHaveBeenLastCalledWith(20, 'Alice');
    expect(m.detail).not.toHaveBeenCalled();
    expect(
      within(songs)
        .getAllByRole('link', { name: 'Edit song' })[0]
        .getAttribute('href')
    ).toBe('/my-music/songs/enjoymusic_song_0/edit');
    await user.click(
      within(songs).getByRole('button', { name: 'Go to page 2' })
    );
    expect(within(songs).getAllByRole('article')).toHaveLength(5);
    expect(m.feed).toHaveBeenLastCalledWith(40, 'Alice');
    expect(m.playlistFeed).toHaveBeenLastCalledWith(20, 'Alice');
  });
  it.each(['classic', 'modern'] as const)(
    'keeps Ear-Bump and foreign-owner edit restrictions in %s',
    async (skin) => {
      getDefaultStore().set(skinAtom, skin);
      m.ownerSongs = [
        song(0),
        { ...song(1), identifier: 'earbump_song_1' },
        { ...song(2), publisher: 'Bob' },
      ];
      m.ownerPlaylists = [{ ...playlist(0), identifier: 'earbump_playlist_0' }];
      render(myMusic());
      await screen.findByRole('link', { name: 'Edit song' }, { timeout: 4000 });
      expect(screen.getAllByRole('link', { name: 'Edit song' })).toHaveLength(
        1
      );
      expect(screen.queryByRole('link', { name: 'Edit playlist' })).toBeNull();
      expect(screen.getAllByText('Edit through Ear-Bump')).toHaveLength(2);
      expect(
        screen.queryByRole('link', { name: 'Details: Track 2' })
      ).toBeNull();
    }
  );
  it('does not query any owner feed in guest mode and clears pages on name changes', async () => {
    const user = userEvent.setup();
    m.name = undefined;
    const view = render(myMusic());
    expect(m.feed).not.toHaveBeenCalled();
    expect(m.playlistFeed).not.toHaveBeenCalled();
    expect(screen.getByText(/Log in through Qortal/)).toBeTruthy();
    m.name = 'Alice';
    view.rerender(myMusic());
    await user.click(
      within(screen.getByRole('region', { name: 'Your Songs' })).getByRole(
        'button',
        { name: 'Go to page 2' }
      )
    );
    m.name = 'Bob';
    m.ownerSongs = [{ ...song(100), publisher: 'Bob' }];
    m.ownerPlaylists = [];
    view.rerender(myMusic());
    expect(m.feed).toHaveBeenLastCalledWith(20, 'Bob');
    expect(screen.getByRole('heading', { name: 'Track 100' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Track 20' })).toBeNull();
  });
});
