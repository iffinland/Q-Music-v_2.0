import type { PlaylistSummary, SongSummary } from '../../types/media';
import { mediaKey } from '../../utils/mediaIdentity';
export interface LibraryAccount {
  key: string;
  address: string;
  name: string;
}
export const libraryAccount = (
  auth?: { address?: string | null; name?: string | null } | null
): LibraryAccount => {
  const address = auth?.address?.trim() || '',
    name = address ? auth?.name?.trim() || '' : '';
  return {
    address,
    name,
    key: address
      ? `account:${encodeURIComponent(address)}:${encodeURIComponent(name.toLowerCase())}`
      : 'guest',
  };
};
export type LibraryKind = 'song' | 'playlist' | 'recent';
export interface LibraryEntry {
  kind: LibraryKind;
  item: SongSummary | PlaylistSummary;
  removed: boolean;
  changedAt: number;
  changeId: string;
}
export interface RemoteLibraryState {
  favoriteSongs: SongSummary[];
  favoritePlaylists: PlaylistSummary[];
  recentSongs: SongSummary[];
  updatedAt: number;
  schema?: 2;
  owner?: { address: string; name: string };
  entries?: Record<string, LibraryEntry>;
}
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const normalizeSong = (value: unknown): SongSummary => {
  if (
    !object(value) ||
    !value.identifier ||
    !value.publisher ||
    typeof value.identifier !== 'string' ||
    typeof value.publisher !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.artist !== 'string'
  )
    throw new Error('The saved library contains an invalid song.');
  return {
    ...value,
    id: mediaKey('AUDIO', value.publisher, value.identifier),
    identifier: value.identifier,
    publisher: value.publisher,
    title: value.title,
    artist: value.artist,
    service: 'AUDIO',
    mediaType: 'SONG',
  } as SongSummary;
};
export const normalizePlaylist = (value: unknown): PlaylistSummary => {
  if (
    !object(value) ||
    !value.identifier ||
    !value.publisher ||
    typeof value.identifier !== 'string' ||
    typeof value.publisher !== 'string' ||
    typeof value.title !== 'string'
  )
    throw new Error('The saved library contains an invalid playlist.');
  return {
    ...value,
    id: mediaKey('PLAYLIST', value.publisher, value.identifier),
    identifier: value.identifier,
    publisher: value.publisher,
    title: value.title,
    songCount: typeof value.songCount === 'number' ? value.songCount : null,
  } as PlaylistSummary;
};
export const entryKey = (kind: LibraryKind, item: { id: string }) =>
  `${kind}:${item.id}`;
const later = (a: LibraryEntry, b: LibraryEntry) =>
  a.changedAt !== b.changedAt
    ? a.changedAt > b.changedAt
    : a.removed !== b.removed
      ? a.removed
      : a.changeId >= b.changeId;
export const materializeLibrary = (
  input: Record<string, LibraryEntry>
): RemoteLibraryState => {
  const entries = { ...input };
  const ordered = Object.values(entries).sort(
    (a, b) => b.changedAt - a.changedAt || b.changeId.localeCompare(a.changeId)
  );
  const recent = ordered
    .filter((entry) => entry.kind === 'recent' && !entry.removed)
    .slice(0, 12);
  const recentKeys = new Set(
    recent.map((entry) => entryKey('recent', entry.item))
  );
  for (const [key, entry] of Object.entries(entries))
    if (entry.kind === 'recent' && !recentKeys.has(key)) delete entries[key];
  return {
    schema: 2,
    entries,
    favoriteSongs: ordered
      .filter((entry) => entry.kind === 'song' && !entry.removed)
      .map((entry) => entry.item as SongSummary),
    favoritePlaylists: ordered
      .filter((entry) => entry.kind === 'playlist' && !entry.removed)
      .map((entry) => entry.item as PlaylistSummary),
    recentSongs: recent.map((entry) => entry.item as SongSummary),
    updatedAt: ordered.reduce(
      (max, entry) => Math.max(max, entry.changedAt),
      0
    ),
  };
};
export const emptyLibraryState = () => materializeLibrary({});
export const normalizeLibrary = (
  value: unknown,
  account?: LibraryAccount
): RemoteLibraryState => {
  if (
    !object(value) ||
    !Array.isArray(value.favoriteSongs) ||
    !Array.isArray(value.favoritePlaylists) ||
    !Array.isArray(value.recentSongs)
  )
    throw new Error(
      'The node returned an invalid library. Your local collection has been kept.'
    );
  const entries: Record<string, LibraryEntry> = {};
  if (value.schema !== undefined && value.schema !== 2)
    throw new Error('This library format is not supported.');
  if (value.schema === 2) {
    if (
      !object(value.entries) ||
      !object(value.owner) ||
      typeof value.owner.address !== 'string' ||
      typeof value.owner.name !== 'string'
    )
      throw new Error('The saved library is missing its account information.');
    if (
      account &&
      (value.owner.address !== account.address ||
        value.owner.name.toLowerCase() !== account.name.toLowerCase())
    )
      throw new Error(
        'This library belongs to a different account. It has not been merged or overwritten.'
      );
    for (const [key, raw] of Object.entries(value.entries)) {
      if (
        !object(raw) ||
        !['song', 'playlist', 'recent'].includes(String(raw.kind)) ||
        typeof raw.removed !== 'boolean' ||
        !Number.isSafeInteger(raw.changedAt) ||
        (raw.changedAt as number) < 0 ||
        typeof raw.changeId !== 'string'
      )
        throw new Error('The saved library has invalid change records.');
      const kind = raw.kind as LibraryKind,
        item =
          kind === 'playlist'
            ? normalizePlaylist(raw.item)
            : normalizeSong(raw.item);
      if (key !== entryKey(kind, item))
        throw new Error('The saved library has an invalid media identity.');
      entries[key] = {
        kind,
        item,
        removed: raw.removed,
        changedAt: raw.changedAt as number,
        changeId: raw.changeId,
      };
    }
  } else {
    for (const [kind, list] of [
      ['song', value.favoriteSongs],
      ['playlist', value.favoritePlaylists],
      ['recent', value.recentSongs],
    ] as const) {
      list.forEach((raw, index) => {
        const item =
            kind === 'playlist' ? normalizePlaylist(raw) : normalizeSong(raw),
          key = entryKey(kind, item);
        // Old snapshots contain no per-item edits. They must never outrank an
        // explicit removal, even if the snapshot itself has a newer timestamp.
        if (!entries[key])
          entries[key] = {
            kind,
            item,
            removed: false,
            changedAt: 0,
            changeId: `legacy:${String(list.length - index).padStart(8, '0')}:${key}`,
          };
      });
    }
  }
  return {
    ...materializeLibrary(entries),
    owner:
      value.schema === 2
        ? (value.owner as RemoteLibraryState['owner'])
        : undefined,
  };
};
export const mergeLibraryStates = (
  local: RemoteLibraryState,
  remote: RemoteLibraryState | null
): RemoteLibraryState => {
  const events = (state: RemoteLibraryState) =>
    state.entries || normalizeLibrary(state).entries!;
  const entries = { ...events(local) };
  if (remote)
    for (const [key, entry] of Object.entries(events(remote)))
      if (!entries[key] || !later(entries[key], entry)) entries[key] = entry;
  return materializeLibrary(entries);
};
export const libraryFingerprint = (state: RemoteLibraryState) =>
  JSON.stringify(
    Object.entries(state.entries || {}).sort(([a], [b]) => a.localeCompare(b))
  );
export const containsLibrary = (
  state: RemoteLibraryState,
  expected: RemoteLibraryState
) => {
  const recent = Object.values(state.entries || {}).filter(
    (entry) => entry.kind === 'recent' && !entry.removed
  );
  return Object.entries(expected.entries || {}).every(([key, entry]) => {
    if (state.entries?.[key]) return later(state.entries[key], entry);
    // Recent history is bounded: twelve later plays legitimately supersede an
    // old history row. Favorites/removals never expire this way.
    return (
      entry.kind === 'recent' &&
      recent.length === 12 &&
      recent.every((current) => later(current, entry))
    );
  });
};
export const libraryPayload = (
  state: RemoteLibraryState,
  account: LibraryAccount
) => ({
  ...state,
  schema: 2 as const,
  owner: { address: account.address, name: account.name },
});
