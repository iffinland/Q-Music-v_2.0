import { Button, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { PageHero } from '../../common/PageHero';
import { SectionCard } from '../../common/SectionCard';
import { ClassicMediaCard } from './ClassicMediaCard';
import type { HomeViewProps } from '../types';
export const ClassicHomeView = (props: HomeViewProps) => (
  <Stack spacing={3}>
    <PageHero
      eyebrow=""
      title="Listen, browse, publish and organize your QDN music."
      description=""
      actions={
        <>
          <Button component={Link} to="/songs" variant="contained">
            Browse All Audio
          </Button>
          <Button component={Link} to="/playlists/all" variant="outlined">
            Explore Playlists
          </Button>
        </>
      }
    />
    <Grid container spacing={2.5}>
      {props.songsLoading && !props.songs.length
        ? [0, 1].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={220} />
            </Grid>
          ))
        : props.songs.slice(0, 2).map((song, index) => (
            <Grid key={song.id} size={{ xs: 12, md: 6 }}>
              <ClassicMediaCard
                kind="song"
                item={song}
                onPlay={() => props.onPlaySong(song, index)}
              />
            </Grid>
          ))}
    </Grid>
    {!props.songsLoading && !props.songs.length ? (
      <Typography color="text.secondary">No songs found yet.</Typography>
    ) : null}
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <SectionCard
          kicker="YOUR SPACE"
          title="Library activity at a glance"
          body="Keep favorite songs and playlists nearby, then return to your recent listening sessions."
          meta={[
            `${props.libraryCounts.songs} saved songs`,
            `${props.libraryCounts.playlists} saved playlists`,
            `${props.libraryCounts.recent} recent plays`,
          ]}
        />
      </Grid>
      <Grid size={{ xs: 12, lg: 5 }}>
        {props.playlistsLoading && !props.playlists.length ? (
          <Skeleton variant="rounded" height={220} />
        ) : props.playlists[0] ? (
          <ClassicMediaCard
            kind="playlist"
            item={props.playlists[0]}
            busy={props.playlistLoadingId === props.playlists[0].id}
            onPlay={() => props.onPlayPlaylist(props.playlists[0])}
          />
        ) : (
          <Typography color="text.secondary">
            No playlists found yet.
          </Typography>
        )}
      </Grid>
    </Grid>
  </Stack>
);
