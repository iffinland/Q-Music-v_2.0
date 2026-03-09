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
  FavoriteBorderRounded,
  FavoriteRounded,
  ArrowUpwardRounded,
  PlayArrowRounded,
} from '@mui/icons-material';
import { useGlobal } from 'qapp-core';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CommentSection } from '../components/common/CommentSection';
import { ImageLightbox } from '../components/common/ImageLightbox';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { useEngagement } from '../hooks/useEngagement';
import { useMediaPublish } from '../hooks/useMediaPublish';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { usePlaylistDetail } from '../hooks/usePlaylistDetail';
import { useQdnResource } from '../hooks/useQdnResource';
import { useVisibilityTrigger } from '../hooks/useVisibilityTrigger';
import { useLibrary } from '../hooks/useLibrary';
import type { PlaylistSongReference } from '../types/media';
import { emitMediaRefresh } from '../utils/mediaEvents';
import { formatPlaylistCardMetadata } from '../utils/playlistMetadata';
import { copyToClipboard } from '../utils/share';

export const PlaylistDetailPage = () => {
  const { name, playlistId } = useParams();
  const decodedPublisher = name ? decodeURIComponent(name) : undefined;
  const decodedIdentifier = playlistId
    ? decodeURIComponent(playlistId)
    : undefined;
  const { auth } = useGlobal();
  const { publishPlaylist } = useMediaPublish();
  const { addRecentSong, isPlaylistFavorite, togglePlaylist } = useLibrary();
  const {
    targetRef: socialTriggerRef,
    isVisible: socialVisible,
    setIsVisible: setSocialVisible,
  } = useVisibilityTrigger();
  const { playlist, isLoading, error } = usePlaylistDetail(
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
  const { playQueue, playTrack } = useMiniPlayer();
  const [orderedSongs, setOrderedSongs] = useState<PlaylistSongReference[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
    canLoadMoreComments,
    loadMoreComments,
  } = useEngagement({
    entityType: 'playlist',
    entityId: playlist?.identifier,
    entityPublisher: playlist?.publisher,
    title: playlist?.title,
    enabled: socialVisible,
  });

  useEffect(() => {
    setOrderedSongs(playlist?.songs || []);
  }, [playlist]);

  useEffect(() => {
    setSocialVisible(false);
  }, [decodedIdentifier, decodedPublisher, setSocialVisible]);

  const isOwner = useMemo(() => {
    if (!auth?.name || !playlist?.publisher) return false;
    return auth.name.toLowerCase() === playlist.publisher.toLowerCase();
  }, [auth?.name, playlist?.publisher]);

  const playlistQueue = useMemo(
    () =>
      orderedSongs.map((song) => ({
        key: `${song.publisher}:${song.identifier}`,
        id: song.identifier,
        identifier: song.identifier,
        publisher: song.publisher,
        service: 'AUDIO' as const,
        title: song.title || song.identifier,
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
        title: source.title || source.identifier,
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
      setSaveMessage(
        `Published successfully. Playlist order is now live as ${result.identifier}.`
      );
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
    await copyToClipboard(window.location.href);
    setSaveMessage('Playlist link copied.');
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
        description="The route shape stays compatible with the old mental model while the implementation underneath is simplified for the new app."
      />
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {engagementError ? (
        <Alert severity="warning">{engagementError}</Alert>
      ) : null}
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {saveMessage ? <Alert severity="success">{saveMessage}</Alert> : null}
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
                  ...(socialVisible
                    ? [`${likeCount} likes`, `${comments.length} comments`]
                    : ['Social on demand']),
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
              onClick={() => {
                if (!socialVisible) {
                  setSocialVisible(true);
                  return;
                }
                void toggleLike();
              }}
              disabled={socialVisible && isUpdatingLike}
              startIcon={
                hasLike ? (
                  <FavoriteRounded fontSize="small" />
                ) : (
                  <FavoriteBorderRounded fontSize="small" />
                )
              }
            >
              {!socialVisible
                ? 'Load social'
                : isUpdatingLike
                  ? 'Updating like...'
                  : hasLike
                    ? 'Unlike'
                    : 'Like playlist'}
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
                  <Typography variant="body1" sx={{ lineHeight: 1.25 }}>
                    {index + 1}. {song.title || song.identifier}
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
          <Stack ref={socialTriggerRef} spacing={1.25}>
            {!socialVisible ? (
              <Button
                variant="outlined"
                onClick={() => setSocialVisible(true)}
                sx={{ alignSelf: 'flex-start' }}
              >
                Load comments and likes
              </Button>
            ) : (
              <CommentSection
                comments={comments}
                hiddenCommentIds={hiddenCommentIds}
                isModerator={isModerator}
                currentUser={auth?.name || undefined}
                ownerName={playlist.publisher}
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
                canLoadMore={canLoadMoreComments}
                onLoadMore={loadMoreComments}
              />
            )}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
};
