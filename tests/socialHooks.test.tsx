import React from 'react';
import {
  act,
  cleanup,
  renderHook,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntityLikes } from '../src/hooks/useEntityLikes';
import { useEntityComments } from '../src/hooks/useEntityComments';
import { CommentSection } from '../src/components/common/CommentSection';
import { SocialFeedback } from '../src/components/common/SocialFeedback';
import { initialCommentCursor } from '../src/services/entityComments';
const mocks = vi.hoisted(() => ({
  auth: { name: 'Alice', address: 'Wallet' },
  likes: vi.fn(),
  comments: vi.fn(),
  publish: vi.fn(),
}));
vi.mock('../src/qortal', () => ({
  useGlobal: () => ({ auth: mocks.auth }),
  objectToBase64: vi.fn(),
}));
vi.mock('../src/services/entityLikes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/entityLikes')>()),
  fetchLikes: mocks.likes,
}));
vi.mock('../src/services/entityComments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/entityComments')>()),
  fetchComments: mocks.comments,
}));
vi.mock('../src/services/publishing/engine', () => ({
  publishAuxiliary: mocks.publish,
}));
const params = {
  entityType: 'song' as const,
  entityId: 'song',
  entityPublisher: 'Artist',
  title: 'Song',
  enabled: true,
};
const row = (id = 'comment', extra = {}) => ({
  id,
  resourceId: 'legacy-comment',
  entityType: 'song' as const,
  entityId: 'song',
  entityPublisher: 'Artist',
  author: 'Alice',
  message: 'Visible comment',
  created: 1000,
  ...extra,
});
const done = { ...initialCommentCursor(), modernDone: true, legacyDone: true };
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.auth = { name: 'Alice', address: 'Wallet' };
  mocks.likes.mockResolvedValue({
    authors: { alice: true },
    partial: false,
    warning: '',
  });
  mocks.comments.mockResolvedValue({
    comments: [row()],
    cursor: done,
    hasMore: false,
    warning: '',
  });
  mocks.publish.mockImplementation(async (_r, before) => {
    await before();
    return [{ signature: 'signed' }];
  });
  vi.stubGlobal(
    'qortalRequestWithTimeout',
    vi.fn(async () => ({ address: mocks.auth.address }))
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('social hook lifecycle', () => {
  it('hides the previous account’s like status during a new account read and rejects a late old response', async () => {
    let resolve!: (value: unknown) => void;
    mocks.likes.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const { result, rerender } = renderHook(useEntityLikes, {
      initialProps: params,
    });
    mocks.auth = { name: 'Bob', address: 'B' };
    rerender(params);
    expect(result.current.hasLike).toBe(false);
    expect(result.current.likeCount).toBeUndefined();
    await waitFor(() => expect(result.current.likeCount).toBe(1));
    expect(result.current.hasLike).toBe(false);
    await act(async () => {
      resolve({ authors: { bob: true, alice: true }, partial: false });
    });
    expect(result.current.hasLike).toBe(false);
    expect(result.current.likeCount).toBe(1);
  });
  it('keeps a previously loaded count after refresh fails, rather than reporting zero', async () => {
    const { result } = renderHook(() => useEntityLikes(params));
    await waitFor(() => expect(result.current.likeCount).toBe(1));
    mocks.likes.mockRejectedValue(new Error('Node unavailable'));
    act(() => result.current.refreshLikes());
    await waitFor(() => expect(result.current.error).toBe('Node unavailable'));
    expect(result.current.likeCount).toBe(1);
    expect(result.current.canLike).toBe(false);
  });
  it('does not request comment content until comments are opened', () => {
    renderHook(() => useEntityComments({ ...params, enabled: false }));
    expect(mocks.comments).not.toHaveBeenCalled();
  });
  it('resets comments immediately for another resource owner and ignores late results', async () => {
    let resolve!: (value: unknown) => void;
    mocks.comments.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const { result, rerender } = renderHook(useEntityComments, {
      initialProps: params,
    });
    rerender({ ...params, entityPublisher: 'Other' });
    expect(result.current.comments).toEqual([]);
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await act(async () => {
      resolve({ comments: [row('old-owner')], cursor: done, hasMore: false });
    });
    expect(
      result.current.comments.some((comment) => comment.id === 'old-owner')
    ).toBe(false);
  });
  it('keeps loaded comments on an error and resets raw cursors for Refresh', async () => {
    const { result } = renderHook(() => useEntityComments(params));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    mocks.comments.mockRejectedValueOnce(new Error('Offline'));
    act(() => result.current.refreshComments());
    await waitFor(() => expect(result.current.error).toBe('Offline'));
    expect(result.current.comments).toHaveLength(1);
    expect(mocks.comments.mock.calls.at(-1)[2]).toMatchObject({
      modern: 0,
      legacy: 0,
    });
  });
  it('retains previously loaded comments when a refresh returns only partial data', async () => {
    const { result } = renderHook(() => useEntityComments(params));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    mocks.comments.mockResolvedValueOnce({
      comments: [],
      cursor: { ...done, retry: [{ name: 'Alice', identifier: 'slow' }] },
      hasMore: true,
      warning: 'Some comments are unavailable',
    });
    act(() => result.current.refreshComments());
    await waitFor(() => expect(result.current.error).toContain('unavailable'));
    expect(result.current.comments).toHaveLength(1);
  });
  it('keeps a just-sent comment visible over a stale node response without republishing it', async () => {
    mocks.comments.mockResolvedValue({
      comments: [],
      cursor: done,
      hasMore: false,
      warning: '',
    });
    const { result } = renderHook(() => useEntityComments(params));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      expect(await result.current.addComment('Just sent')).toBe(true);
    });
    expect(result.current.comments[0]).toMatchObject({
      message: 'Just sent',
      pending: true,
    });
    act(() => result.current.refreshComments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comments[0].message).toBe('Just sent');
    expect(mocks.publish).toHaveBeenCalledOnce();
  });
  it('coalesces comment double clicks synchronously before the UI rerenders', async () => {
    const { result } = renderHook(() => useEntityComments(params));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await Promise.all([
        result.current.addComment('Double'),
        result.current.addComment('Double'),
      ]);
    });
    expect(mocks.publish).toHaveBeenCalledOnce();
  });
});
describe('comment rendering and retry UX', () => {
  const callbacks = () => ({
    onAddComment: vi.fn(async () => false),
    onReply: vi.fn(async () => false),
    onEdit: vi.fn(async () => false),
    onDelete: vi.fn(async () => false),
  });
  it('renders orphaned replies, replies to removed parents and deeper replies without hiding content', () => {
    render(
      <CommentSection
        comments={[
          row('parent', { deleted: true }),
          row('child', { parentId: 'parent', message: 'Child text' }),
          row('grandchild', { parentId: 'child', message: 'Grandchild text' }),
          row('orphan', { parentId: 'missing', message: 'Orphan text' }),
        ]}
        currentUser="Alice"
        {...callbacks()}
      />
    );
    expect(screen.getByText('Comment removed.')).toBeTruthy();
    expect(screen.getByText('Child text')).toBeTruthy();
    expect(screen.getByText('Grandchild text')).toBeTruthy();
    expect(screen.getByText('Orphan text')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3);
  });
  it('does not attribute an ambiguous legacy reply ID to an arbitrary author', () => {
    render(
      <CommentSection
        comments={[
          row('A', { resourceId: 'shared' }),
          row('B', { resourceId: 'shared', author: 'Bob' }),
          row('reply', { parentId: 'shared', message: 'Reply text' }),
        ]}
        {...callbacks()}
      />
    );
    expect(
      screen.getByText('Reply to an earlier comment (not loaded or removed)')
    ).toBeTruthy();
    expect(screen.queryByText('Reply to Alice')).toBeNull();
    expect(screen.queryByText('Reply to Bob')).toBeNull();
  });
  it('keeps the typed draft after a failed or declined send', async () => {
    const callbacksForTest = callbacks();
    render(
      <CommentSection comments={[]} currentUser="Alice" {...callbacksForTest} />
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Add a comment'), 'Keep my draft');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(
      (screen.getByLabelText('Add a comment') as HTMLInputElement).value
    ).toBe('Keep my draft');
  });
  it('never shows a misleading empty result while loading or on a read failure', () => {
    const view = render(
      <CommentSection
        comments={[]}
        currentUser="Alice"
        isLoading
        {...callbacks()}
      />
    );
    expect(screen.queryByText('No comments yet.')).toBeNull();
    view.rerender(
      <CommentSection comments={[]} error="Node offline" {...callbacks()} />
    );
    expect(screen.queryByText('No comments yet.')).toBeNull();
  });
  it('requires explicit confirmation before retrying a saved uncertain action', async () => {
    const retry = vi.fn();
    render(<SocialFeedback uncertain onRetry={retry} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Retry saved action…' })
    );
    expect(retry).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Retry saved action', exact: true })
    );
    expect(retry).toHaveBeenCalledOnce();
  });
});
