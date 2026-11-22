import { Suspense, lazy } from 'react';
import { Skeleton } from '@mui/material';
import { useAtomValue } from 'jotai';
import { skinAtom } from '../../state/appearance';
import type { MediaCardProps } from '../skins/types';
const Classic = lazy(() =>
  import('../skins/classic/ClassicMediaCard').then((m) => ({
    default: m.ClassicMediaCard,
  }))
);
const Modern = lazy(() =>
  import('../skins/modern/ModernMediaCard').then((m) => ({
    default: m.ModernMediaCard,
  }))
);
export const MediaCard = (props: MediaCardProps) => {
  const skin = useAtomValue(skinAtom);
  const Card = skin === 'classic' ? Classic : Modern;
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={360} />}>
      <Card {...props} />
    </Suspense>
  );
};
