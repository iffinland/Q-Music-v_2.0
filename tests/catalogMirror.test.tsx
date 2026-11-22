import React, { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MUSIC_MIRROR_LIST,
  mirrorPublisherNames,
  readMirrorFollowing,
  updateMirrorFollowing,
} from '../src/services/catalogMirror';
import { CatalogMirrorButton } from '../src/components/mirroring/CatalogMirrorButton';
import { CatalogMirrorDialog } from '../src/components/mirroring/CatalogMirrorDialog';
const native = vi.fn();
let following: string[];
let isPublic: unknown;
beforeEach(() => {
  following = [];
  isPublic = false;
  native.mockReset().mockImplementation(async (payload) => {
    if (payload.action === 'IS_USING_PUBLIC_NODE') return isPublic;
    if (payload.action === 'GET_LIST_ITEMS') return [...following];
    if (payload.action === 'ADD_LIST_ITEMS') {
      following = [...new Set([...following, ...payload.items])];
      return true;
    }
    if (payload.action === 'DELETE_LIST_ITEM') {
      following = following.filter((name) => !payload.items.includes(name));
      return true;
    }
    throw new Error('Unexpected native action');
  });
  vi.stubGlobal('qortalRequest', native);
  vi.stubGlobal('qortalRequestWithTimeout', undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const writes = () =>
  native.mock.calls.filter(
    ([p]) => p.action === 'ADD_LIST_ITEMS' || p.action === 'DELETE_LIST_ITEM'
  );
const readReady = () =>
  screen.findByRole('checkbox', { name: /@Alice — No Q-Music follow/ });
const consent = () =>
  screen.getByRole('checkbox', { name: /I manage the node/ });
describe('native node follow adapter', () => {
  it('normalizes names and scopes add/remove to its own followedNames-prefix list with read-back', async () => {
    expect(mirrorPublisherNames([' Alice ', 'alice', '', 'Bob'])).toEqual([
      'Alice',
      'Bob',
    ]);
    expect(await updateMirrorFollowing('follow', ['Alice', 'Alice'])).toEqual([
      'Alice',
    ]);
    expect(writes()[0][0]).toEqual({
      action: 'ADD_LIST_ITEMS',
      list_name: MUSIC_MIRROR_LIST,
      items: ['Alice'],
    });
    expect(await updateMirrorFollowing('unfollow', ['Alice'])).toEqual([]);
    expect(writes()[1][0]).toEqual({
      action: 'DELETE_LIST_ITEM',
      list_name: MUSIC_MIRROR_LIST,
      items: ['Alice'],
    });
    expect(
      native.mock.calls.filter(([p]) => p.action === 'GET_LIST_ITEMS')
    ).toHaveLength(2);
  });
  it.each([true, undefined, 'false'])(
    'refuses public or unverifiable node state %s without list mutation',
    async (status) => {
      isPublic = status;
      await expect(
        updateMirrorFollowing('follow', ['Alice'])
      ).rejects.toThrow();
      expect(writes()).toHaveLength(0);
      await expect(readMirrorFollowing()).rejects.toThrow();
      expect(
        native.mock.calls.every(([p]) => p.action === 'IS_USING_PUBLIC_NODE')
      ).toBe(true);
    }
  );
  it('rejects oversized/empty groups before requesting native permissions', async () => {
    await expect(updateMirrorFollowing('follow', [])).rejects.toThrow();
    await expect(
      updateMirrorFollowing(
        'follow',
        Array.from({ length: 21 }, (_, i) => `Name${i}`)
      )
    ).rejects.toThrow();
    expect(native).not.toHaveBeenCalled();
  });
  it('rejects false acknowledgements and unverified read-back without automatically repeating a write', async () => {
    native.mockImplementation(async (p) =>
      p.action === 'IS_USING_PUBLIC_NODE'
        ? false
        : p.action === 'ADD_LIST_ITEMS'
          ? false
          : []
    );
    await expect(updateMirrorFollowing('follow', ['Alice'])).rejects.toThrow(
      'did not confirm'
    );
    expect(writes()).toHaveLength(1);
    native.mockImplementation(async (p) =>
      p.action === 'IS_USING_PUBLIC_NODE'
        ? false
        : p.action === 'ADD_LIST_ITEMS'
          ? true
          : []
    );
    await expect(updateMirrorFollowing('follow', ['Alice'])).rejects.toThrow(
      'does not match'
    );
    expect(writes()).toHaveLength(2);
  });
  it('rejects malformed list data rather than treating it as an empty follow list', async () => {
    native.mockImplementation(async (p) =>
      p.action === 'IS_USING_PUBLIC_NODE'
        ? false
        : { error: 'Permission declined' }
    );
    await expect(readMirrorFollowing()).rejects.toThrow('Permission declined');
    native.mockImplementation(async (p) =>
      p.action === 'IS_USING_PUBLIC_NODE' ? false : ['Alice', 4]
    );
    await expect(readMirrorFollowing()).rejects.toThrow('invalid follow list');
  });
});
describe('catalogue mirror review', () => {
  it('makes no requests until opened, requires deliberate selection/consent and verifies only a follow rule', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <CatalogMirrorButton
          kind="publisher"
          name="Alice"
          publishers={['Alice']}
        />
      </StrictMode>
    );
    expect(native).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Mirror publisher' }));
    const checkbox = await readReady();
    expect(screen.getByText(/all QDN content/)).toBeTruthy();
    expect(writes()).toHaveLength(0);
    const follow = screen.getByRole('button', {
      name: 'Follow on my node',
    }) as HTMLButtonElement;
    expect(follow.disabled).toBe(true);
    await user.click(checkbox);
    expect(follow.disabled).toBe(true);
    await user.click(consent());
    await user.click(follow);
    await screen.findByText(/follow saved and checked/);
    expect(writes()).toHaveLength(1);
    expect(screen.getByText(/completion has not been verified/)).toBeTruthy();
    await user.click(
      screen.getByRole('checkbox', { name: /@Alice — Follow saved/ })
    );
    await user.click(consent());
    await user.click(
      screen.getByRole('button', { name: 'Stop Q-Music follow' })
    );
    await screen.findByText(/follow removed and checked/);
    expect(writes()).toHaveLength(2);
  });
  it('keeps an artist review set fixed, warns about incomplete matches and can manage previous Q-Music follows', async () => {
    following = ['PreviousPublisher'];
    const user = userEvent.setup();
    const view = render(
      <CatalogMirrorDialog
        kind="artist"
        name="Artist"
        publishers={['Alice', 'alice']}
        incomplete
        onClose={vi.fn()}
      />
    );
    await readReady();
    expect(screen.getByText(/artist search is incomplete/)).toBeTruthy();
    view.rerender(
      <CatalogMirrorDialog
        kind="artist"
        name="Artist"
        publishers={['Alice', 'Bob']}
        incomplete
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('checkbox', { name: /@Bob/ })).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Manage all Q-Music follows' })
    );
    await user.click(
      screen.getByRole('checkbox', { name: /@PreviousPublisher/ })
    );
    await user.click(consent());
    await user.click(
      screen.getByRole('button', { name: 'Stop Q-Music follow' })
    );
    await screen.findByText(/follow removed and checked/);
    expect(writes()[0][0].items).toEqual(['PreviousPublisher']);
  });
  it('uses the saved spelling when stopping a case-insensitive publisher match', async () => {
    following = ['alice'];
    const user = userEvent.setup();
    render(
      <CatalogMirrorDialog
        kind="publisher"
        name="Alice"
        publishers={['Alice']}
        onClose={vi.fn()}
      />
    );
    await user.click(
      await screen.findByRole('checkbox', { name: /@Alice — Follow saved/ })
    );
    await user.click(consent());
    await user.click(
      screen.getByRole('button', { name: 'Stop Q-Music follow' })
    );
    await screen.findByText(/follow removed and checked/);
    expect(writes()[0][0].items).toEqual(['alice']);
  });
  it('pages large publisher selections and caps a native confirmation at 20 names', async () => {
    const user = userEvent.setup();
    render(
      <CatalogMirrorDialog
        kind="artist"
        name="Artist"
        publishers={Array.from({ length: 21 }, (_, i) => `Publisher${i}`)}
        incomplete
        onClose={vi.fn()}
      />
    );
    await screen.findByRole('checkbox', {
      name: /@Publisher0 — No Q-Music follow/,
    });
    expect(screen.queryByRole('checkbox', { name: /@Publisher20/ })).toBeNull();
    for (const checkbox of screen
      .getAllByRole('checkbox')
      .filter(
        (item) =>
          item.getAttribute('type') === 'checkbox' &&
          !item.closest('label')?.textContent?.includes('I manage')
      ))
      await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(
      (
        screen.getByRole('checkbox', {
          name: /@Publisher20/,
        }) as HTMLInputElement
      ).disabled
    ).toBe(true);
    await user.click(consent());
    await user.click(screen.getByRole('button', { name: 'Follow on my node' }));
    await screen.findByText(/follow saved and checked/);
    expect(writes()[0][0].items).toHaveLength(20);
  });
  it('locks further writes after an uncertain outcome until the user refreshes saved state', async () => {
    const user = userEvent.setup();
    render(
      <CatalogMirrorDialog
        kind="publisher"
        name="Alice"
        publishers={['Alice']}
        onClose={vi.fn()}
      />
    );
    await user.click(await readReady());
    await user.click(consent());
    native.mockImplementation(async (p) => {
      if (p.action === 'IS_USING_PUBLIC_NODE') return false;
      if (p.action === 'ADD_LIST_ITEMS') return false;
      return [...following];
    });
    await user.click(screen.getByRole('button', { name: 'Follow on my node' }));
    await screen.findByText(/saved state may have changed/);
    expect(
      (
        screen.getByRole('button', {
          name: 'Follow on my node',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(writes()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('checkbox', { name: /@Alice/ }) as HTMLInputElement)
          .disabled
      ).toBe(false)
    );
    expect(writes()).toHaveLength(1);
  });
  it('keeps a native write in progress from being dismissed and never triggers reads for file content', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let finish!: (value: boolean) => void;
    render(
      <CatalogMirrorDialog
        kind="publisher"
        name="Alice"
        publishers={['Alice']}
        onClose={onClose}
      />
    );
    await user.click(await readReady());
    await user.click(consent());
    native.mockImplementation(async (p) => {
      if (p.action === 'IS_USING_PUBLIC_NODE') return false;
      if (p.action === 'ADD_LIST_ITEMS')
        return new Promise((resolve) => {
          finish = resolve;
        });
      return ['Alice'];
    });
    await user.click(screen.getByRole('button', { name: 'Follow on my node' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(
      (screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      finish(true);
    });
    await screen.findByText(/follow saved and checked/);
    expect(
      native.mock.calls.every(([p]) =>
        ['IS_USING_PUBLIC_NODE', 'GET_LIST_ITEMS', 'ADD_LIST_ITEMS'].includes(
          p.action
        )
      )
    ).toBe(true);
  });
});
