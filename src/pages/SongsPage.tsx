import { PlayArrowRounded } from '@mui/icons-material';
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
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { useSongsFeed } from '../hooks/useSongsFeed';
import type { SongSummary } from '../types/media';
import { formatSongCardMetadata } from '../utils/songMetadata';

export const SongsPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const pageSize = isMobile ? 12 : 24;
  const [limit, setLimit] = useState(pageSize);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'title' | 'artist'>('latest');
  const [artistLetter, setArtistLetter] = useState<string>('ALL');
  const { songs, isLoading, error } = useSongsFeed(limit);
  const { addRecentSong } = useLibrary();
  const { playQueue } = useMiniPlayer();
  const deferredQuery = useDeferredValue(query);

  const alphabet = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);

  const visibleSongs = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const filtered = songs.filter((song) => {
      const normalizedArtist = song.artist.trim().toUpperCase();
      const matchesLetter =
        artistLetter === 'ALL'
          ? true
          : normalizedArtist.startsWith(artistLetter);

      if (!matchesLetter) return false;

      if (!normalizedQuery) return true;
      return [song.title, song.artist, song.publisher]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === 'title') {
        return left.title.localeCompare(right.title);
      }
      if (sortBy === 'artist') {
        return left.artist.localeCompare(right.artist);
      }
      return (
        (right.updated || right.created || 0) -
        (left.updated || left.created || 0)
      );
    });
  }, [artistLetter, deferredQuery, songs, sortBy]);

  const handlePreview = (trackId: string) => {
    const queue = songs.map((track) => ({
      key: `${track.publisher}:${track.identifier}`,
      id: track.id,
      identifier: track.identifier,
      publisher: track.publisher,
      service: 'AUDIO' as const,
      title: track.title,
      artist: track.artist,
      context: track.publisher,
    }));
    const selected = queue.find((track) => track.id === trackId) ?? queue[0];
    if (!selected) return;
    const source = songs.find((track) => track.id === trackId);
    if (source) {
      addRecentSong(source);
    }
    playQueue(
      queue,
      queue.findIndex((track) => track.key === selected.key)
    );
  };

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow=""
        title="Audio discovery is the first real migration target."
        description="In the future, there will also be the option to browse stories published through Ear-Bump here."
      />
      {error ? <Alert severity="warning">{error}</Alert> : null}
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
          label="Search songs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          fullWidth
          helperText="Filter by title, artist or publisher"
          size="small"
        />
        <TextField
          select
          label="Sort"
          value={sortBy}
          onChange={(event) =>
            setSortBy(event.target.value as 'latest' | 'title' | 'artist')
          }
          sx={{ minWidth: { md: 200 } }}
          size="small"
        >
          <MenuItem value="latest">Latest</MenuItem>
          <MenuItem value="title">Title</MenuItem>
          <MenuItem value="artist">Artist</MenuItem>
        </TextField>
      </Stack>
      <Stack spacing={1}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Jump by artist initial
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Button
            variant={artistLetter === 'ALL' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setArtistLetter('ALL')}
          >
            All
          </Button>
          {alphabet.map((letter) => (
            <Button
              key={letter}
              variant={artistLetter === letter ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setArtistLetter(letter)}
              sx={{ minWidth: 40, px: 0.75 }}
            >
              {letter}
            </Button>
          ))}
        </Stack>
      </Stack>
      <Grid container spacing={2.5}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Grid key={index} size={{ xs: 12, md: 6 }}>
                <Skeleton variant="rounded" height={220} />
              </Grid>
            ))
          : visibleSongs.map((track: SongSummary) => (
              <Grid key={track.id} size={{ xs: 12, md: 6 }}>
                <SectionCard
                  kicker={track.artist}
                  title={track.title}
                  media={
                    <ArtworkThumb
                      kind="song"
                      publisher={track.publisher}
                      identifier={track.identifier}
                      title={track.title}
                    />
                  }
                  body={formatSongCardMetadata({
                    title: track.title,
                    publisher: track.publisher,
                    description: track.description,
                  })}
                  meta={['AUDIO', track.publisher]}
                  action={
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        startIcon={<PlayArrowRounded />}
                        variant="contained"
                        fullWidth
                        onClick={() => handlePreview(track.id)}
                      >
                        Play
                      </Button>
                      <Button
                        component={RouterLink}
                        to={`/songs/${encodeURIComponent(track.publisher)}/${encodeURIComponent(track.identifier)}`}
                        variant="outlined"
                        fullWidth
                      >
                        Details
                      </Button>
                    </Stack>
                  }
                />
              </Grid>
            ))}
      </Grid>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Browse All is now backed by live QDN search results for
        `enjoymusic_song_` resources.
      </Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Showing {visibleSongs.length} loaded songs
          {artistLetter === 'ALL'
            ? '.'
            : ` for artists starting with "${artistLetter}".`}
        </Typography>
        <Button
          variant="contained"
          onClick={() => setLimit((current) => current + pageSize)}
        >
          Load more
        </Button>
      </Stack>
    </Stack>
  );
};
