# Q-Music 2.0.4-rc.6 — unified music search

> Historical candidate notes. This work is included in the user-accepted 2.0.4
> release. Current scope and verification: [release notes](release-2.0.4.md)
> and [verification](verification-2.0.4.md). Candidate-state wording below
> records the phase at the time of testing.

Uncommitted test candidate on public 2.0.3 base
42a287e6eea57e521468ba43e91d8c0a05c50aae. Includes all accepted RC1–RC5 work.
RC5 creator-collection runtime PASSED on 2026-11-22. No commit/push, public
release, QDN publication or Core/Hub modification is part of this candidate.

## Finding music

Home has a Search all music form, and the navigation menu has Search. Both skins
use the same search controller. Browse Songs/Playlists keep their existing
filters/alphabet/sort and add a link to search across the other categories.
Entering text does not start index reads; submit explicitly to open /search?q=.
An empty Search page makes no search-index request.

All, Songs, Playlists, Artists and Publishers tabs separate the results. All
shows up to five results per category with View all links; individual media and
creator categories use local 20-result pagination. Cards keep the shared skin,
creator links, detail modal and Play actions. Song Play queues the displayed
matching results and selects the clicked song. Playlist contents are read only
on explicit Play or opening details, as on other collection pages.

Song matches include available indexed title, artist, publisher, identifier,
album, genre, mood, language, notes, date, description and tags. Playlist matches
include indexed title, publisher, identifier, description, date and tags. All
query words must occur somewhere in those indexed details, case-insensitively
and with Unicode NFC normalization; accents remain significant. Existing Browse
filter behavior is retained. Index metadata tags now survive summary mapping;
invalid non-string/empty tag entries are discarded.

Artist/publisher tabs match the names themselves, not arbitrary text in someone
else's track notes. Artist names group as in RC5 (case/whitespace/NFC); a shared
name is not proof of a verified artist identity. Publisher results link to exact
publisher collections. Result counts describe only the checked index, not the
creator's full catalogue. The All count adds categories, so one song can also
contribute its matching artist/publisher entries.

## Bounded work and partial availability

A submitted search initially requests one page of up to 50 indexed songs and
one of up to 50 indexed playlists, using the existing Q-Music/Ear-Bump prefix
cursor service. That service may query each prefix and retain buffered rows;
50 is a returned-item page bound, not a guarantee of 50 raw rows total across
all network calls. No full song DOCUMENT, playlist payload or audio is fetched
to match text. Visible card artwork follows the existing visibility gate.

The page says how many items were checked and labels results incomplete while
more source data remains. Search more music requests one further page from each
unexhausted source. There is no automatic loop over the full network. Query edits
and category switches reuse checked data and cursors within the active Search
page; leaving/unmounting Search cancels the consumer. Refresh starts a new
snapshot. The before snapshot prevents new publications shifting offsets.

Song/playlist sources commit independently, so a slow or failed source does not
hide the other's results. Failed sources retain their cursor for Retry; exhausted
sources are skipped. Each batch has a 30-second consumer deadline. Previously
found results survive errors and stale responses cannot update an unmounted
search. Changing to an empty query removes results and stops the search consumer.

Search is limited to metadata available in the node index (and existing local
summary enrichment). It cannot promise discovery of metadata omitted from that
index or resources not yet indexed by the connected node. Existing Browse's
explicit catalog/filter scans have not been replaced by this bounded search.
Network-wide Discover Mix and explicit catalogue mirroring remain future phases.

## Verification

ESLint, 300 tests in 31 files, TypeScript/Vite production build and git diff
--check passed. Added coverage checks Unicode/multiword/deep metadata matching,
name-only creator matching, tag mapping without payload reads, no queries during
empty search/typing, reuse across tabs and query edits, independent cursors,
partial failures, refresh, deadlines, cancellation/late responses, and selected
result playback. Existing playback, publishing, Library, appearance and creator
regressions remain passing.

Tests simulate DOM/native APIs; user Android/Hub runtime for RC6 **PASSED on 2026-11-22**.
Packaging checks the generated version, asset links and ZIP integrity.

## Runtime checklist

1. From Home or Search, submit a title, artist, publisher or indexed description
   word. Check all five tabs; try a second query and Search more music.
2. Check that incomplete results say so. Search more must be explicit and retain
   existing matches; an unavailable source should leave useful results/Retry.
3. Play a matching song, open its details and creator links, and return. Verify
   the selected song/queue and uninterrupted player while navigating.
4. Repeat in Classic and Modern, including mobile tabs and creator pagination.
5. From Browse Songs/Playlists follow the new cross-search link. Existing local
   filters, alphabet sorting, publishing and Library must continue to work.
