import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SKIP = new Set([
  "modusponens.tri",
  "mp_find.tri"
]);

const files = readdirSync(new URL("../examples/", import.meta.url))
  .filter(f => f.endsWith(".tri") && !SKIP.has(f))
  .sort();

for (const f of files) {
  const path = `examples/${f}`;
  console.log(`== ${path} ==`);
  const r = spawnSync("tri", [path], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("OK: all test examples ran");
