import { Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export const PageHero = ({
  eyebrow,
  title,
  description,
  actions,
}: PageHeroProps) => {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 4,
        px: { xs: 2.5, md: 4 },
        py: { xs: 3, md: 3.75 },
        background: 'var(--qm-hero-bg)',
        boxShadow: 'var(--qm-shadow-strong)',
      }}
    >
      <Stack spacing={2}>
        <Typography
          variant="overline"
          sx={{
            letterSpacing: '0.22em',
            color: 'primary.light',
            fontWeight: 800,
          }}
        >
          {eyebrow}
        </Typography>
        <Typography variant="h2" sx={{ maxWidth: 820 }}>
          {title}
        </Typography>
        <Typography
          variant="body1"
          sx={{ maxWidth: 760, color: 'text.secondary' }}
        >
          {description}
        </Typography>
        {actions ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            useFlexGap
            flexWrap="wrap"
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
};

export const HeroButton = Button;
