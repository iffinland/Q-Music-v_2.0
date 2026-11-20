> Historical phase report. All accepted phases are included in [2.0.2](release-2.0.2.md).
> Any no-commit/no-release statement below records the status at that phase, before final release authorization.

# Q-Music 2.0.2-rc.3 — simple publishing

Runtime PASSED by the user on 2026-11-20; publishing phase locked. The listening/browsing round remains accepted. The prior
publishing RC2 failed user runtime testing and is superseded. Nothing has been
committed, pushed or published by the assistant.

## User flow

1. Choose **song**, **album / folder**, or **playlist** from the Publish page.
2. Fill only the selected form. More details are optional and initially collapsed.
   Covers are optional. Select several audio files on mobile; full directory
   selection is a separate desktop option. Imported metadata remains supported.
3. Review the actual prepared track order, cover presence and playlist choice.
   All files, covers, metadata and any existing playlist are prepared/read before
   Hub approvals begin. Review never sends a transaction.
4. Press Publish, approve in Hub, and finish with Done. The short result means
   transactions were sent; network availability can take more time.

The progress window can be minimized. Continue unfinished work or view previous
publications from the Publish page; no floating activity badge covers other pages.
Technical identities, availability reads, send-again controls and setting aside a
job live under Details. Send-again still requires explicit confirmation because
an earlier transaction may complete and another fee is possible. Availability
checks remain opt-in and can read substantial mobile data.

Audio and playlist selectors are mounted only when needed. Playlist selection
order is retained. A playlist description is optional. For a folder, common
metadata fills empty fields; the album title also fills missing song albums.
Individual imported fields/covers can be reviewed, edited or removed. Adding to
an existing playlist retains its title and prior songs instead of renaming it
from the new album title. An unreadable existing playlist blocks preparation.

## Compatibility and layout changes

- Primary album selection is a standard multiple-audio input with the same
  supported audio filter as single-song publishing, without directory attributes.
  The previous directory-only entry depends on client support and is unreliable
  on Android clients. This avoids requiring a directory picker on a phone.
- Folder parsing falls back to the filename when webkitRelativePath is empty.
  Audio MIME is also recognized when a mobile content provider omits the extension;
  uppercase MP3 and generic/empty MIME with a known extension are accepted.
- Cover validation accepts known image extensions when MIME is missing/generic.
  The image decoder retries using FileReader/data URL if a file's blob URL fails.
  The selected cover is decoded, square-cropped, encoded and byte-size checked
  immediately. The preview and actual publication reuse the same encoded result.
  Invalid covers block Review until changed or removed; they do not become a
  silently missing cover or a partially sent publication.
- PNG/JPG/WebP are recommended. There is no new HEIC/AVIF transcoder: if the client
  cannot decode an image, select a supported local image or remove the cover.
- Mobile header chips were reduced, long account names constrained, main content
  allowed to shrink, dialogs sized to the viewport, and long resource text wrapped.
  The development placeholder text on the audio details page was removed.

The original failing playlist image and native picker response were not supplied
as files/logs, so their exact device-specific causes are not proven. The candidate
addresses reproducible parser faults and adds compatibility routes/early feedback.
The existing durable receipt/identity/byte-verification engine remains in place.

## Verification

- Clean `npm ci --ignore-scripts`, `npm run lint`, `npm test`, `npm run build`,
  and `git diff --check` are run for the delivery.
- 91 automated tests across 12 files, including the listening/browsing regression
  suite, mobile file metadata, image-read fallback/cache, early cover failures,
  review-before-send, playlist ordering, existing playlist preservation, sent/Done
  UI, and interrupted-job behavior. Bridge, Image and Canvas are mocked in tests.
- Scripted Chromium could not start because the execution environment denied its
  socket operation; the shared browser could not reach the local dev server.
  No browser viewport/real JPEG/Android WebView success is claimed from this run.
- Production archive relative assets and ZIP CRC are checked during packaging.
  The pre-existing large qapp-core bundle warning remains.
- No real Hub upload, QDN publish or wallet transaction was performed.

## Runtime checklist

Verify **v2.0.2-rc.3**. Use the runtime ZIP, whose index.html is at its root.

1. Publish one small MP3 with a cover. Confirm that the cover preview appears
   before Review, then approve in Hub and close the result with Done. Browse and
   play the song; no floating activity notice should obscure the page.
2. Create a playlist from existing songs. Test with a cover, and without one.
   Confirm the selected order is saved. Description is optional.
3. Choose two or three MP3s with **Choose audio files** on the phone, set the
   common artist/album, and optionally create an album playlist. Review the order
   before publishing. Full desktop-folder selection is not required for this test.
4. Decline one Hub request and continue the saved publication from the Publish
   page. Already sent resources must not be resent automatically. Minimize during
   a send and verify browsing/listening stays usable.
5. Confirm there is no horizontal page/dialog scrolling on the phone. If a cover
   still fails, record its format/size, whether its preview loaded, and client
   version. Removing that cover should allow publication without it.

Actual user Android/Hub runtime PASSED. Commit/push/release still require explicit approval.
