# Q-Music 2.0.4-rc.8 — mirroring via native publisher follow

> Historical candidate notes. This work is included in the user-accepted 2.0.4
> release. Current scope and verification: [release notes](release-2.0.4.md)
> and [verification](verification-2.0.4.md). Candidate-state wording below
> records the phase at the time of testing.

Uncommitted candidate on public 2.0.3 base
42a287e6eea57e521468ba43e91d8c0a05c50aae, retaining accepted RC1–RC7 work.
RC7 Android/Hub runtime PASSED on 2026-11-22. No commit/push, public release,
QDN publishing or new Core/Hub changes were made for this phase.

## Capability audit and final scope

The inspected native client exposes IS_USING_PUBLIC_NODE, GET_LIST_ITEMS,
ADD_LIST_ITEMS and DELETE_LIST_ITEM. List mutation/read routes reject public
nodes and use native user permissions. ADD_LIST_ITEMS and DELETE_LIST_ITEM
accept one selected group, returning true/false for the Core list transaction.
The public-node check describes Hub's configured gateway classification; it is
not proof that a user owns any other configured endpoint. The dialog therefore
also requires confirmation that the user manages the currently selected node.

Core's ListUtils aggregates lists beginning with followedNames. Its storage
manager considers followed names for prefetch under FOLLOWED and
FOLLOWED_OR_VIEWED; ALL permits general prefetch. VIEWED/NONE do not turn a
publisher follow into automatic catalogue download. Existing blocked-name,
public/private data, free-space and cleanup/storage constraints still apply.

There is no supported per-artist metadata pin command exposed by this Hub bridge,
no supported Q-App storage-policy read/change action, and no reliable exposed
per-file permanent-retention/completion guarantee. ADMIN_ACTION's allowlist does
not provide these operations. GET_HOSTED_DATA would prompt for broad hosted data
and cannot prove future retention. Triggering a build/stream or fetching every
file into the browser is not equivalent to pinning a catalogue, so this feature
does not do that or use private API keys/direct node requests.

The resulting feature is explicitly **publisher follow**, including all content
and future publications from selected Qortal names, rather than claiming a
music-only or artist-only mirror. A native follow persists on the node and Core
can manage future downloads independently of the open dApp. It remains subject
to the node's actual policy and capacity. The UI reports verified follow rules,
not completed downloads, exact catalogue bytes or guaranteed permanent storage.

Primary code inspected (storage/list files unchanged by this phase):

- Qortal-Hub base fee7c83623253dd027d9833a4adbb773c13fc9f5:
  src/qortal/get.ts (getListItems, addListItems, deleteListItems, adminAction),
  src/qortal/qortal-requests.ts (isRunningGateway and native action routing),
  src/qortal/__tests__/nodePathRequests.test.ts (custom followedNames list).
- Qortal base 108bf191d42d710ec617f535af30cfd82fc03c87:
  src/main/java/org/qortal/utils/ListUtils.java,
  controller/arbitrary/ArbitraryDataStorageManager.java,
  controller/arbitrary/ArbitraryDataManager.java,
  list/ResourceListManager.java and api/resource/ListsResource.java.

## User interface

Publisher pages show Mirror publisher; artist pages show Mirror artist
publishers. Opening the lazy dialog checks the selected node and Q-Music list.
Merely browsing a creator makes no mirroring requests. Public or unverifiable
node state disables actions. Candidate names are deduplicated case-insensitively
while retaining the first spelling and frozen for that review. Nothing is
selected automatically. Artist candidates are only publishers of indexed artist
matches already found; incomplete searches are labelled and may require closing
the dialog and Search more songs before reviewing more publishers.

The dialog describes target as the node currently selected in Hub. The bridge
does not expose a reliable selected-node URL/identity token for locking it to
this review. Keep it selected throughout permission and read-back; switching
nodes opens a new management context, not a portable wallet-owned subscription.
Refresh status re-reads the current native list. No node/account credentials or
follow list are persisted in browser storage.

Select up to 20 names and acknowledge ownership/scope, then Follow on my node.
Candidates page locally in sets of 20. Manage all Q-Music follows shows the
app's complete saved follow list, also paged, so old rules can be removed even
when their original artist results no longer contain those names. Follow and
stop selections must be separate; actions are enabled only for entirely new or
entirely already-followed selected groups.

The dedicated list is followedNames_qmusic. Stopping changes only that exact
list, never followedNames or another app's list. Saved casing is preserved when
removing entries. Already hosted files are not deleted; other follow lists and
storage policy ALL may continue mirroring a publisher. Library favorites and
saving files to the user's device remain separate.

## Mutation and performance behavior

Each mutation rechecks Hub public-node classification, sends one native
confirmation for the selected group, requires a true acknowledgement, then
reads back the exact Q-Music list and verifies the requested membership. There
is no per-song loop or catalogue/media download. The adapter shares in-flight
list reads (including React StrictMode), but does not cache them across contexts.

Hub permission dialogs can take time: list reads allow 120 seconds, writes
240 seconds. These native operations cannot be cancelled reliably. The review
cannot be dismissed while a write is pending. Leaving via browser navigation
can still unmount it; an already approved native write may finish on the node,
without late UI updates. An error, denial, false acknowledgement, mismatched
read-back or timeout is not automatically retried. Further mutations require
Refresh status, since the node may have accepted a write whose response was lost.
A refresh never resends the mutation and clears old success messaging.

Node-controlled automatic downloads have no fabricated per-file progress or
Pause/Resume buttons. Stop Q-Music follow stops this app's ongoing follow rule;
it cannot cancel already active Core transfers or delete hosted resources.
Help includes scope, native permissions, required storage policies, management,
unknown size and retention limits. Both skins use the same implementation.

## Verification

ESLint, **322 tests in 33 files**, TypeScript/Vite production build and git diff
--check passed. New tests cover own-list add/remove/read-back, public/unverifiable
node refusal, size limits and malformed/declined responses, no automatic retries,
no requests before opening, explicit unchecked selection and ownership/scope
acknowledgement, incomplete/frozen artist review, management of earlier follows,
case-preserving removal, paged 20-name selections, pending-write close protection,
and no file-fetch/stream/status/hosted-data requests. Existing playback, search,
Discover Mix, appearance, publishing and Library regressions remain passing.

Tests simulate DOM/native APIs. RC8 user Android/Hub runtime **PASSED on 2026-11-22**;
no real node follow list was changed during development. Packaging checks the
version, relative assets and ZIP integrity.

## Runtime checklist

1. On your own node, open a publisher and Mirror publisher. Review the scope,
   select the name, acknowledge it and approve Hub's request. Check saved follow
   status, including read-back permission if Hub asks. Playback must continue.
2. Open an artist with multiple publishers. Confirm incomplete search is labelled
   and only explicitly selected publishers are sent to the native confirmation.
3. Manage all Q-Music follows, select a saved rule and Stop Q-Music follow.
   Confirm the rule is removed without a hosted-file deletion prompt.
4. Decline a native permission or simulate an unavailable node. Status should be
   useful; Refresh status should read, not repeat a write.
5. With a public node, the dialog must explain why managing follows is unavailable
   and offer no enabled mutation action. Repeat layout checks in both skins.
6. For actual mirroring behavior, use your node's management tools to check its
   storage policy/capacity and eventual hosted resources. Saved follow status
   alone does not certify every file is available or retained permanently.
