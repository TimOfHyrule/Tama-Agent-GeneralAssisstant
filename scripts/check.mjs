#!/usr/bin/env node
// The invariants this repo can check on its own, with no credential and no
// network. Run locally or in CI: `node scripts/check.mjs`.
//
// ── What is worth checking here ──────────────────────────────────────────
//
// Not "is the contract current" -- that needs to reach the Tamarada repo,
// which is private, so it needs a token (see .github/workflows/check.yml).
// What CAN be checked without one is more interesting anyway: whether the
// machinery that USES these files still works on them.
//
// bin/tama refuses paid routes by parsing docs/AGENT_API.md, and bin/memo
// appends by finding a marker in memory/*.md. Both are text-matching a file
// they do not own. If either stops matching, nothing throws -- the guard
// simply refuses nothing, and the memo simply writes nowhere. Those are the
// failures worth a check, because they are the ones that look like success.
//
// bin/mem is checked more thinly on purpose: what it talks to is Tamarada, not
// a file in here, so most of what could go wrong needs a credential and a
// network. What IS checkable is the same shape as the above -- whether its
// documentation still describes the tool.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m) => { console.error(`  FAIL ${m}`); failed++; };
// Worth saying, not worth failing over. Used for the things a check cannot
// fix and history cannot be rewritten to satisfy -- a rule that fails forever
// on commits already made is a rule people learn to scroll past, taking the
// real failures with it.
const note = (m) => console.log(`  note ${m}`);

// ── bin/tama's guard still finds the paid routes ────────────────────────
{
  const wrapper = rd('bin/tama');
  const doc = rd('docs/AGENT_API.md');
  // Lifted from the wrapper's own source rather than retyped, so this cannot
  // pass while the real one fails.
  const m = wrapper.match(/matchAll\(\/(\^- .*?)\/gm\)/);
  if (!m) {
    bad('bin/tama: could not find its paid-route pattern (did the parsing change?)');
  } else {
    const found = [...doc.matchAll(new RegExp(m[1], 'gm'))];
    if (found.length === 0) {
      bad('bin/tama: its pattern matches NOTHING in docs/AGENT_API.md -- the guard is off, and would refuse nothing');
    } else if (!found.every((x) => /^[A-Z]+$/.test(x[1]) && x[2].startsWith('/api/'))) {
      bad('bin/tama: its pattern matched something that is not a route');
    } else {
      ok(`bin/tama would refuse ${found.length} paid route(s)`);
    }
  }
}

// ── The contract still says which routes cost money ─────────────────────
{
  const doc = rd('docs/AGENT_API.md');
  // Matches the Money section's count line. It has been reworded once already
  // -- "N of M routes can spend the account's Anthropic key" became "**The
  // account's Anthropic key.** N of M routes spend it" when the section grew a
  // second budget -- and this check went red rather than silently passing on a
  // file it no longer understood, which is the entire point of it.
  const claim = doc.match(/(\d+) of (\d+) routes spend it/);
  if (!claim) bad('docs/AGENT_API.md: no "N of M routes can spend" line -- is this really the generated file?');
  else if (Number(claim[1]) === 0) bad('docs/AGENT_API.md: says NO route costs money, which cannot be right');
  else if (Number(claim[1]) >= Number(claim[2]) / 4) bad(`docs/AGENT_API.md: ${claim[1]} of ${claim[2]} marked paid -- too many to be right`);
  else ok(`contract marks ${claim[1]} of ${claim[2]} routes as spending`);
}

// ── bin/memo can still find where to append ─────────────────────────────
{
  const marker = (rd('bin/memo').match(/const MARKER = '([^']+)'/) || [])[1];
  if (!marker) {
    bad('bin/memo: could not find its append marker constant');
  } else {
    const topics = [];
    const dir = path.join(ROOT, 'memory');
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      if (f.endsWith('.md') && f !== 'README.md') topics.push(`memory/${f}`);
    }
    const missing = topics.filter((f) => !rd(f).includes(marker));
    if (missing.length) bad(`bin/memo: no append marker in ${missing.join(', ')} -- notes there would fail to write`);
    else ok(`bin/memo can append to ${topics.length} topic(s)`);
  }
}

// ── bin/mem and its documentation agree on the kinds ────────────────
//
// The same class of failure as bin/tama above: a doc text-matching a tool it
// does not own. docs/PERSONAL_MEMORY.md tells the reader which kinds exist, and
// bin/mem rejects anything else ── so a kind added to one and not the other is
// either a documented command that errors, or a working one nobody knows about.
{
  const mem = rd('bin/mem');
  const m = mem.match(/if \(!\[([^\]]+)\]\.includes\(kind\)\)/);
  if (!m) {
    bad('bin/mem: could not find the list of kinds it accepts');
  } else {
    const kinds = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
    const doc = rd('docs/PERSONAL_MEMORY.md');
    const undocumented = kinds.filter((k) => !doc.includes(`\`${k}\``));
    if (undocumented.length) bad(`bin/mem accepts ${undocumented.join(', ')}, which docs/PERSONAL_MEMORY.md never mentions`);
    else ok(`bin/mem's ${kinds.length} kinds are all documented`);
  }
}

// ── One memory is written, the rest are only read ───────────────────
//
// memSpace.js splits the account's memory between agents: this repo owns one
// space and READS the others. The platform cannot hold that line -- Tamarada's
// page scoping is a single owner column with an exact-match filter, so a token
// that can see a peer at all can also write to it (memSpace.js has the full
// argument). The rule therefore lives in bin/mem, which makes it exactly the
// kind of invariant this file exists for: true because of how the code is
// written, and quietly false the moment somebody adds a convenient flag.
//
// A violation would not throw. `bin/mem add --to life` would simply work, and
// two agents would start editing one pot -- which is the failure the split was
// created to prevent, arriving through the door marked helpful.
{
  const mem = rd('bin/mem');
  let space;
  try { space = await import(path.join(ROOT, 'memSpace.js')); }
  catch (e) { bad(`memSpace.js will not load: ${e.message}`); }

  if (!mem.includes("from '../memSpace.js'")) {
    bad('bin/mem does not import memSpace.js -- whatever it writes to, it is not the configured space');
  } else ok('bin/mem reads its space from memSpace.js');

  if (space) {
    const { OWN, PEERS = [] } = space;
    const named = (s, where) => ['page', 'collection', 'label']
      .filter((k) => !s?.[k]).map((k) => `${where}.${k}`);
    const gaps = [
      ...named(OWN, 'OWN'),
      ...PEERS.flatMap((p, i) => [...named(p, `PEERS[${i}]`), ...(p?.repo ? [] : [`PEERS[${i}].repo`])]),
    ];
    // PEERS[].repo is not decoration: bin/mem's refusal on a peer's note names
    // the repo to go and do it in. Missing, that message reads "Forget it from
    // the undefined repo instead", which is worse than no message because it
    // looks like a bug in the tool rather than a gap in the config.
    if (gaps.length) bad(`memSpace.js is missing ${gaps.join(', ')}`);
    else ok(`memSpace.js: owns ${OWN.collection}, reads ${PEERS.length} peer(s)`);

    // Listing yourself as your own peer reads the same rows twice and, worse,
    // makes `bin/mem forget` refuse your own notes by pointing you at your own
    // repo -- a loop that is obvious in hindsight and baffling at the time.
    const dupes = [OWN, ...PEERS].map((s) => s?.collection).filter(Boolean);
    if (new Set(dupes).size !== dupes.length) bad('memSpace.js: a collection appears twice -- is this repo listed as its own peer?');
    else ok('memSpace.js: every space is distinct');
  }

  // The write half. Every api() call that is not a GET must go to OUR
  // collection: `mine.collectionId`, or /api/records/<id> for a record already
  // fetched from it. A peer's id reaching a write is the whole failure.
  const writes = [...mem.matchAll(/api\('(POST|PUT|PATCH|DELETE)',\s*`([^`]*)`/g)];
  const strayed = writes.filter(([, , route]) =>
    /\$\{(?!mine\.)[A-Za-z_$][\w$]*\.collectionId\}/.test(route));
  if (strayed.length) {
    bad(`bin/mem writes to a collection that is not its own: ${strayed.map((m) => m[2]).join(', ')}`);
  } else ok(`bin/mem's ${writes.length} write(s) all target its own space`);

  // Creating a peer's page from here would stamp THIS app as its owner
  // (createPipelinePage takes the calling app), locking the real owner out
  // under a sandboxed token. Setting up somebody else's memory looks like a
  // favour and is a silent takeover.
  const creates = [...mem.matchAll(/locate\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{[^}]*create:\s*true/g)];
  const wrong = creates.filter(([, arg]) => arg !== 'OWN');
  if (wrong.length) bad(`bin/mem creates a space it does not own: locate(${wrong.map((m) => m[1]).join(', ')})`);
  else ok('bin/mem only ever creates its own space');
}

// ── The cadence arithmetic is right ─────────────────────────────────
//
// The only thing in this repo with a right answer that a person cannot see by
// reading it. Everything else here checks that two files still agree; this
// checks a computation, because the way it goes wrong is silent and slow: a
// monthly task set on the 31st walks forward through the year one rollover at
// a time, and the list stays plausible the whole way.
//
// cadence.js imports nothing and takes `today` as an argument precisely so
// this block can exist -- arithmetic that asks the clock itself can only be
// checked by moving the clock.
{
  const { parseEvery, nextDue, daysUntil } = await import(path.join(ROOT, 'cadence.js'));
  const cases = [
    // [what, lastDone, every, expected]
    ['3 days', '2026-08-18', '3d', '2026-08-21'],
    ['2 weeks', '2026-08-01', '2w', '2026-08-15'],
    ['1 month, ordinary', '2026-08-15', '1m', '2026-09-15'],
    // The whole reason this file is separate. Date rolls Jan 31 + 1 month over
    // into March without a word; clamped, it is the last day of February.
    ['month-end clamp', '2026-01-31', '1m', '2026-02-28'],
    ['month-end clamp, leap year', '2028-01-31', '1m', '2028-02-29'],
    ['across a year boundary', '2026-12-20', '1m', '2027-01-20'],
    // A task never done is due today, whatever today is -- not one cadence
    // after it was created.
    ['never done', null, '7d', '2026-08-20'],
    // A cadence that will not parse must not silently become "never due".
    ['unparseable cadence', '2026-08-01', 'weekly', '2026-08-20'],
  ];
  const wrong = cases.filter(([, lastDone, every, want]) =>
    nextDue({ lastDone, every }, '2026-08-20') !== want);
  if (wrong.length) {
    for (const [what, lastDone, every, want] of wrong) {
      bad(`cadence: ${what} -- ${lastDone} + ${every} gave ${nextDue({ lastDone, every }, '2026-08-20')}, want ${want}`);
    }
  } else ok(`cadence: ${cases.length} due-date cases correct`);

  // Rejected, not coerced. `--every week` reaching the file as a cadence that
  // never comes due is the failure bin/mem already had once with `--for`.
  const junk = ['week', '', '0d', '-3d', '3', '3y', null, '1.5m'];
  const accepted = junk.filter((j) => parseEvery(j) !== null);
  if (accepted.length) bad(`cadence: parseEvery accepted ${accepted.map((x) => JSON.stringify(x)).join(', ')}`);
  else ok(`cadence: ${junk.length} malformed cadences all rejected`);

  if (daysUntil('2026-08-18', '2026-08-20') !== -2) bad('cadence: overdue should be negative days');
  else if (daysUntil('2026-08-20', '2026-08-20') !== 0) bad('cadence: due today should be 0 days');
  else ok('cadence: overdue reads negative, due today reads zero');
}

// ── bin/life writes to our page and nowhere else ────────────────────
//
// The same rule bin/mem holds for the collection, for the same reason and with
// the same absence of enforcement underneath it: a token that can see a peer's
// page can write to it, so "areas are ours" is true because of how this file
// is written and would go quietly false the moment a write learned to take a
// page id from somewhere else.
//
// It is checked structurally rather than by reading intent: `PAGE` is resolved
// once, from OWN.page, and every non-GET route must interpolate exactly that.
// A write to `${somePage}` would still run, still succeed, and put this
// agent's chores on somebody else's page.
{
  const life = rd('bin/life');

  if (!life.includes("from '../memSpace.js'")) {
    bad('bin/life does not import memSpace.js -- whatever page it writes to, it is not the configured one');
  } else ok('bin/life reads its space from memSpace.js');

  // The one place a page id is allowed to come from.
  if (!/const PAGE = await page\(\)/.test(life) || !/x\.name === OWN\.page/.test(life)) {
    bad('bin/life: PAGE is no longer resolved from OWN.page -- the write rule has nothing to stand on');
  } else ok('bin/life resolves its page from OWN.page');

  const writes = [...life.matchAll(/api\('(POST|PUT|PATCH|DELETE)',\s*`([^`]*)`/g)];
  if (!writes.length) {
    bad('bin/life: no writes found at all -- did the call shape change? This check would then guard nothing');
  } else {
    const strayed = writes.filter(([, , route]) => !route.includes('${PAGE}'));
    if (strayed.length) bad(`bin/life writes outside its own page: ${strayed.map((m) => m[2]).join(', ')}`);
    else ok(`bin/life's ${writes.length} write(s) all target its own page`);
  }
}

// ── bin/life and its documentation agree on the commands ────────────
//
// Same failure as bin/mem's kinds: a command in one and not the other is
// either a documented command that errors, or a working one nobody knows
// exists. The list is lifted from the tool's own refusal message, which is the
// only place that enumerates them for real.
{
  const life = rd('bin/life');
  const m = life.match(/No such command "\$\{cmd\}"\. Try: ([^`]+?), or nothing at all/);
  if (!m) {
    bad('bin/life: could not find the list of commands it accepts');
  } else {
    const cmds = m[1].split(',').map((c) => c.trim()).filter(Boolean);
    const doc = rd('docs/PERSONAL_MEMORY.md');
    const undocumented = cmds.filter((c) => !doc.includes(`bin/life ${c}`));
    if (undocumented.length) bad(`bin/life accepts ${undocumented.join(', ')}, which docs/PERSONAL_MEMORY.md never shows`);
    else ok(`bin/life's ${cmds.length} commands are all documented`);
  }
}

// ── The morning brief still reaches for the due list ────────────────
//
// bin/life exists so that a 6am session opens with what is due. That only
// happens because sessionMemory.mjs runs it; nothing else does. If that call
// is removed or renamed, every command here keeps working perfectly and the
// tasks simply stop being mentioned -- a tool that is fine and a feature that
// is gone, with nothing in between to notice.
{
  const hook = rd('scripts/sessionMemory.mjs');
  if (!/bin\/life'\), \['due'\]/.test(hook)) {
    bad('scripts/sessionMemory.mjs no longer runs `bin/life due` -- sessions would never hear what is due');
  } else ok('the session-start hook asks bin/life what is due');
}

// ── The session-start hook is still wired up ────────────────────────
//
// The same shape as everything else here: .claude/settings.json names a script
// by PATH, and nothing anywhere resolves that name until a session starts. Move
// or rename the file and no error appears -- the hook simply does not run, and
// every session quietly begins with no personal memory while looking completely
// normal. That is the one failure mode this repo keeps rediscovering, so it
// gets a check rather than a convention.
{
  let settings;
  try { settings = JSON.parse(rd('.claude/settings.json')); }
  catch (e) { settings = null; bad(`.claude/settings.json: ${e.message}`); }
  if (settings) {
    const cmds = (settings.hooks?.SessionStart ?? []).flatMap((g) => g.hooks ?? []).map((h) => h.command ?? '');
    if (!cmds.length) {
      bad('.claude/settings.json: no SessionStart hook -- sessions would start with no personal memory');
    } else {
      // $CLAUDE_PROJECT_DIR is the repo root at run time, so stripping it
      // gives a path this script can actually check for.
      const missing = cmds
        .map((c) => c.replace(/^\$(\{)?CLAUDE_PROJECT_DIR(\})?\//, ''))
        .filter((c) => !fs.existsSync(path.join(ROOT, c)));
      if (missing.length) bad(`SessionStart hook points at ${missing.join(', ')}, which does not exist`);
      else ok(`SessionStart hook resolves to ${cmds.length} script(s) that exist`);
    }
  }

  // And the hook is only useful if the OS will run it.
  const hook = '.claude/hooks/session-start.sh';
  if (fs.existsSync(path.join(ROOT, hook))) {
    if (!(fs.statSync(path.join(ROOT, hook)).mode & 0o111)) {
      bad(`${hook} is not executable -- git tracks the bit, and without it the hook silently does not run`);
    } else ok('the hook is executable');
  }

  // The hook hands the session a block the agent is told to look for by name.
  // If one side is reworded, the instruction in CLAUDE.md sends somebody
  // hunting for a string that is never emitted.
  const marker = 'PERSONAL MEMORY';
  if (!rd('scripts/sessionMemory.mjs').includes(marker)) bad(`scripts/sessionMemory.mjs no longer emits "${marker}"`);
  else if (!rd('CLAUDE.md').includes(marker)) bad(`CLAUDE.md no longer mentions "${marker}", which the hook emits`);
  else ok(`hook and CLAUDE.md agree on the "${marker}" marker`);
}

// ── Nothing tells the agent to print the key ────────────────────────
//
// The leak check below catches a key that is already in a tracked file. This
// catches the instruction that would put one there. `echo $TAMARADA_KEY` is
// the natural way to "check it is set", and it writes the credential into a
// transcript that can be shared publicly from a Pro or Max account -- so the
// documented way to check has to test for the variable without printing it,
// and no file here may demonstrate otherwise.
{
  const tracked = fs.readdirSync(ROOT, { recursive: true })
    .filter((f) => typeof f === 'string' && !f.startsWith('.git/') && !f.startsWith('node_modules'))
    .filter((f) => fs.statSync(path.join(ROOT, f)).isFile());
  const echoes = tracked.filter((f) => {
    if (f === 'scripts/check.mjs') return false; // this check names the pattern
    // Printing the VALUE. `[ -n "$TAMARADA_KEY" ]` and `${TAMARADA_KEY:+set}`
    // are the safe forms and must keep passing, so the match is on echo/print
    // reaching a bare expansion.
    return /(echo|printf|console\.log)[^\n]*\$\{?TAMARADA_KEY\}?(?![:+])/.test(rd(f));
  });
  if (echoes.length) bad(`${echoes.join(', ')} prints the key's value -- a shared transcript keeps it for ever`);
  else ok('nothing here prints the key itself');
}

// ── The two behavioural rules are still in CLAUDE.md ────────────────
//
// Both exist because a session did the wrong thing in front of the person who
// owns this install: one answered "introduce Tamarada" with a six-section
// audit, the other could have echoed a credential into a shareable transcript.
// Neither rule is enforceable by anything else here, so the least this can do
// is notice if the text goes missing in an edit.
{
  const md = rd('CLAUDE.md');
  const missing = [
    ['brevity', 'Answer the question that was asked'],
    ['key handling', 'Never print the key itself'],
    ['audience', 'Who you are talking to'],
    // The one this repo has and the sibling does not. A life assistant is
    // handed the material the memory rules forbid -- somebody's diagnosis,
    // somebody's pay, what a friend said in confidence -- in the normal course
    // of being useful. Losing this section in an edit would not break
    // anything, which is exactly why it needs a check rather than care.
    ['scope of action', 'What you may decide, and what you may not'],
  ].filter(([, marker]) => !md.includes(marker));
  if (missing.length) bad(`CLAUDE.md lost the ${missing.map(([n]) => n).join(' and ')} rule(s)`);
  else ok('CLAUDE.md still carries the brevity, key-handling and scope rules');
}

// ── Commits still say which agent made them ─────────────────────────
//
// Three agents commit to this account, all under the same name and email
// because all three authenticate as the same human. Without a trailer, `git
// log --author` returns every one of them and "who changed this" has no
// answer at all. The rule is one line in a commit message, which is exactly
// the kind of rule that quietly stops being followed -- so the file that
// states it is checked, and the last commits are checked against it.
{
  const md = rd('CLAUDE.md');
  if (!md.includes('Agent: tama-life')) {
    bad('CLAUDE.md no longer tells the agent to sign commits with `Agent: tama-life`');
  } else ok('CLAUDE.md still asks for the Agent trailer');

  // Advisory, not fatal: history is not rewritable to fix this, and a check
  // that fails forever on old commits is a check people learn to ignore.
  try {
    const recent = execFileSync('git', ['log', '-8', '--format=%H%x00%B%x01'], { cwd: ROOT, encoding: 'utf8' })
      .split('\u0001').map((c) => c.trim()).filter(Boolean);
    const unsigned = recent.filter((c) => !/^Agent: [a-z-]+$/m.test(c)).length;
    if (unsigned === recent.length && recent.length) {
      note(`none of the last ${recent.length} commits carry an \`Agent:\` trailer`);
    } else if (unsigned) {
      note(`${unsigned} of the last ${recent.length} commits carry no \`Agent:\` trailer`);
    } else ok(`the last ${recent.length} commits all say which agent made them`);
  } catch { /* not a git checkout -- nothing to say */ }
}

// ── Nothing secret got committed ────────────────────────────────────────
{
  // .env is gitignored, but a key pasted into any tracked file is not, and it
  // is the one mistake here with a real cost.
  const tracked = fs.readdirSync(ROOT, { recursive: true })
    .filter((f) => typeof f === 'string' && !f.startsWith('.git/') && !f.startsWith('node_modules'))
    .filter((f) => fs.statSync(path.join(ROOT, f)).isFile());
  // Prefix plus length is not enough: `dos_something_you_chose` is a
  // placeholder in README.md and matched it, and a leak check that cries wolf
  // on the documentation gets switched off -- which is worse than not having
  // one. Real keys here are base64url from crypto.randomBytes, so requiring an
  // uppercase AND a digit separates them from anything written by hand in
  // snake_case.
  const looksReal = (s) => /[A-Z]/.test(s) && /[0-9]/.test(s);
  const leaked = tracked.filter((f) => {
    if (f === 'scripts/check.mjs') return false; // this file names the patterns
    const body = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return [...body.matchAll(/\b(?:dos_|ses_|sk-ant-)([A-Za-z0-9_-]{16,})/g)]
      .some((m) => looksReal(m[1]));
  });
  if (leaked.length) bad(`a credential appears in: ${leaked.join(', ')}`);
  else ok('no credentials in tracked files');
}

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
