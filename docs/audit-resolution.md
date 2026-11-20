# Audit resolution — 2.0.2

The original 2026-11-20 audit examined baseline `681a4da` and recorded 39 findings.
This table maps each to accepted app changes or a remaining upstream boundary;
"addressed" means the app implementation/regression coverage and user-accepted
phase, not proof that every possible real-world occurrence has disappeared.
No Core or Hub source was changed in this release.

| Finding | Disposition in 2.0.2 | Evidence / remaining boundary |
| --- | --- | --- |
| A01 Core request-slot leak | Separate Core work; app mitigation | Bounded reads/reserved playback capacity; the app cannot release Core's orphaned slots. |
| A02 Unsettled publish modal errors | Addressed | App-owned publication engine, settled outcomes and durable jobs; RC3. |
| A03 Stale verification cache | Addressed | Fresh exact-resource availability checks; RC2 engine retained in RC3. |
| A04 One resource reported as whole-batch success | Addressed | Per-resource receipts/verification and partial/sent states; RC3. |
| A05 Library overwrites publish modal state | Addressed | Shared write serialization, explicit Library backup and own jobs; RC3/RC4. |
| A06 New IDs after partial album retry | Addressed | Persisted prepared IDs and explicit continuation/retry; RC3. |
| A07 Audio size disagrees with Hub | Addressed | 500/2000 MiB limits with early checks; RC3. |
| A08 Oversized generated thumbnail | Addressed | Encoded thumbnail bytes checked/bounded; RC3. |
| A09 Truncated structured song metadata | Addressed | Complete DOCUMENT metadata plus bounded index description; RC3. |
| A10 MIME filtering / codec assumptions | Addressed with platform limit | Extension/mobile MIME fallbacks; codec support still depends on browser; RC3. |
| A11 Unbounded folder cover preparation | Addressed | Bounded preparation and review before send; RC3. |
| A12 Missing playlist choices / ordering | Addressed | Demand-loaded selection pages and explicit preserved ordering; RC3. |
| A13 Premature catalog termination | Addressed | Raw pagination state and partial results; listening/browsing. |
| A14 Displayed-row offset | Addressed | Raw server offsets; listening/browsing. |
| A15 Identifier-only collisions | Addressed | Full media identity in data/player/Library/social; all relevant phases. |
| A16 Broad search / inexact detail | Addressed | Prefix-scoped search and exact resource checks; listening/browsing. |
| A17 Playlist cards blocked by payload reads | Addressed | Cards before payload/count reads; listening/browsing. |
| A18 Unreadable playlist becomes empty / overwrite risk | Addressed | Read failure remains an error and blocks overwrite; listening/RC3. |
| A19 Search plays wrong track | Addressed | Displayed-result queue and exact selection; listening/browsing. |
| A20 Automatic full catalog scan | Addressed | Scan only for requested search/filter/sort; listening/browsing. |
| A21 Old audio during track changes | Addressed | Per-attempt audio session, immediate old-element release; listening. |
| A22 No playback error recovery | Addressed with availability limit | Media-event handling and Retry; missing resources/codecs are not repaired. |
| A23 Serial work before playback | Addressed | Direct AUDIO URL; playback read priority; listening. |
| A24 Inconsistent ready/retry handling | Addressed with Core limit | Bounded retries/deadlines and explicit statuses; native/Core work may outlive consumers. |
| A25 Cache hides updates/errors | Addressed | Validated bounded caches, invalidation and fresh verification reads. |
| A26 Cross-account Library | Addressed | Wallet/name scope, guest separation and explicit legacy import; RC4. |
| A27 Merge resurrects removals / failed hydration | Addressed with QDN limit | Tombstones, ownership/read guards, explicit sync; no atomic multi-device CAS; RC4. |
| A28 Global comment scan | Addressed | Targeted scoped paging, bounded reads and demand-open comments; RC5. |
| A29 Unsupported reaction/comment delete action | Addressed | Supported DOCUMENT inactive/tombstone writes; historical versions remain; RC5. |
| A30 Stale state after social write | Addressed | Persistent pending overlays and revision-aware refresh; eventual propagation remains; RC5. |
| A31 Publication date lost | Addressed | Parser/import normalization and complete metadata; listening/RC3. |
| A32 Whole audio in memory for edit/download | Addressed with explicit budget | Download-manager handoff; automatic edit reuse capped at 64 MiB; native publish still needs File; RC6. |
| A33 Startup cost / auth side work | Addressed with measurement limits | Runtime SDK removed, WOFF2, single-flight auth and on-demand balance; asset graph measured, user observed improvement; RC6. |
| A34 Work survives navigation | Addressed with bridge limit | Consumer cancellation, stale-context guards, bounded queues and edit preparation abort; approved/native transactions are not undone. |
| A35 Untrusted message senders | Addressed | Parent/native source/origin contract and payload/path checks; RC6. |
| A36 Misleading route-update errors | Addressed | Error classification, child boundaries and one router instance; RC6. |
| A37 Lint / missing regression coverage | Addressed | Lint, 214 tests, production build and CI. |
| A38 Progress is not verified success | Addressed | Receipt/sent/partial/uncertain/availability distinctions; progress is display-only. |
| A39 Core HTTP Range parser | Separate Core work | No Core patch; browser/codec/seek-dependent behavior remains. |

D01 (incomplete Core deduplication key) was a dormant risk with the audited feature
flag disabled, not an active app defect. No such Core flag was enabled here.

Historical reports retain their original test counts and then-current limits.
[Release notes](release-2.0.2.md) and [final verification](verification-2.0.2.md)
describe the consolidated release. Runtime acceptance is user-reported per phase;
it is not an exhaustive device/version/codec matrix.
