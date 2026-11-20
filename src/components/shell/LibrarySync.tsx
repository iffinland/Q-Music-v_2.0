import { useEffect, useMemo } from 'react';
import { useGlobal } from '../../qortal';
import { libraryAccount } from '../../services/library/model';
import { activateLibrary } from '../../services/library/sync';
export const LibrarySync = () => {
  const { auth } = useGlobal();
  const account = useMemo(
    () => libraryAccount({ address: auth?.address, name: auth?.name }),
    [auth?.address, auth?.name]
  );
  useEffect(() => activateLibrary(account), [account]);
  return null;
};
