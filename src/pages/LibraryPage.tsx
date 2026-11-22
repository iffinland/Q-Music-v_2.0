import { Alert, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { MediaSection } from '../components/common/MediaSection';
import { LibraryControls } from '../components/shell/LibraryControls';
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { usePlaylistPlayback } from '../hooks/usePlaylistPlayback';
import type { SongSummary } from '../types/media';
import { songQueue } from '../utils/songQueue';

const LibraryContent = ({
  library,
}: {
  library: ReturnType<typeof useLibrary>;
}) => {
  const { favoriteSongs, favoritePlaylists, recentSongs, addRecentSong } =
    library;
  const { playQueue } = useMiniPlayer();
  const playlistPlayer = usePlaylistPlayback();
  const playSong = (song: SongSummary, visible: SongSummary[]) => {
    addRecentSong(song);
    playQueue(
      songQueue(visible),
      visible.findIndex((item) => item.id === song.id)
    );
  };
  const empty =
    !favoriteSongs.length && !favoritePlaylists.length && !recentSongs.length;
  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Stack spacing={0.5}>
        <Typography component="h1" variant="h2" sx={{ fontWeight: 800 }}>
          Your Library
        </Typography>
        <Typography color="text.secondary">
          Your saved songs, playlists and recent listening history.
        </Typography>
      </Stack>
      <LibraryControls />
      {playlistPlayer.error ? (
        <Alert severity="warning">{playlistPlayer.error}</Alert>
      ) : null}
      {empty ? (
        <Stack spacing={1} alignItems="flex-start">
          <Typography color="text.secondary">
            Save songs and playlists from their details to keep them here.
            Recent listening appears when you play music.
          </Typography>
          <Button component={Link} to="/songs" variant="outlined">
            Browse music
          </Button>
        </Stack>
      ) : (
        <>
          <MediaSection
            classicColumns={1}
            title="Recently Played"
            kind="song"
            items={recentSongs}
            emptyText="Your recent listening will appear here."
            onPlay={playSong}
          />
          <MediaSection
            classicColumns={1}
            title="Saved Songs"
            kind="song"
            items={favoriteSongs}
            emptyText="Save a song from its details to add it here."
            onPlay={playSong}
          />
          <MediaSection
            classicColumns={1}
            title="Saved Playlists"
            kind="playlist"
            items={favoritePlaylists}
            emptyText="Save a playlist from its details to add it here."
            loadingId={playlistPlayer.loadingId}
            onPlay={(playlist) => void playlistPlayer.play(playlist)}
          />
        </>
      )}
    </Stack>
  );
};

export const LibraryPage = () => {
  const library = useLibrary();
  // Reset collection pages/dialogs and cancel old playlist-start work on account changes.
  return <LibraryContent key={library.account.key} library={library} />;
};
