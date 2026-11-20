import type { CoverCropSettings } from '../../hooks/useMediaPublish';
import {
  MAX_COVER_PIXELS,
  MAX_THUMBNAIL_SIZE,
  MAX_CROP_ZOOM,
  MIN_CROP_ZOOM,
} from '../../utils/publishLimits';
import { validateCover } from './limits';
import { base64Bytes } from './content';
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const cached = new WeakMap<File, Map<string, Promise<string>>>();

// Reading a small image into a data URL also works in embedded clients where a
// selected file's blob URL cannot be decoded by the image element.
export const readCoverDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => {
      reader.abort();
      reject(new Error('Cover reading timed out. Choose the image again.'));
    }, 30_000);
    const fail = () => {
      clearTimeout(timer);
      reject(
        new Error(
          'The cover could not be read. Choose a local JPG, PNG or WebP image.'
        )
      );
    };
    reader.onload = () => {
      clearTimeout(timer);
      if (typeof reader.result === 'string') resolve(reader.result);
      else fail();
    };
    reader.onerror = reader.onabort = fail;
    try {
      reader.readAsDataURL(file);
    } catch {
      fail();
    }
  });
const decode = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const cleanup = () => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
    };
    const timer = setTimeout(() => {
      cleanup();
      image.src = '';
      reject(new Error('Cover image processing timed out.'));
    }, 20_000);
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(
        new Error(
          'Cover image could not be decoded. Choose a JPG, PNG or WebP image, or remove the cover to continue.'
        )
      );
    };
    image.src = src;
  });
const process = async (
  file: File,
  crop?: CoverCropSettings
): Promise<string> => {
  validateCover(file);
  let image: HTMLImageElement | undefined;
  let url: string | undefined;
  const canvas = document.createElement('canvas');
  try {
    try {
      url = URL.createObjectURL(file);
      image = await decode(url);
    } catch {
      image = await decode(await readCoverDataUrl(file));
    }
    const width = image.naturalWidth || image.width,
      height = image.naturalHeight || image.height;
    if (!width || !height || width * height > MAX_COVER_PIXELS)
      throw new Error('Use a cover image below 40 megapixels.');
    const sourceSize = Math.max(
      1,
      Math.min(width, height) /
        clamp(crop?.zoom ?? 1, MIN_CROP_ZOOM, MAX_CROP_ZOOM)
    );
    const maxX = width - sourceSize,
      maxY = height - sourceSize;
    const x = clamp(maxX / 2 + ((crop?.offsetX ?? 0) * maxX) / 2, 0, maxX);
    const y = clamp(maxY / 2 + ((crop?.offsetY ?? 0) * maxY) / 2, 0, maxY);
    for (const size of [1200, 1024, 800, 600, 320]) {
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is not available.');
      context.drawImage(image, x, y, sourceSize, sourceSize, 0, 0, size, size);
      for (const quality of [0.86, 0.65, 0.45]) {
        const result = canvas.toDataURL('image/jpeg', quality);
        const data = result.split(',')[1];
        if (
          result.startsWith('data:image/jpeg;base64,') &&
          data &&
          base64Bytes(data).length <= MAX_THUMBNAIL_SIZE
        )
          return data;
      }
    }
    throw new Error(
      'The cover could not be reduced below 500 KiB. Choose another image.'
    );
  } finally {
    if (url) URL.revokeObjectURL(url);
    if (image) image.src = '';
    canvas.width = canvas.height = 0;
  }
};
export const processCoverImage = (
  file: File,
  crop?: CoverCropSettings
): Promise<string> => {
  const key = JSON.stringify([
    crop?.zoom ?? 1,
    crop?.offsetX ?? 0,
    crop?.offsetY ?? 0,
  ]);
  let variants = cached.get(file);
  if (!variants) {
    variants = new Map();
    cached.set(file, variants);
  }
  const known = variants.get(key);
  if (known) return known;
  const pending = process(file, crop).catch((error) => {
    variants.delete(key);
    throw error;
  });
  variants.set(key, pending);
  return pending;
};
