import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SongsPage } from '../src/pages/SongsPage';
import { songQueue } from '../src/utils/songQueue';

const mocks = vi.hoisted(() => {
  const base = {
    publisher: 'Alice',
    artist: 'Artist',
    service: 'AUDIO' as const,
    mediaType: 'SONG' as const,
  };
  const first = {
    ...base,
    id: 'first',
    identifier: 'first',
    title: 'First page song',
  };
  const target = {
    ...base,
    id: 'target',
    identifier: 'target',
    title: 'Search target',
  };
  return {
    first,
    target,
    feed: [first],
    catalog: [first, target],
    play: vi.fn(),
    recent: vi.fn(),
    catalogEnabled: vi.fn(),
  };
});
vi.mock('../src/hooks/useSongsFeed', () => ({
  useSongsFeed: () => ({
    songs: mocks.feed,
    isLoading: false,
    error: null,
    hasMore: true,
    retry: vi.fn(),
  }),
}));
vi.mock('../src/hooks/useMediaCatalog', () => ({
  useMediaCatalog: (_loader: unknown, enabled: boolean) => {
    mocks.catalogEnabled(enabled);
    return {
      items: mocks.catalog,
      isLoading: false,
      complete: true,
      error: null,
      retry: vi.fn(),
    };
  },
}));
vi.mock('../src/hooks/useLibrary', () => ({
  useLibrary: () => ({ addRecentSong: mocks.recent }),
}));
vi.mock('../src/hooks/useMiniPlayer', () => ({
  useMiniPlayer: () => ({ playQueue: mocks.play }),
}));
vi.mock('../src/components/common/ArtworkThumb', () => ({
  ArtworkThumb: () => null,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('browsing visible songs', () => {
  it('plays the clicked catalog result outside the first page, without falling back', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SongsPage />
      </MemoryRouter>
    );
    expect(mocks.catalogEnabled).toHaveBeenLastCalledWith(false);
    await user.type(screen.getByLabelText('Search songs'), 'Search target');
    expect(screen.queryByText('First page song')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Play', exact: true }));
    const [queue, index] = mocks.play.mock.calls[0];
    expect(queue[index].identifier).toBe('target');
    expect(mocks.recent).toHaveBeenCalledWith(mocks.target);
    expect(mocks.catalogEnabled).toHaveBeenLastCalledWith(true);
  });
  it('uses the whole catalog for the artist-initial filter as well', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SongsPage />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: 'A', exact: true }));
    expect(screen.getByText('Search target')).toBeTruthy();
    expect(mocks.catalogEnabled).toHaveBeenLastCalledWith(true);
  });
  it('keeps the displayed order when building a queue', () => {
    expect(
      songQueue([mocks.target, mocks.first]).map((item) => item.identifier)
    ).toEqual(['target', 'first']);
  });
});
