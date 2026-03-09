import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useGlobal } from 'qapp-core';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { useMediaPublish } from '../hooks/useMediaPublish';
import { resolveSongStreamUrl } from '../services/songs';
import { useSongDetail } from '../hooks/useSongDetail';
import { emitMediaRefresh } from '../utils/mediaEvents';
import { parseSongMetadata } from '../utils/songMetadata';

const inferAudioExtension = (contentType?: string) => {
  if (!contentType) return 'mp3';
  if (contentType.includes('mpeg')) return 'mp3';
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('flac')) return 'flac';
  if (contentType.includes('aac')) return 'aac';
  return 'audio';
};

export const EditSongPage = () => {
  const { auth } = useGlobal();
  const { identifier } = useParams();
  const decodedIdentifier = identifier
    ? decodeURIComponent(identifier)
    : undefined;
  const publisher = auth?.name?.trim();
  const { song, isLoading, error } = useSongDetail(
    publisher,
    decodedIdentifier
  );
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

  useEffect(() => {
    if (!song) return;
    const parsed = parseSongMetadata(song.description);
    setTitle(song.title);
    setArtist(song.artist);
    setAlbum(parsed.album || song.album || '');
    setGenre(parsed.genre || '');
    setMood(parsed.mood || '');
    setLanguage(parsed.language || '');
    setNotes(parsed.notes || '');
    setPublishedDate(parsed.publishedDate || '');
  }, [song]);

  const handleSave = async () => {
    if (!song) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setStatus(null);
    setSavePhase('Preparing update...');

    try {
      let fileToPublish = audioFile;

      if (!fileToPublish) {
        setSavePhase('Preparing current QDN audio...');
        const streamUrl = await resolveSongStreamUrl(
          song.publisher,
          song.identifier,
          {
            waitUntilReady: true,
            onStatusChange: (resourceStatus, progress) => {
              setSavePhase(
                progress
                  ? `Preparing current QDN audio (${progress}%)`
                  : `Preparing current QDN audio: ${resourceStatus}`
              );
            },
          }
        );

        if (!streamUrl) {
          throw new Error(
            'Existing audio could not be loaded. Select a replacement audio file to save changes.'
          );
        }

        const response = await fetch(streamUrl);
        if (!response.ok) {
          throw new Error(
            'Existing audio could not be re-used for this edit. Select a replacement audio file to save changes.'
          );
        }

        const blob = await response.blob();
        fileToPublish = new File(
          [blob],
          `${song.identifier}.${inferAudioExtension(blob.type)}`,
          {
            type: blob.type || 'audio/mpeg',
          }
        );
      }

      setSavePhase('Publishing update to QDN...');
      const result = await publishSong({
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
      setStatus(
        `Published successfully. Song updates are now live as ${result.identifier}.`
      );
      setAudioFile(null);
      setCoverFile(null);
      emitMediaRefresh();
    } catch (publishError) {
      setSaveError(
        publishError instanceof Error
          ? publishError.message
          : 'Failed to update song.'
      );
    } finally {
      setIsSaving(false);
      setSavePhase(null);
    }
  };

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
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {status ? <Alert severity="success">{status}</Alert> : null}
      {savePhase && !status && !saveError ? (
        <Alert severity="info">{savePhase}</Alert>
      ) : null}
      {isLoading ? (
        <Typography variant="body2">Loading song editor...</Typography>
      ) : song ? (
        <Stack spacing={2}>
          <SectionCard
            kicker="OWNER EDIT"
            title={song.title}
            body="Update the visible metadata and republish this song on the same identifier. Existing listeners keep the same route."
            meta={['AUDIO', song.identifier]}
          />
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
              accept="audio/*"
              onChange={(event) =>
                setAudioFile(event.target.files?.[0] || null)
              }
            />
          </Button>
          <Button variant="outlined" component="label">
            {coverFile
              ? `Cover selected: ${coverFile.name}`
              : 'Replace cover (optional)'}
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(event) =>
                setCoverFile(event.target.files?.[0] || null)
              }
            />
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving || !publisher}
          >
            {isSaving ? 'Saving...' : 'Save song changes'}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
};
