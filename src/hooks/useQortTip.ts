import { requestError } from '../services/qdnRequests';
import { showError, showSuccess, useQortBalance, useGlobal } from '../qortal';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { resolveNameWalletAddress } from '../services/names';

type UseQortTipParams = {
  recipientName?: string;
  entityLabel: string;
};

export const useQortTip = ({
  recipientName,
  entityLabel,
}: UseQortTipParams) => {
  const { auth } = useGlobal();
  const scope = `${auth.address}:${recipientName || ''}`;
  const sendingScope = useRef<string | null>(null);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [resolvedScope, setResolvedScope] = useState('');
  const {
    value: qortBalance,
    getBalance,
    isLoading: isBalanceLoading,
  } = useQortBalance();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('0');
  const [recipientAddress, setRecipientAddress] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isResolvingRecipient, setIsResolvingRecipient] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const safeRecipient = resolvedScope === scope ? recipientAddress : null;
  useEffect(() => {
    currentScope.current = scope;
    setIsOpen(false);
    setAmount('0');
    setRecipientAddress(null);
    setResolvedScope('');
    setResolveError(null);
    setIsResolvingRecipient(false);
    setIsSending(false);
    return () => {
      if (currentScope.current === scope) currentScope.current = '';
    };
  }, [scope]);
  const resolveRecipient = useCallback(async () => {
    const expected = scope;
    if (currentScope.current !== expected) return null;
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
      if (currentScope.current !== expected) return null;
      if (!address) {
        setRecipientAddress(null);
        setResolveError('Publisher wallet address could not be resolved.');
        return null;
      }

      setRecipientAddress(address);
      setResolvedScope(expected);
      return address;
    } catch (error) {
      if (currentScope.current !== expected) return null;
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Publisher wallet address lookup failed.';
      setRecipientAddress(null);
      setResolveError(message);
      return null;
    } finally {
      if (currentScope.current === expected) setIsResolvingRecipient(false);
    }
  }, [recipientName, scope]);

  const openModal = useCallback(async () => {
    if (currentScope.current !== scope) return;
    setIsOpen(true);

    await Promise.allSettled([getBalance(), resolveRecipient()]);
  }, [getBalance, resolveRecipient, scope]);

  const closeModal = useCallback(() => {
    if (isSending) {
      return;
    }

    setIsOpen(false);
  }, [isSending]);

  const sendTip = useCallback(async () => {
    const expected = scope;
    if (currentScope.current !== expected || sendingScope.current === expected)
      return;
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

    sendingScope.current = expected;
    setIsSending(true);
    try {
      const resolvedAddress = await resolveRecipient();
      if (currentScope.current !== expected) return;
      if (!resolvedAddress) {
        showError('Publisher wallet address could not be resolved.');
        return;
      }
      const transfer = await qortalRequest({
        action: 'SEND_COIN',
        coin: 'QORT',
        recipient: resolvedAddress,
        amount: parsedAmount,
      });
      if (!transfer || (typeof transfer === 'object' && 'error' in transfer))
        throw new Error(
          requestError(
            transfer,
            'The tip did not return confirmation. Check your wallet before trying again.'
          )
        );
      if (currentScope.current !== expected) return;
      setIsOpen(false);
      setAmount('0');
      showSuccess(
        `Tip request sent to @${trimmedRecipient} for this ${entityLabel}.`
      );
      void getBalance().catch(() => undefined);
    } catch (error) {
      if (currentScope.current !== expected) return;
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Tip transfer failed.';
      showError(message);
    } finally {
      if (sendingScope.current === expected) sendingScope.current = null;
      if (currentScope.current === expected) setIsSending(false);
    }
  }, [
    amount,
    entityLabel,
    getBalance,
    qortBalance,
    scope,
    recipientName,
    resolveRecipient,
  ]);

  const formattedBalance = useMemo(
    () => (typeof qortBalance === 'number' ? qortBalance.toFixed(8) : '—'),
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
    recipientAddress: safeRecipient,
    recipientName: recipientName?.trim() || '',
    resolveError,
    sendTip,
    setAmount,
  };
};
