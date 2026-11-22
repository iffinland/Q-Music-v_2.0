import { CloseRounded } from '@mui/icons-material';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  useMediaQuery,
} from '@mui/material';
import { useRef } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';

// Keep the originating page mounted: filters, feed cursors, rail position and
// page state survive a detail visit. The real detail URL retains share/back support.
export const MediaDetailOutlet = () => {
  const outlet = useOutlet();
  const location = useLocation();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width:599px)');
  const isDetail = /^\/(songs|playlists)\/[^/]+\/[^/]+\/?$/.test(
    location.pathname
  );
  const background = useRef(isDetail ? null : outlet);
  if (!isDetail) background.current = outlet;
  const hasBackground =
    isDetail && location.state?.mediaModal && background.current;
  const close = () => {
    if (hasBackground) void navigate(-1);
    else
      void navigate(
        location.pathname.startsWith('/songs/') ? '/songs' : '/playlists/all',
        { replace: true }
      );
  };
  return (
    <>
      {isDetail ? (hasBackground ? background.current : null) : outlet}
      {isDetail ? (
        <Dialog
          open
          onClose={close}
          fullScreen={mobile}
          fullWidth
          maxWidth="lg"
          aria-labelledby="media-detail-title"
        >
          <DialogTitle
            id="media-detail-title"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            {location.pathname.startsWith('/songs/')
              ? 'Song details'
              : 'Playlist details'}
            <IconButton aria-label="Close details" onClick={close}>
              <CloseRounded />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ pb: 32, overflowWrap: 'anywhere' }}>
            <Box sx={{ py: 1 }}>{outlet}</Box>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
