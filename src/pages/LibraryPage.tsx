import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { formatPlaylistCardMetadata } from '../utils/playlistMetadata';
import { formatSongCardMetadata } from '../utils/songMetadata';

const libraryHighlights = [
  'Save songs and playlists from their detail pages to keep them here across sessions.',
  'Recent listening history fills automatically when you play audio from browse or detail views.',
  'Podcasts and audiobooks remain outside this release and are not shown in the library.',
];

export const LibraryPage = () => {
  const { favoritePlaylists, favoriteSongs, recentSongs } = useLibrary();
  const { playTrack } = useMiniPlayer();

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow="LIBRARY"
        title="Your saved songs, playlists and recent listening history."
        description="Keep the content you care about close, reopen playlists quickly and jump back into recent listening sessions."
      />
      {recentSongs.length > 0 ? (
        <Stack spacing={2}>
          <Typography variant="h4">Recently Played</Typography>
          {recentSongs.map((song) => (
            <SectionCard
              key={`recent-${song.id}`}
              kicker={song.artist}
              title={song.title}
              body={formatSongCardMetadata({
                title: song.title,
                publisher: song.publisher,
                description: song.description,
              })}
              meta={['RECENT', song.publisher]}
              action={
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Button
                    variant="contained"
                    onClick={() =>
                      playTrack({
                        key: `${song.publisher}:${song.identifier}`,
                        id: song.id,
                        identifier: song.identifier,
                        publisher: song.publisher,
                        service: 'AUDIO',
                        title: song.title,
                        artist: song.artist,
                        context: song.publisher,
                      })
                    }
                  >
                    Play again
                  </Button>
                  <Button
                    component={RouterLink}
                    to={`/songs/${encodeURIComponent(song.publisher)}/${encodeURIComponent(song.identifier)}`}
                    variant="outlined"
                  >
                    Open
                  </Button>
                </Stack>
              }
            />
          ))}
        </Stack>
      ) : null}
      {favoriteSongs.length > 0 ? (
        <Stack spacing={2}>
          <Typography variant="h4">Saved Songs</Typography>
          {favoriteSongs.map((song) => (
            <SectionCard
              key={song.id}
              kicker={song.artist}
              title={song.title}
              body={formatSongCardMetadata({
                title: song.title,
                publisher: song.publisher,
                description: song.description,
              })}
              meta={['AUDIO', song.publisher]}
              action={
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Button
                    variant="contained"
                    onClick={() =>
                      playTrack({
                        key: `${song.publisher}:${song.identifier}`,
                        id: song.id,
                        identifier: song.identifier,
                        publisher: song.publisher,
                        service: 'AUDIO',
                        title: song.title,
                        artist: song.artist,
                        context: song.publisher,
                      })
                    }
                  >
                    Play
                  </Button>
                  <Button
                    component={RouterLink}
                    to={`/songs/${encodeURIComponent(song.publisher)}/${encodeURIComponent(song.identifier)}`}
                    variant="outlined"
                  >
                    Open
                  </Button>
                </Stack>
              }
            />
          ))}
        </Stack>
      ) : null}
      {favoritePlaylists.length > 0 ? (
        <Stack spacing={2}>
          <Typography variant="h4">Saved Playlists</Typography>
          {favoritePlaylists.map((playlist) => (
            <SectionCard
              key={playlist.id}
              kicker={playlist.publisher}
              title={playlist.title}
              body={formatPlaylistCardMetadata({
                title: playlist.title,
                publisher: playlist.publisher,
                description: playlist.description,
                songCount: playlist.songCount,
              })}
              meta={['PLAYLIST', `${playlist.songCount} tracks`]}
              action={
                <Button
                  component={RouterLink}
                  to={`/playlists/${encodeURIComponent(playlist.publisher)}/${encodeURIComponent(playlist.identifier)}`}
                  variant="outlined"
                >
                  Open playlist
                </Button>
              }
            />
          ))}
        </Stack>
      ) : null}
      {favoriteSongs.length === 0 &&
      favoritePlaylists.length === 0 &&
      recentSongs.length === 0
        ? libraryHighlights.map((item) => (
            <Typography
              key={item}
              variant="body1"
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                p: 2,
                backgroundColor: 'var(--qm-surface-soft)',
              }}
            >
              {item}
            </Typography>
          ))
        : null}
    </Stack>
  );
};
