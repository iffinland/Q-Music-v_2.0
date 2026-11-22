import { getDefaultStore } from 'jotai';
import { skinAtom } from '../src/state/appearance';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../src/components/shell/AppShell';
vi.mock('../src/qortal', () => ({
  refreshAccount: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  useGlobal: () => ({ auth: {} }),
  useQortBalance: () => ({ getBalance: vi.fn(), isLoading: false }),
}));
vi.mock('../src/hooks/useIframeListener', () => ({ useIframe: () => {} }));
vi.mock('../src/hooks/useLibrary', () => ({
  useLibrary: () => ({ syncState: 'idle', pending: false }),
}));
vi.mock('../src/components/shell/LibrarySync', () => ({
  LibrarySync: () => null,
}));
vi.mock('../src/components/player/FloatingMiniPlayer', () => ({
  FloatingMiniPlayer: () => null,
}));
beforeEach(() => {
  getDefaultStore().set(skinAtom, 'modern');
  localStorage.removeItem('qmusic-nav-collapsed');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const setup = () =>
  render(
    <MemoryRouter>
      <AppShell>Browse content</AppShell>
    </MemoryRouter>
  );
describe('icon navigation preference', () => {
  it('opens local Help from the menu without native calls and leaves the view usable on close', async () => {
    const native = vi.fn();
    vi.stubGlobal('qortalRequest', native);
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Help', exact: true }));
    await screen.findByRole(
      'dialog',
      { name: 'Q-Music Help' },
      { timeout: 4000 }
    );
    expect(
      screen.getByText(/Shuffle chooses from the current queue/)
    ).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'Publishing files and covers' })
    );
    expect(screen.getByText(/Audio files: MP3/)).toBeTruthy();
    expect(native).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Close help' }));
    expect(screen.getByText('Browse content')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('keeps named icon links when collapsed, remembers the choice, and expands again', async () => {
    const user = userEvent.setup();
    const view = setup();
    await user.click(
      screen.getByRole('button', { name: 'Collapse navigation' })
    );
    expect(screen.queryByText('Browse All')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Browse All' }).getAttribute('title')
    ).toBe('Browse All');
    expect(
      screen.getByRole('button', { name: 'Support Project' })
    ).toBeTruthy();
    expect(localStorage.getItem('qmusic-nav-collapsed')).toBe('true');
    view.unmount();
    setup();
    await user.click(screen.getByRole('button', { name: 'Expand navigation' }));
    expect(screen.getByText('Browse All')).toBeTruthy();
    expect(localStorage.getItem('qmusic-nav-collapsed')).toBe('false');
  });
  it('keeps navigation usable when preference storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    setup();
    await user.click(
      screen.getByRole('button', { name: 'Collapse navigation' })
    );
    expect(screen.getByRole('link', { name: 'Playlists' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Expand navigation' }));
    expect(screen.getByText('Playlists')).toBeTruthy();
  });
});
