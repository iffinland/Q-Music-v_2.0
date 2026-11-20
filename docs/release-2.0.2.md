# Q-Music 2.0.2

Released repair series for listening, browsing, publishing, Library, social
features and startup stability. All five phases passed the user's Android/Hub
runtime rounds on 2026-11-20. The user reported significantly faster loading in
RC6. The final version retains accepted RC6 behavior and updates version metadata,
documentation and release packaging.

## Install

Download **Q-Music_2.0.2.zip** from this release. This is the deployable Q-App;
`index.html` is directly at the ZIP root. Source archives are for development.
Check **2.0.2** below the logo after loading. `SHA256SUMS.txt` covers the two ZIPs
and `BUILD-INFO.json`; the latter records the exact source commit.

## Repairs

- Catalog paging uses raw node offsets; duplicate/filtered rows do not stop it.
  Resource identity includes publisher, service and identifier. Search Play uses
  the selected displayed track. Playlist cards no longer await every payload.
- Playback has isolated attempts, cancellation and recovery for buffering,
  network/media failures and autoplay denial. Failed reads retain usable content.
- Publishing separates song, album/folder and playlist flows. Review precedes
  wallet actions. Mobile multi-file audio selection, cover decoding/size checks,
  full metadata and unreadable-playlist guards improve preparation reliability.
- Durable jobs preserve resource identities and receipts. Sent, partial, uncertain
  and verified states are distinct; resending is deliberate and may incur a fee.
- Library is scoped by wallet/name. QDN backup is explicit; favorites/listening do
  not automatically publish. Merge preserves removals and checks remote ownership.
- Likes/comments use scoped identities and targeted reads, supported QDN logical
  removals, saved pending writes, retained drafts and stale-account/page guards.
- Startup removes the monolithic SDK runtime, uses compressed full-character fonts
  and demand-loaded balances. Account retries, route boundaries, Hub-message
  checks and bounded file preparation improve recovery and memory behavior.

The measured RC6 first home/shell JS/CSS asset graph was **64.12% smaller** than
RC5 (individual gzip sums: **62.41% smaller**); four font files were **66.17%
smaller**. These are asset measurements, not device elapsed-time benchmarks.

## File limits

- Selected audio: **500 MiB on public nodes; 2000 MiB on your own node**, subject
  to actual Hub validation and browser codec support.
- Generated covers: up to 1200×1200 and **500 KiB**; original image up to 12 MiB.
- **64 MiB only limits automatic existing-audio reuse when editing.** Select the
  original local audio file to edit a larger song. This does not cap publishing,
  streaming/listening or browser/Hub download-manager downloads.

## Validation and remaining limits

Clean install, lint, **214 automated tests across 19 files**, TypeScript/Vite
build, relative asset checks and ZIP CRC checks pass. The workflow repeats checks
before publishing. Automated bridge/media/network APIs are mocked; the user
performed real Android/Hub runtime acceptance. This does not establish exhaustive
coverage of every device, codec, node or fault scenario.

Core's orphaned request-slot cleanup and HTTP Range parsing findings remain
separate upstream work. QDN data can be unavailable or slow to propagate. Logical
social removals do not erase historical QDN content, and older clients may not
interpret the updated formats. Reaction totals can remain explicitly partial.
An isolated unavailable/unsupported track report was deferred as non-blocking by
the user; this release does not claim its exact cause is proven or repaired.

See the repository's `docs/audit-resolution.md`, `docs/verification-2.0.2.md` and
historical phase reports for detailed evidence and compatibility boundaries.
