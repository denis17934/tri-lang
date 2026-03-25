# tri-lang

[![CI](https://github.com/denis17934/tri-lang/actions/workflows/ci.yml/badge.svg)](https://github.com/denis17934/tri-lang/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/denis17934/tri-lang)](https://github.com/denis17934/tri-lang/releases/latest)
[![License](https://img.shields.io/github/license/denis17934/tri-lang)](https://github.com/denis17934/tri-lang/blob/main/LICENSE)

A tiny ternary-logic language + VM + CLI where:
- `0` = false
- `1` = true
- `M` = **unknown** (not probability, not “half-true”)

Includes a rule/decision engine style workflow (tri-risk) with `decision` + `need_list`.

## Quickstart

    npm install
    npm run build
    node cli.mjs --expr "a and b" --list
    node cli.mjs fib 1000000
    node cli.mjs bigfact 1000000

## Why ternary 0/M/1?

Binary logic forces “yes/no” even when data is missing.  
`M` preserves uncertainty and enables explainable workflows via `need_list`.

## License

Apache-2.0

## Examples
- `examples/insurance_refund.tri` — refund decision (ok/stop/unknown)
- `examples/insurance_med_doc.tri` — medical document validation
- `docs/README_DECISIONS.md` — short explanation of decision/need

- `docs/SCORING.md` — weights thresholds and coverage over tri values
- `examples/insurance_refund_scoring.json` — scoring example
- `scripts/score_demo.mjs` — simple scoring demo

## Quick demo (tri-risk + mini CRM)

Local services:
- risk: 127.0.0.1:7334
- proxy: 127.0.0.1:7444 (X-API-Key + rate-limit)
- crm: http://localhost:7777

Smoke test:
- ./bin/tri-test

Notes:
- tri uses ternary logic: 0 / M / 1, where M = unknown (not probability)
- tri-risk returns decision + need_list when data is missing

## v1 cases (страховые)
- docs/v1_cases/01_claim_settlement.md
- docs/v1_cases/02_underwriting.md
- docs/v1_cases/03_compliance_doccheck.md

## SDK quickstart

### Python (no deps)
```py
from sdk.tri_client import run_until_decision

URL = "http://127.0.0.1:7444/v1/risk"
API_KEY = None

facts = {"claim":"M","policy":"1","statement":"M","bank_details":"M"}

def get_more(need_list):
    return {k:"1" for k in need_list}

out = run_until_decision(URL, facts, api_key=API_KEY, get_more=get_more)
print(out)
```

### JS (node 18+)
```js
import { runUntilDecision } from "./sdk/tri_client.js";

const URL = "http://127.0.0.1:7444/v1/risk";
const facts = { claim:"M", policy:"1", statement:"M", bank_details:"M" };

const out = await runUntilDecision(URL, facts, null, async (need) => {
  const more = {};
  for (const k of need) more[k] = "1";
  return more;
});

console.log(out);
```
