import {
  hashBytes,
  utf8Bytes,
  randomPublishId,
  jsonBase64,
  limitUtf8,
} from '../publishing/content';
import { publishAuxiliary } from '../publishing/engine';
import { requestError } from '../qdnRequests';
import { mediaKey } from '../../utils/mediaIdentity';
import { buildEntityKey } from '../entityEngagementShared';
export interface Target {
  entityType: 'song' | 'playlist';
  entityPublisher: string;
  entityId: string;
}
export interface Actor {
  name: string;
  address: string;
}
export interface SocialPayload extends Target {
  schema: 1;
  revision: string;
  deleted: boolean;
  author: string;
  message?: string;
  created: number;
  updated: number;
  parentId?: string;
}
export interface PendingSocial {
  identifier: string;
  kind: 'like' | 'comment';
  actor: Actor;
  target: Target;
  payload: SocialPayload;
  state: 'sending' | 'sent' | 'uncertain';
  signature?: string;
}
export const targetKey = (target: Target) =>
  JSON.stringify([
    target.entityType,
    target.entityPublisher.toLowerCase(),
    target.entityId,
  ]);
export const targetHash = (target: Target) =>
  hashBytes(utf8Bytes(targetKey(target))).slice(0, 32);
export const likeId = (target: Target) =>
  `qm_social_like_${target.entityType === 'song' ? 's' : 'p'}_${targetHash(target)}`;
export const commentPrefix = (target: Target) =>
  `qm_social_c_${target.entityType === 'song' ? 's' : 'p'}_${targetHash(target)}_`;
export const legacyLikeId = (target: Target) =>
  `${target.entityType}_like_${buildEntityKey(target.entityId)}`;
export const legacyCommentPrefix = (target: Target) =>
  `enjoymusic_${target.entityType}_comment_${buildEntityKey(target.entityId)}_`;
export const sameTarget = (payload: Partial<Target>, target: Target) =>
  payload.entityType === target.entityType &&
  payload.entityId === target.entityId &&
  payload.entityPublisher?.toLowerCase() ===
    target.entityPublisher.toLowerCase();
export const socialId = (name: string, identifier: string) =>
  mediaKey('DOCUMENT', name, identifier);
const allowedIdentifier = (
  kind: 'like' | 'comment',
  identifier: string,
  target: Target
) => {
  if (kind === 'like') return identifier === likeId(target);
  return (
    utf8Bytes(identifier).length <= 64 &&
    [commentPrefix(target), legacyCommentPrefix(target)].some(
      (prefix) =>
        identifier.startsWith(prefix) &&
        /^[a-z0-9]{8,16}$/.test(identifier.slice(prefix.length))
    )
  );
};
const storageKey = (actor: Actor, target: Target) =>
  `qmusic20.social.v1.${encodeURIComponent(actor.address)}.${encodeURIComponent(actor.name.toLowerCase())}.${targetHash(target)}`;
let version = 0;
const listeners = new Set<() => void>(),
  running = new Set<string>();
export const subscribeSocial = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const socialVersion = () => version;
const emit = () => {
  version++;
  listeners.forEach((listener) => listener());
};
export const pendingSocial = (
  actor: Actor,
  target: Target
): PendingSocial[] => {
  const raw = localStorage.getItem(storageKey(actor, target));
  if (!raw) return [];
  const records = JSON.parse(raw) as PendingSocial[];
  if (
    !Array.isArray(records) ||
    records.some(
      (op) =>
        !op ||
        !op.payload ||
        !sameTarget(op.target, target) ||
        !sameTarget(op.payload, target) ||
        op.actor?.address !== actor.address ||
        op.actor.name.toLowerCase() !== actor.name.toLowerCase() ||
        typeof op.identifier !== 'string' ||
        !allowedIdentifier(op.kind, op.identifier, target) ||
        op.payload.schema !== 1 ||
        typeof op.payload.deleted !== 'boolean' ||
        !/^[a-f0-9]{32}$/.test(op.payload.revision) ||
        op.payload.author.toLowerCase() !== actor.name.toLowerCase() ||
        !['like', 'comment'].includes(op.kind) ||
        !['sending', 'sent', 'uncertain'].includes(op.state)
    )
  )
    throw new Error(
      'Saved social activity could not be read. It has not been overwritten.'
    );
  return records.map((op) => ({
    ...op,
    state:
      op.state === 'sending' &&
      !running.has(socialId(op.actor.name, op.identifier))
        ? 'uncertain'
        : op.state,
  }));
};
const put = (
  op: PendingSocial | null,
  actor: Actor,
  target: Target,
  identifier: string
) => {
  const entries = pendingSocial(actor, target).filter(
    (item) => item.identifier !== identifier
  );
  if (op) entries.push(op);
  localStorage.setItem(storageKey(actor, target), JSON.stringify(entries));
  emit();
};
export const confirmSocial = (
  actor: Actor,
  target: Target,
  identifier: string,
  revision: string
) => {
  const op = pendingSocial(actor, target).find(
    (item) => item.identifier === identifier
  );
  if (op?.payload.revision === revision && op.state !== 'sending')
    put(null, actor, target, identifier);
};
export const validateMessage = (message: string) => {
  if (!message.trim()) throw new Error('Comment cannot be empty.');
  if (utf8Bytes(message).length > 8192)
    throw new Error('Keep the comment below 8 KiB.');
};
export const sendSocial = async (
  op: PendingSocial,
  isCurrent: () => boolean,
  retry = false
) => {
  if (!allowedIdentifier(op.kind, op.identifier, op.target))
    throw new Error('The action identifier does not match this page.');
  const key = socialId(op.actor.name, op.identifier);
  if (running.has(key))
    throw new Error('This action is already waiting for Hub.');
  const old = pendingSocial(op.actor, op.target).find(
    (item) => item.identifier === op.identifier
  );
  if (old?.state === 'uncertain' && !retry)
    throw new Error(
      'The previous action may still complete. Refresh first or explicitly retry the saved action.'
    );
  if (
    old?.state === 'sent' &&
    JSON.stringify(old.payload) === JSON.stringify(op.payload)
  )
    return old;
  running.add(key);
  let sent = false;
  try {
    if (!isCurrent())
      throw new Error('The account or page changed. No action was sent.');
    const prepared = { ...op, state: 'sending' as const };
    put(prepared, op.actor, op.target, op.identifier);
    const receipts = await publishAuxiliary(
      [
        {
          name: op.actor.name,
          service: 'DOCUMENT',
          identifier: op.identifier,
          title: limitUtf8(
            `${op.payload.deleted ? 'Removed ' : ''}${op.kind === 'like' ? 'Q-Music like' : 'Q-Music comment'}`,
            80
          ),
          description: `qm-social:1:${op.kind}:${op.payload.deleted ? '0' : '1'}:${op.payload.revision}`,
          data64: jsonBase64(op.payload),
        },
      ],
      async () => {
        if (!isCurrent())
          throw new Error('The account or page changed. No action was sent.');
        const wallet = (await qortalRequestWithTimeout(
          { action: 'GET_USER_ACCOUNT' } as never,
          15_000
        )) as { address?: string };
        if (!isCurrent() || wallet?.address !== op.actor.address)
          throw new Error('The active wallet changed. No action was sent.');
        sent = true;
      },
      5 * 60_000
    );
    const done = {
      ...op,
      state: 'sent' as const,
      signature: receipts[0].signature,
    };
    put(done, op.actor, op.target, op.identifier);
    return done;
  } catch (error) {
    const message = requestError(
      error,
      'The action did not return a transaction receipt.'
    );
    if (sent && !/declin|cancel|reject.*user|user.*reject/i.test(message)) {
      put({ ...op, state: 'uncertain' }, op.actor, op.target, op.identifier);
      throw new Error(
        `${message} The saved action may still complete. Refresh before retrying.`
      );
    }
    if (retry && old) put(old, op.actor, op.target, op.identifier);
    else put(null, op.actor, op.target, op.identifier);
    throw new Error(message);
  } finally {
    running.delete(key);
    emit();
  }
};
export const prepareSocial = (
  kind: PendingSocial['kind'],
  actor: Actor,
  target: Target,
  options: {
    identifier?: string;
    message?: string;
    parentId?: string;
    created?: number;
    deleted?: boolean;
  }
): PendingSocial => {
  if (!target.entityId || !target.entityPublisher)
    throw new Error('Open a song or playlist before posting activity.');
  if (!actor.address || !actor.name)
    throw new Error('Log in with a Qortal name to use social activity.');
  if (kind === 'comment' && !options.deleted)
    validateMessage(options.message || '');
  const pending = pendingSocial(actor, target);
  const uncertain = pending.find(
    (op) => op.kind === kind && op.state === 'uncertain'
  );
  if (uncertain)
    throw new Error(
      'A previous action has an uncertain result. Refresh or retry the saved action first.'
    );
  const duplicate =
    kind === 'comment' && !options.identifier
      ? pending.find(
          (op) =>
            op.kind === kind &&
            op.payload.message === options.message &&
            op.payload.parentId === options.parentId &&
            !op.payload.deleted
        )
      : undefined;
  if (duplicate) return duplicate;
  const timestamp = Date.now();
  return {
    identifier:
      options.identifier ||
      (kind === 'like'
        ? likeId(target)
        : commentPrefix(target) + randomPublishId().slice(0, 12)),
    kind,
    actor,
    target,
    state: 'sending',
    payload: {
      ...target,
      schema: 1,
      revision: randomPublishId(),
      author: actor.name,
      deleted: options.deleted || false,
      message: options.deleted ? '' : options.message,
      parentId: options.parentId,
      created: options.created ?? timestamp,
      updated: timestamp,
    },
  };
};
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key?.startsWith('qmusic20.social.v1.')) emit();
  });
