import { ShuffleRounded } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { MusicSearchForm } from '../components/common/MusicSearchForm';
import { Alert, Button, Skeleton, Stack } from '@mui/material';
import { Suspense, lazy } from 'react';
import { useAtomValue } from 'jotai';
import { skinAtom } from '../state/appearance';
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { usePlaylistPlayback } from '../hooks/usePlaylistPlayback';
import { usePlaylistsFeed } from '../hooks/usePlaylistsFeed';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { songQueue } from '../utils/songQueue';
const Classic = lazy(() =>
  import('../components/skins/classic/ClassicHomeView').then((m) => ({
    default: m.ClassicHomeView,
  }))
);
const Modern = lazy(() =>
  import('../components/skins/modern/ModernHomeView').then((m) => ({
    default: m.ModernHomeView,
  }))
);
export const HomePage = () => {
  const skin = useAtomValue(skinAtom);
  const library = useLibrary();
  const { playQueue } = useMiniPlayer();
  const songs = useSongsFeed(15);
  const playlists = usePlaylistsFeed(15);
  const playlistPlayer = usePlaylistPlayback();
  const View = skin === 'classic' ? Classic : Modern;
  return (
    <Stack spacing={3}>
      <MusicSearchForm />
      <Button
        component={Link}
        to="/discover"
        startIcon={<ShuffleRounded />}
        variant="outlined"
        sx={{ alignSelf: 'flex-start' }}
      >
        Discover Mix
      </Button>
      {songs.error ? (
        <Alert
          severity="warning"
          action={<Button onClick={songs.retry}>Retry songs</Button>}
        >
          {songs.error}
        </Alert>
      ) : null}
      {playlists.error ? (
        <Alert
          severity="warning"
          action={<Button onClick={playlists.retry}>Retry playlists</Button>}
        >
          {playlists.error}
        </Alert>
      ) : null}
      {playlistPlayer.error ? (
        <Alert severity="warning">{playlistPlayer.error}</Alert>
      ) : null}
      <Suspense fallback={<Skeleton variant="rounded" height={220} />}>
        <View
          songs={songs.songs}
          playlists={playlists.playlists}
          songsLoading={songs.isLoading}
          playlistsLoading={playlists.isLoading}
          playlistLoadingId={playlistPlayer.loadingId}
          libraryCounts={{
            songs: library.favoriteSongs?.length ?? 0,
            playlists: library.favoritePlaylists?.length ?? 0,
            recent: library.recentSongs?.length ?? 0,
          }}
          onPlaySong={(song, index) => {
            library.addRecentSong(song);
            playQueue(songQueue(songs.songs.slice(0, 15)), index);
          }}
          onPlayPlaylist={(playlist) => void playlistPlayer.play(playlist)}
        />
      </Suspense>
    </Stack>
  );
};
