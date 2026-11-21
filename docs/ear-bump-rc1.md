# Q-Music 2.0.3-rc.1 — Ear-Bump compatibility test

> Historical candidate notes. Superseded by [2.0.3](release-2.0.3.md).
> Final RC4 runtime PASSED on 2026-11-21; the user authorized main commit/push
> and the official release. Earlier pending/authorization notes below describe
> the candidate's original delivery, not the current release status.


Based on released Q-Music 2.0.2, commit
`17712260f6692978fd170f3dd35a41a73d2c2f66`. Uncommitted test candidate only;
no push, public GitHub release, Core/Hub change or real QDN/wallet action.

## Source contract

Inspected [Qortal/ear-bump](https://github.com/Qortal/ear-bump) at
`b13edd5976cb79fc3c706238fde555cc938f8811`:

- `src/components/UploadModal.tsx`: `earbump_song_<title>_<id>` AUDIO, description
  `title=...;author=...`, and THUMBNAIL at the same name/identifier.
- `src/components/UploadPlaylistModal.tsx`: `earbump_playlist_<title>_<id>` PLAYLIST
  with JSON `title`, `description`, `songs` and embedded `image` data URL. Separate
  playlist THUMBNAIL publication is commented out.
- `src/state/features/globalSlice.ts` and `src/components/AddToPlayistButton.tsx`:
  song references retain name, service, identifier, title and artist/author.

## Behavior

Songs and playlists now combine exact prefix-scoped Q-Music and Ear-Bump index
queries. Each source keeps its raw offset, exhaustion state and a bounded buffer
of unconsumed rows. Heads are merged by creation time before returning a page;
Load more does not apply one aggregate offset to two independent indexes.
Publisher/snapshot filters apply to both. Hidden/invalid rows advance the source
cursor; an empty source does not end the other. Failed/aborted work does not
mutate the caller's saved cursor. Refresh/account changes reset it.

No full catalog scan or playlist payload download is introduced on startup/list
cards. The first catalog page needs one bounded index request per source; active
playback retains its shared-queue priority. Search still expands on demand.

Ear-Bump audio plays the original AUDIO/name/identifier through the existing
player, without copying, converting or republishing the file. Its song artwork
uses the original matching THUMBNAIL. Mixed playlists can reference both sources;
non-AUDIO references are ignored rather than passed to the audio player.

A small **Ear-Bump** chip is shown on song/playlist cards and detail views,
Library/My Music/Home entries, playlist tracks, the mini player and song selection.
It is derived from the identifier namespace, not an author verification badge.
Q-Music publications retain their existing identifiers and have no Ear-Bump mark.

Ear-Bump playlist detail reads its embedded raster image after the normal playlist
payload loads. Only bounded PNG/JPEG/WebP/GIF base64 image URLs are accepted (up to
2 MiB encoded text); SVG, remote image URLs and other protocols are rejected.
List cards use a title placeholder instead of downloading entire playlists for
embedded covers or requesting a nonexistent thumbnail. Missing/unsupported covers
do not stop listening.

Library favorites and Q-Music playlists can retain Ear-Bump track references.
This is read/play compatibility, not migration of Ear-Bump favorites, social data
or publishing. Existing Ear-Bump songs/playlists are not rewritten in Q-Music's
metadata format: owner edit/reorder controls are disabled for those resources,
existing-playlist publishing selection excludes them, and builders reject such
updates before native approval. Edit originals through Ear-Bump. Creating a new
Q-Music playlist with Ear-Bump songs remains supported.

## Verification

Clean dependency install, lint, **232 tests across 20 files**, TypeScript/Vite production
build, relative asset checks and ZIP CRC are run for this delivery. Tests use
mock bridge/media/image APIs. Actual Ear-Bump QDN availability and playback on
Android/Hub remain for user runtime verification; no real publication was sent.
Previously accepted Q-Music behavior remains in the regression suite.

## Runtime checklist (separate test APP account)

1. Verify **2.0.3-rc.1** below the logo. Browse Songs and Playlists: both Q-Music
   and Ear-Bump entries should appear, with the small mark only on Ear-Bump items.
2. Search for a known Ear-Bump song/publisher. Play it, pause, switch tracks and
   use the mini player; the selected original song must play. Check song artwork.
3. Open an Ear-Bump playlist, verify its tracks/order and embedded cover when
   supported, and play all/individual songs. A missing cover must not block audio.
4. Use Load more and publisher filters, then browse a Q-Music playlist/song again.
   No skipped or cross-publisher entries should appear during navigation.
5. Save an Ear-Bump song/playlist in Library, reload and reopen/play it. Optionally
   include an Ear-Bump song in a NEW Q-Music playlist on the test account.
6. Ear-Bump originals should not offer Q-Music editing/reordering. A new test APP
   deployment still uses the same global QDN music catalog; it does not copy it.

Do not replace the public Q-Music deployment for this test. Runtime PASSED by the user on 2026-11-21; commit/push still require separate explicit authorization.
