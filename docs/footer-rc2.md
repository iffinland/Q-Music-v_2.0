> Historical RC2 candidate. [RC3](version-labels-rc3.md) replaces its version display with a build-supplied sidebar-only number.

> Historical candidate notes. Superseded by [2.0.3](release-2.0.3.md).
> Final RC4 runtime PASSED on 2026-11-21; the user authorized main commit/push
> and the official release. Earlier pending/authorization notes below describe
> the candidate's original delivery, not the current release status.


# Q-Music 2.0.3-rc.2 — remove in-app change log

Based on the accepted Ear-Bump RC1 candidate (uncommitted on release baseline
17712260f6692978fd170f3dd35a41a73d2c2f66). Core/Hub code is outside this work.

Removed the in-app change-log link/dialog, owner rich-text editor, its state,
loading effects, QDN reads/publishing service and unused runtime HTML sanitizer.
The sidebar footer now shows only `v{appVersion}`, using the same existing value
as the logo version, instead of the old hard-coded `v. 2.0` label. Project release
notes/CHANGELOG.md remain repository documentation, not an app feature. Existing
published historical QDN documents were not deleted or changed.

Version policy is not redesigned in this candidate. The recommendation is a
single release version supplied automatically to the build, rather than a remotely
editable label that might disagree with the loaded application files. No new
remote version document, request, publishing or administration feature was added.

All 232 existing regression tests across 20 files, ESLint, production build,
relative asset checks and ZIP CRC pass. The old sanitizer test now retains its
still-used Unicode JSON codec assertion; no HTML-rendering path remains. Runtime
UI verification is pending; no commit/push/public release was performed.

Runtime: verify `2.0.3-rc.2` below the logo and at the sidebar bottom. The bottom
version is plain text, with no change-log link/window. Briefly recheck mobile
navigation, Support dialog and previously accepted Ear-Bump listening/browsing.
