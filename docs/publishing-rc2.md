> Historical phase report. All accepted phases are included in [2.0.2](release-2.0.2.md).
> Any no-commit/no-release statement below records the status at that phase, before final release authorization.

# Q-Music 2.0.2-rc.2 — publishing reliability

Status: runtime FAILED by the user on 2026-11-20. Single-song publishing worked, but the activity UI was confusing, playlist cover decoding failed, and mobile folder selection failed. Superseded by [2.0.2-rc.3](publishing-rc3.md). No commit, push or public rollout performed.

The user accepted the previous listening/browsing runtime round on 2026-11-20.
An isolated playback error for measlyskunk's “05 new orleans instr” remains a
non-blocking observation: the screenshot cannot distinguish unavailable data
from an unsupported source/codec. This round does not change the audio player.
The preserved prior source/runtime packages are named 2.0.1-rc.1; the user reported
2.0.2-rc.1. This candidate uses 2.0.2-rc.2 to make the new test build unambiguous.

## Publishing outcomes

- Q-Music now owns the publishing workflow instead of using qapp-core's shared
  completion-resolver modal. Hub still asks the user to approve/sign transactions.
- The global Publish activity panel can be minimized during a send; doing this
  does not cancel an approved transaction. A declined or failed bridge response
  ends the call. Missing receipts/timeouts produce an uncertain result, not success.
- Every resource has its own state: prepared, sending, submitted, verified,
  failed or uncertain. 100% chunk upload is not transaction confirmation.
- A complete transaction-receipt response is “sent”, not “live”. Partial Hub
  responses do not prove success for entries whose receipts were omitted.
- Audio, metadata, covers and playlist updates run in ordered stages. Batches
  contain at most ten resources and at most 500 MiB, except a larger permitted
  single audio file which is sent alone. Later stages stop on an incomplete result.
- Library writes use the same serialized executor and cannot overwrite an audio
  modal's callbacks. Web Locks also serialize supported tabs; use one Q-Music tab
  for publishing because not every hosting context supports cross-tab locking.

## Saved jobs and safe continuation

- Before the first wallet action, the complete plan, resource IDs, files, expected
  byte counts and SHA-256 hashes are saved in IndexedDB on the device.
- The same saved IDs and prepared payloads are used when continuing. The job is
  available after route changes/reloads, under its original Qortal name. An
  interrupted sending state restores as uncertain. New publications cannot start
  until prior saved jobs have loaded, and unfinished jobs must be continued or archived.
- “Continue saved job” checks unfinished resources before sending. Anything proven
  correct is skipped. Submitted/verified items are not automatically sent again.
- “Check availability” uses fresh exact-identity reads, matching indexed metadata,
  READY status, exact byte count and streaming SHA-256. Mere search visibility,
  an old version or an identically named resource does not verify the new payload.
- Verification is a separate, user-initiated operation. It reads actual file bytes
  from the node and can use mobile data. Checks can be stopped/minimized. Deadline
  scales with resource size, up to 30 minutes per item; a stop leaves the job resumable.
- An uncertain previous send can still complete. Resending unverified resources
  therefore requires explicit confirmation and then the normal Hub approval.
  The resource IDs stay the same, but another transaction/fee is possible. Receipt
  history is retained. No timeout is treated as proof that the transaction did not happen.
- Fully verified jobs retain their manifest/hashes/receipts but release their local
  file copies. Archiving an unverified job retains its files and allows another job;
  it does not cancel sent transactions or remove anything from QDN.

## Files, metadata and existing resources

- Limits match Hub: 500 MiB per audio on a public node, 2000 MiB on an own node.
  If node type cannot be determined, the smaller limit is used. The actual node
  limit is checked again before sending, including resumed jobs after node changes.
- Empty files are rejected. A recognized audio extension is accepted when the
  browser supplies an empty/generic MIME type. Audio codec playback support still
  depends on the browser and OS; this is not a transcoder.
- A job is limited to 200 audio files / 4000 MiB of source files. Large album cover
  preparation is sequential instead of decoding all covers concurrently.
- Cover input remains limited to 12 MiB and 40 megapixels. Output JPEG bytes are
  actually measured and quality/dimensions reduced until the THUMBNAIL fits 500 KiB.
  An image which cannot be made to fit is rejected before any transaction.
- Audio search metadata is intentionally compact: title at most 80 UTF-8 bytes and
  description at most 240. Percent-encoded values are cut only at character boundaries.
- Full song fields are stored in a revision-pinned `qmusic.song.v2` DOCUMENT,
  normally `qmusic_meta_<audio identifier>`; long legacy identifiers use a deterministic
  hashed metadata identifier so the Core 64-byte identifier limit is respected.
  This adds a details resource/fee per song, shown in Hub's staged approvals.
- Full Unicode titles, album, genre, mood, language, notes and dates round-trip in
  the document. The metadata document is limited to 256 KiB; excessive notes are
  rejected rather than silently truncated. Notes retain internal line breaks.
- Existing AUDIO identifiers and playlist reference formats are unchanged. Legacy
  songs load through the previous format. Updated readers load full metadata only
  for the new revision-marked songs; playback is usable before those details arrive.
  Editing a new-format song waits for matching full details to prevent overwrites
  from the compact index. Older clients can play the audio but may not preserve
  full details if they edit it; use this updated publisher for new-format edits.
- Playlist JSON retains its full title/description/order, while its search index
  fields fit Core's byte limits. An existing playlist must load successfully before
  a folder's first audio send. A read failure never becomes a writable empty playlist.
- Playlist drafting uses the selected order, not feed order. Song and owned-playlist
  selectors can load further pages. Edit-playlist selection can also load more songs.
- CSV/TXT import normalizes `publishedDate` correctly. Existing-audio reuse no longer
  constructs a giant base64 string in JS; it downloads a Blob with a bounded deadline.
  Editing audio index fields still needs reusing/republishing the audio bytes.
- Partial results retain input and direct the user to the saved job. A fully sent
  folder clears its input so a second click does not accidentally create a new album.

## Local verification

- `npm run lint`: passed.
- `npm test`: 83 tests across 11 files, including the prior 40 listening/browsing tests.
- `npm run build`: passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check`: passed.
- Clean dependency install, repeat checks, archive CRC and local asset checks are
  performed during final packaging. Tests mock the bridge, native media and Canvas
  output. They do not prove actual Hub uploads or actual JPEG encoding behavior.
- No real QDN publish or wallet transaction was performed by the assistant.

## Runtime checklist

Verify **v2.0.2-rc.2** below the logo. The runtime ZIP has `index.html` at its root;
use the separate source ZIP only for development.

1. Publish one small song with a cover, a longer Unicode title/notes and a date.
   Hub should ask for the relevant stages. The result should say sent/availability
   pending. Allow normal block confirmation/propagation, then Check availability.
   Open Details and Edit to confirm the full fields survived.
2. Decline a Hub confirmation. The form/modal must become usable. Continue the saved
   job and accept; confirm it uses the same identifiers. A new separate publication
   should be blocked while the original job is unfinished unless it is archived.
3. Publish a small folder with a cover and a playlist. If a later stage fails,
   minimize/reopen Publish activity and continue only the unfinished work. Reload
   once before continuing to check saved-job recovery. Do not force a real network
   interruption during a large/valuable upload solely for this test.
4. Create/reorder/edit an existing playlist and verify the saved order. Confirm an
   unavailable existing playlist blocks a folder before audio is sent.
5. While a send/check runs, minimize the panel and listen/browse as before. The player
   should remain functional. Reopen Publish activity from its button. Check that a
   new song's metadata loading does not hold up Play.

Verification can remain pending while data/indexes propagate. A submitted transaction
is not a guarantee of immediate READY on every node. If a failure repeats, record the
job title, resource stage/state, error, node type and Hub/Core versions.

## Still separate work

Core's orphaned request-slot leak and HTTP Range issues are unchanged. Account-separated
Library storage/merge behavior, engagement indexing/deletion and wider startup/bundle
optimization remain later work. This candidate is for the publishing runtime round,
not approval to commit, push or release publicly.
