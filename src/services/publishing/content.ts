import CryptoJS from 'crypto-js/core';
import 'crypto-js/sha256';
import { throwIfAborted } from '../qdnRequests';

export const HASH_CHUNK_SIZE = 1024 * 1024;
export const utf8Bytes = (text: string) => new TextEncoder().encode(text);
export const limitUtf8 = (text: string, max: number) => {
  let output = '';
  for (const char of text) {
    if (utf8Bytes(output + char).length > max) break;
    output += char;
  }
  return output;
};
export const base64Bytes = (base64: string) => {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};
export const jsonBase64 = (data: unknown) => {
  const bytes = utf8Bytes(JSON.stringify(data));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
// Convert bytes explicitly: native streams and iframe File objects can carry
// typed arrays from another realm, which CryptoJS's instanceof adapter misses.
const wordsFor = (bytes: Uint8Array) => {
  const words: number[] = [];
  for (let index = 0; index < bytes.length; index++)
    words[index >>> 2] =
      (words[index >>> 2] || 0) | (bytes[index] << (24 - (index % 4) * 8));
  return CryptoJS.lib.WordArray.create(words, bytes.byteLength);
};
export const hashBytes = (bytes: Uint8Array) =>
  CryptoJS.SHA256(wordsFor(bytes)).toString();
const completedHashes = new WeakMap<Blob, string>();
export const hashBlob = async (blob: Blob, signal?: AbortSignal) => {
  throwIfAborted(signal);
  const known = completedHashes.get(blob);
  if (known) return known;
  const hash = CryptoJS.algo.SHA256.create();
  for (let offset = 0; offset < blob.size; offset += HASH_CHUNK_SIZE) {
    throwIfAborted(signal);
    const chunk = new Uint8Array(
      await blob.slice(offset, offset + HASH_CHUNK_SIZE).arrayBuffer()
    );
    hash.update(wordsFor(chunk));
  }
  throwIfAborted(signal);
  const result = hash.finalize().toString();
  completedHashes.set(blob, result);
  return result;
};
export const hashResponse = async (
  response: Response,
  expectedSize: number,
  signal?: AbortSignal
) => {
  if (!response.ok || response.status === 206)
    throw new Error(`Resource read-back failed (${response.status}).`);
  if (!response.body)
    throw new Error('Streaming verification is not available in this browser.');
  const reader = response.body.getReader();
  const hash = CryptoJS.algo.SHA256.create();
  let bytes = 0;
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      throwIfAborted(signal);
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > expectedSize)
        throw new Error('Read-back size differs from the prepared file.');
      hash.update(wordsFor(next.value));
    }
    throwIfAborted(signal);
    if (bytes !== expectedSize)
      throw new Error('Read-back size differs from the prepared file.');
    return hash.finalize().toString();
  } finally {
    signal?.removeEventListener('abort', abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
};

export const randomPublishId = () => {
  if (typeof crypto.randomUUID === 'function')
    return crypto.randomUUID().replace(/-/g, '');
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
