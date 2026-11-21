# Q-Music 2.0.3

Released 2026-11-21. The final RC4 passed the user's Android/Hub runtime test.

## Music from both apps

Browse and listen to Ear-Bump songs and playlists alongside Q-Music publications.
Recognized cards and detail views clearly show **Published @ Ear-Bump** or
**Published @ Q-Music**. Catalog pagination preserves each namespace's position.
Supported embedded Ear-Bump playlist artwork is displayed without blocking list
cards on full playlist reads. Ear-Bump originals remain read-only; their songs
can be included in new Q-Music playlists.

## Playback

An initial media load failure no longer immediately blames the audio format.
The player can check the selected resource's QDN readiness and retry up to twice
with a fresh URL and isolated audio element. Pause, another song and Close cancel
recovery; a late response cannot start old audio. Browser autoplay denial retains
the direct Play action. Already-playing songs are not restarted from zero after
a later error.

Seek forward or backward using touch, mouse or keyboard. A paused song stays
paused. The speaker icon beside the playback buttons opens a compact volume
panel with a widening level graphic, percentage and Mute/Unmute. Volume carries
over between tracks and recovery attempts. Both docked and floating layouts
include these controls.

## Version and navigation

The version appears only at the bottom of the navigation sidebar, as **v2.0.3**.
The logo version and the entire in-app change-log system were removed. The build
reads package.json for both the sidebar version and document title; no runtime
version request or extra administration system is required. Repository release
notes and CHANGELOG.md remain available.

## Validation and limits

All **250 regression tests**, ESLint and the TypeScript/Vite production build
pass. Source/runtime packaging validates relative asset references and ZIP CRC;
checksums and BUILD-INFO.json identify the exact release commit. The release
workflow repeats clean-install checks before publishing assets.

This is a dApp release: no Core/Hub changes are required or included. QDN resource
availability, network conditions, browser codecs and node stream/range support
still affect playback and seeking. A screenshot cannot establish the original
intermittent failure's precise server-side cause. Recovery readiness preparation
has a shared 60-second budget, with existing per-media buffering deadlines; it
does not guarantee playback within 60 seconds.

The 64 MiB limit applies only to automatic audio reuse when editing an existing
song, not listening or publishing. No full audio blob is fetched for seeking.
All previously accepted 2.0.2 publishing, Library, social and startup repairs are
retained. See [verification](verification-2.0.3.md).

## Downloads

- [Deployable Q-App ZIP](https://github.com/iffinland/Q-Music-v_2.0/releases/download/v2.0.3/Q-Music_2.0.3.zip)
- [Source ZIP](https://github.com/iffinland/Q-Music-v_2.0/releases/download/v2.0.3/Q-Music_2.0.3_source.zip)
- [Checksums](https://github.com/iffinland/Q-Music-v_2.0/releases/download/v2.0.3/SHA256SUMS.txt)

Publish the deployable ZIP, whose root contains index.html. The source ZIP is for
development. Verify v2.0.3 at the sidebar bottom after loading the new app.
