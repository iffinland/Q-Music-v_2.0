import { CatalogMirrorButton } from '../components/mirroring/CatalogMirrorButton';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { MediaSection } from '../components/common/MediaSection';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { usePlaylistsFeed } from '../hooks/usePlaylistsFeed';
import { usePlaylistPlayback } from '../hooks/usePlaylistPlayback';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { useLibrary } from '../hooks/useLibrary';
import { songQueue } from '../utils/songQueue';

const PublisherCatalog = ({ name }: { name: string }) => {
  const [songLimit, setSongLimit] = useState(20),
    [playlistLimit, setPlaylistLimit] = useState(20);
  const songs = useSongsFeed(songLimit, name),
    playlists = usePlaylistsFeed(playlistLimit, name);
  const player = usePlaylistPlayback();
  const { playQueue } = useMiniPlayer();
  const { addRecentSong } = useLibrary();
  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography
          component="h1"
          variant="h2"
          sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}
        >
          @{name}
        </Typography>
        <Typography color="text.secondary">
          Songs and playlists published by this Qortal name through Q-Music and
          Ear-Bump.
        </Typography>
      </Stack>
      <CatalogMirrorButton kind="publisher" name={name} publishers={[name]} />
      <Button
        onClick={() => {
          songs.refresh();
          playlists.refresh();
        }}
        disabled={songs.isLoading || playlists.isLoading}
      >
        Refresh publisher
      </Button>
      {songs.error || playlists.error ? (
        <Alert
          severity="warning"
          action={
            <Button
              onClick={() => {
                songs.retry();
                playlists.retry();
              }}
            >
              Retry
            </Button>
          }
        >
          {songs.error || playlists.error}
        </Alert>
      ) : null}
      {player.error ? <Alert severity="warning">{player.error}</Alert> : null}
      <MediaSection
        title="Published Songs"
        kind="song"
        items={songs.songs}
        isLoading={songs.isLoading}
        hasMore={songs.hasMore && !songs.error}
        onPage={(page) => setSongLimit((limit) => Math.max(limit, page * 20))}
        emptyText="No songs found for this publisher."
        onPlay={(song, visible) => {
          addRecentSong(song);
          playQueue(
            songQueue(visible),
            visible.findIndex((item) => item.id === song.id)
          );
        }}
      />
      <MediaSection
        title="Published Playlists"
        kind="playlist"
        items={playlists.playlists}
        isLoading={playlists.isLoading}
        hasMore={playlists.hasMore && !playlists.error}
        onPage={(page) =>
          setPlaylistLimit((limit) => Math.max(limit, page * 20))
        }
        emptyText="No playlists found for this publisher."
        loadingId={player.loadingId}
        onPlay={(playlist) => void player.play(playlist)}
      />
    </Stack>
  );
};
export const PublisherPage = () => {
  const name = useParams().publisher?.trim() || '';
  return name ? (
    <PublisherCatalog key={name.toLowerCase()} name={name} />
  ) : (
    <Alert severity="warning">A publisher name is required.</Alert>
  );
};
