import {
  Button,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  EditRounded,
  ReplyRounded,
  VisibilityOffRounded,
  VisibilityRounded,
} from '@mui/icons-material';
import { useMemo, useState } from 'react';
import type { MediaComment } from '../../types/engagement';

interface CommentSectionProps {
  title?: string;
  comments: MediaComment[];
  hiddenCommentIds: string[];
  isModerator: boolean;
  currentUser?: string;
  ownerName?: string;
  isLoading?: boolean;
  isSubmittingComment?: boolean;
  isEditingComment?: boolean;
  isModerating?: boolean;
  onAddComment: (message: string) => Promise<boolean> | boolean;
  onReply: (commentId: string, message: string) => Promise<boolean> | boolean;
  onEdit: (
    comment: MediaComment,
    message: string
  ) => Promise<boolean> | boolean;
  onDelete: (comment: MediaComment) => Promise<boolean> | boolean;
  onToggleVisibility: (commentId: string) => Promise<boolean> | boolean;
}

export const CommentSection = ({
  title = 'Comments',
  comments,
  hiddenCommentIds,
  isModerator,
  currentUser,
  ownerName,
  isLoading,
  isSubmittingComment,
  isEditingComment,
  isModerating,
  onAddComment,
  onReply,
  onEdit,
  onDelete,
  onToggleVisibility,
}: CommentSectionProps) => {
  const [commentDraft, setCommentDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  const commentGroups = useMemo(() => {
    const visibleComments = comments.filter(
      (comment) => isModerator || !hiddenCommentIds.includes(comment.id)
    );
    const repliesByParent = visibleComments.reduce<
      Record<string, MediaComment[]>
    >((accumulator, comment) => {
      if (!comment.parentId) {
        return accumulator;
      }
      accumulator[comment.parentId] = accumulator[comment.parentId] || [];
      accumulator[comment.parentId].push(comment);
      return accumulator;
    }, {});

    return visibleComments
      .filter((comment) => !comment.parentId)
      .map((comment) => ({
        comment,
        replies: (repliesByParent[comment.id] || []).sort(
          (left, right) => left.created - right.created
        ),
      }));
  }, [comments, hiddenCommentIds, isModerator]);

  const handleAddComment = async () => {
    const wasPublished = await onAddComment(commentDraft);
    if (wasPublished) {
      setCommentDraft('');
    }
  };

  const handleReply = async (commentId: string) => {
    const wasPublished = await onReply(commentId, replyDrafts[commentId] || '');
    if (wasPublished) {
      setReplyDrafts((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });
    }
  };

  const handleEdit = async (comment: MediaComment) => {
    const wasSaved = await onEdit(comment, editDrafts[comment.id] || '');
    if (wasSaved) {
      setEditDrafts((current) => {
        const next = { ...current };
        delete next[comment.id];
        return next;
      });
    }
  };

  return (
    <Stack spacing={1.25}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={0.75}
      >
        <Typography variant="h6" sx={{ lineHeight: 1.08 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {isLoading
            ? 'Refreshing social activity...'
            : 'Comments are stored on QDN.'}
        </Typography>
      </Stack>

      <Stack
        spacing={1.25}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}
      >
        <TextField
          label="Add a comment"
          multiline
          minRows={2}
          value={commentDraft}
          onChange={(event) => setCommentDraft(event.target.value)}
        />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="space-between"
        >
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', alignSelf: 'center' }}
          >
            Keep it short and readable.
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={() => void handleAddComment()}
            disabled={isSubmittingComment}
          >
            {isSubmittingComment ? 'Publishing...' : 'Post comment'}
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={1}>
        {commentGroups.length ? (
          commentGroups.map(({ comment, replies }) => (
            <Stack
              key={comment.id}
              spacing={1}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                px: { xs: 1.5, sm: 2 },
                py: 1.35,
                backgroundColor: 'rgba(255,255,255,0.015)',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                spacing={0.5}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle2">{comment.author}</Typography>
                  {comment.author === ownerName ? (
                    <Chip label="Creator" size="small" />
                  ) : null}
                  {hiddenCommentIds.includes(comment.id) ? (
                    <Chip label="Hidden" size="small" color="warning" />
                  ) : null}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {dateFormatter.format(comment.created)}
                </Typography>
              </Stack>

              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                {comment.message}
              </Typography>

              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ReplyRounded fontSize="small" />}
                  onClick={() =>
                    setReplyDrafts((current) => ({
                      ...current,
                      [comment.id]: current[comment.id] ?? '',
                    }))
                  }
                >
                  Reply
                </Button>
                {comment.author === currentUser ? (
                  <>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<EditRounded fontSize="small" />}
                      onClick={() =>
                        setEditDrafts((current) => ({
                          ...current,
                          [comment.id]: current[comment.id] ?? comment.message,
                        }))
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => void onDelete(comment)}
                    >
                      Delete
                    </Button>
                  </>
                ) : null}
                {isModerator ? (
                  <Button
                    variant="text"
                    size="small"
                    disabled={isModerating}
                    startIcon={
                      hiddenCommentIds.includes(comment.id) ? (
                        <VisibilityRounded fontSize="small" />
                      ) : (
                        <VisibilityOffRounded fontSize="small" />
                      )
                    }
                    onClick={() => void onToggleVisibility(comment.id)}
                  >
                    {hiddenCommentIds.includes(comment.id) ? 'Restore' : 'Hide'}
                  </Button>
                ) : null}
              </Stack>

              {replyDrafts[comment.id] !== undefined ? (
                <Stack spacing={1}>
                  <TextField
                    label="Reply"
                    multiline
                    minRows={2}
                    size="small"
                    value={replyDrafts[comment.id] || ''}
                    onChange={(event) =>
                      setReplyDrafts((current) => ({
                        ...current,
                        [comment.id]: event.target.value,
                      }))
                    }
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => void handleReply(comment.id)}
                      disabled={isSubmittingComment}
                    >
                      {isSubmittingComment ? 'Publishing...' : 'Post reply'}
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() =>
                        setReplyDrafts((current) => {
                          const next = { ...current };
                          delete next[comment.id];
                          return next;
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              ) : null}

              {editDrafts[comment.id] !== undefined ? (
                <Stack spacing={1}>
                  <TextField
                    label="Edit comment"
                    multiline
                    minRows={2}
                    size="small"
                    value={editDrafts[comment.id] || ''}
                    onChange={(event) =>
                      setEditDrafts((current) => ({
                        ...current,
                        [comment.id]: event.target.value,
                      }))
                    }
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => void handleEdit(comment)}
                      disabled={isEditingComment}
                    >
                      {isEditingComment ? 'Saving...' : 'Save changes'}
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() =>
                        setEditDrafts((current) => {
                          const next = { ...current };
                          delete next[comment.id];
                          return next;
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              ) : null}

              {replies.length ? (
                <>
                  <Divider />
                  <Stack spacing={0.75} sx={{ pl: { xs: 1, sm: 2 } }}>
                    {replies.map((reply) => (
                      <Stack
                        key={reply.id}
                        spacing={0.5}
                        sx={{
                          borderLeft: '2px solid',
                          borderColor: 'divider',
                          pl: 1.25,
                          py: 0.25,
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          spacing={0.5}
                        >
                          <Typography variant="subtitle2">
                            {reply.author}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                          >
                            {dateFormatter.format(reply.created)}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                          {reply.message}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>
              ) : null}
            </Stack>
          ))
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No comments yet.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
};
