import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface SectionCardProps {
  kicker?: ReactNode;
  title: ReactNode;
  body: ReactNode;
  meta?: string[];
  action?: ReactNode;
  media?: ReactNode;
}

export const SectionCard = ({
  kicker,
  title,
  body,
  meta = [],
  action,
  media,
}: SectionCardProps) => {
  return (
    <Box
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2.75,
        background: 'var(--qm-panel-bg)',
        boxShadow: 'var(--qm-shadow-soft)',
        transition:
          'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: 'var(--qm-border-strong)',
          boxShadow: 'var(--qm-shadow-strong)',
        },
      }}
    >
      <Stack spacing={1.4} sx={{ height: '100%' }}>
        {media ? <Box sx={{ mb: 0.25 }}>{media}</Box> : null}
        {kicker ? (
          <Typography
            variant="overline"
            sx={{
              color: 'primary.light',
              fontWeight: 800,
              letterSpacing: '0.14em',
            }}
          >
            {kicker}
          </Typography>
        ) : null}
        <Typography variant="h5" sx={{ lineHeight: 1.08 }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            flexGrow: 1,
            lineHeight: 1.62,
            whiteSpace: 'pre-line',
          }}
        >
          {body}
        </Typography>
        {meta.length ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {meta.map((item, index) => (
              <Chip
                key={item}
                label={item}
                size="small"
                variant={index === 0 ? 'filled' : 'outlined'}
                color={index === 0 ? 'primary' : 'default'}
                sx={
                  index === 0
                    ? {
                        fontWeight: 700,
                        '& .MuiChip-label': {
                          px: 1.15,
                        },
                      }
                    : undefined
                }
              />
            ))}
          </Stack>
        ) : null}
        {action}
      </Stack>
    </Box>
  );
};
