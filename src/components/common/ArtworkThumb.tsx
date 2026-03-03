import { Box, Skeleton, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { resolvePlaylistArtwork } from '../../services/playlists';
import { resolveSongArtwork } from '../../services/songs';

interface ArtworkThumbProps {
  kind: 'song' | 'playlist';
  publisher: string;
  identifier: string;
  title: string;
  size?: number;
  radius?: number;
}

export const ArtworkThumb = ({
  kind,
  publisher,
  identifier,
  title,
  size = 72,
  radius = 2.5,
}: ArtworkThumbProps) => {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const result =
          kind === 'song'
            ? await resolveSongArtwork(publisher, identifier)
            : await resolvePlaylistArtwork(publisher, identifier);

        if (!cancelled) {
          setArtworkUrl(result);
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
  }, [identifier, kind, publisher]);

  if (isLoading) {
    return <Skeleton variant="rounded" width={size} height={size} />;
  }

  if (artworkUrl) {
    return (
      <Box
        component="img"
        src={artworkUrl}
        alt={title}
        sx={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: radius,
          border: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: radius,
        border: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, rgba(21,52,102,0.35) 0%, rgba(11,16,24,0.9) 100%)',
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: 'primary.light', fontWeight: 700 }}
      >
        {title.slice(0, 2).toUpperCase()}
      </Typography>
    </Box>
  );
};
