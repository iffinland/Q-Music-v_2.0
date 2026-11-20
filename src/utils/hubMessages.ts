export const isTrustedHubMessage = (event: MessageEvent): boolean => {
  if (
    !event.data ||
    typeof event.data !== 'object' ||
    Array.isArray(event.data)
  )
    return false;
  // Browser iframe: only its actual parent. Native Hub forwards IPC events into
  // the guest's own window with this origin and UI marker (guest preload API).
  if (window.parent !== window && event.source === window.parent) {
    try {
      if (
        document.referrer &&
        new URL(document.referrer).origin !== event.origin
      )
        return false;
    } catch {
      return false;
    }
    return true;
  }
  return (
    event.source === window &&
    event.origin === window.location.origin &&
    event.data.requestedHandler === 'UI'
  );
};
export const internalNavigationPath = (value: unknown): string | null => {
  if (
    typeof value !== 'string' ||
    value.length > 4096 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
    )
  )
    return null;
  try {
    let path = value.split(/[?#]/)[0];
    for (let i = 0; i < 2; i++) path = decodeURIComponent(path);
    if (
      path.startsWith('//') ||
      path.includes('\\') ||
      [...path].some((char) => char.charCodeAt(0) < 32)
    )
      return null;
    if (
      path.split(/[\\/]/).some((segment) => segment === '.' || segment === '..')
    )
      return null;
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return value;
  } catch {
    return null;
  }
};
