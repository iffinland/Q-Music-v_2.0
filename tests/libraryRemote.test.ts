import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRemoteLibrary } from '../src/services/library';
import {
  emptyLibraryState,
  libraryAccount,
  libraryPayload,
} from '../src/services/library/model';
const mocks = vi.hoisted(() => ({
  exact: vi.fn(),
  status: vi.fn(),
  wait: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('../src/services/qdn', () => ({
  findExactQdnResource: mocks.exact,
  getQdnResourceStatus: mocks.status,
  waitForQdnResourceReady: mocks.wait,
  fetchQdnResource: mocks.fetch,
}));
const account = libraryAccount({ address: 'ReadTest', name: 'Alice' });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.exact.mockResolvedValue({
    name: 'Alice',
    identifier: 'enjoymusic_library_state',
  });
  mocks.status.mockResolvedValue({ status: 'READY' });
  mocks.wait.mockResolvedValue({ status: 'READY' });
  mocks.fetch.mockResolvedValue(libraryPayload(emptyLibraryState(), account));
});
describe('online library read contract', () => {
  it('checks exact identities and bypasses both search and payload caches', async () => {
    const controller = new AbortController();
    await loadRemoteLibrary(account, controller.signal);
    expect(mocks.exact).toHaveBeenCalledWith(
      'DOCUMENT',
      'Alice',
      'enjoymusic_library_state',
      expect.objectContaining({ fresh: true, signal: controller.signal })
    );
    expect(mocks.fetch.mock.calls[0][1]).toMatchObject({
      fresh: true,
      signal: controller.signal,
    });
  });
  it('only reports no library when both the exact index and direct node status indicate no publication', async () => {
    mocks.exact.mockResolvedValue(null);
    mocks.status.mockResolvedValue({ status: 'NOT_PUBLISHED' });
    expect(await loadRemoteLibrary(account)).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('reads the exact resource even when the search index has not caught up', async () => {
    mocks.exact.mockResolvedValue(null);
    expect((await loadRemoteLibrary(account))?.favoriteSongs).toEqual([]);
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
  it.each(['MISSING_DATA', 'DOWNLOADING', 'BUILD_FAILED', 'NOT_PUBLISHED'])(
    'never converts an unreadable existing library (%s) into empty data',
    async (status) => {
      mocks.wait.mockResolvedValue({ status });
      await expect(loadRemoteLibrary(account)).rejects.toThrow(status);
      expect(mocks.fetch).not.toHaveBeenCalled();
    }
  );
  it.each([
    null,
    {},
    { favoriteSongs: 'bad', favoritePlaylists: [], recentSongs: [] },
  ])(
    'rejects malformed/null payloads rather than allowing an empty overwrite',
    async (payload) => {
      mocks.fetch.mockResolvedValue(payload);
      await expect(loadRemoteLibrary(account)).rejects.toThrow(
        'invalid library'
      );
    }
  );
  it('rejects a v2 library owned by a different wallet under a transferred name', async () => {
    mocks.fetch.mockResolvedValue(
      libraryPayload(emptyLibraryState(), {
        ...account,
        address: 'Previous owner',
      })
    );
    await expect(loadRemoteLibrary(account)).rejects.toThrow(
      'different account'
    );
  });
  it('propagates node/bridge errors and never labels them as no publication', async () => {
    mocks.exact.mockRejectedValue(new Error('Node timeout'));
    await expect(loadRemoteLibrary(account)).rejects.toThrow('Node timeout');
  });
  it('keeps legacy remote favorites readable with canonical full media identities', async () => {
    mocks.fetch.mockResolvedValue({
      favoriteSongs: ['Alice', 'Bob'].map((publisher) => ({
        id: 'shared',
        identifier: 'shared',
        title: 'Song',
        artist: 'Artist',
        publisher,
      })),
      favoritePlaylists: [],
      recentSongs: [],
      updatedAt: 1,
    });
    const remote = await loadRemoteLibrary(account);
    expect(new Set(remote!.favoriteSongs.map((song) => song.id)).size).toBe(2);
  });
});
