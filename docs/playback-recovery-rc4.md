# Q-Music 2.0.3-rc.4 — audio start recovery

> Historical candidate notes. Superseded by [2.0.3](release-2.0.3.md).
> Final RC4 runtime PASSED on 2026-11-21; the user authorized main commit/push
> and the official release. Earlier pending/authorization notes below describe
> the candidate's original delivery, not the current release status.


Uncommitted test candidate. RC3 passed the user's Android runtime test on
2026-11-21. This candidate changes only the dApp; Core and Hub are not modified.
No commit, push or public release is authorized in this test round.

## Observed problem and limits of diagnosis

Users reported a song failing at first and playing after several manual retries.
The old browser-media error mapping immediately stopped playback and suggested
an unsupported format. Browser media error code 4 does not establish that the
underlying file has an unsupported format: a failed/non-audio source response
can also leave the browser without a usable audio source.

A cold QDN download/build or transient resource response is a plausible cause,
not a confirmed diagnosis of the reported song. The screenshot does not include
HTTP responses or node logs. A genuine codec problem is still possible for other
files, but the dApp must not present that conclusion without evidence.

## Behavior

- Normal playback retains its direct stream-URL path. Catalog cards do not poll
  audio status or fetch audio bytes.
- Before audio has actually started playing, browser media failures 2/3/4 and
  play() NotSupportedError can trigger up to two automatic recovery attempts.
- Recovery waits 1.5 seconds on the first attempt and 3 seconds on the second,
  polls the selected AUDIO resource status every 2 seconds, and uses the existing
  QDN build mechanism when appropriate. It waits for READY before requesting a
  fresh stream URL and creating a fresh isolated audio element.
- A retry URL preserves existing parameters and adds a unique query parameter
  to avoid reusing a browser-cached failed source response.
- Readiness preparation has a shared 60-second budget from the first recovery.
  This is not a 60-second end-to-end playback guarantee: the existing per-media
  120-second continuous buffering watchdog still applies to media attempts.
- Preparation shows a plain progress label. An unavailable resource or expired
  preparation deadline yields an honest error and the existing manual Retry.
- Pause, track changes and Close cancel recovery; late events cannot start old
  audio. Volume and the selected song survive automatic recovery. A later error
  after actual playback does not automatically restart the song from zero.
- Browser autoplay permission denial still asks for a direct Play gesture;
  it does not launch repeated status checks.

The former unsupported-format/unavailable message is replaced with:

> Audio could not be loaded from the current node. Please retry shortly or try another song.

Connection failure, interrupted loading, unavailable-resource and preparation
timeout messages remain distinct. Recovery does not publish resources, convert
codecs, download full audio into JavaScript, or impose a new file-size limit.

## Verification

ESLint, **250 tests in 21 files**, TypeScript/Vite production build and
git diff --check pass. New tests cover bounded retries, playback intent, volume,
late events, Pause/Close, autoplay denial, no restart after playback, QDN readiness
and build calls, fresh URLs, cancellation, and hung-read deadlines. Tests use
simulated audio elements and native request responses. They do not reproduce a
live Android/Hub stream or prove the reported song's server-side cause.

## Player controls — added to the same RC4 before runtime testing

The passive progress bar is now an accessible song-position slider in both docked
and floating layouts. It supports touch, mouse and keyboard, previews the target
time, and seeks only on release/commit rather than on every drag movement. Seeking
preserves Play/Pause intent and uses the existing stream, with no full-file JavaScript
download. It becomes available once a stream URL and a finite positive duration are
known; invalid/unloaded/disposed seek attempts are guarded. Actual remote seeking
still depends on the browser and the node's stream/range support.

A speaker icon beside the playback buttons opens a compact volume popover in
both layouts; there is no permanent volume row under the seek bar. Its 0–100%
slider has a triangular background widening toward the louder end, with the
selected portion filled and a numeric percentage. The popover includes
Mute/Unmute and closes on an outside click or Escape, returning focus to the
speaker button. Volume carries
over to the next track and recovery attempts; Unmute restores the last nonzero
level. This controls the HTML audio element, not the device's system volume.
Floating positioning now measures player height rather than assuming the old
height, and the player has a viewport height limit with scrolling.

Additional tests verify seeking while playing and paused, invalid/clamped seeks,
volume/mute restoration and volume across track changes, and both sliders in the
floating player, the initially hidden volume slider, popup opening/closing and
uninterrupted playback after Escape. RC4 runtime PASSED the user test on 2026-11-21.

## Runtime checklist — user PASSED

1. Start a previously problematic song before it is cached on the selected node.
   If the first source fails, check preparation and automatic playback recovery.
2. During preparation, test Pause, another song and closing the player. Old audio
   must not start later; resuming remains possible.
3. For an unavailable resource, check the final message and manual Retry.
4. Confirm normal songs, Ear-Bump songs, playlists and volume still work.
5. Sidebar shows v2.0.3-rc.4 only; the accepted publication labels remain intact.
6. Tap/drag the position slider forward/backward while playing, then while paused;
   releasing it must not resume paused audio. Also try the floating player.
7. Open the speaker icon beside the playback buttons. Check the widening volume
   graphic, touch dragging and Mute/Unmute. Close by tapping outside, reopen and
   change tracks; check the chosen volume persists in both player layouts.
