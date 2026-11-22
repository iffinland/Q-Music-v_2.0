# Q-Music 2.0.4-rc.3 — built-in Classic and Modern layouts

> Historical candidate notes. This work is included in the user-accepted 2.0.4
> release. Current scope and verification: [release notes](release-2.0.4.md)
> and [verification](verification-2.0.4.md). Candidate-state wording below
> records the phase at the time of testing.

Runtime acceptance: **PASSED** by the user on 2026-11-22, including the RC2 work
carried in this combined package. The original candidate notes follow.

Uncommitted test candidate based on public 2.0.3,
42a287e6eea57e521468ba43e91d8c0a05c50aae. Includes RC1's accepted visual refresh
and RC2's Library/My Music work. RC1 mobile runtime PASSED; RC2 and this addition
were included in the accepted combined runtime test. No commit/push/public release
or Core/Hub changes.

## Choice

The sidebar includes Appearance, available as a labelled palette icon in the
Modern icon rail and a text button in wide/mobile navigation. The dialog offers:

- **Classic**: default for a device without a valid preference. Familiar 2.0.3
  spacious panels, two featured songs, Library activity and a featured playlist
  on Home. Song browsing uses larger detailed cards; playlists use a wider-card
  grid; Library uses spacious single-column entries. Desktop navigation stays
  wide. This is a presentation of the familiar design with current shared
  features and fixes, not a second frozen copy of the old app.
- **Modern**: the accepted Home shelves, compact square-cover cards, responsive
  grids and optional icon navigation. Its collapsed-menu preference is retained
  while Classic is selected and restored when switching back.

Selection applies immediately and is stored locally under qmusic-skin, with no
QDN transaction, remote version document or account-specific copy. Unknown saved
values fall back to Classic. Blocked storage leaves the active in-memory choice
usable. Light/dark mode remains independent and available with both layouts.

On mobile, opening Appearance dismisses the menu first, so closing the appearance
dialog exposes the selected page rather than leaving it hidden by the drawer.

## Shared behavior and loading

Skins own presentation only. Existing page controllers retain search/filter/page
state and catalog/feed cursors. Home uses the same bounded 15-song/15-playlist
feed for either layout; Classic displays fewer featured items, and switching to
Modern can reveal the already loaded items without restarting these feeds.
Browse, Library and My Music keep current numbered pagination, owner controls
and shared routed detail dialogs in both skins. The new skin option does not
restore old bugs, old player code or the removed in-app change-log system.

One AppShell and global player remain mounted. Playback state, current audio
element, position and volume are not reset by a skin change. Publishing and
Library sync engines are unchanged. No automatic QDN save or publication is
initiated when selecting a skin.

Classic/Modern Home views and media cards are separate lazy presentation chunks;
the unselected presentation is not statically imported by the other. Vendor
components, page controllers and state are shared. The chosen view may resolve
visible artwork again when its presentation mounts; switching does not scan the
catalog, reload audio or download all playlist payloads. Existing image and
Ear-Bump embedded-cover boundaries remain as described in RC1.

## Extension

Built-in skin IDs, labels and descriptions are listed in src/state/appearance.ts.
Presentation components live under src/components/skins, with shared typed props.
A future built-in layout adds its registry entry and lazy presentation mapping;
it reuses the same page controllers/services rather than copying them. User
uploaded/executable skin packages are outside this candidate's scope.

## Verification

ESLint, **272 tests in 27 files**, TypeScript/Vite production build and
git diff --check pass. New coverage verifies preference defaults, remembered and
invalid values, blocked storage and theme independence. An integration test
switches live Classic → Modern → Classic with the actual shared player/hook/feed
lifecycle: the audio element, play count, playing state and 42-second position
remain unchanged, and both catalog loaders are called once. Owner/Ear-Bump edit
restrictions are checked in both card presentations. Existing tests retain
explicit Modern coverage for the accepted layouts.

Tests simulate native QDN/audio APIs and DOM behavior; physical mobile/browser
layout acceptance is not claimed. Delivery checks build/version, relative assets,
separate skin chunks and ZIP CRC. User runtime testing subsequently PASSED.

## Runtime checklist

1. On first use, confirm Classic. Open sidebar → Appearance → Modern → Done.
   On mobile the menu should close and reveal the selected layout.
2. Switch both ways while audio is playing and after seeking/adjusting volume.
   Playback must continue from the same position with the same queue/volume.
3. Reload and check the selected skin is remembered. Test light/dark with both;
   changing a skin must not change the light/dark choice.
4. Check Home, song/playlist Browse, Library and My Music in both skins. Search,
   pagination, details, Play and Q-Music owner Edit actions must remain available.
5. In Modern, collapse the navigation, choose Classic, then return to Modern:
   the Modern icon-rail preference should be restored.
6. Recheck the RC2 Library/My Music changes; Ear-Bump originals stay read-only
   in Q-Music, and selecting a skin must not open a wallet approval.
