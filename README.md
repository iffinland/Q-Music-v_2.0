# Q-Music 2.0

Qortal music browsing, playlists and audio playback, built with React, TypeScript
and Vite.

Current version: **2.0.2**. All five repair phases passed the user's Android/Hub
runtime tests on 2026-11-20, including substantially improved loading speed.

## Downloads

- [Latest release](https://github.com/iffinland/Q-Music-v_2.0/releases/latest)
- [Q-Music 2.0.2 — deployable Q-App ZIP](https://github.com/iffinland/Q-Music-v_2.0/releases/download/v2.0.2/Q-Music_2.0.2.zip)
- [Source ZIP](https://github.com/iffinland/Q-Music-v_2.0/releases/download/v2.0.2/Q-Music_2.0.2_source.zip)
- [SHA-256 checksums](https://github.com/iffinland/Q-Music-v_2.0/releases/download/v2.0.2/SHA256SUMS.txt)

Use `Q-Music_2.0.2.zip` for Q-App publishing/loading. It contains the production
files directly at its root, with `index.html`. The source ZIP and GitHub's
automatic source archives are development sources, not deployable Q-Apps.
After loading the app, verify **2.0.2** under the logo.

## What changed

- Songs/playlists use raw pagination and full resource identity; an unavailable
  playlist does not turn into an empty playlist or block the whole catalog.
- Playback follows the selected song, cancels stale loading and offers recovery.
- Publishing has separate song, album/folder and playlist flows, early file/cover
  checks, complete metadata, durable job identities and honest partial/sent states.
- Library data is isolated by wallet/name, with explicit QDN sync and removal state.
- Likes/comments load targeted data, preserve pending writes and support logical
  removal through supported QDN publications.
- Startup no longer loads the monolithic SDK runtime. RC6's first home/shell
  JS/CSS asset graph was 64% smaller than RC5; fonts were 66% smaller. These are
  file-size measurements, not a guaranteed elapsed-time improvement on every node.
- Account/balance requests, page recovery, Hub messages, download memory and stale
  async work have additional guards.

See [release notes and remaining limits](docs/release-2.0.2.md),
[change history](CHANGELOG.md), [audit resolution](docs/audit-resolution.md), and
[verification evidence](docs/verification-2.0.2.md).

## File sizes and compatibility

Publishing allows up to **500 MiB on public nodes** and **2000 MiB on your own
node**, subject to Hub's actual limits. Browser/codec support still determines
whether a particular audio format plays.

**64 MiB applies only to automatic audio reuse while editing an existing song.**
For a larger song, select its original audio file from the device. It does not cap
normal publishing, listening or download-manager downloads: a 150 MB song is not
excluded by that reuse limit.

QDN availability/indexing is eventual. A sent transaction does not prove that
another node can already download the file. Logical comment/like removals do not
erase historical QDN versions. Older clients may not understand the updated
metadata/social formats. The separate Core request-slot and HTTP Range findings
remain outside this app release.

## Development

Node.js 22 or newer, npm, and Python 3 (release packaging only) are required.

```bash
npm ci
npm run dev
```

QDN/account operations require Qortal Hub's request bridge. An ordinary browser
can show the UI but does not acquire a Qortal account automatically.

```bash
npm run lint
npm test
npm run build
npm run preview
```

`dist/` contains the deployable app. Runtime font assets are checked in; normal
builds do not need font conversion. qapp-core is development-only for native
bridge types; DOMPurify remains active for sanitizing HTML.

## Release workflow

A stable version update on `main` triggers [Release](.github/workflows/release.yml).
It performs a clean install, lint, all regression tests and build before packaging
runtime/source ZIPs, recording the commit and checksums, and publishing a GitHub
Release tagged to that exact commit. Existing public releases are not overwritten.
RC versions are skipped. The workflow can also be run manually from `main`.

For local packaging from a clean committed checkout:

```bash
npm ci
npm run lint
npm test
npm run build
npm run release:package
```

Packages are written to `release-assets/`. [CI](.github/workflows/ci.yml) also runs
lint, tests and the production build on pushes and pull requests. Automated tests
mock bridge/media/network APIs; the user supplied real Android/Hub runtime checks.

## Backup and restore

See [workspace backup/restore instructions](scripts/README.md).

```bash
npm run backup-qmusic
npm run restore-qmusic
```

The existing scripts keep the latest three backups in
`~/REACT-PROJECTS/_workspace_backups/Q-Music/Q-Music-2.0`.
