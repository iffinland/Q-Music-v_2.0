import { PublicationBadge } from '../components/common/PublicationBadge';
import { isEarBumpIdentifier } from '../utils/mediaOrigin';
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  CloseRounded,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { CoverPicker } from '../components/publishing/CoverPicker';
import {
  useMediaPublish,
  mapSongToPlaylistReference,
} from '../hooks/useMediaPublish';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { usePlaylistsFeed } from '../hooks/usePlaylistsFeed';
import { fetchPlaylistDetail } from '../services/playlists';
import {
  getPublishSnapshot,
  openPublishCenter,
  subscribePublish,
  summarizeJob,
} from '../services/publishing/engine';
import type { PublishResource } from '../services/publishing/types';
import { requestError } from '../services/qdnRequests';
import {
  parseFolderSelection,
  type FolderSongImportDraft,
} from '../utils/publishFolder';
import {
  AUDIO_INPUT_ACCEPT,
  AUDIO_FORMATS_HELP,
  AUDIO_LIMIT_TEXT,
  MAX_JOB_FILES,
  MAX_JOB_FILE_BYTES,
} from '../utils/publishLimits';
import {
  validateAudio,
  getPublishNodeLimit,
} from '../services/publishing/limits';
import type { PlaylistSongReference, SongSummary } from '../types/media';

type Mode = 'song' | 'folder' | 'playlist';
type PlaylistAction = 'none' | 'new' | 'existing';
const titles: Record<Mode, string> = {
  song: 'Publish a song',
  folder: 'Publish an album / folder',
  playlist: 'Create a playlist',
};
const descriptions: Record<Mode, string> = {
  song: 'One audio file, with an optional cover.',
  folder: 'Several audio files, in the order you choose.',
  playlist: 'Arrange songs already published on QDN.',
};
const emptyDetails = () => ({
  album: '',
  genre: '',
  language: '',
  mood: '',
  notes: '',
  publishedDate: '',
});
const keyFor = (song: PlaylistSongReference) =>
  `${song.publisher.toLowerCase()}:${song.identifier}`;
const uniqueSongs = (songs: PlaylistSongReference[]) => [
  ...new Map(songs.map((song) => [keyFor(song), song])).values(),
];
const move = <T,>(items: T[], index: number, direction: number) => {
  const next = [...items],
    target = index + direction;
  if (target >= 0 && target < next.length)
    [next[index], next[target]] = [next[target], next[index]];
  return next;
};
const More = ({
  children,
  title = 'More details',
}: {
  children: ReactNode;
  title?: string;
}) => (
  <Box
    component="details"
    sx={{
      '& summary': { cursor: 'pointer', py: 1, fontWeight: 700 },
      minWidth: 0,
    }}
  >
    <summary>{title}</summary>
    <Stack spacing={2} sx={{ pt: 1 }}>
      {children}
    </Stack>
  </Box>
);
const OrderButtons = ({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (direction: number) => void;
  onRemove: () => void;
}) => (
  <Stack direction="row" spacing={0.25}>
    <IconButton
      size="small"
      aria-label={`Move track ${index + 1} up`}
      disabled={!index}
      onClick={() => onMove(-1)}
    >
      <ArrowUpwardRounded fontSize="small" />
    </IconButton>
    <IconButton
      size="small"
      aria-label={`Move track ${index + 1} down`}
      disabled={index === count - 1}
      onClick={() => onMove(1)}
    >
      <ArrowDownwardRounded fontSize="small" />
    </IconButton>
    <IconButton
      size="small"
      aria-label={`Remove track ${index + 1}`}
      onClick={onRemove}
    >
      <CloseRounded fontSize="small" />
    </IconButton>
  </Stack>
);

// Mount catalogs only for the workflow that actually needs them.
const SongPicker = ({
  selected,
  onChange,
}: {
  selected: SongSummary[];
  onChange: (songs: SongSummary[]) => void;
}) => {
  const [limit, setLimit] = useState(24),
    [query, setQuery] = useState('');
  const feed = useSongsFeed(limit);
  const visible = feed.songs.filter((song) =>
    [song.title, song.artist, song.publisher]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase().trim())
  );
  return (
    <Stack spacing={1.5}>
      <TextField
        label="Find songs in this list"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        fullWidth
      />
      {feed.error && (
        <Alert
          severity="warning"
          action={<Button onClick={feed.retry}>Retry</Button>}
        >
          {feed.error}
        </Alert>
      )}
      <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
        {visible.map((song) => (
          <FormControlLabel
            key={keyFor(song)}
            sx={{
              display: 'flex',
              m: 0,
              '& .MuiFormControlLabel-label': {
                minWidth: 0,
                overflowWrap: 'anywhere',
              },
            }}
            control={
              <Checkbox
                checked={selected.some((item) => keyFor(item) === keyFor(song))}
                onChange={(_, checked) =>
                  onChange(
                    checked
                      ? [...selected, song]
                      : selected.filter((item) => keyFor(item) !== keyFor(song))
                  )
                }
              />
            }
            label={
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                flexWrap="wrap"
              >
                <span>
                  {song.title} • {song.artist}
                </span>
                <PublicationBadge identifier={song.identifier} />
              </Stack>
            }
          />
        ))}
        {!visible.length && !feed.isLoading && (
          <Typography color="text.secondary">
            No matching songs in the loaded list.
          </Typography>
        )}
      </Box>
      {feed.isLoading && <LinearProgress />}
      {feed.hasMore && (
        <Button
          disabled={feed.isLoading}
          onClick={() => setLimit((value) => value + 100)}
        >
          Load more songs
        </Button>
      )}
    </Stack>
  );
};
const OwnedPlaylists = ({
  publisher,
  value,
  onChange,
}: {
  publisher: string;
  value: string;
  onChange: (id: string) => void;
}) => {
  const [limit, setLimit] = useState(24);
  const feed = usePlaylistsFeed(limit, publisher);
  return (
    <Stack spacing={1}>
      <TextField
        select
        label="Existing playlist"
        value={value}
        fullWidth
        onChange={(event) => onChange(event.target.value)}
      >
        {feed.playlists
          .filter(
            (playlist) =>
              playlist.publisher.toLowerCase() === publisher.toLowerCase() &&
              !isEarBumpIdentifier(playlist.identifier)
          )
          .map((playlist) => (
            <MenuItem key={playlist.identifier} value={playlist.identifier}>
              {playlist.title}
            </MenuItem>
          ))}
      </TextField>
      {feed.error && (
        <Alert
          severity="warning"
          action={<Button onClick={feed.retry}>Retry</Button>}
        >
          {feed.error}
        </Alert>
      )}
      {feed.isLoading && <LinearProgress />}
      {feed.hasMore && (
        <Button
          onClick={() => setLimit((count) => count + 100)}
          disabled={feed.isLoading}
        >
          Load more playlists
        </Button>
      )}
    </Stack>
  );
};

export const PublishPage = () => {
  const {
    publisher,
    buildSongPublish,
    buildPlaylistPublish,
    publishResourceBatch,
  } = useMediaPublish();
  const publishState = useSyncExternalStore(
    subscribePublish,
    getPublishSnapshot
  );
  const [mode, setMode] = useState<Mode>('song'),
    [open, setOpen] = useState(false);
  const [title, setTitle] = useState(''),
    [artist, setArtist] = useState('');
  const [details, setDetails] = useState(emptyDetails);
  const [audio, setAudio] = useState<File | null>(null),
    [cover, setCover] = useState<File | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [selected, setSelected] = useState<SongSummary[]>([]);
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState<FolderSongImportDraft[]>([]),
    [warnings, setWarnings] = useState<string[]>([]);
  const [playlistAction, setPlaylistAction] = useState<PlaylistAction>('none'),
    [existing, setExisting] = useState('');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState('');
  const [plan, setPlan] = useState<{
    resources: PublishResource[];
    title: string;
    tracks: string[];
    cover: boolean;
    playlist: boolean;
  } | null>(null);
  const [showTrackDetails, setShowTrackDetails] = useState(false);
  const unfinished = publishState.jobs.filter(
    (job) =>
      !job.archived &&
      job.publisher.toLowerCase() === publisher?.toLowerCase() &&
      !summarizeJob(job).complete
  );
  const working = Boolean(
    publishState.activity ||
      publishState.activeJobId ||
      publishState.waitingJobIds.length
  );
  const waiting = unfinished.length > 0 || working;
  const reset = () => {
    setTitle('');
    setArtist('');
    setDetails(emptyDetails());
    setAudio(null);
    setCover(null);
    setCoverBusy(false);
    setSelected([]);
    setDescription('');
    setFolder([]);
    setWarnings([]);
    setPlaylistAction('none');
    setExisting('');
    setPlan(null);
    setError('');
    setShowTrackDetails(false);
  };
  const choose = (next: Mode) => {
    reset();
    setMode(next);
    setOpen(true);
    setNotice('');
  };
  const ready =
    Boolean(publisher) &&
    !busy &&
    !coverBusy &&
    (mode === 'song'
      ? Boolean(audio && title.trim() && artist.trim())
      : mode === 'playlist'
        ? Boolean(title.trim() && selected.length)
        : Boolean(
            folder.length &&
              folder.every(
                (song) =>
                  song.title.trim() && (song.artist.trim() || artist.trim())
              ) &&
              (playlistAction === 'none' ||
                (playlistAction === 'existing' ? existing : title.trim()))
          ));
  const folderBytes = useMemo(
    () => folder.reduce((sum, song) => sum + song.file.size, 0),
    [folder]
  );
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    setPlan(null);
    setPhase('Reading selected files…');
    try {
      const parsed = await parseFolderSelection(Array.from(files));
      if (
        parsed.songs.length > MAX_JOB_FILES ||
        parsed.songs.reduce((sum, song) => sum + song.file.size, 0) >
          MAX_JOB_FILE_BYTES
      )
        throw new Error('Choose up to 200 audio files and 4000 MiB per batch.');
      const nodeLimit = await getPublishNodeLimit();
      for (const song of parsed.songs) {
        try {
          validateAudio(song.file, nodeLimit);
        } catch (failure) {
          throw new Error(`${song.file.name}: ${requestError(failure)}`);
        }
      }
      setFolder(parsed.songs);
      setWarnings(parsed.warnings);
      const path = parsed.songs[0]?.relativePath || '';
      if (!title && path.includes('/')) setTitle(path.split('/')[0]);
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setBusy(false);
      setPhase('');
    }
  };
  const prepare = async () => {
    if (!ready) return;
    setError('');
    setBusy(true);
    setPhase('Checking files and preparing your publication…');
    try {
      const resources: PublishResource[] = [];
      const tracks: string[] = [];
      if (mode === 'song') {
        const song = await buildSongPublish({
          title,
          artist,
          ...details,
          audioFile: audio!,
          coverFile: cover,
        });
        resources.push(
          song.audioResource,
          song.metadataResource,
          ...(song.thumbnailResource ? [song.thumbnailResource] : [])
        );
        tracks.push(song.title);
      } else if (mode === 'playlist') {
        const playlist = await buildPlaylistPublish({
          title,
          description,
          publishedDate: details.publishedDate,
          songs: selected.map(mapSongToPlaylistReference),
          coverFile: cover,
        });
        resources.push(
          playlist.playlistResource,
          ...(playlist.thumbnailResource ? [playlist.thumbnailResource] : [])
        );
        tracks.push(...selected.map((song) => song.title));
      } else {
        // Existing content must load before the first send; a read error is never an empty playlist.
        const previous =
          playlistAction === 'existing'
            ? await fetchPlaylistDetail(publisher!, existing)
            : null;
        if (playlistAction === 'existing' && !previous)
          throw new Error(
            'The existing playlist could not be loaded. Try again before publishing.'
          );
        const limit = await getPublishNodeLimit();
        for (const song of folder) validateAudio(song.file, limit);
        const refs: PlaylistSongReference[] = [];
        for (const [index, draft] of folder.entries()) {
          setPhase(`Preparing song ${index + 1} of ${folder.length}…`);
          const song = await buildSongPublish({
            ...details,
            ...draft,
            artist: draft.artist || artist,
            album: draft.album || details.album || title,
            genre: draft.genre || details.genre,
            language: draft.language || details.language,
            mood: draft.mood || details.mood,
            notes: draft.notes || details.notes,
            publishedDate: draft.publishedDate || details.publishedDate,
            audioFile: draft.file,
            coverFile: cover || draft.coverFile,
          });
          resources.push(
            song.audioResource,
            song.metadataResource,
            ...(song.thumbnailResource ? [song.thumbnailResource] : [])
          );
          refs.push({
            identifier: song.identifier,
            publisher: song.publisher,
            title: song.title,
            artist: song.artist,
          });
          tracks.push(song.title);
        }
        if (playlistAction !== 'none') {
          const playlist = await buildPlaylistPublish({
            title: previous?.title || title.trim(),
            description: description.trim() || previous?.description || '',
            publishedDate: details.publishedDate || previous?.publishedDate,
            songs: uniqueSongs([...(previous?.songs || []), ...refs]),
            coverFile: cover,
            existingIdentifier: previous?.identifier,
          });
          resources.push(
            playlist.playlistResource,
            ...(playlist.thumbnailResource ? [playlist.thumbnailResource] : [])
          );
        }
      }
      setPlan({
        resources,
        title:
          mode === 'folder'
            ? `Album: ${title.trim() || `${folder.length} songs`}`
            : `${mode === 'song' ? 'Song' : 'Playlist'}: ${title.trim()}`,
        tracks,
        cover: resources.some((resource) => resource.service === 'THUMBNAIL'),
        playlist:
          mode === 'playlist' ||
          (mode === 'folder' && playlistAction !== 'none'),
      });
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setBusy(false);
      setPhase('');
    }
  };
  const submit = async () => {
    if (!plan || busy) return;
    setBusy(true);
    setError('');
    setOpen(false);
    try {
      const result = await publishResourceBatch(plan.resources, plan.title);
      if (result.complete) {
        reset();
        setNotice(
          'Publication sent. It may take a little time to appear across the network.'
        );
      } else {
        setNotice(
          'Your publication is saved. Continue it below when you are ready.'
        );
        setPlan(null);
      }
    } catch (failure) {
      setError(requestError(failure));
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };
  const metadataFields = (
    <>
      {(['album', 'genre', 'language', 'mood'] as const).map((field) => (
        <TextField
          key={field}
          label={field[0].toUpperCase() + field.slice(1)}
          value={details[field]}
          onChange={(event) =>
            setDetails((previous) => ({
              ...previous,
              [field]: event.target.value,
            }))
          }
          fullWidth
        />
      ))}
      <TextField
        label="Notes"
        multiline
        minRows={2}
        value={details.notes}
        onChange={(event) =>
          setDetails((previous) => ({ ...previous, notes: event.target.value }))
        }
        fullWidth
      />
      <TextField
        label="Published date"
        type="date"
        value={details.publishedDate}
        slotProps={{ inputLabel: { shrink: true } }}
        onChange={(event) =>
          setDetails((previous) => ({
            ...previous,
            publishedDate: event.target.value,
          }))
        }
        fullWidth
      />
    </>
  );
  return (
    <Stack
      spacing={3}
      sx={{ width: '100%', minWidth: 0, maxWidth: 840, mx: 'auto' }}
    >
      <Box>
        <Typography variant="h4" component="h1">
          Publish music
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Share a song, an album or a playlist.
        </Typography>
      </Box>
      {!publisher && (
        <Alert severity="info">Log in through Qortal to publish.</Alert>
      )}
      {notice && (
        <Alert severity="info" onClose={() => setNotice('')}>
          {notice}{' '}
          <Button component={Link} to="/my-music">
            My music
          </Button>
        </Alert>
      )}
      {(waiting || publishState.error) && (
        <Alert
          severity={publishState.error ? 'warning' : 'info'}
          action={
            <Button onClick={openPublishCenter}>
              {working ? 'Show progress' : 'Continue'}
            </Button>
          }
        >
          {publishState.error ||
            (working
              ? 'Your publication is in progress. You can browse and listen while it finishes.'
              : 'You have an unfinished publication.')}
        </Alert>
      )}
      <Stack spacing={2}>
        {(Object.keys(titles) as Mode[]).map((item) => (
          <Box
            key={item}
            sx={{
              p: { xs: 2, sm: 3 },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="h6">{titles[item]}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
              {descriptions[item]}
            </Typography>
            <Button
              variant="outlined"
              disabled={!publisher || waiting || busy}
              onClick={() => choose(item)}
            >
              Choose{' '}
              {item === 'song'
                ? 'song'
                : item === 'folder'
                  ? 'album / folder'
                  : 'playlist'}
            </Button>
          </Box>
        ))}
      </Stack>
      {publishState.jobs.some(
        (job) => job.publisher.toLowerCase() === publisher?.toLowerCase()
      ) && (
        <Button sx={{ alignSelf: 'flex-start' }} onClick={openPublishCenter}>
          Previous publications
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        fullWidth
        maxWidth="sm"
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 1, sm: 4 },
            width: { xs: 'calc(100% - 16px)', sm: '100%' },
            maxHeight: 'calc(100dvh - 24px)',
            minWidth: 0,
          },
        }}
      >
        <DialogTitle>{plan ? 'Review publication' : titles[mode]}</DialogTitle>
        <DialogContent sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Stack spacing={2.5} sx={{ pt: 1, minWidth: 0 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {busy && (
              <>
                <Typography role="status">
                  {phase || 'Opening Hub confirmation…'}
                </Typography>
                <LinearProgress />
              </>
            )}
            {plan ? (
              <>
                <Typography variant="h6">{plan.title}</Typography>
                <Typography>
                  {plan.tracks.length}{' '}
                  {plan.tracks.length === 1 ? 'song' : 'songs'}
                  {plan.cover ? ' • With cover' : ' • No cover'}
                  {plan.playlist ? ' • Includes playlist' : ''}
                </Typography>
                <Box component="ol" sx={{ pl: 3, my: 0 }}>
                  {plan.tracks.map((track, index) => (
                    <li key={index}>
                      <Typography variant="body2">{track}</Typography>
                    </li>
                  ))}
                </Box>
                <Alert severity="info">
                  Qortal Hub will ask you to approve the publication and its
                  fees. There may be separate confirmations for audio, details,
                  covers and playlists.
                </Alert>
              </>
            ) : (
              <Box
                component="fieldset"
                disabled={busy}
                sx={{
                  border: 0,
                  p: 0,
                  m: 0,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2.5,
                }}
              >
                {(mode === 'song' || mode === 'folder') && (
                  <Typography variant="caption" color="text.secondary">
                    {AUDIO_FORMATS_HELP} {AUDIO_LIMIT_TEXT}
                  </Typography>
                )}
                {mode === 'song' && (
                  <>
                    <Button component="label" variant="outlined">
                      Choose audio file
                      <input
                        aria-label="Audio file"
                        hidden
                        type="file"
                        accept={AUDIO_INPUT_ACCEPT}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setAudio(file);
                          if (file && !title)
                            setTitle(file.name.replace(/\.[^.]+$/, ''));
                          event.target.value = '';
                        }}
                      />
                    </Button>
                    {audio && (
                      <Typography variant="body2">
                        {audio.name} • {(audio.size / 1024 / 1024).toFixed(1)}{' '}
                        MiB
                      </Typography>
                    )}
                    <TextField
                      label="Title"
                      required
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Artist"
                      required
                      value={artist}
                      onChange={(event) => setArtist(event.target.value)}
                      fullWidth
                    />
                  </>
                )}
                {mode === 'folder' && (
                  <>
                    <Button component="label" variant="outlined">
                      Choose audio files
                      <input
                        aria-label="Album audio files"
                        hidden
                        multiple
                        type="file"
                        accept={AUDIO_INPUT_ACCEPT}
                        onChange={(event) => {
                          void importFiles(event.target.files);
                          event.target.value = '';
                        }}
                      />
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      On a phone, select several songs from your file manager.
                      They do not need to be in one folder.
                    </Typography>
                    <More title="Select an entire folder (desktop)">
                      <Button component="label" variant="outlined">
                        Choose folder
                        <input
                          aria-label="Audio folder"
                          hidden
                          multiple
                          type="file"
                          {...({ webkitdirectory: '', directory: '' } as Record<
                            string,
                            string
                          >)}
                          onChange={(event) => {
                            void importFiles(event.target.files);
                            event.target.value = '';
                          }}
                        />
                      </Button>
                      <Typography variant="caption">
                        Folder selection depends on your client. You can also
                        include CSV/TXT metadata and matching cover images.
                      </Typography>
                    </More>
                    {warnings.map((warning) => (
                      <Alert key={warning} severity="warning">
                        {warning}
                      </Alert>
                    ))}
                    {!!folder.length && (
                      <Typography>
                        {folder.length} {folder.length === 1 ? 'song' : 'songs'}{' '}
                        • {(folderBytes / 1024 / 1024).toFixed(1)} MiB
                      </Typography>
                    )}
                    <TextField
                      label="Album title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Artist for songs without an artist"
                      value={artist}
                      onChange={(event) => setArtist(event.target.value)}
                      fullWidth
                    />
                    {!!folder.length && (
                      <More title="Review songs and order">
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={showTrackDetails}
                              onChange={(_, checked) =>
                                setShowTrackDetails(checked)
                              }
                            />
                          }
                          label="Edit individual song details"
                        />
                        {folder.map((song, index) => (
                          <Stack
                            key={song.id}
                            spacing={1}
                            sx={{
                              pb: 2,
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <Typography variant="body2">
                              {index + 1}. {song.title} •{' '}
                              {song.artist || artist || 'Artist required'}
                            </Typography>
                            <OrderButtons
                              index={index}
                              count={folder.length}
                              onMove={(direction) =>
                                setFolder((previous) =>
                                  move(previous, index, direction)
                                )
                              }
                              onRemove={() =>
                                setFolder((previous) =>
                                  previous.filter((item) => item.id !== song.id)
                                )
                              }
                            />
                            {showTrackDetails && (
                              <>
                                <Typography variant="caption">
                                  {song.relativePath}
                                </Typography>
                                {(
                                  [
                                    'title',
                                    'artist',
                                    'album',
                                    'genre',
                                    'language',
                                    'mood',
                                    'notes',
                                    'publishedDate',
                                  ] as const
                                ).map((field) => (
                                  <TextField
                                    key={field}
                                    label={`${field === 'publishedDate' ? 'Published date' : field[0].toUpperCase() + field.slice(1)} — track ${index + 1}`}
                                    value={song[field]}
                                    multiline={field === 'notes'}
                                    onChange={(event) =>
                                      setFolder((previous) =>
                                        previous.map((item) =>
                                          item.id === song.id
                                            ? {
                                                ...item,
                                                [field]: event.target.value,
                                              }
                                            : item
                                        )
                                      )
                                    }
                                    fullWidth
                                  />
                                ))}
                                {song.coverFile && (
                                  <Button
                                    onClick={() =>
                                      setFolder((previous) =>
                                        previous.map((item) =>
                                          item.id === song.id
                                            ? { ...item, coverFile: null }
                                            : item
                                        )
                                      )
                                    }
                                  >
                                    Remove imported cover
                                  </Button>
                                )}
                              </>
                            )}
                          </Stack>
                        ))}
                      </More>
                    )}
                    <TextField
                      select
                      label="Playlist action"
                      value={playlistAction}
                      onChange={(event) =>
                        setPlaylistAction(event.target.value as PlaylistAction)
                      }
                      fullWidth
                    >
                      <MenuItem value="none">Publish songs only</MenuItem>
                      <MenuItem value="new">Create an album playlist</MenuItem>
                      <MenuItem value="existing">
                        Add to existing playlist
                      </MenuItem>
                    </TextField>
                    {playlistAction === 'existing' && (
                      <OwnedPlaylists
                        publisher={publisher || ''}
                        value={existing}
                        onChange={setExisting}
                      />
                    )}
                    {playlistAction !== 'none' && (
                      <TextField
                        label="Playlist description (optional)"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        multiline
                        fullWidth
                      />
                    )}
                  </>
                )}
                {mode === 'playlist' && (
                  <>
                    <TextField
                      label="Playlist title"
                      required
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Description (optional)"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      multiline
                      fullWidth
                    />
                    <SongPicker selected={selected} onChange={setSelected} />
                    {!!selected.length && (
                      <More
                        title={`Selected songs (${selected.length}) — change order`}
                      >
                        {selected.map((song, index) => (
                          <Box key={keyFor(song)}>
                            <Typography variant="body2">
                              {index + 1}. {song.title} • {song.artist}
                            </Typography>
                            <OrderButtons
                              index={index}
                              count={selected.length}
                              onMove={(direction) =>
                                setSelected((previous) =>
                                  move(previous, index, direction)
                                )
                              }
                              onRemove={() =>
                                setSelected((previous) =>
                                  previous.filter(
                                    (item) => keyFor(item) !== keyFor(song)
                                  )
                                )
                              }
                            />
                          </Box>
                        ))}
                      </More>
                    )}
                  </>
                )}
                <CoverPicker
                  value={cover}
                  onChange={setCover}
                  onBusy={setCoverBusy}
                  disabled={busy}
                  label={
                    mode === 'folder'
                      ? 'Cover for all songs and the album playlist (optional)'
                      : 'Cover (optional)'
                  }
                />
                {mode !== 'playlist' ? (
                  <More>{metadataFields}</More>
                ) : (
                  <More>
                    <TextField
                      label="Published date"
                      type="date"
                      value={details.publishedDate}
                      slotProps={{ inputLabel: { shrink: true } }}
                      onChange={(event) =>
                        setDetails((previous) => ({
                          ...previous,
                          publishedDate: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </More>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button
            disabled={busy}
            onClick={() => (plan ? setPlan(null) : setOpen(false))}
          >
            {plan ? 'Back' : 'Close'}
          </Button>
          <Button
            variant="contained"
            disabled={plan ? busy : !ready}
            onClick={() => void (plan ? submit() : prepare())}
          >
            {plan ? 'Publish' : 'Review'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
