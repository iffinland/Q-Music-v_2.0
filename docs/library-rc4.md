> Historical phase report. All accepted phases are included in [2.0.2](release-2.0.2.md).
> Any no-commit/no-release statement below records the status at that phase, before final release authorization.

# Q-Music 2.0.2-rc.4 — Library and account isolation

Runtime PASSED by the user on 2026-11-20; Library/account phase locked. Listening/browsing and RC3 publishing have passed the
user's runtime tests. No commit, push, public release or real wallet transaction
has been performed by the assistant. The current Git baseline is still 681a4da.

## Behavior

- Favorites, saved playlists and the most recent twelve listening entries are
  stored under a key scoped by **wallet address and Qortal name**. A transferred
  name belongs to a different scope on a different wallet. A wallet without a
  name has its own local scope. Guest history/favorites remain separate.
- All readers derive their scope from current auth during render, so they do not
  briefly display a previous account's collection while an effect/read completes.
  Late reads are cancelled/ignored. Queued old-account saves are checked again
  inside the shared publishing lock, including a fresh native wallet address read.
- Changes persist locally immediately. **QDN backup is explicit** via Save to QDN
  on the Library page; opening pages, listening, importing or favoriting no longer
  initiates an automatic publishing approval/fee. Check sync reads the exact
  resource using fresh reads and merges newer records. The UI explains that QDN
  backups, including saved recent history, are public and require Hub approval/fees.
- Before a QDN send, the current node's exact resource is read again inside the
  publish lock. The send includes the merged latest local data and remote records.
  A failed read, non-READY resource, malformed payload, wrong v2 owner or storage
  failure prevents the send. An already known online library missing from a new
  node is not treated as permission to replace it with an empty one.
- No published result is inferred from an upload progress percentage. Receipts
  produce a sent state; actual visibility is checked separately. A saved attempt
  precedes sending, survives reload and preserves receipt signatures. Interrupted
  or ambiguous sends remain uncertain. No automatic resend runs. Sending again
  is under Sync details and requires explicit confirmation plus Hub approval.
- A fresh read already containing all changes avoids an unnecessary transaction.
  Newer local changes made while sending remain local until the next explicit save.
- Per-item changes and removal records replace the old union-only merge. A stale
  remote snapshot cannot restore a removed favorite. Deliberate later re-adds are
  retained; independent changes merge by change timestamp/ID, with removal winning
  exact timestamp ties. History has its own ordering and twelve-item bound.
- History is updated when playing from the Library as well as other entry points.
  Local quota/read errors retain in-memory edits and original disk bytes and show
  a warning. Storage events merge valid changes from other tabs in the same scope
  and persist missing records without echoing already converged events forever.

## Migration and compatibility

The old unscoped keys are **kept untouched**. Their owner was never recorded, so
assigning them to the first wallet that logs in would reproduce the account leak.
Library offers Review and Import selected: favorites are unchecked by default;
only selected songs/playlists are imported locally. Original unassigned history
is not silently assigned to a wallet. Existing named QDN libraries are read as
legacy snapshots and normalized to full service/owner/identifier media identities.
A v2 owner mismatch under a transferred name is blocked instead of merged.

New QDN documents keep the original favoriteSongs/favoritePlaylists/recentSongs
arrays for reading by older apps, and add schema, owner and per-item change
records. Legacy snapshots have no per-item edit clocks: they can contribute old
items but never outrank an explicit v2 removal. Old apps cannot preserve v2
removal records when they write; use the updated version on devices that edit
this collection. No guaranteed simultaneous multi-device atomic write is claimed:
QDN is eventually consistent and the single document has no compare-and-swap.
Retained local records plus fresh merge checks reduce lost changes and reconcile
on later sync; use Check sync before/after editing from another device. Removal
records are retained rather than expiring arbitrarily. QDN backup payloads have a
2 MiB bound; a larger collection remains local with an explicit error.

Local storage and QDN availability are separate. Deleting browser/app storage
also deletes local edits and pending-attempt evidence unless already backed up.
An unavailable node cannot prove that a sent transaction never existed. Only an
exact absent index plus direct NOT_PUBLISHED result may initialize a previously
unknown online library; a fresh, fully synchronized node is still required for
reliable initial discovery.

## Verification

- Clean dependency install, lint, 134 tests across 14 files, TypeScript/Vite build
  and git diff --check are run for delivery. The suite includes prior listening,
  browsing and publishing checks plus account/name isolation, old-data migration,
  late reads, in-flight/queued switches, fresh exact reads, invalid payloads,
  local quota/corruption, storage events, removal/re-add merging, bounded history,
  receipt persistence, uncertain sends, decline/retry, duplicate clicks and
  end-to-end stale-copy removal retention. Native bridge/QDN responses are mocked.
- The environment previously denied Chromium sockets and the shared browser could
  not reach the dev server; no actual Hub/Android or visual-browser success is
  claimed for this candidate. Those require the user's runtime round.
- Relative production assets and ZIP CRC are checked during packaging. The existing
  large qapp-core chunk warning remains. No Core/Hub source was changed.

## Runtime checklist

Verify **v2.0.2-rc.4** below the logo. Use the runtime ZIP, not the source ZIP.

1. Under account A, save a song and a playlist, play several songs, reopen the app
   and check that this device's collection remains. Saving locally must not open
   Hub approval. Library should show the current Qortal name and sync state.
2. Switch to B (and guest mode if available). A's favorites/history must disappear
   immediately. Make B's own changes, then return to A: A's collection must return
   without B's entries. A second name on the same wallet is also a separate scope.
3. If older unassigned favorites are detected, use Review. Select one item and
   import: only that item should appear, with no automatic QDN publish. Original
   old keys/data remain available for later review.
4. Use Save to QDN deliberately; approve in Hub, wait for normal confirmation and
   propagation, then Check sync. Remove the saved favorite, reopen/refresh against
   an older node copy, and confirm it stays removed. Save and check the removal.
5. If the node is unavailable, local favorites/history must remain usable. Retry
   sync after reconnecting. Decline one save approval and retry deliberately;
   there must be no automatic repeated approval. A sent/uncertain save should
   offer Check sync before the explicit Send again action.
6. Briefly browse/listen/publish as in RC3 to check the prior accepted flows.

This phase passed the user runtime round. Commit/push still require explicit authorization.
