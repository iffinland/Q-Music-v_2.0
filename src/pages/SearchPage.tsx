import {
  Alert,
  Box,
  Button,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreatorLink } from '../components/common/CreatorLink';
import { MediaSection } from '../components/common/MediaSection';
import { MediaPagination } from '../components/common/MediaCollection';
import { MusicSearchForm } from '../components/common/MusicSearchForm';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { useLibrary } from '../hooks/useLibrary';
import { usePlaylistPlayback } from '../hooks/usePlaylistPlayback';
import {
  buildSongSearchText,
  buildPlaylistSearchText,
  matchesMusicText,
  searchCreators,
  type CreatorResult,
} from '../utils/musicSearch';
import { songQueue } from '../utils/songQueue';

const categories = [
  'all',
  'songs',
  'playlists',
  'artists',
  'publishers',
] as const;
type Category = (typeof categories)[number];
const CreatorResults = ({
  title,
  kind,
  items,
  compact,
}: {
  title: string;
  kind: 'artist' | 'publisher';
  items: CreatorResult[];
  compact: boolean;
}) => {
  const [requested, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / 20));
  const page = Math.min(requested, pages);
  const visible = compact
    ? items.slice(0, 5)
    : items.slice((page - 1) * 20, page * 20);
  return (
    <Stack component="section" aria-label={title} spacing={1.5}>
      <Typography component="h2" variant="h3" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {visible.map((item) => (
        <Box
          key={item.name}
          sx={{
            p: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            background: 'var(--qm-panel-bg)',
          }}
        >
          <CreatorLink kind={kind} name={item.name} />
          <Typography variant="caption" color="text.secondary" display="block">
            {item.songs} songs
            {kind === 'publisher' ? ` · ${item.playlists} playlists` : ''} in
            the checked index
          </Typography>
        </Box>
      ))}
      {!visible.length ? (
        <Typography variant="body2" color="text.secondary">
          No matching names in the checked index.
        </Typography>
      ) : null}
      {!compact && pages > 1 ? (
        <MediaPagination
          page={page}
          pages={pages}
          more={false}
          busy={false}
          label={`${title} pages`}
          onChange={setPage}
        />
      ) : null}
    </Stack>
  );
};

const SearchResults = ({
  query,
  category,
  select,
}: {
  query: string;
  category: Category;
  select: (value: Category) => void;
}) => {
  const index = useSearchIndex();
  const { playQueue } = useMiniPlayer();
  const { addRecentSong } = useLibrary();
  const player = usePlaylistPlayback();
  const songs = useMemo(
    () =>
      index.songs.filter((song) =>
        matchesMusicText(buildSongSearchText(song), query)
      ),
    [index.songs, query]
  );
  const playlists = useMemo(
    () =>
      index.playlists.filter((playlist) =>
        matchesMusicText(buildPlaylistSearchText(playlist), query)
      ),
    [index.playlists, query]
  );
  const artists = useMemo(
    () => searchCreators(index.songs, index.playlists, query, 'artist'),
    [index.songs, index.playlists, query]
  );
  const publishers = useMemo(
    () => searchCreators(index.songs, index.playlists, query, 'publisher'),
    [index.songs, index.playlists, query]
  );
  const counts = {
    all: songs.length + playlists.length + artists.length + publishers.length,
    songs: songs.length,
    playlists: playlists.length,
    artists: artists.length,
    publishers: publishers.length,
  };
  const all = category === 'all';
  const key = query.normalize('NFC').toLowerCase();
  return (
    <Stack spacing={3}>
      <Tabs
        value={category}
        onChange={(_, value: Category) => select(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Search result types"
      >
        {categories.map((value) => (
          <Tab
            key={value}
            value={value}
            label={`${value[0].toUpperCase() + value.slice(1)} (${counts[value]})`}
          />
        ))}
      </Tabs>
      <Typography role="status" variant="body2" color="text.secondary">
        Checked {index.songs.length} indexed songs and {index.playlists.length}{' '}
        playlists.{' '}
        {index.isLoading
          ? 'Checking a small batch… Results are incomplete.'
          : index.hasMore
            ? 'Results are incomplete. Search more to check another batch.'
            : 'Index search complete.'}
      </Typography>
      {index.errors.map((error) => (
        <Alert key={error} severity="warning">
          {error} Results already found remain available.
        </Alert>
      ))}
      {player.error ? <Alert severity="warning">{player.error}</Alert> : null}
      {all || category === 'songs' ? (
        <Stack spacing={1}>
          <MediaSection
            key={`songs:${key}`}
            title="Songs"
            kind="song"
            items={all ? songs.slice(0, 5) : songs}
            isLoading={index.isLoading && !index.songs.length}
            emptyText="No matching songs in the checked index yet."
            onPlay={(song, visible) => {
              addRecentSong(song);
              playQueue(
                songQueue(visible),
                visible.findIndex((item) => item.id === song.id)
              );
            }}
          />
          {all && songs.length > 5 ? (
            <Button onClick={() => select('songs')}>
              View all matching songs
            </Button>
          ) : null}
        </Stack>
      ) : null}
      {all || category === 'playlists' ? (
        <Stack spacing={1}>
          <MediaSection
            key={`playlists:${key}`}
            title="Playlists"
            kind="playlist"
            items={all ? playlists.slice(0, 5) : playlists}
            isLoading={index.isLoading && !index.playlists.length}
            emptyText="No matching playlists in the checked index yet."
            loadingId={player.loadingId}
            onPlay={(playlist) => void player.play(playlist)}
          />
          {all && playlists.length > 5 ? (
            <Button onClick={() => select('playlists')}>
              View all matching playlists
            </Button>
          ) : null}
        </Stack>
      ) : null}
      {all || category === 'artists' ? (
        <Stack spacing={1}>
          <CreatorResults
            key={`artists:${key}`}
            title="Artists"
            kind="artist"
            items={artists}
            compact={all}
          />
          {all && artists.length > 5 ? (
            <Button onClick={() => select('artists')}>
              View all matching artists
            </Button>
          ) : null}
        </Stack>
      ) : null}
      {all || category === 'publishers' ? (
        <Stack spacing={1}>
          <CreatorResults
            key={`publishers:${key}`}
            title="Publishers"
            kind="publisher"
            items={publishers}
            compact={all}
          />
          {all && publishers.length > 5 ? (
            <Button onClick={() => select('publishers')}>
              View all matching publishers
            </Button>
          ) : null}
        </Stack>
      ) : null}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {index.hasMore ? (
          <Button
            variant="contained"
            disabled={index.isLoading}
            onClick={index.loadMore}
          >
            {index.errors.length ? 'Search more / retry' : 'Search more music'}
          </Button>
        ) : null}
        <Button disabled={index.isLoading} onClick={index.refresh}>
          Refresh search
        </Button>
      </Stack>
    </Stack>
  );
};

export const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').trim().slice(0, 200);
  const selected = params.get('type') as Category;
  const category = categories.includes(selected) ? selected : 'all';
  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography component="h1" variant="h2" sx={{ fontWeight: 800 }}>
          Search music
        </Typography>
        <Typography color="text.secondary">
          Search titles, descriptions, available tags and other indexed details.
          Artist and publisher results match names.
        </Typography>
      </Stack>
      <MusicSearchForm key={query} initialQuery={query} />
      {query ? (
        <SearchResults
          query={query}
          category={category}
          select={(value) => {
            const next = new URLSearchParams(params);
            next.set('type', value);
            setParams(next);
          }}
        />
      ) : (
        <Typography color="text.secondary">
          Enter a song, artist, publisher, playlist or another search word to
          begin.
        </Typography>
      )}
    </Stack>
  );
};
