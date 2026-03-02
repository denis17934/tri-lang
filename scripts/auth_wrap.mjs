import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { URL } from "node:url";

function loadPlans() {
  const file = process.env.API_KEYS_FILE || (process.env.HOME + "/.tri_keys");
  const plans = new Map(); // key -> {plan, rps, max_req}
  if (file) {
    try {
      const txt = fs.readFileSync(file, "utf-8");
      for (const raw of txt.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const parts = line.split(/\s+/);
        const key = parts[0];
        let plan = "default", rps = 5;
        for (const t of parts.slice(1)) {
          const [k,v] = t.split("=");
          if (k==="plan" && v) plan = v;
          if (k==="rps" && v) rps = parseInt(v, 10) || rps;
        }
        const max_req = Math.max(1, Math.floor(rps * (WINDOW_MS/1000)));
        plans.set(key, {plan, rps, max_req});
      }
    } catch {}
  }
  // fallback env keys (без рпс, ставим default)
  const env = String(process.env.API_KEYS || process.env.API_KEY || "");
  for (const k of env.split(",").map(x=>x.trim()).filter(Boolean)) {
    if (!plans.has(k)) plans.set(k, {plan:"default", rps:5, max_req: Math.max(1, Math.floor(5*(WINDOW_MS/1000)))});
  }
  return plans;
}

const TARGET = new URL(process.env.TARGET || "http://127.0.0.1:7334");
const PORT = Number(process.env.PORT || 7444);
const WINDOW_MS = Number(process.env.WINDOW_MS || 10000);
const MAX_REQ = Number(process.env.MAX_REQ || 200);

const plans = loadPlans();
const usage = new Map(); // key -> {count, window_start}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function getKey(req) {
  return String(req.headers["x-api-key"] || "").trim();
}

function touchUsage(key) {
  const now = Date.now();
  const u = usage.get(key) || { count: 0, window_start: now };
  if (now - u.window_start >= WINDOW_MS) {
    u.count = 0;
    u.window_start = now;
  }
  u.count += 1;
  usage.set(key, u);
  return u;
}

function checkAuth(req, res) {
  const key = getKey(req);
  if (!key || !plans.has(key)) {
    json(res, 401, { error: "Unauthorized", hint: "send header X-API-Key" });
    return null;
  }
  return key;
}

const srv = http.createServer((req, res) => {
  // health
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  // usage
  if (req.method === "GET" && req.url === "/v1/usage") {
    const key = checkAuth(req, res);
    if (!key) return;
    const u = usage.get(key) || { count: 0, window_start: 0 };
    json(res, 200, { ok:true, key, ...u, window_ms: WINDOW_MS, max_req: (plans.get(key)||{}).max_req, plan: (plans.get(key)||{}).plan, rps: (plans.get(key)||{}).rps });
    return;
  }

  // risk proxy (auth + rate limit)
  if (req.method === "POST" && req.url === "/v1/risk") {
    const key = checkAuth(req, res);
    if (!key) return;

    const u = touchUsage(key);
    const lim = (plans.get(key)||{}).max_req || MAX_REQ;
    if (u.count > lim) {
      const retry_after_ms = Math.max(0, WINDOW_MS - (Date.now() - u.window_start));
      json(res, 429, { error: "Rate limit", retry_after_ms, window_ms: WINDOW_MS, max_req: lim, count: u.count });
      return;
    }

    const up = http.request(
      {
        hostname: TARGET.hostname,
        port: TARGET.port || 80,
        path: "/risk",
        method: "POST",
        headers: { "Content-Type": req.headers["content-type"] || "application/json" },
      },
      (upRes) => {
        res.statusCode = upRes.statusCode || 502;
        res.setHeader("Content-Type", upRes.headers["content-type"] || "application/json");
        upRes.pipe(res);
      }
    );

    req.pipe(up);
    up.on("error", () => json(res, 502, { error: "Upstream error" }));
    return;
  }


  // docs + openapi
  if (req.method === "GET" && req.url === "/v1/docs") {
    res.statusCode = 200;
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.end(`<!doctype html><html><head><meta charset="utf-8"><title>tri-risk</title></head>
<body style="font-family:system-ui;max-width:900px;margin:40px auto;padding:0 16px">
<h1>tri-risk API</h1>
<p><code>POST /v1/risk</code> header: <code>X-API-Key</code></p>
<p><a href="/v1/openapi.json">/v1/openapi.json</a></p>
</body></html>`);
    return;
  }
  if (req.method === "GET" && req.url === "/v1/openapi.json") {
    res.statusCode = 200;
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify({
      openapi:"3.0.0",
      info:{title:"tri-risk",version:"0.1.0"},
      components:{
        securitySchemes:{apiKeyAuth:{type:"apiKey",in:"header",name:"X-API-Key"}},
        schemas:{
          RiskRequest:{type:"object",properties:{env:{type:"object"}},required:["env"]},
          RiskResponse:{type:"object",properties:{decision:{type:"string",enum:["0","M","1"]},label:{type:"string"},need:{type:"integer"},need_list:{type:"array",items:{type:"string"}}},required:["decision","label","need","need_list"]},
          UsageResponse:{type:"object",properties:{ok:{type:"boolean"},key:{type:"string"},count:{type:"integer"},window_start:{type:"integer"},window_ms:{type:"integer"},max_req:{type:"integer"}},required:["ok","key","count","window_start","window_ms","max_req"]},
          RateLimitError:{type:"object",properties:{error:{type:"string"},retry_after_ms:{type:"integer"},window_ms:{type:"integer"},max_req:{type:"integer"},count:{type:"integer"}}}
        }
      },
      paths:{
        "/v1/risk":{post:{
          security:[{apiKeyAuth:[]}],
          requestBody:{required:true,content:{"application/json":{schema:{"":"#/components/schemas/RiskRequest"}}}},
          responses:{
            "200":{description:"OK",content:{"application/json":{schema:{"":"#/components/schemas/RiskResponse"}}}},
            "401":{description:"Unauthorized"},
            "429":{description:"Rate limit",content:{"application/json":{schema:{"":"#/components/schemas/RateLimitError"}}}}
          }
        }},
        "/v1/usage":{get:{
          security:[{apiKeyAuth:[]}],
          responses:{
            "200":{description:"OK",content:{"application/json":{schema:{"":"#/components/schemas/UsageResponse"}}}},
            "401":{description:"Unauthorized"}
          }
        }}
      }
    }, null, 2));
    return;
  }

  json(res, 404, { error: "Not found" });
});

srv.listen(PORT, "127.0.0.1", () => {
  console.log(`auth proxy on http://127.0.0.1:${PORT} -> ${TARGET.origin}`);
  console.log(`proxy up window_ms= max_req=`);
});
