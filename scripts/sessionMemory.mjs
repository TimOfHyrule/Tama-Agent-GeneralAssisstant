#!/usr/bin/env node
// What a session is told before it does anything else.
//
// Run by .claude/hooks/session-start.sh. It reads the personal memory out of
// Tamarada and hands it to the session as context, together with an
// instruction to go through it WITH the human rather than absorb it silently.
//
// ── Why a hook and not a line in CLAUDE.md ───────────────────────────────
//
// CLAUDE.md already said "run bin/mem first". A written instruction competes
// with everything else in the file and loses often enough that the memory got
// read some sessions and not others -- and a memory that is read
// unpredictably is worse than one that is never read, because you cannot tell
// from the outside which kind of session you are talking to. The hook is not
// advice. It runs.
//
// ── Why the review is proportionate ──────────────────────────────────────
//
// The obvious version prints everything and asks "still true?" about each
// line. That works twice. By the third session it is a wall of text between
// the human and the thing they opened the session to do, and the correct
// response to it -- skip it -- is the one that gets learned.
//
// So: the notes are always shown, and only the ones that have gone [OLD] or
// [EXPIRED] are asked about, because those are the only ones where the answer
// changes what is stored. A session with nothing stale says one line and gets
// out of the way.
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] || 'startup';

// A hook that breaks the session it is supposed to help is a bad trade, so
// every failure below turns into context saying what went wrong. The session
// still starts; it just knows it is working without memory, which is the
// thing it must not discover silently.
const emit = (text) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text },
  }));
  process.exit(0);
};

if (!process.env.TAMARADA_URL) {
  emit(
    'PERSONAL MEMORY: unavailable this session -- TAMARADA_URL is not set.\n' +
    'Tell the human in your first message: it goes in the cloud environment settings at ' +
    'claude.ai/code (the cloud icon above the message box, then the gear). You have no ' +
    'record of previous sessions, so say that rather than answering from guesses.',
  );
}

// No key, but we know where the install is -- so do not just report the
// problem, start solving it. The session asks for a grant here and hands the
// human the code, which turns "you have no credential" from something they
// have to go and read about into something they finish in two clicks.
//
// It has to be the --start half. The plain `bin/tama login` prints the code
// and THEN blocks for five minutes polling, so through a chat the person
// would not see the code until the wait was already over -- the one shape
// that cannot work here.
if (!process.env.TAMARADA_KEY) {
  let started;
  try {
    started = execFileSync(path.join(ROOT, 'bin/tama'), ['login', '--start', 'Claude Code'],
      { encoding: 'utf8', timeout: 20000 });
  } catch (err) {
    emit(
      'PERSONAL MEMORY: no TAMARADA_KEY, and asking for one failed.\n' +
      `${`${err.stdout ?? ''}${err.stderr ?? ''}`.trim() || err.message}\n\n` +
      'Tell the human. If this says the host could not be reached, the likely cause is the ' +
      "cloud environment's Network access -- it must be Custom with the Tamarada domain listed, " +
      'or the session cannot reach it at all.',
    );
  }
  const val = (k) => (started.match(new RegExp(`^${k} (.+)$`, 'm')) || [])[1] || '';
  const userCode = val('USER_CODE');
  const deviceCode = val('DEVICE_CODE');
  const mins = Math.floor(Number(val('EXPIRES_IN_SECONDS') || 0) / 60);

  emit([
    'PERSONAL MEMORY: no credential yet -- but a sign-in code has already been requested for you.',
    '',
    `  Code:      ${userCode}`,
    `  Enter at:  ${val('WHERE')}`,
    `  Expires:   ${mins} minutes`,
    '',
    '── Your FIRST message must be this, and nothing else ──',
    '',
    `Show them the code ${userCode} and where to type it. Say it expires in ${mins} minutes.`,
    'Tell them to approve it WITHOUT ticking full access. A sandboxed token can see only the',
    'pages it creates itself, so it gets its own memory and nothing else in the account -- and',
    'they can still read and edit that memory from the UI, because their own login sees every',
    'page. Full access would work too and is strictly worse.',
    'Then STOP and end your turn -- they cannot approve it while you are still working, and',
    'they cannot see the code until you do.',
    '',
    'When they say they have approved it, run:',
    '',
    `    bin/tama login --collect ${deviceCode}`,
    '',
    'It prints APPROVED and then the token. Give them the token and tell them to add it as',
    'TAMARADA_KEY in the cloud environment settings at claude.ai/code -- the same dialog the',
    'URL is in. It does NOT take effect in this session: a session copies the variables once',
    'at startup, so it applies to the next one they open. Say that plainly rather than letting',
    'them wonder why nothing changed.',
    '',
    'If it prints PENDING they have not finished; wait for them and run it again. If EXPIRED,',
    'start over with `bin/tama login --start`.',
    '',
    'Until then you have no personal memory. Say so when it is relevant rather than',
    'answering from guesses.',
  ].join('\n'));
}

let out;
try {
  out = execFileSync(path.join(ROOT, 'bin/mem'), { encoding: 'utf8', timeout: 20000 });
} catch (err) {
  // exit 1 with this message means the collection has never been created.
  const said = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
  if (said.includes('bin/mem setup')) {
    emit(
      'PERSONAL MEMORY: not set up yet.\n' +
      'Offer to run `bin/mem setup`, which creates the page and collection. Until then there ' +
      'is no memory of previous sessions.\n\n' +
      'This is the EXPECTED state on the first session after signing in, and it is not a ' +
      'problem to apologise for: a sandboxed token can only see pages it created itself, so ' +
      'the memory has to be made once from inside the sandbox. Say that, run setup, and move ' +
      'on. The human can still read and edit it in the UI afterwards -- their own login sees ' +
      'every page, sandboxed or not.',
    );
  }
  emit(
    `PERSONAL MEMORY: could not be read.\n${said || err.message}\n\n` +
    'Tell the human in your first message, and say plainly that memory was unreachable ' +
    'this session rather than answering from guesses.',
  );
}

const empty = out.includes('No memory yet');
// Counted from the markers bin/mem prints rather than by re-querying: the two
// tools then cannot disagree about what is stale, which they would the first
// time one of the thresholds moved.
const stale = (out.match(/\[(OLD|EXPIRED)\]/g) || []).length;

// Only startup and clear get the walkthrough. `resume` is somebody continuing
// a conversation that already had it, and `compact` is a session mid-task
// whose context was just trimmed -- re-reading the memory there is useful,
// being asked to review it again in the middle of the work is not.
const walkthrough = source === 'startup' || source === 'clear';

if (empty) {
  emit(
    'PERSONAL MEMORY: empty. Nothing has been written yet.\n' +
    (walkthrough
      ? 'Mention this once, briefly, and offer to start it: `bin/mem add fact "..."`. Do not interrogate them for facts.'
      : ''),
  );
}

const instruction = walkthrough
  ? [
      '',
      '── Before anything else, go through this with the human ──',
      '',
      'Your FIRST message must show them what is remembered. Not a summary of it -- the notes',
      'themselves, so they can spot a wrong one. Group by kind, keep it tight, no preamble.',
      '',
      stale
        ? `Then ask about the ${stale} note(s) marked [OLD] or [EXPIRED], one short question covering ` +
          'all of them: still true, or should it go? Act on the answer with `bin/mem add` / ' +
          '`bin/mem forget` -- do not just acknowledge it. Ask about nothing else: every other ' +
          'note is current and asking would train them to skip this.'
        : 'Nothing is stale, so ask nothing. Close with one line offering to add or correct anything, ' +
          'and then get on with whatever they came for.',
      '',
      'If they came in with a task already stated, do this first anyway -- it is short -- and then',
      'go straight into the task in the same message.',
    ].join('\n')
  : '';

emit(`PERSONAL MEMORY (from Tamarada, read at session start):\n${out}${instruction}`);
