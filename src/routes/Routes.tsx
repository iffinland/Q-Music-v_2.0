import { Suspense, lazy, type ReactNode } from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';

interface CustomWindow extends Window {
  _qdnBase: string;
}
const customWindow = window as unknown as CustomWindow;
const baseUrl = customWindow?._qdnBase || '';
const AppWrapper = lazy(() =>
  import('../AppWrapper').then((module) => ({
    default: module.AppWrapper,
  }))
);
const AppHome = lazy(() =>
  import('../App').then((module) => ({
    default: module.default,
  }))
);
const SongsPage = lazy(() =>
  import('../pages/SongsPage').then((module) => ({
    default: module.SongsPage,
  }))
);
const SongDetailPage = lazy(() =>
  import('../pages/SongDetailPage').then((module) => ({
    default: module.SongDetailPage,
  }))
);
const PlaylistsPage = lazy(() =>
  import('../pages/PlaylistsPage').then((module) => ({
    default: module.PlaylistsPage,
  }))
);
const PlaylistDetailPage = lazy(() =>
  import('../pages/PlaylistDetailPage').then((module) => ({
    default: module.PlaylistDetailPage,
  }))
);
const LibraryPage = lazy(() =>
  import('../pages/LibraryPage').then((module) => ({
    default: module.LibraryPage,
  }))
);
const MyMusicPage = lazy(() =>
  import('../pages/MyMusicPage').then((module) => ({
    default: module.MyMusicPage,
  }))
);
const EditSongPage = lazy(() =>
  import('../pages/EditSongPage').then((module) => ({
    default: module.EditSongPage,
  }))
);
const EditPlaylistPage = lazy(() =>
  import('../pages/EditPlaylistPage').then((module) => ({
    default: module.EditPlaylistPage,
  }))
);
const PublishPage = lazy(() =>
  import('../pages/PublishPage').then((module) => ({
    default: module.PublishPage,
  }))
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({
    default: module.NotFoundPage,
  }))
);

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<div>Loading route...</div>}>{element}</Suspense>
);

export function Routes() {
  const router = createBrowserRouter(
    [
      {
        path: '/',
        element: withSuspense(<AppWrapper />),
        children: [
          {
            index: true,
            element: withSuspense(<AppHome />),
          },
          {
            path: 'songs',
            element: withSuspense(<SongsPage />),
          },
          {
            path: 'songs/:publisher/:identifier',
            element: withSuspense(<SongDetailPage />),
          },
          {
            path: 'playlists',
            children: [
              {
                index: true,
                element: <Navigate to="/playlists/all" replace />,
              },
              {
                path: 'all',
                element: withSuspense(<PlaylistsPage />),
              },
              {
                path: ':name/:playlistId',
                element: withSuspense(<PlaylistDetailPage />),
              },
            ],
          },
          {
            path: 'library',
            element: withSuspense(<LibraryPage />),
          },
          {
            path: 'my-music',
            element: withSuspense(<MyMusicPage />),
          },
          {
            path: 'my-music/songs/:identifier/edit',
            element: withSuspense(<EditSongPage />),
          },
          {
            path: 'my-music/playlists/:identifier/edit',
            element: withSuspense(<EditPlaylistPage />),
          },
          {
            path: 'publish',
            element: withSuspense(<PublishPage />),
          },
          {
            path: '*',
            element: withSuspense(<NotFoundPage />),
          },
        ],
      },
    ],
    {
      basename: baseUrl,
    }
  );

  return <RouterProvider router={router} />;
}
