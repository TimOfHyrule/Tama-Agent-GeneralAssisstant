# Personal memory

Personal knowledge lives **in Tamarada**, in a collection, reached with
`bin/mem`. Not in this repo. This file is the rule for what goes in it.

```bash
bin/mem                                    # read it all -- do this first, every session
bin/mem add fact     "..."                 # rarely changes
bin/mem add now      "..." [--for <days>]  # in flight
bin/mem add decision "..."                 # what was chosen, and why
bin/mem forget <recordId>
```

## Signing in, once

A session with no `TAMARADA_KEY` asks for a code by itself and hands it to you —
you type it at **Setup → Agents**, and it prints back a token to put in the
cloud environment settings as `TAMARADA_KEY`.

**Approve it without ticking full access.** A sandboxed token can only see the
pages it creates itself, so the first session runs `bin/mem setup` and the agent
ends up with its own memory page and no view of anything else in the account.
You still read and edit that page normally in the UI — your own login sees every
page, sandboxed or not. Full access works too and is strictly worse.

So "not set up yet" on the first session after signing in is the expected state,
not a fault.

## Why it is not in this repo

It started as `company/*.md` here, and moved for one reason that no amount of
care in the files could fix: **git history is permanent**. Deleting a file in a
later commit does not remove it — it stays in the history, in every clone, on
every machine that ever pulled. That makes a git repo a one-way door for
anything private, and personal knowledge is exactly the thing you want to be
able to take back.

As account data it is private by construction, it never touches a commit, and
two things fall out that files could not give:

- **A person can read and edit it.** It is a collection, so it renders as a
  table in the product. Pruning is deleting a row, not opening markdown in a
  terminal.
- **Deleting is recoverable.** `record_log` outlives the record, so a note
  removed in haste is still readable.

The trade, stated plainly: **it needs Tamarada reachable.** Files did not.
That is why the technical half of the memory stayed in git — see
`memory/README.md`. The day you most need to remember how this API behaves is
the day the API is not behaving, and a memory that is unreachable exactly when
things break is not a memory. Personal knowledge does not have that property:
if Tamarada is down, nothing about the company is what you are working on.

## The axis: how long is this true for?

`memory/README.md` says *write down only what cannot be looked up*, because
Tamarada already knows what pages and modules exist and a note repeating it
goes stale. That rule does real filtering there.

Here it filters nothing. Almost nothing about a company can be looked up
anywhere, so "cannot be looked up" would admit everything, and this becomes a
pile that grows until nobody — human or agent — reads it. So the axis is
different:

| kind | What | How it is read |
|---|---|---|
| `fact` | Rarely changes. What the company is, who it is for, standing policy. | Every session |
| `now` | Changes weekly. What is in flight, what is waiting, on whom. | Every session |
| `decision` | Never changes. What was decided and why. | Looked up when a question comes back around |

`--for <days>` is offered on `now` and nowhere else, because "is this still
true?" is only a question about something in flight. A fact that expires is not
a fact.

## The other half: what recurs, and what has not been sorted yet

Notes answer *is this still true?* That is the wrong question about a chore.
"運動每三天" is true the day it is written and true a year later, and neither
time does it tell you whether today is the day. A chore has a **cadence** and a
**last-done date**, and what you want from it is arithmetic — so it is not a
note.

`bin/life` is that half. Same page in Tamarada, different container: page files
rather than collection rows, because an area *owns* its tasks and the useful
read is "everything in 健康", not "every task in the account". The platform
stamps a `page_data_log` row on every write, so an area's history is already
there without a schema for it.

| | Holds | Kept by |
|---|---|---|
| `life_memory` collection | what is **true** | `bin/mem` |
| `inbox.md` | what has **not been sorted** yet | `bin/life in` |
| `area.<name>.json` | what **recurs**, per area | `bin/life task` |

The line between the two, when it is not obvious: if the answer to *is this
still true?* is what matters, it is a note. If the answer to *when is it next
due?* is what matters, it is a task.

### Everything it does

```
bin/life                                  what's due, then every area, then the inbox
bin/life due                              only what is due or overdue
bin/life in "牙醫要約"                     drop anything at all into the inbox
bin/life drop 3                           take line 3 back out
bin/life area add "健康"                   make an area
bin/life area rm "健康"                    remove an empty one
bin/life task add 健康 "運動" --every 3d    a recurring task in that area
bin/life task rm 健康 "運動"
bin/life did 健康 運動                      stamp it done today
```

`--every` takes `Nd`, `Nw` or `Nm` — days, weeks, months. Months are stored as
months rather than flattened to 30 days, because 月底繳費 flattened to days
drifts a day earlier every month until it lands in the wrong one. The month
arithmetic clamps, so the 31st plus one month is the 28th and not the 3rd.

**A task that has never been done is due today.** The alternative — due one
cadence after it was created — hides a brand-new task for a week, and the
reason somebody writes one down is that it is on their mind right now.

### Why the inbox is not just more notes

It is the one place with no shape at all, and that is the point: a thing you
have not decided about yet cannot be filed, and being made to choose `fact` /
`now` / `decision` before you can write it down is what stops it being written
down. It is dated on the way in, and it is meant to be emptied — into a note,
into a task, or into `bin/life drop` because it stopped mattering.

### What a 6am session actually sees

`bin/life due` and nothing else. The areas and the inbox are a full read
somebody asks for; pasting all of it into every session is how a morning
message becomes something to scroll past. The hook in
`scripts/sessionMemory.mjs` makes that call, and `scripts/check.mjs` fails if
it ever stops — a tool that still works perfectly while the feature silently
disappears is the failure this repo keeps rediscovering.

Nothing is ever stamped done on your behalf. `bin/life did` is one call and it
is yours to ask for; an agent that closes out chores it did not watch you do
produces a task list that is confidently wrong.

## Two things the platform now enforces that used to be rules here

Both were prose plus a CI check when this was files. Neither is any more, and
the checks were deleted rather than ported.

**Every `now` entry is dated.** An undated *"waiting on the supplier"* is true
the day it is written and indistinguishable from true a year later. Tamarada
stamps `createdAt` on every record, so the date cannot be forgotten and — unlike
one typed into the text — cannot be wrong. `bin/mem` marks a `now` note `[OLD]`
past 30 days when it carries no explicit expiry, and `[EXPIRED]` past its own
date. Neither hides it: a note that vanished would read as one never written.

**Keeping it short enough to actually read.** The files had a 200-line budget
across the always-read ones, because past a certain size an agent reads *part*
of a file and answers confidently from half the picture. That budget is gone,
not because the failure went away but because the shape did: notes are rows, so
pruning is per-note rather than per-file, expiry does some of it unprompted, and
the read-back groups by kind instead of concatenating. If `bin/mem` ever gets
long enough to skim, that is the signal to prune — and prune it, rather than
letting a session start by reading something it will not finish.

## What must never go in here

Weaker than it was, because two of the three original reasons were about git and
no longer apply. What remains still applies, and one of them is the whole reason
the read-back is short:

**All of it goes into a model's context at the start of a session.** So:

- **Credentials.** Keys, passwords, tokens. There is never a reason — the agent
  reads its own from the environment.
- **Personal data about identifiable people.** Customers' details; an
  employee's pay, performance, health, or personal circumstances. Roles and
  responsibilities are fine — *"Tim decides pricing"* is operating knowledge.
  *"Tim is off sick until March"* is not.
- **Anything under an obligation to somebody else.** Terms marked confidential,
  another company's data, anything under an NDA. Private storage is not the same
  as permission to store it.
- **The full text of anything with a canonical home.** Link to the contract, the
  invoice, the doc. A copy here is a second version that will disagree with the
  first, and nobody will know which is real.

When something is genuinely needed but does not belong here, write the pointer
rather than the content: *"pricing agreed with X — see the signed PDF in Drive"*.
