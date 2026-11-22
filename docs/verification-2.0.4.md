# Final verification — Q-Music 2.0.4

Date: 2026-11-22. Previous public release/base:
42a287e6eea57e521468ba43e91d8c0a05c50aae (2.0.3).
The v2.0.4 tag and release BUILD-INFO.json identify the final committed source.

## Runtime acceptance

The user accepted the mobile Home/Browse/navigation/detail refresh, consistent
Library/My Music layouts, Classic/Modern appearance (RC3), repeat/shuffle/Help
(RC4), creator collections/links (RC5), unified search (RC6), Discover Mix (RC7)
and own-node publisher-follow review/management (RC8). Final RC8 runtime was
accepted on 2026-11-22 with explicit authorization to update documentation,
commit/push main and publish the official 2.0.4 release.

Stable finalization changes version metadata, documentation and test/release
configuration only relative to the accepted RC8 application. It adds no new feature behavior requiring
another runtime cycle.

## Final checks

- Lockfile-based clean npm install, ESLint, 322 tests in 33 files and production
  TypeScript/Vite build.
- git diff --check; accepted RC8 src/tests tree compared with stable source.
- Package/lock/build version agreement, root runtime index.html, relative
  HTML/CSS/JS asset references and archive CRC.
- Exact-commit source ZIP, SHA-256 checksums and BUILD-INFO.json provenance.
- Existing Release workflow repeats npm ci, lint, tests, build and packaging on
  main before publishing a stable tag; CI independently repeats checks.

Regression tests cover original playback/publishing/Library/social/startup work
plus skin switching without audio restart, shared card pagination/detail return,
creator identity routing, bounded index scans/cancellation/deadlines, search
metadata/independent cursors, queue repeat/shuffle traversal, bounded discovery,
and native node-follow selection/read-back/permission/error management.

Tests simulate DOM, audio and native bridge/network APIs. The user supplied
physical Android/Hub runtime acceptance. Test counts do not prove availability
of every network resource, every browser codec or every node configuration.

## CI timing adjustment

The first stable CI run passed all checks, while the parallel Release run hit
Vitest's five-second whole-test deadline in two DOM interaction tests. Assertions
and application code were unchanged. The suite now allows 15 seconds per test
for lazy view imports plus complete DOM interactions on shared runners. Existing
request/deadline tests keep their explicit simulated timers and assertions.
The release workflow watches this configuration so the final release is built
from the commit containing the CI adjustment, rather than retrying old source.

## Remaining limits and implementation scope

See [release notes](release-2.0.4.md) and [native capability audit](catalog-mirror-rc8.md).
Artist identity is metadata-based; incomplete indices/searches are not a complete
discography. Discover Mix is a finite chronological sample, not uniform global
sampling. Publisher following includes all content, depends on storage policy
and is not proof of permanent per-file pinning. No Core/Hub modifications are
included. Their existing implementations remain external dependencies.

Candidate phase documents are retained as historical engineering notes and
linked from the release documentation; the stable README, user guide and this
verification file describe the current public release.
