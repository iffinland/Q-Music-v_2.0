# Q-Music 2.0.3-rc.3 — build version and publication labels

> Historical candidate notes. Superseded by [2.0.3](release-2.0.3.md).
> Final RC4 runtime PASSED on 2026-11-21; the user authorized main commit/push
> and the official release. Earlier pending/authorization notes below describe
> the candidate's original delivery, not the current release status.


Uncommitted test candidate, retaining accepted Ear-Bump compatibility and RC2's
in-app change-log removal. No Core/Hub changes, Git push or public release.

## Version source

`package.json` -> `version` is the single manually assigned release number. Vite
imports that JSON at build/config load, injects `VITE_APP_VERSION` as a compiled
constant, and fills the index.html title placeholder with the same value.
`src/qapp-config.ts` no longer contains a hard-coded version. No runtime JSON
fetch, extra dependency, admin UI or editable QDN document is involved.

The visible version appears only at the bottom of the navigation sidebar, as
plain text. It was removed from below the logo. The document title still carries
the version for identifying tabs. Updating the release number and rebuilding
updates both automatically; this is not automatic semantic-version incrementing.
The resulting files still need publication to change the actual deployed app.

For maintainers, update package/lock metadata together without creating a commit:

```bash
npm version 2.0.3 --no-git-tag-version
npm run build
```

Vitest inherits the same Vite configuration. Release packaging validates the
built title and package/lock version instead of requiring a literal version in
qapp-config.ts. Existing published QDN documents are not changed.

## Publication source labels

The former EarBumpBadge is replaced with a shared PublicationBadge. Recognized
song/playlist namespaces show exactly:

- `earbump_song_...` / `earbump_playlist_...`: **Published @ Ear-Bump**
- `enjoymusic_song_...` / `enjoymusic_playlist_...`: **Published @ Q-Music**

Unknown/missing/bare prefixes do not get an invented source label. This describes
the identifier namespace, not publisher identity verification. The shared badge
covers existing card, detail, Library, Home, My Music, playlist-track, selection
and mini-player uses. Longer labels may wrap on narrow screens.

## Verification

ESLint, all **232 tests across 20 files**, TypeScript/Vite production build and
git diff --check pass. Existing source-label DOM coverage now checks both song
and playlist prefixes for each app and no label for an unknown source. Build
checks confirm the package version in generated HTML/JS, no unreplaced placeholder
and only one sidebar version location in the shell source. Relative asset and
ZIP CRC checks run on delivery. No real Hub transaction is performed. Android
layout/runtime acceptance for this candidate **passed** the user's test on 2026-11-21.

## Runtime checklist

1. Open the sidebar: only `v2.0.3-rc.3` at its bottom; no change-log action.
2. Below the logo there is no version number (including on mobile).
3. Browse both apps' songs and playlists and check the exact publication labels.
4. Check detail views, Library and playback retain accepted Ear-Bump behavior.
