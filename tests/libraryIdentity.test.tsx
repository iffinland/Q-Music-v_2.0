import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLibrary } from '../src/hooks/useLibrary';
import { changeLibrary } from '../src/services/library/store';
import { libraryAccount } from '../src/services/library/model';
vi.mock('../src/qortal', () => ({
  useGlobal: () => ({ auth: { address: 'IdentityTest', name: 'Alice' } }),
}));
import { mergeLibraryStates } from '../src/services/library';
import { mediaKey } from '../src/utils/mediaIdentity';

const song = (publisher: string) => ({
  id: 'legacy-shared',
  identifier: 'legacy-shared',
  publisher,
  title: 'Title',
  artist: 'Artist',
  service: 'AUDIO' as const,
  mediaType: 'SONG' as const,
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe('legacy media identity compatibility', () => {
  it('migrates local and remote IDs in memory without collapsing different owners', () => {
    const empty = {
      favoriteSongs: [],
      favoritePlaylists: [],
      recentSongs: [],
      updatedAt: 1,
    };
    const result = mergeLibraryStates(
      { ...empty, favoriteSongs: [song('Alice')] },
      { ...empty, favoriteSongs: [song('Bob')] }
    );
    expect(result.favoriteSongs).toHaveLength(2);
    expect(new Set(result.favoriteSongs.map((item) => item.id)).size).toBe(2);
    expect(
      result.favoriteSongs.every((item) => item.identifier === 'legacy-shared')
    ).toBe(true);
  });
  it('recognizes/removes an old stored favorite and does not duplicate recent songs', () => {
    const account = libraryAccount({ address: 'IdentityTest', name: 'Alice' });
    changeLibrary(account, 'song', song('Alice'), false);
    changeLibrary(account, 'recent', song('Alice'), false);
    const { result } = renderHook(() => useLibrary());
    expect(
      result.current.isSongFavorite(mediaKey('AUDIO', 'Alice', 'legacy-shared'))
    ).toBe(true);
    act(() => {
      result.current.toggleSong({
        ...song('Alice'),
        id: mediaKey('AUDIO', 'Alice', 'legacy-shared'),
      });
      result.current.addRecentSong(song('Alice'));
    });
    expect(result.current.favoriteSongs).toHaveLength(0);
    expect(result.current.recentSongs).toHaveLength(1);
    expect(result.current.recentSongs[0].identifier).toBe('legacy-shared');
  });
});
