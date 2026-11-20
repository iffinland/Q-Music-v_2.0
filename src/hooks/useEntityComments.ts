import { useEffect, useRef, useState } from 'react';
import {
  changeComment,
  commentFromPayload,
  fetchComments,
  initialCommentCursor,
} from '../services/entityComments';
import { requestError } from '../services/qdnRequests';
import {
  prepareSocial,
  sendSocial,
  confirmSocial,
} from '../services/engagement/shared';
import { useSocialContext, type SocialParams } from './useSocialContext';
import type { MediaComment } from '../types/engagement';
export const useEntityComments = (params: SocialParams) => {
  const context = useSocialContext(params);
  const [state, setState] = useState<{
    key: string;
    comments: MediaComment[];
    loading: boolean;
    error: string;
    busy: boolean;
    notice: string;
  }>({
    key: '',
    comments: [],
    loading: false,
    error: '',
    busy: false,
    notice: '',
  });
  const cursor = useRef(initialCommentCursor()),
    [tick, setTick] = useState(0),
    busy = useRef(false),
    request = useRef(0),
    reset = useRef(true);
  const load = (fresh: boolean) => {
    if (busy.current) return;
    request.current++;
    reset.current = fresh;
    setTick((value) => value + 1);
  };
  useEffect(() => {
    cursor.current = initialCommentCursor();
    reset.current = true;
    busy.current = false;
  }, [context.key]);
  useEffect(() => {
    const token = ++request.current,
      controller = new AbortController();
    if (!context.enabled) return;
    const fresh = reset.current;
    const start = fresh ? initialCommentCursor() : cursor.current;
    setState((previous) => ({
      ...previous,
      key: context.key,
      comments: previous.key === context.key ? previous.comments : [],
      loading: true,
      error: '',
      busy: false,
    }));
    void fetchComments(context.target, context.actor, start, {
      signal: controller.signal,
    })
      .then((result) => {
        if (token !== request.current || !context.isCurrent()) return;
        cursor.current = result.cursor;
        setState((previous) => ({
          ...previous,
          comments: [
            ...new Map(
              [
                ...(fresh && !result.warning ? [] : previous.comments),
                ...result.comments,
              ].map((comment) => [comment.id, comment])
            ).values(),
          ].sort((a, b) => b.created - a.created),
          loading: false,
          error: result.warning,
        }));
        reset.current = false;
        for (const entry of result.confirmed || [])
          confirmSocial(
            context.actor,
            context.target,
            entry.identifier,
            entry.revision
          );
      })
      .catch((error) => {
        if (
          !controller.signal.aborted &&
          token === request.current &&
          context.isCurrent()
        )
          setState((previous) => ({
            ...previous,
            loading: false,
            error: requestError(error),
          }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.key, tick]);
  const live = state.key === context.key && context.enabled ? state : undefined;
  const comments = new Map(
    (live?.comments || []).map((comment) => [comment.id, comment])
  );
  const pending = context.pending.filter((op) => op.kind === 'comment');
  for (const op of pending)
    if (op.state === 'sent') {
      const comment = commentFromPayload(
        op.actor.name,
        op.identifier,
        op.payload as unknown as Record<string, unknown>,
        context.target
      );
      if (comment) comments.set(comment.id, { ...comment, pending: true });
    }
  const work = async (action: () => Promise<unknown>) => {
    if (busy.current || !context.enabled) return false;
    busy.current = true;
    request.current++;
    setState((previous) => ({
      ...previous,
      comments: previous.key === context.key ? previous.comments : [],
      key: context.key,
      busy: true,
      loading: false,
      error: '',
    }));
    try {
      await action();
      if (context.isCurrent())
        setState((previous) => ({
          ...previous,
          notice: 'Action sent. Other nodes may take time to show it.',
        }));
      return context.isCurrent();
    } catch (error) {
      if (context.isCurrent())
        setState((previous) => ({ ...previous, error: requestError(error) }));
      return false;
    } finally {
      if (context.isCurrent()) {
        busy.current = false;
        setState((previous) => ({ ...previous, busy: false }));
      }
    }
  };
  return {
    comments: [...comments.values()].sort((a, b) => b.created - a.created),
    isLoading: context.enabled && (!live || live.loading),
    error: context.storageError || live?.error || null,
    notice:
      live?.notice ||
      (pending.length
        ? 'Saved comment activity is waiting for propagation or checking.'
        : ''),
    isSubmittingComment: Boolean(live?.busy),
    isEditingComment: Boolean(live?.busy),
    addComment: (message: string, parentId?: string) =>
      work(() =>
        sendSocial(
          prepareSocial('comment', context.actor, context.target, {
            message: message.trim(),
            parentId,
          }),
          context.isCurrent
        )
      ),
    editComment: (comment: MediaComment, message: string) =>
      work(() =>
        changeComment(
          context.target,
          context.actor,
          comment,
          message,
          false,
          context.isCurrent
        )
      ),
    removeComment: (comment: MediaComment) =>
      work(() =>
        changeComment(
          context.target,
          context.actor,
          comment,
          '',
          true,
          context.isCurrent
        )
      ),
    refreshComments: () => load(true),
    canLoadMoreComments:
      !cursor.current.modernDone ||
      !cursor.current.legacyDone ||
      cursor.current.retry.length > 0,
    loadMoreComments: () => load(false),
    uncertain: pending.some((op) => op.state === 'uncertain'),
    retrySavedComment: () =>
      work(() => {
        const op = pending.find((item) => item.state === 'uncertain');
        if (!op) throw new Error('No saved action to retry.');
        return sendSocial(op, context.isCurrent, true);
      }),
  };
};
