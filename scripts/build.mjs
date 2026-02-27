import { build } from "esbuild";
import { mkdirSync, writeFileSync, chmodSync, statSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/cli.ts"],
  outfile: "dist/cli.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  logLevel: "info"
});

const sz = statSync("dist/cli.mjs").size;
if (sz === 0) {
  throw new Error("BUILD FAILED: dist/cli.mjs is 0 bytes");
}

writeFileSync(
  "dist/tri",
  `#!/usr/bin/env node
import "./cli.mjs";
`,
  "utf8"
);
chmodSync("dist/tri", 0o755);

console.log("Built dist/cli.mjs and dist/tri");