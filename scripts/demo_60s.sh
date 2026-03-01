#!/usr/bin/env bash
set -e

echo "1) Tri truth table for implication (imp):"
tri --table imp
echo

echo "2) De Morgan holds in tri-logic (9 cases):"
tri --expr "not (a and b) == ((not a) or (not b))" --list | tail -n +2 | awk '{s+=$3=="1"} END{print "passed",s,"/ 9"}'
echo

echo "3) Credit scoring example (3 cases):"
tri examples/credit_scoring.tri
echo

echo "4) Local Risk API returns decision+need_list:"
( curl -s -X POST http://127.0.0.1:7334/risk -H "Content-Type: application/json" -d '{"env":{"income":"1","docs":"M","fraud":"0","history":"M"}}' && echo )
