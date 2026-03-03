import { Button, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ArtworkThumb } from '../components/common/ArtworkThumb';
import { HeroButton, PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { usePlaylistsFeed } from '../hooks/usePlaylistsFeed';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { formatPlaylistCardMetadata } from '../utils/playlistMetadata';
import { formatSongCardMetadata } from '../utils/songMetadata';

export const HomePage = () => {
  const { addRecentSong, favoritePlaylists, favoriteSongs, recentSongs } =
    useLibrary();
  const { playTrack } = useMiniPlayer();
  const { songs, isLoading: songsLoading, error: songsError } = useSongsFeed(4);
  const {
    playlists,
    isLoading: playlistsLoading,
    error: playlistsError,
  } = usePlaylistsFeed(3);

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow="START HERE"
        title="Browse, publish and collect QDN audio from one focused workspace."
        description="Songs and playlists stay at the center, with a lightweight mini-player, direct publish routes and a personal library for the audio you want to keep close."
        actions={
          <>
            <HeroButton component={RouterLink} to="/songs" variant="contained">
              Browse All Audio
            </HeroButton>
            <HeroButton
              component={RouterLink}
              to="/playlists/all"
              variant="outlined"
            >
              Explore Playlists
            </HeroButton>
          </>
        }
      />

      <Grid container spacing={2.5}>
        {songsLoading
          ? Array.from({ length: 2 }).map((_, index) => (
              <Grid key={index} size={{ xs: 12, md: 6 }}>
                <Skeleton variant="rounded" height={220} />
              </Grid>
            ))
          : songs.slice(0, 2).map((track) => (
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
                      size={84}
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
                        variant="contained"
                        fullWidth
                        onClick={() =>
                          (() => {
                            addRecentSong(track);
                            playTrack({
                              key: `${track.publisher}:${track.identifier}`,
                              id: track.id,
                              identifier: track.identifier,
                              publisher: track.publisher,
                              service: 'AUDIO',
                              title: track.title,
                              artist: track.artist,
                              context: track.publisher,
                            });
                          })()
                        }
                      >
                        Play
                      </Button>
                      <Button
                        component={RouterLink}
                        to={`/songs/${encodeURIComponent(track.publisher)}/${encodeURIComponent(track.identifier)}`}
                        variant="text"
                        fullWidth
                      >
                        Open
                      </Button>
                    </Stack>
                  }
                />
              </Grid>
            ))}
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            kicker="YOUR SPACE"
            title="Library activity at a glance"
            body="Keep favorite songs and playlists nearby, then use recent playback history to jump back into the last listening session."
            meta={[
              `${favoriteSongs.length} saved songs`,
              `${favoritePlaylists.length} saved playlists`,
              `${recentSongs.length} recent plays`,
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          {playlistsLoading ? (
            <Skeleton variant="rounded" height={220} />
          ) : playlists[0] ? (
            <SectionCard
              kicker="LATEST PLAYLIST"
              title={playlists[0].title}
              media={
                <ArtworkThumb
                  kind="playlist"
                  publisher={playlists[0].publisher}
                  identifier={playlists[0].identifier}
                  title={playlists[0].title}
                  size={92}
                />
              }
              body={formatPlaylistCardMetadata({
                title: playlists[0].title,
                publisher: playlists[0].publisher,
                description: playlists[0].description,
                songCount: playlists[0].songCount,
              })}
              meta={[
                'PLAYLIST',
                `${playlists[0].songCount} tracks`,
                playlists[0].publisher,
              ]}
              action={
                <Button
                  component={RouterLink}
                  to={`/playlists/${encodeURIComponent(playlists[0].publisher)}/${encodeURIComponent(playlists[0].identifier)}`}
                  variant="contained"
                  fullWidth
                >
                  Open playlist
                </Button>
              }
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {songsError || playlistsError || 'No playlists found yet.'}
            </Typography>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
};
