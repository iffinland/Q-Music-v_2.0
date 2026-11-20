import {
  emptyLibraryState,
  entryKey,
  libraryPayload,
  libraryFingerprint,
  materializeLibrary,
  mergeLibraryStates,
  normalizeLibrary,
  normalizePlaylist,
  normalizeSong,
  type LibraryAccount,
  type LibraryKind,
  type RemoteLibraryState,
} from './model';
import type { SongSummary, PlaylistSummary } from '../../types/media';
export type LibraryPhase =
  | 'local'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'sent'
  | 'uncertain'
  | 'error';
export interface LibraryAttempt {
  data: RemoteLibraryState;
  state: 'sending' | 'sent' | 'uncertain';
  signatures?: string[];
}
export interface LibrarySnapshot {
  data: RemoteLibraryState;
  phase: LibraryPhase;
  error: string;
  storageError: string;
  remoteKnown: boolean;
  remote: RemoteLibraryState | null;
  attempt?: LibraryAttempt;
}
const records = new Map<string, LibrarySnapshot>();
const listeners = new Set<() => void>();
const prefix = 'qmusic20.library.v2.';
export const libraryStorageKey = (account: LibraryAccount) =>
  prefix + account.key;
export const subscribeLibrary = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => listeners.forEach((listener) => listener());
const readDisk = (account: LibraryAccount) => {
  const raw = localStorage.getItem(libraryStorageKey(account));
  if (!raw) return null;
  const value = JSON.parse(raw);
  const data = normalizeLibrary(value.data, account);
  const attempt: LibraryAttempt | undefined = value.attempt
    ? {
        data: normalizeLibrary(value.attempt.data, account),
        state: value.attempt.state === 'sent' ? 'sent' : 'uncertain',
        signatures: Array.isArray(value.attempt.signatures)
          ? value.attempt.signatures.filter(
              (x: unknown) => typeof x === 'string'
            )
          : [],
      }
    : undefined;
  return { data, attempt, remoteKnown: value.remoteKnown === true };
};
export const getLibrarySnapshot = (
  account: LibraryAccount
): LibrarySnapshot => {
  let snapshot = records.get(account.key);
  if (!snapshot) {
    snapshot = {
      data: emptyLibraryState(),
      phase: 'local',
      error: '',
      storageError: '',
      remoteKnown: false,
      remote: null,
    };
    try {
      const stored = readDisk(account);
      if (stored) snapshot = { ...snapshot, ...stored };
    } catch {
      snapshot.storageError =
        'Saved data on this device could not be read. It has not been overwritten; new changes are in memory only.';
    }
    records.set(account.key, snapshot);
  }
  return snapshot;
};
export const updateLibrarySnapshot = (
  account: LibraryAccount,
  patch: Partial<LibrarySnapshot>,
  persist = false
) => {
  let next = { ...getLibrarySnapshot(account), ...patch };
  if (persist) {
    try {
      const stored = readDisk(account);
      if (stored)
        next = {
          ...next,
          data: mergeLibraryStates(next.data, stored.data),
          remoteKnown: next.remoteKnown || stored.remoteKnown,
          attempt: Object.prototype.hasOwnProperty.call(patch, 'attempt')
            ? next.attempt
            : stored.attempt,
        };
      localStorage.setItem(
        libraryStorageKey(account),
        JSON.stringify({
          data: libraryPayload(next.data, account),
          remoteKnown: next.remoteKnown,
          attempt: next.attempt
            ? {
                ...next.attempt,
                data: libraryPayload(next.attempt.data, account),
              }
            : undefined,
        })
      );
      next.storageError = '';
    } catch {
      next.storageError =
        'Changes could not be saved on this device. Keep this window open and retry after freeing storage. Existing saved data has been kept.';
    }
  }
  records.set(account.key, next);
  notify();
  return next;
};
export const refreshLocalLibrary = (
  account: LibraryAccount
): LibrarySnapshot => {
  const state = getLibrarySnapshot(account);
  try {
    const stored = readDisk(account);
    if (stored)
      return updateLibrarySnapshot(account, {
        data: mergeLibraryStates(state.data, stored.data),
        attempt: stored.attempt,
        remoteKnown: state.remoteKnown || stored.remoteKnown,
      });
  } catch {
    /* Keep original bytes intact. Persistence reports the error. */
  }
  return state;
};
export const changeLibrary = (
  account: LibraryAccount,
  kind: LibraryKind,
  input: SongSummary | PlaylistSummary,
  remove?: boolean
) => {
  const item =
    kind === 'playlist' ? normalizePlaylist(input) : normalizeSong(input);
  let data = getLibrarySnapshot(account).data;
  try {
    const stored = readDisk(account);
    if (stored) data = mergeLibraryStates(data, stored.data);
  } catch {
    /* Keep unreadable disk bytes intact; update reports the error. */
  }
  const entries = { ...data.entries },
    key = entryKey(kind, item);
  const removed =
    remove ??
    (kind !== 'recent' && Boolean(entries[key] && !entries[key].removed));
  const changedAt = Math.max(
    Date.now(),
    ...Object.values(entries).map((entry) => entry.changedAt + 1)
  );
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  entries[key] = {
    kind,
    item,
    removed,
    changedAt,
    changeId: Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join(
      ''
    ),
  };
  updateLibrarySnapshot(account, { data: materializeLibrary(entries) }, true);
  return !removed;
};
export const importLibraryItems = (
  account: LibraryAccount,
  items: { songs: SongSummary[]; playlists: PlaylistSummary[] }
) => {
  // Explicitly selected legacy favorites only. History is not guessed or assigned.
  for (const song of items.songs) changeLibrary(account, 'song', song, false);
  for (const playlist of items.playlists)
    changeLibrary(account, 'playlist', playlist, false);
};
export const readLegacyLibrary = (): RemoteLibraryState | null => {
  try {
    const raw = [
      'qmusic20.favoriteSongs',
      'qmusic20.favoritePlaylists',
      'qmusic20.recentSongs',
    ].map((key) => localStorage.getItem(key));
    if (!raw.some(Boolean)) return null;
    return normalizeLibrary({
      favoriteSongs: JSON.parse(raw[0] || '[]'),
      favoritePlaylists: JSON.parse(raw[1] || '[]'),
      recentSongs: JSON.parse(raw[2] || '[]'),
      updatedAt: 0,
    });
  } catch {
    return null;
  }
};
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith(prefix) || !event.newValue) return;
    const key = event.key.slice(prefix.length),
      current = records.get(key);
    if (!current) return;
    try {
      const value = JSON.parse(event.newValue);
      const owner = value.data?.owner;
      if (
        !owner ||
        typeof owner.address !== 'string' ||
        typeof owner.name !== 'string'
      )
        return;
      const account = {
        address: owner.address,
        name: owner.name,
        key: owner.address
          ? `account:${encodeURIComponent(owner.address)}:${encodeURIComponent(owner.name.toLowerCase())}`
          : 'guest',
      };
      if (account.key !== key) return;
      const remote = normalizeLibrary(value.data, account);
      const entries = mergeLibraryStates(current.data, remote);
      updateLibrarySnapshot(
        account,
        { data: entries },
        libraryFingerprint(entries) !== libraryFingerprint(remote)
      );
    } catch {
      /* A bad tab write must not erase the collection in memory. */
    }
  });
