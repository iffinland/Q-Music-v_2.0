# Changelog

## 2.0.4 — 2026-11-22

- Add remembered Classic/Modern skins via Appearance, independently of light/dark
  mode, sharing the same player, Library and publishing logic.
- Refresh Home/Browse layouts, responsive shared cards, square artwork, themed
  horizontal rails, Modern icon-only collapsed navigation, numeric pagination,
  and detail dialogs preserving their originating collection.
- Bring Library/My Music into the shared visual system with independent sections.
- Add repeat-one/repeat-queue and current-queue shuffle with traversal history.
- Link artist/publisher names from cards, details, playlist tracks and the player
  to scoped publisher and incrementally searched artist collections.
- Add unified search with result categories, available indexed metadata/tags,
  partial-result labels, manual continuation and retained independent cursors.
- Add Discover Mix with bounded recent/older chronological sampling, preview and
  explicit playback, without a full-catalog scan or interrupting existing audio.
- Add explicit own-node publisher-follow mirroring and management of Q-Music's
  follow rules. Scope includes all publisher content; retention/downloads depend
  on native node policy/capacity, not a dApp permanent-pin guarantee.
- Add in-app Help and shared publishing format hints.
- All runtime phases PASSED through RC8; 322 automated tests across 33 files.
- Retain 2.0.3 listening/recovery/Ear-Bump work. No Core/Hub changes included.

## 2.0.3 — 2026-11-21

- Restore Ear-Bump song/playlist discovery and playback with independent catalog
  pagination, embedded playlist art support and read-only original publications.
- Label recognized publications Published @ Ear-Bump or Published @ Q-Music.
- Recover initial media errors with fresh isolated audio attempts, QDN readiness
  checks and up to two automatic retries; use neutral load-error messages.
- Add accessible song seeking and a compact speaker volume popup with a widening
  level graphic, percentage, mute and restore.
- Remove the in-app change-log system and logo version. The sidebar version and
  document title are generated from package.json at build time.
- Retain all accepted 2.0.2 repairs. Final RC4 runtime PASSED; 250 automated tests.
- No Core/Hub changes. QDN availability, codecs and stream/range support remain
  platform constraints; seeking does not fetch a complete audio blob.

## 2.0.2 — 2026-11-20

Consolidates the user-accepted listening/browsing, publishing (RC3),
Library/accounts (RC4), likes/comments (RC5) and startup/stability (RC6) phases.

- Correct raw catalog pagination, publisher/service/identifier isolation, partial
  results, search selection and playlist load failures.
- Playback session cancellation, media-event state, bounded retry and recovery.
- Simplified song/album/playlist publishing, mobile MP3 selection, bounded covers,
  full DOCUMENT metadata, preserved IDs and durable partial/uncertain jobs.
- Wallet/name-isolated Library, explicit sync and tombstones/removal-aware merge.
- Scoped likes/comments, targeted paging, supported logical removals, persisted
  pending writes, account/page guards and explicit uncertain-send retries.
- Smaller startup assets, on-demand balance reads, account deadlines, stable
  router/page boundaries, trusted Hub messages and blocked-storage recovery.
- Browser/Hub download handoff and bounded/cancellable automatic audio reuse.
- 214 regression tests, lint/build CI, release packaging and checksum automation.

RC2 publishing failed runtime testing and was superseded by accepted RC3. RC6
passed runtime testing, with the user reporting materially improved load speed.
The stable version changes release metadata/docs/packaging after accepted RC6;
no additional feature redesign was introduced during finalization.

Known remaining limits: separate Core request-slot/HTTP Range defects; unavailable
QDN resources; platform codec support; eventual indexing/availability; bounded
counts; logical rather than historical deletion. Automatic existing-audio reuse
while editing is limited to 64 MiB; selected-file publishing and listening are not.
