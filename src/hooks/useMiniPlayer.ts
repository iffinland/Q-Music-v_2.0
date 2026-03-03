import { useAtom, useSetAtom } from 'jotai';
import {
  currentTrackAtom,
  isPlayingAtom,
  queueAtom,
  type MiniPlayerTrack,
} from '../state/player';

export const useMiniPlayer = () => {
  const [queue, setQueue] = useAtom(queueAtom);
  const [currentTrack, setCurrentTrack] = useAtom(currentTrackAtom);
  const setIsPlaying = useSetAtom(isPlayingAtom);

  const playTrack = (track: MiniPlayerTrack, nextQueue?: MiniPlayerTrack[]) => {
    if (nextQueue) {
      setQueue(nextQueue);
    } else if (!queue.some((item) => item.key === track.key)) {
      setQueue([...queue, track]);
    }

    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const playQueue = (tracks: MiniPlayerTrack[], startIndex = 0) => {
    if (tracks.length === 0) return;
    setQueue(tracks);
    setCurrentTrack(tracks[startIndex] ?? tracks[0]);
    setIsPlaying(true);
  };

  return {
    currentTrack,
    playQueue,
    playTrack,
  };
};
