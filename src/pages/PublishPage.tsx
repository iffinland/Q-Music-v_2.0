import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  startTransition,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ImageLightbox } from '../components/common/ImageLightbox';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import {
  mapSongToPlaylistReference,
  useMediaPublish,
  type CoverCropSettings,
  type PreparedSongPublish,
} from '../hooks/useMediaPublish';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { usePlaylistsFeed } from '../hooks/usePlaylistsFeed';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { fetchPlaylistDetail } from '../services/playlists';
import type { PlaylistSongReference } from '../types/media';
import { emitMediaRefresh } from '../utils/mediaEvents';
import {
  parseFolderSelection,
  type FolderSongImportDraft,
} from '../utils/publishFolder';

const directoryInputAttributes = {
  webkitdirectory: '',
  directory: '',
} as Record<string, string>;

const defaultCrop = (): CoverCropSettings => ({
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
});

const defaultSongGenre = 'Electronic';

const songGenres = [
  'Electronic',
  'Pop',
  'Rock',
  'Ambient',
  'Hip Hop',
  'Jazz',
];

type PublishMode = 'single' | 'folder';
type PlaylistMode = 'none' | 'new' | 'existing';
type StepState = 'locked' | 'ready' | 'active' | 'complete';

const StepPanel = ({
  step,
  title,
  description,
  state,
  children,
}: {
  step: number;
  title: string;
  description: string;
  state: StepState;
  children: ReactNode;
}) => {
  const chipColor =
    state === 'complete' ? 'success' : state === 'active' ? 'primary' : 'default';
  const chipLabel =
    state === 'complete'
      ? 'Complete'
      : state === 'active'
        ? 'In Progress'
        : state === 'ready'
          ? 'Ready'
          : 'Locked';

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 3,
        background: 'var(--qm-panel-bg)',
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Box>
            <Typography variant="overline" sx={{ color: 'primary.main' }}>
              Step {step}
            </Typography>
            <Typography variant="h5">{title}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {description}
            </Typography>
          </Box>
          <Chip color={chipColor} variant="outlined" label={chipLabel} />
        </Stack>
        {children}
      </Stack>
    </Box>
  );
};

const CropPreview = ({
  src,
  alt,
  crop,
  onChange,
  previewLabel = 'Open large preview',
}: {
  src: string;
  alt: string;
  crop: CoverCropSettings;
  onChange: (crop: CoverCropSettings) => void;
  previewLabel?: string;
}) => {
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const frameRef = useRef<number | null>(null);

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

          if (frameRef.current) {
            window.cancelAnimationFrame(frameRef.current);
          }

          frameRef.current = window.requestAnimationFrame(() => {
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
          backgroundColor: 'var(--qm-surface-soft)',
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
      </Box>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', maxWidth: 220 }}
      >
        Drag the image to reposition. Use the mouse wheel for quick zoom and the
        sliders below for fine adjustment.
      </Typography>
      <ImageLightbox src={src} alt={alt}>
        {({ open }) => (
          <Button variant="outlined" size="small" onClick={open}>
            {previewLabel}
          </Button>
        )}
      </ImageLightbox>
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

const toPlaylistKey = (song: { publisher: string; identifier: string }) =>
  `${song.publisher}:${song.identifier}`;

const uniquePlaylistSongs = (songs: PlaylistSongReference[]) => {
  const seen = new Set<string>();
  return songs.filter((song) => {
    const key = toPlaylistKey(song);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const PublishPage = () => {
  const {
    publisher,
    buildPlaylistPublish,
    buildSongPublish,
    getBatchStatuses,
    publishPlaylist,
    publishPlaylistResourceBatch,
    publishPlaylistThumbnailBatch,
    publishSong,
    publishSongAudioBatch,
    publishSongThumbnailBatch,
  } = useMediaPublish();
  const { songs } = useSongsFeed(18);
  const { playlists } = usePlaylistsFeed(80);
  const [mode, setMode] = useState<PublishMode>('single');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songAlbum, setSongAlbum] = useState('');
  const [songGenre, setSongGenre] = useState(defaultSongGenre);
  const [songLanguage, setSongLanguage] = useState('');
  const [songMood, setSongMood] = useState('');
  const [songNotes, setSongNotes] = useState('');
  const [songPublishedDate, setSongPublishedDate] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [songCoverFile, setSongCoverFile] = useState<File | null>(null);
  const [songCoverCrop, setSongCoverCrop] =
    useState<CoverCropSettings>(defaultCrop());
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [playlistPublishedDate, setPlaylistPublishedDate] = useState('');
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
  const [folderSongs, setFolderSongs] = useState<FolderSongImportDraft[]>([]);
  const [folderWarnings, setFolderWarnings] = useState<string[]>([]);
  const [folderMetadataFiles, setFolderMetadataFiles] = useState<string[]>([]);
  const [folderBulkArtist, setFolderBulkArtist] = useState('');
  const [folderBulkAlbum, setFolderBulkAlbum] = useState('');
  const [folderBulkGenre, setFolderBulkGenre] = useState(defaultSongGenre);
  const [folderBulkLanguage, setFolderBulkLanguage] = useState('');
  const [folderBulkMood, setFolderBulkMood] = useState('');
  const [folderBulkNotes, setFolderBulkNotes] = useState('');
  const [folderBulkPublishedDate, setFolderBulkPublishedDate] = useState('');
  const [folderBulkCoverFile, setFolderBulkCoverFile] = useState<File | null>(
    null
  );
  const [folderPlaylistMode, setFolderPlaylistMode] =
    useState<PlaylistMode>('new');
  const [folderPlaylistTitle, setFolderPlaylistTitle] = useState('');
  const [folderPlaylistDescription, setFolderPlaylistDescription] =
    useState('');
  const [folderPlaylistPublishedDate, setFolderPlaylistPublishedDate] =
    useState('');
  const [folderPlaylistCoverFile, setFolderPlaylistCoverFile] =
    useState<File | null>(null);
  const [folderPlaylistCoverCrop, setFolderPlaylistCoverCrop] =
    useState<CoverCropSettings>(defaultCrop());
  const [existingPlaylistIdentifier, setExistingPlaylistIdentifier] =
    useState('');
  const [folderBatchResult, setFolderBatchResult] = useState<string | null>(
    null
  );
  const [folderPublishPhase, setFolderPublishPhase] = useState<string | null>(
    null
  );
  const [batchIdentifiers, setBatchIdentifiers] = useState<string[]>([]);
  const [isPublishingFolder, setIsPublishingFolder] = useState(false);
  const [folderQuery, setFolderQuery] = useState('');
  const songCoverPreview = useObjectUrl(songCoverFile);
  const playlistCoverPreview = useObjectUrl(playlistCoverFile);
  const folderPlaylistCoverPreview = useObjectUrl(folderPlaylistCoverFile);
  const deferredSongPickerQuery = useDeferredValue(songPickerQuery);
  const deferredFolderQuery = useDeferredValue(folderQuery);

  const selectedSongs = useMemo(
    () => songs.filter((song) => selectedSongIds.includes(song.id)),
    [selectedSongIds, songs]
  );
  const visibleSongOptions = useMemo(() => {
    const normalizedQuery = deferredSongPickerQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return songs;
    }

    return songs.filter((song) =>
      [song.title, song.artist, song.publisher]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [deferredSongPickerQuery, songs]);
  const ownPlaylists = useMemo(
    () =>
      playlists.filter(
        (playlist) =>
          publisher &&
          playlist.publisher.toLowerCase() === publisher.toLowerCase()
      ),
    [playlists, publisher]
  );
  const visibleFolderSongs = useMemo(() => {
    const normalizedQuery = deferredFolderQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return folderSongs;
    }

    return folderSongs.filter((song) =>
      [song.relativePath, song.title, song.artist, song.album]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [deferredFolderQuery, folderSongs]);
  const folderSongCountReady = useMemo(
    () =>
      folderSongs.filter(
        (song) =>
          Boolean(song.file) &&
          song.title.trim().length > 0 &&
          song.artist.trim().length > 0
      ).length,
    [folderSongs]
  );
  const folderSongsMissingRequired = folderSongs.length - folderSongCountReady;
  const folderSongsWithMetadata = useMemo(
    () => folderSongs.filter((song) => Boolean(song.metadataSource)).length,
    [folderSongs]
  );
  const folderSongsWithCover = useMemo(
    () => folderSongs.filter((song) => Boolean(song.coverFile)).length,
    [folderSongs]
  );
  const folderSelectState: StepState = folderSongs.length ? 'complete' : 'active';
  const folderReviewState: StepState = folderSongs.length ? 'active' : 'locked';
  const folderBulkState: StepState = folderSongs.length ? 'ready' : 'locked';
  const folderTracksState: StepState = folderSongs.length ? 'ready' : 'locked';
  const folderPlaylistState: StepState =
    folderSongs.length && folderSongCountReady === folderSongs.length
      ? 'ready'
      : folderSongs.length
        ? 'active'
        : 'locked';
  const batchStatuses = getBatchStatuses(batchIdentifiers);
  const songPublishReady =
    Boolean(publisher) &&
    Boolean(audioFile) &&
    songTitle.trim().length > 0 &&
    songArtist.trim().length > 0;
  const playlistPublishReady =
    Boolean(publisher) &&
    playlistTitle.trim().length > 0 &&
    playlistDescription.trim().length > 0 &&
    selectedSongs.length > 0;
  const folderPublishReady =
    Boolean(publisher) &&
    folderSongs.length > 0 &&
    folderSongCountReady === folderSongs.length &&
    (folderPlaylistMode === 'none'
      ? true
      : folderPlaylistMode === 'existing'
        ? Boolean(existingPlaylistIdentifier)
        : folderPlaylistTitle.trim().length > 0 &&
          folderPlaylistDescription.trim().length > 0);
  const folderPublishState: StepState = folderPublishReady
    ? 'ready'
    : folderSongs.length
      ? 'active'
      : 'locked';

  const resetSingleSong = () => {
    setSongTitle('');
    setSongArtist('');
    setSongAlbum('');
    setSongGenre(defaultSongGenre);
    setSongLanguage('');
    setSongMood('');
    setSongNotes('');
    setSongPublishedDate('');
    setAudioFile(null);
    setSongCoverFile(null);
    setSongCoverCrop(defaultCrop());
  };

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
        album: songAlbum,
        genre: songGenre,
        language: songLanguage,
        mood: songMood,
        notes: songNotes,
        publishedDate: songPublishedDate,
        audioFile,
        coverFile: songCoverFile,
        coverCrop: songCoverFile ? songCoverCrop : undefined,
      });

      setSongResult(
        `Published successfully. ${result.title} is now live as ${result.identifier}.`
      );
      resetSingleSong();
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
        publishedDate: playlistPublishedDate,
        songs: selectedSongs.map(mapSongToPlaylistReference),
        coverFile: playlistCoverFile,
        coverCrop: playlistCoverFile ? playlistCoverCrop : undefined,
      });

      setPlaylistResult(
        `Published successfully. Playlist ${result.title} is now live as ${result.identifier}.`
      );
      setPlaylistTitle('');
      setPlaylistDescription('');
      setPlaylistPublishedDate('');
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

  const handleFolderImport = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    setError(null);
    setFolderBatchResult(null);

    try {
      const imported = await parseFolderSelection([...files], {
        defaultArtist: folderBulkArtist,
        defaultGenre: folderBulkGenre,
      });

      startTransition(() => {
        setFolderSongs(imported.songs);
        setFolderWarnings(imported.warnings);
        setFolderMetadataFiles(imported.metadataFiles);
        setFolderPlaylistTitle(
          imported.songs[0]?.relativePath.split('/')[0] || folderPlaylistTitle
        );
      });
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Folder import failed.'
      );
    }
  };

  const updateFolderSong = (
    songId: string,
    update: Partial<FolderSongImportDraft>
  ) => {
    setFolderSongs((current) =>
      current.map((song) => (song.id === songId ? { ...song, ...update } : song))
    );
  };

  const applyBulkMetadata = () => {
    setFolderSongs((current) =>
      current.map((song) => ({
        ...song,
        artist: folderBulkArtist || song.artist,
        album: folderBulkAlbum || song.album,
        genre: folderBulkGenre || song.genre,
        language: folderBulkLanguage || song.language,
        mood: folderBulkMood || song.mood,
        notes: folderBulkNotes || song.notes,
        publishedDate: folderBulkPublishedDate || song.publishedDate,
        coverFile: folderBulkCoverFile || song.coverFile,
      }))
    );
  };

  const applyBulkMetadataToEmpty = () => {
    setFolderSongs((current) =>
      current.map((song) => ({
        ...song,
        artist: song.artist || folderBulkArtist,
        album: song.album || folderBulkAlbum,
        genre: song.genre || folderBulkGenre,
        language: song.language || folderBulkLanguage,
        mood: song.mood || folderBulkMood,
        notes: song.notes || folderBulkNotes,
        publishedDate: song.publishedDate || folderBulkPublishedDate,
        coverFile: song.coverFile || folderBulkCoverFile,
      }))
    );
  };

  const buildFolderPlaylistInput = async (preparedSongs: PreparedSongPublish[]) => {
    if (folderPlaylistMode === 'none') {
      return null;
    }

    const publishedSongs = preparedSongs.map((song) => ({
      identifier: song.identifier,
      publisher: song.publisher,
      title: song.title,
      artist: song.artist,
    }));

    if (folderPlaylistMode === 'new') {
      return buildPlaylistPublish({
        title: folderPlaylistTitle,
        description: folderPlaylistDescription,
        publishedDate: folderPlaylistPublishedDate,
        songs: publishedSongs,
        coverFile: folderPlaylistCoverFile,
        coverCrop: folderPlaylistCoverFile ? folderPlaylistCoverCrop : undefined,
      });
    }

    if (!publisher || !existingPlaylistIdentifier) {
      throw new Error('Choose an existing playlist before publishing.');
    }

    const existingPlaylist = await fetchPlaylistDetail(
      publisher,
      existingPlaylistIdentifier
    );

    if (!existingPlaylist) {
      throw new Error('Existing playlist could not be loaded from QDN.');
    }

    const mergedSongs = uniquePlaylistSongs([
      ...existingPlaylist.songs,
      ...publishedSongs,
    ]);
    const nextTitle = folderPlaylistTitle.trim() || existingPlaylist.title;
    const nextDescription =
      folderPlaylistDescription.trim() || existingPlaylist.description || '';

    if (!nextDescription.trim()) {
      throw new Error(
        'Playlist description is required when updating an existing playlist.'
      );
    }

    return buildPlaylistPublish({
      title: nextTitle,
      description: nextDescription,
      publishedDate:
        folderPlaylistPublishedDate.trim() || new Date().toISOString().slice(0, 10),
      songs: mergedSongs,
      coverFile: folderPlaylistCoverFile,
      coverCrop: folderPlaylistCoverFile ? folderPlaylistCoverCrop : undefined,
      existingIdentifier: existingPlaylist.identifier,
    });
  };

  const handlePublishFolder = async () => {
    if (!folderSongs.length) {
      setError('Import a folder with audio files before publishing.');
      return;
    }

    const invalidSong = folderSongs.find(
      (song) => !song.title.trim() || !song.artist.trim()
    );
    if (invalidSong) {
      setError(
        `Title and artist are required for every song. Check ${invalidSong.relativePath}.`
      );
      return;
    }

    if (
      folderPlaylistMode === 'new' &&
      (!folderPlaylistTitle.trim() || !folderPlaylistDescription.trim())
    ) {
      setError('Playlist title and short description are required.');
      return;
    }

    setError(null);
    setFolderBatchResult(null);
    setIsPublishingFolder(true);

    try {
      setFolderPublishPhase('Preparing folder resources...');
      const preparedSongs = await Promise.all(
        folderSongs.map((song) =>
          buildSongPublish({
            title: song.title,
            artist: song.artist,
            album: song.album,
            genre: song.genre,
            language: song.language,
            mood: song.mood,
            notes: song.notes,
            publishedDate: song.publishedDate,
            audioFile: song.file,
            coverFile: song.coverFile,
          })
        )
      );

      setBatchIdentifiers(preparedSongs.map((song) => song.identifier));
      setFolderPublishPhase(
        `Confirm the audio publish transaction for ${preparedSongs.length} songs.`
      );
      await publishSongAudioBatch(preparedSongs);

      const songsWithThumbnails = preparedSongs.filter(
        (song) => Boolean(song.thumbnailResource)
      );
      if (songsWithThumbnails.length) {
        setFolderPublishPhase(
          `Confirm the thumbnail publish transaction for ${songsWithThumbnails.length} songs.`
        );
        await publishSongThumbnailBatch(preparedSongs);
      }

      const preparedPlaylist = await buildFolderPlaylistInput(preparedSongs);
      if (preparedPlaylist) {
        setBatchIdentifiers([preparedPlaylist.identifier]);
        setFolderPublishPhase(
          `Confirm the playlist publish transaction for ${preparedPlaylist.title}.`
        );
        await publishPlaylistResourceBatch(preparedPlaylist);

        if (preparedPlaylist.thumbnailResource) {
          setFolderPublishPhase('Confirm the playlist cover transaction.');
          await publishPlaylistThumbnailBatch(preparedPlaylist);
        }
      }

      setFolderBatchResult(
        `Folder publish finished. ${preparedSongs.length} songs were sent to QDN${preparedPlaylist ? ` and playlist ${preparedPlaylist.title} was updated.` : '.'}`
      );
      emitMediaRefresh();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'Folder publishing failed.'
      );
    } finally {
      setIsPublishingFolder(false);
      setFolderPublishPhase(null);
      setBatchIdentifiers([]);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow=""
        title="Publish one song or batch a whole folder through the same route."
        description="Single-file publishing stays intact. Folder publishing prepares song audio in one multi-resource transaction, then sends thumbnails and playlist payloads in separate steps for better reliability."
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
      {folderBatchResult ? (
        <Alert severity="success">{folderBatchResult}</Alert>
      ) : null}
      {folderPublishPhase && !error ? (
        <Alert severity="info">{folderPublishPhase}</Alert>
      ) : null}

      <Tabs value={mode} onChange={(_, value) => setMode(value)}>
        <Tab value="single" label="Single File" />
        <Tab value="folder" label="Folder Batch" />
      </Tabs>

      {mode === 'single' ? (
        <>
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
                  : 'Playlist publish needs title, description and songs'
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
                  borderRadius: 2,
                  p: 3,
                  background: 'var(--qm-panel-bg)',
                }}
              >
                <Stack spacing={2}>
                  <Typography variant="h4">Publish Song</Typography>
                  <TextField
                    label="Title"
                    value={songTitle}
                    onChange={(event) => setSongTitle(event.target.value)}
                  />
                  <TextField
                    label="Artist"
                    value={songArtist}
                    onChange={(event) => setSongArtist(event.target.value)}
                  />
                  <TextField
                    label="Album"
                    value={songAlbum}
                    onChange={(event) => setSongAlbum(event.target.value)}
                  />
                  <TextField
                    select
                    label="Genre"
                    value={songGenre}
                    onChange={(event) => setSongGenre(event.target.value)}
                  >
                    {songGenres.map((genre) => (
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
                    label="Publication date"
                    type="date"
                    value={songPublishedDate}
                    onChange={(event) => setSongPublishedDate(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="Notes"
                    multiline
                    minRows={3}
                    value={songNotes}
                    onChange={(event) => setSongNotes(event.target.value)}
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
                  borderRadius: 2,
                  p: 3,
                  background: 'var(--qm-panel-bg)',
                }}
              >
                <Stack spacing={2}>
                  <Typography variant="h4">Publish Playlist</Typography>
                  <TextField
                    label="Playlist title"
                    value={playlistTitle}
                    onChange={(event) => setPlaylistTitle(event.target.value)}
                  />
                  <TextField
                    label="Short description"
                    multiline
                    minRows={3}
                    value={playlistDescription}
                    onChange={(event) => setPlaylistDescription(event.target.value)}
                  />
                  <TextField
                    label="Publication date"
                    type="date"
                    value={playlistPublishedDate}
                    onChange={(event) =>
                      setPlaylistPublishedDate(event.target.value)
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
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
                    <Stack spacing={1}>
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
                        : 'Choose title, description and songs'
                    }
                    body={
                      playlistPublishReady
                        ? 'Title, description and track selection are ready.'
                        : 'Playlist publishing needs a title, a short description and at least one selected song.'
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
        </>
      ) : (
        <Stack spacing={2.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap>
            <Chip
              color={folderPublishReady ? 'success' : 'default'}
              label={
                folderPublishReady
                  ? 'Folder batch ready'
                  : 'Folder batch needs valid song rows and playlist settings'
              }
            />
            <Chip
              variant="outlined"
              label={`${folderSongCountReady}/${folderSongs.length} songs valid`}
            />
            <Chip
              variant="outlined"
              label={`${folderMetadataFiles.length} metadata files detected`}
            />
          </Stack>

          <StepPanel
            step={1}
            title="Select Folder"
            description="Choose the source folder once. Audio files, CSV/TXT metadata and matching cover images will be scanned automatically."
            state={folderSelectState}
          >
            <Alert severity="info">
              Folder upload is available in this `Folder Batch` view, not in `Single
              File`.
            </Alert>
            <Button component="label" variant="contained" sx={{ alignSelf: 'flex-start' }}>
              Select folder
              <input
                {...directoryInputAttributes}
                hidden
                multiple
                type="file"
                onChange={(event) => {
                  void handleFolderImport(event.target.files);
                  event.target.value = '';
                }}
              />
            </Button>
            {folderMetadataFiles.length ? (
              <Alert severity="info">
                Metadata files: {folderMetadataFiles.join(', ')}
              </Alert>
            ) : null}
            {folderWarnings.map((warning) => (
              <Alert key={warning} severity="warning">
                {warning}
              </Alert>
            ))}
          </StepPanel>

          <StepPanel
            step={2}
            title="Review Import"
            description="Check what the importer found before applying shared defaults or editing individual songs."
            state={folderReviewState}
          >
            {folderSongs.length ? (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap>
                <Chip label={`${folderSongs.length} audio files`} variant="outlined" />
                <Chip
                  label={`${folderSongsWithMetadata} metadata matches`}
                  variant="outlined"
                />
                <Chip label={`${folderSongsWithCover} covers matched`} variant="outlined" />
                <Chip
                  color={folderSongsMissingRequired === 0 ? 'success' : 'warning'}
                  label={
                    folderSongsMissingRequired === 0
                      ? 'All required fields complete'
                      : `${folderSongsMissingRequired} songs need title or artist`
                  }
                />
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Import a folder first to see the detected files and metadata matches.
              </Typography>
            )}
          </StepPanel>

          <StepPanel
            step={3}
            title="Apply Bulk Metadata"
            description="Set shared metadata once, then fill empty song rows or overwrite imported values where needed."
            state={folderBulkState}
          >
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Artist"
                  value={folderBulkArtist}
                  onChange={(event) => setFolderBulkArtist(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Album"
                  value={folderBulkAlbum}
                  onChange={(event) => setFolderBulkAlbum(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  select
                  label="Genre"
                  value={folderBulkGenre}
                  onChange={(event) => setFolderBulkGenre(event.target.value)}
                >
                  {songGenres.map((genre) => (
                    <MenuItem key={genre} value={genre}>
                      {genre}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Language"
                  value={folderBulkLanguage}
                  onChange={(event) => setFolderBulkLanguage(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Mood"
                  value={folderBulkMood}
                  onChange={(event) => setFolderBulkMood(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  minRows={3}
                  value={folderBulkNotes}
                  onChange={(event) => setFolderBulkNotes(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Publication date"
                  type="date"
                  value={folderBulkPublishedDate}
                  onChange={(event) => setFolderBulkPublishedDate(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>
            <Button component="label" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
              {folderBulkCoverFile
                ? `Common cover: ${folderBulkCoverFile.name}`
                : 'Choose common cover'}
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setFolderBulkCoverFile(event.target.files?.[0] || null)
                }
              />
            </Button>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <Button
                variant="outlined"
                onClick={applyBulkMetadataToEmpty}
                disabled={!folderSongs.length}
              >
                Apply to empty fields
              </Button>
              <Button
                variant="contained"
                onClick={applyBulkMetadata}
                disabled={!folderSongs.length}
              >
                Overwrite all imported songs
              </Button>
            </Stack>
          </StepPanel>

          <StepPanel
            step={4}
            title="Edit Individual Songs"
            description="Review every imported row. Only audio file, title and artist are required. Album is now supported here as song metadata."
            state={folderTracksState}
          >
            <TextField
              label="Filter imported songs"
              value={folderQuery}
              onChange={(event) => setFolderQuery(event.target.value)}
              helperText="Search by path, title, artist or album"
            />
            {visibleFolderSongs.length ? (
              visibleFolderSongs.map((song, index) => (
                <Stack
                  key={song.id}
                  spacing={1.5}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                  >
                    <Typography variant="subtitle1">
                      {index + 1}. {song.relativePath}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {song.metadataSource
                        ? `Metadata: ${song.metadataSource}`
                        : 'Metadata: manual/default'}
                    </Typography>
                  </Stack>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        label="Title"
                        value={song.title}
                        onChange={(event) =>
                          updateFolderSong(song.id, {
                            title: event.target.value,
                          })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        label="Artist"
                        value={song.artist}
                        onChange={(event) =>
                          updateFolderSong(song.id, {
                            artist: event.target.value,
                          })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        label="Album"
                        value={song.album}
                        onChange={(event) =>
                          updateFolderSong(song.id, {
                            album: event.target.value,
                          })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        fullWidth
                        label="Genre"
                        value={song.genre}
                        onChange={(event) =>
                          updateFolderSong(song.id, {
                            genre: event.target.value,
                          })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        fullWidth
                        label="Language"
                        value={song.language}
                        onChange={(event) =>
                          updateFolderSong(song.id, {
                            language: event.target.value,
                          })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        fullWidth
                        label="Mood"
                        value={song.mood}
                        onChange={(event) =>
                          updateFolderSong(song.id, {
                            mood: event.target.value,
                          })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        fullWidth
                        label="Publication date"
                        type="date"
                        value={song.publishedDate}
                        onChange={(event) =>
                          updateFolderSong(song.id, {
                            publishedDate: event.target.value,
                          })
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        label="Notes"
                        value={song.notes}
                        onChange={(event) =>
                          updateFolderSong(song.id, {
                            notes: event.target.value,
                          })
                        }
                      />
                    </Grid>
                  </Grid>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap>
                    <Button component="label" variant="outlined">
                      {song.coverFile
                        ? `Cover: ${song.coverFile.name}`
                        : 'Choose per-song cover'}
                      <input
                        hidden
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          updateFolderSong(song.id, {
                            coverFile: event.target.files?.[0] || null,
                          })
                        }
                      />
                    </Button>
                    <Chip
                      color={
                        song.title.trim() && song.artist.trim() ? 'success' : 'warning'
                      }
                      label={
                        song.title.trim() && song.artist.trim()
                          ? 'Required fields complete'
                          : 'Title and artist required'
                      }
                    />
                  </Stack>
                </Stack>
              ))
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No imported songs yet.
              </Typography>
            )}
          </StepPanel>

          <StepPanel
            step={5}
            title="Playlist Setup"
            description="Choose whether the imported folder becomes a new playlist, updates an existing playlist, or skips playlist publishing."
            state={folderPlaylistState}
          >
            <TextField
              select
              label="Playlist action"
              value={folderPlaylistMode}
              onChange={(event) =>
                setFolderPlaylistMode(event.target.value as PlaylistMode)
              }
            >
              <MenuItem value="new">Create new playlist</MenuItem>
              <MenuItem value="existing">Add to existing playlist</MenuItem>
              <MenuItem value="none">Do not publish playlist</MenuItem>
            </TextField>
            {folderPlaylistMode === 'existing' ? (
              <TextField
                select
                label="Existing playlist"
                value={existingPlaylistIdentifier}
                onChange={(event) => setExistingPlaylistIdentifier(event.target.value)}
                helperText="Only your published playlists are shown here."
              >
                {ownPlaylists.map((playlist) => (
                  <MenuItem key={playlist.identifier} value={playlist.identifier}>
                    {playlist.title}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            {folderPlaylistMode !== 'none' ? (
              <>
                <TextField
                  label="Playlist title"
                  value={folderPlaylistTitle}
                  onChange={(event) => setFolderPlaylistTitle(event.target.value)}
                  helperText={
                    folderPlaylistMode === 'existing'
                      ? 'Leave blank to keep the current playlist title.'
                      : 'Required for a new playlist.'
                  }
                />
                <TextField
                  label="Short description"
                  multiline
                  minRows={3}
                  value={folderPlaylistDescription}
                  onChange={(event) =>
                    setFolderPlaylistDescription(event.target.value)
                  }
                  helperText={
                    folderPlaylistMode === 'existing'
                      ? 'Leave blank to keep the existing description.'
                      : 'Required for a new playlist.'
                  }
                />
                <TextField
                  label="Publication date"
                  type="date"
                  value={folderPlaylistPublishedDate}
                  onChange={(event) =>
                    setFolderPlaylistPublishedDate(event.target.value)
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button component="label" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                  {folderPlaylistCoverFile
                    ? `Playlist cover: ${folderPlaylistCoverFile.name}`
                    : 'Choose playlist cover'}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      setFolderPlaylistCoverFile(event.target.files?.[0] || null);
                      setFolderPlaylistCoverCrop(defaultCrop());
                    }}
                  />
                </Button>
                {folderPlaylistCoverPreview ? (
                  <Stack spacing={1.5}>
                    <CropPreview
                      src={folderPlaylistCoverPreview}
                      alt="Folder playlist cover preview"
                      crop={folderPlaylistCoverCrop}
                      onChange={setFolderPlaylistCoverCrop}
                    />
                    <CropControls
                      crop={folderPlaylistCoverCrop}
                      onChange={setFolderPlaylistCoverCrop}
                    />
                  </Stack>
                ) : null}
              </>
            ) : null}
          </StepPanel>

          <StepPanel
            step={6}
            title="Publish"
            description="Confirm the batch in separate stages: audio first, thumbnails second, playlist payload last."
            state={folderPublishState}
          >
            <SectionCard
              kicker="BATCH FLOW"
              title="Audio first, then thumbnails, then playlist"
              body="Folder publishing uses one multi-resource transaction for all audio files, then sends thumbnails and playlist data in separate confirmation steps."
              meta={[
                `${folderSongs.length} imported songs`,
                folderPlaylistMode === 'none'
                  ? 'No playlist step'
                  : `Playlist mode: ${folderPlaylistMode}`,
              ]}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap>
              <Chip
                color={folderSongCountReady === folderSongs.length && folderSongs.length > 0 ? 'success' : 'warning'}
                label={`${folderSongCountReady}/${folderSongs.length} songs ready`}
              />
              <Chip
                variant="outlined"
                label={
                  folderPlaylistMode === 'none'
                    ? 'Playlist skipped'
                    : folderPlaylistMode === 'existing'
                      ? 'Existing playlist will be updated'
                      : 'New playlist will be created'
                }
              />
            </Stack>
            <Button
              variant="contained"
              onClick={handlePublishFolder}
              disabled={!folderPublishReady || isPublishingFolder}
              sx={{ alignSelf: 'flex-start' }}
            >
              {isPublishingFolder ? 'Publishing folder...' : 'Publish folder batch'}
            </Button>
          </StepPanel>

          {batchStatuses.length ? (
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 3,
                background: 'var(--qm-panel-bg)',
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="h5">Batch Progress</Typography>
                {batchStatuses.map((status) => (
                  <Stack
                    key={`${status.metadata.service}:${status.metadata.identifier}`}
                    spacing={0.5}
                  >
                    <Typography variant="body2">
                      {status.filename || status.metadata.identifier}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {status.metadata.service} • {status.status.status} •{' '}
                      {status.status.percentLoaded || 0}%
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
};
