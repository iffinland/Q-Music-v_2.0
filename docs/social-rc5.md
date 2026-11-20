> Historical phase report. All accepted phases are included in [2.0.2](release-2.0.2.md).
> Any no-commit/no-release statement below records the status at that phase, before final release authorization.

# Q-Music 2.0.2-rc.5 — likes and comments

Runtime test PASSED and phase locked by the user on 2026-11-20. Listening/browsing, RC3 publishing and RC4 Library/account
isolation passed the user's runtime rounds. No commit, push, public release or
real QDN/wallet transaction has been performed by the assistant.

## Scoped reads and honest results

- New like IDs and comment prefixes use a 128-bit SHA-256 prefix over media type,
  publishing Qortal name (case-normalized) and exact media identifier. Names/IDs
  belonging to different publishers no longer share reactions. All resource IDs
  stay within Core's 64-byte limit. Comment display IDs include their QDN owner,
  so two authors using the same identifier do not overwrite each other in lists.
- Existing comment reads target the legacy per-entity prefix, not the app-wide
  comment catalog. Legacy payloads are checked for media owner, exact identifier
  and type. Author attribution always uses the actual QDN publishing name;
  conflicting payload author claims are rejected.
- Each comment page reads ten modern and ten legacy index rows, advances raw
  offsets and retains unavailable entries for later retry. Only two content
  requests run concurrently. A batch retries at most ten old failures alongside
  new rows. A creation-time watermark stabilizes paging against new inserts.
  Loaded comments are sorted; Refresh checks for newly created entries.
- Each payload read has an eight-second consumer deadline, and each social load
  has a fifteen-second budget. Reads use the existing background-priority queue,
  fresh searches and fresh payload fetches. These deadlines stop Q-Music waiting;
  they cannot cancel every native/Core request already in flight.
- Modern likes count their scoped index state without downloading every document.
  Legacy reactions require owner validation through payloads. Counts inspect at
  most 25 legacy and 200 modern rows, plus the active name's explicit state. A
  capped/unavailable count displays `+` and is not presented as a complete total.
- Loading/unknown likes are not displayed as zero. A read failure preserves an
  already loaded count/list. A partial comment refresh retains prior loaded
  entries while allowing successful newer versions to replace them.

## Writes, removal and propagation

- Like/unlike, comment, edit and remove all use supported DOCUMENT publishing,
  serialized with audio/Library writes. A queued operation rechecks the page,
  account and native wallet before requesting the actual send. Social sends use
  a five-minute bridge deadline, not the audio-batch default hour.
- Unlike publishes a scoped inactive marker. A comment removal republishes a
  tombstone under its original ID; edits preserve that ID and original creation
  time. Neither uses the unsupported DELETE_QDN_RESOURCE action. These are logical
  removals in updated Q-Music, not permanent deletion of historical QDN versions.
- Each write saves its target, actor, exact ID, payload and revision before opening
  Hub. A receipt produces a sent result and a local pending overlay. Old node
  copies cannot immediately flip that like back or resurrect the old comment text.
  Pending overlays are retired only when a matching indexed/body revision has
  been read and its result installed in the active view. Comment payload/index
  revision mismatches stay pending for retry instead of displaying stale bodies.
- Interrupted sends restore as uncertain. Missing receipts/timeouts never trigger
  automatic retransmission. Refresh is offered first; Retry saved action requires
  explicit confirmation and uses the same ID and payload (another fee is possible).
  Known declines settle, keep the text draft, and do not claim a sent action.
- Identical comment submissions still waiting for propagation reuse the saved
  action. Hook guards block double clicks before rerender. Storage failures block
  the first send; unreadable stored records are not silently discarded/overwritten.
- Social activity is scoped by wallet address, active name and exact target.
  Old async results do not populate a new account/page. Comment drafts remount
  when the page/account changes. Opening comments alone never posts anything.

## Discussion UI

- Likes and comments have their own refresh, error and pending feedback. Comments
  remain demand-loaded when Show comments is opened; no global scan on startup.
- Replies, deeper replies and replies to unavailable/removed parents remain visible
  as independent cards with reply context. An ambiguous legacy parent ID is not
  assigned to an arbitrary author's card. Removed comments show a placeholder.
  Own replies can be edited/removed just like top-level comments. Text remains
  plain text with line breaks; no remote HTML is injected.
- Comment bodies are limited to 8 KiB before wallet interaction. Text drafts survive
  declined/failed posts. Guest controls explain login requirements. UI explains
  public QDN storage, approval/fees and the limits of logical removal.

## Compatibility limits

Legacy social data remains readable after full target/author checks. An inactive
modern like overrides a legacy active like for the same author/target. An edited
or removed legacy comment keeps its old resource identifier.

Older Q-Music versions cannot interpret the new scoped identifiers/state markers,
may omit new social activity, and cannot reliably hide tombstones. Use the updated
client for these features. Counts are not a global consensus or a Sybil-resistant
vote. QDN indexing/payload propagation is eventual; different nodes can temporarily
show different activity. This candidate does not repair Core's orphaned request
slots or HTTP Range handling, and does not erase immutable historical content.

## Verification

- Clean npm dependency install, lint, **170 tests across 16 files**, TypeScript/Vite
  build and git diff --check are run for delivery. Existing accepted feature suites
  remain included. New tests exercise identities, legacy-owner isolation, tombstones,
  partial counts, targeted raw paging, two-reader concurrency, read deadlines,
  spoofed authors, revision pins, durable uncertain sends, exact retries, wallet
  guards, quota failures, double clicks, stale responses, pending overlays, retained
  drafts, partial refresh, orphan/deeper replies and explicit retry confirmation.
- Bridge, QDN, timers and media behavior are mocked. No actual Hub transaction or
  Android/browser visual success is claimed. The environment's prior browser
  socket/connection limitation remains; user runtime is required.
- Delivery checks relative assets and ZIP CRC. The existing large qapp-core chunk
  warning remains. No Core/Hub source changes or git commit/push were performed.

## Runtime checklist

Verify **v2.0.2-rc.5** below the logo; use the runtime ZIP.

1. Like a song and a playlist, then unlike them. Approve in Hub and use Refresh
   likes after normal confirmation/propagation. Pending state must not immediately
   revert on a stale node. Unloaded/failed counts must not pretend to be zero.
2. Open comments, post a short multiline comment, reply, edit your comment/reply,
   and remove one. Check that replies remain visible when their parent is removed.
   Removal is another QDN publication; older versions can remain accessible.
3. Decline one post/edit approval. The call must settle and preserve your draft.
   If a real send becomes uncertain, refresh first; retry only deliberately through
   the saved-action confirmation. Do not force a valuable transaction to fail just
   to test this path.
4. Switch quickly between two detail pages/accounts while comments/likes load.
   Old activity/heart state must not appear on the new target. Load more comments
   and refresh against a slower/unavailable node; retain already loaded information.
5. Briefly check listening, playlist browsing, simple audio publishing and Library
   switching from the accepted rounds. Guest mode should read but not publish.

This phase passed the user’s runtime test. Commit/push still require authorization.
