# Q-Music 2.0.4-rc.2 — Library and My Music cards

> Historical candidate notes. This work is included in the user-accepted 2.0.4
> release. Current scope and verification: [release notes](release-2.0.4.md)
> and [verification](verification-2.0.4.md). Candidate-state wording below
> records the phase at the time of testing.

Included in the user's **PASSED RC3 combined runtime test** on 2026-11-22.
This records acceptance of the included work, not a separate RC2 test run.

Uncommitted test candidate based on public 2.0.3, commit
42a287e6eea57e521468ba43e91d8c0a05c50aae. Includes the user-accepted RC1 visual
refresh. RC1 mobile runtime PASSED on 2026-11-21; this addition awaits runtime
testing. No commit, push, public release or Core/Hub changes.

## Library

Recently Played, Saved Songs and Saved Playlists now use the same MediaCard and
responsive MediaGrid as Home/Browse, including fixed square artwork, readable
title areas, publisher/source labels, Play buttons and routed detail dialogs.
Each collection has independent 20-card local pagination. Only the visible page
renders cards; pagination does not trigger catalog, playlist-payload or count
reads. The original local collection ordering is retained.

Existing LibraryControls are retained for explicit QDN backup, refresh, uncertain
save recovery and legacy import. Collection changes are not automatically sent
to QDN. Save/remove actions in details remain available. Song playback updates
recent history and uses the displayed page order. Playlist payloads are loaded
only after an explicit Play click. Empty collections have a concise Browse link.

The account key scopes the whole collection view, clearing section pagination,
control dialog state and pending playlist playback when the wallet/name changes.

## My Music

Your Songs and Your Playlists use the same cards/grid and independently request
20 owner-scoped items at a time. Numbered pagination expands only the requested
feed; returning to previous loaded pages reuses its data. Guest mode starts no
owner-feed requests. Name changes reset both page cursors and rendered sections;
an additional publisher check prevents cross-name cards/edit links.

Q-Music publications retain Edit song / Edit playlist links as separate actions
outside the detail-card link. Ear-Bump originals remain read-only in Q-Music and
display an Edit through Ear-Bump reminder instead of a Q-Music edit action.
Play buttons and detail dialogs work consistently with other pages. Errors and
explicit Refresh/Retry remain available.

## Boundaries and checks

The shared card accepts optional management actions; Home/Browse retain their
existing appearance and behavior. Images remain visibility-gated; embedded
Ear-Bump playlist covers retain RC1's fallback on cards and full cover in details.
No new dependencies or background full-catalog/count scans are added.

ESLint, **268 tests in 26 files**, TypeScript/Vite build and git diff --check
pass. New tests check independent local/owner pagination, no implicit backup or
payload reads, playback identity/order, retained edit links, Ear-Bump and foreign
publisher boundaries, guest behavior and account/name resets. Existing Library
sync/storage, native playback, publishing and visual-refresh tests also pass.
Tests simulate DOM/media/QDN APIs; physical mobile layout acceptance remains the
user's runtime check. Delivery validates relative assets, version and ZIP CRC.

## Runtime checklist

1. Open Library: check Recently Played, Saved Songs and Saved Playlists match the
   accepted Home/Browse cards in both themes and mobile widths.
2. If a collection exceeds 20 items, switch its numbered page. Other collections
   must keep their page. Play an item, open/close its details and return via Back.
3. Open the existing sync/import controls and confirm familiar states/actions.
   No QDN save approval should appear merely from opening Library or paging it.
4. Open My Music: check own publications, independent song/playlist pages, Play,
   details and Q-Music edit links. Ear-Bump originals must not have edit links.
5. Switch account/name or enter guest mode: no cards/pages from the old owner
   should remain. Recheck the accepted player seek/volume controls.
