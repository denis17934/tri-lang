# tri-lang

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
