#!/usr/bin/env node
import fs from "node:fs";

function normalizeTri(v) {
  if (v === 1 || v === "1") return 1;
  if (v === 0 || v === "0") return 0;
  if (v === "M" || v === "m") return "M";
  throw new Error(`Invalid tri value: ${v}`);
}

function scoreFactor(value, weight) {
  const v = normalizeTri(value);
  if (v === 1) return { contribution: +weight, known: true };
  if (v === 0) return { contribution: -weight, known: true };
  return { contribution: 0, known: false };
}

function evaluate(config) {
  const factors = config.factors || {};
  let totalWeight = 0;
  let knownWeight = 0;
  let score = 0;

  const rows = [];

  for (const [name, meta] of Object.entries(factors)) {
    const weight = Number(meta.weight);
    const value = meta.value;
    const { contribution, known } = scoreFactor(value, weight);

    totalWeight += weight;
    if (known) knownWeight += weight;
    score += contribution;

    rows.push({
      factor: name,
      value,
      weight,
      contribution
    });
  }

  const coverage = totalWeight === 0 ? 0 : knownWeight / totalWeight;

  let decision = "need";
  if (coverage < config.min_coverage) {
    decision = "need";
  } else if (score >= config.ok_threshold) {
    decision = "ok";
  } else if (score <= config.stop_threshold) {
    decision = "stop";
  } else {
    decision = "need";
  }

  return {
    name: config.name || "score_demo",
    score,
    coverage,
    decision,
    rows
  };
}

const path = process.argv[2] || "examples/insurance_refund_scoring.json";
const raw = fs.readFileSync(path, "utf8");
const config = JSON.parse(raw);
const result = evaluate(config);

console.log(`name: ${result.name}`);
console.log(`score: ${result.score}`);
console.log(`coverage: ${result.coverage.toFixed(2)}`);
console.log(`decision: ${result.decision}`);
console.log("");
console.log("factors:");
for (const row of result.rows) {
  console.log(`- ${row.factor}: value=${row.value} weight=${row.weight} contribution=${row.contribution}`);
}
