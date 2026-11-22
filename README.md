# Q-Music 2.0

Qortal music browsing, playlists and audio playback, built with React, TypeScript
and Vite.

Public release: **2.0.4**.

This release brings Classic/Modern appearance choices, consistent music cards,
creator collections, unified search, repeat/shuffle, Discover Mix, Help and
reviewed publisher-follow mirroring on your own node. The user accepted every
runtime phase, including final RC8 on 2026-11-22, and authorized this release.

See [release notes and limits](docs/release-2.0.4.md),
[verification evidence](docs/verification-2.0.4.md) and the
[user guide](docs/user-guide.md). Earlier playback, publishing, Library and
Ear-Bump compatibility improvements from 2.0.2/2.0.3 are retained.

## Downloads

- [Latest release](https://github.com/iffinland/Q-Music-v_2.0/releases/latest)
- [Q-Music 2.0.4 — deployable Q-App ZIP](https://github.com/iffinland/Q-Music-v_2.0/releases/download/v2.0.4/Q-Music_2.0.4.zip)
- [Source ZIP](https://github.com/iffinland/Q-Music-v_2.0/releases/download/v2.0.4/Q-Music_2.0.4_source.zip)
- [SHA-256 checksums](https://github.com/iffinland/Q-Music-v_2.0/releases/download/v2.0.4/SHA256SUMS.txt)

Use `Q-Music_2.0.4.zip` for Q-App publishing/loading. It contains the production
files directly at its root, with `index.html`. The source ZIP and GitHub's
automatic source archives are development sources, not deployable Q-Apps.
After loading the app, verify **v2.0.4** at the bottom of the navigation sidebar.
The version is no longer shown below the logo.

## What changed

New in 2.0.4:

- Choose Classic or Modern through **Appearance** in the sidebar; light/dark
  mode is independent. Switching keeps playback and the current queue.
- Modern Home has two simple scrollable rails of the latest 15 songs/playlists.
  Browse, Library and My Music share consistent cards and responsive pagination;
  song/playlist details open without losing the originating view.
- Artist/publisher names link to collections, including in the mini-player.
  Publisher feeds are scoped; artist lookup checks small batches of index data.
- Search from Home or **Search** in the menu, with All, Songs, Playlists, Artists
  and Publishers tabs. **Search more music** continues an incomplete search.
- Player controls add Repeat one, Repeat queue and Shuffle of the current queue,
  retaining actual shuffle history for Previous/Next.
- **Discover Mix** samples recent and older indexed music: Find a mix previews
  up to 20 songs; Play mix starts them. Finding another mix preserves playback.
- **Mirror publisher** / **Mirror artist publishers** review selected Qortal
  names before saving node follow rules. Management can remove only Q-Music's
  rules. This requires your own node and includes all publisher content, future
  publications and non-music files; node policy/capacity governs downloads.
- **Help** explains listening, discovery, Library, formats, publishing and
  mirroring. File/cover hints are shared with publishing/edit views.

Retained from 2.0.3:

- Browse and play Ear-Bump songs/playlists alongside Q-Music, with explicit
  **Published @ Ear-Bump** / **Published @ Q-Music** labels. Ear-Bump originals
  remain read-only; they can be included in new Q-Music playlists.
- Failed audio startup can wait for QDN readiness and automatically retry up to
  twice; uncertain media errors no longer assert an unsupported format.
- Seek by touch, mouse or keyboard. Open the speaker icon beside playback buttons
  for volume, the widening level graphic and Mute/Unmute.
- The sidebar shows the build version from package.json; the in-app change-log
  system and logo version are removed.

Retained from 2.0.2:

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

See [release notes and remaining limits](docs/release-2.0.4.md),
[change history](CHANGELOG.md), [audit resolution](docs/audit-resolution.md), and
[verification evidence](docs/verification-2.0.4.md).

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
bridge types. The unused in-app change-log HTML renderer and DOMPurify runtime
dependency were removed.

## Release workflow

A stable version update on `main` triggers [Release](.github/workflows/release.yml).
It performs a clean install, lint, all regression tests and build before packaging
runtime/source ZIPs, recording the commit and checksums, and publishing a GitHub
Release tagged to that exact commit. Existing public releases are not overwritten.
RC versions are skipped. The build reads the release version from `package.json`;
update it and the lockfile together with `npm version X.Y.Z --no-git-tag-version`. The workflow can also be run manually from `main`.

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
