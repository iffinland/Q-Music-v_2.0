import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSongDetail } from '../src/hooks/useSongDetail';
const mocks = vi.hoisted(() => ({ base: vi.fn(), full: vi.fn() }));
vi.mock('../src/services/songs', () => ({ fetchSongByIdentifier: mocks.base }));
vi.mock('../src/services/songDescriptors', () => ({
  loadSongDocument: mocks.full,
}));
const song = {
  id: 'id',
  identifier: 'song',
  publisher: 'Alice',
  title: 'Indexed title',
  artist: 'Artist',
  service: 'AUDIO',
  mediaType: 'SONG',
  metadataRevision: 'revision',
};
beforeEach(() => {
  mocks.base.mockReset().mockResolvedValue(song);
  mocks.full.mockReset();
});
afterEach(cleanup);
describe('non-blocking full song metadata', () => {
  it('makes the song playable before full details arrive', async () => {
    let resolve!: (value: unknown) => void;
    mocks.full.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    const { result } = renderHook(() => useSongDetail('Alice', 'song'));
    await waitFor(() =>
      expect(result.current.song?.title).toBe('Indexed title')
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isMetadataLoading).toBe(true);
    await act(async () =>
      resolve({ ...song, title: 'Complete title', notes: 'All notes' })
    );
    expect(result.current.song?.notes).toBe('All notes');
    expect(result.current.isMetadataLoading).toBe(false);
  });
  it('retains the playable base song but exposes metadata errors for safe editing', async () => {
    mocks.full.mockRejectedValue(new Error('Full details still propagating'));
    const { result } = renderHook(() => useSongDetail('Alice', 'song'));
    await waitFor(() =>
      expect(result.current.metadataError).toContain('propagating')
    );
    expect(result.current.song?.identifier).toBe('song');
    expect(result.current.error).toBeNull();
  });
  it('does not fetch a sidecar for legacy songs', async () => {
    mocks.base.mockResolvedValue({ ...song, metadataRevision: undefined });
    const { result } = renderHook(() => useSongDetail('Alice', 'song'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.full).not.toHaveBeenCalled();
  });
});
