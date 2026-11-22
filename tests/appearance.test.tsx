import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skinAtom, readSkinPreference } from '../src/state/appearance';
import { themeAtom } from '../src/state/global/system';
import {
  currentTimeAtom,
  currentTrackAtom,
  isPlayingAtom,
} from '../src/state/player';
import { AppShell } from '../src/components/shell/AppShell';
import { HomePage } from '../src/pages/HomePage';

const m = vi.hoisted(() => ({
  songs: vi.fn(),
  playlists: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock('../src/qortal', () => ({
  refreshAccount: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  useGlobal: () => ({ auth: {} }),
  useQortBalance: () => ({ getBalance: vi.fn(), isLoading: false }),
}));
vi.mock('../src/hooks/useIframeListener', () => ({ useIframe: () => {} }));
vi.mock('../src/hooks/useLibrary', () => ({
  useLibrary: () => ({
    syncState: 'local',
    pending: false,
    favoriteSongs: [],
    favoritePlaylists: [],
    recentSongs: [],
    addRecentSong: vi.fn(),
  }),
}));
vi.mock('../src/components/shell/LibrarySync', () => ({
  LibrarySync: () => null,
}));
vi.mock('../src/components/common/ArtworkThumb', () => ({
  ArtworkThumb: () => null,
}));
vi.mock('../src/services/songs', () => ({
  fetchSongsPage: m.songs,
  resolveSongStreamUrl: m.resolve,
}));
vi.mock('../src/services/playlists', () => ({
  fetchPlaylistsPage: m.playlists,
  fetchPlaylistDetail: vi.fn(),
}));
class TestAudio extends EventTarget {
  src = '';
  paused = true;
  currentTime = 0;
  duration = 123;
  volume = 1;
  preload = '';
  error = null;
  load = vi.fn();
  pause = vi.fn(() => {
    this.paused = true;
  });
  play = vi.fn(async () => {
    this.paused = false;
  });
  removeAttribute = vi.fn(() => {
    this.src = '';
  });
}
const elements: TestAudio[] = [];
const track = {
  key: 'A:song',
  id: 'song',
  publisher: 'A',
  identifier: 'enjoymusic_song_1',
  service: 'AUDIO' as const,
  title: 'Playing song',
  artist: 'Artist',
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem('qmusic-skin');
  elements.length = 0;
  m.songs.mockResolvedValue({
    items: [{ ...track, mediaType: 'SONG' }],
    nextOffset: 1,
    hasMore: false,
  });
  m.playlists.mockResolvedValue({ items: [], nextOffset: 0, hasMore: false });
  m.resolve.mockResolvedValue('https://node/audio');
  vi.stubGlobal(
    'Audio',
    class extends TestAudio {
      constructor() {
        super();
        elements.push(this);
      }
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('built-in skin preference', () => {
  it('defaults to Classic, accepts a remembered Modern choice and rejects unknown stored values', () => {
    expect(readSkinPreference()).toBe('classic');
    localStorage.setItem('qmusic-skin', 'modern');
    expect(readSkinPreference()).toBe('modern');
    localStorage.setItem('qmusic-skin', 'untrusted-theme');
    expect(readSkinPreference()).toBe('classic');
    const store = createStore();
    store.set(skinAtom, 'modern');
    expect(localStorage.getItem('qmusic-skin')).toBe('modern');
    store.set(skinAtom, 'invalid' as never);
    expect(store.get(skinAtom)).toBe('modern');
  });
  it('keeps the choice in memory if storage is blocked, without changing light/dark mode', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readSkinPreference()).toBe('classic');
    const store = createStore();
    const theme = store.get(themeAtom);
    store.set(skinAtom, 'modern');
    expect(store.get(skinAtom)).toBe('modern');
    expect(store.get(themeAtom)).toBe(theme);
  });
  it('switches live Home views without restarting audio, changing its position or reloading either catalog feed', async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(skinAtom, 'classic');
    store.set(currentTrackAtom, track);
    store.set(isPlayingAtom, true);
    const originalTheme = store.get(themeAtom);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <AppShell>
            <HomePage />
          </AppShell>
        </MemoryRouter>
      </Provider>
    );
    await screen.findByRole(
      'heading',
      { name: 'Library activity at a glance' },
      { timeout: 5000 }
    );
    await waitFor(() => expect(elements[0]?.src).toBe('https://node/audio'));
    act(() => {
      elements[0].currentTime = 42;
      elements[0].dispatchEvent(new Event('timeupdate'));
    });
    expect(m.songs).toHaveBeenCalledOnce();
    expect(m.playlists).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(
      screen.getByRole('radio', { name: 'Modern', exact: true })
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await screen.findByRole(
      'heading',
      { name: 'Latest songs' },
      { timeout: 5000 }
    );
    expect(
      screen.getByRole('button', { name: 'Collapse navigation' })
    ).toBeTruthy();
    expect(localStorage.getItem('qmusic-skin')).toBe('modern');
    expect(elements).toHaveLength(1);
    expect(elements[0].play).toHaveBeenCalledOnce();
    expect(elements[0].pause).not.toHaveBeenCalled();
    expect(elements[0].currentTime).toBe(42);
    expect(store.get(currentTimeAtom)).toBe(42);
    expect(store.get(isPlayingAtom)).toBe(true);
    expect(store.get(themeAtom)).toBe(originalTheme);
    expect(m.songs).toHaveBeenCalledOnce();
    expect(m.playlists).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(
      screen.getByRole('radio', { name: 'Classic', exact: true })
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await screen.findByRole('heading', {
      name: 'Library activity at a glance',
    });
    expect(elements).toHaveLength(1);
    expect(m.songs).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', { name: 'Collapse navigation' })
    ).toBeNull();
  });
});
