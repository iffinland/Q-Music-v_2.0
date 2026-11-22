import { ShuffleRounded, PlayArrowRounded } from '@mui/icons-material';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { MediaSection } from '../components/common/MediaSection';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { useLibrary } from '../hooks/useLibrary';
import { discoverMix } from '../services/discoverMix';
import { isAbortError, requestError } from '../services/qdnRequests';
import { songQueue } from '../utils/songQueue';
import type { SongSummary } from '../types/media';

export const DiscoverPage = () => {
  const [items, setItems] = useState<SongSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const oldest = useRef<number | undefined>(undefined);
  const pending = useRef<AbortController | null>(null);
  const { playQueue } = useMiniPlayer();
  const { addRecentSong } = useLibrary();
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    []
  );
  const find = async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(null);
    setNotice(null);
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const result = await discoverMix({
        signal: controller.signal,
        oldest: oldest.current,
        exclude: items.map((item) => item.id),
      });
      if (pending.current !== controller) return;
      oldest.current = result.oldest;
      if (result.items.length) {
        setItems(result.items);
        if (result.partial)
          setNotice(
            'Some music could not be checked. This smaller mix is ready to play.'
          );
      } else {
        setNotice(
          items.length
            ? 'No different songs found in this batch. Your current mix is still available; try again for another selection.'
            : 'No songs found in this batch. Try again, or check your node connection.'
        );
      }
    } catch (failure) {
      if (pending.current === controller)
        setError(
          isAbortError(failure)
            ? 'Finding music took too long. Your current playback is unchanged. Please retry.'
            : requestError(failure, 'Music could not be found. Please retry.')
        );
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  };
  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography component="h1" variant="h2" sx={{ fontWeight: 800 }}>
          Discover Mix
        </Typography>
        <Typography color="text.secondary">
          Find a fresh mix of Q-Music and Ear-Bump songs from across your node’s
          music index, including older releases.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Each mix checks a few small batches at random points in time. It is a
          sample, not a complete catalogue or an equal chance for every song.
          Find a mix first, then press Play when you are ready.
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          startIcon={<ShuffleRounded />}
          disabled={loading}
          onClick={() => void find()}
        >
          {loading
            ? 'Finding music…'
            : items.length
              ? 'Find another mix'
              : 'Find a mix'}
        </Button>
        {items.length ? (
          <Button
            variant="outlined"
            startIcon={<PlayArrowRounded />}
            onClick={() => {
              addRecentSong(items[0]);
              playQueue(songQueue(items));
            }}
          >
            Play mix
          </Button>
        ) : null}
      </Stack>
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {notice ? <Alert severity="info">{notice}</Alert> : null}
      {items.length || loading ? (
        <MediaSection
          title="Your mix"
          kind="song"
          items={items}
          isLoading={loading && !items.length}
          emptyText="No songs found yet."
          onPlay={(song, visible) => {
            addRecentSong(song);
            playQueue(
              songQueue(visible),
              visible.findIndex((item) => item.id === song.id)
            );
          }}
        />
      ) : null}
      <Typography variant="caption" color="text.secondary">
        Finding a mix does not replace your queue or start audio downloads. Play
        replaces the queue with this mix. The player’s repeat and shuffle
        controls still work. An unavailable song can be skipped with Next.
      </Typography>
    </Stack>
  );
};
