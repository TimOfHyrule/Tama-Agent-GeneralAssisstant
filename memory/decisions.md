# Decisions

Choices made and why. The choice is usually recoverable from what exists; the
reason never is.

<!-- bin/memo appends below this line -->

## 2026-08-20 · The life memory and the build memory are separate spaces, read-across and write-own

Two repos, two Tamarada memory collections (see `memSpace.js`). Each reads
both and writes only its own.

The reason for reading across is that the useful notes are the crossing ones —
a broken pipeline explains a bad week, an absence explains a stalled build. The
reason for not writing across is that two agents editing one pot produces a
memory nobody trusts and nobody prunes.

**Known gap, deliberately accepted for now:** Tamarada cannot enforce the write
half. Page scoping is a single `pipeline_pages.appId` column matched exactly,
which gives sandboxed (sees only its own pages, so no cross-reading at all) or
full access (sees and writes everything). There is no read-only grant. So
cross-reading requires a full-access token, and the write rule lives in
`bin/mem` — a fence, not a wall.

The real fix is a per-app read grant so the filter becomes "owns it, or was
granted it". That changes `appScopeId`, which Project-Station's own CLAUDE.md
flags as a silent tenancy bug when it goes wrong, so it wants tests first and
its own sitting rather than being done on the way to something else.
