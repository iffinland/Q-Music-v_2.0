const MEDIA_REFRESH_EVENT = 'media:refresh';

export const emitMediaRefresh = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MEDIA_REFRESH_EVENT));
};

export const subscribeToMediaRefresh = (callback: () => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(MEDIA_REFRESH_EVENT, handler);

  return () => {
    window.removeEventListener(MEDIA_REFRESH_EVENT, handler);
  };
};
