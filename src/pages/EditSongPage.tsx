import { isEarBumpIdentifier } from '../utils/mediaOrigin';
import { isAbortError, throwIfAborted } from '../services/qdnRequests';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useGlobal } from '../qortal';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { useMediaPublish } from '../hooks/useMediaPublish';
import { loadExistingSongAudioFile } from '../services/songs';
import { useSongDetail } from '../hooks/useSongDetail';
import { emitMediaRefresh } from '../utils/mediaEvents';
import { parseSongMetadata } from '../utils/songMetadata';
import {
  AUDIO_INPUT_ACCEPT,
  AUDIO_FORMATS_HELP,
  AUDIO_LIMIT_TEXT,
  COVER_FORMATS_HELP,
  COVER_PROCESSING_TEXT,
  IMAGE_INPUT_ACCEPT,
} from '../utils/publishLimits';

export const EditSongPage = () => {
  const { auth } = useGlobal();
  const { identifier } = useParams();
  const decodedIdentifier = identifier ? identifier : undefined;
  const publisher = auth?.name?.trim();
  const { song, isLoading, error, isMetadataLoading, metadataError, retry } =
    useSongDetail(publisher, decodedIdentifier);
  const { publishSong } = useMediaPublish();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [language, setLanguage] = useState('');
  const [notes, setNotes] = useState('');
  const [publishedDate, setPublishedDate] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savePhase, setSavePhase] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const contextKey = `${auth?.address}:${publisher?.toLowerCase()}:${decodedIdentifier}`;
  const currentContext = useRef(contextKey);
  currentContext.current = contextKey;
  const reuseController = useRef<AbortController | null>(null),
    saving = useRef(false);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  useEffect(() => {
    saving.current = false;
    setIsSaving(false);
    setIsPreparingAudio(false);
    setAudioFile(null);
    setCoverFile(null);
    setSavePhase(null);
    setSaveError(null);
    setStatus(null);
    return () => {
      reuseController.current?.abort();
    };
  }, [contextKey]);
  useEffect(() => {
    if (!song) return;
    const parsed = parseSongMetadata(song.description);
    setTitle(song.title);
    setArtist(song.artist);
    setAlbum(parsed.album || song.album || '');
    setGenre(parsed.genre || '');
    setMood(parsed.mood || '');
    setLanguage(parsed.language || '');
    setNotes(song.notes ?? parsed.notes ?? '');
    setPublishedDate(parsed.publishedDate || '');
  }, [song]);

  const handleSave = async () => {
    if (isEarBumpIdentifier(decodedIdentifier)) return;
    if (
      !song ||
      isMetadataLoading ||
      metadataError ||
      saving.current ||
      song.publisher.toLowerCase() !== publisher?.toLowerCase() ||
      song.identifier !== decodedIdentifier
    ) {
      return;
    }

    saving.current = true;
    const key = contextKey,
      controller = new AbortController();
    reuseController.current = controller;
    const current = () =>
      currentContext.current === key && reuseController.current === controller;
    setIsSaving(true);
    setIsPreparingAudio(true);
    setSaveError(null);
    setStatus(null);
    setSavePhase('Preparing your song update...');

    try {
      let fileToPublish = audioFile;

      if (!fileToPublish) {
        fileToPublish = await loadExistingSongAudioFile({
          publisher: song.publisher,
          identifier: song.identifier,
          signal: controller.signal,
          onStatusChange: (phase) => {
            if (current()) setSavePhase(phase);
          },
        });
      } else {
        setSavePhase('Using the selected replacement audio file...');
      }

      throwIfAborted(controller.signal);
      if (!current()) return;
      setIsPreparingAudio(false);
      setSavePhase('Publishing your updated song to QDN...');
      const result = await publishSong({
        signal: controller.signal,
        title: title.trim() || song.title,
        artist: artist.trim() || song.artist,
        album,
        genre,
        mood,
        language,
        notes,
        publishedDate,
        audioFile: fileToPublish,
        coverFile,
        existingIdentifier: song.identifier,
      });
      if (!current()) return;
      setStatus(`${result.title}: ${result.outcome.message}`);
      if (result.outcome.complete) {
        setAudioFile(null);
        setCoverFile(null);
      }
      emitMediaRefresh();
    } catch (publishError) {
      if (!current()) return;
      if (isAbortError(publishError)) {
        setStatus('Audio preparation cancelled.');
        return;
      }
      setSaveError(
        publishError instanceof Error
          ? publishError.message
          : 'Failed to update song.'
      );
    } finally {
      if (current()) {
        saving.current = false;
        setIsSaving(false);
        setIsPreparingAudio(false);
        setSavePhase(null);
      }
    }
  };

  if (isEarBumpIdentifier(decodedIdentifier))
    return (
      <Alert severity="info">
        Ear-Bump publications can be played and saved in Q-Music. Use Ear-Bump
        to edit the original publication.
      </Alert>
    );

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow="EDIT SONG"
        title={song ? `Edit ${song.title}` : 'Edit song'}
        description="Song editing republishes the existing identifier. If you do not choose a new audio file, the current audio is re-used automatically."
      />
      {!publisher ? (
        <Alert severity="warning">
          Log in through Qortal before editing a song.
        </Alert>
      ) : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {metadataError ? (
        <Alert
          severity="warning"
          action={<Button onClick={retry}>Retry details</Button>}
        >
          {metadataError}
        </Alert>
      ) : null}
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {status ? <Alert severity="info">{status}</Alert> : null}
      {savePhase && !status && !saveError ? (
        <Alert severity="info">{savePhase}</Alert>
      ) : null}
      {isLoading || isMetadataLoading ? (
        <Typography variant="body2">Loading song editor...</Typography>
      ) : song ? (
        <Stack spacing={2}>
          <SectionCard
            kicker="OWNER EDIT"
            title={song.title}
            body="Update the visible metadata and republish this song on the same identifier. Existing listeners keep the same route."
            meta={['AUDIO', song.identifier]}
          />
          <Alert severity="info">
            {AUDIO_LIMIT_TEXT} {COVER_PROCESSING_TEXT}
          </Alert>
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <TextField
            label="Artist"
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
          />
          <TextField
            label="Album"
            value={album}
            onChange={(event) => setAlbum(event.target.value)}
          />
          <TextField
            label="Genre"
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
          />
          <TextField
            label="Mood"
            value={mood}
            onChange={(event) => setMood(event.target.value)}
          />
          <TextField
            label="Language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          />
          <TextField
            label="Notes"
            multiline
            minRows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <TextField
            label="Publication date"
            type="date"
            value={publishedDate}
            onChange={(event) => setPublishedDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button variant="outlined" component="label">
            {audioFile
              ? `Audio selected: ${audioFile.name}`
              : 'Replace audio file (optional)'}
            <input
              hidden
              type="file"
              accept={AUDIO_INPUT_ACCEPT}
              onChange={(event) =>
                setAudioFile(event.target.files?.[0] || null)
              }
            />
          </Button>
          {isPreparingAudio && (
            <Button onClick={() => reuseController.current?.abort()}>
              Cancel audio preparation
            </Button>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Automatic reuse downloads up to 64 MiB. For larger files, choose the
            original file on your device. Replacement audio is optional.{' '}
            {AUDIO_FORMATS_HELP} {AUDIO_LIMIT_TEXT}
          </Typography>
          <Button variant="outlined" component="label">
            {coverFile
              ? `Cover selected: ${coverFile.name}`
              : 'Replace cover (optional)'}
            <input
              hidden
              type="file"
              accept={IMAGE_INPUT_ACCEPT}
              onChange={(event) =>
                setCoverFile(event.target.files?.[0] || null)
              }
            />
          </Button>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Replacement cover is optional. {COVER_FORMATS_HELP}{' '}
            {COVER_PROCESSING_TEXT}
          </Typography>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              isSaving ||
              song.publisher.toLowerCase() !== publisher?.toLowerCase() ||
              song.identifier !== decodedIdentifier ||
              !publisher ||
              isMetadataLoading ||
              Boolean(metadataError)
            }
          >
            {isSaving ? 'Saving...' : 'Save song changes'}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
};
