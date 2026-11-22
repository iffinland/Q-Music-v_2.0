import { AppearanceDialog } from './AppearanceDialog';
import { skinAtom } from '../../state/appearance';
import { refreshAccount } from '../../qortal';
import { appVersion } from '../../qapp-config';
import {
  DarkModeRounded,
  PaletteRounded,
  HelpOutlineRounded,
  SearchRounded,
  ShuffleRounded,
  LightModeRounded,
  MenuRounded,
  QueueMusicRounded,
  HomeRounded,
  LibraryMusicRounded,
  HeadphonesRounded,
  AudioFileRounded,
  CloudUploadRounded,
  ChatRounded,
  PodcastsRounded,
  MenuBookRounded,
  FavoriteRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
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
  ListItemIcon,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  showError,
  showSuccess,
  useGlobal,
  useQortBalance,
} from '../../qortal';
import {
  useState,
  lazy,
  Suspense,
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAtom, useAtomValue } from 'jotai';
import { useIframe } from '../../hooks/useIframeListener';
import { useLibrary } from '../../hooks/useLibrary';
import { queueLengthAtom } from '../../state/player';
import { EnumTheme, themeAtom } from '../../state/global/system';
import { LibrarySync } from './LibrarySync';
import { FloatingMiniPlayer } from '../player/FloatingMiniPlayer';

const HelpDialog = lazy(() =>
  import('./HelpDialog').then((module) => ({ default: module.HelpDialog }))
);

const navigationItems = [
  { label: 'Home', to: '/', icon: HomeRounded },
  { label: 'Search', to: '/search', icon: SearchRounded },
  { label: 'Discover Mix', to: '/discover', icon: ShuffleRounded },
  { label: 'Browse All', to: '/songs', icon: HeadphonesRounded },
  { label: 'Playlists', to: '/playlists/all', icon: QueueMusicRounded },
  { label: 'Library', to: '/library', icon: LibraryMusicRounded },
  { label: 'My Music', to: '/my-music', icon: AudioFileRounded },
  { label: 'Publish Audio', to: '/publish', icon: CloudUploadRounded },
];

const drawerWidth = 280;
const chatGroupId = 827;
const chatJoinUri = `qortal://use-group/action-join/groupid-${chatGroupId}`;
const podcastsAppUri = 'qortal://APP/Q-Podcasts';
const supportRecipient = 'QTowvz1e89MP4FEFpHvEfZ4x8G3LwMpthz';

interface AppShellProps {
  children: ReactNode;
}

const NavigationContent = ({
  onNavigate,
  collapsed = false,
  onOpenAppearance,
  onOpenHelp,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onOpenAppearance?: () => void;
  onOpenHelp?: () => void;
}) => {
  const location = useLocation();
  const {
    value: qortBalance,
    getBalance,
    isLoading: isBalanceLoading,
  } = useQortBalance();
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

    try {
      await getBalance();
    } catch {
      /* Keep support usable if the read fails. */
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
      showSuccess(
        'Thank you for supporting Q-Music. Transfer sent successfully. 💚'
      );
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
    typeof qortBalance === 'number' ? qortBalance.toFixed(8) : '—';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--qm-panel-bg)',
      }}
    >
      <List
        aria-label="Main navigation"
        sx={{ px: collapsed ? 1 : 1.5, pt: 1.5, pb: 2, flexGrow: 1 }}
      >
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
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
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
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 36,
                  color: 'inherit',
                  mx: collapsed ? 'auto' : 0,
                }}
              >
                <item.icon />
              </ListItemIcon>
              {!collapsed ? (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }}
                />
              ) : null}
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ p: collapsed ? 0.75 : 2 }}>
        <Box
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            p: collapsed ? 0.25 : 1.5,
            backgroundColor: 'var(--qm-surface-soft)',
          }}
        >
          <Stack spacing={1}>
            <Button
              variant="contained"
              fullWidth
              component="a"
              aria-label="Join Our Chat"
              title="Join Our Chat"
              href={chatJoinUri}
              onClick={handleJoinChat}
              sx={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                minWidth: 0,
                px: collapsed ? 0.5 : 2,
                borderRadius: 2,
              }}
            >
              {collapsed ? <ChatRounded /> : 'Join Our Chat'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              component="a"
              aria-label="Podcast"
              title="Podcast"
              href={podcastsAppUri}
              onClick={handleOpenPodcasts}
              sx={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                minWidth: 0,
                px: collapsed ? 0.5 : 2,
                borderRadius: 2,
              }}
            >
              {collapsed ? <PodcastsRounded /> : 'Podcast'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              disabled
              aria-label="Audiobooks"
              title="Audiobooks"
              sx={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                minWidth: 0,
                px: collapsed ? 0.5 : 2,
                borderRadius: 2,
              }}
            >
              {collapsed ? <MenuBookRounded /> : 'Audiobooks'}
            </Button>
            <Button
              variant="contained"
              fullWidth
              aria-label="Support Project"
              title="Support Project"
              onClick={handleOpenSupport}
              sx={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                minWidth: 0,
                px: collapsed ? 0.5 : 2,
                borderRadius: 2,
                color: '#f5fffd',
                background:
                  'linear-gradient(120deg, #0d7286 0%, #18b8a2 38%, #3a97ff 72%, #27d3a8 100%)',
                backgroundSize: '220% 220%',
                '&:hover': {
                  background:
                    'linear-gradient(120deg, #0f7f93 0%, #1ac1a5 38%, #45a0ff 72%, #30dbb0 100%)',
                },
              }}
            >
              {collapsed ? <FavoriteRounded /> : 'Support Project'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              aria-label="Appearance"
              title="Appearance"
              onClick={onOpenAppearance}
              sx={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                minWidth: 0,
                px: collapsed ? 0.5 : 2,
                borderRadius: 2,
              }}
            >
              {collapsed ? <PaletteRounded /> : 'Appearance'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              aria-label="Help"
              title="Help"
              onClick={onOpenHelp}
              sx={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                minWidth: 0,
                px: collapsed ? 0.5 : 2,
                borderRadius: 2,
              }}
            >
              {collapsed ? <HelpOutlineRounded /> : 'Help'}
            </Button>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                px: 0.5,
                fontSize: collapsed ? '0.6rem' : undefined,
                overflowWrap: 'anywhere',
              }}
            >
              v{appVersion}
            </Typography>
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
  const { syncState: librarySyncState, pending: libraryPending } = useLibrary();
  const [theme, setTheme] = useAtom(themeAtom);
  const skin = useAtomValue(skinAtom);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = () => {
    setMobileOpen(false);
    setHelpOpen(true);
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedPreference, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('qmusic-nav-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const collapsed = skin === 'modern' && collapsedPreference;
  const openAppearance = () => {
    setMobileOpen(false);
    setAppearanceOpen(true);
  };
  const toggleNavigation = () => {
    setCollapsed((previous) => {
      try {
        localStorage.setItem('qmusic-nav-collapsed', String(!previous));
      } catch {
        /* Keep usable in memory. */
      }
      return !previous;
    });
  };
  const desktopWidth = collapsed ? 80 : drawerWidth;
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
        <Toolbar
          sx={{ gap: { xs: 1, sm: 1.5 }, px: { xs: 1.5, sm: 3 }, minWidth: 0 }}
        >
          <IconButton
            color="inherit"
            aria-label="Open navigation"
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
                width: { xs: 70, sm: 'auto' },
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="div"
                sx={{
                  fontSize: '1.35rem',
                  display: { xs: 'none', sm: 'block' },
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
                <Box
                  component="span"
                  sx={{ display: { xs: 'none', md: 'inline' } }}
                >
                  {' '}
                  Enjoy &amp; Share music with the Qortal community
                </Box>
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={<QueueMusicRounded />}
              label={`Queue ${queueLength}`}
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
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
                        : librarySyncState === 'sent'
                          ? 'Library sent'
                          : librarySyncState === 'uncertain'
                            ? 'Library needs checking'
                            : libraryPending
                              ? 'Library saved locally'
                              : 'Library ready'
                }
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                color={librarySyncState === 'error' ? 'warning' : 'default'}
                variant="outlined"
              />
            ) : null}
            <Chip
              label={
                auth?.isLoadingUser
                  ? 'Checking account…'
                  : auth?.name
                    ? `@${auth.name}`
                    : auth?.address
                      ? 'Wallet connected'
                      : 'Guest mode'
              }
              onClick={() => void refreshAccount()}
              title="Refresh Qortal account"
              sx={{
                maxWidth: { xs: 100, sm: 180 },
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
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
        <NavigationContent
          onNavigate={() => setMobileOpen(false)}
          onOpenAppearance={openAppearance}
          onOpenHelp={openHelp}
        />
      </Drawer>

      <Box sx={{ display: 'flex' }}>
        <Box
          component="aside"
          sx={{
            width: { md: desktopWidth },
            flexShrink: 0,
            display: { xs: 'none', md: 'block' },
            borderRight: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              position: 'sticky',
              top: 65,
              height: 'calc(100dvh - 65px)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {skin === 'modern' ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: collapsed ? 'center' : 'flex-end',
                  px: 1,
                  pt: 1,
                }}
              >
                <IconButton
                  aria-label={
                    collapsed ? 'Expand navigation' : 'Collapse navigation'
                  }
                  aria-expanded={!collapsed}
                  onClick={toggleNavigation}
                >
                  {collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}
                </IconButton>
              </Box>
            ) : null}
            <NavigationContent
              collapsed={collapsed}
              onOpenAppearance={openAppearance}
              onOpenHelp={openHelp}
            />
          </Box>
        </Box>

        <Container
          component="main"
          maxWidth={false}
          sx={{
            flexGrow: 1,
            minWidth: 0,
            overflowWrap: 'anywhere',
            px: { xs: 1.5, sm: 2, md: 3 },
            py: { xs: 3, md: 4 },
            pb: 40,
          }}
        >
          {auth.errorMessageLoadingUser ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="warning.main">
                {auth.errorMessageLoadingUser}
              </Typography>
              <Button size="small" onClick={() => void refreshAccount()}>
                Refresh account
              </Button>
            </Box>
          ) : null}
          {children}
        </Container>
      </Box>

      <AppearanceDialog
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
      />
      {helpOpen ? (
        <Suspense fallback={null}>
          <HelpDialog onClose={() => setHelpOpen(false)} />
        </Suspense>
      ) : null}
      <LibrarySync />
      <FloatingMiniPlayer />
    </Box>
  );
};
