import { Link } from 'react-router-dom';
import { buildPlaylistSearchText } from '../utils/musicSearch';
import { MediaCard } from '../components/common/MediaCard';
import {
  CardSkeletons,
  MediaGrid,
  MediaPagination,
} from '../components/common/MediaCollection';
import { usePlaylistPlayback } from '../hooks/usePlaylistPlayback';
import {
  Alert,
  Button,
  Box,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useDeferredValue, useMemo, useState } from 'react';
import { usePlaylistsFeed } from '../hooks/usePlaylistsFeed';
import { fetchAllPlaylists } from '../services/playlists';
import { useMediaCatalog } from '../hooks/useMediaCatalog';
import { usePlaylistCounts } from '../hooks/usePlaylistCounts';
import { mergeMedia } from '../utils/mediaIdentity';
import { emitMediaRefresh } from '../utils/mediaEvents';

export const PlaylistsPage = () => {
  const pageSize = 20;
  const [limit, setLimit] = useState(pageSize);
  const [selection, setSelection] = useState({ key: '', page: 1 });
  const [titleLetter, setTitleLetter] = useState('ALL');
  const playlistPlayer = usePlaylistPlayback();
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'title' | 'tracks'>('latest');
  const { playlists, isLoading, error, hasMore, retry } =
    usePlaylistsFeed(limit);
  const deferredQuery = useDeferredValue(query);

  const expanded =
    Boolean(deferredQuery.trim()) ||
    sortBy !== 'latest' ||
    titleLetter !== 'ALL';
  const catalog = useMediaCatalog(fetchAllPlaylists, expanded);
  const allPlaylists = useMemo(
    () => mergeMedia(playlists, catalog.items),
    [playlists, catalog.items]
  );
  const { counts, isLoading: countsLoading } = usePlaylistCounts(
    allPlaylists,
    sortBy === 'tracks'
  );
  const visiblePlaylists = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const filtered = (expanded ? allPlaylists : playlists)
      .map((item) => ({
        ...item,
        songCount: counts[item.id] ?? item.songCount,
      }))
      .filter((playlist) => {
        if (
          titleLetter !== 'ALL' &&
          !playlist.title.trim().toUpperCase().startsWith(titleLetter)
        )
          return false;
        if (!normalizedQuery) return true;
        return buildPlaylistSearchText(playlist)
          .toLowerCase()
          .includes(normalizedQuery);
      });

    return [...filtered].sort((left, right) => {
      if (sortBy === 'title') {
        return left.title.localeCompare(right.title);
      }
      if (sortBy === 'tracks') {
        return (right.songCount ?? -1) - (left.songCount ?? -1);
      }
      return (
        (right.created || right.updated || 0) -
        (left.created || left.updated || 0)
      );
    });
  }, [
    deferredQuery,
    playlists,
    sortBy,
    expanded,
    allPlaylists,
    counts,
    titleLetter,
  ]);

  const queryKey = JSON.stringify([deferredQuery, sortBy, titleLetter]);
  const pageCount = Math.max(1, Math.ceil(visiblePlaylists.length / pageSize));
  const morePages = expanded ? catalog.isLoading : hasMore && !error;
  const requestedPage = selection.key === queryKey ? selection.page : 1;
  const page =
    !morePages && !isLoading && !catalog.isLoading
      ? Math.min(requestedPage, pageCount)
      : requestedPage;
  const pagePlaylists = visiblePlaylists.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const changePage = (next: number) => {
    setSelection({ key: queryKey, page: next });
    if (!expanded) setLimit((current) => Math.max(current, next * pageSize));
    document
      .getElementById('playlist-results')
      ?.scrollIntoView?.({ block: 'start' });
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography component="h1" variant="h2" sx={{ fontWeight: 800 }}>
          Explore playlists
        </Typography>
        <Typography color="text.secondary">
          Playlists from Q-Music and Ear-Bump.
        </Typography>
      </Stack>
      {error ? (
        <Alert
          severity="warning"
          action={<Button onClick={retry}>Retry</Button>}
        >
          {error}
        </Alert>
      ) : null}
      {catalog.error ? (
        <Alert
          severity="warning"
          action={<Button onClick={catalog.retry}>Retry search</Button>}
        >
          {catalog.error} Showing results loaded so far.
        </Alert>
      ) : null}
      {catalog.isLoading ? (
        <Alert severity="info">
          Searching playlists. More results may appear.
        </Alert>
      ) : null}
      {countsLoading ? (
        <Typography>
          Loading track counts. You can open a playlist now.
        </Typography>
      ) : null}
      <Button
        onClick={emitMediaRefresh}
        disabled={isLoading || catalog.isLoading}
      >
        Refresh playlists
      </Button>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 2,
          backgroundColor: 'var(--qm-surface-soft)',
        }}
      >
        <TextField
          label="Search playlists"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          fullWidth
          helperText="Filter by title, owner or description"
          size="small"
        />
        <TextField
          select
          label="Sort"
          value={sortBy}
          onChange={(event) =>
            setSortBy(event.target.value as 'latest' | 'title' | 'tracks')
          }
          sx={{ minWidth: { md: 220 } }}
          size="small"
        >
          <MenuItem value="latest">Latest</MenuItem>
          <MenuItem value="title">Title</MenuItem>
          <MenuItem value="tracks">Track count</MenuItem>
        </TextField>
      </Stack>
      <Button
        component={Link}
        to={`/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`}
        variant="outlined"
      >
        Search songs, artists and publishers
      </Button>
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Jump by playlist title
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
          {['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map((letter) => (
            <Button
              key={letter}
              size="small"
              variant={titleLetter === letter ? 'contained' : 'outlined'}
              onClick={() => setTitleLetter(letter)}
              sx={{ minWidth: 36 }}
            >
              {letter === 'ALL' ? 'All' : letter}
            </Button>
          ))}
        </Stack>
      </Stack>
      {playlistPlayer.error ? (
        <Alert severity="warning">{playlistPlayer.error}</Alert>
      ) : null}
      <Box id="playlist-results" sx={{ scrollMarginTop: 90 }}>
        <MediaGrid kind="playlist">
          {isLoading && !pagePlaylists.length ? (
            <CardSkeletons />
          ) : (
            pagePlaylists.map((playlist) => (
              <MediaCard
                key={playlist.id}
                kind="playlist"
                item={playlist}
                busy={playlistPlayer.loadingId === playlist.id}
                onPlay={() => void playlistPlayer.play(playlist)}
              />
            ))
          )}
        </MediaGrid>
      </Box>
      {!isLoading && !catalog.isLoading && !pagePlaylists.length ? (
        <Typography color="text.secondary">
          No matching playlists on this page.
        </Typography>
      ) : null}
      {expanded && !catalog.complete ? (
        <Typography variant="caption" color="text.secondary">
          Results and alphabetical order include the catalog loaded so far; more
          results may appear.
        </Typography>
      ) : null}
      <MediaPagination
        page={page}
        pages={pageCount}
        more={morePages}
        busy={isLoading || catalog.isLoading}
        onChange={changePage}
      />
    </Stack>
  );
};
