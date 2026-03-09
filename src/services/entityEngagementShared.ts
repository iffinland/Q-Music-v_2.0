import { objectToBase64 } from 'qapp-core';

export const FETCH_LIMIT = 50;
export const LIKE_PROPAGATION_TIMEOUT_MS = 5_000;
export const LIKE_PROPAGATION_POLL_MS = 500;

export const buildShortId = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

const hashEntityId = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

export const buildEntityKey = (entityId: string) => {
  const compact = entityId.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const prefix = compact.slice(0, 16) || 'entity';
  return `${prefix}_${hashEntityId(entityId)}`;
};

const extractRequestError = (result: unknown): string | null => {
  if (typeof result === 'string') {
    const normalized = result.trim();
    if (!normalized) return null;
    if (/declined|denied|failed|error|cancel/i.test(normalized)) {
      return normalized;
    }
    return null;
  }

  if (!result || typeof result !== 'object') {
    return null;
  }

  if ('error' in result) {
    const error = (result as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    }
  }

  if ('message' in result) {
    const message = (result as { message?: unknown }).message;
    if (
      typeof message === 'string' &&
      /declined|denied|failed|error|cancel/i.test(message)
    ) {
      return message.trim();
    }
  }

  return null;
};

export const performQortalRequest = async (
  payload: Record<string, unknown>,
  fallbackMessage: string
) => {
  const result = await qortalRequest(payload as never);
  const error = extractRequestError(result);
  if (error) {
    throw new Error(error);
  }

  if (result === false) {
    throw new Error(fallbackMessage);
  }

  return result;
};

export const deleteQdnResource = async (name: string, identifier: string) => {
  await performQortalRequest(
    {
      action: 'DELETE_QDN_RESOURCE',
      name,
      service: 'DOCUMENT',
      identifier,
    },
    'Failed to delete QDN resource.'
  );
};

export const encodeObject = objectToBase64;

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
