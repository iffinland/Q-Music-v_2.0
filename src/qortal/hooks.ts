import { useSyncExternalStore } from 'react';
import {
  accountSnapshot,
  subscribeAccount,
  refreshAccount,
  balanceSnapshot,
  subscribeBalance,
  getBalance,
} from './store';
export const useGlobal = () => ({
  auth: {
    ...useSyncExternalStore(subscribeAccount, accountSnapshot),
    authenticateUser: refreshAccount,
  },
});
export const useQortBalance = () => {
  useSyncExternalStore(subscribeAccount, accountSnapshot);
  return {
    ...useSyncExternalStore(subscribeBalance, balanceSnapshot),
    getBalance,
  };
};
