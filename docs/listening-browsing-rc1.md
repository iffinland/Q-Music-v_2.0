> Historical phase report. All accepted phases are included in [2.0.2](release-2.0.2.md).
> Any no-commit/no-release statement below records the status at that phase, before final release authorization.

# Q-Music 2.0.1-rc.1 — listening and browsing

Status: user runtime test PASSED on 2026-11-20; not a public release.
The isolated measlyskunk track error was explicitly deferred as non-blocking by the user. Based on upstream commit
`681a4da63eb3e181237ada819b3156d0ffbc9664` (2026-03-28).

## Changes

- Song and playlist pages consume the node's raw pagination cursor. Hidden and
  duplicate rows do not terminate the catalog early. A browse session fixes its
  upper timestamp; Refresh starts a new session.
- Listing queries use the AUDIO/PLAYLIST identifier prefix and do not request
  resource status for every row. Resource identities include service, publisher
  and identifier. Published identifiers and playlist reference schemas are unchanged.
- Playlist cards render without downloading their contents. Unknown track counts
  are omitted; choosing Track count loads counts with two workers and leaves
  cards usable. Unreadable playlist payloads raise an error instead of becoming
  empty playlists, including when another workflow tries to reuse a playlist.
- Full-catalog scanning starts on search/filter/sort demand, not on every Browse
  mount. Partial results remain usable and errors offer Retry. Search Play builds
  its queue from the displayed results, in the displayed order.
- My Music loads songs and playlists independently. Browse, detail, My Music and
  Home errors expose retry controls. Existing cards remain visible on Load more.
- A selected song gets reserved read capacity. The app limits shared reads to four
  active bridge requests, including at most three non-playback and two background
  requests. A request already inside the bridge holds its slot until it actually
  settles, even if its UI consumers leave. Unneeded queued work is cancelled.
- Play resolves the AUDIO URL directly. It no longer waits for properties or a
  synchronous build before assigning the media source. The media HTTP request
  starts the node's normal download/build path.
- Every playback attempt owns its own audio element. Track switches and Close
  immediately stop/release the old element. Delayed results or play rejections
  cannot mutate the next track. Pause is respected while a URL is loading.
- The player handles waiting, stalled, playing, codec/network errors, ended and
  autoplay denial. It shows actual buffering, offers Retry for the same track,
  and times out a continuous stall after two minutes. Browser-autoplay denial
  can be resumed by pressing Play on the loaded element.
- Artwork resolves lazily in background without per-card build/poll loops.
  Missing or broken card artwork falls back to its title placeholder.
- Caches validate responses, use bounded in-memory storage, discard invalidated
  in-flight results and refresh with media changes. Node-specific URLs are not
  stored. Parsed song metadata no longer remains cached forever.
- Existing local/remote Library entries normalize legacy IDs in memory so saved
  songs still match the new browsing identities. A readback case mismatch that
  hid `publishedDate` is fixed. Library startup no longer downloads every saved
  playlist just to count tracks.
- Comments open on request to avoid scanning comment documents when opening a
  song to listen. Comment publishing/deletion logic is otherwise unchanged.
- Version is visible below the logo and in the document title. Existing lint
  formatting issues are normalized; filename control-character stripping is
  explicitly documented for the linter. CI includes the regression suite.

## Verification

Local Node 24.22.3 / npm 11.19.1:

- `npm run lint`: passed.
- `npm test`: 40 tests passed across six files (mocked bridge and media APIs).
- `npm run build`: passed (TypeScript + Vite).
- Existing large-chunk warning remains; bundle slimming belongs to startup work.
- Package structure, local asset references and archive CRC checked when packaging.

No real wallet action, QDN publish, Git commit or push was performed. Tests cover
DOM interactions and playback lifecycle with fake media/network APIs; they do not
prove actual Hub codec, autoplay, download speed or public-node behavior.

## Runtime acceptance

Use the runtime ZIP, whose root contains `index.html`, `assets/`, `qmusic.png`
and `sw-video-decrypt.js`. The source ZIP is for development, not QDN app upload.
Verify `v2.0.1-rc.1` below the logo before testing.

1. Open Home, Browse All, Playlists and My Music. Cards should appear independently
   of slow/missing artwork. Load more several times, then Refresh.
2. Search for an older song outside the initial page. Use its Play button and check
   the player title and sound. Try the artist initial, genre, publisher and sort
   controls. Search completion/partial errors should be visible.
3. Play a familiar READY song and a cold song not recently downloaded. Try Play/
   Pause, Next/Previous, a fast switch while loading, closing/reopening the player,
   and automatic advance at track end. Float/restore/drag the player as before.
4. Open a playlist, play its tracks and return to browsing. An unavailable playlist
   should give Retry, never a falsely empty editable result. Choosing Track count
   may load slowly, but must not freeze playlist cards.
5. Temporarily disconnect/reconnect, or choose an unavailable song. Retry the same
   song. If the browser asks for playback activation, press Play. Check an existing
   saved song and a legacy playlist still open/play correctly.

For a failure, record the screen/route, exact song or playlist publisher and ID,
Hub/Core versions, local/public node, what happened, and whether Retry worked.

## Remaining work and compatibility limits

- Core's orphaned request-slot leak and HTTP Range issues were not modified.
  App-side scheduling reduces pressure but cannot fix the node's bridge internals.
- Publication modal completion, persistent batch IDs, full metadata storage,
  publish file/thumbnail limits and publication verification still need their
  dedicated stage. Shared reads/cache changes affect read paths used by publish
  too; this is not an approval of publishing as fixed.
- Account-separated Library sync, removal merge semantics, comment indexing,
  deletion actions and wider engagement fixes remain separate work.
- Large media/codec support still depends on the browser, operating system and
  node. Retry cannot make a codec supported or recreate unavailable QDN data.
- No production rollout, commit or push is authorized by this test package.
