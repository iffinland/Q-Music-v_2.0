# Q-Music 2.0.4-rc.4 — repeat, queue shuffle and Help

> Historical candidate notes. This work is included in the user-accepted 2.0.4
> release. Current scope and verification: [release notes](release-2.0.4.md)
> and [verification](verification-2.0.4.md). Candidate-state wording below
> records the phase at the time of testing.

Runtime acceptance: **PASSED** by the user on 2026-11-22. The following records
the candidate's original scope and checks; no commit/push is authorized yet.

Uncommitted runtime candidate based on public 2.0.3,
42a287e6eea57e521468ba43e91d8c0a05c50aae. Includes the accepted RC3 appearance
and earlier visual/Library work. No commit, push, release or Core/Hub changes.

## First feedback phase

The shared mini/floating player in Classic and Modern now has:

- Repeat: Off → Repeat queue → Repeat one → Off, with pressed state, tooltip and
  a distinct Repeat-one icon. Repeat one restarts at natural end; manual Next
  still advances if another entry exists. Repeat queue wraps after the last item.
- Shuffle: selects from the current in-memory queue without modifying its order
  or any published playlist. An unplayed bag avoids repeated queue occurrences
  until the remaining entries have been visited. Distinct duplicate playlist
  keys remain distinct playable occurrences.
- Previous in shuffle follows actual traversal history; Next after Previous
  walks forward through that same history before drawing a new entry. History
  is capped at the latest 200 selections. A replacement queue, external song
  selection or shuffle-mode change resets traversal around the current song.

Repeat and shuffle are session settings, initially Off; Close clears the queue
and its traversal, without persisting settings to QDN. Switching skins does not
reset the shared player or these settings. Changing a mode does not restart the
current song. A same-song repeat uses a new isolated playback attempt, retaining
the existing late-event cancellation and finite startup-recovery behavior.
Unavailable files are not retried endlessly by repeat. Controls wrap on narrow
screens rather than forcing horizontal overflow.

This is queue/playlist shuffle, not network-wide random discovery. Discover Mix,
publisher/artist archive pages, linked names, search refinement and mirroring
remain subsequent phases. No full QDN scan or mirror operation is added here.

## Help and publishing hints

Sidebar Help works in the Classic wide menu, Modern icon rail and mobile drawer.
Opening Help dismisses the drawer and displays a small accordion manual covering
listening, repeat/shuffle, searching, Library, publishing, appearance and common
audio startup problems. Content is bundled with the app and makes no native
QDN/account/content requests. Help code is lazy-loaded as a normal app asset on
first use; it does not depend on an external documentation website.

The publishing audio selector shows accepted extensions, the distinction between
accepted files and device codec support, no automatic audio conversion, and the
existing 500/2000 MiB node limits. Cover selectors show common image formats,
12 MiB/40-megapixel input limits, optional covers and square JPEG preparation.
The editing form includes the same format hints and retains the separate 64 MiB
automatic-reuse explanation. Validation and publication engine behavior are not
changed by these explanatory texts.

## Verification

ESLint, **282 tests across 28 files**, TypeScript/Vite production build and
git diff --check pass. Pure traversal tests cover linear stops/wrapping, natural
repeat-one versus manual Next, shuffle without replacement, history replay,
repeat shuffle rounds, duplicate occurrences, one-song queues and external queue
replacement. UI tests cover actual media-element restart/advancement, repeat
wrapping, shuffle history without queue mutation and no restart on shuffle
toggle. Help opening/closing is checked with zero native bridge calls.
Existing appearance, player recovery, publishing, ownership and Library tests
remain passing. DOM/native/audio behavior is simulated; physical runtime is
subsequently PASSED the user runtime test. Delivery checks build/version,
relative assets and ZIP CRC.

## Runtime checklist

1. Start a playlist. Cycle repeat through all three states. At natural end,
   Repeat one should restart the same song; manual Next should still advance.
2. With Repeat queue enabled, let the last entry finish: playback should wrap.
   With Repeat off, it should stop after the last entry.
3. Enable Shuffle: the current song must continue uninterrupted. Use Next,
   Previous, Next and confirm real history/order. Disable Shuffle and confirm the
   original queue order is intact. Test both docked and floating player layouts.
4. Change Classic/Modern while playing with repeat/shuffle active; keep position,
   volume and selected modes. Check controls fit the mobile viewport.
5. Open menu → Help, expand publishing instructions and close Help. It should not
   request wallet approval or interfere with playback.
6. Open song/album/playlist publishing and check file/cover hints are readable.
   Existing review and publish flows should behave as before.
