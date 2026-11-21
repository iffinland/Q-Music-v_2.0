import { VolumeControl } from './VolumeControl';
import { PublicationBadge } from '../common/PublicationBadge';
import {
  CloseRounded,
  OpenInFullRounded,
  PauseRounded,
  PlayArrowRounded,
  QueueMusicRounded,
  SouthRounded,
  SkipNextRounded,
  SkipPreviousRounded,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ImageLightbox } from '../common/ImageLightbox';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import {
  playbackAttemptAtom,
  currentTimeAtom,
  currentTrackAtom,
  durationAtom,
  floatingPlayerPositionAtom,
  isFloatingPlayerAtom,
  isPlayingAtom,
  playerErrorAtom,
  queueAtom,
  queueLengthAtom,
  streamUrlAtom,
  volumeAtom,
} from '../../state/player';

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export const FloatingMiniPlayer = () => {
  const currentTrack = useAtomValue(currentTrackAtom);
  const queue = useAtomValue(queueAtom);
  const queueLength = useAtomValue(queueLengthAtom);
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);
  const [currentTime, setCurrentTime] = useAtom(currentTimeAtom);
  const [duration, setDuration] = useAtom(durationAtom);
  const [playerError, setPlayerError] = useAtom(playerErrorAtom);
  const streamUrl = useAtomValue(streamUrlAtom);
  const [isFloating, setIsFloating] = useAtom(isFloatingPlayerAtom);
  const [floatingPosition, setFloatingPosition] = useAtom(
    floatingPlayerPositionAtom
  );
  const [playbackAttempt, setPlaybackAttempt] = useAtom(playbackAttemptAtom);
  const volume = useAtomValue(volumeAtom);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [seekNotice, setSeekNotice] = useState('');
  const playerRef = useRef<HTMLDivElement>(null);
  const setCurrentTrack = useSetAtom(currentTrackAtom);
  const setQueue = useSetAtom(queueAtom);
  const setDurationValue = useSetAtom(durationAtom);
  const setCurrentTimeValue = useSetAtom(currentTimeAtom);
  const setStreamUrlValue = useSetAtom(streamUrlAtom);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const stopFloatingDrag = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  const currentIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return queue.findIndex((item) => item.key === currentTrack.key);
  }, [currentTrack, queue]);

  const selectTrackAt = useCallback(
    (index: number) => {
      const nextTrack = queue[index];
      if (!nextTrack) return;
      setCurrentTrack(nextTrack);
      setIsPlaying(true);
    },
    [queue, setCurrentTrack, setIsPlaying]
  );

  const {
    status: resourceStatusLabel,
    buffering,
    seek,
    setPlaying,
    stop,
  } = useAudioPlayback({
    track: currentTrack,
    isPlaying,
    volume,
    attempt: playbackAttempt,
    onPlaying: setIsPlaying,
    onTime: setCurrentTime,
    onDuration: setDuration,
    onUrl: setStreamUrlValue,
    onError: setPlayerError,
    onEnded: () => {
      const nextIndex = currentIndex + 1;
      if (nextIndex > 0 && nextIndex < queue.length) selectTrackAt(nextIndex);
      else setIsPlaying(false);
    },
  });
  const retryPlayback = () => {
    setPlaybackAttempt((value) => value + 1);
    setIsPlaying(true);
  };

  useEffect(() => {
    setSeekPreview(null);
    setSeekNotice('');
  }, [currentTrack?.key, playbackAttempt]);

  const clampFloatingPosition = useCallback((x: number, y: number) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const playerWidth = Math.min(360, viewportWidth - 24);
    const playerHeight =
      playerRef.current?.getBoundingClientRect().height || 300;

    return {
      x: Math.min(
        Math.max(12, x),
        Math.max(12, viewportWidth - playerWidth - 12)
      ),
      y: Math.min(
        Math.max(12, y),
        Math.max(12, viewportHeight - playerHeight - 12)
      ),
    };
  }, []);

  useEffect(() => {
    if (!isFloating) return;

    const onResize = () => {
      setFloatingPosition((current) =>
        clampFloatingPosition(current.x, current.y)
      );
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampFloatingPosition, isFloating, setFloatingPosition]);

  useEffect(() => {
    if (!isFloating) {
      stopFloatingDrag();
    }
  }, [isFloating, stopFloatingDrag]);

  useEffect(() => {
    if (!isFloating) return;

    const onWindowPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const nextPosition = clampFloatingPosition(
        dragState.x + (event.clientX - dragState.startX),
        dragState.y + (event.clientY - dragState.startY)
      );
      setFloatingPosition(nextPosition);
    };

    const onWindowPointerUp = (event: PointerEvent) => {
      if (dragStateRef.current?.pointerId === event.pointerId) {
        stopFloatingDrag();
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [
    clampFloatingPosition,
    isFloating,
    setFloatingPosition,
    stopFloatingDrag,
  ]);

  const handleDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isFloating) return;

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'button, a, input, textarea, select, [role="button"], [data-no-drag]'
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: floatingPosition.x,
        y: floatingPosition.y,
      };
    },
    [floatingPosition.x, floatingPosition.y, isFloating]
  );

  const handleClosePlayer = () => {
    stop();

    setIsPlaying(false);
    setCurrentTrack(null);
    setQueue([]);
    setCurrentTimeValue(0);
    setDurationValue(0);
    setStreamUrlValue(null);
    setPlayerError(null);
    setIsFloating(false);
  };

  if (!currentTrack) {
    return null;
  }

  const canSeek =
    Boolean(streamUrl) &&
    Number.isFinite(duration) &&
    duration > 0 &&
    !playerError;
  const seekMaximum = canSeek ? duration : 1;
  const seekValue = Math.max(
    0,
    Math.min(seekMaximum, seekPreview ?? currentTime)
  );
  const artwork = currentTrack.artworkUrl || null;

  return (
    <Box
      ref={playerRef}
      onPointerUp={(event) => {
        if (dragStateRef.current?.pointerId === event.pointerId) {
          stopFloatingDrag();
        }
      }}
      onPointerCancel={stopFloatingDrag}
      sx={{
        position: 'fixed',
        left: isFloating ? floatingPosition.x : { xs: 12, md: 28 },
        top: isFloating ? floatingPosition.y : 'auto',
        right: isFloating ? 'auto' : { xs: 12, md: 28 },
        bottom: isFloating ? 'auto' : { xs: 12, md: 20 },
        width: isFloating ? { xs: 'calc(100vw - 24px)', sm: 360 } : 'auto',
        maxWidth: isFloating ? 'calc(100vw - 24px)' : 'none',
        maxHeight: 'calc(100dvh - 24px)',
        overflowY: 'auto',
        zIndex: 1400,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 2,
        py: 1.5,
        backdropFilter: 'blur(22px)',
        background: 'var(--qm-panel-bg)',
        boxShadow: 'var(--qm-shadow-strong)',
        userSelect: dragStateRef.current ? 'none' : 'auto',
      }}
    >
      {playerError ? (
        <Alert
          severity="warning"
          sx={{ mb: 1.5 }}
          action={
            <Button color="inherit" onClick={retryPlayback}>
              Retry
            </Button>
          }
        >
          {playerError}
        </Alert>
      ) : null}
      <Stack
        direction={{ xs: 'column', md: isFloating ? 'column' : 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', md: isFloating ? 'stretch' : 'center' }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          onPointerDown={handleDragStart}
          sx={{
            cursor: isFloating ? 'grab' : 'default',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {artwork ? (
            <ImageLightbox src={artwork} alt={currentTrack.title}>
              {({ open }) => (
                <Box
                  component="img"
                  src={artwork}
                  alt={currentTrack.title}
                  data-no-drag
                  onClick={(event) => {
                    event.stopPropagation();
                    open();
                  }}
                  sx={{
                    width: 52,
                    height: 52,
                    objectFit: 'cover',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    flexShrink: 0,
                    cursor: 'zoom-in',
                  }}
                />
              )}
            </ImageLightbox>
          ) : null}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: 'primary.light', letterSpacing: '0.16em' }}
            >
              {isFloating ? 'FLOAT PLAYER' : 'MINI PLAYER'}
            </Typography>
            <PublicationBadge identifier={currentTrack.identifier} />
            <Typography variant="h6" noWrap>
              {currentTrack.title}
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
              {currentTrack.artist}
              {currentTrack.context ? ` • ${currentTrack.context}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.25} alignItems="center">
            <IconButton
              color="inherit"
              size="small"
              aria-label={isFloating ? 'Dock player' : 'Float player'}
              onClick={() => {
                if (!isFloating) {
                  setFloatingPosition(clampFloatingPosition(20, 20));
                }
                setIsFloating((value) => !value);
              }}
            >
              {isFloating ? <SouthRounded /> : <OpenInFullRounded />}
            </IconButton>
            <IconButton
              color="inherit"
              size="small"
              aria-label="Close player"
              onClick={handleClosePlayer}
            >
              <CloseRounded />
            </IconButton>
          </Stack>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
        >
          <IconButton
            color="inherit"
            aria-label="Previous song"
            disabled={currentIndex <= 0}
            onClick={() => selectTrackAt(currentIndex - 1)}
          >
            <SkipPreviousRounded />
          </IconButton>
          <IconButton
            color="primary"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={() =>
              playerError && !playerError.startsWith('Press Play')
                ? retryPlayback()
                : setPlaying(!isPlaying)
            }
          >
            {isPlaying ? <PauseRounded /> : <PlayArrowRounded />}
          </IconButton>
          <IconButton
            color="inherit"
            aria-label="Next song"
            disabled={currentIndex < 0 || currentIndex >= queue.length - 1}
            onClick={() => selectTrackAt(currentIndex + 1)}
          >
            <SkipNextRounded />
          </IconButton>
          <VolumeControl />
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ minWidth: { md: isFloating ? 'auto' : 240 } }}
        >
          <QueueMusicRounded fontSize="small" />
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', minWidth: 92 }}
          >
            Queue {queueLength}
          </Typography>
          <Typography variant="body2">
            {formatTime(seekPreview ?? currentTime)} /{' '}
            {formatTime(duration || NaN)}
          </Typography>
        </Stack>
      </Stack>
      {buffering && resourceStatusLabel ? (
        <Stack spacing={0.5} sx={{ mt: 1.25 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {resourceStatusLabel}
          </Typography>
          <LinearProgress
            variant="indeterminate"
            sx={{
              height: 6,
              borderRadius: 999,
              backgroundColor: 'var(--qm-surface-soft-strong)',
            }}
          />
        </Stack>
      ) : null}
      <Box data-no-drag sx={{ px: 1, mt: 0.5 }}>
        <Slider
          aria-label="Song position"
          min={0}
          max={seekMaximum}
          step={1}
          value={seekValue}
          disabled={!canSeek}
          getAriaValueText={(value) => formatTime(value)}
          valueLabelDisplay="auto"
          valueLabelFormat={formatTime}
          onChange={(_, value) => setSeekPreview(value as number)}
          onChangeCommitted={(_, value) => {
            if (!seek(value as number))
              setSeekNotice(
                'Seeking is not available yet. Please wait for audio to load.'
              );
            else setSeekNotice('');
            setSeekPreview(null);
          }}
        />
      </Box>
      {seekNotice ? (
        <Typography role="status" variant="caption">
          {seekNotice}
        </Typography>
      ) : null}
    </Box>
  );
};
