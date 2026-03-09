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
import { useGlobal } from 'qapp-core';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CommentSection } from '../components/common/CommentSection';
import { ImageLightbox } from '../components/common/ImageLightbox';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { useEntityComments } from '../hooks/useEntityComments';
import { useEntityLikes } from '../hooks/useEntityLikes';
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { useQdnResource } from '../hooks/useQdnResource';
import { useSongDetail } from '../hooks/useSongDetail';
import { formatSongCardMetadata } from '../utils/songMetadata';
import { buildShareLink, copyToClipboard } from '../utils/share';

export const SongDetailPage = () => {
  const { auth } = useGlobal();
  const { publisher, identifier } = useParams();
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const decodedPublisher = publisher
    ? decodeURIComponent(publisher)
    : undefined;
  const decodedIdentifier = identifier
    ? decodeURIComponent(identifier)
    : undefined;
  const { song, isLoading, error } = useSongDetail(
    decodedPublisher,
    decodedIdentifier
  );
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
  } = useEntityLikes({
    entityType: 'song',
    entityId: song?.identifier,
    entityPublisher: song?.publisher,
    title: song?.title,
    enabled: Boolean(song?.identifier && song?.publisher),
  });
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
  } = useEntityComments({
    entityType: 'song',
    entityId: song?.identifier,
    entityPublisher: song?.publisher,
    title: song?.title,
    enabled: Boolean(song?.identifier && song?.publisher),
  });
  const engagementLoading = likesLoading || commentsLoading;
  const engagementError = likesError || commentsError;

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
        description="This route is already in place so the next migration step can wire direct QDN resource loading, author metadata, comments and playback entry points without changing the navigation structure again."
      />
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {engagementError ? (
        <Alert severity="warning">{engagementError}</Alert>
      ) : null}
      {shareError ? <Alert severity="error">{shareError}</Alert> : null}
      {shareMessage ? <Alert severity="success">{shareMessage}</Alert> : null}
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
                  engagementLoading
                    ? 'Loading social...'
                    : `${likeCount} likes`,
                  engagementLoading
                    ? 'Loading comments...'
                    : `${comments.length} comments`,
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
              disabled={isUpdatingLike}
              startIcon={
                hasLike ? (
                  <FavoriteRounded fontSize="small" />
                ) : (
                  <FavoriteBorderRounded fontSize="small" />
                )
              }
            >
              {isUpdatingLike
                ? `Updating like... (${likeCount})`
                : hasLike
                  ? `Unlike (${likeCount})`
                  : `Like this song (${likeCount})`}
            </Button>
          </Stack>
          <Divider />
          <Stack spacing={1.25}>
            <CommentSection
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
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
};
