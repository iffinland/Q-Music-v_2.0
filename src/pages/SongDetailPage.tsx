import { getQdnResourceUrl } from '../services/qdn';
import { useState as useCommentState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { FavoriteBorderRounded, FavoriteRounded } from '@mui/icons-material';
import { useGlobal } from '../qortal';
import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { SocialFeedback } from '../components/common/SocialFeedback';
import { CommentSection } from '../components/common/CommentSection';
import { ImageLightbox } from '../components/common/ImageLightbox';
import { PageHero } from '../components/common/PageHero';
import { QortTipModal } from '../components/common/QortTipModal';
import { SectionCard } from '../components/common/SectionCard';
import { useEntityComments } from '../hooks/useEntityComments';
import { useEntityLikes } from '../hooks/useEntityLikes';
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { useQortTip } from '../hooks/useQortTip';
import { useQdnResource } from '../hooks/useQdnResource';
import { useSongDetail } from '../hooks/useSongDetail';
import { downloadQdnAudioResource } from '../utils/download';
import { formatSongCardMetadata } from '../utils/songMetadata';
import { buildShareLink, copyToClipboard } from '../utils/share';

export const SongDetailPage = () => {
  const { auth } = useGlobal();
  const { publisher, identifier } = useParams();
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadController = useRef<AbortController | null>(null);
  const viewKey = `${publisher || ''}:${identifier || ''}`;
  const currentView = useRef(viewKey);
  currentView.current = viewKey;
  useEffect(() => {
    setIsDownloading(false);
    setDownloadError(null);
    setDownloadMessage(null);
    return () => {
      downloadController.current?.abort();
    };
  }, [viewKey]);
  const decodedPublisher = publisher ? publisher : undefined;
  const decodedIdentifier = identifier ? identifier : undefined;
  const { song, isLoading, error, retry, metadataError, isMetadataLoading } =
    useSongDetail(decodedPublisher, decodedIdentifier);
  const {
    url: artworkUrl,
    isLoading: artworkLoading,
    status: artworkStatus,
  } = useQdnResource({
    service: 'THUMBNAIL',
    name: decodedPublisher,
    identifier: decodedIdentifier,
    enabled: Boolean(decodedPublisher && decodedIdentifier),
    timeoutMs: 30_000,
  });
  const { addRecentSong, isSongFavorite, toggleSong } = useLibrary();
  const { playTrack } = useMiniPlayer();
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
    entityType: 'song',
    entityId: song?.identifier,
    entityPublisher: song?.publisher,
    title: song?.title,
    enabled: Boolean(song?.identifier && song?.publisher),
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
    entityType: 'song',
    entityId: song?.identifier,
    entityPublisher: song?.publisher,
    title: song?.title,
    enabled: commentsOpen && Boolean(song?.identifier && song?.publisher),
  });
  const likesLabel =
    likeCount === undefined
      ? likesLoading
        ? 'Loading likes…'
        : 'Likes unavailable'
      : `${likeCount}${likesPartial ? '+' : ''}`;
  const tip = useQortTip({
    recipientName: song?.publisher,
    entityLabel: 'track',
  });

  const handlePlay = () => {
    if (!song) return;

    playTrack({
      key: `${song.publisher}:${song.identifier}`,
      id: song.id,
      identifier: song.identifier,
      publisher: song.publisher,
      service: 'AUDIO',
      title: song.title,
      artist: song.artist,
      context: song.publisher,
      artworkUrl,
    });
    addRecentSong(song);
  };

  const handleToggleFavorite = () => {
    if (!song) return;
    toggleSong(song);
  };

  const handleShare = async () => {
    setShareError(null);
    setShareMessage(null);

    try {
      await copyToClipboard(buildShareLink());
      setShareMessage('Song link copied.');
    } catch {
      setShareError('Song link could not be copied.');
    }
  };

  const handleDownload = async () => {
    if (!song) return;

    setDownloadError(null);
    setDownloadMessage(null);
    setIsDownloading(true);

    const controller = new AbortController();
    downloadController.current?.abort();
    downloadController.current = controller;
    const key = viewKey;
    try {
      const downloadUrl = await getQdnResourceUrl(
        'AUDIO',
        song.publisher,
        song.identifier,
        { signal: controller.signal }
      );
      if (!downloadUrl)
        throw new Error('Audio resource URL could not be resolved.');
      const downloadedFilename = await downloadQdnAudioResource({
        publisher: song.publisher,
        identifier: song.identifier,
        title: song.title,
        resourceUrl: downloadUrl,
        signal: controller.signal,
      });
      if (currentView.current === key && !controller.signal.aborted)
        setDownloadMessage(
          `Download requested: ${downloadedFilename}. Check your browser or Hub download manager for progress.`
        );
    } catch (downloadActionError) {
      if (currentView.current !== key || controller.signal.aborted) return;
      setDownloadError(
        downloadActionError instanceof Error
          ? downloadActionError.message
          : 'Audio could not be downloaded.'
      );
    } finally {
      if (
        currentView.current === key &&
        downloadController.current === controller
      )
        setIsDownloading(false);
    }
  };

  const handleTipAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    tip.setAmount(event.target.value);
  };

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow="AUDIO DETAIL"
        title={
          song
            ? song.title
            : decodedIdentifier
              ? `Song: ${decodedIdentifier}`
              : 'Song detail'
        }
        description="Listen, explore the song details and support its publisher."
      />
      {error ? (
        <Alert
          severity="warning"
          action={<Button onClick={retry}>Retry</Button>}
        >
          {error}
        </Alert>
      ) : null}
      {isMetadataLoading ? (
        <Typography>
          Loading full song details… You can play the audio now.
        </Typography>
      ) : null}
      {metadataError ? (
        <Alert
          severity="info"
          action={<Button onClick={retry}>Retry details</Button>}
        >
          {metadataError}
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
      {shareError ? <Alert severity="error">{shareError}</Alert> : null}
      {shareMessage ? <Alert severity="success">{shareMessage}</Alert> : null}
      {downloadError ? <Alert severity="error">{downloadError}</Alert> : null}
      {downloadMessage ? (
        <Alert severity="info">{downloadMessage}</Alert>
      ) : null}
      {isLoading ? (
        <Typography variant="body2">Loading song details...</Typography>
      ) : song ? (
        <Stack spacing={1.75}>
          <Grid container spacing={2.25}>
            {artworkUrl ? (
              <Grid size={{ xs: 12, md: 4 }}>
                <ImageLightbox src={artworkUrl} alt={song.title}>
                  {({ open }) => (
                    <Box
                      component="img"
                      src={artworkUrl}
                      alt={song.title}
                      onClick={open}
                      sx={{
                        width: '100%',
                        maxWidth: 320,
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
                kicker="TRACK META"
                title={song.title}
                body={formatSongCardMetadata({
                  title: song.title,
                  publisher: song.publisher,
                  description: song.description,
                })}
                meta={[
                  'AUDIO',
                  song.artist,
                  likeCount === undefined ? likesLabel : `${likesLabel} likes`,
                  commentsOpen
                    ? `${comments.filter((comment) => !comment.deleted).length} loaded comments`
                    : 'Comments',
                ]}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <Button variant="contained" size="large" onClick={handlePlay}>
              Play now
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={handleToggleFavorite}
            >
              {isSongFavorite(song.id)
                ? 'Remove from library'
                : 'Save to library'}
            </Button>
            <Button variant="outlined" size="large" onClick={handleShare}>
              Copy page link
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
                  : `Like this song (${likesLabel})`}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => void tip.openModal()}
            >
              Send tip
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => void handleDownload()}
              disabled={isDownloading}
            >
              {isDownloading ? 'Preparing download…' : 'Download this'}
            </Button>
            {isDownloading && (
              <Button
                onClick={() => {
                  downloadController.current?.abort();
                  setIsDownloading(false);
                }}
              >
                Cancel download request
              </Button>
            )}
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
