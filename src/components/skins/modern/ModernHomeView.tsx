import { Stack, Typography } from '@mui/material';
import { CardSkeletons, MediaRail } from '../../common/MediaCollection';
import { MediaCard } from '../../common/MediaCard';
import type { HomeViewProps } from '../types';
export const ModernHomeView = (props: HomeViewProps) => (
  <Stack spacing={{ xs: 3, md: 4 }}>
    <Stack spacing={0.5}>
      <Typography component="h1" variant="h2" sx={{ fontWeight: 800 }}>
        Discover your next listen
      </Typography>
      <Typography color="text.secondary">
        Fresh music and playlists from Q-Music and Ear-Bump.
      </Typography>
    </Stack>
    <MediaRail title="Latest songs" to="/songs">
      {props.songsLoading && !props.songs.length ? (
        <CardSkeletons />
      ) : (
        props.songs
          .slice(0, 15)
          .map((song, index) => (
            <MediaCard
              key={song.id}
              kind="song"
              item={song}
              onPlay={() => props.onPlaySong(song, index)}
            />
          ))
      )}
    </MediaRail>
    {!props.songsLoading && !props.songs.length ? (
      <Typography color="text.secondary">No songs found yet.</Typography>
    ) : null}
    <MediaRail title="Latest playlists" to="/playlists/all">
      {props.playlistsLoading && !props.playlists.length ? (
        <CardSkeletons />
      ) : (
        props.playlists
          .slice(0, 15)
          .map((playlist) => (
            <MediaCard
              key={playlist.id}
              kind="playlist"
              item={playlist}
              busy={props.playlistLoadingId === playlist.id}
              onPlay={() => props.onPlayPlaylist(playlist)}
            />
          ))
      )}
    </MediaRail>
    {!props.playlistsLoading && !props.playlists.length ? (
      <Typography color="text.secondary">No playlists found yet.</Typography>
    ) : null}
  </Stack>
);
