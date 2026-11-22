import { CloudDownloadRounded } from '@mui/icons-material';
import { Button, CircularProgress } from '@mui/material';
import { lazy, Suspense, useState } from 'react';
const CatalogMirrorDialog = lazy(() =>
  import('./CatalogMirrorDialog').then((module) => ({
    default: module.CatalogMirrorDialog,
  }))
);
export interface MirrorCatalogProps {
  name: string;
  kind: 'artist' | 'publisher';
  publishers: string[];
  incomplete?: boolean;
}
export const CatalogMirrorButton = (props: MirrorCatalogProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        startIcon={<CloudDownloadRounded />}
        variant="outlined"
        sx={{ alignSelf: 'flex-start' }}
        onClick={() => setOpen(true)}
      >
        {props.kind === 'artist'
          ? 'Mirror artist publishers'
          : 'Mirror publisher'}
      </Button>
      {open ? (
        <Suspense
          fallback={
            <CircularProgress size={24} aria-label="Opening mirror options" />
          }
        >
          <CatalogMirrorDialog {...props} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
};
