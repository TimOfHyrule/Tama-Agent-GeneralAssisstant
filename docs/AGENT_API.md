# Tamarada for an agent

**Generated. Do not edit.** `npm run agent-contract` rewrites this file and
`test/agentContract.test.js` fails when it drifts from the real routes.

This is the whole API surface, marked with the one distinction that costs
real money to get wrong.

## How to call it

```
Authorization: Bearer dos_...     an account key (every route)
X-App-Key: <key>                  optional; identifies a registered app
X-Tamarada-API: <version>         optional; refuses rather than half-working
Content-Type: application/json
```

An app registered WITHOUT `fullAccountAccess` sees only what it created —
the account's own pages, made in the UI, are invisible to it. That is the
sandbox to prefer for an agent; a full-access key can delete anything the
account owns.

## Money

There are TWO budgets here, and only one of them is what `$` marks.

**The account's Anthropic key.** 11 of 170 routes spend it. That is a bill
to whoever owns this Tamarada install, for work Tamarada does on its own
behalf — running a SOP step, drafting, summarising. This is the axis the
rest of this file is about.

**Your own plan's token allowance.** EVERY route spends this, because you are
the one calling it: reading the response, deciding what to do next and writing
the next request are all tokens off the Claude Code subscription driving this.

So "free" in this file always means **"does not touch the account's Anthropic
key"**, and never "costs nothing". A route without `$` is not an invitation to
call it in a loop, and telling somebody a build is free is wrong — it is billed
to a different budget, which is not the same thing.

The mistake this file exists to prevent: reaching for a drafting route to
"help" write a SOP. An agent can write the SOP itself and `PUT /api/sops/:name`
without spending the key — the drafting route bills the account to produce what
the agent was about to produce anyway.

| Route | Why it costs |
|---|---|
| `POST /api/agent-chat/messages` | calls sendAgentChatMessage |
| `POST /api/modules/:id/call` | calls callModule |
| `GET /api/pipeline-pages/:id/files/:name/summary` | calls callClaudeText |
| `POST /api/predict-sop` | calls runMetaAgent |
| `POST /api/queue` | calls enqueueRun |
| `PATCH /api/queue/:id` | calls processQueue |
| `POST /api/reports/:id/review-reply` | calls reviewReply |
| `POST /api/runs/:id/approve` | resumes a paused run, which continues spending |
| `PUT /api/runtime` | calls processQueue |
| `POST /api/schedules/:scheduleId/check-intent` | calls checkScheduleIntent |
| `POST /api/tools/pick` | calls pickTool |

## Every route

`$` marks a route that spends the account's Anthropic key. Everything else is
database work that bills nobody — though calling it still costs your own plan's
tokens, as above.

### /api/accounts

- `GET /api/accounts`
- `POST /api/accounts`
- `POST /api/accounts/:id/checkout-link`
- `POST /api/accounts/:id/grant`
- `PUT /api/accounts/:id/trial`
- `GET /api/accounts/me`
- `GET /api/accounts/me/balance`
- `PUT /api/accounts/me/credentials`
- `DELETE /api/accounts/me/credentials/:key`
- `GET /api/accounts/me/credits`
- `GET /api/accounts/me/recent-usage`
- `GET /api/accounts/me/sops`

### /api/admin

- `GET /api/admin/backup`

### /api/agent-chat

- `GET /api/agent-chat/activity`
- `POST /api/agent-chat/files`
- `DELETE /api/agent-chat/files/:id`
- `DELETE /api/agent-chat/messages`
- `GET /api/agent-chat/messages`
- `$` `POST /api/agent-chat/messages`
- `POST /api/agent-chat/messages/:id/apply`
- `POST /api/agent-chat/messages/:id/discard`
- `GET /api/agent-chat/proposals`

### /api/agent-tokens

- `GET /api/agent-tokens`
- `DELETE /api/agent-tokens/:id`

### /api/apps

- `GET /api/apps`
- `POST /api/apps`
- `DELETE /api/apps/:id`
- `PUT /api/apps/:id`
- `GET /api/apps/:id/products`
- `DELETE /api/apps/:id/products/:productId`
- `PUT /api/apps/:id/products/:productId`

### /api/auth

- `POST /api/auth/apple`
- `POST /api/auth/google`

### /api/billing

- `POST /api/billing/checkout`
- `GET /api/billing/plans`

### /api/blackbox

- `GET /api/blackbox/budget`
- `PUT /api/blackbox/budget`

### /api/collection-files

- `GET /api/collection-files/:fileId`

### /api/collections

- `DELETE /api/collections/:id`
- `GET /api/collections/:id`
- `POST /api/collections/:id/files`
- `POST /api/collections/:id/migrate`
- `POST /api/collections/:id/migrate/plan`
- `GET /api/collections/:id/records`
- `POST /api/collections/:id/records`
- `GET /api/collections/:id/records/log`
- `PUT /api/collections/:id/schema`
- `GET /api/collections/:id/schema/log`
- `POST /api/collections/:id/schema/preview`

### /api/credentials

- `GET /api/credentials/catalog`

### /api/device

- `POST /api/device/approve`
- `POST /api/device/collect`
- `POST /api/device/deny`
- `POST /api/device/describe`
- `POST /api/device/request`

### /api/growth

- `DELETE /api/growth/exclusions`
- `GET /api/growth/exclusions`
- `POST /api/growth/exclusions`
- `GET /api/growth/trial-funnel`

### /api/modules

- `GET /api/modules`
- `POST /api/modules`
- `DELETE /api/modules/:id`
- `GET /api/modules/:id`
- `PUT /api/modules/:id`
- `GET /api/modules/:id/actions`
- `POST /api/modules/:id/actions`
- `$` `POST /api/modules/:id/call`
- `GET /api/modules/:id/data`
- `PUT /api/modules/:id/data`

### /api/packages

- `GET /api/packages`
- `DELETE /api/packages/:id`
- `POST /api/packages/:id/install`

### /api/pipeline-pages

- `GET /api/pipeline-pages`
- `POST /api/pipeline-pages`
- `DELETE /api/pipeline-pages/:id`
- `PUT /api/pipeline-pages/:id`
- `GET /api/pipeline-pages/:id/blocks`
- `PUT /api/pipeline-pages/:id/blocks`
- `GET /api/pipeline-pages/:id/blocks/log`
- `POST /api/pipeline-pages/:id/blocks/restore/:logId`
- `GET /api/pipeline-pages/:id/collections`
- `POST /api/pipeline-pages/:id/collections`
- `GET /api/pipeline-pages/:id/data/log`
- `GET /api/pipeline-pages/:id/files`
- `DELETE /api/pipeline-pages/:id/files/:name`
- `GET /api/pipeline-pages/:id/files/:name`
- `PUT /api/pipeline-pages/:id/files/:name`
- `GET /api/pipeline-pages/:id/files/:name/log`
- `$` `GET /api/pipeline-pages/:id/files/:name/summary`
- `GET /api/pipeline-pages/:id/readiness`
- `GET /api/pipeline-pages/:id/requirements`
- `POST /api/pipeline-pages/:id/schedules/enable`
- `GET /api/pipeline-pages/:id/todos`
- `POST /api/pipeline-pages/:id/todos`
- `DELETE /api/pipeline-pages/:id/todos/:todoId`
- `PUT /api/pipeline-pages/:id/todos/:todoId`
- `POST /api/pipeline-pages/:id/triggers/enable`

### /api/plugins

- `GET /api/plugins`

### /api/predict-sop

- `$` `POST /api/predict-sop`

### /api/pricing

- `GET /api/pricing`

### /api/queue

- `GET /api/queue`
- `$` `POST /api/queue`
- `DELETE /api/queue/:id`
- `$` `PATCH /api/queue/:id`
- `POST /api/queue/reorder`

### /api/records

- `DELETE /api/records/:id`
- `PUT /api/records/:id`
- `POST /api/records/:id/restore`

### /api/reports

- `GET /api/reports`
- `PATCH /api/reports/:id`
- `$` `POST /api/reports/:id/review-reply`
- `GET /api/reports/mine`

### /api/rules

- `POST /api/rules/:ruleId/resume`
- `GET /api/rules/state`

### /api/runs

- `GET /api/runs`
- `GET /api/runs/:id`
- `$` `POST /api/runs/:id/approve`
- `POST /api/runs/:id/close`
- `POST /api/runs/:id/fail`
- `POST /api/runs/:id/reject`
- `POST /api/runs/:id/reopen`
- `GET /api/runs/:id/stream`

### /api/runtime

- `GET /api/runtime`
- `$` `PUT /api/runtime`

### /api/saas

- `GET /api/saas/auth-config`

### /api/saas-packages

- `GET /api/saas-packages`
- `DELETE /api/saas-packages/:id`
- `POST /api/saas-packages/:id/install`
- `GET /api/saas-packages/installed`

### /api/schedules

- `$` `POST /api/schedules/:scheduleId/check-intent`
- `POST /api/schedules/:scheduleId/resume`
- `GET /api/schedules/state`

### /api/screenshots

- `GET /api/screenshots/folders`
- `POST /api/screenshots/upload`

### /api/settings

- `GET /api/settings`
- `PUT /api/settings`

### /api/sops

- `GET /api/sops`
- `DELETE /api/sops/:name`
- `GET /api/sops/:name`
- `PUT /api/sops/:name`
- `GET /api/sops/:name/backup`
- `POST /api/sops/:name/restore`

### /api/store

- `GET /api/store`
- `POST /api/store/install-listing`
- `POST /api/store/install-page`
- `GET /api/store/listings/:listingId/requirements`
- `POST /api/store/publish`
- `POST /api/store/rent`

### /api/stripe

- `POST /api/stripe/webhook`

### /api/system-messages

- `GET /api/system-messages`
- `POST /api/system-messages/read`

### /api/tasks

- `GET /api/tasks`
- `POST /api/tasks`
- `DELETE /api/tasks/:name`
- `GET /api/tasks/:name`
- `PUT /api/tasks/:name`
- `POST /api/tasks/:name/duplicate`
- `GET /api/tasks/:name/last-run`
- `POST /api/tasks/:name/rename`
- `GET /api/tasks/meta`
- `GET /api/tasks/screenshot-ready`

### /api/timeouts

- `GET /api/timeouts`
- `PUT /api/timeouts`

### /api/tools

- `GET /api/tools`
- `$` `POST /api/tools/pick`

### /api/trials

- `GET /api/trials/default`

### /api/triggers

- `POST /api/triggers/:triggerId/claims/:runId/discard`
- `POST /api/triggers/:triggerId/resume`
- `GET /api/triggers/state`

### /api/version

- `GET /api/version`

## What the money list can and cannot see

It is read out of `server.js` by following names, so it sees a handler that
calls something that calls a model, however many hops down, and it sees the
BYOK gate that admits a run. Comments are stripped first — this codebase
names expensive functions while explaining them, and a comment is not a call.

What it cannot see, and the reason this section exists rather than a claim of
completeness:

- **Anything reached dynamically.** A tool loaded by `import()`, or a name
  assembled at runtime, is invisible the same way it is to the reachability
  audit.
- **Work already suspended.** A paused run continues inside a Promise, so the
  route that resumes it spends without naming anything. `gate.resolve` is
  detected for that reason; treat any route that unblocks a run as spending.
- **What it costs.** Only whether, never how much. A one-step SOP and one
  that loops over 200 records are the same entry here.

When in doubt, assume a route that makes something HAPPEN spends, and that a
route that only reads does not.

## What this file cannot tell you

Request and response shapes. They are not derived here because a shape
guessed from a handler would be wrong in ways nothing would catch — read
the handler in `server.js`, which is one grep away and always true.

It also does not describe the SOP step vocabulary. That has its own
contract, `sopContract.js`, which is the only description of it that exists
and states its own limits.

## One thing to know before writing

In the UI, the assistant PROPOSES and a person APPLIES — enforced, not a
convention (`assistant/boundary.js`). An account key calling these routes
bypasses that entirely: writes land immediately, with no preview and nobody
approving them. Record writes carry a `source`, so `record_log` shows what
an agent did; module and SOP writes do not.
