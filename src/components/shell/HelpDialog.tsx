import { ExpandMoreRounded } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import {
  AUDIO_FORMATS_HELP,
  AUDIO_LIMIT_TEXT,
  COVER_FORMATS_HELP,
} from '../../utils/publishLimits';

const sections = [
  {
    title: 'Listening, repeat and shuffle',
    paragraphs: [
      'Play starts the selected song or playlist. Drag the position slider to seek; seeking while paused keeps the song paused. Tap the speaker icon to adjust volume or mute.',
      'The repeat button cycles through Off, Repeat queue and Repeat one. Repeat one restarts the current song when it finishes; Next still moves to another song. Repeat queue continues from the beginning after the queue finishes.',
      'Shuffle chooses from the current queue, not the entire QDN catalog. It keeps the original playlist order intact and plays the remaining entries before starting another round. Previous revisits your actual shuffle history; Next after Previous follows that history again. Turn Shuffle off to return to the original order.',
      'Choose a playlist or a group of songs first to make a longer listening queue. An unavailable song still needs Retry or Next; repeat does not bypass a missing file.',
    ],
  },
  {
    title: 'Finding music',
    paragraphs: [
      'Use Search in the menu or the Home search box to find songs, playlists, artists and publishers together. All shows a short preview; the other tabs show each result type separately. Artist and publisher tabs match names, while song and playlist tabs search the available indexed metadata, including tags.',
      'Search checks a small batch first. Search more music continues from the saved position. Incomplete results are labelled, and changing tabs or editing the query reuses the index already checked rather than starting it again.',
      'Discover Mix in the menu or Home finds up to 20 songs using small batches from recent and randomly chosen older parts of the node index. Find a mix does not interrupt playback. Play mix replaces the queue; Find another mix excludes songs in the current preview. This is a time-based sample, not uniform random access to every QDN song. It needs no wallet approval and publishes nothing.',
      'Home and Browse include music published through Q-Music and Ear-Bump. Use Browse search, filters and alphabet buttons to find songs. Some searches need more index results; the page tells you when results are still incomplete.',
      'Publisher and artist names on cards, details and the mini-player open their music collections. Publisher pages load only that Qortal name. Artist collections use published names from the index; Search more songs checks another small batch without scanning the entire catalog at once.',
      'Select a card or its Details link for full information. Close details or use Back to return to the previous view. The numbered pages load more results as you browse, without requiring a total catalog count first.',
    ],
  },
  {
    title: 'Mirroring on your own node',
    paragraphs: [
      'Open a publisher collection and choose Mirror publisher. From an artist collection, Mirror artist publishers lists the publishers of songs found so far; an incomplete artist search may miss other publishers. Nothing is selected automatically.',
      'This uses your own node’s publisher-follow feature. It covers all content from the selected publishers, including non-music files and future publications. Total size is unknown. Public nodes cannot be managed. Confirm that you manage the node currently selected in Hub and keep that node selected while approving.',
      'Your node must have a storage policy that includes followed content (FOLLOWED, FOLLOWED_OR_VIEWED or ALL), enough space and access to the files. Q-Music cannot read/change those settings. A saved follow rule is not proof that all files have downloaded or will be kept forever; your node manages this work after the app closes.',
      'Choose up to 20 publishers, acknowledge the scope, then Follow on my node. Hub asks for permission and Q-Music checks the saved list. No QORT payment or publishing is involved. If the result is uncertain, Refresh status before trying another change.',
      'Manage all Q-Music follows shows rules previously saved through this app. Stop Q-Music follow removes only those rules, not hosted files or another app’s follow list. Other follow lists and node policies may continue to mirror that publisher. Favorites and downloads to your device are separate features.',
    ],
  },
  {
    title: 'Your Library',
    paragraphs: [
      'Save songs or playlists from their details to keep them in Library. Recently Played is updated when you start songs from the music views. Collections are kept separately for each wallet and Qortal name.',
      'Local changes do not automatically publish a backup. Use Save to QDN in Library when you want an online backup, and Check sync to check its state. A sent publication can take time to become available on a node. Saving a favorite does not mirror its audio files.',
    ],
  },
  {
    title: 'Publishing files and covers',
    paragraphs: [
      'Choose a single song, an album/folder or a playlist. Songs need a title, artist and audio file. On a phone, an album can be selected as several files; they do not have to be in one folder.',
      AUDIO_FORMATS_HELP,
      AUDIO_LIMIT_TEXT,
      COVER_FORMATS_HELP,
      'Review the prepared items before publishing. Qortal Hub asks for approval and fees; audio, details, covers and playlists can require separate confirmations. If a job is interrupted, open Publish activity to check or continue it rather than starting a duplicate publication.',
      'The 64 MiB limit applies only to automatic reuse of existing audio while editing. It is not a listening or publishing limit. For a larger existing song, select the original file from your device.',
    ],
  },
  {
    title: 'Appearance',
    paragraphs: [
      'Open Appearance in the menu to choose Classic or Modern. The selection is remembered on this device and switching does not stop your music. The light/dark button works independently with both layouts.',
    ],
  },
  {
    title: 'If audio does not start',
    paragraphs: [
      'A node may still be finding, downloading or preparing the file. The player can wait and retry an initial media error up to twice. Pause, a different song or Close cancels that preparation.',
      'If the player asks you to press Play, your browser needs that direct action before allowing audio. If the resource remains unavailable, try Retry later or choose another song. A load error alone does not prove that the audio format is wrong; playback also depends on network availability and your device.',
    ],
  },
];
export const HelpDialog = ({ onClose }: { onClose: () => void }) => (
  <Dialog
    open
    onClose={onClose}
    fullWidth
    maxWidth="sm"
    aria-labelledby="help-title"
  >
    <DialogTitle id="help-title">Q-Music Help</DialogTitle>
    <DialogContent dividers>
      {sections.map((section, index) => (
        <Accordion
          key={section.title}
          defaultExpanded={index === 0}
          disableGutters
          elevation={0}
        >
          <AccordionSummary expandIcon={<ExpandMoreRounded />}>
            <Typography component="h2" variant="subtitle1">
              {section.title}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              {section.paragraphs.map((paragraph) => (
                <Typography key={paragraph} variant="body2">
                  {paragraph}
                </Typography>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close help</Button>
    </DialogActions>
  </Dialog>
);
