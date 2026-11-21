import { VolumeOffRounded, VolumeUpRounded } from '@mui/icons-material';
import {
  Box,
  IconButton,
  Popover,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { useAtom } from 'jotai';
import { useId, useRef, useState } from 'react';
import { volumeAtom } from '../../state/player';

export const VolumeControl = () => {
  const [volume, setVolume] = useAtom(volumeAtom);
  const previousVolume = useRef(volume || 0.9);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const id = useId();
  const percent = Math.round(volume * 100);

  return (
    <>
      <IconButton
        aria-label="Volume controls"
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? id : undefined}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
      >
        {volume === 0 ? <VolumeOffRounded /> : <VolumeUpRounded />}
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        disableScrollLock
        sx={{ zIndex: 1600 }}
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              width: 270,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: 2,
            },
          },
        }}
      >
        <Box id={id} role="dialog" aria-label="Volume controls" data-no-drag>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="body2">Volume</Typography>
            <Typography variant="body2">{percent}%</Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <IconButton
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              onClick={() => {
                if (volume > 0) {
                  previousVolume.current = volume;
                  setVolume(0);
                } else setVolume(previousVolume.current);
              }}
            >
              {volume === 0 ? <VolumeOffRounded /> : <VolumeUpRounded />}
            </IconButton>
            <Box sx={{ position: 'relative', flex: 1, mx: 1 }}>
              <Box
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  inset: '8px 0',
                  clipPath: 'polygon(0 48%, 100% 0, 100% 100%, 0 52%)',
                  pointerEvents: 'none',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'primary.main',
                    opacity: 0.16,
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${percent}%`,
                    bgcolor: 'primary.main',
                    opacity: 0.7,
                  }}
                />
              </Box>
              <Slider
                aria-label="Volume"
                min={0}
                max={100}
                step={1}
                value={percent}
                getAriaValueText={(value) => `${value}%`}
                onChange={(_, value) => {
                  const next = (value as number) / 100;
                  if (next > 0) previousVolume.current = next;
                  setVolume(next);
                }}
                sx={{
                  display: 'block',
                  height: 28,
                  py: 1,
                  '& .MuiSlider-rail, & .MuiSlider-track': { opacity: 0 },
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                    border: '2px solid',
                    borderColor: 'background.paper',
                  },
                }}
              />
            </Box>
          </Stack>
        </Box>
      </Popover>
    </>
  );
};
