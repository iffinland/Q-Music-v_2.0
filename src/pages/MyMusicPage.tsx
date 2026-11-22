import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MediaSection } from '../components/common/MediaSection';
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { usePlaylistPlayback } from '../hooks/usePlaylistPlayback';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { usePlaylistsFeed } from '../hooks/usePlaylistsFeed';
import { useGlobal } from '../qortal';
import type { SongSummary } from '../types/media';
import { emitMediaRefresh } from '../utils/mediaEvents';
import { isEarBumpIdentifier } from '../utils/mediaOrigin';
import { songQueue } from '../utils/songQueue';

const OwnerAction = ({
  kind,
  identifier,
}: {
  kind: 'songs' | 'playlists';
  identifier: string;
}) =>
  isEarBumpIdentifier(identifier) ? (
    <Box
      sx={{
        minHeight: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Edit through Ear-Bump
      </Typography>
    </Box>
  ) : (
    <Button
      component={Link}
      to={`/my-music/${kind}/${encodeURIComponent(identifier)}/edit`}
      variant="outlined"
      fullWidth
    >
      {kind === 'songs' ? 'Edit song' : 'Edit playlist'}
    </Button>
  );

const OwnedMusic = ({ publisher }: { publisher: string }) => {
  const [songLimit, setSongLimit] = useState(20);
  const [playlistLimit, setPlaylistLimit] = useState(20);
  const songFeed = useSongsFeed(songLimit, publisher);
  const playlistFeed = usePlaylistsFeed(playlistLimit, publisher);
  const { playQueue } = useMiniPlayer();
  const { addRecentSong } = useLibrary();
  const playlistPlayer = usePlaylistPlayback();
  const isOwner = (item: { publisher: string }) =>
    item.publisher.toLowerCase() === publisher.toLowerCase();
  const songs = songFeed.songs.filter(isOwner);
  const playlists = playlistFeed.playlists.filter(isOwner);
  const error = songFeed.error || playlistFeed.error;
  const playSong = (song: SongSummary, visible: SongSummary[]) => {
    addRecentSong(song);
    playQueue(
      songQueue(visible),
      visible.findIndex((item) => item.id === song.id)
    );
  };
  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        useFlexGap
        flexWrap="wrap"
      >
        <Typography variant="body2" color="text.secondary">
          Published by @{publisher}
        </Typography>
        <Button
          onClick={emitMediaRefresh}
          disabled={songFeed.isLoading || playlistFeed.isLoading}
        >
          Refresh my music
        </Button>
      </Stack>
      {error ? (
        <Alert
          severity="warning"
          action={
            <Button
              onClick={() => {
                songFeed.retry();
                playlistFeed.retry();
              }}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}
      {playlistPlayer.error ? (
        <Alert severity="warning">{playlistPlayer.error}</Alert>
      ) : null}
      <MediaSection
        title="Your Songs"
        kind="song"
        items={songs}
        emptyText="No published songs were found for your current Qortal name."
        isLoading={songFeed.isLoading}
        hasMore={songFeed.hasMore && !songFeed.error}
        onPage={(page) => setSongLimit((limit) => Math.max(limit, page * 20))}
        onPlay={playSong}
        actions={(song) => (
          <OwnerAction kind="songs" identifier={song.identifier} />
        )}
      />
      <MediaSection
        title="Your Playlists"
        kind="playlist"
        items={playlists}
        emptyText="No published playlists were found for your current Qortal name."
        isLoading={playlistFeed.isLoading}
        hasMore={playlistFeed.hasMore && !playlistFeed.error}
        onPage={(page) =>
          setPlaylistLimit((limit) => Math.max(limit, page * 20))
        }
        loadingId={playlistPlayer.loadingId}
        onPlay={(playlist) => void playlistPlayer.play(playlist)}
        actions={(playlist) => (
          <OwnerAction kind="playlists" identifier={playlist.identifier} />
        )}
      />
    </Stack>
  );
};

export const MyMusicPage = () => {
  const { auth } = useGlobal();
  const publisher = auth?.name?.trim() || '';
  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography component="h1" variant="h2" sx={{ fontWeight: 800 }}>
          My Music
        </Typography>
        <Typography color="text.secondary">
          Listen to and manage your published songs and playlists.
        </Typography>
      </Stack>
      {publisher ? (
        <OwnedMusic key={publisher.toLowerCase()} publisher={publisher} />
      ) : (
        <Alert severity="warning">
          Log in through Qortal to manage your published songs and playlists.
        </Alert>
      )}
    </Stack>
  );
};
