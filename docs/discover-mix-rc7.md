# Q-Music 2.0.4-rc.7 — Discover Mix

> Historical candidate notes. This work is included in the user-accepted 2.0.4
> release. Current scope and verification: [release notes](release-2.0.4.md)
> and [verification](verification-2.0.4.md). Candidate-state wording below
> records the phase at the time of testing.

Uncommitted test candidate on public 2.0.3 base
42a287e6eea57e521468ba43e91d8c0a05c50aae. Retains accepted RC1–RC6 changes.
RC6 unified-search Android/Hub runtime PASSED on 2026-11-22. No commit/push,
public release, QDN publication or Core/Hub modification is included here.

## User flow

Discover Mix is a lazy route at /discover, linked from Home and the sidebar in
both Classic and Modern. Opening it makes no music-index request. Find a mix
explicitly finds up to 20 songs, displayed with the shared cards, creator links
and detail dialogs. Play mix replaces the queue and starts its first song;
individual Play starts the selected song in that preview's displayed order.
Finding another mix leaves the live player and queue untouched. The previous
preview remains playable while loading or after a failure/empty new sample.
The next sample excludes the current preview's resource identities, so a small
catalogue can report no different songs instead of pretending a new selection.
This exclusion applies to the current preview only, not a lifetime listen history.

Player repeat/shuffle still apply. The mix is finite; it does not silently
refill forever or automatically skip unavailable tracks. Next remains available.
No wallet permissions, transactions, publishing or mirroring are performed.
Artwork uses the existing visibility gate. Only deliberate Play starts audio
loading. Help describes where the feature is and how it affects the queue.

## Bounded time-based sampling

To include older releases without downloading the full catalogue or requesting
unbounded total counts/offsets, the initial request probes the oldest indexed
song (one returned item, ascending) across Q-Music and Ear-Bump. That timestamp
is reused while the Discover page stays mounted. Timestamp-less legacy rows use
a conservative 2020 lower bound. A mix then reads four windows of up to ten
returned songs: one latest window, three windows before random timestamps
between that lower bound and now. It merges full resource identities, excludes
the current preview, Fisher–Yates shuffles and takes up to 20 unique songs.

This is chronological sampling, **not uniform probability over every QDN song**.
Sparse eras and dense publication periods have different probabilities. Results
are constrained to the connected node's known index and available metadata;
not every QDN resource is guaranteed indexed or reachable. The UI calls it a
small selection from music known to the node. New publications beyond the client
clock and older source rows hidden/missing in that index cannot be guaranteed.

Five combined page reads are requested on the first mix (one probe + four
windows), four on later mixes. A combined page can query both supported prefixes
and retain buffers, so these are not raw HTTP-call/row bounds. Existing prefix
filtering excludes blocked/invalid resources. There is no whole-catalog scan,
full song DOCUMENT/playlist payload read or audio download for sampling.

All sampling requests have background priority through the shared queue, with
playback capacity reserved. A 30-second consumer deadline aborts outstanding
work. Completed windows survive a later failed window or deadline as a smaller
partial mix; with no usable window, a retryable error appears. Leaving the page
aborts its consumer and late responses cannot replace a new page's state or
start playback. Underlying active Hub calls have the existing cancellation
limits and keep their queue slot until they settle.

## Shared pagination addition

MediaPageOptions now accepts reverse, defaulting to true (newest-first). The
prefix queries and merged-head comparison both honor false for the oldest probe.
Cursor instances must stay scoped to their original order/filter; discovery
uses fresh independent calls, never a Browse/Search cursor. Existing browsing,
search and creator callers retain their previous newest-first behavior.

## Verification

ESLint, 309 tests across 32 files, TypeScript/Vite production build and git diff
--check passed. Added checks cover oldest-first merging across both publication
sources, unchanged newest-first default, four-window bounds and cached range,
deduplication/exclusion/shuffle, partial and total errors, retained completed
windows on deadline, empty index, cancellation, no loading before user action,
no automatic playback, explicit Play queue replacement, and retained preview on
errors or duplicate-only samples. Existing regressions remain passing.

Tests simulate DOM/native APIs; RC7 user Android/Hub runtime **PASSED on 2026-11-22**.
Package validation checks generated version, relative assets and ZIP integrity.

## Runtime checklist

1. Open Discover Mix through Home and the menu, in either skin. Tap Find a mix,
   inspect cards, creator links and details, then Play mix.
2. While listening to another queue, find a new mix. Playback must continue
   untouched until you explicitly Play the mix or one of its songs.
3. Tap Find another mix. Check different preview tracks where the node's index
   has enough songs; a small/duplicate-only sample must keep the old preview.
4. Check Next, Previous, repeat, shuffle, seeking and volume while playing a mix.
5. On a slow/offline node, verify a useful partial mix/error and working retry.
   Navigate away while finding music; it must never start playback later.
