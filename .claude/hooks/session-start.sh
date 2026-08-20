#!/bin/bash
# Runs at the start of every session. Two jobs, in order:
#
#   1. Make TAMARADA_URL / TAMARADA_KEY available for the whole session, so
#      `bin/tama` and `bin/mem` work without the human exporting anything.
#   2. Read the company memory and hand it to the session as context, with an
#      instruction to go through it WITH the human. See scripts/sessionMemory.mjs.
#
# Deliberately NOT `set -e`. This hook exists to help a session start; a hook
# that ABORTS the session because Tamarada was slow would be a worse bug than
# the one it fixes. Every failure path inside sessionMemory.mjs turns into
# context saying what went wrong, and this script always exits 0.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

# A local .env is the normal way to hold these outside the web environment.
# It is gitignored, so this reads a file that is never committed. Values are
# exported for this script AND appended to CLAUDE_ENV_FILE, which is what
# carries them to the tools the agent runs later in the session.
if [ -f .env ]; then
  while IFS= read -r line; do
    case "$line" in
      ''|'#'*) continue ;;
      TAMARADA_URL=*|TAMARADA_KEY=*)
        export "${line?}"
        [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export ${line}" >> "$CLAUDE_ENV_FILE"
        ;;
    esac
  done < .env
fi

# The source (startup / resume / clear / compact) arrives on stdin as JSON.
# Only startup and clear get the full walkthrough -- resume and compact are
# sessions already in the middle of something. Parsed with node rather than
# grep because node is already a hard dependency here and grep on JSON is how
# you get the wrong answer the first time a note contains the word "startup".
INPUT=$(cat)
SOURCE=$(printf '%s' "$INPUT" | node -e "
  let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    try { console.log(JSON.parse(d).source || 'startup'); } catch { console.log('startup'); }
  });
" 2>/dev/null || echo startup)

node scripts/sessionMemory.mjs "$SOURCE" 2>/dev/null || true
exit 0
