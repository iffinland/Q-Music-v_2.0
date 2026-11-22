import { CatalogMirrorButton } from '../components/mirroring/CatalogMirrorButton';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { MediaSection } from '../components/common/MediaSection';
import { useArtistFeed } from '../hooks/useArtistFeed';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { useLibrary } from '../hooks/useLibrary';
import { artistNameKey } from '../utils/creators';
import { songQueue } from '../utils/songQueue';

const ArtistCatalog = ({ name }: { name: string }) => {
  const feed = useArtistFeed(name);
  const { playQueue } = useMiniPlayer();
  const { addRecentSong } = useLibrary();
  return (
    <Stack spacing={3}>
      <Typography
        component="h1"
        variant="h2"
        sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}
      >
        {name}
      </Typography>
      <Typography color="text.secondary">
        Songs credited to this artist name, across publishers. Names come from
        publication metadata; this is not a verified artist account.
      </Typography>
      <CatalogMirrorButton
        kind="artist"
        name={name}
        publishers={feed.items.map((song) => song.publisher)}
        incomplete={feed.hasMore}
      />
      {feed.error ? <Alert severity="warning">{feed.error}</Alert> : null}
      <Typography role="status" variant="body2" color="text.secondary">
        {feed.isLoading
          ? 'Checking a small batch of indexed songs…'
          : feed.hasMore
            ? `Checked ${feed.scanned} indexed songs. This collection is incomplete; continue to look for more.`
            : `Index search complete. Checked ${feed.scanned} songs.`}
      </Typography>
      <MediaSection
        title="Artist Songs"
        kind="song"
        items={feed.items}
        isLoading={feed.isLoading}
        emptyText={
          feed.hasMore
            ? 'No matching songs in the checked batches yet. Continue searching below.'
            : 'No indexed songs found with this artist name.'
        }
        onPlay={(song, visible) => {
          addRecentSong(song);
          playQueue(
            songQueue(visible),
            visible.findIndex((item) => item.id === song.id)
          );
        }}
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {feed.hasMore ? (
          <Button
            variant="contained"
            disabled={feed.isLoading}
            onClick={feed.loadMore}
          >
            {feed.error ? 'Continue / retry search' : 'Search more songs'}
          </Button>
        ) : null}
        <Button disabled={feed.isLoading} onClick={feed.refresh}>
          Refresh artist
        </Button>
      </Stack>
    </Stack>
  );
};
export const ArtistPage = () => {
  const name = useParams().artist?.trim() || '';
  return name ? (
    <ArtistCatalog key={artistNameKey(name)} name={name} />
  ) : (
    <Alert severity="warning">An artist name is required.</Alert>
  );
};
