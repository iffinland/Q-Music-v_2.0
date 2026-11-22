import { Link as MuiLink } from '@mui/material';
import { Link } from 'react-router-dom';
import { creatorPath } from '../../utils/creators';

export const CreatorLink = ({
  kind,
  name,
}: {
  kind: 'artist' | 'publisher';
  name: string;
}) => {
  const path = creatorPath(kind, name);
  const label = kind === 'publisher' ? `@${name}` : name;
  return path ? (
    <MuiLink
      component={Link}
      to={path}
      color="inherit"
      underline="hover"
      aria-label={`${kind === 'publisher' ? 'Publisher' : 'Artist'}: ${label}`}
      sx={{
        position: 'relative',
        zIndex: 2,
        overflowWrap: 'anywhere',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
        },
      }}
    >
      {label}
    </MuiLink>
  ) : (
    <>{label}</>
  );
};
