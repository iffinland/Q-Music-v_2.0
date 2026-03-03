import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PageHero } from '../components/common/PageHero';

export const NotFoundPage = () => {
  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow="NOT FOUND"
        title="That page could not be found."
        description="Use the main navigation to jump back to songs, playlists, library or publishing."
      />
      <Typography variant="body1">
        The requested route is missing or the link is outdated.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Back to Home
      </Button>
    </Stack>
  );
};
