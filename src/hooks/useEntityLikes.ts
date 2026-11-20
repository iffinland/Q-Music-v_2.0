import { useEffect, useRef, useState } from 'react';
import { fetchLikes, setLike, type LikesResult } from '../services/entityLikes';
import { requestError } from '../services/qdnRequests';
import { sendSocial, confirmSocial } from '../services/engagement/shared';
import { useSocialContext, type SocialParams } from './useSocialContext';
export const useEntityLikes = (params: SocialParams) => {
  const context = useSocialContext(params);
  const [state, setState] = useState<{
    key: string;
    data?: LikesResult;
    loading: boolean;
    error: string;
    busy: boolean;
    notice: string;
  }>({ key: '', loading: false, error: '', busy: false, notice: '' });
  const [tick, setTick] = useState(0),
    busy = useRef(false),
    request = useRef(0);
  useEffect(() => {
    const token = ++request.current,
      controller = new AbortController();
    busy.current = false;
    if (!context.enabled) return;
    setState((previous) => ({
      key: context.key,
      data: previous.key === context.key ? previous.data : undefined,
      loading: true,
      error: '',
      busy: false,
      notice: previous.key === context.key ? previous.notice : '',
    }));
    void fetchLikes(context.target, context.actor, {
      signal: controller.signal,
    })
      .then((data) => {
        if (token === request.current && context.isCurrent()) {
          setState((previous) => ({
            ...previous,
            data,
            loading: false,
            error: data.warning,
          }));
          for (const entry of data.confirmed || [])
            confirmSocial(
              context.actor,
              context.target,
              entry.identifier,
              entry.revision
            );
        }
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
            error: requestError(
              error,
              'Likes could not be loaded. Retry when the node is ready.'
            ),
          }));
      });
    return () => controller.abort();
    // A context key includes actor, resource owner, ID, type and enabled state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.key, tick]);
  const live = state.key === context.key && context.enabled ? state : undefined;
  const authors = { ...live?.data?.authors };
  const pending = context.pending.filter((op) => op.kind === 'like');
  const sent = pending.find((op) => op.state === 'sent');
  if (sent) authors[context.actor.name.toLowerCase()] = !sent.payload.deleted;
  const hasLike = Boolean(authors[context.actor.name.toLowerCase()]);
  const work = async (retry = false) => {
    if (busy.current || !context.enabled) return;
    busy.current = true;
    request.current++;
    setState((previous) => ({
      ...previous,
      key: context.key,
      busy: true,
      loading: false,
      error: '',
    }));
    try {
      const uncertain = pending.find((op) => op.state === 'uncertain');
      if (retry && uncertain)
        await sendSocial(uncertain, context.isCurrent, true);
      else
        await setLike(
          context.target,
          context.actor,
          !hasLike,
          context.isCurrent
        );
      if (context.isCurrent())
        setState((previous) => ({
          ...previous,
          notice: 'Action sent. It may take time to appear on other nodes.',
        }));
    } catch (error) {
      if (context.isCurrent())
        setState((previous) => ({ ...previous, error: requestError(error) }));
    } finally {
      if (context.isCurrent()) {
        busy.current = false;
        setState((previous) => ({ ...previous, busy: false }));
      }
    }
  };
  return {
    likeCount: live?.data
      ? Object.values(authors).filter(Boolean).length
      : undefined,
    hasLike,
    isLoading: context.enabled && (!live || live.loading),
    error: context.storageError || live?.error || null,
    notice:
      live?.notice ||
      (pending.length
        ? 'Your saved like action is waiting for propagation or checking.'
        : ''),
    isUpdatingLike: Boolean(live?.busy),
    canLike: Boolean(
      live?.data &&
        !live.loading &&
        !live.busy &&
        context.actor.address &&
        context.actor.name &&
        !context.storageError &&
        (!live.error || live.error === live.data.warning) &&
        !pending.some((op) => op.state === 'uncertain')
    ),
    partial: live?.data?.partial || false,
    uncertain: pending.some((op) => op.state === 'uncertain'),
    toggleLike: () => work(),
    retrySavedLike: () => work(true),
    refreshLikes: () => setTick((value) => value + 1),
  };
};
