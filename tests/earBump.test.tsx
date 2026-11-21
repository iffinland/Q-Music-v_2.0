import { useSongsFeed } from '../src/hooks/useSongsFeed';
import { ArtworkThumb } from '../src/components/common/ArtworkThumb';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAllSongs,
  fetchSongsPage,
  fetchSongByIdentifier,
  resolveSongStreamUrl,
} from '../src/services/songs';
import {
  fetchPlaylistDetail,
  fetchPlaylistsPage,
  resolvePlaylistSongCount,
} from '../src/services/playlists';
import { invalidateQdnCache } from '../src/services/qdn';
import type { QdnSearchResource } from '../src/types/media';
import {
  SONG_PREFIXES,
  PLAYLIST_PREFIXES,
  isEarBumpIdentifier,
  safeEarBumpImage,
} from '../src/utils/mediaOrigin';
import { SectionCard } from '../src/components/common/SectionCard';
import { songQueue } from '../src/utils/songQueue';
import { readMediaPrefixesPage } from '../src/services/mediaPages';
import { useMediaPublish } from '../src/hooks/useMediaPublish';
import { renderHook } from '@testing-library/react';

vi.mock('../src/qortal', () => ({
  useGlobal: () => ({ auth: { name: 'Owner', address: 'Wallet' } }),
}));
const native = vi.fn();
let resources: QdnSearchResource[];
const row = (
  prefix: string,
  suffix: string,
  created: number,
  name = 'Artist'
) => ({
  identifier: prefix + suffix,
  name,
  created,
  size: 5000,
  metadata: {
    title: suffix,
    description: `title=${suffix};author=Original artist`,
  },
});
beforeEach(() => {
  invalidateQdnCache(() => true);
  resources = [];
  native.mockReset();
  native.mockImplementation(async (p) => {
    if (p.action === 'SEARCH_QDN_RESOURCES')
      return resources
        .filter(
          (r) =>
            r.identifier?.startsWith(p.identifier) &&
            (!p.name || r.name?.toLowerCase() === p.name.toLowerCase()) &&
            (!p.before || (r.created || 0) < p.before)
        )
        .sort((a, b) => (b.created || 0) - (a.created || 0))
        .slice(p.offset || 0, (p.offset || 0) + p.limit);
    if (p.action === 'GET_QDN_RESOURCE_STATUS') return { status: 'READY' };
    if (p.action === 'GET_QDN_RESOURCE_URL')
      return `https://node/arbitrary/${p.service}/${p.name}/${p.identifier}`;
    throw new Error('Unexpected native action: ' + p.action);
  });
  vi.stubGlobal('qortalRequest', native);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('merged Q-Music and Ear-Bump catalogs', () => {
  it('pages both indexes in global newest order without skipping buffered rows or repeating pages', async () => {
    resources = [
      row(SONG_PREFIXES[0], 'q-new', 100),
      row(SONG_PREFIXES[0], 'q-second', 90),
      row(SONG_PREFIXES[0], 'q-old', 10),
      row(SONG_PREFIXES[1], 'e-new', 95),
      row(SONG_PREFIXES[1], 'e-middle', 80),
      row(SONG_PREFIXES[1], 'e-old', 5),
    ];
    const pages = [];
    let cursor;
    let offset = 0;
    for (let i = 0; i < 5; i++) {
      const page = await fetchSongsPage({
        limit: 2,
        before: 101,
        cursor,
        offset,
      });
      pages.push(...page.items);
      if (!page.hasMore) break;
      cursor = page.nextCursor;
      offset = page.nextOffset;
    }
    expect(pages.map((s) => s.title)).toEqual([
      'q-new',
      'e-new',
      'q-second',
      'e-middle',
      'q-old',
      'e-old',
    ]);
    expect(new Set(pages.map((s) => s.id)).size).toBe(6);
    expect(
      native.mock.calls.every(
        ([p]) => p.prefix === true && p.includeStatus === false && p.limit <= 2
      )
    ).toBe(true);
    expect(
      native.mock.calls.every(([p]) => p.action === 'SEARCH_QDN_RESOURCES')
    ).toBe(true);
  });
  it('continues the real merged feed on Load more and resets source buffers when publisher changes', async () => {
    resources = [
      row(SONG_PREFIXES[0], 'A-q', 30, 'A'),
      row(SONG_PREFIXES[1], 'A-e', 20, 'A'),
      row(SONG_PREFIXES[1], 'B-e', 25, 'B'),
      row(SONG_PREFIXES[0], 'B-q', 10, 'B'),
    ];
    const { result, rerender } = renderHook(
      ({ limit, publisher }) => useSongsFeed(limit, publisher),
      { initialProps: { limit: 1, publisher: 'A' } }
    );
    await waitFor(() =>
      expect(result.current.songs.map((s) => s.title)).toEqual(['A-q'])
    );
    rerender({ limit: 2, publisher: 'A' });
    await waitFor(() =>
      expect(result.current.songs.map((s) => s.title)).toEqual(['A-q', 'A-e'])
    );
    rerender({ limit: 1, publisher: 'B' });
    await waitFor(() =>
      expect(result.current.songs.map((s) => s.title)).toEqual(['B-e'])
    );
    expect(result.current.error).toBeNull();
    expect(result.current.songs.every((s) => s.publisher === 'B')).toBe(true);
  });
  it('does not stop when one source is empty, and keeps publisher and snapshot filters on every source', async () => {
    resources = [
      row(SONG_PREFIXES[1], 'first', 20, 'Owner'),
      row(SONG_PREFIXES[1], 'second', 10, 'Owner'),
      row(SONG_PREFIXES[1], 'other', 15, 'Other'),
      row(SONG_PREFIXES[0], 'future', 50, 'Owner'),
    ];
    const songs = await fetchAllSongs({ publisher: 'Owner', before: 30 });
    expect(songs.map((s) => s.title)).toEqual(['first', 'second']);
    expect(
      native.mock.calls.every(
        ([p]) =>
          p.name === 'Owner' && p.exactMatchNames === true && p.before === 30
      )
    ).toBe(true);
  });
  it('advances raw source offsets through hidden rows and retains equal IDs under different publishers', async () => {
    resources = [
      {
        ...row(SONG_PREFIXES[1], 'deleted', 30),
        metadata: { title: 'deleted' },
      },
      row(SONG_PREFIXES[1], 'same', 20, 'A'),
      row(SONG_PREFIXES[1], 'same', 10, 'B'),
    ];
    const first = await fetchSongsPage({ limit: 1 });
    const second = await fetchSongsPage({
      limit: 1,
      cursor: first.nextCursor,
      offset: first.nextOffset,
    });
    expect(first.items[0].publisher).toBe('A');
    expect(second.items[0].publisher).toBe('B');
    expect(first.items[0].id).not.toBe(second.items[0].id);
    expect(
      native.mock.calls
        .filter(([p]) => p.identifier === SONG_PREFIXES[1])
        .map(([p]) => p.offset)
    ).toEqual([0, 1, 2]);
  });
  it('leaves the input cursor unchanged on failure, so Retry cannot skip a source', async () => {
    resources = [
      row(SONG_PREFIXES[0], 'q', 30),
      row(SONG_PREFIXES[1], 'e', 20),
      row(SONG_PREFIXES[1], 'later', 10),
    ];
    const first = await fetchSongsPage({ limit: 1 });
    const saved = JSON.stringify(first.nextCursor);
    native.mockRejectedValueOnce(new Error('Offline'));
    await expect(
      fetchSongsPage({ limit: 1, cursor: first.nextCursor })
    ).rejects.toThrow('Offline');
    expect(JSON.stringify(first.nextCursor)).toBe(saved);
    expect(
      (await fetchSongsPage({ limit: 1, cursor: first.nextCursor })).items[0]
        .title
    ).toBe('e');
  });
  it('aborts queued catalog preparation without calling the bridge', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchSongsPage({ signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(native).not.toHaveBeenCalled();
  });
  it('rejects unrelated namespaces, wrong publisher/service, and bare prefixes even if a node returns them', async () => {
    native.mockResolvedValue([
      row('other_song_', 'x', 50),
      row(SONG_PREFIXES[1], 'x', 40, 'Wrong'),
      { ...row(SONG_PREFIXES[1], 'y', 30), service: 'VIDEO' },
      row(SONG_PREFIXES[1], '', 20),
      row(SONG_PREFIXES[1], 'good', 10),
    ]);
    const page = await fetchSongsPage({ publisher: 'Artist', limit: 20 });
    expect(page.items.map((s) => s.title)).toEqual(['good']);
  });
});

describe('Ear-Bump resource compatibility', () => {
  it('loads AUDIO metadata and plays the original resource identity without a copy or a conversion', async () => {
    resources = [row(SONG_PREFIXES[1], 'original_abcdefgh', 1)];
    const song = await fetchSongByIdentifier(
      'Artist',
      resources[0].identifier!
    );
    expect(song?.artist).toBe('Original artist');
    const track = songQueue([song!])[0];
    expect(track.identifier).toBe(resources[0].identifier);
    expect(
      await resolveSongStreamUrl(track.publisher, track.identifier)
    ).toContain('/AUDIO/Artist/earbump_song_original_abcdefgh');
    expect(
      native.mock.calls.every(([p]) => !p.action.startsWith('PUBLISH'))
    ).toBe(true);
  });
  it('reads mixed-source playlist references and its embedded WebP without N+1 track lookups', async () => {
    resources = [row(PLAYLIST_PREFIXES[1], 'mix_abcdefgh', 1)];
    const image = 'data:image/webp;base64,AA==';
    const base = native.getMockImplementation()!;
    native.mockImplementation(async (p) =>
      p.action === 'FETCH_QDN_RESOURCE'
        ? {
            title: 'Original playlist',
            description: 'From Ear-Bump',
            image,
            songs: [
              {
                name: 'Alice',
                service: 'AUDIO',
                identifier: 'earbump_song_one_abcdefgh',
                title: 'One',
                author: 'Alice artist',
              },
              {
                name: 'Bob',
                service: 'AUDIO',
                identifier: 'enjoymusic_song_two_abcdefgh',
                title: 'Two',
                artist: 'Bob artist',
              },
              {
                name: 'Bob',
                service: 'VIDEO',
                identifier: 'not-audio',
                title: 'Ignore',
              },
            ],
          }
        : base(p)
    );
    const list = await fetchPlaylistsPage();
    expect(list.items[0].songCount).toBeNull();
    expect(
      native.mock.calls.every(([p]) => p.action === 'SEARCH_QDN_RESOURCES')
    ).toBe(true);
    native.mockClear();
    const playlist = await fetchPlaylistDetail(
      'Artist',
      resources[0].identifier!
    );
    expect(playlist?.image).toBe(image);
    expect(
      playlist?.songs.map((s) => [s.publisher, s.identifier, s.artist])
    ).toEqual([
      ['Alice', 'earbump_song_one_abcdefgh', 'Alice artist'],
      ['Bob', 'enjoymusic_song_two_abcdefgh', 'Bob artist'],
    ]);
    expect(playlist?.songCount).toBe(2);
    expect(native.mock.calls.map(([p]) => p.action)).toEqual([
      'SEARCH_QDN_RESOURCES',
      'GET_QDN_RESOURCE_STATUS',
      'FETCH_QDN_RESOURCE',
    ]);
    expect(
      await resolvePlaylistSongCount('Artist', resources[0].identifier!)
    ).toBe(2);
  });
  it('builds readable fallback titles for old Ear-Bump references without titles', async () => {
    resources = [
      { ...row(SONG_PREFIXES[1], 'old_song_abcdefgh', 1), metadata: {} },
    ];
    expect((await fetchSongsPage()).items[0].title).toBe('old song');
  });
  it.each([
    'https://external/image.png',
    'data:image/svg+xml;base64,AA==',
    'javascript:alert(1)',
    'data:image/png;base64,' + 'A'.repeat(2 * 1024 * 1024),
  ])('rejects unsafe or oversized embedded artwork', (image) => {
    expect(safeEarBumpImage(image)).toBeUndefined();
  });
  it('does not download Ear-Bump playlist payloads or request a nonexistent thumbnail just to show a card', async () => {
    render(
      <ArtworkThumb
        kind="playlist"
        publisher="Artist"
        identifier="earbump_playlist_original"
        title="Original"
      />
    );
    await waitFor(() => expect(screen.getByText('OR')).toBeTruthy());
    expect(native).not.toHaveBeenCalled();
  });
  it('shows explicit publication source on both apps cards without guessing unknown sources', () => {
    const { rerender } = render(
      <SectionCard
        title="Song"
        body="Artist"
        originIdentifier="earbump_song_one_abcdefgh"
      />
    );
    expect(screen.getByText('Published @ Ear-Bump')).toBeTruthy();
    rerender(
      <SectionCard
        title="Playlist"
        body="Artist"
        originIdentifier="earbump_playlist_one_abcdefgh"
      />
    );
    expect(screen.getByText('Published @ Ear-Bump')).toBeTruthy();
    rerender(
      <SectionCard
        title="Song"
        body="Artist"
        originIdentifier="enjoymusic_song_one_abcdefgh"
      />
    );
    expect(screen.getByText('Published @ Q-Music')).toBeTruthy();
    rerender(
      <SectionCard
        title="Playlist"
        body="Artist"
        originIdentifier="enjoymusic_playlist_one_abcdefgh"
      />
    );
    expect(screen.getByText('Published @ Q-Music')).toBeTruthy();
    rerender(
      <SectionCard
        title="Unknown"
        body="Artist"
        originIdentifier="other_song_one"
      />
    );
    expect(screen.queryByText(/Published @/)).toBeNull();
    expect(isEarBumpIdentifier('xearbump_song_one')).toBe(false);
  });
  it('does not allow existing Ear-Bump resources to be rewritten in Q-Music format', async () => {
    const { result } = renderHook(() => useMediaPublish());
    await expect(
      result.current.buildPlaylistPublish({
        title: 'Keep',
        songs: [{ publisher: 'Artist', identifier: 'earbump_song_one' }],
        existingIdentifier: 'earbump_playlist_original',
      })
    ).rejects.toThrow('Ear-Bump');
    await expect(
      result.current.buildSongPublish({
        title: 'Keep',
        artist: 'Artist',
        audioFile: new File(['audio'], 'a.mp3'),
        existingIdentifier: 'earbump_song_original',
      })
    ).rejects.toThrow('Ear-Bump');
    expect(native).not.toHaveBeenCalled();
  });
  it('requires source cursors rather than applying one offset to both indexes', async () => {
    await expect(
      readMediaPrefixesPage('AUDIO', SONG_PREFIXES, () => ({ id: 'x' }), {
        offset: 10,
      })
    ).rejects.toThrow('source cursor');
  });
});
