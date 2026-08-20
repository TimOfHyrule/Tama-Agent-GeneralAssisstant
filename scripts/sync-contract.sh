#!/usr/bin/env bash
# Refresh docs/AGENT_API.md from the Tamarada repo that generates it.
#
# ── Why this exists ──────────────────────────────────────────────────────
#
# docs/AGENT_API.md is not documentation here. bin/tama READS it to decide
# which routes to refuse without --paid. So a stale copy is not an out-of-date
# page — it is a guard checking a list that no longer matches the server,
# silently, and in the direction that costs money: a route added since the last
# sync is not on the list, so the guard waves it through.
#
#   scripts/sync-contract.sh            update it
#   scripts/sync-contract.sh --check    say whether it is stale, change nothing
#                                       (exit 1 if it is — usable in CI or a hook)
#
# ── Where it looks, in order ─────────────────────────────────────────────
#
#   TAMARADA_REPO        a local checkout. Regenerated rather than copied, so
#                        it reflects routes that are not committed yet, and it
#                        needs no network at all.
#   TAMARADA_REPO_TOKEN  fetch the ONE file over the GitHub API.
#   (nothing)            git clone, for a machine that already has credentials.
#
# The API path replaced a `git clone` with the token embedded in the URL. That
# form failed with `remote: Write access to repository not granted` on what was
# a pure read — a message that sends you to check write permissions you never
# needed. Cloning a whole repository to read one file was the wrong shape
# anyway.
set -euo pipefail

OWNER_REPO="${TAMARADA_REPO_SLUG:-TimOfHyrule/Project-Station}"
CONTRACT_PATH="docs/AGENT_API.md"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$HERE/$CONTRACT_PATH"
CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fresh="$tmp/AGENT_API.md"

if [ -n "${TAMARADA_REPO:-}" ] && [ -d "$TAMARADA_REPO" ]; then
  echo "Using local checkout: $TAMARADA_REPO"
  ( cd "$TAMARADA_REPO" && npm run --silent agent-contract >/dev/null )
  cp "$TAMARADA_REPO/$CONTRACT_PATH" "$fresh"

elif [ -n "${TAMARADA_REPO_TOKEN:-}" ]; then
  # Trimmed: a secret pasted with a trailing newline produces a malformed
  # header and an error that looks nothing like "you copied it wrong".
  TOKEN="$(printf '%s' "$TAMARADA_REPO_TOKEN" | tr -d '[:space:]')"
  echo "Fetching $CONTRACT_PATH from $OWNER_REPO"
  code=$(curl -sS -o "$fresh" -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github.raw" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/$OWNER_REPO/contents/$CONTRACT_PATH")

  # On failure, ask the API about the TOKEN itself before blaming anything.
  # "404" alone cannot tell you whether the token is dead, belongs to the wrong
  # account, or simply does not list this repo -- and those have completely
  # different fixes. One extra call settles it.
  if [ "$code" != "200" ]; then
    who=$(curl -sS -H "Authorization: Bearer $TOKEN" \
      -H "X-GitHub-Api-Version: 2022-11-28" https://api.github.com/user \
      | sed -n 's/.*"login"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
    kind="unrecognised"
    case "$TOKEN" in
      github_pat_*) kind="fine-grained" ;;
      ghp_*)        kind="classic" ;;
      ghs_*)        kind="app installation" ;;
    esac

    echo >&2
    echo "Could not read $CONTRACT_PATH from $OWNER_REPO (HTTP $code)." >&2
    if [ -z "$who" ]; then
      echo "  The token is not valid at all — /user rejected it too. It is expired," >&2
      echo "  revoked, or was pasted incompletely. Make a new one." >&2
    else
      echo "  The token itself works: it authenticates as '$who' ($kind)." >&2
      echo "  So the problem is this repository, not the token's validity." >&2
      echo >&2
      if [ "$kind" = "classic" ]; then
        echo "  A CLASSIC token needs the whole 'repo' scope to see a private repo." >&2
        echo "  A fine-grained one is the better answer here — it can be limited to" >&2
        echo "  this single repository, read-only." >&2
      else
        echo "  For a fine-grained token, 404 means this repo is not in its list at all" >&2
        echo "  (403 would mean it IS listed but lacks the permission). Check, at" >&2
        echo "  https://github.com/settings/personal-access-tokens :" >&2
        echo "    - Resource owner is the account that owns $OWNER_REPO" >&2
        echo "    - 'Only select repositories' actually includes it" >&2
        echo "    - Repository permissions -> Contents -> Read-only" >&2
      fi
    fi
    exit 1
  fi

else
  echo "No TAMARADA_REPO and no TAMARADA_REPO_TOKEN — falling back to git clone."
  git clone --depth 1 --quiet "https://github.com/$OWNER_REPO.git" "$tmp/repo"
  cp "$tmp/repo/$CONTRACT_PATH" "$fresh"
fi

[ -s "$fresh" ] || { echo "Fetched an empty contract — refusing to overwrite." >&2; exit 1; }

if cmp -s "$fresh" "$TARGET"; then
  echo "Already current."
  exit 0
fi

# What changed in the PAID list specifically. A route count moving is
# interesting; a route joining or leaving the money list is the thing that
# changes what bin/tama actually does.
paid() { grep -oE '^- `\$` `[A-Z]+ /api/[^`]+`' "$1" 2>/dev/null | sed 's/^- `\$` `//; s/`$//' | sort; }
added="$(comm -13 <(paid "$TARGET") <(paid "$fresh") || true)"
removed="$(comm -23 <(paid "$TARGET") <(paid "$fresh") || true)"

echo "Contract has changed."
[ -n "$added" ]   && { echo "  now COSTS MONEY (bin/tama will start refusing these):"; echo "$added"   | sed 's/^/    + /'; }
[ -n "$removed" ] && { echo "  no longer costs money:";                                echo "$removed" | sed 's/^/    - /'; }
[ -z "$added$removed" ] && echo "  (routes changed, but the money list is the same)"

if $CHECK_ONLY; then
  echo "Stale. Run scripts/sync-contract.sh to update."
  exit 1
fi

cp "$fresh" "$TARGET"
echo "Updated $CONTRACT_PATH — commit it, or the next clone is stale again."
