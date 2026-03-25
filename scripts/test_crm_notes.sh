#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:7777"

# найти два кейса trial started
ids=$(curl -s "$BASE/api/cases" | python3 -c 'import sys,json; cs=json.load(sys.stdin);
ids=[str(c["_id"]) for c in cs if c.get("case")=="trial started"];
print(" ".join(ids[:2]))')

if [[ -z "${ids}" ]]; then
  echo "FAIL: no trial started cases found"
  exit 1
fi

echo "trial ids: $ids"

i=0
for id in $ids; do
  i=$((i+1))
  txt="autotest note $i $(date +%H:%M:%S)"
  curl -s -X POST "$BASE/api/cases/$id/note" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"$txt\"}" >/dev/null
done

echo "files:"
ls -la "$HOME/tri-private/cases" | rg -n 'trial_started' || true

# ожидание: есть файл с _<id>.md
for id in $ids; do
  if ! ls "$HOME/tri-private/cases" | rg -q "trial_started_${id}\.md"; then
    echo "FAIL: missing note file for id=$id"
    exit 1
  fi
done

echo "OK ✅ crm notes use _id filenames"
