import React from 'react';
import {
  act,
  cleanup,
  renderHook,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibrarySync } from '../src/components/shell/LibrarySync';
import { LibraryControls } from '../src/components/shell/LibraryControls';
import { useLibrary } from '../src/hooks/useLibrary';
import {
  libraryAccount,
  libraryPayload,
  libraryFingerprint,
  containsLibrary,
  mergeLibraryStates,
  normalizeLibrary,
  type LibraryAccount,
} from '../src/services/library/model';
import {
  changeLibrary,
  getLibrarySnapshot,
  updateLibrarySnapshot,
  libraryStorageKey,
  readLegacyLibrary,
  importLibraryItems,
} from '../src/services/library/store';
import {
  activateLibrary,
  refreshLibrary,
  saveLibraryToQdn,
} from '../src/services/library/sync';
const mocks = vi.hoisted(() => ({
  auth: { address: '', name: '' },
  load: vi.fn(),
  publish: vi.fn(),
  wallet: vi.fn(),
}));
vi.mock('../src/qortal', () => ({ useGlobal: () => ({ auth: mocks.auth }) }));
vi.mock('../src/services/library', () => ({
  loadRemoteLibrary: mocks.load,
  getLibraryMetadata: (name: string) => ({
    name,
    service: 'DOCUMENT',
    identifier: 'enjoymusic_library_state',
  }),
}));
vi.mock('../src/services/publishing/engine', () => ({
  publishAuxiliary: mocks.publish,
}));
const song = (id = 'song', publisher = 'Artist') => ({
  id,
  publisher,
  identifier: id,
  title: id,
  artist: 'Artist',
  service: 'AUDIO' as const,
  mediaType: 'SONG' as const,
});
let count = 0,
  account: LibraryAccount;
let stop: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  account = libraryAccount({ address: `Wallet-${++count}`, name: 'Alice' });
  mocks.auth = { address: account.address, name: account.name };
  mocks.load.mockResolvedValue(null);
  mocks.wallet.mockImplementation(async () => ({
    address: mocks.auth.address,
  }));
  vi.stubGlobal('qortalRequestWithTimeout', mocks.wallet);
  mocks.publish.mockImplementation(async (_resources, prepare) => {
    await prepare();
    return [{ signature: 'receipt' }];
  });
});
afterEach(() => {
  cleanup();
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const start = async () => {
  stop = activateLibrary(account);
  await refreshLibrary(account);
};
describe('account scoped libraries', () => {
  it('never auto-assigns legacy favorites or guest history to a logged-in wallet', () => {
    localStorage.setItem(
      'qmusic20.favoriteSongs',
      JSON.stringify([song('legacy')])
    );
    changeLibrary(libraryAccount(null), 'recent', song('guest'), false);
    expect(getLibrarySnapshot(account).data.favoriteSongs).toEqual([]);
    expect(getLibrarySnapshot(account).data.recentSongs).toEqual([]);
    expect(readLegacyLibrary()?.favoriteSongs[0].identifier).toBe('legacy');
    expect(localStorage.getItem('qmusic20.favoriteSongs')).toContain('legacy');
  });
  it('separates both wallet addresses and names, including a name transferred to another wallet', () => {
    const sameName = libraryAccount({ address: 'Other wallet', name: 'Alice' });
    const sameWallet = libraryAccount({
      address: account.address,
      name: 'Bob',
    });
    changeLibrary(account, 'song', song('private'), false);
    expect(getLibrarySnapshot(sameName).data.favoriteSongs).toEqual([]);
    expect(getLibrarySnapshot(sameWallet).data.favoriteSongs).toEqual([]);
    expect(getLibrarySnapshot(account).data.favoriteSongs[0].identifier).toBe(
      'private'
    );
  });
  it('switches visible collections immediately without waiting for an effect or remote response', () => {
    changeLibrary(account, 'song', song('A'), false);
    const { result, rerender } = renderHook(useLibrary);
    expect(result.current.favoriteSongs[0].identifier).toBe('A');
    mocks.auth = { address: 'Different-wallet', name: 'Bob' };
    rerender();
    expect(result.current.favoriteSongs).toEqual([]);
    expect(result.current.recentSongs).toEqual([]);
  });
  it('ignores a late response from the previous account', async () => {
    let resolve!: (value: unknown) => void;
    mocks.load.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    stop = activateLibrary(account);
    await Promise.resolve();
    const next = libraryAccount({ address: 'B-late', name: 'Bob' });
    stop();
    stop = activateLibrary(next);
    await refreshLibrary(next);
    resolve(
      normalizeLibrary({
        favoriteSongs: [song('late-A')],
        favoritePlaylists: [],
        recentSongs: [],
        updatedAt: 1,
      })
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(getLibrarySnapshot(next).data.favoriteSongs).toEqual([]);
    expect(getLibrarySnapshot(account).data.favoriteSongs).toEqual([]);
  });
  it('persists account-owned data that a fresh load can validate', async () => {
    changeLibrary(account, 'song', song('durable'), false);
    const raw = JSON.parse(localStorage.getItem(libraryStorageKey(account))!);
    expect(
      normalizeLibrary(raw.data, account).favoriteSongs[0].identifier
    ).toBe('durable');
    expect(() =>
      normalizeLibrary(
        raw.data,
        libraryAccount({ address: 'wrong', name: account.name })
      )
    ).toThrow('different account');
  });
  it('preserves malformed disk bytes and reports that edits are only in memory', () => {
    const fresh = libraryAccount({
      address: `corrupt-${count}`,
      name: 'Alice',
    });
    localStorage.setItem(libraryStorageKey(fresh), 'broken original bytes');
    changeLibrary(fresh, 'song', song('new'), false);
    expect(localStorage.getItem(libraryStorageKey(fresh))).toBe(
      'broken original bytes'
    );
    expect(getLibrarySnapshot(fresh).storageError).toBeTruthy();
    expect(getLibrarySnapshot(fresh).data.favoriteSongs).toHaveLength(1);
  });
  it('keeps changes in memory and reports a quota failure without erasing older disk data', () => {
    changeLibrary(account, 'song', song('saved'), false);
    const original = localStorage.getItem(libraryStorageKey(account));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    changeLibrary(account, 'song', song('memory'), false);
    expect(getLibrarySnapshot(account).data.favoriteSongs).toHaveLength(2);
    expect(getLibrarySnapshot(account).storageError).toBeTruthy();
    expect(localStorage.getItem(libraryStorageKey(account))).toBe(original);
  });
});
describe('local favorite operations', () => {
  it('uses current stored state for two actions from the same render', () => {
    const { result } = renderHook(useLibrary);
    act(() => {
      result.current.toggleSong(song());
      result.current.toggleSong(song());
    });
    expect(result.current.favoriteSongs).toEqual([]);
  });
  it('retains playlist removals as well as song removals', () => {
    const playlist = {
      id: 'old',
      identifier: 'same',
      publisher: 'Artist',
      title: 'Playlist',
      songCount: null,
    };
    changeLibrary(account, 'playlist', playlist, false);
    const before = getLibrarySnapshot(account).data;
    changeLibrary(account, 'playlist', playlist, true);
    expect(
      mergeLibraryStates(getLibrarySnapshot(account).data, before)
        .favoritePlaylists
    ).toEqual([]);
  });
  it('treats case changes to the same Qortal name as the same scope without merging different wallets', () => {
    expect(
      libraryAccount({ address: account.address, name: 'aLiCe' }).key
    ).toBe(account.key);
    expect(libraryAccount({ name: 'Alice' }).key).toBe('guest');
  });
});
describe('removal-aware merging', () => {
  it('does not resurrect a removed favorite from an old snapshot with a newer global timestamp', () => {
    changeLibrary(account, 'song', song(), false);
    const before = getLibrarySnapshot(account).data;
    changeLibrary(account, 'song', song(), true);
    const removed = getLibrarySnapshot(account).data;
    const legacy = normalizeLibrary({
      favoriteSongs: [song()],
      favoritePlaylists: [],
      recentSongs: [],
      updatedAt: Date.now() + 999999,
    });
    expect(mergeLibraryStates(removed, before).favoriteSongs).toEqual([]);
    expect(mergeLibraryStates(removed, legacy).favoriteSongs).toEqual([]);
  });
  it('preserves a newer deliberate re-add and merges independent device edits in either order', () => {
    changeLibrary(account, 'song', song('one'), false);
    const old = getLibrarySnapshot(account).data;
    changeLibrary(account, 'song', song('one'), true);
    const removed = getLibrarySnapshot(account).data;
    changeLibrary(account, 'song', song('one'), false);
    const added = getLibrarySnapshot(account).data;
    expect(mergeLibraryStates(removed, added).favoriteSongs).toHaveLength(1);
    const another = libraryAccount({ address: 'merge-peer', name: 'Alice' });
    changeLibrary(another, 'song', song('two'), false);
    const other = getLibrarySnapshot(another).data;
    expect(libraryFingerprint(mergeLibraryStates(old, other))).toBe(
      libraryFingerprint(mergeLibraryStates(other, old))
    );
    expect(mergeLibraryStates(old, other).favoriteSongs).toHaveLength(2);
  });
  it('retains newer local changes made while the online read is pending', async () => {
    let resolve!: (value: unknown) => void;
    mocks.load.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    stop = activateLibrary(account);
    await Promise.resolve();
    changeLibrary(account, 'song', song('during-read'), false);
    resolve(
      normalizeLibrary({
        favoriteSongs: [song('remote')],
        favoritePlaylists: [],
        recentSongs: [],
        updatedAt: 1,
      })
    );
    await refreshLibrary(account);
    expect(
      getLibrarySnapshot(account)
        .data.favoriteSongs.map((item) => item.identifier)
        .sort()
    ).toEqual(['during-read', 'remote']);
  });
  it('recognizes older recent rows as superseded by twelve later plays without expiring favorite removals', () => {
    changeLibrary(account, 'recent', song('old-play'), false);
    changeLibrary(account, 'song', song('removed'), true);
    const before = getLibrarySnapshot(account).data;
    for (let i = 0; i < 13; i++)
      changeLibrary(account, 'recent', song(`new-${i}`), false);
    const after = getLibrarySnapshot(account).data;
    expect(containsLibrary(after, before)).toBe(true);
    const withoutRemoval = {
      ...after,
      entries: Object.fromEntries(
        Object.entries(after.entries!).filter(
          ([, entry]) => entry.kind === 'recent'
        )
      ),
    };
    expect(containsLibrary(withoutRemoval, before)).toBe(false);
  });
  it('keeps recent history ordered by play time, bounded and separate from favorites', () => {
    for (let i = 0; i < 15; i++)
      changeLibrary(account, 'recent', song(String(i)), false);
    changeLibrary(account, 'recent', song('12'), false);
    const data = getLibrarySnapshot(account).data;
    expect(data.recentSongs).toHaveLength(12);
    expect(data.recentSongs[0].identifier).toBe('12');
    expect(data.favoriteSongs).toEqual([]);
    expect(Object.keys(data.entries!)).toHaveLength(12);
  });
  it('merges a valid storage event for this account and ignores a mismatched owner', () => {
    changeLibrary(account, 'song', song('local'), false);
    const remote = normalizeLibrary({
      favoriteSongs: [song('other-tab')],
      favoritePlaylists: [],
      recentSongs: [],
      updatedAt: 0,
    });
    const raw = JSON.stringify({ data: libraryPayload(remote, account) });
    localStorage.setItem(libraryStorageKey(account), raw);
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: libraryStorageKey(account),
        newValue: raw,
      })
    );
    expect(getLibrarySnapshot(account).data.favoriteSongs).toHaveLength(2);
    const bad = JSON.stringify({
      data: libraryPayload(
        normalizeLibrary({
          favoriteSongs: [song('wrong-owner')],
          favoritePlaylists: [],
          recentSongs: [],
          updatedAt: 0,
        }),
        { ...account, address: 'Wrong' }
      ),
    });
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: libraryStorageKey(account),
        newValue: bad,
      })
    );
    expect(
      getLibrarySnapshot(account).data.favoriteSongs.some(
        (item) => item.identifier === 'wrong-owner'
      )
    ).toBe(false);
  });
});
describe('explicit, guarded QDN sync', () => {
  it('does not publish on mount, after a local favorite change, or after listening', async () => {
    await start();
    changeLibrary(account, 'song', song(), false);
    changeLibrary(account, 'recent', song(), false);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it('blocks sending after a failed read, retains data and retries without treating failure as empty', async () => {
    changeLibrary(account, 'song', song('kept'), false);
    mocks.load.mockRejectedValue(new Error('Node offline'));
    await start();
    expect(getLibrarySnapshot(account).phase).toBe('error');
    await saveLibraryToQdn(account);
    expect(getLibrarySnapshot(account).data.favoriteSongs[0].identifier).toBe(
      'kept'
    );
    expect(getLibrarySnapshot(account).attempt).toBeUndefined();
    mocks.load.mockResolvedValue(null);
    await refreshLibrary(account);
    expect(getLibrarySnapshot(account).phase).toBe('ready');
  });
  it('avoids a redundant transaction if the fresh read already contains every local change', async () => {
    await start();
    changeLibrary(account, 'song', song(), false);
    mocks.load.mockResolvedValue(getLibrarySnapshot(account).data);
    let sent = false;
    mocks.publish.mockImplementation(async (_r, prepare) => {
      await prepare();
      sent = true;
      return [{ signature: 'receipt' }];
    });
    await saveLibraryToQdn(account);
    expect(sent).toBe(false);
    expect(getLibrarySnapshot(account).phase).toBe('ready');
    expect(getLibrarySnapshot(account).error).toBe('');
  });
  it('persists an exact account-owned snapshot before sending and stores receipts without claiming availability', async () => {
    await start();
    changeLibrary(account, 'song', song(), false);
    mocks.publish.mockImplementation(async (resources, prepare) => {
      await prepare();
      const disk = JSON.parse(
        localStorage.getItem(libraryStorageKey(account))!
      );
      expect(disk.attempt.state).toBe('sending');
      const payload = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(resources[0].data64), (c) => c.charCodeAt(0))
        )
      );
      expect(payload.owner).toEqual({
        address: account.address,
        name: account.name,
      });
      expect(payload.favoriteSongs).toHaveLength(1);
      return [{ signature: 'receipt' }];
    });
    await saveLibraryToQdn(account);
    expect(getLibrarySnapshot(account).phase).toBe('sent');
    expect(getLibrarySnapshot(account).attempt?.signatures).toEqual([
      'receipt',
    ]);
  });
  it('guards the queued save when the wallet changes before the bridge call', async () => {
    await start();
    changeLibrary(account, 'song', song(), false);
    mocks.wallet.mockResolvedValue({ address: 'Another wallet' });
    await saveLibraryToQdn(account);
    expect(getLibrarySnapshot(account).attempt).toBeUndefined();
    expect(getLibrarySnapshot(account).error).toContain('wallet changed');
  });
  it('cancels a queued old-account save and loads the newly active account afterwards', async () => {
    await start();
    changeLibrary(account, 'song', song(), false);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let sent = false;
    mocks.publish.mockImplementation(async (_r, prepare) => {
      await gate;
      await prepare();
      sent = true;
      return [{ signature: 'receipt' }];
    });
    const task = saveLibraryToQdn(account);
    await Promise.resolve();
    const next = libraryAccount({ address: 'queued-new-wallet', name: 'Bob' });
    stop?.();
    mocks.auth = { address: next.address, name: next.name };
    stop = activateLibrary(next);
    release();
    await task;
    await Promise.resolve();
    await refreshLibrary(next);
    expect(sent).toBe(false);
    expect(getLibrarySnapshot(next).data.favoriteSongs).toEqual([]);
    expect(getLibrarySnapshot(next).phase).toBe('ready');
  });
  it('coalesces double clicks and does not automatically retry a missing receipt', async () => {
    await start();
    changeLibrary(account, 'song', song(), false);
    mocks.publish.mockImplementation(async (_r, prepare) => {
      await prepare();
      throw new Error('Bridge timed out');
    });
    const one = saveLibraryToQdn(account),
      two = saveLibraryToQdn(account);
    expect(one).toBe(two);
    await one;
    expect(mocks.publish).toHaveBeenCalledOnce();
    expect(getLibrarySnapshot(account).phase).toBe('uncertain');
    await refreshLibrary(account);
    expect(getLibrarySnapshot(account).phase).toBe('uncertain');
  });
  it('recognizes the sent snapshot after propagation and prevents a repeat send while it is pending', async () => {
    await start();
    changeLibrary(account, 'song', song(), false);
    await saveLibraryToQdn(account);
    const sent = getLibrarySnapshot(account).attempt!.data;
    await saveLibraryToQdn(account);
    expect(getLibrarySnapshot(account).error).toContain('previous save');
    mocks.load.mockResolvedValue(sent);
    await refreshLibrary(account);
    expect(getLibrarySnapshot(account).attempt).toBeUndefined();
    expect(getLibrarySnapshot(account).phase).toBe('ready');
  });
  it('does not interpret a previously known library missing on another node as an empty collection', async () => {
    updateLibrarySnapshot(account, { remoteKnown: true });
    await start();
    expect(getLibrarySnapshot(account).phase).toBe('error');
    await saveLibraryToQdn(account);
    expect(getLibrarySnapshot(account).attempt).toBeUndefined();
  });
  it('keeps a removal through stale-node refresh, a QDN save and local restoration', async () => {
    mocks.load.mockResolvedValue(
      normalizeLibrary({
        favoriteSongs: [song('remove-me')],
        favoritePlaylists: [],
        recentSongs: [],
        updatedAt: 1,
      })
    );
    await start();
    changeLibrary(account, 'song', song('remove-me'), true);
    await refreshLibrary(account);
    expect(getLibrarySnapshot(account).data.favoriteSongs).toEqual([]);
    await saveLibraryToQdn(account);
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(mocks.publish.mock.calls[0][0][0].data64), (c) =>
          c.charCodeAt(0)
        )
      )
    );
    expect(payload.favoriteSongs).toEqual([]);
    expect(
      Object.values(payload.entries).some(
        (entry: unknown) => (entry as { removed: boolean }).removed
      )
    ).toBe(true);
    const disk = JSON.parse(localStorage.getItem(libraryStorageKey(account))!);
    expect(normalizeLibrary(disk.data, account).favoriteSongs).toEqual([]);
  });
  it('settles a declined approval and allows a deliberate later retry', async () => {
    await start();
    changeLibrary(account, 'song', song(), false);
    mocks.publish.mockImplementationOnce(async (_r, prepare) => {
      await prepare();
      throw new Error('User declined request');
    });
    await saveLibraryToQdn(account);
    expect(getLibrarySnapshot(account).attempt).toBeUndefined();
    await saveLibraryToQdn(account);
    expect(getLibrarySnapshot(account).phase).toBe('sent');
  });
});
describe('legacy collection import', () => {
  it('imports only explicitly selected favorites and keeps the original data and history unassigned', async () => {
    localStorage.setItem(
      'qmusic20.favoriteSongs',
      JSON.stringify([song('old-one'), song('old-two')])
    );
    const view = render(
      <>
        <LibrarySync />
        <LibraryControls />
      </>
    );
    await waitFor(() =>
      expect(getLibrarySnapshot(account).phase).toBe('ready')
    );
    expect(getLibrarySnapshot(account).data.favoriteSongs).toEqual([]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(screen.getByLabelText('Song: old-one • Artist'));
    await user.click(screen.getByRole('button', { name: 'Import selected' }));
    expect(
      getLibrarySnapshot(account).data.favoriteSongs.map(
        (item) => item.identifier
      )
    ).toEqual(['old-one']);
    expect(localStorage.getItem('qmusic20.favoriteSongs')).toContain('old-two');
    expect(mocks.publish).not.toHaveBeenCalled();
    view.unmount();
  });
  it('never toggles an existing favorite off when importing it twice', () => {
    importLibraryItems(account, { songs: [song()], playlists: [] });
    importLibraryItems(account, { songs: [song()], playlists: [] });
    expect(getLibrarySnapshot(account).data.favoriteSongs).toHaveLength(1);
  });
});
