import {
  Alert,
  Button,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { ArtworkThumb } from '../components/common/ArtworkThumb';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { usePlaylistsFeed } from '../hooks/usePlaylistsFeed';
import { fetchAllPlaylists } from '../services/playlists';
import { useMediaCatalog } from '../hooks/useMediaCatalog';
import { usePlaylistCounts } from '../hooks/usePlaylistCounts';
import { mergeMedia } from '../utils/mediaIdentity';
import { emitMediaRefresh } from '../utils/mediaEvents';
import { formatPlaylistCardMetadata } from '../utils/playlistMetadata';

export const PlaylistsPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const pageSize = isMobile ? 12 : 24;
  const [limit, setLimit] = useState(pageSize);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'title' | 'tracks'>('latest');
  const { playlists, isLoading, error, hasMore, retry } =
    usePlaylistsFeed(limit);
  const deferredQuery = useDeferredValue(query);

  const expanded = Boolean(deferredQuery.trim()) || sortBy !== 'latest';
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
        if (!normalizedQuery) return true;
        return [playlist.title, playlist.publisher, playlist.description || '']
          .join(' ')
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
        (right.updated || right.created || 0) -
        (left.updated || left.created || 0)
      );
    });
  }, [deferredQuery, playlists, sortBy, expanded, allPlaylists, counts]);

  return (
    <Stack spacing={3}>
      <PageHero eyebrow="" title="Explore playlists" description="" />
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
      <Grid container spacing={2.5}>
        {isLoading && playlists.length === 0
          ? Array.from({ length: 6 }).map((_, index) => (
              <Grid key={index} size={{ xs: 12, md: 4 }}>
                <Skeleton variant="rounded" height={220} />
              </Grid>
            ))
          : visiblePlaylists.map((playlist) => (
              <Grid key={playlist.id} size={{ xs: 12, md: 4 }}>
                <SectionCard
                  kicker={playlist.publisher}
                  title={playlist.title}
                  media={
                    <ArtworkThumb
                      kind="playlist"
                      publisher={playlist.publisher}
                      identifier={playlist.identifier}
                      title={playlist.title}
                    />
                  }
                  body={formatPlaylistCardMetadata({
                    title: playlist.title,
                    publisher: playlist.publisher,
                    description: playlist.description,
                    publishedDate: playlist.publishedDate,
                    songCount: playlist.songCount,
                  })}
                  meta={[
                    'PLAYLIST',
                    ...(typeof playlist.songCount === 'number'
                      ? [`${playlist.songCount} tracks`]
                      : []),
                  ]}
                  action={
                    <Button
                      component={RouterLink}
                      to={`/playlists/${encodeURIComponent(playlist.publisher)}/${encodeURIComponent(playlist.identifier)}`}
                      variant="outlined"
                      fullWidth
                    >
                      Open playlist
                    </Button>
                  }
                />
              </Grid>
            ))}
      </Grid>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Showing {visiblePlaylists.length} loaded playlists.
        </Typography>
        <Button
          variant="contained"
          disabled={
            isLoading ||
            (expanded ? catalog.complete || catalog.isLoading : !hasMore)
          }
          onClick={() =>
            expanded
              ? catalog.retry()
              : setLimit((current) => current + pageSize)
          }
        >
          {isLoading
            ? 'Loading…'
            : expanded
              ? catalog.complete
                ? 'All search results loaded'
                : 'Continue search'
              : hasMore
                ? 'Load more'
                : 'All playlists loaded'}
        </Button>
      </Stack>
    </Stack>
  );
};
