import { atom } from 'jotai';

export enum EnumTheme {
  LIGHT = 1,
  DARK = 2,
}

const STORAGE_KEY = 'qmusic20-theme';

const getInitialTheme = () => {
  if (typeof window === 'undefined') {
    return EnumTheme.DARK;
  }

  let storedTheme: string | null = null;
  try {
    storedTheme = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EnumTheme.DARK;
  }
  if (storedTheme === 'light') {
    return EnumTheme.LIGHT;
  }
  if (storedTheme === 'dark') {
    return EnumTheme.DARK;
  }

  return EnumTheme.DARK;
};

export const themeAtom = atom<EnumTheme>(getInitialTheme());

export const persistThemePreference = (theme: EnumTheme) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      theme === EnumTheme.LIGHT ? 'light' : 'dark'
    );
  } catch {
    /* Theme still works in memory when storage is unavailable. */
  }
};
