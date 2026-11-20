# Changelog

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
