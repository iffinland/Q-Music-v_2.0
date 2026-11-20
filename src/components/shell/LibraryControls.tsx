import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useLibrary } from '../../hooks/useLibrary';
import {
  importLibraryItems,
  readLegacyLibrary,
} from '../../services/library/store';
export const LibraryControls = () => {
  const library = useLibrary();
  const [legacy] = useState(readLegacyLibrary);
  const [importOpen, setImportOpen] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [resendOpen, setResendOpen] = useState(false);
  const busy =
    library.syncState === 'loading' || library.syncState === 'saving';
  const message =
    library.syncState === 'loading'
      ? 'Checking your online library. You can keep listening and making local changes.'
      : library.syncState === 'saving'
        ? 'Saving your library. Approve the request in Qortal Hub.'
        : library.syncState === 'sent'
          ? 'Library save sent. Check sync after it has had time to appear on your node.'
          : library.syncState === 'uncertain'
            ? 'The last save may still complete. Check sync before sending again.'
            : library.pending
              ? 'Your changes are saved on this device. Save to QDN to back them up for this Qortal name.'
              : library.account.address && library.account.name
                ? library.syncState === 'local'
                  ? 'Your collection is saved on this device. The online library has not been checked yet.'
                  : 'Your local and online library are up to date.'
                : 'Your collection is saved on this device. Log in with a Qortal name to back it up to QDN.';
  const entries = [
    ...(legacy?.favoriteSongs.map((item) => ({
      key: `song:${item.id}`,
      item,
      kind: 'song',
    })) || []),
    ...(legacy?.favoritePlaylists.map((item) => ({
      key: `playlist:${item.id}`,
      item,
      kind: 'playlist',
    })) || []),
  ];
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2">
        {library.account.address
          ? `Library for ${library.account.name ? '@' + library.account.name : library.account.address}`
          : 'Guest library'}
      </Typography>
      <Alert
        severity={
          library.syncError || library.storageError ? 'warning' : 'info'
        }
      >
        {library.storageError || library.syncError || message}
      </Alert>
      {busy && <LinearProgress />}
      {library.account.address && library.account.name && (
        <>
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
            <Button
              variant="contained"
              disabled={
                busy ||
                !library.pending ||
                library.syncState === 'error' ||
                library.sentUnchanged ||
                library.uncertainSave ||
                Boolean(library.storageError)
              }
              onClick={() => void library.save()}
            >
              Save to QDN
            </Button>
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => void library.refresh()}
            >
              {library.syncState === 'error' ? 'Retry sync' : 'Check sync'}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            QDN backups are public and need your approval in Hub and a
            transaction fee. Listening and local saves do not publish anything.
          </Typography>
          {(library.syncState === 'sent' || library.uncertainSave) && (
            <Box component="details">
              <summary>Sync details</summary>
              <Typography variant="body2" sx={{ my: 1 }}>
                A previous save can still complete. Sending again may require
                another fee.
              </Typography>
              <Button
                color="warning"
                disabled={busy}
                onClick={() => setResendOpen(true)}
              >
                Send again…
              </Button>
            </Box>
          )}
        </>
      )}
      {!!entries.length && (
        <Alert
          severity="info"
          action={
            <Button disabled={busy} onClick={() => setImportOpen(true)}>
              Review
            </Button>
          }
        >
          An older, unassigned collection exists on this device. It has not been
          assigned to this account.
        </Alert>
      )}
      <Dialog
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 1, sm: 4 },
            minWidth: 0,
            overflowWrap: 'anywhere',
            width: { xs: 'calc(100% - 16px)', sm: '100%' },
          },
        }}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Import older saved favorites</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            The old app did not record who owned this collection. Select only
            favorites you want in{' '}
            {library.account.name ? '@' + library.account.name : 'this library'}
            . Nothing is published by importing. The original collection is
            kept.
          </Typography>
          <Button
            onClick={() =>
              setSelected(
                selected.length === entries.length
                  ? []
                  : entries.map((entry) => entry.key)
              )
            }
          >
            {selected.length === entries.length
              ? 'Clear selection'
              : 'Select all'}
          </Button>
          <Stack>
            {entries.map((entry) => (
              <FormControlLabel
                key={entry.key}
                control={
                  <Checkbox
                    checked={selected.includes(entry.key)}
                    onChange={(_, checked) =>
                      setSelected((previous) =>
                        checked
                          ? [...previous, entry.key]
                          : previous.filter((key) => key !== entry.key)
                      )
                    }
                  />
                }
                label={`${entry.kind === 'playlist' ? 'Playlist' : 'Song'}: ${entry.item.title} • ${entry.item.publisher}`}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancel</Button>
          <Button
            disabled={!selected.length}
            onClick={() => {
              importLibraryItems(library.account, {
                songs: legacy!.favoriteSongs.filter((item) =>
                  selected.includes(`song:${item.id}`)
                ),
                playlists: legacy!.favoritePlaylists.filter((item) =>
                  selected.includes(`playlist:${item.id}`)
                ),
              });
              setImportOpen(false);
              setSelected([]);
            }}
          >
            Import selected
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={resendOpen}
        onClose={() => setResendOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Send the library again?</DialogTitle>
        <DialogContent>
          <Typography>
            The previous save may still complete. This sends the current merged
            library under the same ID and can require another fee.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResendOpen(false)}>Cancel</Button>
          <Button
            color="warning"
            onClick={() => {
              setResendOpen(false);
              void library.save(true);
            }}
          >
            Send again
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
