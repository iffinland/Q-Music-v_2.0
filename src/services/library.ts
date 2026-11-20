import {
  fetchQdnResource,
  findExactQdnResource,
  getQdnResourceStatus,
  waitForQdnResourceReady,
} from './qdn';
import {
  normalizeLibrary,
  type LibraryAccount,
  type RemoteLibraryState,
} from './library/model';
export { mergeLibraryStates, type RemoteLibraryState } from './library/model';
export const getLibraryMetadata = (publisher: string) => ({
  name: publisher,
  service: 'DOCUMENT' as const,
  identifier: 'enjoymusic_library_state',
});
export const loadRemoteLibrary = async (
  account: LibraryAccount,
  signal?: AbortSignal
): Promise<RemoteLibraryState | null> => {
  const params = getLibraryMetadata(account.name),
    options = { fresh: true, signal, priority: 'background' as const };
  const exact = await findExactQdnResource(
    params.service,
    params.name,
    params.identifier,
    options
  );
  if (!exact) {
    const status = await getQdnResourceStatus(params, options);
    if (status.status === 'NOT_PUBLISHED') return null;
    // Search indexes can lag. Read the exact resource if the node knows it.
  }
  const status = await waitForQdnResourceReady({
    ...params,
    signal,
    priority: 'background',
    timeoutMs: 20_000,
  });
  if (status.status !== 'READY')
    throw new Error(
      `Your online library is not available yet (${status.status}). Your local collection has been kept. Retry when the node is ready.`
    );
  const payload = await fetchQdnResource<unknown>(params, options);
  return normalizeLibrary(payload, account);
};
