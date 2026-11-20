import { isRouteErrorResponse } from 'react-router-dom';
export const describeRouteError = (
  error: unknown,
  online = navigator.onLine
) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  if (!online)
    return {
      title: 'Connection unavailable',
      text: 'You appear to be offline. Reconnect and reload the app, or return to music.',
      message,
    };
  if (isRouteErrorResponse(error) && error.status === 404)
    return {
      title: 'Page not found',
      text: 'This link does not point to an available Q-Music page. Return to music to continue.',
      message,
    };
  if (
    /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading (?:CSS )?chunk/i.test(
      message
    )
  )
    return {
      title: 'Page files could not be loaded',
      text: 'Check your connection and Qortal node, then reload. This can also happen when an app update changes cached page files.',
      message,
    };
  return {
    title: 'This page could not be opened',
    text: 'The page encountered an error. Return to music, or reload to try again. This does not necessarily mean an app update is available.',
    message,
  };
};
