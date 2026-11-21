# Final verification — Q-Music 2.0.3

Date: 2026-11-21. Previous public release/base commit:
17712260f6692978fd170f3dd35a41a73d2c2f66 (2.0.2).
The release tag and BUILD-INFO.json identify the final source commit.

## Acceptance

The user accepted Ear-Bump compatibility in RC1, version/publication labels in
RC3 and the final RC4 containing playback recovery, seeking and the speaker
volume popup. The user then explicitly authorized documentation updates,
commit/push to main and an official release. Stable finalization changes only
version metadata and documentation relative to the accepted RC4 source.

## Checks

- Clean npm install using the lockfile.
- ESLint, 250 tests across 21 files, TypeScript/Vite build and git diff --check.
- Accepted RC4 application source compared with the final source: no feature
  changes. The build-supplied version becomes 2.0.3 through package metadata.
- Runtime ZIP root index.html, matching package/lock/build version, relative
  HTML/CSS/JS assets, ZIP CRC, SHA-256 checksums and exact-commit source archive.
- The main release workflow repeats install/lint/tests/build/packaging before
  publishing the exact commit under v2.0.3.

Automated tests simulate audio elements and native bridge calls; they do not
claim a live network or codec test. The user supplied Android/Hub runtime
acceptance. Stable metadata finalization does not add a separate mobile test.
Resource availability and node Range behavior remain external constraints.

## Prior audit

[The original audit resolution](audit-resolution.md) describes the retained
2.0.2 fixes. This release additionally addresses interoperability, misleading
media errors, startup retry behavior and missing seek/volume controls. No Core
or Hub implementation is included in the application release.
