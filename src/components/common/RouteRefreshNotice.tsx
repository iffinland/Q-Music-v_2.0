import { describeRouteError } from '../../utils/routeErrors';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useNavigate, useRouteError } from 'react-router-dom';
export const RouteRefreshNotice = ({
  compact = false,
}: {
  compact?: boolean;
}) => {
  const info = describeRouteError(useRouteError()),
    navigate = useNavigate();
  return (
    <Stack
      spacing={2}
      sx={{
        minHeight: compact ? 280 : '100vh',
        p: { xs: 2, sm: 4 },
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--qm-shell-bg)',
        minWidth: 0,
      }}
    >
      <Stack
        spacing={2}
        sx={{
          maxWidth: 560,
          width: '100%',
          p: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflowWrap: 'anywhere',
        }}
      >
        <Typography variant="h4">{info.title}</Typography>
        <Alert severity="warning">{info.text}</Alert>
        <Button
          variant="contained"
          onClick={() => navigate('/songs', { replace: true })}
        >
          Back to music
        </Button>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Reload app
        </Button>
        {info.message && (
          <details>
            <summary>Error details</summary>
            <Typography variant="body2">{info.message}</Typography>
          </details>
        )}
      </Stack>
    </Stack>
  );
};
