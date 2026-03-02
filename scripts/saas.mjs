import { spawn } from "node:child_process";

function run(cmd, args, env) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: "inherit" });
  p.on("exit", (code) => process.exitCode = code ?? 0);
  return p;
}

const riskEnv = { };
const proxyEnv = {
  TARGET: process.env.TARGET || "http://127.0.0.1:7334",
  PORT: process.env.PORT || "7444",
  WINDOW_MS: process.env.WINDOW_MS || "10000",
  MAX_REQ: process.env.MAX_REQ || "200",
  API_KEYS: process.env.API_KEYS || "",
  API_KEYS_FILE: process.env.API_KEYS_FILE || "",
};

console.log("saas: risk http://127.0.0.1:7334 + proxy http://127.0.0.1:" + proxyEnv.PORT);

const risk = run("node", ["scripts/risk_server.mjs"], riskEnv);
const proxy = run("node", ["scripts/auth_wrap.mjs"], proxyEnv);

function shutdown() {
  try { proxy.kill("SIGTERM"); } catch {}
  try { risk.kill("SIGTERM"); } catch {}
  setTimeout(() => process.exit(0), 300);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
