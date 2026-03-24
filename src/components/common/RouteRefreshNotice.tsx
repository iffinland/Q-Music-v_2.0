import { Alert, Button, Stack, Typography } from '@mui/material';
import { useRouteError } from 'react-router-dom';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return '';
};

export const RouteRefreshNotice = () => {
  const routeError = useRouteError();
  const message = getErrorMessage(routeError);
  const isDynamicImportIssue =
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message);

  return (
    <Stack
      spacing={2.5}
      sx={{
        minHeight: '100vh',
        px: 2,
        py: 5,
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--qm-shell-bg)',
      }}
    >
      <Stack
        spacing={2}
        sx={{
          width: '100%',
          maxWidth: 560,
          p: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'var(--qm-panel-bg)',
          boxShadow: 'var(--qm-shadow-soft)',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Refresh Needed
        </Typography>
        <Alert severity="info">
          {isDynamicImportIssue
            ? 'A new app version is available. Please refresh the page.'
            : 'This page needs to be refreshed before it can continue.'}
        </Alert>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          This can happen right after the app has been updated and your browser
          is still using older page files.
        </Typography>
        <Button
          variant="contained"
          onClick={() => window.location.reload()}
          sx={{ alignSelf: 'flex-start' }}
        >
          Refresh page
        </Button>
      </Stack>
    </Stack>
  );
};
