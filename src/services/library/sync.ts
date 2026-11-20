import { publishAuxiliary } from '../publishing/engine';
import { jsonBase64, utf8Bytes } from '../publishing/content';
import { requestError } from '../qdnRequests';
import { getLibraryMetadata, loadRemoteLibrary } from '../library';
import {
  containsLibrary,
  libraryFingerprint,
  libraryPayload,
  mergeLibraryStates,
  type LibraryAccount,
  type RemoteLibraryState,
} from './model';
import {
  getLibrarySnapshot,
  refreshLocalLibrary,
  updateLibrarySnapshot,
  type LibraryPhase,
} from './store';
class LibraryAlreadySynced extends Error {}
let active = '',
  epoch = 0;
let readController: AbortController | undefined;
let reading: Promise<void> | undefined;
let saving: Promise<void> | undefined;
const canSync = (account: LibraryAccount) =>
  Boolean(account.address && account.name);
const isActive = (account: LibraryAccount, token: number) =>
  active === account.key && token === epoch;
const assertActive = (account: LibraryAccount, token: number) => {
  if (!isActive(account, token))
    throw new Error('Library sync paused because the account changed.');
};
const phaseAfterRead = (
  account: LibraryAccount,
  remote: RemoteLibraryState | null
): LibraryPhase => {
  const state = getLibrarySnapshot(account);
  if (
    state.attempt &&
    (!remote || !containsLibrary(remote, state.attempt.data))
  )
    return state.attempt.state === 'sent' ? 'sent' : 'uncertain';
  return 'ready';
};
const receive = (
  account: LibraryAccount,
  remote: RemoteLibraryState | null
) => {
  const state = refreshLocalLibrary(account);
  if (!remote && state.remoteKnown)
    throw new Error(
      'This node cannot see your previously saved library. Retry or switch to a synchronized node; your collection has not been overwritten.'
    );
  const confirmed = Boolean(
    remote && state.attempt && containsLibrary(remote, state.attempt.data)
  );
  updateLibrarySnapshot(
    account,
    {
      data: mergeLibraryStates(state.data, remote),
      remote,
      remoteKnown: state.remoteKnown || Boolean(remote),
      attempt: confirmed ? undefined : state.attempt,
      error: '',
    },
    true
  );
  updateLibrarySnapshot(account, { phase: phaseAfterRead(account, remote) });
};
export const refreshLibrary = (account: LibraryAccount): Promise<void> => {
  if (!canSync(account) || active !== account.key) return Promise.resolve();
  if (saving) return Promise.resolve();
  if (reading) return reading;
  const token = epoch,
    controller = new AbortController();
  readController = controller;
  updateLibrarySnapshot(account, { phase: 'loading', error: '' });
  const task = Promise.resolve().then(async () => {
    try {
      const remote = await loadRemoteLibrary(account, controller.signal);
      if (!isActive(account, token)) return;
      receive(account, remote);
    } catch (error) {
      if (isActive(account, token) && !controller.signal.aborted)
        updateLibrarySnapshot(account, {
          phase: 'error',
          error: requestError(
            error,
            'Your online library could not be loaded. Local changes have been kept.'
          ),
        });
    } finally {
      if (reading === task) reading = undefined;
    }
  });
  reading = task;
  return task;
};
export const activateLibrary = (account: LibraryAccount) => {
  active = account.key;
  const token = ++epoch;
  readController?.abort();
  reading = undefined;
  getLibrarySnapshot(account);
  if (canSync(account)) {
    updateLibrarySnapshot(account, { phase: 'loading', error: '' });
    if (saving)
      void saving.finally(() => {
        if (isActive(account, token)) void refreshLibrary(account);
      });
    else void refreshLibrary(account);
  }
  return () => {
    if (isActive(account, token)) {
      active = '';
      epoch++;
      readController?.abort();
      reading = undefined;
    }
  };
};
export const saveLibraryToQdn = (
  account: LibraryAccount,
  allowResend = false
): Promise<void> => {
  if (saving) return saving;
  const token = epoch;
  let submitted: RemoteLibraryState | undefined;
  const task = Promise.resolve().then(async () => {
    try {
      assertActive(account, token);
      if (!canSync(account))
        throw new Error(
          'Log in with a Qortal name to save your library online.'
        );
      if (reading)
        throw new Error('Wait for the online library check to finish.');
      updateLibrarySnapshot(account, { phase: 'saving', error: '' });
      const resource = {
        ...getLibraryMetadata(account.name),
        title: 'Q-Music Library',
        description: 'Saved songs, playlists and recent audio history',
        data64: '',
      };
      // Preflight runs inside the shared publish lock, not while this save waits
      // behind an audio publication. The account is rechecked before the send.
      const receipts = await publishAuxiliary([resource], async () => {
        assertActive(account, token);
        const wallet = (await qortalRequestWithTimeout(
          { action: 'GET_USER_ACCOUNT' } as never,
          15_000
        )) as { address?: string };
        assertActive(account, token);
        if (wallet?.address !== account.address)
          throw new Error('The active wallet changed. No library was sent.');
        const remote = await loadRemoteLibrary(account);
        assertActive(account, token);
        receive(account, remote);
        const state = getLibrarySnapshot(account);
        if (
          remote &&
          libraryFingerprint(state.data) === libraryFingerprint(remote)
        )
          throw new LibraryAlreadySynced();
        if (state.storageError)
          throw new Error(
            'The library cannot be saved safely on this device. Resolve the local storage error before sending.'
          );
        if (
          state.attempt &&
          !allowResend &&
          libraryFingerprint(state.attempt.data) ===
            libraryFingerprint(state.data)
        )
          throw new Error(
            'The previous save may still complete. Check sync first, or explicitly confirm sending it again.'
          );
        if (state.attempt && state.attempt.state !== 'sent' && !allowResend)
          throw new Error(
            'An earlier save has an uncertain result. Check sync or explicitly confirm sending again.'
          );
        resource.data64 = jsonBase64(libraryPayload(state.data, account));
        if (
          utf8Bytes(JSON.stringify(libraryPayload(state.data, account)))
            .length >
          2 * 1024 * 1024
        )
          throw new Error(
            'The library is too large to save online (2 MiB). Your collection remains on this device.'
          );
        submitted = state.data;
        const saved = updateLibrarySnapshot(
          account,
          { phase: 'saving', attempt: { data: submitted, state: 'sending' } },
          true
        );
        if (saved.storageError) {
          submitted = undefined;
          throw new Error(saved.storageError);
        }
        assertActive(account, token);
      });
      if (submitted) {
        updateLibrarySnapshot(
          account,
          {
            attempt: {
              data: submitted,
              state: 'sent',
              signatures: receipts.map((item) => item.signature),
            },
            phase: 'sent',
            error: '',
          },
          true
        );
      }
    } catch (error) {
      if (error instanceof LibraryAlreadySynced) {
        updateLibrarySnapshot(account, { phase: 'ready', error: '' });
        return;
      }
      const message = requestError(
        error,
        'Library sync failed. Local changes have been kept.'
      );
      const declined = /declin|reject.*user|user.*reject|cancel/i.test(message);
      if (submitted)
        updateLibrarySnapshot(
          account,
          {
            attempt: declined
              ? undefined
              : { data: submitted, state: 'uncertain' },
            phase: declined ? 'ready' : 'uncertain',
            error: message,
          },
          true
        );
      else updateLibrarySnapshot(account, { phase: 'error', error: message });
    } finally {
      if (saving === task) saving = undefined;
    }
  });
  saving = task;
  return task;
};
