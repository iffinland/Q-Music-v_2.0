import { CreatorLink } from '../../common/CreatorLink';
import { PlayArrowRounded } from '@mui/icons-material';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import type { PlaylistSummary, SongSummary } from '../../../types/media';
import type { MediaCardProps } from '../types';
import { parseSongMetadata } from '../../../utils/songMetadata';
import { ArtworkThumb } from '../../common/ArtworkThumb';
import { PublicationBadge } from '../../common/PublicationBadge';

const clamp = (lines: number) =>
  ({
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  }) as const;

export const ModernMediaCard = ({
  kind,
  item,
  onPlay,
  busy,
  actions,
}: MediaCardProps) => {
  const location = useLocation();
  const song = kind === 'song' ? (item as SongSummary) : null;
  const subtitle =
    song?.artist ||
    (typeof (item as PlaylistSummary).songCount === 'number'
      ? `${(item as PlaylistSummary).songCount} tracks`
      : 'Playlist');
  const description = song
    ? song.notes ||
      parseSongMetadata(song.description).notes ||
      song.album ||
      ''
    : item.description || '';
  const to = `/${kind === 'song' ? 'songs' : 'playlists'}/${encodeURIComponent(item.publisher)}/${encodeURIComponent(item.identifier)}`;
  return (
    <Card
      variant="outlined"
      component="article"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        borderRadius: 2,
        background: 'var(--qm-panel-bg)',
        boxShadow: 'none',
      }}
    >
      <Box sx={{ display: 'block', flexGrow: 1, position: 'relative' }}>
        <Box
          component={Link}
          to={to}
          state={{
            mediaModal: true,
            returnTo: location.pathname + location.search,
          }}
          aria-label={`Details: ${item.title}`}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            borderRadius: 'inherit',
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: -2,
            },
          }}
        />

        <Box
          sx={{
            aspectRatio: '1',
            width: '100%',
            overflow: 'hidden',
            bgcolor: 'var(--qm-surface-soft)',
          }}
        >
          <ArtworkThumb
            kind={kind}
            publisher={item.publisher}
            identifier={item.identifier}
            title={item.title}
            fluid
            interactive={false}
            radius={0}
          />
        </Box>
        <Stack spacing={0.75} sx={{ p: 1.25 }}>
          <Typography
            component="h3"
            title={item.title}
            sx={{
              ...clamp(2),
              fontWeight: 700,
              fontSize: '1rem',
              lineHeight: 1.3,
              height: '2.6em',
            }}
          >
            {item.title}
          </Typography>
          <Typography
            variant="body2"
            title={subtitle}
            sx={{ ...clamp(1), height: '1.4em', color: 'text.secondary' }}
          >
            {song ? <CreatorLink kind="artist" name={song.artist} /> : subtitle}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              ...clamp(2),
              lineHeight: 1.4,
              height: '2.8em',
              color: 'text.secondary',
            }}
          >
            {description || '\u00a0'}
          </Typography>
          <Typography
            variant="caption"
            title={`@${item.publisher}`}
            sx={{
              ...clamp(2),
              lineHeight: 1.4,
              height: '2.8em',
              fontWeight: 600,
            }}
          >
            <CreatorLink kind="publisher" name={item.publisher} />
          </Typography>
          <Box
            sx={{ minHeight: 38, display: 'flex', alignItems: 'flex-start' }}
          >
            <PublicationBadge identifier={item.identifier} />
          </Box>
        </Stack>
      </Box>
      <Stack spacing={1} sx={{ px: 1.25, pb: 1.25 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<PlayArrowRounded />}
          disabled={busy}
          onClick={onPlay}
        >
          {busy ? 'Loading…' : 'Play'}
        </Button>
        {actions}
      </Stack>
    </Card>
  );
};
