import { atom } from 'jotai';

export const skins = [
  {
    id: 'classic',
    label: 'Classic',
    description:
      'The familiar spacious layout, detailed cards and wide navigation.',
  },
  {
    id: 'modern',
    label: 'Modern',
    description:
      'Compact square cards, scrolling Home shelves and collapsible icon navigation.',
  },
] as const;
export type Skin = (typeof skins)[number]['id'];
const key = 'qmusic-skin';
export const readSkinPreference = (): Skin => {
  try {
    return localStorage.getItem(key) === 'modern' ? 'modern' : 'classic';
  } catch {
    return 'classic';
  }
};
const selected = atom<Skin>(readSkinPreference());
export const skinAtom = atom(
  (get) => get(selected),
  (_get, set, value: Skin) => {
    if (!skins.some((skin) => skin.id === value)) return;
    set(selected, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep usable in memory. */
    }
  }
);
