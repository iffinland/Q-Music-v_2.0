import { COVER_FORMATS_HELP } from '../../utils/publishLimits';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { processCoverImage } from '../../services/publishing/covers';
import { requestError } from '../../services/qdnRequests';

export const CoverPicker = ({
  value,
  onChange,
  onBusy,
  disabled = false,
  label = 'Cover (optional)',
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  onBusy: (busy: boolean) => void;
  disabled?: boolean;
  label?: string;
}) => {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  // Keep the same decode/encode result for the preview and publication.
  useEffect(() => {
    let cancelled = false;
    setError('');
    setPreview('');
    if (!value) {
      setProcessing(false);
      onBusy(false);
      return;
    }
    setProcessing(true);
    onBusy(true);
    void processCoverImage(value)
      .then((data) => {
        if (!cancelled) {
          setPreview(`data:image/jpeg;base64,${data}`);
          onBusy(false);
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          setError(requestError(failure));
          onBusy(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProcessing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value, onBusy]);
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography variant="caption" color="text.secondary">
        {COVER_FORMATS_HELP}
      </Typography>
      {preview && (
        <Box
          component="img"
          src={preview}
          alt="Cover preview"
          sx={{ width: 128, height: 128, objectFit: 'cover', borderRadius: 2 }}
        />
      )}
      {processing && <Typography role="status">Preparing cover…</Typography>}
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button component="label" variant="outlined" disabled={disabled}>
          {value ? 'Change cover' : 'Choose cover'}
          <input
            hidden
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp"
            onChange={(event) => {
              onChange(event.target.files?.[0] || null);
              event.target.value = '';
            }}
          />
        </Button>
        {value && (
          <Button disabled={disabled} onClick={() => onChange(null)}>
            Remove cover
          </Button>
        )}
      </Stack>
      {!value && (
        <Typography variant="caption" color="text.secondary">
          You can publish without a cover.
        </Typography>
      )}
    </Stack>
  );
};
