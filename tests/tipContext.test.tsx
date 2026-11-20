import React, { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQortTip } from '../src/hooks/useQortTip';
const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  balance: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  native: vi.fn(),
}));
vi.mock('../src/qortal', () => ({
  useGlobal: () => ({ auth: { address: 'Sender' } }),
  useQortBalance: () => ({
    value: 10,
    isLoading: false,
    getBalance: mocks.balance,
  }),
  showSuccess: mocks.success,
  showError: mocks.error,
}));
vi.mock('../src/services/names', () => ({
  resolveNameWalletAddress: mocks.resolve,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.balance.mockResolvedValue(10);
  mocks.resolve.mockImplementation(async (name) => 'Wallet-' + name);
  mocks.native.mockResolvedValue({ signature: 'test-only' });
  vi.stubGlobal('qortalRequest', mocks.native);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('recipient scope during route changes', () => {
  it('clears a previous publisher’s address immediately and opens the new dialog with a fresh name/balance read', async () => {
    const { result, rerender } = renderHook(useQortTip, {
      initialProps: { recipientName: 'Alice', entityLabel: 'song' },
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    await act(async () => {
      await result.current.openModal();
    });
    expect(result.current.recipientAddress).toBe('Wallet-Alice');
    rerender({ recipientName: 'Bob', entityLabel: 'song' });
    expect(result.current.recipientAddress).toBeNull();
    expect(result.current.isOpen).toBe(false);
    await act(async () => {
      await result.current.openModal();
    });
    expect(result.current.recipientAddress).toBe('Wallet-Bob');
    expect(mocks.balance).toHaveBeenCalledTimes(2);
  });
  it('ignores a late address lookup for an old page', async () => {
    let resolve!: (value: string) => void;
    mocks.resolve.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const { result, rerender } = renderHook(useQortTip, {
      initialProps: { recipientName: 'Alice', entityLabel: 'song' },
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.openModal();
    });
    rerender({ recipientName: 'Bob', entityLabel: 'song' });
    await act(async () => {
      resolve('Wallet-Alice');
      await pending;
    });
    expect(result.current.recipientAddress).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });
  it('does not submit a transfer when its recipient page changes while resolving', async () => {
    const { result, rerender } = renderHook(useQortTip, {
      initialProps: { recipientName: 'Alice', entityLabel: 'song' },
    });
    act(() => result.current.setAmount('1'));
    let resolve!: (value: string) => void;
    mocks.resolve.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.sendTip();
    });
    rerender({ recipientName: 'Bob', entityLabel: 'song' });
    await act(async () => {
      resolve('Wallet-Alice');
      await pending;
    });
    expect(mocks.native).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('blocks double submits before rerender, and never calls a native error object successful', async () => {
    const { result } = renderHook(() =>
      useQortTip({ recipientName: 'Alice', entityLabel: 'song' })
    );
    act(() => result.current.setAmount('1'));
    mocks.native.mockResolvedValue({ error: 'Rejected' });
    await act(async () => {
      await Promise.all([result.current.sendTip(), result.current.sendTip()]);
    });
    expect(mocks.native).toHaveBeenCalledOnce();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });
});
