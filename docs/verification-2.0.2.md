# Final verification — Q-Music 2.0.2

Date: 2026-11-20. Original source baseline: `681a4da63eb3e181237ada819b3156d0ffbc9664`.
The release tag and `BUILD-INFO.json` identify the final committed source.

## Runtime acceptance

| Phase | User result |
| --- | --- |
| Listening and browsing | PASSED; isolated unavailable/unsupported track explicitly deferred as non-blocking. |
| Publishing RC2 | FAILED; superseded by redesigned RC3. |
| Simplified publishing RC3 | PASSED. |
| Library and account isolation RC4 | PASSED. |
| Likes and comments RC5 | PASSED. |
| Startup speed and general stability RC6 | PASSED; significantly improved loading reported. |

The user then authorized final checks, stable release, commit/push and GitHub
documentation updates. Finalization changes version metadata, documentation and
release automation; accepted feature behavior is retained. There is no additional
claim of a fresh stable-version mobile runtime beyond the accepted RC6 behavior.

## Automated checks

The final `src/` files were byte-compared with the accepted RC6 source archive;
there were no differences after normalizing the app version string.

- Clean `npm ci --ignore-scripts`, ESLint, 214 tests across 19 files,
  TypeScript/Vite production build and `git diff --check` pass locally.
- The release workflow repeats clean installation, lint, tests and build before
  packaging/publishing. A failed check prevents release publication.
- Packaging requires a clean committed tree, matching package/app/build version,
  relative HTML/JS/CSS assets, font attribution, absence of obsolete runtime SDK
  chunks/video script, and valid ZIP CRCs. Runtime ZIP has `index.html` at root.
- Runtime/source ZIPs and build provenance receive SHA-256 checksums. GitHub's
  automatic source archives are not substitutes for the deployable Q-App.
- Startup asset comparison is retained in `startup-metrics.json`: RC5 to RC6 first
  home/shell JS/CSS graph 2,071,368 -> 743,266 bytes; individual gzip sums and font
  sizes are recorded there. It measures file sizes, not elapsed device/network time.

Tests use mocked bridge/network/media, image/canvas, storage and timers as needed.
They cover pagination, exact identity, partial results, stale-session cancellation,
player recovery, publication preparation/receipts/continuation, wallet guards,
Library migration/removals, scoped social activity, route recovery, denied storage,
Hub message validation and bounded audio reads/download handoff. The assistant
performed no actual QDN publication or financial transaction. Core/Hub full test
suites and an exhaustive browser/codec/network matrix were not run.

## Remaining boundaries

- Core orphaned request slots and HTTP Range parsing remain separate upstream work.
- Unavailable content, propagation delays and unsupported browser codecs remain
  possible; errors must stay explicit and recoverable where the platform permits.
- Native requests/approved transactions cannot always be cancelled by an app's
  consumer abort. No automatic resend is inferred from a timeout or missing data.
- 64 MiB limits automatic edit reuse only. Normal publishing/listening/downloads
  are not capped at that size; large edits can select the original local file.
- QDN Library merge is eventually consistent, without atomic compare-and-swap.
  Logical social removals retain historical QDN versions. Counts can be partial.
