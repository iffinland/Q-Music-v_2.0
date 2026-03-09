import { Alert, Button, Grid, Stack, Typography } from '@mui/material';
import { useGlobal } from 'qapp-core';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ArtworkThumb } from '../components/common/ArtworkThumb';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { fetchPlaylistsByPublisher } from '../services/playlists';
import { fetchSongsByPublisher } from '../services/songs';
import type { PlaylistSummary, SongSummary } from '../types/media';
import { formatPlaylistCardMetadata } from '../utils/playlistMetadata';
import { formatSongCardMetadata } from '../utils/songMetadata';

export const MyMusicPage = () => {
  const { auth } = useGlobal();
  const publisher = auth?.name?.trim() || '';
  const [songLimit, setSongLimit] = useState(24);
  const [playlistLimit, setPlaylistLimit] = useState(24);
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publisher) {
      setSongs([]);
      setPlaylists([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [loadedSongs, loadedPlaylists] = await Promise.all([
          fetchSongsByPublisher(publisher, { limit: songLimit }),
          fetchPlaylistsByPublisher(publisher, { limit: playlistLimit }),
        ]);

        if (cancelled) return;
        setSongs(loadedSongs);
        setPlaylists(loadedPlaylists);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load your published music.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [playlistLimit, publisher, songLimit]);

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow="MY MUSIC"
        title="Manage your published songs and playlists."
        description="This workspace is for owner-side actions: review what is already live on QDN, open it directly, or jump into edit flows for republishing updates."
      />
      {!publisher ? (
        <Alert severity="warning">
          Log in through Qortal to manage your published songs and playlists.
        </Alert>
      ) : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}
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
                          <Button
                            component={RouterLink}
                            to={`/my-music/songs/${encodeURIComponent(song.identifier)}/edit`}
                            variant="contained"
                            fullWidth
                          >
                            Edit song
                          </Button>
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
            {songs.length >= songLimit ? (
              <Button
                variant="outlined"
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
                          <Button
                            component={RouterLink}
                            to={`/my-music/playlists/${encodeURIComponent(playlist.identifier)}/edit`}
                            variant="contained"
                            fullWidth
                          >
                            Edit playlist
                          </Button>
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
            {playlists.length >= playlistLimit ? (
              <Button
                variant="outlined"
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
