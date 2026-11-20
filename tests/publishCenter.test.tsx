import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishCenter } from '../src/components/publishing/PublishCenter';
import type { PublishSnapshot } from '../src/services/publishing/engine';
const mocks = vi.hoisted(() => ({
  state: { value: null as unknown as PublishSnapshot },
  close: vi.fn(),
  stop: vi.fn(),
  progress: vi.fn(),
  activate: vi.fn(),
}));
vi.mock('../src/qortal', () => ({
  useGlobal: () => ({ auth: { name: 'Alice' } }),
}));
vi.mock('../src/services/publishing/engine', () => ({
  getPublishSnapshot: () => mocks.state.value,
  subscribePublish: () => () => {},
  activatePublishAccount: mocks.activate,
  closePublishCenter: mocks.close,
  stopPublishVerification: mocks.stop,
  recordPublishProgress: mocks.progress,
  openPublishCenter: vi.fn(),
  archivePublishJob: vi.fn(),
  checkPublishJob: vi.fn(),
  continuePublishJob: vi.fn(),
  authorizePublishResend: vi.fn(),
  summarizeJob: (job: { items: { state: string }[] }) => ({
    complete: job.items.every((item) =>
      ['submitted', 'verified'].includes(item.state)
    ),
    verified: false,
    message: 'Transaction sent. Availability has not been verified.',
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.value = {
    jobs: [
      {
        id: 'job',
        publisher: 'Alice',
        title: 'My song',
        created: 1,
        updated: 1,
        items: [
          {
            name: 'Alice',
            identifier: 'audio',
            service: 'AUDIO',
            state: 'sending',
            sha256: 'hash',
            bytes: 1,
            chunks: 1,
            totalChunks: 1,
          },
        ],
      },
    ],
    publisher: 'Alice',
    activeJobId: 'job',
    waitingJobIds: ['job'],
    activity: 'Waiting for Hub approval or sending…',
    open: true,
    error: null,
  };
});
afterEach(cleanup);
describe('publish modal lifecycle', () => {
  it('can minimize during an active send without pretending to cancel the transaction', async () => {
    const user = userEvent.setup();
    render(<PublishCenter />);
    expect(screen.getByText('Publishing')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(mocks.close).toHaveBeenCalled();
    expect(mocks.stop).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole('button', {
          name: 'Check availability',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
  it('filters saved jobs by current publisher', () => {
    mocks.state.value = {
      ...mocks.state.value,
      jobs: [
        ...mocks.state.value.jobs,
        {
          ...mocks.state.value.jobs[0],
          id: 'other',
          publisher: 'Bob',
          title: 'Other account secret',
        },
      ],
    };
    render(<PublishCenter />);
    expect(screen.queryByText('Other account secret')).toBeNull();
    expect(screen.getByText('My song')).toBeTruthy();
  });
  it('ignores progress messages from an unrelated sender', () => {
    render(<PublishCenter />);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { action: 'PUBLISH_STATUS', processed: true },
        source: null,
      })
    );
    expect(mocks.progress).not.toHaveBeenCalled();
  });
  it('shows a clear sent result with Done and no floating activity control', async () => {
    mocks.state.value = {
      ...mocks.state.value,
      activeJobId: null,
      waitingJobIds: [],
      activity: '',
      jobs: [
        {
          ...mocks.state.value.jobs[0],
          items: [
            { ...mocks.state.value.jobs[0].items[0], state: 'submitted' },
          ],
        },
      ],
    };
    render(<PublishCenter />);
    expect(screen.getByText('Publication sent')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Publish activity/ })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Continue publication' })
    ).toBeNull();
    expect(screen.getByText('Details').closest('details')?.open).toBe(false);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Done' }));
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.stop).not.toHaveBeenCalled();
  });
});
