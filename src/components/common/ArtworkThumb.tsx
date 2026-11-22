import { isEarBumpIdentifier } from '../../utils/mediaOrigin';
import { Box, Skeleton, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useQdnResource } from '../../hooks/useQdnResource';
import { ImageLightbox } from './ImageLightbox';

interface ArtworkThumbProps {
  kind: 'song' | 'playlist';
  publisher: string;
  identifier: string;
  title: string;
  size?: number;
  radius?: number;
  fluid?: boolean;
  interactive?: boolean;
}

export const ArtworkThumb = ({
  kind,
  publisher,
  identifier,
  title,
  size = 72,
  radius = 2,
  fluid = false,
  interactive = true,
}: ArtworkThumbProps) => {
  const embeddedPlaylistCover =
    kind === 'playlist' && isEarBumpIdentifier(identifier);
  const resourceService = 'THUMBNAIL';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const {
    url: artworkUrl,
    isLoading,
    onLoad,
    onError,
  } = useQdnResource({
    service: resourceService,
    name: publisher,
    identifier,
    enabled: isVisible && !embeddedPlaylistCover,
    timeoutMs: 30_000,
  });

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
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

  const width = fluid ? '100%' : size;
  const height = fluid ? '100%' : size;

  if (!isVisible || isLoading) {
    return (
      <Box ref={hostRef} sx={{ width, height }}>
        <Skeleton variant="rounded" width={width} height={height} />
      </Box>
    );
  }

  if (artworkUrl) {
    const image = (open?: () => void) => (
      <Box
        ref={hostRef}
        component="img"
        src={artworkUrl}
        alt={title}
        loading="lazy"
        decoding="async"
        onLoad={onLoad}
        onError={onError}
        onClick={open}
        sx={{
          width,
          height,
          objectFit: 'cover',
          borderRadius: radius,
          display: 'block',
          flexShrink: 0,
          cursor: open ? 'zoom-in' : 'inherit',
        }}
      />
    );
    return interactive ? (
      <ImageLightbox src={artworkUrl} alt={title}>
        {({ open }) => image(open)}
      </ImageLightbox>
    ) : (
      image()
    );
  }

  return (
    <Box
      ref={hostRef}
      sx={{
        width,
        height,
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
