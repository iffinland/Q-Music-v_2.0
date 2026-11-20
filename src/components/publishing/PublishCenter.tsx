import { isTrustedHubMessage } from '../../utils/hubMessages';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useGlobal } from '../../qortal';
import {
  activatePublishAccount,
  archivePublishJob,
  checkPublishJob,
  closePublishCenter,
  continuePublishJob,
  getPublishSnapshot,
  recordPublishProgress,
  stopPublishVerification,
  subscribePublish,
  summarizeJob,
  authorizePublishResend,
} from '../../services/publishing/engine';
import { requestError } from '../../services/qdnRequests';
import type { PublishItemState } from '../../services/publishing/types';
const labels: Record<PublishItemState, string> = {
  prepared: 'Not sent yet',
  sending: 'Sending / awaiting Hub',
  submitted: 'Transaction sent',
  verified: 'Available on this node',
  failed: 'Not sent — retry available',
  uncertain: 'Previous send needs checking',
};
export const PublishCenter = () => {
  const { auth } = useGlobal();
  const state = useSyncExternalStore(subscribePublish, getPublishSnapshot);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{
    id: string;
    kind: 'archive' | 'resend';
  } | null>(null);
  const publisher = auth?.name?.trim() || '';
  useEffect(() => {
    setConfirmation(null);
    setError('');
    void activatePublishAccount(publisher);
  }, [publisher]);
  useEffect(() => {
    const progress = (event: MessageEvent) => {
      if (!isTrustedHubMessage(event)) return;
      if (event.data?.action === 'PUBLISH_STATUS')
        recordPublishProgress(event.data);
    };
    window.addEventListener('message', progress);
    return () => window.removeEventListener('message', progress);
  }, []);
  const jobs = state.jobs.filter(
    (job) =>
      !job.archived && job.publisher.toLowerCase() === publisher.toLowerCase()
  );
  const busy = Boolean(
    state.activeJobId || state.activity || state.waitingJobIds.length
  );
  const act = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(requestError(failure));
    }
  };
  const allSent =
    jobs.length > 0 && jobs.every((job) => summarizeJob(job).complete);
  return (
    <>
      <Dialog
        open={state.open && Boolean(publisher)}
        fullWidth
        maxWidth="sm"
        sx={{
          zIndex: 1600,
          '& .MuiDialog-paper': {
            m: { xs: 1, sm: 4 },
            width: { xs: 'calc(100% - 16px)', sm: '100%' },
            maxHeight: 'calc(100dvh - 24px)',
            minWidth: 0,
          },
        }}
        onClose={closePublishCenter}
      >
        <DialogTitle>
          {busy
            ? 'Publishing'
            : allSent
              ? 'Publication sent'
              : 'Your publications'}
        </DialogTitle>
        <DialogContent sx={{ overflowWrap: 'anywhere', minWidth: 0 }}>
          <Stack spacing={2.5}>
            {(error || state.error) && (
              <Alert
                severity="warning"
                action={
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void act(() => activatePublishAccount(publisher))
                    }
                  >
                    Retry
                  </Button>
                }
              >
                {error || state.error}
              </Alert>
            )}
            {busy && (
              <>
                <Typography role="status">
                  {state.activity || 'Waiting for Qortal Hub…'}
                </Typography>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary">
                  Approve the requests in Qortal Hub. You can minimize this
                  window and keep browsing.
                </Typography>
              </>
            )}
            {!jobs.length && !busy && (
              <Typography>No publications to continue.</Typography>
            )}
            {jobs.map((job) => {
              const result = summarizeJob(job);
              const uncertain = job.items.some(
                (item) => item.state === 'uncertain'
              );
              const audio = job.items.filter(
                (item) => item.service === 'AUDIO'
              );
              const sentAudio = audio.filter(
                (item) =>
                  item.state === 'submitted' || item.state === 'verified'
              ).length;
              return (
                <Stack
                  key={job.id}
                  spacing={1.5}
                  sx={{
                    minWidth: 0,
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="h6">{job.title}</Typography>
                  {state.activeJobId === job.id && audio.length > 1 && (
                    <Typography>
                      {sentAudio} of {audio.length} audio files sent
                    </Typography>
                  )}
                  {!busy && (
                    <Typography variant="body2">
                      {result.complete
                        ? result.verified
                          ? 'Available on this node.'
                          : 'Publication sent. It may take a little time to appear across the network.'
                        : uncertain
                          ? 'This publication was interrupted. Check its status before continuing so a previous send is not repeated.'
                          : 'This publication is saved. You can continue from where it stopped.'}
                    </Typography>
                  )}
                  {!busy && !result.complete && (
                    <Button
                      variant="contained"
                      onClick={() => void act(() => continuePublishJob(job.id))}
                    >
                      {uncertain
                        ? 'Check and continue'
                        : 'Continue publication'}
                    </Button>
                  )}
                  <Box
                    component="details"
                    sx={{
                      minWidth: 0,
                      '& summary': {
                        cursor: 'pointer',
                        py: 1,
                        fontWeight: 700,
                      },
                    }}
                  >
                    <summary>Details</summary>
                    <Stack spacing={1.25}>
                      {job.items.map((item) => (
                        <Box
                          key={`${item.service}:${item.identifier}`}
                          sx={{ minWidth: 0 }}
                        >
                          <Typography variant="body2">
                            {item.service === 'AUDIO'
                              ? 'Audio'
                              : item.service === 'THUMBNAIL'
                                ? 'Cover'
                                : item.service === 'PLAYLIST'
                                  ? 'Playlist'
                                  : 'Song details'}
                            : {item.filename || item.title || item.identifier}
                          </Typography>
                          <Typography variant="caption">
                            {labels[item.state]}
                            {item.state === 'sending' && item.totalChunks
                              ? ` • uploaded ${Math.min(100, Math.floor(((item.chunks || 0) / item.totalChunks) * 100))}%`
                              : ''}
                          </Typography>
                          {item.error && (
                            <Typography color="warning.main" variant="body2">
                              {item.error}
                            </Typography>
                          )}
                        </Box>
                      ))}
                      <Typography variant="caption" color="text.secondary">
                        Availability checks read the files from your node and
                        may use mobile data.
                      </Typography>
                      <Button
                        disabled={
                          busy ||
                          job.items.every(
                            (item) =>
                              item.state === 'prepared' ||
                              item.state === 'verified'
                          )
                        }
                        onClick={() => void act(() => checkPublishJob(job.id))}
                      >
                        Check availability
                      </Button>
                      {job.items.some(
                        (item) =>
                          (item.state === 'uncertain' ||
                            item.state === 'submitted') &&
                          (item.file || item.data64)
                      ) && (
                        <Button
                          color="warning"
                          disabled={busy}
                          onClick={() =>
                            setConfirmation({ id: job.id, kind: 'resend' })
                          }
                        >
                          Send again…
                        </Button>
                      )}
                      <Button
                        disabled={busy}
                        onClick={() =>
                          setConfirmation({ id: job.id, kind: 'archive' })
                        }
                      >
                        {result.complete
                          ? 'Hide from history'
                          : 'Set aside publication…'}
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexWrap: 'wrap' }}>
          {busy && state.activity.startsWith('Verifying') && (
            <Button onClick={stopPublishVerification}>Stop checking</Button>
          )}
          <Button variant="contained" onClick={closePublishCenter}>
            {busy ? 'Minimize' : 'Done'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: 1700 }}
      >
        <DialogTitle>
          {confirmation?.kind === 'resend'
            ? 'Send this publication again?'
            : 'Set this publication aside?'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmation?.kind === 'resend'
              ? 'A previous transaction may still complete. Sending again uses the same resource IDs but can require another fee. Check availability first if you are unsure.'
              : 'This hides the saved publication and allows a new one. Already sent transactions can still complete; published content is not deleted.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmation(null)}>Cancel</Button>
          <Button
            color="warning"
            onClick={() => {
              const choice = confirmation;
              setConfirmation(null);
              if (choice)
                void act(() =>
                  choice.kind === 'resend'
                    ? authorizePublishResend(choice.id)
                    : archivePublishJob(choice.id)
                );
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
