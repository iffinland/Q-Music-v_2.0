import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import type { MirrorCatalogProps } from './CatalogMirrorButton';
import {
  MAX_MIRROR_PUBLISHERS,
  mirrorPublisherNames,
  readMirrorFollowing,
  updateMirrorFollowing,
} from '../../services/catalogMirror';
import { MediaPagination } from '../common/MediaCollection';
import { requestError } from '../../services/qdnRequests';

export const CatalogMirrorDialog = ({
  name,
  kind,
  publishers,
  incomplete,
  onClose,
}: MirrorCatalogProps & { onClose: () => void }) => {
  // Freeze the reviewed set. Background collection changes must not add names
  // to a user's selection while a native permission is being approved.
  const [candidates] = useState(() => mirrorPublisherNames(publishers));
  const [following, setFollowing] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [manageAll, setManageAll] = useState(false);
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  const load = async () => {
    setLoading(true);
    setNotice(null);
    setError(null);
    setReady(false);
    setSelected([]);
    setChecked(false);
    try {
      const names = await readMirrorFollowing();
      if (mounted.current) {
        setFollowing(names);
        setReady(true);
      }
    } catch (failure) {
      if (mounted.current)
        setError(
          requestError(
            failure,
            'Follow status could not be checked. No changes made.'
          )
        );
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, []);
  const change = async (action: 'follow' | 'unfollow') => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const names = await updateMirrorFollowing(
        action,
        action === 'unfollow'
          ? selected.map(
              (name) =>
                following.find(
                  (saved) => saved.toLowerCase() === name.toLowerCase()
                ) || name
            )
          : selected
      );
      if (!mounted.current) return;
      setFollowing(names);
      setSelected([]);
      setChecked(false);
      setNotice(
        action === 'follow'
          ? 'Publisher follow saved and checked on the selected node. Downloads are managed by your node; completion has not been verified.'
          : 'Q-Music follow removed and checked. Existing files were not deleted. Other follow lists or node settings may still keep this publisher mirrored.'
      );
    } catch (failure) {
      if (mounted.current) {
        setReady(false);
        setChecked(false);
        setError(
          `${requestError(failure, 'The change could not be verified.')} The saved state may have changed. Refresh status before any further action.`
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const choices = manageAll ? following : candidates;
  const pageCount = Math.max(1, Math.ceil(choices.length / 20));
  const currentPage = Math.min(page, pageCount);
  const followingKeys = new Set(following.map((value) => value.toLowerCase()));
  const allFollowed =
    selected.length > 0 &&
    selected.every((value) => followingKeys.has(value.toLowerCase()));
  const allNew =
    selected.length > 0 &&
    selected.every((value) => !followingKeys.has(value.toLowerCase()));
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={busy ? undefined : onClose}
      disableEscapeKeyDown={busy}
      aria-labelledby="mirror-title"
    >
      <DialogTitle id="mirror-title">Mirror via publisher follow</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ overflowWrap: 'anywhere' }}>
          <Typography sx={{ fontWeight: 700 }}>
            {kind === 'publisher' ? `@${name}` : name}
          </Typography>
          <Typography>
            This adds selected Qortal publishers to a persistent follow list on
            the node currently selected in Hub. Keep that node selected while
            reviewing and approving.
          </Typography>
          <Alert severity="info">
            Following covers all QDN content from each publisher, including
            non-music files and future publications. It is not limited to this
            artist or the songs shown here. Total storage size is unknown.
          </Alert>
          <Typography variant="body2">
            Your own node must allow followed content in its storage policy
            (FOLLOWED, FOLLOWED_OR_VIEWED or ALL). Space limits, blocked content
            and availability still apply. Q-Music cannot read or change that
            policy or guarantee permanent storage. Your node manages downloads
            after Q-Music closes.
          </Typography>
          {kind === 'artist' ? (
            <Typography variant="body2">
              These publishers come from the artist songs currently found.
              Artist names are metadata, not verified identities.{' '}
              {incomplete
                ? 'The artist search is incomplete. Close this dialog and use Search more songs to find additional publishers.'
                : 'This list reflects the indexed artist matches found on your node.'}
            </Typography>
          ) : null}
          {loading ? (
            <Typography role="status">
              Checking selected node and Q-Music follow list… Hub may ask for
              permission.
            </Typography>
          ) : null}
          {error ? <Alert severity="warning">{error}</Alert> : null}
          {notice ? <Alert severity="info">{notice}</Alert> : null}
          <Typography variant="subtitle2">
            Choose up to {MAX_MIRROR_PUBLISHERS} publishers. Use separate
            selections for following and stopping.
          </Typography>
          <Button
            disabled={!ready || busy || loading}
            onClick={() => {
              setManageAll((value) => !value);
              setPage(1);
              setSelected([]);
              setChecked(false);
            }}
          >
            {manageAll
              ? 'Back to this catalogue'
              : 'Manage all Q-Music follows'}
          </Button>
          {manageAll ? (
            <Typography variant="subtitle2">
              All Q-Music follows on the selected node
            </Typography>
          ) : null}
          <Typography variant="caption">
            Selected {selected.length} of {MAX_MIRROR_PUBLISHERS}
          </Typography>
          {!choices.length ? (
            <Typography>
              {manageAll
                ? 'No Q-Music follows saved on this node.'
                : 'No publisher names found yet. Continue the artist search first.'}
            </Typography>
          ) : null}
          <Stack spacing={0.5}>
            {choices
              .slice((currentPage - 1) * 20, currentPage * 20)
              .map((publisher) => {
                const active = followingKeys.has(publisher.toLowerCase());
                const chosen = selected.includes(publisher);
                return (
                  <FormControlLabel
                    key={publisher.toLowerCase()}
                    control={
                      <Checkbox
                        checked={chosen}
                        disabled={
                          !ready ||
                          busy ||
                          loading ||
                          (!chosen && selected.length >= MAX_MIRROR_PUBLISHERS)
                        }
                        onChange={(_, value) => {
                          setChecked(false);
                          setSelected((previous) =>
                            value
                              ? [...previous, publisher]
                              : previous.filter((item) => item !== publisher)
                          );
                        }}
                      />
                    }
                    label={`@${publisher} — ${ready ? (active ? 'Follow saved by Q-Music' : 'No Q-Music follow') : 'Status unknown'}`}
                  />
                );
              })}
          </Stack>
          {pageCount > 1 ? (
            <MediaPagination
              page={currentPage}
              pages={pageCount}
              more={false}
              busy={busy || loading}
              label="Publisher choices pages"
              onChange={setPage}
            />
          ) : null}
          <FormControlLabel
            control={
              <Checkbox
                checked={checked}
                disabled={!ready || busy || loading || !selected.length}
                onChange={(_, value) => setChecked(value)}
              />
            }
            label="I manage the node selected in Hub and understand that following includes all content from these publishers."
          />
          <Typography variant="caption" color="text.secondary">
            Stopping removes only Q-Music’s follow rule. It does not delete
            downloaded files or change follow rules made elsewhere. No QORT
            payment or publication is involved.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={() => void load()} disabled={loading || busy}>
          Refresh status
        </Button>
        <Button
          onClick={() => void change('unfollow')}
          disabled={!ready || !checked || !allFollowed || busy || loading}
        >
          Stop Q-Music follow
        </Button>
        <Button
          variant="contained"
          onClick={() => void change('follow')}
          disabled={!ready || !checked || !allNew || busy || loading}
        >
          {busy ? 'Waiting for Hub…' : 'Follow on my node'}
        </Button>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
