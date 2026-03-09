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
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveSongStreamUrl } from '../../services/songs';
import {
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
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
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
  const [streamUrl, setStreamUrl] = useAtom(streamUrlAtom);
  const [playerError, setPlayerError] = useAtom(playerErrorAtom);
  const [isFloating, setIsFloating] = useAtom(isFloatingPlayerAtom);
  const [floatingPosition, setFloatingPosition] = useAtom(
    floatingPlayerPositionAtom
  );
  const [resourceStatusLabel, setResourceStatusLabel] = useState<string | null>(
    null
  );
  const [resourceProgress, setResourceProgress] = useState<number | null>(null);
  const volume = useAtomValue(volumeAtom);
  const setCurrentTrack = useSetAtom(currentTrackAtom);
  const setQueue = useSetAtom(queueAtom);
  const setDurationValue = useSetAtom(durationAtom);
  const setCurrentTimeValue = useSetAtom(currentTimeAtom);
  const setStreamUrlValue = useSetAtom(streamUrlAtom);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const currentTrackKey = currentTrack?.key;
  const currentTrackIdentifier = currentTrack?.identifier;
  const currentTrackPublisher = currentTrack?.publisher;

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

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audioRef.current = null;
    };
  }, [setCurrentTime, setDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrackIdentifier || !currentTrackPublisher) return;

    let cancelled = false;

    const load = async () => {
      setPlayerError(null);
      setStreamUrl(null);
      setCurrentTime(0);
      setDuration(0);
      setResourceStatusLabel('Preparing audio');
      setResourceProgress(null);

      try {
        const resolvedUrl = await resolveSongStreamUrl(
          currentTrackPublisher,
          currentTrackIdentifier,
          {
            waitUntilReady: true,
            onStatusChange: (status, progress) => {
              if (cancelled) return;
              setResourceStatusLabel(`QDN ${status}`);
              setResourceProgress(
                typeof progress === 'number'
                  ? Math.max(0, Math.min(100, progress))
                  : null
              );
            },
          }
        );

        if (cancelled) return;

        if (!resolvedUrl) {
          setPlayerError('Audio URL could not be resolved.');
          setIsPlaying(false);
          return;
        }

        audio.src = resolvedUrl;
        audio.load();
        setStreamUrl(resolvedUrl);
        setResourceStatusLabel('Ready');
        setResourceProgress(100);
      } catch (playbackError) {
        if (!cancelled) {
          setPlayerError(
            playbackError instanceof Error &&
              playbackError.message.trim().length > 0
              ? playbackError.message
              : 'Playback could not be started.'
          );
          setIsPlaying(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    currentTrackIdentifier,
    currentTrackKey,
    currentTrackPublisher,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setPlayerError,
    setStreamUrl,
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;

    if (isPlaying) {
      setPlayerError(null);
      void audio.play().catch((playbackError) => {
        setPlayerError(
          playbackError instanceof Error &&
            playbackError.message.trim().length > 0
            ? playbackError.message
            : 'Playback could not be resumed.'
        );
        setIsPlaying(false);
      });
      return;
    }

    audio.pause();
  }, [isPlaying, setIsPlaying, setPlayerError, streamUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= 0 && nextIndex < queue.length) {
        selectTrackAt(nextIndex);
        return;
      }
      setIsPlaying(false);
    };

    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentIndex, queue, selectTrackAt, setIsPlaying]);

  const clampFloatingPosition = useCallback((x: number, y: number) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const playerWidth = Math.min(360, viewportWidth - 24);
    const playerHeight = 166;

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

  const handleClosePlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    setIsPlaying(false);
    setCurrentTrack(null);
    setQueue([]);
    setCurrentTimeValue(0);
    setDurationValue(0);
    setStreamUrlValue(null);
    setPlayerError(null);
    setIsFloating(false);
    setResourceStatusLabel(null);
    setResourceProgress(null);
  }, [
    setCurrentTimeValue,
    setCurrentTrack,
    setDurationValue,
    setIsFloating,
    setIsPlaying,
    setPlayerError,
    setQueue,
    setStreamUrlValue,
  ]);

  if (!currentTrack) {
    return null;
  }

  const progressValue =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const artwork = currentTrack.artworkUrl || null;

  return (
    <Box
      onPointerMove={(event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const nextPosition = clampFloatingPosition(
          dragState.x + (event.clientX - dragState.startX),
          dragState.y + (event.clientY - dragState.startY)
        );
        setFloatingPosition(nextPosition);
      }}
      onPointerUp={(event) => {
        if (dragStateRef.current?.pointerId === event.pointerId) {
          dragStateRef.current = null;
        }
      }}
      sx={{
        position: 'fixed',
        left: isFloating ? floatingPosition.x : { xs: 12, md: 28 },
        top: isFloating ? floatingPosition.y : 'auto',
        right: isFloating ? 'auto' : { xs: 12, md: 28 },
        bottom: isFloating ? 'auto' : { xs: 12, md: 20 },
        width: isFloating ? { xs: 'calc(100vw - 24px)', sm: 360 } : 'auto',
        maxWidth: isFloating ? 'calc(100vw - 24px)' : 'none',
        zIndex: 1400,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        px: 2,
        py: 1.5,
        backdropFilter: 'blur(22px)',
        background: 'var(--qm-panel-bg)',
        boxShadow: 'var(--qm-shadow-strong)',
      }}
    >
      {playerError ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
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
          onPointerDown={(event) => {
            if (!isFloating) return;
            dragStateRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              x: floatingPosition.x,
              y: floatingPosition.y,
            };
          }}
          sx={{ cursor: isFloating ? 'grab' : 'default', touchAction: 'none' }}
        >
          {artwork ? (
            <Box
              component="img"
              src={artwork}
              alt={currentTrack.title}
              sx={{
                width: 52,
                height: 52,
                objectFit: 'cover',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
              }}
            />
          ) : null}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: 'primary.light', letterSpacing: '0.16em' }}
            >
              {isFloating ? 'FLOAT PLAYER' : 'MINI PLAYER'}
            </Typography>
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
            disabled={currentIndex <= 0}
            onClick={() => selectTrackAt(currentIndex - 1)}
          >
            <SkipPreviousRounded />
          </IconButton>
          <IconButton
            color="primary"
            onClick={() => setIsPlaying((value) => !value)}
          >
            {isPlaying ? <PauseRounded /> : <PlayArrowRounded />}
          </IconButton>
          <IconButton
            color="inherit"
            disabled={currentIndex < 0 || currentIndex >= queue.length - 1}
            onClick={() => selectTrackAt(currentIndex + 1)}
          >
            <SkipNextRounded />
          </IconButton>
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
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>
        </Stack>
      </Stack>
      {resourceStatusLabel && !streamUrl ? (
        <Stack spacing={0.5} sx={{ mt: 1.25 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {resourceStatusLabel}
            {typeof resourceProgress === 'number'
              ? ` (${resourceProgress}%)`
              : ''}
          </Typography>
          <LinearProgress
            variant={
              typeof resourceProgress === 'number'
                ? 'determinate'
                : 'indeterminate'
            }
            value={typeof resourceProgress === 'number' ? resourceProgress : 0}
            sx={{
              height: 6,
              borderRadius: 999,
              backgroundColor: 'var(--qm-surface-soft-strong)',
            }}
          />
        </Stack>
      ) : null}
      <LinearProgress
        variant="determinate"
        value={progressValue}
        sx={{
          mt: 1.5,
          height: 6,
          borderRadius: 999,
          backgroundColor: 'var(--qm-surface-soft-strong)',
        }}
      />
    </Box>
  );
};
