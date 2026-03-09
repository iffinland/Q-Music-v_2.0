import { Box, Skeleton, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useQdnResource } from '../../hooks/useQdnResource';

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
  radius = 2,
}: ArtworkThumbProps) => {
  const resourceService = kind === 'playlist' ? 'THUMBNAIL' : 'THUMBNAIL';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { url: artworkUrl, isLoading } = useQdnResource({
    service: resourceService,
    name: publisher,
    identifier,
    enabled: isVisible,
    timeoutMs: 30_000,
  });

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '180px',
      }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  if (!isVisible || isLoading) {
    return (
      <Box ref={hostRef}>
        <Skeleton variant="rounded" width={size} height={size} />
      </Box>
    );
  }

  if (artworkUrl) {
    return (
      <Box
        ref={hostRef}
        component="img"
        src={artworkUrl}
        alt={title}
        loading="lazy"
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
      ref={hostRef}
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
        background: 'var(--qm-thumb-bg)',
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
