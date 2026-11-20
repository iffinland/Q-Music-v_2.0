import { fetchPlaylistsPage } from '../services/playlists';
import { useMediaFeed } from './useMediaFeed';
export const usePlaylistsFeed = (limit = 24, publisher?: string) => {
  const { items, ...rest } = useMediaFeed(fetchPlaylistsPage, limit, publisher);
  return { playlists: items, ...rest };
};
