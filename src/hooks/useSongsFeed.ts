import { fetchSongsPage } from '../services/songs';
import { useMediaFeed } from './useMediaFeed';
export const useSongsFeed = (limit = 24, publisher?: string) => {
  const { items, ...rest } = useMediaFeed(fetchSongsPage, limit, publisher);
  return { songs: items, ...rest };
};
