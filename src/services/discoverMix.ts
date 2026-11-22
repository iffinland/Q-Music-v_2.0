import { fetchSongsPage } from './songs';
import { isAbortError, throwIfAborted, type ReadOptions } from './qdnRequests';
import { mergeMedia } from '../utils/mediaIdentity';
import type { SongSummary } from '../types/media';

export const shuffleSongs = <T>(
  items: readonly T[],
  random = Math.random
): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Random chronological starting points, not a claim of uniform per-track
// sampling. No total-count scan, arbitrary huge offset or full media download.
export const discoverMix = async (
  options: ReadOptions & { oldest?: number; exclude?: string[] } = {},
  random = Math.random,
  now = Date.now()
) => {
  const read = { signal: options.signal, priority: 'background' as const };
  let oldest = options.oldest;
  if (oldest === undefined) {
    const first = await fetchSongsPage({ ...read, limit: 1, reverse: false });
    throwIfAborted(options.signal);
    if (!first.items.length)
      return { items: [] as SongSummary[], oldest: now, partial: false };
    oldest = first.items[0].created;
  }
  // Timestamp-less legacy rows have no reliable range; retain a conservative
  // Qortal-era lower bound instead of excluding old publications.
  oldest = Math.min(now, Math.max(0, oldest ?? Date.UTC(2020, 0, 1)));
  let items: SongSummary[] = [];
  let successful = 0;
  let failure: unknown;
  for (let window = 0; window < 4; window++) {
    throwIfAborted(options.signal);
    const fraction = Math.min(1, Math.max(0, random()));
    const before =
      window === 0
        ? now + 1
        : oldest + Math.floor((now - oldest) * fraction) + 1;
    try {
      const page = await fetchSongsPage({ ...read, limit: 10, before });
      throwIfAborted(options.signal);
      items = mergeMedia(items, page.items);
      successful++;
    } catch (error) {
      if (isAbortError(error) || options.signal?.aborted) {
        if (items.length) break; // Keep completed windows when the deadline expires.
        throw error;
      }
      failure = error;
    }
  }
  if (!successful)
    throw failure || new Error('Music could not be found. Please retry.');
  const excluded = new Set(options.exclude || []);
  return {
    items: shuffleSongs(
      items.filter((item) => !excluded.has(item.id)),
      random
    ).slice(0, 20),
    oldest,
    partial: successful < 4,
  };
};
