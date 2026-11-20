import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { File as NodeFile, Blob as NodeBlob } from 'node:buffer';
import {
  hashBlob,
  hashBytes,
  utf8Bytes,
  base64Bytes,
  hashResponse,
  randomPublishId,
} from '../src/services/publishing/content';
import {
  validateAudio,
  getPublishNodeLimit,
} from '../src/services/publishing/limits';
import { processCoverImage } from '../src/services/publishing/covers';
import { useMediaPublish } from '../src/hooks/useMediaPublish';
import {
  loadSongDocument,
  songMetadataIdentifier,
} from '../src/services/songDescriptors';
import { parseFolderSelection } from '../src/utils/publishFolder';
import {
  MAX_AUDIO_FILE_SIZE,
  MAX_PUBLIC_AUDIO_FILE_SIZE,
} from '../src/utils/publishLimits';
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  run: vi.fn(),
  exact: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('../src/qortal', () => ({
  useGlobal: () => ({ auth: { name: 'Alice' } }),
}));
vi.mock('../src/services/publishing/engine', () => ({
  assertCanStartJob: vi.fn(),
  createPublishJob: mocks.create,
  runPublishJob: mocks.run,
}));
vi.mock('../src/services/qdn', () => ({
  findExactQdnResource: mocks.exact,
  fetchQdnResource: mocks.fetch,
}));
const input = () => ({
  title: 'Song title',
  artist: 'Artist',
  audioFile: new File(['audio'], 'song.mp3', { type: 'audio/mpeg' }),
});
beforeEach(() => {
  vi.stubGlobal('File', NodeFile);
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('qortalRequest', vi.fn().mockResolvedValue(false));
  mocks.create.mockReset().mockResolvedValue({ id: 'saved-job' });
  mocks.run.mockReset().mockResolvedValue({
    complete: true,
    verified: false,
    message: 'Sent; availability pending.',
  });
  mocks.exact.mockReset().mockResolvedValue(null);
  mocks.fetch.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('bounded content and metadata preparation', () => {
  it('hashes bytes with the SHA-256 reference vector and chunks large blobs', async () => {
    expect(hashBytes(utf8Bytes('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    const blob = new Blob(['a'.repeat(1024 * 1024 + 7)]);
    const slice = vi.spyOn(blob, 'slice');
    expect(await hashBlob(blob)).toBe(
      hashBytes(utf8Bytes('a'.repeat(1024 * 1024 + 7)))
    );
    expect(slice).toHaveBeenCalledTimes(2);
  });
  it('stream-verifies exact bytes and rejects a truncated read-back', async () => {
    expect(await hashResponse(new Response('abc'), 3)).toBe(
      hashBytes(utf8Bytes('abc'))
    );
    await expect(hashResponse(new Response('ab'), 3)).rejects.toThrow(
      'size differs'
    );
    await expect(hashResponse(new Response('abcd'), 3)).rejects.toThrow(
      'size differs'
    );
    await expect(
      hashResponse(new Response('abc', { status: 206 }), 3)
    ).rejects.toThrow('206');
  });
  it('generates stable-format IDs on HTTP contexts without randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array) => array.fill(42),
    });
    expect(randomPublishId()).toBe('2a'.repeat(16));
  });
  it('uses the exact 500/2000 MiB limits and accepts an empty MIME with a valid extension', async () => {
    expect(() =>
      validateAudio({ name: 'song.mp3', type: '', size: 100 } as File)
    ).not.toThrow();
    expect(() =>
      validateAudio({
        name: 'song.mp3',
        type: 'audio/mpeg',
        size: MAX_AUDIO_FILE_SIZE + 1,
      } as File)
    ).toThrow('2000');
    expect(() =>
      validateAudio(
        {
          name: 'song.mp3',
          type: 'audio/mpeg',
          size: MAX_PUBLIC_AUDIO_FILE_SIZE + 1,
        } as File,
        MAX_PUBLIC_AUDIO_FILE_SIZE
      )
    ).toThrow('500');
    vi.stubGlobal('qortalRequest', vi.fn().mockResolvedValue(true));
    expect(await getPublishNodeLimit()).toBe(MAX_PUBLIC_AUDIO_FILE_SIZE);
    vi.stubGlobal(
      'qortalRequest',
      vi.fn().mockRejectedValue(new Error('unavailable'))
    );
    expect(await getPublishNodeLimit()).toBe(MAX_PUBLIC_AUDIO_FILE_SIZE);
  });
  it('retains long Unicode title, notes and dates outside the Core index byte cap', async () => {
    const { result } = renderHook(useMediaPublish);
    const title = '🎶 Väga pikk laul pealkirjaga '.repeat(10);
    const notes = 'Первый абзац; notes=still text\nSecond paragraph '.repeat(
      100
    );
    const prepared = await result.current.buildSongPublish({
      ...input(),
      title,
      notes,
      publishedDate: '2026-11-20',
      album: 'Album'.repeat(20),
    });
    const document = JSON.parse(
      new TextDecoder().decode(base64Bytes(prepared.metadataResource.data64!))
    );
    expect(document.fields).toMatchObject({
      title: title.trim(),
      notes: notes.trim(),
      publishedDate: '2026-11-20',
    });
    expect(utf8Bytes(prepared.audioResource.title!).length).toBeLessThanOrEqual(
      80
    );
    expect(
      utf8Bytes(prepared.audioResource.description!).length
    ).toBeLessThanOrEqual(240);
    expect(document.audio.sha256).toBe(hashBytes(utf8Bytes('audio')));
  });
  it('refuses excessive notes before hashing or sending the audio', async () => {
    const { result } = renderHook(useMediaPublish);
    const data = input();
    const slice = vi.spyOn(data.audioFile, 'slice');
    await expect(
      result.current.buildSongPublish({ ...data, notes: 'x'.repeat(300_000) })
    ).rejects.toThrow('too long');
    expect(slice).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('includes all audio, details and cover resources in the saved job result', async () => {
    const { result } = renderHook(useMediaPublish);
    const published = await result.current.publishSong(input());
    expect(
      mocks.create.mock.calls[0][1].map(
        (item: { service: string }) => item.service
      )
    ).toEqual(['AUDIO', 'DOCUMENT']);
    expect(published.outcome.verified).toBe(false);
    expect(mocks.run).toHaveBeenCalledWith('saved-job');
  });
  it('keeps metadata IDs within 64 bytes for legacy long song identifiers', () => {
    const identifier = 'x'.repeat(64);
    expect(
      utf8Bytes(songMetadataIdentifier(identifier)).length
    ).toBeLessThanOrEqual(64);
    expect(songMetadataIdentifier(identifier)).toBe(
      songMetadataIdentifier(identifier)
    );
  });
  it('reads full metadata only when its revision matches the audio index', async () => {
    const { result } = renderHook(useMediaPublish);
    const prepared = await result.current.buildSongPublish({
      ...input(),
      title: 'Full title',
      notes: 'Full notes\nSecond line',
    });
    const doc = JSON.parse(
      new TextDecoder().decode(base64Bytes(prepared.metadataResource.data64!))
    );
    const song = {
      id: 'id',
      identifier: prepared.identifier,
      publisher: 'Alice',
      title: 'Short',
      artist: 'Short',
      service: 'AUDIO' as const,
      mediaType: 'SONG' as const,
      metadataRevision: doc.revision,
    };
    mocks.exact.mockResolvedValue({
      name: 'Alice',
      identifier: prepared.metadataResource.identifier,
    });
    mocks.fetch.mockResolvedValueOnce({ ...doc, revision: 'older-revision' });
    await expect(loadSongDocument(song)).rejects.toThrow('propagating');
    mocks.fetch.mockResolvedValueOnce(doc);
    expect(await loadSongDocument(song)).toMatchObject({
      title: 'Full title',
      notes: 'Full notes\nSecond line',
      artist: 'Artist',
    });
  });
  it('preserves playlist selection order in the published payload', async () => {
    const { result } = renderHook(useMediaPublish);
    const songs = [
      { identifier: 'second', publisher: 'Bob' },
      { identifier: 'first', publisher: 'Alice' },
    ];
    const prepared = await result.current.buildPlaylistPublish({
      title: 'Ordered',
      songs,
    });
    expect(
      JSON.parse(
        new TextDecoder().decode(base64Bytes(prepared.playlistResource.data64!))
      ).songs
    ).toEqual(songs);
  });
  it('imports publishedDate consistently from CSV and TXT', async () => {
    for (const metadata of [
      new File(
        ['file,title,artist,publishedDate\na.mp3,A,B,2026-11-20'],
        'meta.csv'
      ),
      new File(
        ['file=a.mp3\ntitle=A\nartist=B\npublishedDate=2026-11-20'],
        'meta.txt'
      ),
    ]) {
      const file = new File(['audio'], 'a.mp3', { type: 'audio/mpeg' });
      Object.defineProperty(file, 'webkitRelativePath', { value: 'a.mp3' });
      const parsed = await parseFolderSelection([file, metadata]);
      expect(parsed.songs[0].publishedDate).toBe('2026-11-20');
    }
  });
});

describe('thumbnail output enforcement', () => {
  const image = (size = 1200) => {
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = size;
        naturalHeight = size;
        width = size;
        height = size;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
    );
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:cover'),
      revokeObjectURL: vi.fn(),
    });
  };
  it('reduces quality until the actual JPEG is below 500 KiB', async () => {
    image();
    const encode = vi
      .fn()
      .mockReturnValueOnce(`data:image/jpeg;base64,${btoa('x'.repeat(512001))}`)
      .mockReturnValue(`data:image/jpeg;base64,${btoa('x'.repeat(400000))}`);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      encode
    );
    const data = await processCoverImage(
      new File(['cover'], 'cover.jpg', { type: 'image/jpeg' })
    );
    expect(base64Bytes(data).length).toBe(400000);
    expect(encode).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
  it('rejects images beyond the decoded pixel limit', async () => {
    image(10000);
    await expect(
      processCoverImage(
        new File(['cover'], 'cover.jpg', { type: 'image/jpeg' })
      )
    ).rejects.toThrow('40 megapixels');
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
