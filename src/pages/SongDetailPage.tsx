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
import { useParams } from 'react-router-dom';
import { CommentSection } from '../components/common/CommentSection';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { useEngagement } from '../hooks/useEngagement';
import { useLibrary } from '../hooks/useLibrary';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { useSongDetail } from '../hooks/useSongDetail';
import { formatSongCardMetadata } from '../utils/songMetadata';
import { copyToClipboard } from '../utils/share';

export const SongDetailPage = () => {
  const { auth } = useGlobal();
  const { publisher, identifier } = useParams();
  const decodedPublisher = publisher
    ? decodeURIComponent(publisher)
    : undefined;
  const decodedIdentifier = identifier
    ? decodeURIComponent(identifier)
    : undefined;
  const { song, artworkUrl, isLoading, error } = useSongDetail(
    decodedPublisher,
    decodedIdentifier
  );
  const { addRecentSong, isSongFavorite, toggleSong } = useLibrary();
  const { playTrack } = useMiniPlayer();
  const {
    likeCount,
    hasLike,
    comments,
    hiddenCommentIds,
    isModerator,
    isLoading: engagementLoading,
    error: engagementError,
    isUpdatingLike,
    isSubmittingComment,
    isEditingComment,
    isModerating,
    toggleLike,
    addComment,
    removeComment,
    editComment,
    toggleCommentVisibility,
  } = useEngagement({
    entityType: 'song',
    entityId: song?.identifier,
    entityPublisher: song?.publisher,
    title: song?.title,
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
    await copyToClipboard(window.location.href);
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
      {isLoading ? (
        <Typography variant="body2">Loading song details...</Typography>
      ) : song ? (
        <Stack spacing={1.75}>
          <Grid container spacing={2.25}>
            {artworkUrl ? (
              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  component="img"
                  src={artworkUrl}
                  alt={song.title}
                  sx={{
                    width: '100%',
                    maxWidth: 320,
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
                  }}
                />
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
                  `${likeCount} likes`,
                  `${comments.length} comments`,
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
                ? 'Updating like...'
                : hasLike
                  ? 'Unlike'
                  : 'Like this song'}
            </Button>
          </Stack>
          <Divider />
          <CommentSection
            comments={comments}
            hiddenCommentIds={hiddenCommentIds}
            isModerator={isModerator}
            currentUser={auth?.name || undefined}
            ownerName={song.publisher}
            isLoading={engagementLoading}
            isSubmittingComment={isSubmittingComment}
            isEditingComment={isEditingComment}
            isModerating={isModerating}
            onAddComment={(message) => addComment(message)}
            onReply={(commentId, message) => addComment(message, commentId)}
            onEdit={(comment, message) => editComment(comment, message)}
            onDelete={(comment) => removeComment(comment)}
            onToggleVisibility={(commentId) =>
              toggleCommentVisibility(commentId)
            }
          />
        </Stack>
      ) : null}
    </Stack>
  );
};
