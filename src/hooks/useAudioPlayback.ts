import { useEffect, useRef, useState } from 'react';
import { AudioPlaybackSession } from '../services/audioPlaybackSession';
import { prepareAudioRecovery } from '../services/audioRecovery';
import { resolveSongStreamUrl } from '../services/songs';
import type { MiniPlayerTrack } from '../state/player';

interface PlaybackOptions {
  track: MiniPlayerTrack | null;
  isPlaying: boolean;
  volume: number;
  attempt: number;
  onPlaying: (value: boolean) => void;
  onTime: (value: number) => void;
  onDuration: (value: number) => void;
  onUrl: (value: string | null) => void;
  onError: (value: string | null) => void;
  onEnded: () => void;
}

export const useAudioPlayback = (options: PlaybackOptions) => {
  const latest = useRef(options);
  latest.current = options;
  const session = useRef<AudioPlaybackSession | null>(null);
  const [status, setStatus] = useState('');
  const [buffering, setBuffering] = useState(false);
  const publisher = options.track?.publisher;
  const identifier = options.track?.identifier;
  const key = options.track?.key;
  const attempt = options.attempt;

  useEffect(() => {
    if (!publisher || !identifier) return;
    const audio = new AudioPlaybackSession(
      () => new Audio(),
      (signal) => resolveSongStreamUrl(publisher, identifier, { signal }),
      (options) => prepareAudioRecovery(publisher, identifier, options),
      (update) => {
        const current = latest.current;
        if (update.label !== undefined) setStatus(update.label);
        if (update.buffering !== undefined) setBuffering(update.buffering);
        if (update.time !== undefined) current.onTime(update.time);
        if (update.duration !== undefined) current.onDuration(update.duration);
        if (update.url !== undefined) current.onUrl(update.url);
        if (update.error !== undefined) current.onError(update.error);
        if (update.playing !== undefined) current.onPlaying(update.playing);
        if (update.ended) current.onEnded();
      }
    );
    session.current = audio;
    audio.setVolume(latest.current.volume);
    audio.setPlaying(latest.current.isPlaying);
    void audio.start();
    return () => {
      session.current = null;
      audio.dispose();
    };
  }, [publisher, identifier, key, attempt]);

  useEffect(() => {
    session.current?.setPlaying(options.isPlaying);
  }, [options.isPlaying]);
  useEffect(() => {
    session.current?.setVolume(options.volume);
  }, [options.volume]);

  return {
    status,
    buffering,
    seek: (seconds: number) => session.current?.seek(seconds) ?? false,
    setPlaying: (value: boolean) => {
      // Invoke play inside the click handler when an already loaded song needs
      // browser user activation; React's effect remains a state synchronizer.
      session.current?.setPlaying(value);
      options.onPlaying(value);
    },
    stop: () => session.current?.dispose(),
  };
};
