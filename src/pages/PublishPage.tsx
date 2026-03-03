import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import {
  useMediaPublish,
  mapSongToPlaylistReference,
  type CoverCropSettings,
} from '../hooks/useMediaPublish';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { emitMediaRefresh } from '../utils/mediaEvents';

const defaultCrop = (): CoverCropSettings => ({
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
});

const CropPreview = ({
  src,
  alt,
  crop,
  onChange,
}: {
  src: string;
  alt: string;
  crop: CoverCropSettings;
  onChange: (crop: CoverCropSettings) => void;
}) => {
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const clampRange = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const clamp = (value: number) => Math.min(1, Math.max(-1, value));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box
        onPointerDown={(event) => {
          dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: crop.offsetX,
            offsetY: crop.offsetY,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const dragState = dragStateRef.current;
          if (!dragState || dragState.pointerId !== event.pointerId) return;

          const rect = event.currentTarget.getBoundingClientRect();
          const nextOffsetX = clamp(
            dragState.offsetX +
              (event.clientX - dragState.startX) / (rect.width / 2)
          );
          const nextOffsetY = clamp(
            dragState.offsetY +
              (event.clientY - dragState.startY) / (rect.height / 2)
          );

          onChange({
            ...crop,
            offsetX: Number(nextOffsetX.toFixed(3)),
            offsetY: Number(nextOffsetY.toFixed(3)),
          });
        }}
        onPointerUp={(event) => {
          if (dragStateRef.current?.pointerId === event.pointerId) {
            dragStateRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerLeave={() => {
          dragStateRef.current = null;
        }}
        onWheel={(event) => {
          event.preventDefault();
          const nextZoom = clampRange(
            crop.zoom - event.deltaY * 0.0015,
            1,
            2.5
          );
          onChange({
            ...crop,
            zoom: Number(nextZoom.toFixed(2)),
          });
        }}
        sx={{
          position: 'relative',
          width: 180,
          height: 180,
          overflow: 'hidden',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'rgba(255,255,255,0.04)',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <Box
          component="img"
          src={src}
          alt={alt}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${crop.zoom}) translate(${crop.offsetX * 24}%, ${crop.offsetY * 24}%)`,
            transformOrigin: 'center',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: '33.333%',
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: 'rgba(255,255,255,0.2)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: '66.666%',
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: 'rgba(255,255,255,0.2)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '33.333%',
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.2)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '66.666%',
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.2)',
            pointerEvents: 'none',
          }}
        />
      </Box>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', maxWidth: 220 }}
      >
        Drag the image to reposition. Use the mouse wheel for quick zoom and the
        sliders below for fine adjustment.
      </Typography>
    </Box>
  );
};

const CropControls = ({
  crop,
  onChange,
}: {
  crop: CoverCropSettings;
  onChange: (crop: CoverCropSettings) => void;
}) => (
  <Stack spacing={1.25}>
    <Typography variant="subtitle2">Cover crop</Typography>
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Zoom
      </Typography>
      <Slider
        min={1}
        max={2.5}
        step={0.05}
        value={crop.zoom}
        onChange={(_, value) =>
          onChange({ ...crop, zoom: Array.isArray(value) ? value[0] : value })
        }
      />
    </Box>
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Horizontal
      </Typography>
      <Slider
        min={-1}
        max={1}
        step={0.05}
        value={crop.offsetX}
        onChange={(_, value) =>
          onChange({
            ...crop,
            offsetX: Array.isArray(value) ? value[0] : value,
          })
        }
      />
    </Box>
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Vertical
      </Typography>
      <Slider
        min={-1}
        max={1}
        step={0.05}
        value={crop.offsetY}
        onChange={(_, value) =>
          onChange({
            ...crop,
            offsetY: Array.isArray(value) ? value[0] : value,
          })
        }
      />
    </Box>
    <Button variant="text" onClick={() => onChange(defaultCrop())}>
      Reset crop
    </Button>
  </Stack>
);

export const PublishPage = () => {
  const { publisher, publishPlaylist, publishSong } = useMediaPublish();
  const { songs } = useSongsFeed(18);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songGenre, setSongGenre] = useState('Electronic');
  const [songLanguage, setSongLanguage] = useState('');
  const [songMood, setSongMood] = useState('');
  const [songNotes, setSongNotes] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [songCoverFile, setSongCoverFile] = useState<File | null>(null);
  const [songCoverCrop, setSongCoverCrop] =
    useState<CoverCropSettings>(defaultCrop());
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [playlistCoverFile, setPlaylistCoverFile] = useState<File | null>(null);
  const [playlistCoverCrop, setPlaylistCoverCrop] =
    useState<CoverCropSettings>(defaultCrop());
  const [songPickerQuery, setSongPickerQuery] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [songResult, setSongResult] = useState<string | null>(null);
  const [playlistResult, setPlaylistResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPublishingSong, setIsPublishingSong] = useState(false);
  const [isPublishingPlaylist, setIsPublishingPlaylist] = useState(false);
  const songCoverPreview = useObjectUrl(songCoverFile);
  const playlistCoverPreview = useObjectUrl(playlistCoverFile);

  const selectedSongs = useMemo(
    () => songs.filter((song) => selectedSongIds.includes(song.id)),
    [selectedSongIds, songs]
  );
  const visibleSongOptions = useMemo(() => {
    const normalizedQuery = songPickerQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return songs;
    }

    return songs.filter((song) =>
      [song.title, song.artist, song.publisher]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [songPickerQuery, songs]);
  const songPublishReady =
    Boolean(publisher) &&
    Boolean(audioFile) &&
    songTitle.trim().length > 0 &&
    songArtist.trim().length > 0;
  const playlistPublishReady =
    Boolean(publisher) &&
    playlistTitle.trim().length > 0 &&
    selectedSongs.length > 0;
  const songTitleError =
    songTitle.length > 0 && songTitle.trim().length === 0
      ? 'Title cannot be only spaces.'
      : !songTitle.trim() && audioFile
        ? 'Add a title before publishing.'
        : '';
  const songArtistError =
    songArtist.length > 0 && songArtist.trim().length === 0
      ? 'Artist cannot be only spaces.'
      : !songArtist.trim() && audioFile
        ? 'Add an artist before publishing.'
        : '';
  const playlistTitleError =
    playlistTitle.length > 0 && playlistTitle.trim().length === 0
      ? 'Playlist title cannot be only spaces.'
      : !playlistTitle.trim() && selectedSongs.length > 0
        ? 'Add a playlist title before publishing.'
        : '';

  const handlePublishSong = async () => {
    if (!audioFile) {
      setError('Select an audio file before publishing.');
      return;
    }

    setError(null);
    setSongResult(null);
    setIsPublishingSong(true);

    try {
      const result = await publishSong({
        title: songTitle,
        artist: songArtist,
        genre: songGenre,
        language: songLanguage,
        mood: songMood,
        notes: songNotes,
        audioFile,
        coverFile: songCoverFile,
        coverCrop: songCoverFile ? songCoverCrop : undefined,
      });

      setSongResult(
        `Published successfully. ${result.title} is now live as ${result.identifier}.`
      );
      setSongTitle('');
      setSongArtist('');
      setSongLanguage('');
      setSongMood('');
      setSongNotes('');
      setAudioFile(null);
      setSongCoverFile(null);
      setSongCoverCrop(defaultCrop());
      emitMediaRefresh();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'Song publishing failed.'
      );
    } finally {
      setIsPublishingSong(false);
    }
  };

  const handleToggleSongSelection = (songId: string) => {
    setSelectedSongIds((current) =>
      current.includes(songId)
        ? current.filter((id) => id !== songId)
        : [...current, songId]
    );
  };

  const handlePublishPlaylist = async () => {
    setError(null);
    setPlaylistResult(null);
    setIsPublishingPlaylist(true);

    try {
      const result = await publishPlaylist({
        title: playlistTitle,
        description: playlistDescription,
        songs: selectedSongs.map(mapSongToPlaylistReference),
        coverFile: playlistCoverFile,
        coverCrop: playlistCoverFile ? playlistCoverCrop : undefined,
      });

      setPlaylistResult(
        `Published successfully. Playlist ${result.title} is now live as ${result.identifier}.`
      );
      setPlaylistTitle('');
      setPlaylistDescription('');
      setPlaylistCoverFile(null);
      setPlaylistCoverCrop(defaultCrop());
      setSelectedSongIds([]);
      emitMediaRefresh();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'Playlist publishing failed.'
      );
    } finally {
      setIsPublishingPlaylist(false);
    }
  };

  const moveSelectedSong = (songId: string, direction: -1 | 1) => {
    setSelectedSongIds((current) => {
      const index = current.indexOf(songId);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow="PUBLISH"
        title="Publish songs now, then assemble and publish playlists on the same clean stack."
        description="This route now uses the new qapp-core-based publish helper instead of the old modal chain. Song publishing writes AUDIO and optional THUMBNAIL resources, and playlist publishing writes PLAYLIST plus optional cover."
      />

      {!publisher ? (
        <Alert severity="warning">
          Log in through Qortal before trying to publish audio or playlists.
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {songResult ? <Alert severity="success">{songResult}</Alert> : null}
      {playlistResult ? (
        <Alert severity="success">{playlistResult}</Alert>
      ) : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap>
        <Chip
          color={songPublishReady ? 'success' : 'default'}
          label={
            songPublishReady
              ? 'Song publish ready'
              : 'Song publish needs title, artist and audio file'
          }
        />
        <Chip
          color={playlistPublishReady ? 'success' : 'default'}
          label={
            playlistPublishReady
              ? 'Playlist publish ready'
              : 'Playlist publish needs title and at least one song'
          }
        />
        <Chip
          variant="outlined"
          label={`${songs.length} songs loaded for playlist drafting`}
        />
      </Stack>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              p: 3,
              background:
                'linear-gradient(180deg, rgba(18,24,33,0.9) 0%, rgba(11,16,24,0.98) 100%)',
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h4">Publish Song</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Build the song metadata first, then attach audio and optional
                artwork. Keep this form lean so publishing stays fast.
              </Typography>
              <TextField
                label="Title"
                value={songTitle}
                onChange={(event) => setSongTitle(event.target.value)}
                error={Boolean(songTitleError)}
                helperText={songTitleError || 'Visible title for listeners'}
              />
              <TextField
                label="Artist"
                value={songArtist}
                onChange={(event) => setSongArtist(event.target.value)}
                error={Boolean(songArtistError)}
                helperText={songArtistError || 'Artist or project name'}
              />
              <TextField
                select
                label="Genre"
                value={songGenre}
                onChange={(event) => setSongGenre(event.target.value)}
              >
                {[
                  'Electronic',
                  'Pop',
                  'Rock',
                  'Ambient',
                  'Hip Hop',
                  'Jazz',
                ].map((genre) => (
                  <MenuItem key={genre} value={genre}>
                    {genre}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Language"
                value={songLanguage}
                onChange={(event) => setSongLanguage(event.target.value)}
              />
              <TextField
                label="Mood"
                value={songMood}
                onChange={(event) => setSongMood(event.target.value)}
              />
              <TextField
                label="Notes"
                multiline
                minRows={3}
                value={songNotes}
                onChange={(event) => setSongNotes(event.target.value)}
                helperText="Optional context, credits or release notes"
              />
              <Button component="label" variant="outlined">
                {audioFile ? `Audio: ${audioFile.name}` : 'Choose audio file'}
                <input
                  hidden
                  type="file"
                  accept="audio/*"
                  onChange={(event) =>
                    setAudioFile(event.target.files?.[0] || null)
                  }
                />
              </Button>
              <Button component="label" variant="outlined">
                {songCoverFile
                  ? `Cover: ${songCoverFile.name}`
                  : 'Choose cover image'}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    setSongCoverFile(event.target.files?.[0] || null);
                    setSongCoverCrop(defaultCrop());
                  }}
                />
              </Button>
              {songCoverPreview ? (
                <Stack spacing={1.5}>
                  <CropPreview
                    src={songCoverPreview}
                    alt="Song cover preview"
                    crop={songCoverCrop}
                    onChange={setSongCoverCrop}
                  />
                  <CropControls
                    crop={songCoverCrop}
                    onChange={setSongCoverCrop}
                  />
                </Stack>
              ) : null}
              <SectionCard
                kicker="READY CHECK"
                title={
                  songPublishReady
                    ? 'Song is ready to publish'
                    : 'Finish the required fields'
                }
                body={
                  songPublishReady
                    ? 'Audio file, title and artist are in place.'
                    : 'Add title, artist and an audio file before publishing.'
                }
                meta={[
                  audioFile ? audioFile.name : 'No audio file',
                  songCoverFile ? 'Cover attached' : 'No cover',
                ]}
              />
              <Button
                variant="contained"
                onClick={handlePublishSong}
                disabled={!songPublishReady || isPublishingSong}
              >
                {isPublishingSong ? 'Publishing...' : 'Publish song'}
              </Button>
            </Stack>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              p: 3,
              background:
                'linear-gradient(180deg, rgba(18,24,33,0.9) 0%, rgba(11,16,24,0.98) 100%)',
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h4">Publish Playlist</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Draft the playlist, choose a cover and keep the ordering tight
                before writing it to QDN.
              </Typography>
              <TextField
                label="Playlist title"
                value={playlistTitle}
                onChange={(event) => setPlaylistTitle(event.target.value)}
                error={Boolean(playlistTitleError)}
                helperText={
                  playlistTitleError || 'Short, readable name for the playlist'
                }
              />
              <TextField
                label="Description"
                multiline
                minRows={3}
                value={playlistDescription}
                onChange={(event) => setPlaylistDescription(event.target.value)}
                helperText="Optional description shown on the playlist page"
              />
              <Button component="label" variant="outlined">
                {playlistCoverFile
                  ? `Playlist cover: ${playlistCoverFile.name}`
                  : 'Choose playlist cover'}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    setPlaylistCoverFile(event.target.files?.[0] || null);
                    setPlaylistCoverCrop(defaultCrop());
                  }}
                />
              </Button>
              {playlistCoverPreview ? (
                <Stack spacing={1.5}>
                  <CropPreview
                    src={playlistCoverPreview}
                    alt="Playlist cover preview"
                    crop={playlistCoverCrop}
                    onChange={setPlaylistCoverCrop}
                  />
                  <CropControls
                    crop={playlistCoverCrop}
                    onChange={setPlaylistCoverCrop}
                  />
                </Stack>
              ) : null}

              <SectionCard
                kicker="SONG PICKER"
                title="Select songs for the playlist"
                body="Use the latest loaded songs as a quick drafting set. This will become a richer library picker later."
                meta={[
                  `${selectedSongs.length} selected`,
                  `${songs.length} available`,
                ]}
              />

              <TextField
                label="Filter loaded songs"
                value={songPickerQuery}
                onChange={(event) => setSongPickerQuery(event.target.value)}
                helperText="Search by title, artist or publisher"
              />

              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                sx={{ maxHeight: 190, overflowY: 'auto', pr: 0.5 }}
              >
                {visibleSongOptions.map((song) => {
                  const selected = selectedSongIds.includes(song.id);
                  return (
                    <Chip
                      key={song.id}
                      label={`${song.title} • ${song.artist}`}
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      onClick={() => handleToggleSongSelection(song.id)}
                    />
                  );
                })}
              </Stack>
              {selectedSongs.length ? (
                <Stack
                  spacing={1}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2.5,
                    px: 1.5,
                    py: 1.25,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Typography variant="subtitle2">Selected order</Typography>
                  {selectedSongs.map((song, index) => (
                    <Stack
                      key={song.id}
                      direction="row"
                      spacing={1}
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        px: 1.5,
                        py: 1,
                      }}
                    >
                      <Typography variant="body2">
                        {index + 1}. {song.title} • {song.artist}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          onClick={() => moveSelectedSong(song.id, -1)}
                          disabled={index === 0}
                        >
                          Up
                        </Button>
                        <Button
                          size="small"
                          onClick={() => moveSelectedSong(song.id, 1)}
                          disabled={index === selectedSongs.length - 1}
                        >
                          Down
                        </Button>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              ) : null}

              <SectionCard
                kicker="READY CHECK"
                title={
                  playlistPublishReady
                    ? 'Playlist is ready to publish'
                    : 'Choose a title and songs'
                }
                body={
                  playlistPublishReady
                    ? 'Title and track selection are ready.'
                    : 'Playlist publishing needs a title and at least one selected song.'
                }
                meta={[
                  `${selectedSongs.length} selected`,
                  playlistCoverFile ? 'Cover attached' : 'No cover',
                ]}
              />

              <Button
                variant="contained"
                onClick={handlePublishPlaylist}
                disabled={!playlistPublishReady || isPublishingPlaylist}
              >
                {isPublishingPlaylist ? 'Publishing...' : 'Publish playlist'}
              </Button>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Stack>
  );
};
