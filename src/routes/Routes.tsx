import { withRouteBoundaries } from './routeBoundaries';
import { Suspense, lazy, type ReactNode } from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';
import { RouteRefreshNotice } from '../components/common/RouteRefreshNotice';

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
const DiscoverPage = lazy(() =>
  import('../pages/DiscoverPage').then((module) => ({
    default: module.DiscoverPage,
  }))
);
const SearchPage = lazy(() =>
  import('../pages/SearchPage').then((module) => ({
    default: module.SearchPage,
  }))
);
const PublisherPage = lazy(() =>
  import('../pages/PublisherPage').then((module) => ({
    default: module.PublisherPage,
  }))
);
const ArtistPage = lazy(() =>
  import('../pages/ArtistPage').then((module) => ({
    default: module.ArtistPage,
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

const router = createBrowserRouter(
  withRouteBoundaries([
    {
      path: '/',
      element: withSuspense(<AppWrapper />),
      errorElement: <RouteRefreshNotice />,
      children: [
        {
          index: true,
          element: withSuspense(<AppHome />),
        },
        { path: 'discover', element: withSuspense(<DiscoverPage />) },
        { path: 'search', element: withSuspense(<SearchPage />) },
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
          path: 'publishers/:publisher',
          element: withSuspense(<PublisherPage />),
        },
        { path: 'artists/:artist', element: withSuspense(<ArtistPage />) },
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
  ]),
  {
    basename: baseUrl,
  }
);

export function Routes() {
  return <RouterProvider router={router} />;
}
