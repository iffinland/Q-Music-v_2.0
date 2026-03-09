import React, { FC } from 'react';
import { ThemeProvider } from '@emotion/react';
import { lightTheme, darkTheme } from './theme';
import { CssBaseline } from '@mui/material';
import {
  EnumTheme,
  persistThemePreference,
  themeAtom,
} from '../../state/global/system';
import { useAtom } from 'jotai';
import { useEffect } from 'react';

interface ThemeProviderWrapperProps {
  children: React.ReactNode;
}

const ThemeProviderWrapper: FC<ThemeProviderWrapperProps> = ({ children }) => {
  const [theme] = useAtom(themeAtom);
  const isLightTheme = theme === EnumTheme.LIGHT;

  useEffect(() => {
    const themeName = isLightTheme ? 'light' : 'dark';

    document.documentElement.dataset.theme = themeName;
    document.body.dataset.theme = themeName;
    document.documentElement.style.colorScheme = themeName;

    persistThemePreference(theme);
  }, [isLightTheme, theme]);

  return (
    <ThemeProvider theme={isLightTheme ? lightTheme : darkTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

export default ThemeProviderWrapper;
