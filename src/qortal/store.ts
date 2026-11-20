import { requestError } from '../services/qdnRequests';
export interface Account {
  address: string | null;
  name: string | null;
  publicKey: string | null;
  isLoadingUser: boolean;
  errorMessageLoadingUser: string | null;
}
let account: Account = {
  address: null,
  name: null,
  publicKey: null,
  isLoadingUser: false,
  errorMessageLoadingUser: null,
};
const accountListeners = new Set<() => void>();
export const accountSnapshot = () => account;
export const subscribeAccount = (listener: () => void) => {
  accountListeners.add(listener);
  return () => {
    accountListeners.delete(listener);
  };
};
const update = (patch: Partial<Account>) => {
  account = { ...account, ...patch };
  accountListeners.forEach((listener) => listener());
};
export const request = async (
  payload: Record<string, unknown>,
  timeout = 20_000
): Promise<unknown> => {
  if (typeof qortalRequest !== 'function')
    throw new Error('Open Q-Music in Qortal Hub to use account features.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const native =
      typeof qortalRequestWithTimeout === 'function'
        ? qortalRequestWithTimeout(payload as never, timeout)
        : qortalRequest(payload as never);
    const result = await Promise.race([
      native,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'The Qortal client did not respond in time. Please retry.'
              )
            ),
          timeout
        );
      }),
    ]);
    if (result && typeof result === 'object' && 'error' in result)
      throw new Error(requestError(result));
    return result;
  } finally {
    clearTimeout(timer);
  }
};
let authentication: Promise<void> | undefined;
let lastCheck = 0;
export const refreshAccount = (): Promise<void> => {
  if (authentication) return authentication;
  lastCheck = Date.now();
  update({ isLoadingUser: true, errorMessageLoadingUser: null });
  const task = Promise.resolve().then(async () => {
    try {
      const result = await request({ action: 'GET_USER_ACCOUNT' });
      if (
        !result ||
        typeof result !== 'object' ||
        !('address' in result) ||
        typeof result.address !== 'string' ||
        !result.address.trim()
      ) {
        update({ address: null, name: null, publicKey: null });
        return;
      }
      const address = result.address.trim();
      // Do not leave the previous account visible while a new name lookup waits.
      if (account.address !== address)
        update({ address, name: null, publicKey: null });
      let name: string | null = null;
      try {
        const value = await request({ action: 'GET_PRIMARY_NAME', address });
        if (typeof value === 'string' && value.trim()) name = value.trim();
        else if (value !== null && value !== '')
          throw new Error('The client returned an invalid Qortal name.');
      } catch (error) {
        update({
          errorMessageLoadingUser: requestError(
            error,
            'Your Qortal name could not be loaded. Refresh the account to retry.'
          ),
        });
      }
      update({
        address,
        name,
        publicKey:
          'publicKey' in result && typeof result.publicKey === 'string'
            ? result.publicKey
            : null,
      });
    } catch (error) {
      update({
        address: null,
        name: null,
        publicKey: null,
        errorMessageLoadingUser: requestError(error),
      });
    } finally {
      update({ isLoadingUser: false });
      if (authentication === task) authentication = undefined;
    }
  });
  authentication = task;
  return task;
};
export const refreshAccountOnReturn = () => {
  if (
    document.visibilityState === 'visible' &&
    account.address &&
    Date.now() - lastCheck >= 60_000
  )
    void refreshAccount();
};
interface BalanceState {
  value: number | null;
  isLoading: boolean;
}
const balances = new Map<string, BalanceState>(),
  balanceRequests = new Map<string, Promise<number>>(),
  balanceListeners = new Set<() => void>();
const emptyBalance: BalanceState = { value: null, isLoading: false };
export const balanceSnapshot = () =>
  account.address
    ? balances.get(account.address) || emptyBalance
    : emptyBalance;
export const subscribeBalance = (listener: () => void) => {
  balanceListeners.add(listener);
  return () => {
    balanceListeners.delete(listener);
  };
};
const updateBalance = (address: string, state: BalanceState) => {
  balances.set(address, state);
  balanceListeners.forEach((listener) => listener());
};
export const getBalance = (): Promise<number> => {
  const address = account.address;
  if (!address)
    return Promise.reject(
      new Error('Log in before checking the wallet balance.')
    );
  const existing = balanceRequests.get(address);
  if (existing) return existing;
  const previous = balances.get(address)?.value ?? null;
  updateBalance(address, { value: previous, isLoading: true });
  const task = Promise.resolve().then(async () => {
    try {
      const result = await request({ action: 'GET_BALANCE', address });
      if (
        (typeof result !== 'number' && typeof result !== 'string') ||
        String(result).trim() === '' ||
        !Number.isFinite(Number(result)) ||
        Number(result) < 0
      )
        throw new Error('The wallet balance could not be read.');
      const value = Number(result);
      updateBalance(address, { value, isLoading: false });
      return value;
    } catch (error) {
      updateBalance(address, { value: previous, isLoading: false });
      throw error;
    } finally {
      if (balanceRequests.get(address) === task)
        balanceRequests.delete(address);
    }
  });
  balanceRequests.set(address, task);
  return task;
};
export interface Notice {
  id: number;
  severity: 'error' | 'success';
  message: string;
}
let notice: Notice | null = null,
  nextNotice = 0;
const noticeListeners = new Set<() => void>();
export const noticeSnapshot = () => notice;
export const subscribeNotice = (listener: () => void) => {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
};
export const dismissNotice = () => {
  notice = null;
  noticeListeners.forEach((listener) => listener());
};
const notify = (severity: Notice['severity'], message: string) => {
  notice = { id: ++nextNotice, severity, message };
  noticeListeners.forEach((listener) => listener());
};
export const showError = (message: string) => notify('error', message);
export const showSuccess = (message: string) => notify('success', message);
