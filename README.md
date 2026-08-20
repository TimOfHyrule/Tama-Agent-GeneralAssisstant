# tama-life-assisstant

The life half of a pair. Open a Claude Code session on this repo and it helps
with the running of a day — what is on, what is waiting on whom, what was
decided — with a memory that survives between sessions.

[**Tama-Agent**](https://github.com/TimOfHyrule/Tama-Agent) is the other half:
it builds and operates the [Tamarada](https://github.com/TimOfHyrule/Project-Station)
install. Both read each other's memory; neither writes to the other's.

`CLAUDE.md` is what the agent reads. This file is for you.

## Why two repos and not one

Everything here except `CLAUDE.md`, `memSpace.js` and `memory/` is the same
code as the sibling repo. That duplication is the price of the split, and it
was paid on purpose.

A session boots with its repo's `CLAUDE.md` in context, every time. One repo
means one brief, and a brief that covers both jobs is a brief where half of it
is wrong for whatever you actually opened the session to do — 200 lines of API
contract in front of "what's on today", or the groceries in front of a build.
Nothing you can write in a single file fixes that, because the file is read
before anyone knows which job it is.

So the brief is what is genuinely different, and the tooling is copied.
`scripts/check.mjs` runs in both, which is what keeps the copies from drifting
apart quietly.

## Setup

```bash
export TAMARADA_URL=https://your-install.example.com
bin/tama login
```

It prints a code. Open Tamarada, go to **Setup → Agents**, type the code, and
choose how much access to give it. The terminal then prints a token to export
as `TAMARADA_KEY`.

**Which access to tick matters here, and the answer is different from the
sibling repo's.** See below.

In Claude Code on the web, put both values in the cloud environment's variables
rather than exporting them in a shell — a shell export does not survive between
sessions. Locally, a gitignored `.env` in the repo root works: the session-start
hook reads it and carries `TAMARADA_URL` and `TAMARADA_KEY` into the session.

## The memory split, and the thing it cannot enforce

Each agent owns one Tamarada collection and reads the other's:

| | writes | reads |
|---|---|---|
| Tama-Agent | `agent_memory` | `agent_memory`, `life_memory` |
| this repo | `life_memory` | `life_memory`, `agent_memory` |

`memSpace.js` in each repo is the whole configuration, and `bin/mem` is the
only thing that acts on it.

**Tamarada cannot hold the write half.** Its page scoping is a single
`pipeline_pages.appId` column, filtered with an exact match, which gives two
settings and no third:

- **sandboxed** — sees only pages it created. Cross-reading is *impossible*.
- **full access** — sees everything on the account, and can write all of it.

There is no read-only grant. So cross-reading requires a **full-access** token
for both agents, and "writes only its own" is enforced by `bin/mem` — a fence,
not a wall. It is a file in this repo; an agent that decided to route around it
could.

That is stated rather than hidden, and `scripts/check.mjs` holds the fence in
place: it fails if `bin/mem` ever writes to a collection that is not its own, if
it tries to *create* a peer's page (which would stamp this app as the owner and
lock the real one out), or if `memSpace.js` lists this repo as its own peer.

**If you would rather have the wall:** tick sandboxed on both, accept that
neither can read the other, and drop `PEERS` to `[]` in both `memSpace.js`
files. `bin/mem` will say `(not visible)` rather than pretending — but with an
empty peer list there is nothing to say.

The real fix is a per-app read grant in Tamarada so the filter becomes "owns it,
or was granted it". It is written up in `memory/decisions.md`, including why it
is not a quick change.

## The two memories

**Personal knowledge lives in Tamarada**, in a collection, reached with
`bin/mem`:

```bash
bin/mem                                    # read everything -- both spaces
bin/mem add fact     "..."                 # rarely changes
bin/mem add now      "..." [--for <days>]  # in flight; --for gives it an end date
bin/mem add decision "..."                 # what was chosen, and why
bin/mem forget <recordId>                  # this repo's notes only
bin/mem setup                              # once, to create the page and collection
```

**What recurs lives beside it**, as files on the same page, reached with
`bin/life`:

```bash
bin/life                                  # what's due, then every area, then the inbox
bin/life due                              # only what is due or overdue
bin/life in "牙醫要約"                     # drop anything at all into the inbox
bin/life drop 3                           # take line 3 back out
bin/life area add "健康"                   # make an area
bin/life task add 健康 "運動" --every 3d    # a recurring task in it (Nd | Nw | Nm)
bin/life did 健康 運動                      # stamp it done today
```

A note answers *is this still true?*; a task answers *when is it next due?*
"運動每三天" is true forever and never tells you whether today is the day, which
is why the cadence and the last-done date are a different container rather than
a better-worded note. The arithmetic is in `cadence.js` — no imports, `today`
passed in — so `scripts/check.mjs` can check it: a month is a month and not 30
days, and the month-end clamp stops a task set on the 31st walking forward
through the year one silent rollover at a time.

A SessionStart hook runs `bin/mem` before the agent's first message, so its
opening move is to show you what it thinks it knows and ask about anything gone
`[OLD]` or `[EXPIRED]`. It asks only about the stale ones — the version that
asks about everything works twice, and by the third session it is a wall of text
between you and whatever you opened the session for.

`bin/mem forget` on one of the *other* agent's notes refuses by name and tells
you which repo to do it in, rather than saying "no such note" about something
printed two lines above.

Read `docs/PERSONAL_MEMORY.md` before writing, especially the list of what must
never go in. That list bites harder here than in the sibling repo: a life
assistant is handed exactly that material — somebody's diagnosis, somebody's
pay, what a friend said in confidence — in the ordinary course of being useful.

**Operating knowledge stays in this repo**, in `memory/`, written with
`bin/memo <topic> "..."`. Technical, publishable, and what you need on hand
precisely when Tamarada is misbehaving — the one moment a Tamarada-backed memory
is no help at all. It syncs by git: pull before writing, push after.

## Keeping the contract current

```bash
scripts/sync-contract.sh          # update it
scripts/sync-contract.sh --check  # is it stale? exit 1 if so
```

`docs/AGENT_API.md` is generated in the Tamarada repo, and the copy here is a
copy of a copy. It matters more than a stale page normally would, because
**`bin/tama` reads this file** to decide which routes to refuse without
`--paid`. A route added since the last sync is not on the list, so the guard
waves it through — it fails in the direction that costs money, and quietly.

## Checks

```bash
node scripts/check.mjs             # no credential, no network
scripts/sync-contract.sh --check   # is the contract still what Tamarada generates?
```

CI runs the first on every push and weekly — weekly because the thing most
likely to break here is not a change in this repo, it is a route added in
Tamarada, which no push here would notice.

The contract check needs to reach Project-Station, which is private. Add a
repository secret named **`TAMARADA_REPO_TOKEN`** and the weekly run will tell
you when the copy here has drifted. Without the secret that step **skips rather
than fails** — a workflow that goes red for a missing secret just teaches
everyone that red is normal.
