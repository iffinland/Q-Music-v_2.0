import { showError, showSuccess, useQortBalance } from 'qapp-core';
import { useCallback, useMemo, useState } from 'react';
import { resolveNameWalletAddress } from '../services/names';

type UseQortTipParams = {
  recipientName?: string;
  entityLabel: string;
};

export const useQortTip = ({
  recipientName,
  entityLabel,
}: UseQortTipParams) => {
  const { value: qortBalance, getBalance, isLoading: isBalanceLoading } =
    useQortBalance();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('0');
  const [recipientAddress, setRecipientAddress] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isResolvingRecipient, setIsResolvingRecipient] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const resolveRecipient = useCallback(async () => {
    const trimmedRecipient = recipientName?.trim();
    if (!trimmedRecipient) {
      setRecipientAddress(null);
      setResolveError('Publisher name is missing for this item.');
      return null;
    }

    setIsResolvingRecipient(true);
    setResolveError(null);

    try {
      const address = await resolveNameWalletAddress(trimmedRecipient);
      if (!address) {
        setRecipientAddress(null);
        setResolveError('Publisher wallet address could not be resolved.');
        return null;
      }

      setRecipientAddress(address);
      return address;
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Publisher wallet address lookup failed.';
      setRecipientAddress(null);
      setResolveError(message);
      return null;
    } finally {
      setIsResolvingRecipient(false);
    }
  }, [recipientName]);

  const openModal = useCallback(async () => {
    setIsOpen(true);

    if (qortBalance === null) {
      try {
        await getBalance();
      } catch {
        // Keep the modal usable even if balance refresh fails.
      }
    }

    if (!recipientAddress && !isResolvingRecipient) {
      await resolveRecipient();
    }
  }, [
    getBalance,
    isResolvingRecipient,
    qortBalance,
    recipientAddress,
    resolveRecipient,
  ]);

  const closeModal = useCallback(() => {
    if (isSending) {
      return;
    }

    setIsOpen(false);
  }, [isSending]);

  const sendTip = useCallback(async () => {
    const parsedAmount = Number(amount);
    const trimmedRecipient = recipientName?.trim();

    if (typeof qortalRequest !== 'function') {
      showError('Qortal request bridge is not available.');
      return;
    }

    if (!trimmedRecipient) {
      showError('Publisher name is missing for this item.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showError('Enter a QORT amount greater than 0.');
      return;
    }

    if (typeof qortBalance === 'number' && parsedAmount > qortBalance) {
      showError('Entered amount is higher than your wallet balance.');
      return;
    }

    const resolvedAddress = recipientAddress ?? (await resolveRecipient());
    if (!resolvedAddress) {
      showError('Publisher wallet address could not be resolved.');
      return;
    }

    try {
      setIsSending(true);
      await qortalRequest({
        action: 'SEND_COIN',
        coin: 'QORT',
        recipient: resolvedAddress,
        amount: parsedAmount,
      });
      setIsOpen(false);
      setAmount('0');
      showSuccess(
        `Thanks for tipping @${trimmedRecipient} on this ${entityLabel}. 💚`
      );
      void getBalance().catch(() => undefined);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Tip transfer failed.';
      showError(message);
    } finally {
      setIsSending(false);
    }
  }, [
    amount,
    entityLabel,
    getBalance,
    qortBalance,
    recipientAddress,
    recipientName,
    resolveRecipient,
  ]);

  const formattedBalance = useMemo(
    () =>
      typeof qortBalance === 'number' ? qortBalance.toFixed(8) : '0.00000000',
    [qortBalance]
  );

  return {
    amount,
    closeModal,
    formattedBalance,
    isBalanceLoading,
    isOpen,
    isResolvingRecipient,
    isSending,
    openModal,
    recipientAddress,
    recipientName: recipientName?.trim() || '',
    resolveError,
    sendTip,
    setAmount,
  };
};
