import React, { StrictMode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/qortal/AuthProvider';
import { useQortBalance } from '../src/qortal/hooks';
import {
  accountSnapshot,
  refreshAccount,
  refreshAccountOnReturn,
  getBalance,
  balanceSnapshot,
  request,
  dismissNotice,
} from '../src/qortal/store';
const native = vi.fn();
let address: string | null,
  name: string | null,
  balance: unknown,
  counter = 0;
beforeEach(async () => {
  vi.stubGlobal('qortalRequest', native);
  vi.stubGlobal('qortalRequestWithTimeout', native);
  address = null;
  name = null;
  balance = '12.5';
  native.mockImplementation(async (p) =>
    p.action === 'GET_USER_ACCOUNT'
      ? address
        ? { address, publicKey: 'key' }
        : null
      : p.action === 'GET_PRIMARY_NAME'
        ? name || ''
        : balance
  );
  await refreshAccount();
  dismissNotice();
  native.mockClear();
  address = `Wallet-${++counter}`;
  name = 'Alice';
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('small native account adapter', () => {
  it('deduplicates StrictMode auth and never fetches balance just because consumers mount', async () => {
    const Balance = () => {
      const data = useQortBalance();
      return <div>{data.value ?? 'unknown'}</div>;
    };
    render(
      <StrictMode>
        <AuthProvider>
          <Balance />
          <Balance />
        </AuthProvider>
      </StrictMode>
    );
    await waitFor(() => expect(accountSnapshot().name).toBe('Alice'));
    expect(native.mock.calls.map(([p]) => p.action)).toEqual([
      'GET_USER_ACCOUNT',
      'GET_PRIMARY_NAME',
    ]);
  });
  it('coalesces concurrent authentication calls', async () => {
    const one = refreshAccount(),
      two = refreshAccount();
    expect(one).toBe(two);
    await one;
    expect(accountSnapshot()).toMatchObject({
      address,
      name: 'Alice',
      isLoadingUser: false,
    });
  });
  it('clears a previously signed-in account on a real guest response or auth failure', async () => {
    await refreshAccount();
    address = null;
    await refreshAccount();
    expect(accountSnapshot().address).toBeNull();
    expect(accountSnapshot().name).toBeNull();
    native.mockRejectedValueOnce(new Error('User declined'));
    await refreshAccount();
    expect(accountSnapshot().name).toBeNull();
    expect(accountSnapshot().errorMessageLoadingUser).toContain('declined');
  });
  it('does not keep another wallet’s name while the new primary name is loading', async () => {
    await refreshAccount();
    let resolve!: (value: unknown) => void;
    address = 'New wallet';
    native
      .mockImplementationOnce(async () => ({ address }))
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
    const pending = refreshAccount();
    await waitFor(() => expect(accountSnapshot().address).toBe('New wallet'));
    await waitFor(() => expect(resolve).toBeTypeOf('function'));
    expect(accountSnapshot().name).toBeNull();
    resolve('Bob');
    await pending;
    expect(accountSnapshot().name).toBe('Bob');
  });
  it('allows an account without a registered name without inventing one', async () => {
    name = '';
    await refreshAccount();
    expect(accountSnapshot().address).toBe(address);
    expect(accountSnapshot().name).toBeNull();
    expect(accountSnapshot().errorMessageLoadingUser).toBeNull();
  });
  it('settles an unresponsive native client with a visible retryable error', async () => {
    vi.useFakeTimers();
    native.mockImplementation(() => new Promise(() => {}));
    const pending = refreshAccount();
    await vi.advanceTimersByTimeAsync(20001);
    await pending;
    expect(accountSnapshot().isLoadingUser).toBe(false);
    expect(accountSnapshot().errorMessageLoadingUser).toContain(
      'did not respond'
    );
    expect(accountSnapshot().address).toBeNull();
  });
  it('does not turn an unknown/failed balance into zero and fetches only on demand', async () => {
    await refreshAccount();
    expect(balanceSnapshot().value).toBeNull();
    const one = getBalance(),
      two = getBalance();
    expect(one).toBe(two);
    expect(await one).toBe(12.5);
    native.mockResolvedValueOnce({ error: 'Balance unavailable' });
    await expect(getBalance()).rejects.toThrow('unavailable');
    expect(balanceSnapshot().value).toBe(12.5);
    expect(balanceSnapshot().isLoading).toBe(false);
  });
  it('never displays a late balance from another wallet', async () => {
    await refreshAccount();
    let resolve!: (value: unknown) => void;
    native.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const old = getBalance();
    await Promise.resolve();
    address = 'Balance B';
    await refreshAccount();
    resolve(99);
    await old;
    expect(accountSnapshot().address).toBe('Balance B');
    expect(balanceSnapshot().value).toBeNull();
  });
  it.each([NaN, '', 'invalid', {}, -1])(
    'rejects an invalid balance instead of allowing a false zero (%s)',
    async (value) => {
      await refreshAccount();
      balance = value;
      await expect(getBalance()).rejects.toThrow('could not be read');
      expect(balanceSnapshot().value).toBeNull();
    }
  );
  it('returns immediately in an ordinary browser without probing or opening a login', async () => {
    vi.stubGlobal('qortalRequest', undefined);
    await refreshAccount();
    expect(accountSnapshot().address).toBeNull();
    expect(accountSnapshot().errorMessageLoadingUser).toContain('Qortal Hub');
    expect(native).not.toHaveBeenCalled();
  });
  it('does not poll signed-out sessions or repeatedly reauthenticate on focus', async () => {
    address = null;
    await refreshAccount();
    native.mockClear();
    refreshAccountOnReturn();
    expect(native).not.toHaveBeenCalled();
    address = 'Focus account';
    await refreshAccount();
    native.mockClear();
    refreshAccountOnReturn();
    expect(native).not.toHaveBeenCalled();
  });
  it('keeps native error objects as failures', async () => {
    native.mockResolvedValueOnce({ error: 'Node unavailable' });
    await expect(request({ action: 'GET_USER_ACCOUNT' })).rejects.toThrow(
      'Node unavailable'
    );
  });
});
