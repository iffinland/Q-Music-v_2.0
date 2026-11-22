# Q-Music 2.0.4-rc.1 — discovery and card layout

> Historical candidate notes. This work is included in the user-accepted 2.0.4
> release. Current scope and verification: [release notes](release-2.0.4.md)
> and [verification](verification-2.0.4.md). Candidate-state wording below
> records the phase at the time of testing.

Runtime acceptance: **PASSED** by the user on 2026-11-21. Mobile layout was
usable and all functions worked. Continued in RC2 for Library and My Music.

Uncommitted runtime-test candidate based on accepted public 2.0.3,
42a287e6eea57e521468ba43e91d8c0a05c50aae. No Core/Hub changes, commit, push or
public release. All previously accepted player and publishing features remain.

## Navigation and Home

Desktop navigation collapses to an 80px icon rail, with named/title-labelled
links and an explicit expand button. The local preference is remembered;
blocked localStorage does not break navigation. Mobile retains the accessible
menu button and dismissing drawer. No pulsing navigation or support animation.
The version stays at the sidebar bottom.

Home has Latest songs and Latest playlists shelves, each requesting at most 15
merged Q-Music/Ear-Bump publications. Native horizontal scrolling works with
touch/trackpad, mouse scrollbar and keyboard focus. Scrollbar track/thumb use the
existing theme variables for light/dark modes. No carousel library, auto-scroll,
snap animation or additional runtime dependency.

## Shared cards and Browse

Home and both Browse pages use the same card component: square cropped artwork,
two-line title, artist/known track count, two-line summary, publisher and explicit
publication source label. Full title is preserved; only the visible card lines
are clamped. The entire card link opens details; its separate Play button starts
audio or deliberately loads the selected playlist. Duplicate playlist song
occurrences retain distinct queue keys. Another selected song/navigation cancels
stale playlist-start work.

Browse renders at most 20 cards per page. Container-width CSS selects 1 column
below 320px, then 2, 3 at 630px, 4 at 860px and 5 at 1100px of available content
width. This accounts for expanded/collapsed navigation rather than only viewport
width. Song search, filters and artist alphabet are retained; playlists also
have a title alphabet. Filter/sort changes return to the first page.

Pagination shows loaded page numbers and a next-to-load page when the source has
more. Moving forward grows the bounded feed request by one page; Previous reuses
loaded data. No catalog-wide count scan or invented total/last page. Latest order
uses publication creation time consistently with the source merge.

As before, explicitly requesting search/alphabet/global sorting expands the
index catalog in background; it is not performed on Home or ordinary Latest
browsing. QDN does not supply arbitrary title/artist metadata ordering here, so
these modes must gather the index to produce complete global order. While this
is incomplete, the UI explicitly describes results/order as loaded so far.
Playlist track-count sort remains explicitly requested and may read payloads.

## Details

Card navigation retains the real song/playlist URL, sharing and browser Back.
The originating page stays mounted beneath the dialog, preserving filters,
loaded cursor data, pagination and horizontal scroll. Desktop uses a dialog;
below 600px it fills the screen. Direct/reloaded links mount one detail view and
Close returns safely to the relevant Browse page. The global player remains
mounted, and detail pages retain full metadata, playlist tracks, Library/social
and download actions. Comments remain loaded on demand.

## Loading boundaries

Cards do not fetch full song metadata, playlist payloads or track counts merely
to render. Artwork requests start when near the visible area and use the existing
background-priority queue. Missing art has a fixed-size fallback; it does not
block cards or audio. Ear-Bump playlist covers are embedded inside playlist JSON,
so their cards retain a fallback rather than starting a full playlist download
per cover. Embedded covers remain visible in the detail view. This is intentional
to preserve the agreed lightweight initial view.

## Verification

ESLint, **262 tests across 25 files**, TypeScript/Vite production build and
git diff --check pass. New regression coverage includes 15+15 Home cards without
catalog/payload scans; 20-card pagination and cached Previous; filter reset;
default playlist card reads; detail URL/Back/state preservation and safe direct
links; stored/blocked-storage icon navigation; explicit playlist playback,
duplicate references and stale cancellation; visibility-gated artwork.

Automated checks use simulated QDN/media/DOM APIs. The cloud browser cannot access
the execution environment's localhost, so no live browser screenshot or physical
Android layout acceptance was claimed by the automated checks. The user
subsequently supplied mobile runtime acceptance as recorded above.
Delivery also validates relative build assets, title/version and both ZIP CRCs.

## Runtime checklist

1. Sidebar: collapse/expand on desktop, reload the preference, navigate via icons;
   on mobile open the drawer, choose a page and confirm it closes.
2. Home: two shelves, up to 15 each; scroll left/right and check themed scrollbars
   in light/dark. Long titles/usernames must not stretch cards.
3. Browse: 20 cards maximum; check narrow phone, tablet and wide desktop layouts,
   then toggle sidebar. Next/Previous and numbered pages must preserve selection.
4. Search/alphabet/sort: reset to page 1; incomplete searches must remain labelled.
5. Open card details, play audio, close or use Back: return to the same filter,
   page and scroll position. Open a copied detail link directly as well.
6. Play a playlist from its card and switch songs while it is loading; an old
   response must not replace the newly selected song.
7. Recheck seeking, volume popup, Ear-Bump playback and publishing navigation.
