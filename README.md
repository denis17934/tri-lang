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
