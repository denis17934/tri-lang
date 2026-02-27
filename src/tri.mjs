#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const tsxCli = join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs");
const cli = join(__dirname, "cli.ts");

const env = { ...process.env, TSX_DISABLE_CACHE: "1" };

const r = spawnSync(process.execPath, [tsxCli, cli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});

if (r.error) {
  console.error("tri runner error:", r.error.message);
  process.exit(1);
}

process.exit(r.status ?? 1);