import { Box, Button, Dialog, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import type { ChangeEvent } from 'react';

type QortTipModalProps = {
  amount: string;
  formattedBalance: string;
  isBalanceLoading: boolean;
  isOpen: boolean;
  isResolvingRecipient: boolean;
  isSending: boolean;
  onAmountChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onSend: () => void;
  recipientAddress: string | null;
  recipientName: string;
  resolveError: string | null;
};

export const QortTipModal = ({
  amount,
  formattedBalance,
  isBalanceLoading,
  isOpen,
  isResolvingRecipient,
  isSending,
  onAmountChange,
  onClose,
  onSend,
  recipientAddress,
  recipientName,
  resolveError,
}: QortTipModalProps) => (
  <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>Send tip</DialogTitle>
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
        <Box
          sx={{
            borderRadius: 2,
            px: 1.5,
            py: 1.25,
            backgroundColor: 'var(--qm-surface-soft)',
            border: '1px solid',
            borderColor: resolveError ? 'error.main' : 'divider',
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Recipient
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.35, fontWeight: 700 }}>
            {recipientName ? `@${recipientName}` : 'Unknown publisher'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            {isResolvingRecipient
              ? 'Resolving wallet address...'
              : resolveError
                ? resolveError
                : recipientAddress
                  ? recipientAddress
                  : 'Wallet address unavailable'}
          </Typography>
        </Box>
        <TextField
          label="Amount"
          type="number"
          value={amount}
          onChange={onAmountChange}
          inputProps={{ min: 0, step: '0.00000001' }}
          fullWidth
        />
        <Button
          variant="contained"
          fullWidth
          disabled={isSending || isResolvingRecipient || Boolean(resolveError)}
          onClick={onSend}
        >
          {isSending ? 'Sending...' : 'SEND QORT'}
        </Button>
      </Stack>
    </DialogContent>
  </Dialog>
);
