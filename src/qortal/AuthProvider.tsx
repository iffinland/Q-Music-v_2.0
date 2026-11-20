import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';
import {
  refreshAccount,
  refreshAccountOnReturn,
  noticeSnapshot,
  subscribeNotice,
  dismissNotice,
} from './store';
const Notifications = () => {
  const notice = useSyncExternalStore(subscribeNotice, noticeSnapshot);
  return (
    <Snackbar
      key={notice?.id}
      open={Boolean(notice)}
      autoHideDuration={6000}
      onClose={dismissNotice}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ zIndex: 1800 }}
    >
      {notice ? (
        <Alert severity={notice.severity} onClose={dismissNotice}>
          {notice.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
};
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void refreshAccount();
    window.addEventListener('focus', refreshAccountOnReturn);
    document.addEventListener('visibilitychange', refreshAccountOnReturn);
    return () => {
      window.removeEventListener('focus', refreshAccountOnReturn);
      document.removeEventListener('visibilitychange', refreshAccountOnReturn);
    };
  }, []);
  return (
    <>
      {children}
      <Notifications />
    </>
  );
};
