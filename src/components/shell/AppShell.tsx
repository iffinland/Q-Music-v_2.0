import {
  DarkModeRounded,
  LightModeRounded,
  MenuRounded,
  QueueMusicRounded,
} from '@mui/icons-material';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { useGlobal } from 'qapp-core';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAtom } from 'jotai';
import { useIframe } from '../../hooks/useIframeListener';
import { librarySyncStateAtom } from '../../state/library';
import { queueLengthAtom } from '../../state/player';
import { EnumTheme, themeAtom } from '../../state/global/system';
import { LibrarySync } from './LibrarySync';
import { FloatingMiniPlayer } from '../player/FloatingMiniPlayer';

const navigationItems = [
  { label: 'Home', to: '/' },
  { label: 'Browse All', to: '/songs' },
  { label: 'Playlists', to: '/playlists/all' },
  { label: 'Library', to: '/library' },
  { label: 'My Music', to: '/my-music' },
  { label: 'Publish Audio', to: '/publish' },
];

const drawerWidth = 280;

interface AppShellProps {
  children: ReactNode;
}

const NavigationContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--qm-panel-bg)',
      }}
    >
      <List sx={{ px: 1.5, pt: 2.5, pb: 2, flexGrow: 1 }}>
        {navigationItems.map((item) => {
          const selected =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname === item.to ||
                location.pathname.startsWith(`${item.to}/`);

          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              selected={selected}
              onClick={onNavigate}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: 'var(--qm-primary-soft)',
                },
              }}
            >
              <ListItemText
                primary={item.label}
                secondary={selected ? 'Current view' : undefined}
                primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }}
              />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ p: 2.5 }}>
        <Box
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            p: 2,
            backgroundColor: 'var(--qm-surface-soft)',
          }}
        >
          <Stack spacing={1}>
            <Button
              variant="contained"
              fullWidth
              sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
            >
              Join Our Chat
            </Button>
            <Button
              variant="outlined"
              fullWidth
              sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
            >
              App version 2.0
            </Button>
            <Button
              variant="outlined"
              fullWidth
              disabled
              sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
            >
              Podcast
            </Button>
            <Button
              variant="outlined"
              fullWidth
              disabled
              sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
            >
              Audiobooks
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export const AppShell = ({ children }: AppShellProps) => {
  useIframe();
  const { auth } = useGlobal();
  const queueLength = useAtom(queueLengthAtom)[0];
  const librarySyncState = useAtom(librarySyncStateAtom)[0];
  const [theme, setTheme] = useAtom(themeAtom);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLightTheme = theme === EnumTheme.LIGHT;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'var(--qm-shell-bg)',
      }}
    >
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton
            color="inherit"
            edge="start"
            sx={{ display: { md: 'none' } }}
            onClick={() => setMobileOpen(true)}
          >
            <MenuRounded />
          </IconButton>
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              minWidth: 0,
            }}
          >
            <Box
              component="img"
              src="./qmusic.png"
              alt="Q-Music logo"
              sx={{
                height: 34,
                width: 'auto',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="div"
                sx={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: '0.01em',
                }}
              >
                Q-MUSIC
              </Typography>
              <Typography
                component="div"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.68rem',
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Enjoy &amp; Share music with the Qortal community
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={<QueueMusicRounded />}
              label={`Queue ${queueLength}`}
              variant="outlined"
            />
            {auth?.name ? (
              <Chip
                label={
                  librarySyncState === 'saving'
                    ? 'Library syncing'
                    : librarySyncState === 'loading'
                      ? 'Library loading'
                      : librarySyncState === 'error'
                        ? 'Library offline'
                        : 'Library ready'
                }
                color={librarySyncState === 'error' ? 'warning' : 'default'}
                variant="outlined"
              />
            ) : null}
            <Chip
              label={auth?.name ? `@${auth.name}` : 'Guest mode'}
              color="primary"
              variant="outlined"
            />
            <IconButton
              color="inherit"
              onClick={() =>
                setTheme(isLightTheme ? EnumTheme.DARK : EnumTheme.LIGHT)
              }
              aria-label={
                isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'
              }
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'var(--qm-surface-soft)',
              }}
            >
              {isLightTheme ? <DarkModeRounded /> : <LightModeRounded />}
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { md: 'block' },
          '& .MuiDrawer-paper': { width: drawerWidth },
        }}
      >
        <NavigationContent onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <Box sx={{ display: 'flex' }}>
        <Box
          component="aside"
          sx={{
            width: { md: drawerWidth },
            flexShrink: 0,
            display: { xs: 'none', md: 'block' },
            borderRight: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{ position: 'sticky', top: 65, height: 'calc(100vh - 65px)' }}
          >
            <NavigationContent />
          </Box>
        </Box>

        <Container
          component="main"
          maxWidth={false}
          sx={{
            flexGrow: 1,
            px: { xs: 2, md: 4 },
            py: { xs: 3, md: 4 },
            pb: 18,
          }}
        >
          {children}
        </Container>
      </Box>

      <LibrarySync />
      <FloatingMiniPlayer />
    </Box>
  );
};
