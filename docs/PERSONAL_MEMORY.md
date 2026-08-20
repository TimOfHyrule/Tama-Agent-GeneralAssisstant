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
