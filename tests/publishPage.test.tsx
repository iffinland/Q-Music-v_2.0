import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PublishPage } from '../src/pages/PublishPage';
const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
  buildSong: vi.fn(),
  buildPlaylist: vi.fn(),
  fetchPlaylist: vi.fn(),
  songsFeed: vi.fn(),
  playlistFeed: vi.fn(),
  state: {
    value: {
      jobs: [],
      activity: '',
      activeJobId: null,
      waitingJobIds: [],
      error: null,
    },
  },
}));
vi.mock('../src/services/publishing/engine', () => ({
  getPublishSnapshot: () => mocks.state.value,
  subscribePublish: () => () => {},
  summarizeJob: (job: { complete: boolean }) => ({ complete: job.complete }),
  openPublishCenter: vi.fn(),
}));
vi.mock('../src/services/publishing/limits', () => ({
  getPublishNodeLimit: async () => 500 * 1024 * 1024,
  validateAudio: vi.fn(),
}));
vi.mock('../src/hooks/useMediaPublish', () => ({
  useMediaPublish: () => ({
    publisher: 'Alice',
    publishResourceBatch: mocks.batch,
    buildSongPublish: mocks.buildSong,
    buildPlaylistPublish: mocks.buildPlaylist,
  }),
  mapSongToPlaylistReference: (song: unknown) => song,
}));
vi.mock('../src/hooks/useSongsFeed', () => ({ useSongsFeed: mocks.songsFeed }));
vi.mock('../src/hooks/usePlaylistsFeed', () => ({
  usePlaylistsFeed: mocks.playlistFeed,
}));
vi.mock('../src/services/playlists', () => ({
  fetchPlaylistDetail: mocks.fetchPlaylist,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.batch.mockResolvedValue({ complete: true });
  mocks.buildSong.mockImplementation(async (input) => ({
    identifier: 'same-id',
    publisher: 'Alice',
    title: input.title,
    artist: input.artist,
    audioResource: {
      name: 'Alice',
      service: 'AUDIO',
      identifier: 'same-id',
      file: input.audioFile,
    },
    metadataResource: {
      name: 'Alice',
      service: 'DOCUMENT',
      identifier: 'same-meta',
      data64: 'e30=',
    },
  }));
  mocks.buildPlaylist.mockImplementation(async (input) => ({
    playlistResource: {
      name: 'Alice',
      service: 'PLAYLIST',
      identifier: 'playlist',
      data64: JSON.stringify(input),
    },
  }));
  mocks.songsFeed.mockReturnValue({
    songs: [
      {
        id: 'second',
        publisher: 'Alice',
        identifier: 'second',
        title: 'Second',
        artist: 'Artist',
      },
      {
        id: 'first',
        publisher: 'Alice',
        identifier: 'first',
        title: 'First',
        artist: 'Artist',
      },
    ],
    hasMore: false,
  });
  mocks.playlistFeed.mockReturnValue({
    playlists: [
      { publisher: 'Alice', identifier: 'owned', title: 'Owned playlist' },
    ],
    hasMore: false,
  });
});
afterEach(cleanup);
const start = async (name: string) => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PublishPage />
    </MemoryRouter>
  );
  await user.click(screen.getByRole('button', { name }));
  return user;
};
const folder = async () => {
  const user = await start('Choose album / folder');
  await user.type(
    screen.getByLabelText('Artist for songs without an artist'),
    'Alice'
  );
  // Mobile File objects have no relative path; some expose it as an empty string.
  const file = new File(['audio'], 'SONG.MP3', {
    type: 'application/octet-stream',
  });
  Object.defineProperty(file, 'webkitRelativePath', { value: '' });
  fireEvent.change(screen.getByLabelText('Album audio files'), {
    target: { files: [file] },
  });
  await screen.findByText('1 song • 0.0 MiB');
  return user;
};
describe('simple publication flow', () => {
  it('starts with three choices and loads no unrelated catalogs', async () => {
    render(
      <MemoryRouter>
        <PublishPage />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('button', { name: /^Choose/ })).toHaveLength(3);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.songsFeed).not.toHaveBeenCalled();
    expect(mocks.playlistFeed).not.toHaveBeenCalled();
    expect(screen.queryByText('Publish activity')).toBeNull();
  });
  it('prepares and reviews a song before opening any wallet action', async () => {
    const user = await start('Choose song');
    fireEvent.change(screen.getByLabelText('Audio file'), {
      target: {
        files: [new File(['audio'], 'A song.mp3', { type: 'audio/mpeg' })],
      },
    });
    await user.type(screen.getByLabelText(/Artist/), 'Alice');
    await user.click(
      screen.getByRole('button', { name: 'Review', exact: true })
    );
    expect(await screen.findByText('Review publication')).toBeTruthy();
    expect(mocks.buildSong).toHaveBeenCalledOnce();
    expect(mocks.batch).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Publish', exact: true })
    );
    expect(await screen.findByText(/Publication sent/)).toBeTruthy();
    expect(mocks.batch).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('publishes a mobile MP3 selection and clears it after sending', async () => {
    const user = await folder();
    expect(
      screen.getByLabelText('Album audio files').getAttribute('webkitdirectory')
    ).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Review', exact: true })
    );
    expect(await screen.findByText('Review publication')).toBeTruthy();
    expect(mocks.buildSong.mock.calls[0][0]).toMatchObject({
      title: 'SONG',
      artist: 'Alice',
    });
    await user.click(
      screen.getByRole('button', { name: 'Publish', exact: true })
    );
    await screen.findByText(/Publication sent/);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(
      screen.getByRole('button', { name: 'Choose album / folder' })
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Review',
          exact: true,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      mocks.batch.mock.calls[0][0].map(
        (item: { service: string }) => item.service
      )
    ).toEqual(['AUDIO', 'DOCUMENT']);
  });
  it('preserves selection order and permits a playlist without a description or cover', async () => {
    const user = await start('Choose playlist');
    await user.type(screen.getByLabelText(/Playlist title/), 'Ordered');
    await user.click(screen.getByLabelText('First • Artist'));
    await user.click(screen.getByLabelText('Second • Artist'));
    await user.click(
      screen.getByRole('button', { name: 'Review', exact: true })
    );
    await screen.findByText('Review publication');
    expect(
      mocks.buildPlaylist.mock.calls[0][0].songs.map(
        (item: { identifier: string }) => item.identifier
      )
    ).toEqual(['first', 'second']);
    expect(mocks.buildPlaylist.mock.calls[0][0].coverFile).toBeNull();
  });
  it('does not prepare or send audio if the existing playlist cannot be read', async () => {
    const user = await folder();
    mocks.fetchPlaylist.mockRejectedValue(
      new Error('Existing playlist unavailable')
    );
    await user.click(screen.getByRole('combobox', { name: 'Playlist action' }));
    await user.click(
      screen.getByRole('option', { name: 'Add to existing playlist' })
    );
    await user.click(
      screen.getByRole('combobox', { name: 'Existing playlist' })
    );
    await user.click(screen.getByRole('option', { name: 'Owned playlist' }));
    await user.click(
      screen.getByRole('button', { name: 'Review', exact: true })
    );
    expect(
      await screen.findByText('Existing playlist unavailable')
    ).toBeTruthy();
    expect(mocks.buildSong).not.toHaveBeenCalled();
    expect(mocks.batch).not.toHaveBeenCalled();
  });
  it('retains the prepared identities if the send fails before returning a result', async () => {
    const user = await folder();
    mocks.batch.mockRejectedValue(new Error('Device storage unavailable'));
    await user.click(
      screen.getByRole('button', { name: 'Review', exact: true })
    );
    await screen.findByText('Review publication');
    await user.click(
      screen.getByRole('button', { name: 'Publish', exact: true })
    );
    expect(await screen.findByText('Device storage unavailable')).toBeTruthy();
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Publish',
            exact: true,
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    expect(mocks.buildSong).toHaveBeenCalledOnce();
    expect(mocks.batch.mock.calls[0][0][0].identifier).toBe('same-id');
  });
  it('keeps an existing playlist title while applying the album title to new audio', async () => {
    const user = await folder();
    mocks.fetchPlaylist.mockResolvedValue({
      identifier: 'owned',
      title: 'Keep this title',
      description: 'Original description',
      songs: [{ identifier: 'prior', publisher: 'Alice' }],
    });
    await user.type(screen.getByLabelText('Album title'), 'New album');
    await user.click(screen.getByRole('combobox', { name: 'Playlist action' }));
    await user.click(
      screen.getByRole('option', { name: 'Add to existing playlist' })
    );
    await user.click(
      screen.getByRole('combobox', { name: 'Existing playlist' })
    );
    await user.click(screen.getByRole('option', { name: 'Owned playlist' }));
    await user.click(
      screen.getByRole('button', { name: 'Review', exact: true })
    );
    await screen.findByText('Review publication');
    expect(mocks.buildSong.mock.calls[0][0].album).toBe('New album');
    expect(mocks.buildPlaylist.mock.calls[0][0]).toMatchObject({
      title: 'Keep this title',
      description: 'Original description',
      existingIdentifier: 'owned',
    });
    expect(
      mocks.buildPlaylist.mock.calls[0][0].songs.map(
        (item: { identifier: string }) => item.identifier
      )
    ).toEqual(['prior', 'same-id']);
    expect(mocks.batch).not.toHaveBeenCalled();
  });
});
