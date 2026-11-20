import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useGlobal } from '../qortal';
import {
  pendingSocial,
  socialVersion,
  subscribeSocial,
  targetKey,
  type Target,
  type Actor,
} from '../services/engagement/shared';
export interface SocialParams {
  entityType: 'song' | 'playlist';
  entityId?: string;
  entityPublisher?: string;
  title?: string;
  enabled?: boolean;
}
export const useSocialContext = (params: SocialParams) => {
  const { auth } = useGlobal();
  const actor: Actor = { name: auth?.name || '', address: auth?.address || '' };
  const target: Target = {
    entityType: params.entityType,
    entityId: params.entityId || '',
    entityPublisher: params.entityPublisher || '',
  };
  const key = `${actor.address}:${actor.name.toLowerCase()}:${targetKey(target)}:${Boolean(params.enabled)}`;
  const current = useRef(key);
  current.current = key;
  useEffect(() => {
    current.current = key;
    return () => {
      if (current.current === key) current.current = '';
    };
  }, [key]);
  useSyncExternalStore(subscribeSocial, socialVersion);
  let pending: ReturnType<typeof pendingSocial> = [],
    storageError = '';
  try {
    if (actor.address && actor.name) pending = pendingSocial(actor, target);
  } catch {
    storageError =
      'Saved social activity could not be read. Retry after checking device storage; nothing has been overwritten.';
  }
  return {
    actor,
    target,
    key,
    pending,
    storageError,
    enabled: Boolean(
      params.enabled && target.entityId && target.entityPublisher
    ),
    isCurrent: () => current.current === key,
  };
};
