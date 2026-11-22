import { buildSongSearchText } from '../utils/musicSearch';
import { Link } from 'react-router-dom';
import { MediaCard } from '../components/common/MediaCard';
import {
  CardSkeletons,
  MediaGrid,
  MediaPagination,
} from '../components/common/MediaCollection';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useDeferredValue, useMemo, useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { fetchAllSongs } from '../services/songs';
import { useMediaCatalog } from '../hooks/useMediaCatalog';
import { mergeMedia } from '../utils/mediaIdentity';
import { emitMediaRefresh } from '../utils/mediaEvents';
import { songQueue } from '../utils/songQueue';
import type { SongSummary } from '../types/media';

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

export const SongsPage = () => {
  const pageSize = 20;
  const [limit, setLimit] = useState(pageSize);
  const [selection, setSelection] = useState({ key: '', page: 1 });
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'title' | 'artist'>('latest');
  const [artistLetter, setArtistLetter] = useState<string>('ALL');
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('ALL');
  const [selectedPublisher, setSelectedPublisher] = useState<string>('ALL');
  const [catalogRequested, setCatalogRequested] = useState(false);
  const { songs, isLoading, error, hasMore, retry } = useSongsFeed(limit);
  const { addRecentSong } = useLibrary();
  const { playQueue } = useMiniPlayer();
  const deferredQuery = useDeferredValue(query);

  const isExtendedSearchActive =
    Boolean(deferredQuery.trim()) ||
    artistLetter !== 'ALL' ||
    sortBy !== 'latest' ||
    selectedGenre !== 'ALL' ||
    selectedLanguage !== 'ALL' ||
    selectedPublisher !== 'ALL';
  const catalog = useMediaCatalog(
    fetchAllSongs,
    isExtendedSearchActive || catalogRequested
  );
  const allAvailableSongs = useMemo(
    () => mergeMedia(songs, catalog.items),
    [songs, catalog.items]
  );

  const alphabet = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);
  const genreOptions = useMemo(
    () => getUniqueValues(allAvailableSongs, 'genre'),
    [allAvailableSongs]
  );
  const languageOptions = useMemo(
    () => getUniqueValues(allAvailableSongs, 'language'),
    [allAvailableSongs]
  );
  const publisherOptions = useMemo(
    () => getUniqueValues(allAvailableSongs, 'publisher'),
    [allAvailableSongs]
  );

  const visibleSongs = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    const sourceSongs = isExtendedSearchActive ? allAvailableSongs : songs;
    const filtered = sourceSongs.filter((song) => {
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
      const searchText = buildSongSearchText(song).toLowerCase();
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
        (right.created || right.updated || 0) -
        (left.created || left.updated || 0)
      );
    });
  }, [
    artistLetter,
    allAvailableSongs,
    deferredQuery,
    isExtendedSearchActive,
    selectedGenre,
    selectedLanguage,
    selectedPublisher,
    songs,
    sortBy,
  ]);
  const queryKey = JSON.stringify([
    deferredQuery,
    sortBy,
    artistLetter,
    selectedGenre,
    selectedLanguage,
    selectedPublisher,
  ]);
  const pageCount = Math.max(1, Math.ceil(visibleSongs.length / pageSize));
  const morePages = isExtendedSearchActive
    ? catalog.isLoading
    : hasMore && !error;
  const requestedPage = selection.key === queryKey ? selection.page : 1;
  const page =
    !morePages && !isLoading && !catalog.isLoading
      ? Math.min(requestedPage, pageCount)
      : requestedPage;
  const pageSongs = visibleSongs.slice((page - 1) * pageSize, page * pageSize);
  const changePage = (next: number) => {
    setSelection({ key: queryKey, page: next });
    if (!isExtendedSearchActive)
      setLimit((current) => Math.max(current, next * pageSize));
    document
      .getElementById('song-results')
      ?.scrollIntoView?.({ block: 'start' });
  };
  const handlePreview = (trackId: string) => {
    const index = pageSongs.findIndex((track) => track.id === trackId);
    if (index < 0) return;
    addRecentSong(pageSongs[index]);
    playQueue(songQueue(pageSongs), index);
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography component="h1" variant="h2" sx={{ fontWeight: 800 }}>
          Discover music
        </Typography>
        <Typography color="text.secondary">
          Browse songs, find your favorites and listen.
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
          {catalog.error} Showing the results loaded so far.
        </Alert>
      ) : null}
      <Button
        onClick={emitMediaRefresh}
        disabled={isLoading || catalog.isLoading}
      >
        Refresh songs
      </Button>
      {isExtendedSearchActive && catalog.isLoading ? (
        <Alert severity="info">
          Searching the full song catalog. More results may appear shortly.
        </Alert>
      ) : null}
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        spacing={1.5}
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
          sx={{ flex: '1 1 240px' }}
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
          sx={{ flex: '1 1 140px' }}
          size="small"
        >
          <MenuItem value="latest">Latest</MenuItem>
          <MenuItem value="title">Title</MenuItem>
          <MenuItem value="artist">Artist</MenuItem>
        </TextField>
        <TextField
          select
          label="Genre"
          slotProps={{ select: { onOpen: () => setCatalogRequested(true) } }}
          value={selectedGenre}
          onChange={(event) => setSelectedGenre(event.target.value)}
          sx={{ flex: '1 1 140px' }}
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
          slotProps={{ select: { onOpen: () => setCatalogRequested(true) } }}
          value={selectedLanguage}
          onChange={(event) => setSelectedLanguage(event.target.value)}
          sx={{ flex: '1 1 140px' }}
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
          slotProps={{ select: { onOpen: () => setCatalogRequested(true) } }}
          value={selectedPublisher}
          onChange={(event) => setSelectedPublisher(event.target.value)}
          sx={{ flex: '1 1 140px' }}
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
      <Button
        component={Link}
        to={`/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`}
        variant="outlined"
      >
        Search playlists, artists and publishers
      </Button>
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
      <Box id="song-results" sx={{ scrollMarginTop: 90 }}>
        <MediaGrid>
          {isLoading && !pageSongs.length ? (
            <CardSkeletons />
          ) : (
            pageSongs.map((track) => (
              <MediaCard
                key={track.id}
                kind="song"
                item={track}
                onPlay={() => handlePreview(track.id)}
              />
            ))
          )}
        </MediaGrid>
      </Box>
      {!isLoading && !catalog.isLoading && !pageSongs.length ? (
        <Typography color="text.secondary">
          No matching songs on this page.
        </Typography>
      ) : null}
      <Typography variant="caption" color="text.secondary">
        {isExtendedSearchActive && !catalog.complete
          ? 'Results and alphabetical order include the catalog loaded so far; more results may appear.'
          : 'Music published on QDN.'}
      </Typography>
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
