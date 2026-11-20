import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { File as NodeFile } from 'node:buffer';
import { processCoverImage } from '../src/services/publishing/covers';
import { CoverPicker } from '../src/components/publishing/CoverPicker';
import { parseFolderSelection } from '../src/utils/publishFolder';
import { validateCover } from '../src/services/publishing/limits';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const canvas = () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  return vi
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/jpeg;base64,Y292ZXI=');
};
const image = (blobFails = false) => {
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 900;
      naturalHeight = 600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(url: string) {
        if (!url) return;
        queueMicrotask(() =>
          blobFails && url.startsWith('blob:')
            ? this.onerror?.()
            : this.onload?.()
        );
      }
    }
  );
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  });
};
describe('mobile publishing compatibility', () => {
  it('falls back to a file data URL when a selected image blob URL cannot decode', async () => {
    image(true);
    const encode = canvas();
    const file = new File(['cover'], 'COVER.JPG', { type: '' });
    expect(() => validateCover(file)).not.toThrow();
    expect(await processCoverImage(file)).toBe('Y292ZXI=');
    expect(encode).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    // Publication reuses the actual preview bytes instead of decoding again.
    expect(await processCoverImage(file)).toBe('Y292ZXI=');
    expect(encode).toHaveBeenCalledOnce();
  });
  it('recognizes MP3 files with an empty relative path, uppercase extension and generic MIME', async () => {
    const file = new NodeFile(['audio'], 'Track.MP3', {
      type: 'application/octet-stream',
    }) as unknown as File;
    Object.defineProperty(file, 'webkitRelativePath', { value: '' });
    const parsed = await parseFolderSelection([file]);
    expect(parsed.songs[0]).toMatchObject({
      title: 'Track',
      relativePath: 'Track.MP3',
    });
    expect(parsed.warnings).toEqual([]);
  });
  it('accepts audio MIME from a mobile provider when no filename extension is present', async () => {
    const file = new NodeFile(['audio'], 'Song from device', {
      type: 'audio/mpeg',
    }) as unknown as File;
    expect((await parseFolderSelection([file])).songs).toHaveLength(1);
  });
  it('shows decode errors immediately and lets the user remove the cover', async () => {
    image();
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null;
        set src(url: string) {
          if (url) queueMicrotask(() => this.onerror?.());
        }
      }
    );
    const change = vi.fn(),
      busy = vi.fn();
    render(
      <CoverPicker
        value={new File(['bad image'], 'broken.jpg', { type: 'image/jpeg' })}
        onChange={change}
        onBusy={busy}
      />
    );
    expect(
      await screen.findByText(/Cover image could not be decoded/)
    ).toBeTruthy();
    await waitFor(() => expect(busy).toHaveBeenLastCalledWith(true));
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Remove cover' }));
    expect(change).toHaveBeenCalledWith(null);
  });
});
