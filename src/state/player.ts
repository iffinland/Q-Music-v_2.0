import { atom } from 'jotai';

export interface MiniPlayerTrack {
  key: string;
  id: string;
  identifier: string;
  publisher: string;
  service: 'AUDIO';
  title: string;
  artist: string;
  context?: string;
  duration?: string;
  artworkUrl?: string | null;
}

export const queueAtom = atom<MiniPlayerTrack[]>([]);
export const currentTrackAtom = atom<MiniPlayerTrack | null>(null);
export const isPlayingAtom = atom(false);
export const currentTimeAtom = atom(0);
export const durationAtom = atom(0);
export const volumeAtom = atom(0.9);
export const streamUrlAtom = atom<string | null>(null);
export const playerErrorAtom = atom<string | null>(null);
export const isFloatingPlayerAtom = atom(false);
export const floatingPlayerPositionAtom = atom({ x: 20, y: 20 });

export const queueLengthAtom = atom((get) => get(queueAtom).length);
