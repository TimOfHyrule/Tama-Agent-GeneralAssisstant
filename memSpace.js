// Which memory this agent OWNS, and which it may READ.
//
// Zero imports on purpose: `bin/mem` reads it, `scripts/check.mjs` reads it,
// and a person changing the split reads it. One file, three readers, no
// machinery in between.
//
// ── Why there are two of these at all ────────────────────────────────────
//
// This repo is the life side. Tama-Agent drives the Tamarada install. They are
// separate repos because they are separate jobs -- a session that opens with
// "what's on today" should not boot with 200 lines of API contract, and a
// session that opens with "let's build the report" should not boot with the
// groceries.
//
// But they are not sealed off from each other, because the useful cases are
// exactly the crossing ones: "the nightly report broke" explains a bad mood,
// and "he is away next week" changes what is worth building. So each side
// READS both and WRITES one.
//
// ── What the platform can and cannot enforce ─────────────────────────────
//
// It cannot enforce the write half. Tamarada's page scoping is one column --
// `pipeline_pages.appId` -- and the filter is `appId = ?`, exact. That gives
// two settings and no third:
//
//   sandboxed (fullAccountAccess: false)  sees only pages it created.
//                                          Cross-reading is impossible.
//   full access                            sees everything in the account,
//                                          and can write all of it.
//
// So cross-reading REQUIRES full access, and full access means the write rule
// below is a fence rather than a wall: it lives in `bin/mem`, which is a file
// in this repo that the agent can read and could route around. That is an
// honest limit, not a hidden one -- it is written here, and in
// `memory/decisions.md`, so nobody discovers it by being surprised.
//
// The real fix is a per-app read grant in Tamarada, so `appId = ?` becomes
// "owns it, or was granted it". That is a change to `appScopeId`, which is
// the one thing Project-Station's own CLAUDE.md flags as a SILENT tenancy bug
// when it goes wrong. Worth doing deliberately, with tests first, and not on
// the way to something else.

// The one this agent writes to. `bin/mem add` and `bin/mem forget` touch
// nothing else, and `bin/mem setup` creates only this.
export const OWN = {
  page: 'Life memory',
  collection: 'life_memory',
  label: 'life',
};

// Read-only, for context. Adding one here grants no permission by itself --
// the token still has to be able to see it (see above), and `bin/mem` says so
// by name when it cannot rather than printing nothing.
export const PEERS = [
  {
    page: 'Agent memory',
    collection: 'agent_memory',
    label: 'build',
    // Named so a refusal can tell you where to go instead of just saying no.
    repo: 'Tama-Agent',
  },
];
