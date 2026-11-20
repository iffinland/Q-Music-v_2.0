import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
export const SocialFeedback = ({
  error,
  notice,
  busy,
  onRefresh,
  uncertain,
  onRetry,
  label = 'activity',
}: {
  error?: string | null;
  notice?: string;
  busy?: boolean;
  onRefresh?: () => void;
  uncertain?: boolean;
  onRetry?: () => void;
  label?: string;
}) => {
  const [confirm, setConfirm] = useState(false);
  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      {error && <Alert severity="warning">{error}</Alert>}
      {notice && (
        <Typography variant="body2" color="text.secondary">
          {notice}
        </Typography>
      )}
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        {onRefresh && (
          <Button size="small" disabled={busy} onClick={onRefresh}>
            Refresh {label}
          </Button>
        )}
        {uncertain && onRetry && (
          <Button
            size="small"
            color="warning"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            Retry saved action…
          </Button>
        )}
      </Stack>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Retry the saved action?</DialogTitle>
        <DialogContent>
          <Typography>
            The previous transaction may still complete. Refresh first if
            possible. Retrying uses the saved resource ID and can require
            another fee.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button
            color="warning"
            onClick={() => {
              setConfirm(false);
              onRetry?.();
            }}
          >
            Retry saved action
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
