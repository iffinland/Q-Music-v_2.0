import { PlayArrowRounded } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { Fragment, useDeferredValue, useMemo, useState } from 'react';
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

const buildSongSearchText = (song: SongSummary) =>
  [
    song.title,
    song.artist,
    song.publisher,
    song.identifier,
    song.album,
    song.genre,
    song.mood,
    song.language,
    song.notes,
    song.publishedDate,
    song.description,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();

type SongStringField =
  | 'publisher'
  | 'genre'
  | 'language'
  | 'artist'
  | 'title'
  | 'album'
  | 'mood'
  | 'notes'
  | 'publishedDate'
  | 'identifier';

const getUniqueValues = (songs: SongSummary[], key: SongStringField) =>
  Array.from(
    new Set(
      songs
        .map((song) => song[key])
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim())
    )
  ).sort((left, right) => left.localeCompare(right));

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightText = (value: string, terms: string[]) => {
  if (!value || !terms.length) {
    return value;
  }

  const uniqueTerms = Array.from(new Set(terms.filter(Boolean)));
  if (!uniqueTerms.length) {
    return value;
  }

  const pattern = new RegExp(
    `(${uniqueTerms.map((term) => escapeRegExp(term)).join('|')})`,
    'gi'
  );
  const parts = value.split(pattern);

  return parts.map((part, index) => {
    const isMatch = uniqueTerms.some(
      (term) => part.toLowerCase() === term.toLowerCase()
    );

    if (!isMatch) {
      return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    }

    return (
      <Box
        key={`${part}-${index}`}
        component="mark"
        sx={{
          px: 0.3,
          py: 0.05,
          borderRadius: 0.5,
          backgroundColor: 'rgba(255, 214, 10, 0.28)',
          color: 'inherit',
        }}
      >
        {part}
      </Box>
    );
  });
};

const renderHighlightedLines = (value: string, terms: string[]) =>
  value.split('\n').map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {highlightText(line, terms)}
    </Fragment>
  ));

export const SongsPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const pageSize = isMobile ? 12 : 24;
  const [limit, setLimit] = useState(pageSize);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'title' | 'artist'>('latest');
  const [artistLetter, setArtistLetter] = useState<string>('ALL');
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('ALL');
  const [selectedPublisher, setSelectedPublisher] = useState<string>('ALL');
  const { songs, isLoading, error } = useSongsFeed(limit);
  const { addRecentSong } = useLibrary();
  const { playQueue } = useMiniPlayer();
  const deferredQuery = useDeferredValue(query);

  const alphabet = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);
  const genreOptions = useMemo(() => getUniqueValues(songs, 'genre'), [songs]);
  const languageOptions = useMemo(
    () => getUniqueValues(songs, 'language'),
    [songs]
  );
  const publisherOptions = useMemo(
    () => getUniqueValues(songs, 'publisher'),
    [songs]
  );

  const visibleSongs = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    const filtered = songs.filter((song) => {
      const normalizedArtist = song.artist.trim().toUpperCase();
      const matchesLetter =
        artistLetter === 'ALL'
          ? true
          : normalizedArtist.startsWith(artistLetter);
      const matchesGenre =
        selectedGenre === 'ALL'
          ? true
          : (song.genre || '').trim() === selectedGenre;
      const matchesLanguage =
        selectedLanguage === 'ALL'
          ? true
          : (song.language || '').trim() === selectedLanguage;
      const matchesPublisher =
        selectedPublisher === 'ALL'
          ? true
          : song.publisher.trim() === selectedPublisher;

      if (
        !matchesLetter ||
        !matchesGenre ||
        !matchesLanguage ||
        !matchesPublisher
      ) {
        return false;
      }

      if (!queryTerms.length) return true;
      const searchText = buildSongSearchText(song);
      return queryTerms.every((term) => searchText.includes(term));
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
  }, [
    artistLetter,
    deferredQuery,
    selectedGenre,
    selectedLanguage,
    selectedPublisher,
    songs,
    sortBy,
  ]);
  const highlightedTerms = useMemo(
    () => deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [deferredQuery]
  );

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
          helperText="Search by title, artist, username, genre, album, mood, language, notes and other song details"
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
        <TextField
          select
          label="Genre"
          value={selectedGenre}
          onChange={(event) => setSelectedGenre(event.target.value)}
          sx={{ minWidth: { md: 180 } }}
          size="small"
        >
          <MenuItem value="ALL">All genres</MenuItem>
          {genreOptions.map((genre) => (
            <MenuItem key={genre} value={genre}>
              {genre}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Language"
          value={selectedLanguage}
          onChange={(event) => setSelectedLanguage(event.target.value)}
          sx={{ minWidth: { md: 180 } }}
          size="small"
        >
          <MenuItem value="ALL">All languages</MenuItem>
          {languageOptions.map((language) => (
            <MenuItem key={language} value={language}>
              {language}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Publisher"
          value={selectedPublisher}
          onChange={(event) => setSelectedPublisher(event.target.value)}
          sx={{ minWidth: { md: 180 } }}
          size="small"
        >
          <MenuItem value="ALL">All publishers</MenuItem>
          {publisherOptions.map((publisher) => (
            <MenuItem key={publisher} value={publisher}>
              {publisher}
            </MenuItem>
          ))}
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
                  kicker={highlightText(track.artist, highlightedTerms)}
                  title={highlightText(track.title, highlightedTerms)}
                  media={
                    <ArtworkThumb
                      kind="song"
                      publisher={track.publisher}
                      identifier={track.identifier}
                      title={track.title}
                    />
                  }
                  body={renderHighlightedLines(
                    formatSongCardMetadata({
                      title: track.title,
                      publisher: track.publisher,
                      description: track.description,
                    }),
                    highlightedTerms
                  )}
                  meta={[
                    'AUDIO',
                    track.publisher,
                    ...(selectedGenre !== 'ALL' && track.genre
                      ? [`Genre: ${track.genre}`]
                      : []),
                    ...(selectedLanguage !== 'ALL' && track.language
                      ? [`Language: ${track.language}`]
                      : []),
                    ...(selectedPublisher !== 'ALL'
                      ? [`Publisher: ${track.publisher}`]
                      : []),
                  ]}
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
