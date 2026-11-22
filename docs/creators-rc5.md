# Q-Music 2.0.4-rc.5 — creator collections and name links

> Historical candidate notes. This work is included in the user-accepted 2.0.4
> release. Current scope and verification: [release notes](release-2.0.4.md)
> and [verification](verification-2.0.4.md). Candidate-state wording below
> records the phase at the time of testing.

Uncommitted test candidate based on public 2.0.3,
42a287e6eea57e521468ba43e91d8c0a05c50aae. Retains accepted RC1/RC3/RC4 work.
RC4 runtime PASSED on 2026-11-22. No commit, push, public release or Core/Hub
changes. This implements the creator-navigation phase of the feedback plan.

## Publisher collection

Publisher names link to /publishers/:publisher. Songs and playlists have
independent 20-card pages, using existing exact publisher-scoped QDN queries and
separate Q-Music/Ear-Bump source cursors. No whole-catalog scan is started for a
publisher. Play, details, Retry and Refresh remain available. Changing the route
name resets both collections rather than showing another publisher's old page.

## Artist collection

Artist names link to /artists/:artist. This groups the artist text available in
the music index across publishers; it is not a verified identity or official
artist account. Matching normalizes surrounding/repeated whitespace, Unicode
NFC and letter case. It does not remove accents/punctuation, split collaborations
or merge similar names automatically.

Artist is metadata, so the existing QDN name filter cannot directly select it.
The new hook checks at most two 50-song index pages per initial visit or explicit
continuation. Q-Music/Ear-Bump prefix cursors retain buffered rows. It reads no
audio, cover, full song DOCUMENT or playlist payload to search for artists.
Matches based on metadata absent from the index may be unavailable until indexed
or known locally; this is not a claim of a complete authoritative discography.

The view reports how many indexed songs were checked, labels the collection
incomplete while more source rows remain, and offers Search more songs. It does
not scan continuously in the background until the entire network is exhausted.
Loaded matches use local 20-card pagination. A stable before snapshot prevents
newer index entries shifting the scan; Refresh starts a new snapshot. One batch
has a 30-second consumer deadline. Successful batches survive a later read error
and continuation resumes the saved cursor. Navigation aborts the consumer and
late responses cannot replace the new artist's results.

## Name links

Shared CreatorLink components are used by both Classic and Modern cards, full
song/playlist details, individual playlist-track credits and the global player.
Publisher and artist are separate labelled links, even if their text is alike.
Mini-player playlist context remains visible when it differs from the publisher.
The existing drag handle excludes links, so a name click does not start dragging.

Modern keeps its whole-card detail hit area through a sibling overlay link;
artist/publisher links sit above it as separate anchors. There are no nested
anchors, and clicking a creator does not invoke Play or Details. Classic retains
its title/Details links and gives its artist/publisher text independent links.
UTF-8 names and slash-containing artist names are encoded as internal routes;
empty, excessively long or malformed names do not generate broken links.

Routes are lazy-loaded, preserve the existing basename/native APP path setup and
work with direct URLs. Opening a song/playlist from a collection uses the same
shared detail dialog/Back behavior. One global player stays mounted when moving
to creator pages, preserving the queue, volume, repeat and shuffle state. Help
now explains creator links and incremental artist lookup.

## Remaining feedback phases

Dedicated search-result categories/refinement, network-wide Discover Mix and
explicit catalog mirroring remain separate work. No mirror or automatic pinning
action is offered by this candidate, and Library favorites do not mirror files.

## Verification

ESLint, **293 tests in 30 files**, TypeScript/Vite build and git diff --check
pass. New tests cover bounded artist batches and cursor continuation, exact name
matching across publishers, retained partial results, deadlines/cancellation and
late responses, scoped publisher pagination and route reset, encoded internal
links, incomplete/unverified artist messaging and no nested card anchors in
either skin. A real player-hook test navigates its artist link without creating
a new audio element or restarting playback. Existing regression coverage stays
passing. Playlist track row keys also include occurrence index so duplicate
references retain separate rendered entries, as they already do in playback.

Tests simulate DOM/native QDN/audio APIs. User Android/Hub runtime **PASSED on 2026-11-22**. Delivery checks generated version, relative assets and ZIP CRC.

## Runtime checklist

1. In each skin, tap a publisher on a card or in details. Check only that Qortal
   name's songs/playlists appear; page the sections independently and play a song.
2. Open an artist with songs from more than one publisher. Check the name-based
   collection explanation and incomplete status. Search more songs should load a
   small further batch, not continuously run a full scan.
3. While playing, tap artist/publisher links in the mini-player. Audio must keep
   playing with its position, volume, repeat and shuffle settings.
4. Try names with spaces and punctuation, direct collection links and Back after
   opening song/playlist details. Creator links must not accidentally trigger Play.
5. Open another creator while a lookup is loading. Old results must not appear
   under the new name; unavailable reads should retain a useful Retry/Continue.
