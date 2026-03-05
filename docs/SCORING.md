# Scoring layer over tri-risk

This is a scoring layer on top of tri decision logic.

Base tri values:
- `1` = positive / passes rule
- `0` = negative / fails rule
- `M` = unknown / not enough data

## Why add weights and thresholds

Pure tri logic is good for strict rules.

A scoring layer helps when:
- several factors influence the result
- some factors are stronger than others
- you want a calibrated decision instead of flat yes/no

## Model

Each factor has:
- a tri value: `0`, `M`, `1`
- a weight from `1` to `10`

Contribution:
- `1` -> `+weight`
- `0` -> `-weight`
- `M` -> `0`

Then we compute:
- `score`
- `coverage` = known_weight / total_weight

Final decision:
- if coverage is too low -> `need`
- else if score >= ok_threshold -> `ok`
- else if score <= stop_threshold -> `stop`
- else -> `need`

## Why this is useful

This keeps unknown honest.

We do not force a binary answer if too much data is missing.
