import { useAtom, useSetAtom } from 'jotai';
import {
  currentTrackAtom,
  isPlayingAtom,
  queueAtom,
  playbackAttemptAtom,
  type MiniPlayerTrack,
} from '../state/player';

export const useMiniPlayer = () => {
  const [queue, setQueue] = useAtom(queueAtom);
  const [currentTrack, setCurrentTrack] = useAtom(currentTrackAtom);
  const retry = useSetAtom(playbackAttemptAtom);
  const setIsPlaying = useSetAtom(isPlayingAtom);

  const playTrack = (track: MiniPlayerTrack, nextQueue?: MiniPlayerTrack[]) => {
    if (nextQueue) {
      setQueue(nextQueue);
    } else if (!queue.some((item) => item.key === track.key)) {
      setQueue([...queue, track]);
    }

    if (currentTrack?.key === track.key) retry((value) => value + 1);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const playQueue = (tracks: MiniPlayerTrack[], startIndex = 0) => {
    if (tracks.length === 0) return;
    setQueue(tracks);
    const selected = tracks[startIndex] ?? tracks[0];
    if (currentTrack?.key === selected.key) retry((value) => value + 1);
    setCurrentTrack(selected);
    setIsPlaying(true);
  };

  return {
    currentTrack,
    playQueue,
    playTrack,
  };
};
