# Q-Music 2.0.4

A more comfortable way to browse, discover and enjoy music, with a choice of
Classic or Modern appearance. Every development phase passed the user's
Android/Hub runtime tests, including final RC8 on 2026-11-22.

## What's new

- **Your choice of appearance.** Open Appearance in the left menu and choose
  Classic or Modern. The app remembers your choice on this device. Light/dark
  mode remains separate, and changing appearance keeps your music playing.
- **Consistent music collections.** Modern Home has simple horizontal rows for
  the latest 15 songs and 15 playlists. Browse, Library and My Music use familiar
  cards, responsive layouts and independent numbered pages. Details open in a
  dialog so you can return to where you were browsing. Modern navigation can
  collapse to a compact icon rail.
- **Repeat and shuffle.** Repeat one song or the current queue, or shuffle its
  remaining songs. Previous follows your actual shuffle listening history.
- **Follow the music.** Artist and publisher names on cards, details, playlist
  tracks and the mini-player open their collections. Publisher collections are
  scoped to that Qortal name; artist collections find indexed credits in batches.
- **A clearer search.** Search from Home or the menu. Choose All, Songs,
  Playlists, Artists or Publishers. Song/playlist search includes available
  indexed descriptions, tags and other metadata. Search more music checks
  another batch while keeping results already found.
- **Discover Mix.** Find a surprise selection of up to 20 Q-Music/Ear-Bump songs
  from recent and older parts of the node's index. Preview first, then Play mix.
  Finding another selection leaves your current playback alone.
- **Publisher-follow mirroring.** On your own node, use Mirror publisher or
  Mirror artist publishers to review and follow selected Qortal publishers.
  Manage all Q-Music follows lets you remove this app's rules later. Hub asks
  for permission and Q-Music checks the saved state.
- **Help when you need it.** Help in the menu explains listening, discovery,
  Library, publishing and node follows. Publishing/editing also show supported
  audio and cover-format hints.

All accepted 2.0.2/2.0.3 publishing, account-isolated Library, playback recovery,
seeking, compact volume controls and Ear-Bump compatibility remain included.

## Clear boundaries

Search/artist collections depend on metadata known to the connected node.
Incomplete searches are labelled and continue only when requested. Artist names
are metadata, not verified identities. Discover Mix is bounded time-based
sampling; it does not promise equal probability for every song in QDN or scan
the entire catalogue before playing. Its queue is finite, with normal Next,
repeat and shuffle controls; it does not silently refill indefinitely.

Native mirroring follows **all content from selected publishers**, including
non-music files and future publications. Artist review lists only publishers
found in the loaded matches. This needs your own selected node with a policy
that permits followed content (FOLLOWED, FOLLOWED_OR_VIEWED or ALL), adequate
storage and available resources. Q-Music cannot read/change that policy or
certify permanent retention or completed per-file downloads. A saved follow rule
is reported as such. Stopping removes only followedNames_qmusic entries, without
deleting hosted files or another app's follow rules. Total storage size is
unknown. Public/unverifiable node contexts cannot mutate these rules.

Underlying Hub/Core requests may outlive a cancelled dApp consumer. QDN indexing,
file availability, codec support, node retention and HTTP Range behavior remain
platform constraints. No Core/Hub changes are part of this release.

## Downloads and verification

- Q-Music_2.0.4.zip — deployable production Q-App, index.html at ZIP root.
- Q-Music_2.0.4_source.zip — source for the exact tagged commit.
- BUILD-INFO.json — version, source commit and packaging information.
- SHA256SUMS.txt — runtime/source/provenance checksums.

Verify **v2.0.4** at the bottom of the sidebar. Local and GitHub workflows run
ESLint, 322 tests across 33 files and TypeScript/Vite build; release packaging
validates relative assets and ZIP integrity. See [verification](verification-2.0.4.md)
and the [user guide](user-guide.md). The GitHub Release tag identifies the exact
source commit used to build the published packages.
