import { CloseRounded } from '@mui/icons-material';
import { Box, Dialog, IconButton } from '@mui/material';
import { useState, type ReactNode } from 'react';

interface ImageLightboxProps {
  alt: string;
  src: string;
  children: (controls: { open: () => void }) => ReactNode;
}

export const ImageLightbox = ({
  alt,
  src,
  children,
}: ImageLightboxProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {children({
        open: () => setOpen(true),
      })}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: '80vw',
            maxWidth: '80vw',
            height: '80vh',
            maxHeight: '80vh',
            backgroundColor: 'rgba(10, 10, 12, 0.96)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            overflow: 'hidden',
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <IconButton
            onClick={() => setOpen(false)}
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 1,
              color: 'white',
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
            aria-label="Close image preview"
          >
            <CloseRounded />
          </IconButton>
          <Box
            component="img"
            src={src}
            alt={alt}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              userSelect: 'none',
            }}
          />
        </Box>
      </Dialog>
    </>
  );
};
