import { Box, Stack, Typography } from '@mui/material';
import { useRef, useState, type ReactNode } from 'react';
import type { PlaylistSummary, SongSummary } from '../../types/media';
import { MediaCard } from './MediaCard';
import { CardSkeletons, MediaGrid, MediaPagination } from './MediaCollection';

interface Props<T> {
  title: string;
  kind: 'song' | 'playlist';
  items: T[];
  emptyText: string;
  onPlay: (item: T, visibleItems: T[]) => void;
  actions?: (item: T) => ReactNode;
  isLoading?: boolean;
  hasMore?: boolean;
  onPage?: (page: number) => void;
  loadingId?: string | null;
  classicColumns?: number;
}

// Each collection pages independently. Local Library items need no QDN count
// reads; owner feeds request another batch only when a page is selected.
export const MediaSection = <T extends SongSummary | PlaylistSummary>({
  title,
  kind,
  items,
  emptyText,
  onPlay,
  actions,
  isLoading = false,
  hasMore = false,
  onPage,
  loadingId,
  classicColumns,
}: Props<T>) => {
  const [requestedPage, setPage] = useState(1);
  const heading = useRef<HTMLDivElement>(null);
  const pages = Math.max(1, Math.ceil(items.length / 20));
  const page =
    !hasMore && !isLoading ? Math.min(requestedPage, pages) : requestedPage;
  const visibleItems = items.slice((page - 1) * 20, page * 20);
  return (
    <Stack
      component="section"
      aria-label={title}
      spacing={2}
      ref={heading}
      sx={{ scrollMarginTop: 90 }}
    >
      <Typography component="h2" variant="h3" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <MediaGrid kind={kind} classicColumns={classicColumns}>
        {isLoading && !visibleItems.length ? (
          <CardSkeletons />
        ) : (
          visibleItems.map((item) => (
            <MediaCard
              key={item.id}
              kind={kind}
              item={item}
              onPlay={() => onPlay(item, visibleItems)}
              busy={item.id === loadingId}
              actions={actions?.(item)}
            />
          ))
        )}
      </MediaGrid>
      {!isLoading && !visibleItems.length ? (
        <Typography color="text.secondary" variant="body2">
          {emptyText}
        </Typography>
      ) : null}
      {items.length > 20 || hasMore || page > 1 ? (
        <Box>
          <MediaPagination
            label={`${title} pages`}
            page={page}
            pages={pages}
            more={hasMore}
            busy={isLoading}
            onChange={(next) => {
              setPage(next);
              onPage?.(next);
              heading.current?.scrollIntoView?.({ block: 'start' });
            }}
          />
        </Box>
      ) : null}
    </Stack>
  );
};
