import { alpha, createTheme } from '@mui/material/styles';

const commonThemeOptions = {
  typography: {
    fontFamily: ['Inter'].join(','),
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0.5px',
    },

    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: '0.2px',
    },
  },
  spacing: 8,
  shape: {
    borderRadius: 4,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          transition:
            'background-color 180ms ease, color 180ms ease, border-color 180ms ease',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
};

const lightTheme = createTheme({
  ...commonThemeOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      dark: '#1d4ed8',
      light: '#60a5fa',
      contrastText: '#eff6ff',
    },
    secondary: {
      main: '#0ea5e9',
      dark: '#0284c7',
      light: '#7dd3fc',
    },
    background: {
      default: '#eaf2ff',
      paper: '#ffffff',
    },
    text: {
      primary: '#102033',
      secondary: '#49627f',
    },
    divider: 'rgba(37, 99, 235, 0.18)',
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    ...commonThemeOptions.components,
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.74),
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 16,
          textTransform: 'none',
          fontWeight: 700,
          transition:
            'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        containedPrimary: {
          boxShadow: `0 14px 28px ${alpha('#2563eb', 0.22)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: `0 18px 40px ${alpha('#7ba6de', 0.18)}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.72),
          borderRadius: 16,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#2563eb', 0.4),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          overflow: 'hidden',
        },
      },
    },
  },
});

const darkTheme = createTheme({
  ...commonThemeOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#38bdf8',
      dark: '#0ea5e9',
      light: '#93c5fd',
      contrastText: '#03111f',
    },
    secondary: {
      main: '#2563eb',
      dark: '#1d4ed8',
      light: '#60a5fa',
    },
    background: {
      default: '#07111d',
      paper: '#0f1c30',
    },
    text: {
      primary: '#e6f1ff',
      secondary: '#93accb',
    },
    divider: 'rgba(96, 165, 250, 0.18)',
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    ...commonThemeOptions.components,
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#07111d', 0.78),
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 16,
          textTransform: 'none',
          fontWeight: 700,
          transition:
            'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        containedPrimary: {
          boxShadow: `0 16px 32px ${alpha('#0ea5e9', 0.22)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: `0 18px 40px ${alpha('#020617', 0.45)}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.04),
          borderRadius: 16,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#7dd3fc', 0.42),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          overflow: 'hidden',
        },
      },
    },
  },
});

export { lightTheme, darkTheme };
