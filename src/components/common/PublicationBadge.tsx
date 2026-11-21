import { Chip } from '@mui/material';
import { publicationOrigin } from '../../utils/mediaOrigin';
export const PublicationBadge = ({ identifier }: { identifier?: string }) => {
  const origin = publicationOrigin(identifier);
  return origin ? (
    <Chip
      label={`Published @ ${origin}`}
      size="small"
      variant="outlined"
      title={`Publication source indicated by the ${origin} identifier format`}
      sx={{
        alignSelf: 'flex-start',
        maxWidth: '100%',
        minHeight: 22,
        height: 'auto',
        fontSize: '0.68rem',
        fontWeight: 600,
        '& .MuiChip-label': {
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          py: 0.25,
        },
      }}
    />
  ) : null;
};
