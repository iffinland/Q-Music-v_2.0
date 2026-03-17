import {
  DarkModeRounded,
  LightModeRounded,
  MenuRounded,
  QueueMusicRounded,
} from '@mui/icons-material';
import {
  AppBar,
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Button,
  Chip,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { keyframes } from '@mui/system';
import { showError, showSuccess, useGlobal, useQortBalance } from 'qapp-core';
import { useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
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
const chatGroupId = 827;
const chatJoinUri = `qortal://use-group/action-join/groupid-${chatGroupId}`;
const podcastsAppUri = 'qortal://APP/Q-Podcasts';
const supportRecipient = 'QTowvz1e89MP4FEFpHvEfZ4x8G3LwMpthz';
const supportFlow = keyframes`
  0% {
    background-position: 0% 50%;
    box-shadow: 0 10px 28px rgba(26, 193, 165, 0.18);
  }
  50% {
    background-position: 100% 50%;
    box-shadow: 0 12px 32px rgba(58, 151, 255, 0.24);
  }
  100% {
    background-position: 0% 50%;
    box-shadow: 0 10px 28px rgba(26, 193, 165, 0.18);
  }
`;

interface AppShellProps {
  children: ReactNode;
}

const NavigationContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { value: qortBalance, getBalance, isLoading: isBalanceLoading } =
    useQortBalance();
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportAmount, setSupportAmount] = useState('0');
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const handleJoinChat = (event: MouseEvent<HTMLAnchorElement>) => {
    if (typeof qortalRequest !== 'function') {
      return;
    }

    event.preventDefault();
    void qortalRequest({
      action: 'JOIN_GROUP',
      groupId: chatGroupId,
    });
  };
  const handleOpenPodcasts = (event: MouseEvent<HTMLAnchorElement>) => {
    if (typeof qortalRequest !== 'function') {
      return;
    }

    event.preventDefault();
    void qortalRequest({
      action: 'OPEN_NEW_TAB',
      qortalLink: podcastsAppUri,
    });
  };
  const handleOpenSupport = async () => {
    setSupportOpen(true);

    if (qortBalance === null) {
      try {
        await getBalance();
      } catch {
        // The dialog can still open even if balance refresh fails.
      }
    }
  };
  const handleCloseSupport = () => {
    if (isSendingSupport) {
      return;
    }

    setSupportOpen(false);
  };
  const handleSupportAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSupportAmount(event.target.value);
  };
  const handleSendSupport = async () => {
    const amount = Number(supportAmount);

    if (typeof qortalRequest !== 'function') {
      showError('Qortal request bridge is not available.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showError('Enter a QORT amount greater than 0.');
      return;
    }

    if (typeof qortBalance === 'number' && amount > qortBalance) {
      showError('Entered amount is higher than your wallet balance.');
      return;
    }

    try {
      setIsSendingSupport(true);
      await qortalRequest({
        action: 'SEND_COIN',
        coin: 'QORT',
        recipient: supportRecipient,
        amount,
      });
      setSupportOpen(false);
      setSupportAmount('0');
      showSuccess('Thank you for supporting Q-Music. Transfer sent successfully. 💚');
      void getBalance().catch(() => undefined);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Support transfer failed.';
      showError(message);
    } finally {
      setIsSendingSupport(false);
    }
  };

  const formattedBalance =
    typeof qortBalance === 'number' ? qortBalance.toFixed(8) : '0.00000000';

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
              component="a"
              href={chatJoinUri}
              onClick={handleJoinChat}
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
              component="a"
              href={podcastsAppUri}
              onClick={handleOpenPodcasts}
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
            <Button
              variant="contained"
              fullWidth
              onClick={handleOpenSupport}
              sx={{
                justifyContent: 'flex-start',
                borderRadius: 2,
                color: '#f5fffd',
                background:
                  'linear-gradient(120deg, #0d7286 0%, #18b8a2 38%, #3a97ff 72%, #27d3a8 100%)',
                backgroundSize: '220% 220%',
                animation: `${supportFlow} 10s ease-in-out infinite`,
                '&:hover': {
                  background:
                    'linear-gradient(120deg, #0f7f93 0%, #1ac1a5 38%, #45a0ff 72%, #30dbb0 100%)',
                },
              }}
            >
              Support Project
            </Button>
          </Stack>
        </Box>
      </Box>
      <Dialog
        open={supportOpen}
        onClose={handleCloseSupport}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Support Project</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ pt: 1 }}>
            <Box
              sx={{
                borderRadius: 2,
                px: 1.5,
                py: 1.25,
                backgroundColor: 'var(--qm-surface-soft)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Wallet balance
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.35, fontWeight: 700 }}>
                {isBalanceLoading ? 'Loading...' : `${formattedBalance} QORT`}
              </Typography>
            </Box>
            <TextField
              label="Amount"
              type="number"
              value={supportAmount}
              onChange={handleSupportAmountChange}
              inputProps={{ min: 0, step: '0.00000001' }}
              fullWidth
            />
            <Button
              variant="contained"
              fullWidth
              disabled={isSendingSupport}
              onClick={handleSendSupport}
            >
              {isSendingSupport ? 'Sending...' : 'SEND QORT'}
            </Button>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Recipient: {supportRecipient}
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>
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
