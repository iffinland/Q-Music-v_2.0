import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useAtom } from 'jotai';
import { skinAtom, skins, type Skin } from '../../state/appearance';

export const AppearanceDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [skin, setSkin] = useAtom(skinAtom);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="appearance-title"
    >
      <DialogTitle id="appearance-title">Appearance</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose your layout. Your selection is remembered on this device. Music
          keeps playing when you switch.
        </Typography>
        <RadioGroup
          aria-label="Layout"
          value={skin}
          onChange={(_, value) => setSkin(value as Skin)}
        >
          {skins.map((item) => (
            <Stack
              key={item.id}
              spacing={0.5}
              sx={{
                p: 2,
                mb: 1.5,
                border: '1px solid',
                borderColor: skin === item.id ? 'primary.main' : 'divider',
                borderRadius: 2,
                bgcolor:
                  skin === item.id ? 'var(--qm-primary-soft)' : 'transparent',
              }}
            >
              <FormControlLabel
                value={item.id}
                control={<Radio />}
                label={item.label}
              />
              <Typography variant="body2" color="text.secondary">
                {item.description}
              </Typography>
            </Stack>
          ))}
        </RadioGroup>
        <Typography variant="caption" color="text.secondary">
          Light and dark mode are available with both layouts using the theme
          button.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};
