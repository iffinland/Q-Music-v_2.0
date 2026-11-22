import { SearchRounded } from '@mui/icons-material';
import { Box, Button, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
export const MusicSearchForm = ({
  initialQuery = '',
}: {
  initialQuery?: string;
}) => {
  const [query, setQuery] = useState(initialQuery);
  const navigate = useNavigate();
  return (
    <Box
      component="form"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim())
          void navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }}
    >
      <Stack direction="row" spacing={1}>
        <TextField
          label="Search all music"
          placeholder="Songs, playlists, artists or publishers"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          size="small"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!query.trim()}
          aria-label="Search music"
        >
          <SearchRounded />
        </Button>
      </Stack>
    </Box>
  );
};
