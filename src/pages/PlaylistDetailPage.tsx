import { PublicationBadge } from '../components/common/PublicationBadge';
import { matchingMediaPrefix, isEarBumpIdentifier } from '../utils/mediaOrigin';
import { useState as useCommentState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  FavoriteBorderRounded,
  FavoriteRounded,
  PlayArrowRounded,
} from '@mui/icons-material';
import { useGlobal } from '../qortal';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { SocialFeedback } from '../components/common/SocialFeedback';
import { CommentSection } from '../components/common/CommentSection';
import { ImageLightbox } from '../components/common/ImageLightbox';
import { PageHero } from '../components/common/PageHero';
import { QortTipModal } from '../components/common/QortTipModal';
import { SectionCard } from '../components/common/SectionCard';
import { useEntityComments } from '../hooks/useEntityComments';
import { useEntityLikes } from '../hooks/useEntityLikes';
import { useMediaPublish } from '../hooks/useMediaPublish';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { usePlaylistDetail } from '../hooks/usePlaylistDetail';
import { useQortTip } from '../hooks/useQortTip';
import { useQdnResource } from '../hooks/useQdnResource';
import { useLibrary } from '../hooks/useLibrary';
import type { PlaylistSongReference } from '../types/media';
import { emitMediaRefresh } from '../utils/mediaEvents';
import { buildTitleFromIdentifier } from '../utils/mediaTitles';
import { formatPlaylistCardMetadata } from '../utils/playlistMetadata';
import { buildShareLink, copyToClipboard } from '../utils/share';

const resolvePlaylistSongTitle = (song: PlaylistSongReference) =>
  song.title ||
  buildTitleFromIdentifier(
    song.identifier,
    matchingMediaPrefix(song.identifier, 'song')
  );

export const PlaylistDetailPage = () => {
  const { name, playlistId } = useParams();
  const decodedPublisher = name ? name : undefined;
  const decodedIdentifier = playlistId ? playlistId : undefined;
  const { auth } = useGlobal();
  const { publishPlaylist } = useMediaPublish();
  const { addRecentSong, isPlaylistFavorite, togglePlaylist } = useLibrary();
  const { playlist, isLoading, error, retry } = usePlaylistDetail(
    decodedPublisher,
    decodedIdentifier
  );
  const {
    url: thumbnailUrl,
    isLoading: artworkLoading,
    status: artworkStatus,
  } = useQdnResource({
    service: 'THUMBNAIL',
    name: decodedPublisher,
    identifier: decodedIdentifier,
    enabled: Boolean(
      decodedPublisher &&
        decodedIdentifier &&
        !isEarBumpIdentifier(decodedIdentifier)
    ),
    timeoutMs: 30_000,
  });
  const artworkUrl = isEarBumpIdentifier(decodedIdentifier)
    ? playlist?.image
    : thumbnailUrl;
  const { playQueue, playTrack } = useMiniPlayer();
  const [orderedSongs, setOrderedSongs] = useState<PlaylistSongReference[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const {
    likeCount,
    hasLike,
    isLoading: likesLoading,
    error: likesError,
    isUpdatingLike,
    toggleLike,
    canLike,
    partial: likesPartial,
    notice: likeNotice,
    uncertain: likeUncertain,
    retrySavedLike,
    refreshLikes,
  } = useEntityLikes({
    entityType: 'playlist',
    entityId: playlist?.identifier,
    entityPublisher: playlist?.publisher,
    title: playlist?.title,
    enabled: Boolean(playlist?.identifier && playlist?.publisher),
  });
  const [commentsOpen, setCommentsOpen] = useCommentState(false);
  const {
    comments,
    isLoading: commentsLoading,
    error: commentsError,
    isSubmittingComment,
    isEditingComment,
    addComment,
    removeComment,
    editComment,
    canLoadMoreComments,
    loadMoreComments,
    refreshComments,
    notice: commentNotice,
    uncertain: commentUncertain,
    retrySavedComment,
  } = useEntityComments({
    entityType: 'playlist',
    entityId: playlist?.identifier,
    entityPublisher: playlist?.publisher,
    title: playlist?.title,
    enabled:
      commentsOpen && Boolean(playlist?.identifier && playlist?.publisher),
  });
  const likesLabel =
    likeCount === undefined
      ? likesLoading
        ? 'Loading likes…'
        : 'Likes unavailable'
      : `${likeCount}${likesPartial ? '+' : ''}`;
  const tip = useQortTip({
    recipientName: playlist?.publisher,
    entityLabel: 'playlist',
  });

  useEffect(() => {
    setOrderedSongs(playlist?.songs || []);
  }, [playlist]);

  const isOwner = useMemo(() => {
    if (
      !auth?.name ||
      !playlist?.publisher ||
      isEarBumpIdentifier(playlist.identifier)
    )
      return false;
    return auth.name.toLowerCase() === playlist.publisher.toLowerCase();
  }, [auth?.name, playlist?.publisher, playlist?.identifier]);

  const playlistQueue = useMemo(
    () =>
      orderedSongs.map((song, index) => ({
        key: `${song.publisher}:${song.identifier}:${index}`,
        id: song.identifier,
        identifier: song.identifier,
        publisher: song.publisher,
        service: 'AUDIO' as const,
        title: resolvePlaylistSongTitle(song),
        artist: song.artist || song.publisher,
        context: playlist?.title,
      })),
    [orderedSongs, playlist?.title]
  );

  const handlePlayAll = () => {
    if (playlistQueue.length === 0) return;
    playQueue(playlistQueue);
  };

  const handlePlaySong = (index: number) => {
    const track = playlistQueue[index];
    if (!track) return;
    playTrack(track, playlistQueue);
    const source = orderedSongs[index];
    if (source) {
      addRecentSong({
        id: source.identifier,
        identifier: source.identifier,
        publisher: source.publisher,
        title: resolvePlaylistSongTitle(source),
        artist: source.artist || source.publisher,
        service: 'AUDIO',
        mediaType: 'SONG',
      });
    }
  };

  const moveSong = (index: number, direction: -1 | 1) => {
    setOrderedSongs((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleSaveOrder = async () => {
    if (!playlist) return;

    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);

    try {
      const result = await publishPlaylist({
        title: playlist.title,
        description: playlist.description,
        publishedDate: playlist.publishedDate,
        songs: orderedSongs,
        existingIdentifier: playlist.identifier,
      });
      setSaveMessage(`${result.title}: ${result.outcome.message}`);
      emitMediaRefresh();
    } catch (publishError) {
      setSaveError(
        publishError instanceof Error
          ? publishError.message
          : 'Playlist update failed.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = () => {
    if (!playlist) return;
    const added = togglePlaylist({
      id: playlist.id,
      identifier: playlist.identifier,
      publisher: playlist.publisher,
      title: playlist.title,
      description: playlist.description,
      publishedDate: playlist.publishedDate,
      created: playlist.created,
      updated: playlist.updated,
      status: playlist.status,
      songCount: orderedSongs.length,
    });
    setSaveMessage(
      added ? 'Playlist saved to library.' : 'Playlist removed from library.'
    );
  };

  const handleShare = async () => {
    setSaveError(null);
    setSaveMessage(null);

    try {
      await copyToClipboard(buildShareLink());
      setSaveMessage('Playlist link copied.');
    } catch {
      setSaveError('Playlist link could not be copied.');
    }
  };
  const handleTipAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    tip.setAmount(event.target.value);
  };

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow="PLAYLIST DETAIL"
        title={
          playlist
            ? playlist.title
            : decodedIdentifier
              ? `Playlist: ${decodedIdentifier}`
              : 'Playlist detail'
        }
        description="Listen to the playlist, explore its songs and join the discussion."
      />
      {error ? (
        <Alert
          severity="warning"
          action={<Button onClick={retry}>Retry</Button>}
        >
          {error}
        </Alert>
      ) : null}
      <SocialFeedback
        error={likesError}
        notice={likeNotice}
        busy={likesLoading || isUpdatingLike}
        onRefresh={refreshLikes}
        uncertain={likeUncertain}
        onRetry={() => void retrySavedLike()}
        label="likes"
      />
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {saveMessage ? <Alert severity="info">{saveMessage}</Alert> : null}
      {isLoading ? (
        <Typography variant="body2">Loading playlist details...</Typography>
      ) : playlist ? (
        <Stack spacing={1.75}>
          <Grid container spacing={2.25}>
            {artworkUrl ? (
              <Grid size={{ xs: 12, md: 4 }}>
                <ImageLightbox src={artworkUrl} alt={playlist.title}>
                  {({ open }) => (
                    <Box
                      component="img"
                      src={artworkUrl}
                      alt={playlist.title}
                      onClick={open}
                      sx={{
                        width: '100%',
                        maxWidth: 360,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        boxShadow: 'var(--qm-shadow-soft)',
                        cursor: 'zoom-in',
                      }}
                    />
                  )}
                </ImageLightbox>
                {artworkLoading ? (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', display: 'block', mt: 1 }}
                  >
                    Preparing artwork
                    {artworkStatus?.percentLoaded
                      ? ` (${artworkStatus.percentLoaded}%)`
                      : artworkStatus?.status
                        ? `: ${artworkStatus.status}`
                        : '...'}
                  </Typography>
                ) : null}
              </Grid>
            ) : null}
            <Grid size={{ xs: 12, md: artworkUrl ? 8 : 12 }}>
              <SectionCard
                originIdentifier={playlist.identifier}
                kicker="PLAYLIST META"
                title={playlist.title}
                body={formatPlaylistCardMetadata({
                  title: playlist.title,
                  publisher: playlist.publisher,
                  description: playlist.description,
                  publishedDate: playlist.publishedDate,
                  songCount: playlist.songCount,
                })}
                meta={[
                  'PLAYLIST',
                  `${playlist.songCount} tracks`,
                  likeCount === undefined ? likesLabel : `${likesLabel} likes`,
                  commentsOpen
                    ? `${comments.filter((comment) => !comment.deleted).length} loaded comments`
                    : 'Comments',
                  ...(isOwner ? ['Owner edit mode'] : []),
                ]}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              size="large"
              onClick={handlePlayAll}
              disabled={orderedSongs.length === 0}
            >
              Play playlist
            </Button>
            <Button variant="outlined" size="large" onClick={handleShare}>
              Copy page link
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={handleToggleFavorite}
            >
              {isPlaylistFavorite(playlist.id)
                ? 'Remove from library'
                : 'Save to library'}
            </Button>
            <Button
              variant={hasLike ? 'contained' : 'outlined'}
              size="large"
              onClick={() => void toggleLike()}
              disabled={!canLike || isUpdatingLike}
              startIcon={
                hasLike ? (
                  <FavoriteRounded fontSize="small" />
                ) : (
                  <FavoriteBorderRounded fontSize="small" />
                )
              }
            >
              {isUpdatingLike
                ? `Updating like... (${likesLabel})`
                : hasLike
                  ? `Unlike (${likesLabel})`
                  : `Like playlist (${likesLabel})`}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => void tip.openModal()}
            >
              Send tip
            </Button>
            {isOwner ? (
              <Button
                variant="outlined"
                size="large"
                onClick={handleSaveOrder}
                disabled={isSaving || orderedSongs.length === 0}
              >
                {isSaving ? 'Saving...' : 'Save order'}
              </Button>
            ) : null}
          </Stack>
          <QortTipModal
            amount={tip.amount}
            formattedBalance={tip.formattedBalance}
            isBalanceLoading={tip.isBalanceLoading}
            isOpen={tip.isOpen}
            isResolvingRecipient={tip.isResolvingRecipient}
            isSending={tip.isSending}
            onAmountChange={handleTipAmountChange}
            onClose={tip.closeModal}
            onSend={() => void tip.sendTip()}
            recipientAddress={tip.recipientAddress}
            recipientName={tip.recipientName}
            resolveError={tip.resolveError}
          />
          <Divider />
          <Stack spacing={1.1}>
            <Typography variant="h6" sx={{ lineHeight: 1.08 }}>
              Tracks
            </Typography>
            {orderedSongs.map((song, index) => (
              <Stack
                key={`${song.publisher}:${song.identifier}`}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  px: { xs: 1.5, sm: 2 },
                  py: 1.25,
                  backgroundColor: 'var(--qm-surface-soft)',
                }}
              >
                <Stack spacing={0.35}>
                  <PublicationBadge identifier={song.identifier} />
                  <Typography variant="body1" sx={{ lineHeight: 1.25 }}>
                    {index + 1}. {resolvePlaylistSongTitle(song)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {song.artist || song.publisher}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Button
                    size="small"
                    startIcon={<PlayArrowRounded />}
                    onClick={() => handlePlaySong(index)}
                  >
                    Play
                  </Button>
                  {isOwner ? (
                    <>
                      <IconButton
                        size="small"
                        onClick={() => moveSong(index, -1)}
                        disabled={index === 0}
                      >
                        <ArrowUpwardRounded fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => moveSong(index, 1)}
                        disabled={index === orderedSongs.length - 1}
                      >
                        <ArrowDownwardRounded fontSize="small" />
                      </IconButton>
                    </>
                  ) : null}
                </Stack>
              </Stack>
            ))}
          </Stack>
          <Divider />
          <Stack spacing={1.25}>
            <Button onClick={() => setCommentsOpen((value) => !value)}>
              {commentsOpen ? 'Hide comments' : 'Show comments'}
            </Button>
            {commentsOpen ? (
              <CommentSection
                key={`${auth?.address}:${auth?.name}:${decodedPublisher}:${decodedIdentifier}`}
                error={commentsError}
                notice={commentNotice}
                onRefresh={refreshComments}
                uncertain={commentUncertain}
                onRetrySaved={() => void retrySavedComment()}
                comments={comments}
                currentUser={auth?.name || undefined}
                isLoading={commentsLoading}
                isSubmittingComment={isSubmittingComment}
                isEditingComment={isEditingComment}
                onAddComment={(message) => addComment(message)}
                onReply={(commentId, message) => addComment(message, commentId)}
                onEdit={(comment, message) => editComment(comment, message)}
                onDelete={(comment) => removeComment(comment)}
                canLoadMore={canLoadMoreComments}
                onLoadMore={loadMoreComments}
              />
            ) : null}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
};
