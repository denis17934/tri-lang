#!/usr/bin/env bash
set -euo pipefail

say() { printf "\n== %s ==\n" "$*"; }

say "env"
echo "pwd: $(pwd)"
echo "node: $(node -v)"
echo "date: $(date)"

say "syntax checks"
node -c scripts/leads_bot.mjs
echo "OK leads_bot syntax"
node -c scripts/crm_server.mjs
echo "OK crm_server syntax"

say "tri smoke"
if command -v tri >/dev/null 2>&1; then
  tri examples/insurance_refund.tri >/dev/null
  tri examples/insurance_med_doc.tri >/dev/null
  echo "OK tri examples"
else
  echo "WARN tri not in PATH, skip"
fi

say "crm api"
if curl -fsS http://localhost:7777/api/cases >/dev/null; then
  echo "OK crm api alive"
else
  echo "WARN crm api not running"
fi

say "bot process"
if pgrep -af "leads_bot\.mjs" >/dev/null; then
  echo "OK leads_bot process running"
else
  echo "WARN leads_bot process not running"
fi

say "done"
echo "ALL OK ✅"
