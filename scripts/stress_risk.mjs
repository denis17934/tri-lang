const UI_MS = Number(process.env.UI_MS || "200");
import http from "node:http";

const URL_STR = process.env.URL || "http://127.0.0.1:7334/risk";
const TARGET = new globalThis.URL(URL_STR);

const N = Number(process.env.N || 5000);
const C = Number(process.env.C || 20);
const TIMEOUT_MS = Number(process.env.T || 60000);

const body = Buffer.from(JSON.stringify({ env: { income: "1", docs: "M", fraud: "0", history: "M" } }));

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: C,
  maxFreeSockets: C,
});

let done = 0, ok = 0, err = 0;
const t0 = process.hrtime.bigint();
const SPIN = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
let finished = false;

const spins = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
let si = 0;

function secNow() { return Number(process.hrtime.bigint() - t0) / 1e9; }

function render(final = false) {
  const sec = secNow();
  const rps = sec > 0 ? Math.round(done / sec) : 0;
  const pct = N > 0 ? Math.floor((done / N) * 100) : 0;

  const width = 20;
  const filled = Math.min(width, Math.floor((done / N) * width));
  const bar = "#".repeat(filled) + ".".repeat(width - filled);

  // одна короткая строка, без эмодзи (они ломают ширину/перерисовку)
  const spin = "|/-\\"[Math.floor((Date.now() / 120) % 4)];
  const line = `${spin} [${bar}] ${String(pct).padStart(3)}%  done=${done}/${N} ok=${ok} err=${err} rps=${rps} C=${C}`;

  process.stdout.write("\r\x1b[2K" + line);
  if (final) process.stdout.write("\n");
}

const ui = setInterval(() => render(false), UI_MS);
function finish(code) {
  if (finished) return;
  finished = true;
  try { clearInterval(ui); } catch {}
  try { clearInterval(ui); } catch {}
  try { render(true); } catch {}
  try { agent.destroy(); } catch {}
  const sec = secNow();
  const rps = sec > 0 ? Math.round(done / sec) : 0;
  const verdict = err > 0 ? "💥 FAIL" : "🏆 OK";
  console.log(verdict, { done, ok, err, sec: +sec.toFixed(3), rps, C, timeout_ms: TIMEOUT_MS });
  process.exit(code);
}

process.on("SIGINT", () => finish(130));


function fire() {
  const req = http.request(
    {
      hostname: TARGET.hostname,
      port: TARGET.port || 80,
      path: TARGET.pathname,
      method: "POST",
      agent,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": body.length,
      },
    },
    (res) => {
      if (res.statusCode === 200) ok++; else err++;
      res.resume();
      res.on("end", () => {
        done++;
        if (done >= N) finish(err ? 2 : 0);
        else fire();
      });
    }
  );

  req.setTimeout(TIMEOUT_MS, () => {
    err++;
    done++;
    req.destroy();
    if (done >= N) finish(2);
    else fire();
  });

  req.on("error", () => {
    err++;
    done++;
    if (done >= N) finish(2);
    else fire();
  });

  req.end(body);
}

for (let i = 0; i < C; i++) fire();
