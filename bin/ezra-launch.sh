#!/usr/bin/env sh
set -euf
IFS='
'

# Validate injected env.
case "${CLAUDE_PLUGIN_ROOT:-}" in
  "")  echo "ezra: CLAUDE_PLUGIN_ROOT not set" >&2; exit 1 ;;
  /*)  ;;
  *)   echo "ezra: CLAUDE_PLUGIN_ROOT must be absolute" >&2; exit 1 ;;
esac

ROOT="$CLAUDE_PLUGIN_ROOT"
SERVER="$ROOT/server"
LOCK="$ROOT/package-lock.json"
INSTALL_STAMP="$ROOT/node_modules/.package-lock.json"
BUILT="$SERVER/dist/stdio.js"

# Staleness check. Fast path only if everything exists AND the root
# lockfile is not newer than the stamp npm wrote during the last install.
# npm workspaces hoist deps to $ROOT/node_modules, not $SERVER/node_modules.
stale=0
[ -d "$ROOT/node_modules" ] || stale=1
[ -s "$BUILT" ]              || stale=1
if [ "$stale" = "0" ] && [ -f "$LOCK" ] && [ -f "$INSTALL_STAMP" ]; then
  if [ "$LOCK" -nt "$INSTALL_STAMP" ]; then
    stale=1
  fi
fi

if [ "$stale" = "0" ]; then
  exec node "$BUILT"
fi

# Cold path: prevent any accidental stdout from corrupting MCP framing.
# fd 3 holds the real stdout; fd 1 goes to stderr for all setup work.
# The final exec restores stdout to fd 3 for the node process only.
exec 3>&1 1>&2

# If we crash mid-setup, wipe partial state so the next spawn redoes cold path.
trap 'rc=$?; if [ "$rc" -ne 0 ]; then rm -rf "$SERVER/dist" "$ROOT/node_modules"; fi; exit "$rc"' EXIT INT TERM

cd "$ROOT"

echo "ezra: first-time setup in $ROOT"
npm ci --workspace=server --include-workspace-root --no-fund
rm -rf "$SERVER/dist"
npm run build --workspace=server

trap - EXIT INT TERM

exec node "$BUILT" 1>&3 3>&-
