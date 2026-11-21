import { isEarBumpIdentifier } from '../utils/mediaOrigin';
import { Alert, Button, Grid, Stack, Typography } from '@mui/material';
import { useGlobal } from '../qortal';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ArtworkThumb } from '../components/common/ArtworkThumb';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { usePlaylistsFeed } from '../hooks/usePlaylistsFeed';
import { emitMediaRefresh } from '../utils/mediaEvents';
import { formatPlaylistCardMetadata } from '../utils/playlistMetadata';
import { formatSongCardMetadata } from '../utils/songMetadata';

export const MyMusicPage = () => {
  const { auth } = useGlobal();
  const publisher = auth?.name?.trim() || '';
  const [songLimit, setSongLimit] = useState(24);
  const [playlistLimit, setPlaylistLimit] = useState(24);
  const songFeed = useSongsFeed(songLimit, publisher);
  const playlistFeed = usePlaylistsFeed(playlistLimit, publisher);
  const { songs } = songFeed;
  const { playlists } = playlistFeed;
  const isLoading = songFeed.isLoading || playlistFeed.isLoading;
  const error = songFeed.error || playlistFeed.error;

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow=""
        title="Manage your published songs and playlists."
        description="This workspace is for owner-side actions: review what is already live on QDN, open it directly, or jump into edit flows for republishing updates."
      />
      {!publisher ? (
        <Alert severity="warning">
          Log in through Qortal to manage your published songs and playlists.
        </Alert>
      ) : null}
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
      <Button onClick={emitMediaRefresh} disabled={isLoading}>
        Refresh my music
      </Button>
      {isLoading ? (
        <Typography variant="body2">Loading your published music...</Typography>
      ) : null}

      {publisher ? (
        <>
          <Stack spacing={2}>
            <Typography variant="h4">Your Songs</Typography>
            {songs.length ? (
              <Grid container spacing={2.5}>
                {songs.map((song) => (
                  <Grid key={song.id} size={{ xs: 12, md: 6 }}>
                    <SectionCard
                      originIdentifier={song.identifier}
                      kicker={song.artist}
                      title={song.title}
                      media={
                        <ArtworkThumb
                          kind="song"
                          publisher={song.publisher}
                          identifier={song.identifier}
                          title={song.title}
                        />
                      }
                      body={formatSongCardMetadata({
                        title: song.title,
                        publisher: song.publisher,
                        description: song.description,
                        notesMaxLength: 80,
                      })}
                      meta={['AUDIO', 'Owner item']}
                      action={
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                        >
                          <Button
                            component={RouterLink}
                            to={`/songs/${encodeURIComponent(song.publisher)}/${encodeURIComponent(song.identifier)}`}
                            variant="outlined"
                            fullWidth
                          >
                            Open
                          </Button>
                          {!isEarBumpIdentifier(song.identifier) && (
                            <Button
                              component={RouterLink}
                              to={`/my-music/songs/${encodeURIComponent(song.identifier)}/edit`}
                              variant="contained"
                              fullWidth
                            >
                              Edit song
                            </Button>
                          )}
                        </Stack>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No published songs were found for your current Qortal name.
              </Typography>
            )}
            {songFeed.hasMore ? (
              <Button
                variant="outlined"
                disabled={songFeed.isLoading}
                onClick={() => setSongLimit((current) => current + 24)}
              >
                Load more songs
              </Button>
            ) : null}
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h4">Your Playlists</Typography>
            {playlists.length ? (
              <Grid container spacing={2.5}>
                {playlists.map((playlist) => (
                  <Grid key={playlist.id} size={{ xs: 12, md: 4 }}>
                    <SectionCard
                      originIdentifier={playlist.identifier}
                      kicker={playlist.publisher}
                      title={playlist.title}
                      media={
                        <ArtworkThumb
                          kind="playlist"
                          publisher={playlist.publisher}
                          identifier={playlist.identifier}
                          title={playlist.title}
                        />
                      }
                      body={formatPlaylistCardMetadata({
                        title: playlist.title,
                        publisher: playlist.publisher,
                        description: playlist.description,
                        publishedDate: playlist.publishedDate,
                        songCount: playlist.songCount,
                      })}
                      meta={['PLAYLIST', 'Owner item']}
                      action={
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                        >
                          <Button
                            component={RouterLink}
                            to={`/playlists/${encodeURIComponent(playlist.publisher)}/${encodeURIComponent(playlist.identifier)}`}
                            variant="outlined"
                            fullWidth
                          >
                            Open
                          </Button>
                          {!isEarBumpIdentifier(playlist.identifier) && (
                            <Button
                              component={RouterLink}
                              to={`/my-music/playlists/${encodeURIComponent(playlist.identifier)}/edit`}
                              variant="contained"
                              fullWidth
                            >
                              Edit playlist
                            </Button>
                          )}
                        </Stack>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No published playlists were found for your current Qortal name.
              </Typography>
            )}
            {playlistFeed.hasMore ? (
              <Button
                variant="outlined"
                disabled={playlistFeed.isLoading}
                onClick={() => setPlaylistLimit((current) => current + 24)}
              >
                Load more playlists
              </Button>
            ) : null}
          </Stack>
        </>
      ) : null}
    </Stack>
  );
};
