import { Button, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import type { MediaComment } from '../../types/engagement';
import { SocialFeedback } from './SocialFeedback';
interface CommentSectionProps {
  title?: string;
  comments: MediaComment[];
  currentUser?: string;
  isLoading?: boolean;
  isSubmittingComment?: boolean;
  isEditingComment?: boolean;
  canLoadMore?: boolean;
  error?: string | null;
  notice?: string;
  uncertain?: boolean;
  onRefresh?: () => void;
  onRetrySaved?: () => void;
  onAddComment: (message: string) => Promise<boolean> | boolean;
  onReply: (id: string, message: string) => Promise<boolean> | boolean;
  onEdit: (
    comment: MediaComment,
    message: string
  ) => Promise<boolean> | boolean;
  onDelete: (comment: MediaComment) => Promise<boolean> | boolean;
  onLoadMore?: () => void;
}
const CommentCard = ({
  comment,
  parent,
  currentUser,
  busy,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: MediaComment;
  parent?: MediaComment;
  currentUser?: string;
  busy: boolean;
  onReply: CommentSectionProps['onReply'];
  onEdit: CommentSectionProps['onEdit'];
  onDelete: CommentSectionProps['onDelete'];
}) => {
  const [mode, setMode] = useState<'reply' | 'edit' | null>(null),
    [draft, setDraft] = useState('');
  const own = Boolean(
    currentUser && currentUser.toLowerCase() === comment.author.toLowerCase()
  );
  const save = async () => {
    const text = draft;
    const okay =
      mode === 'reply'
        ? await onReply(comment.id, text)
        : await onEdit(comment, text);
    if (okay) {
      setMode(null);
      setDraft('');
    }
  };
  return (
    <Stack
      spacing={1}
      sx={{
        minWidth: 0,
        overflowWrap: 'anywhere',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: { xs: 1.5, sm: 2 },
        bgcolor: 'var(--qm-surface-soft)',
      }}
    >
      <Typography variant="subtitle2">{comment.author}</Typography>
      <Typography variant="caption" color="text.secondary">
        {new Date(comment.created).toLocaleString()}
        {comment.updated && comment.updated !== comment.created
          ? ' • edited'
          : ''}
        {comment.pending ? ' • sent, awaiting propagation' : ''}
      </Typography>
      {comment.parentId && (
        <Typography variant="caption" color="text.secondary">
          {parent
            ? `Reply to ${parent.author}${parent.deleted ? ' (comment removed)' : ''}`
            : 'Reply to an earlier comment (not loaded or removed)'}
        </Typography>
      )}
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {comment.deleted ? 'Comment removed.' : comment.message}
      </Typography>
      {!comment.deleted && (
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
          <Button
            size="small"
            disabled={!currentUser || busy}
            onClick={() => {
              setMode('reply');
              setDraft('');
            }}
          >
            Reply
          </Button>
          {own && (
            <>
              <Button
                size="small"
                disabled={busy}
                onClick={() => {
                  setMode('edit');
                  setDraft(comment.message);
                }}
              >
                Edit
              </Button>
              <Button
                size="small"
                disabled={busy}
                onClick={() => void onDelete(comment)}
              >
                Remove
              </Button>
            </>
          )}
        </Stack>
      )}
      {mode && (
        <Stack spacing={1}>
          <TextField
            label={mode === 'reply' ? 'Reply' : 'Edit comment'}
            multiline
            minRows={2}
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            fullWidth
          />
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
            <Button
              disabled={busy || !draft.trim()}
              onClick={() => void save()}
            >
              {mode === 'reply' ? 'Post reply' : 'Save changes'}
            </Button>
            <Button disabled={busy} onClick={() => setMode(null)}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
};
export const CommentSection = ({
  title = 'Comments',
  comments,
  currentUser,
  isLoading,
  isSubmittingComment,
  isEditingComment,
  canLoadMore,
  error,
  notice,
  uncertain,
  onRefresh,
  onRetrySaved,
  onAddComment,
  onReply,
  onEdit,
  onDelete,
  onLoadMore,
}: CommentSectionProps) => {
  const [draft, setDraft] = useState('');
  const parents = useMemo(() => {
    const result = new Map<string, MediaComment | null>();
    for (const comment of comments)
      for (const id of [comment.id, comment.resourceId]) {
        if (!id) continue;
        const previous = result.get(id);
        result.set(
          id,
          result.has(id) && previous?.id !== comment.id ? null : comment
        );
      }
    return result;
  }, [comments]);
  const busy = Boolean(isSubmittingComment || isEditingComment);
  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Typography variant="h6">{title}</Typography>
      <SocialFeedback
        error={error}
        notice={notice}
        busy={busy || isLoading}
        onRefresh={onRefresh}
        uncertain={uncertain}
        onRetry={onRetrySaved}
        label="comments"
      />
      <Typography variant="caption" color="text.secondary">
        Comments are public QDN publications. Posting, editing or removing needs
        approval in Hub. Removal hides the current comment in updated Q-Music;
        old QDN versions can remain available.
      </Typography>
      {currentUser ? (
        <Stack spacing={1}>
          <TextField
            label="Add a comment"
            multiline
            minRows={2}
            disabled={busy || uncertain}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            fullWidth
          />
          <Button
            variant="contained"
            sx={{ alignSelf: 'flex-start' }}
            disabled={busy || uncertain || !draft.trim()}
            onClick={() => {
              const text = draft;
              void Promise.resolve(onAddComment(text)).then((okay) => {
                if (okay)
                  setDraft((current) => (current === text ? '' : current));
              });
            }}
          >
            {busy ? 'Waiting for Hub…' : 'Post comment'}
          </Button>
        </Stack>
      ) : (
        <Typography variant="body2">Log in to post or reply.</Typography>
      )}
      {isLoading && <Typography role="status">Loading comments…</Typography>}
      {!isLoading && !error && !comments.length && (
        <Typography variant="body2">No comments yet.</Typography>
      )}
      {comments.map((comment) => (
        <CommentCard
          key={comment.id}
          comment={comment}
          parent={parents.get(comment.parentId || '') || undefined}
          currentUser={currentUser}
          busy={busy || Boolean(uncertain)}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
      {canLoadMore && onLoadMore && (
        <Button
          disabled={isLoading || busy}
          variant="outlined"
          onClick={onLoadMore}
        >
          Load more comments
        </Button>
      )}
    </Stack>
  );
};
