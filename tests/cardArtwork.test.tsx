import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkThumb } from '../src/components/common/ArtworkThumb';
const calls = vi.hoisted(() => vi.fn());
vi.mock('../src/hooks/useQdnResource', () => ({
  useQdnResource: (options: unknown) => {
    calls(options);
    return { url: null, isLoading: false, onLoad: vi.fn(), onError: vi.fn() };
  },
}));
let intersect: IntersectionObserverCallback;
beforeEach(() => {
  calls.mockReset();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('card artwork is independent from catalog loading', () => {
  it('does not request an offscreen thumbnail and enables it only on visibility', () => {
    render(
      <ArtworkThumb
        kind="song"
        publisher="A"
        identifier="enjoymusic_song_1"
        title="Song"
        fluid
        interactive={false}
      />
    );
    expect(calls.mock.calls.every(([p]) => p.enabled === false)).toBe(true);
    act(() =>
      intersect(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver
      )
    );
    expect(calls).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, service: 'THUMBNAIL' })
    );
  });
  it('does not request nonexistent Ear-Bump playlist thumbnails or preload embedded playlist payloads', () => {
    render(
      <ArtworkThumb
        kind="playlist"
        publisher="A"
        identifier="earbump_playlist_1"
        title="List"
        fluid
        interactive={false}
      />
    );
    act(() =>
      intersect(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver
      )
    );
    expect(calls.mock.calls.every(([p]) => p.enabled === false)).toBe(true);
  });
});
