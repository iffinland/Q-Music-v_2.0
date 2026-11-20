import type { RouteObject } from 'react-router-dom';
import { RouteRefreshNotice } from '../components/common/RouteRefreshNotice';
export const withRouteBoundaries = (routes: RouteObject[]): RouteObject[] =>
  routes.map(
    (route) =>
      ({
        ...route,
        errorElement: route.errorElement || <RouteRefreshNotice compact />,
        ...(route.children
          ? { children: withRouteBoundaries(route.children) }
          : {}),
      }) as RouteObject
  );
