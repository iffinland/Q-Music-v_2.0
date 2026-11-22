import {
  Box,
  Button,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { skinAtom } from '../../state/appearance';
import { Link } from 'react-router-dom';

export const MediaGrid = ({
  children,
  kind = 'song',
  classicColumns,
}: {
  children: ReactNode;
  kind?: 'song' | 'playlist';
  classicColumns?: number;
}) => {
  const skin = useAtomValue(skinAtom);
  const columns = classicColumns ?? (kind === 'song' ? 2 : 3);
  return (
    <Box sx={{ containerType: 'inline-size' }}>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2 },
          ...(skin === 'classic'
            ? {
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  md: `repeat(${columns}, minmax(0, 1fr))`,
                },
              }
            : {
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                '@container (max-width: 319px)': {
                  gridTemplateColumns: 'minmax(0, 1fr)',
                },
                '@container (min-width: 630px)': {
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                },
                '@container (min-width: 860px)': {
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                },
                '@container (min-width: 1100px)': {
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                },
              }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
export const CardSkeletons = ({ count = 5 }: { count?: number }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <Skeleton key={i} variant="rounded" height={360} />
    ))}
  </>
);

export const MediaRail = ({
  title,
  to,
  children,
}: {
  title: string;
  to: string;
  children: ReactNode;
}) => (
  <Box component="section" aria-label={title} sx={{ minWidth: 0 }}>
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ mb: 1.5 }}
    >
      <Typography component="h2" variant="h3" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Button component={Link} to={to} size="small" sx={{ flexShrink: 0 }}>
        View all
      </Button>
    </Stack>
    <Box
      role="region"
      aria-label={`Scroll ${title.toLowerCase()}`}
      tabIndex={0}
      sx={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: { xs: 'min(72vw, 220px)', sm: '220px' },
        gap: 2,
        overflowX: 'auto',
        overscrollBehaviorX: 'contain',
        pb: 1.5,
        scrollbarWidth: 'auto',
        scrollbarColor: 'var(--qm-primary) var(--qm-scrollbar-track)',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 3,
        },
        '&::-webkit-scrollbar': { height: 10 },
        '&::-webkit-scrollbar-track': {
          bgcolor: 'var(--qm-scrollbar-track)',
          borderRadius: 99,
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'var(--qm-scrollbar-thumb)',
          borderRadius: 99,
        },
      }}
    >
      {children}
    </Box>
  </Box>
);

export const MediaPagination = ({
  page,
  pages,
  more,
  busy,
  onChange,
  label = 'Music pages',
}: {
  page: number;
  pages: number;
  more: boolean;
  busy: boolean;
  onChange: (page: number) => void;
  label?: string;
}) => (
  <Stack spacing={1} alignItems="center" sx={{ pt: 2 }}>
    <Pagination
      aria-label={label}
      page={page}
      count={Math.max(1, pages + (more ? 1 : 0))}
      siblingCount={0}
      boundaryCount={1}
      color="primary"
      disabled={busy}
      onChange={(_, value) => onChange(value)}
      sx={{
        '& .MuiPagination-ul': {
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 0.5,
        },
      }}
    />
    <Typography variant="caption" color="text.secondary">
      Page {page}
      {more ? ' · More pages load as you browse' : ''}
    </Typography>
  </Stack>
);
