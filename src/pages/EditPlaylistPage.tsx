import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useGlobal } from 'qapp-core';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHero } from '../components/common/PageHero';
import { SectionCard } from '../components/common/SectionCard';
import { useMediaPublish } from '../hooks/useMediaPublish';
import { usePlaylistDetail } from '../hooks/usePlaylistDetail';
import { useSongsFeed } from '../hooks/useSongsFeed';
import { mapSongToPlaylistReference } from '../hooks/useMediaPublish';
import { emitMediaRefresh } from '../utils/mediaEvents';
import type { SongSummary } from '../types/media';

const toSongKey = (song: { publisher: string; identifier: string }) =>
  `${song.publisher}:${song.identifier}`;

const isSongSummary = (song: SongSummary | undefined): song is SongSummary =>
  Boolean(song);

export const EditPlaylistPage = () => {
  const { auth } = useGlobal();
  const { identifier } = useParams();
  const decodedIdentifier = identifier
    ? decodeURIComponent(identifier)
    : undefined;
  const publisher = auth?.name?.trim();
  const { playlist, isLoading, error } = usePlaylistDetail(
    publisher,
    decodedIdentifier
  );
  const { songs } = useSongsFeed(100);
  const { publishPlaylist } = useMediaPublish();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publishedDate, setPublishedDate] = useState('');
  const [selectedSongKeys, setSelectedSongKeys] = useState<string[]>([]);
  const [songQuery, setSongQuery] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!playlist) return;
    setTitle(playlist.title);
    setDescription(playlist.description || '');
    setPublishedDate(playlist.publishedDate || '');
    setSelectedSongKeys(playlist.songs.map((song) => toSongKey(song)));
  }, [playlist]);

  const availableSongs = useMemo(() => {
    const merged = [...songs];

    (playlist?.songs || []).forEach((song) => {
      const exists = merged.some(
        (entry) =>
          entry.publisher === song.publisher &&
          entry.identifier === song.identifier
      );

      if (!exists) {
        merged.push({
          id: song.identifier,
          identifier: song.identifier,
          publisher: song.publisher,
          title: song.title || song.identifier,
          artist: song.artist || song.publisher,
          service: 'AUDIO',
          mediaType: 'SONG',
        });
      }
    });

    return merged;
  }, [playlist?.songs, songs]);

  const selectedSongs = useMemo(() => {
    const selectedMap = new Map<string, SongSummary>(
      availableSongs.map((song) => [toSongKey(song), song])
    );

    return selectedSongKeys
      .map((key) => selectedMap.get(key))
      .filter(isSongSummary);
  }, [availableSongs, selectedSongKeys]);

  const visibleSongs = useMemo(() => {
    const normalized = songQuery.trim().toLowerCase();
    return availableSongs.filter((song) => {
      if (!normalized) return true;
      return [song.title, song.artist, song.publisher]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [availableSongs, songQuery]);

  const toggleSong = (key: string) => {
    setSelectedSongKeys((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key]
    );
  };

  const moveSelectedSong = (key: string, direction: -1 | 1) => {
    setSelectedSongKeys((current) => {
      const index = current.indexOf(key);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!playlist) return;

    setIsSaving(true);
    setSaveError(null);
    setStatus(null);

    try {
      const songsToPublish =
        selectedSongs.length > 0
          ? selectedSongs
          : (playlist.songs.map((song) => ({
              id: song.identifier,
              identifier: song.identifier,
              publisher: song.publisher,
              title: song.title || song.identifier,
              artist: song.artist || song.publisher,
              service: 'AUDIO',
              mediaType: 'SONG',
            })) as SongSummary[]);

      const result = await publishPlaylist({
        title: title.trim() || playlist.title,
        description,
        publishedDate,
        songs: songsToPublish.map(mapSongToPlaylistReference),
        coverFile,
        existingIdentifier: playlist.identifier,
      });
      setStatus(
        `Published successfully. Playlist updates are now live as ${result.identifier}.`
      );
      setCoverFile(null);
      emitMediaRefresh();
    } catch (publishError) {
      setSaveError(
        publishError instanceof Error
          ? publishError.message
          : 'Failed to update playlist.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHero
        eyebrow="EDIT PLAYLIST"
        title={playlist ? `Edit ${playlist.title}` : 'Edit playlist'}
        description="Update playlist metadata, track membership and order, then republish on the same identifier."
      />
      {!publisher ? (
        <Alert severity="warning">
          Log in through Qortal before editing a playlist.
        </Alert>
      ) : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {status ? <Alert severity="success">{status}</Alert> : null}
      {isLoading ? (
        <Typography variant="body2">Loading playlist editor...</Typography>
      ) : playlist ? (
        <Stack spacing={2}>
          <SectionCard
            kicker="OWNER EDIT"
            title={playlist.title}
            body="Edit the title, description, song selection and ordering here. Saving republishes the playlist on the same identifier."
            meta={['PLAYLIST', playlist.identifier]}
          />
          <TextField
            label="Playlist title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <TextField
            label="Description"
            multiline
            minRows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <TextField
            label="Publication date"
            type="date"
            value={publishedDate}
            onChange={(event) => setPublishedDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
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

          <TextField
            label="Search songs"
            value={songQuery}
            onChange={(event) => setSongQuery(event.target.value)}
            helperText="Pick from loaded songs and reorder the selected list below"
          />

          <Stack spacing={1}>
            <Typography variant="h6">Selected songs</Typography>
            {selectedSongKeys.length ? (
              selectedSongs.map((song) => {
                const key = toSongKey(song);
                return (
                  <SectionCard
                    key={key}
                    kicker={song.artist}
                    title={song.title}
                    body={`PUBLISHED @ ${song.publisher}`}
                    meta={['AUDIO', 'Selected']}
                    action={
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                      >
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => moveSelectedSong(key, -1)}
                        >
                          Move up
                        </Button>
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => moveSelectedSong(key, 1)}
                        >
                          Move down
                        </Button>
                        <Button
                          variant="text"
                          fullWidth
                          onClick={() => toggleSong(key)}
                        >
                          Remove
                        </Button>
                      </Stack>
                    }
                  />
                );
              })
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No songs selected yet.
              </Typography>
            )}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h6">Available songs</Typography>
            {visibleSongs.map((song) => {
              const key = toSongKey(song);
              const isSelected = selectedSongKeys.includes(key);
              return (
                <SectionCard
                  key={key}
                  kicker={song.artist}
                  title={song.title}
                  body={`PUBLISHED @ ${song.publisher}`}
                  meta={['AUDIO', isSelected ? 'Selected' : 'Available']}
                  action={
                    <Button
                      variant={isSelected ? 'outlined' : 'contained'}
                      fullWidth
                      onClick={() => toggleSong(key)}
                    >
                      {isSelected ? 'Remove from playlist' : 'Add to playlist'}
                    </Button>
                  }
                />
              );
            })}
          </Stack>

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving || !publisher}
          >
            {isSaving ? 'Saving...' : 'Save playlist changes'}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
};
