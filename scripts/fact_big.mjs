import { writeFileSync } from "node:fs";

const n = Number(process.argv[2] ?? "");
const out = process.argv[3] ?? `fact_${n}.txt`;
if (!Number.isInteger(n) || n < 0) {
  console.error("Usage: node scripts/fact_big.mjs <n:int>=0 <outPath>");
  process.exit(1);
}

function prod(a, b) {
  if (a > b) return 1n;
  if (a === b) return BigInt(a);
  if (b - a === 1) return BigInt(a) * BigInt(b);
  const m = (a + b) >> 1;
  return prod(a, m) * prod(m + 1, b);
}

console.log(`building factorial product tree for n=${n} ...`);
const x = (n <= 1) ? 1n : prod(2, n);
console.log("converting to decimal string ...");
const s = x.toString();
console.log(`digits=${s.length}`);
console.log(`writing ${out} ...`);
writeFileSync(out, s, "utf8");
console.log("done");
