import { CreatorLink } from '../../common/CreatorLink';
import { Box, Button, Stack } from '@mui/material';
import { PlayArrowRounded } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import type { SongSummary } from '../../../types/media';
import { formatSongCardMetadata } from '../../../utils/songMetadata';
import { formatPlaylistCardMetadata } from '../../../utils/playlistMetadata';
import { ArtworkThumb } from '../../common/ArtworkThumb';
import { SectionCard } from '../../common/SectionCard';
import type { MediaCardProps } from '../types';

export const ClassicMediaCard = ({
  kind,
  item,
  onPlay,
  busy,
  actions,
}: MediaCardProps) => {
  const location = useLocation();
  const to = `/${kind === 'song' ? 'songs' : 'playlists'}/${encodeURIComponent(item.publisher)}/${encodeURIComponent(item.identifier)}`;
  const state = {
    mediaModal: true,
    returnTo: location.pathname + location.search,
  };
  return (
    <Box
      component="article"
      sx={{ height: '100%', minWidth: 0, overflowWrap: 'anywhere' }}
    >
      <SectionCard
        originIdentifier={item.identifier}
        kicker={
          kind === 'song' ? (
            <CreatorLink kind="artist" name={(item as SongSummary).artist} />
          ) : (
            <CreatorLink kind="publisher" name={item.publisher} />
          )
        }
        title={
          <Link to={to} state={state} aria-label={`Details: ${item.title}`}>
            {item.title}
          </Link>
        }
        media={
          <ArtworkThumb
            kind={kind}
            publisher={item.publisher}
            identifier={item.identifier}
            title={item.title}
            size={84}
          />
        }
        body={
          <>
            <CreatorLink kind="publisher" name={item.publisher} />
            {'\n'}
            {kind === 'song'
              ? formatSongCardMetadata({ ...item, notesMaxLength: 80 })
              : formatPlaylistCardMetadata(item)}
          </>
        }
        meta={[kind === 'song' ? 'AUDIO' : 'PLAYLIST', item.publisher]}
        action={
          <Stack spacing={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<PlayArrowRounded />}
                disabled={busy}
                onClick={onPlay}
              >
                {busy ? 'Loading…' : 'Play'}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                component={Link}
                to={to}
                state={state}
              >
                Details
              </Button>
            </Stack>
            {actions}
          </Stack>
        }
      />
    </Box>
  );
};
