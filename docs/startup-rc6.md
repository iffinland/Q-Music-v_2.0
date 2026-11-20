> Historical phase report. All accepted phases are included in [2.0.2](release-2.0.2.md).
> Any no-commit/no-release statement below records the status at that phase, before final release authorization.

# Q-Music 2.0.2-rc.6 — startup and general stability

Runtime PASSED by the user on 2026-11-20; startup/stability phase locked. The user reported substantially improved loading speed. Listening/browsing, simplified publishing (RC3),
Library/account isolation (RC4) and likes/comments (RC5) passed the user's runtime
rounds. This candidate preserves those changes. No commit, push, public release,
real QDN publication or money transfer has been performed by the assistant.

## Startup cost

The app now calls the native Hub account/balance bridge through a small local
adapter instead of loading qapp-core's entire runtime provider, unused video,
encryption and publishing UI. qapp-core remains a development-only dependency for
its native bridge TypeScript declarations. DOMPurify is an explicit dependency;
change-log sanitization and Unicode JSON encoding remain covered by tests.

Account discovery is single-flight, including React StrictMode. Browsing renders
while account discovery runs. Failed/declined discovery settles with a visible
account refresh control. A newly detected wallet clears the preceding wallet's
name before its primary-name lookup. A wallet without a registered name remains
unnamed. Auth reads have a 20-second consumer deadline; name lookup is separate.
These deadlines stop this app waiting, but cannot cancel all native requests.

Balances are fetched when Support/Tip opens, not on mounting each consumer or by
an interval. Concurrent balance reads share one request per wallet. Unknown
balance displays a dash, never a fabricated zero. Results and loading state are
scoped by wallet; a late old-wallet read cannot populate the current wallet.
Already authenticated accounts are rechecked on return after at least 60 seconds,
with no interval or repeated guest consent. The account chip also refreshes it.

The four used Inter weights are served as WOFF2 with all original characters and
horizontal metrics preserved. The original TTF sources and regeneration script
remain available. `public/fonts-OFL.txt` carries the font copyright/license.
Regeneration requires Python fontTools and Brotli, not a normal npm build.

See [asset measurements](startup-metrics.json). The comparison measures the static
JS/CSS import closure of the entry, shell and first home route, and referenced
font asset bytes. Gzip sums compress files individually at level 9; they do not
prove Hub serves compression. This is not a device or network timing benchmark:
Core latency, cache state, bandwidth and actual font demand still affect startup.

## Recovery and message handling

- The browser router is created once. Child routes have error boundaries so a
  failed page can recover without destroying the surrounding shell/player.
  Back to music navigates internally; Reload app is deliberate. Offline, page
  chunk-load and ordinary runtime failures have distinct explanations. A network
  failure does not claim that an update exists. There is no reload loop.
- A small HTML loading message survives a failed initial JavaScript load. After
  15 seconds it offers connection/node guidance and an explicit reload button.
- Blocked theme localStorage no longer prevents in-memory theme changes/startup.
- Hub messages require the actual iframe parent (and referrer origin when known),
  or native Hub's self-window, own-origin, `requestedHandler: UI` contract.
  Themes/languages are validated. Navigation only accepts internal string paths;
  external, malformed and traversal paths are rejected. Publication status
  notifications use the same sender checks; they are not transaction receipts.
- The unused video-decryption script is removed. It was loaded as a page script
  despite implementing worker behavior; Q-Music has no feature requiring it.

## File memory and stale work

Downloads now hand Core's attachment URL to the browser/Hub download manager.
Q-Music does not first fetch the complete audio into a JavaScript Blob. Optional
filename discovery has an eight-second consumer budget; leaving the page cancels
preparation. The UI says "Download requested", because actual saving belongs to
Hub/browser. Verify the resulting file and name on the target device.

Editing without selecting replacement audio still supports automatic reuse, but
network downloads are bounded to **64 MiB**. Declared and streamed byte counts
are checked; partial, empty, truncated and oversized responses fail before
publication. For a larger song, select its original file from the device. This
budget applies to automatic network reuse only; normal selected-file publishing
limits remain unchanged. Memory is bounded, not eliminated: native publishing
still needs a File and can encode it internally.

Song edit preparation is cancelled on leaving, changing wallet/target, or pressing
Cancel audio preparation. Selected-file hashing and preparation check cancellation
before a wallet request. Late results cannot overwrite another editor/page.
Once native publishing has started, leaving the page does not undo an approved
transaction; the existing durable publishing activity remains authoritative.

Tip dialogs clear prior recipients on account/page changes, ignore late old-page
lookups, resolve the current name again before sending, and guard double submits.
Native error objects cannot be reported as successful tips. Tests mock all money
operations; no payment is needed for the runtime checklist below.

## Verification

Clean `npm ci --ignore-scripts`, ESLint, **214 tests across 19 files**,
TypeScript/Vite production build, `git diff --check`, relative asset validation and
ZIP CRC are checked for delivery. The earlier 170 regression tests remain in the
suite; additional tests cover account deadlines/single-flight/isolation, unknown
balances, trusted messages, route recovery, denied theme storage, sanitization,
bounded file streams, download handoff and stale/double tip submissions.

Bridge/media/network APIs are mocked. Android/Hub behavior and cold-start elapsed
time have not been verified here. The earlier environment browser connection
limitation remains. Core's orphaned request slots and HTTP Range handling require
separate Core work; this app release does not repair them or make unavailable QDN
resources available. No Core/Hub repository source was changed.

## Runtime checklist

Verify **2.0.2-rc.6** under the logo using the runtime ZIP.

1. Open from a cold start and reload. Confirm the home view, account name and music
   lists settle. If account discovery fails, use the account chip/Refresh account.
   Guest browsing must work; switch wallets and check Library separation.
2. Play a song and quickly visit songs, playlists, details, Library and comments.
   Playback should continue through ordinary navigation. Briefly check publishing
   and likes/comments from the previously accepted rounds.
3. Download a small MP3. Check Hub/browser's download manager, actual filename and
   saved playable file. "Requested" alone is not proof the platform saved it.
4. In an owned song editor, try reusing a small existing audio file; cancel its
   preparation or leave the page. For audio above 64 MiB, choose the original file.
   Do not intentionally submit a duplicate publication just to test cancellation.
5. Open Support/Tip and verify the balance loads on demand. On another publisher's
   page the Tip recipient must change. No real payment is required.

Runtime accepted. The user authorized final checks, documentation, commit/push and final release on 2026-11-20.
