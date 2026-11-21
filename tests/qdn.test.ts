import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAllSongs,
  fetchSongByIdentifier,
  fetchSongsPage,
  resolveSongStreamUrl,
} from '../src/services/songs';
import { fetchPlaylistDetail, fetchPlaylists } from '../src/services/playlists';
import {
  fetchQdnResource,
  getQdnResourceUrl,
  invalidateQdnCache,
  searchQdnResources,
  waitForQdnResourceReady,
} from '../src/services/qdn';
import { ReadQueue } from '../src/services/qdnRequests';
import { mediaKey } from '../src/utils/mediaIdentity';
import { parseSongMetadata } from '../src/utils/songMetadata';

const resource = (identifier: string, name = 'publisher') => ({
  identifier,
  name,
  size: 5000,
  metadata: { title: identifier, description: 'author=Artist' },
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const request = vi.fn();
beforeEach(() => {
  vi.stubGlobal('qortalRequest', request);
  request.mockReset();
  invalidateQdnCache(() => true);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('QDN loading contracts', () => {
  it('does not cache an error or turn it into an empty music list', async () => {
    request
      .mockResolvedValueOnce({ error: 'busy' })
      .mockResolvedValueOnce([resource('enjoymusic_song_ok')]);
    await expect(searchQdnResources({ service: 'AUDIO' })).rejects.toThrow(
      'busy'
    );
    expect(await searchQdnResources({ service: 'AUDIO' })).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('rejects malformed list entries instead of corrupting raw pagination', async () => {
    request.mockResolvedValue([null, resource('enjoymusic_song_one')]);
    await expect(fetchSongsPage()).rejects.toThrow('invalid music list');
  });
  it('consumes raw offsets past hidden rows, and scans later catalog pages', async () => {
    request.mockImplementation(async (p) =>
      p.identifier === 'earbump_song_'
        ? []
        : p.offset === 0
          ? [
              ...Array.from({ length: 99 }, (_, i) =>
                resource(`enjoymusic_song_${i}`)
              ),
              {
                ...resource('enjoymusic_song_deleted'),
                metadata: { title: 'deleted' },
              },
            ]
          : p.offset === 100
            ? [resource('enjoymusic_song_last')]
            : []
    );
    const songs = await fetchAllSongs();
    expect(songs).toHaveLength(100);
    expect(songs.at(-1)?.identifier).toBe('enjoymusic_song_last');
    expect(
      request.mock.calls
        .filter(([p]) => p.identifier === 'enjoymusic_song_')
        .map(([p]) => p.offset)
    ).toEqual([0, 100]);
    expect(
      request.mock.calls.some(([p]) => p.identifier === 'earbump_song_')
    ).toBe(true);
  });
  it('preserves two publishers with the same identifier', async () => {
    request.mockImplementation(async (p) =>
      p.identifier === 'enjoymusic_song_'
        ? [
            resource('enjoymusic_song_same', 'A'),
            resource('enjoymusic_song_same', 'B'),
          ]
        : []
    );
    const page = await fetchSongsPage({ limit: 10 });
    expect(new Set(page.items.map((item) => item.id)).size).toBe(2);
    expect(page.nextOffset).toBe(2);
    expect(page.hasMore).toBe(false);
  });
  it('validates the exact detail identity rather than taking a newer prefix match', async () => {
    request.mockResolvedValue([
      resource('enjoymusic_song_x_extra'),
      resource('enjoymusic_song_x'),
    ]);
    expect(
      (await fetchSongByIdentifier('publisher', 'enjoymusic_song_x'))
        ?.identifier
    ).toBe('enjoymusic_song_x');
    request.mockResolvedValue([resource('enjoymusic_song_absent_extra')]);
    expect(
      await fetchSongByIdentifier('publisher', 'enjoymusic_song_absent')
    ).toBeNull();
  });
  it('returns playlist cards without downloading or building their payloads', async () => {
    request.mockImplementation(async (p) => {
      expect(p.action).toBe('SEARCH_QDN_RESOURCES');
      return p.identifier === 'enjoymusic_playlist_'
        ? [resource('enjoymusic_playlist_one')]
        : [];
    });
    const playlists = await fetchPlaylists({ limit: 24 });
    expect(playlists[0].songCount).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
    expect(
      request.mock.calls.every(([p]) => p.action === 'SEARCH_QDN_RESOURCES')
    ).toBe(true);
  });
  it('rejects an unavailable playlist rather than making it an empty writable playlist', async () => {
    request.mockImplementation(async (p) =>
      p.action === 'SEARCH_QDN_RESOURCES'
        ? [resource('enjoymusic_playlist_one')]
        : { status: 'BUILD_FAILED' }
    );
    await expect(
      fetchPlaylistDetail('publisher', 'enjoymusic_playlist_one')
    ).rejects.toThrow('BUILD_FAILED');
    expect(
      request.mock.calls.some(([p]) => p.action === 'FETCH_QDN_RESOURCE')
    ).toBe(false);
  });
  it('loads a legacy playlist without an N+1 search per track', async () => {
    request.mockImplementation(async (p) =>
      p.action === 'SEARCH_QDN_RESOURCES'
        ? [resource('enjoymusic_playlist_legacy')]
        : p.action === 'GET_QDN_RESOURCE_STATUS'
          ? { status: 'READY' }
          : { songs: [{ name: 'OldArtist', id: 'enjoymusic_song_old' }] }
    );
    const result = await fetchPlaylistDetail(
      'publisher',
      'enjoymusic_playlist_legacy'
    );
    expect(result?.songs[0]).toMatchObject({
      publisher: 'OldArtist',
      identifier: 'enjoymusic_song_old',
    });
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('retries a rejected URL request and does not preflight properties/build', async () => {
    vi.useFakeTimers();
    request
      .mockRejectedValueOnce({ error: 'Transient node failure' })
      .mockResolvedValueOnce('http://node/arbitrary/AUDIO/name/id');
    const pending = resolveSongStreamUrl('name', 'id');
    await vi.runAllTimersAsync();
    expect(await pending).toContain('/AUDIO/name/id');
    expect(request.mock.calls.map(([p]) => p.action)).toEqual([
      'GET_QDN_RESOURCE_URL',
      'GET_QDN_RESOURCE_URL',
    ]);
  });
  it('does not retain a previous node URL', async () => {
    request
      .mockResolvedValueOnce('http://first/audio')
      .mockResolvedValueOnce('http://second/audio');
    expect(await getQdnResourceUrl('AUDIO', 'name', 'id')).toBe(
      'http://first/audio'
    );
    expect(await getQdnResourceUrl('AUDIO', 'name', 'id')).toBe(
      'http://second/audio'
    );
  });
  it('does not let an invalidated older request refill the cache', async () => {
    const old = deferred<unknown>();
    request
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ version: 2 });
    const one = fetchQdnResource({
      service: 'PLAYLIST',
      name: 'a',
      identifier: 'x',
    });
    const rejected = expect(one).rejects.toMatchObject({ name: 'AbortError' });
    await flush();
    invalidateQdnCache(() => true);
    old.resolve({ version: 1 });
    await rejected;
    expect(
      await fetchQdnResource({
        service: 'PLAYLIST',
        name: 'a',
        identifier: 'x',
      })
    ).toEqual({ version: 2 });
  });
  it('aborting one shared consumer does not abort another', async () => {
    const response = deferred<unknown>();
    request.mockReturnValue(response.promise);
    const controller = new AbortController();
    const params = { service: 'AUDIO', query: 'same' };
    const first = searchQdnResources(params, { signal: controller.signal });
    const second = searchQdnResources(params);
    const rejected = expect(first).rejects.toMatchObject({
      name: 'AbortError',
    });
    controller.abort();
    await rejected;
    response.resolve([]);
    expect(await second).toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('a readiness deadline expires even while a status request is hung', async () => {
    vi.useFakeTimers();
    const held = deferred<unknown>();
    request.mockReturnValue(held.promise);
    const controller = new AbortController();
    const pending = waitForQdnResourceReady({
      service: 'AUDIO',
      name: 'deadline',
      identifier: 'x',
      timeoutMs: 500,
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(501);
    expect(await pending).toEqual({ status: 'UNKNOWN' });
    // The actual bridge call remains in flight; an app abort must not pretend
    // it released Core's slot. Resolve it so this test leaves no active work.
    held.resolve({ status: 'READY' });
    await flush();
  });
  it('parses dates and uses publisher-qualified keys without changing resource IDs', () => {
    expect(parseSongMetadata('publishedDate=2026-11-20').publishedDate).toBe(
      '2026-11-20'
    );
    expect(mediaKey('AUDIO', 'Alice', 'shared')).not.toBe(
      mediaKey('AUDIO', 'Bob', 'shared')
    );
    expect(mediaKey('AUDIO', 'Alice', 'shared')).toBe(
      mediaKey('AUDIO', 'alice', 'shared')
    );
  });
});

describe('bounded read scheduling', () => {
  it('reserves playback capacity and cancels queued background work', async () => {
    const queue = new ReadQueue();
    const held = deferred<void>();
    const calls: string[] = [];
    const controllers = Array.from({ length: 5 }, () => new AbortController());
    const work = controllers.map((controller, index) =>
      queue
        .run(
          async () => {
            calls.push(`bg${index}`);
            await held.promise;
          },
          { priority: 'background', signal: controller.signal }
        )
        .catch(() => undefined)
    );
    await flush();
    expect(calls).toEqual(['bg0', 'bg1']);
    controllers[2].abort();
    await queue.run(
      async () => {
        calls.push('play');
      },
      { priority: 'playback' }
    );
    expect(calls).toContain('play');
    expect(calls).not.toContain('bg2');
    held.resolve();
    await Promise.all(work);
    expect(calls).not.toContain('bg2');
  });
});
