#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const baseDir = path.join(os.homedir(), "tri-private");
const casesFile = path.join(baseDir, "cases.jsonl");
const casesDir = path.join(baseDir, "cases");
const webDir = path.join(process.cwd(), "web", "crm");

fs.mkdirSync(casesDir, { recursive: true });
if (!fs.existsSync(casesFile)) fs.writeFileSync(casesFile, "", "utf8");

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

function findNote(c) {
  // prefer exact note filename by _id (prevents collisions)
  try {
    const id = c && c._id;
    if (id) {
      const base = `${c.date || "no_date"}_${slugify(c.client || "unknown")}_${slugify(c.case || "case")}`;
      const pNew = path.join(casesDir, `${base}_${id}.md`);
      if (fs.existsSync(pNew)) return pNew;
    }
  } catch {}

  const pref = `${c.date || ""}_${slugify(c.client || "unknown")}_${slugify(c.case || "case")}`;
  try {
    const files = fs.readdirSync(casesDir);
    const hit = files.find(f => f.startsWith(pref) && f.endsWith(".md"));
    return hit ? path.join(casesDir, hit) : "";
  } catch { return ""; }
}

function loadCases() {
  const raw = fs.readFileSync(casesFile, "utf8").trim();
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map((line, idx) => {
    let obj = {};
    try { obj = JSON.parse(line); } catch {}
    obj._id = idx + 1;
    obj._note = findNote(obj) || "";
    obj.tasks = Array.isArray(obj.tasks) ? obj.tasks : [];
    return obj;
  });
}

function saveCases(rows) {
  const out = rows.map(r => {
    const { _id, _note, ...rest } = r;
    return JSON.stringify(rest);
  }).join("\n");
  fs.writeFileSync(casesFile, out ? out + "\n" : "", "utf8");
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", c => data += c);
    req.on("end", () => resolve(data));
  });
}

function send(res, code, obj) {
  const body = typeof obj === "string" ? obj : JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": typeof obj === "string"
      ? "text/plain; charset=utf-8"
      : "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function serveStatic(req, res) {
  const u = url.parse(req.url).pathname || "/";
  const file = u === "/" ? "/index.html" : u;
  const fp = path.join(webDir, file);
  if (!fp.startsWith(webDir)) return send(res, 403, "forbidden");
  if (!fs.existsSync(fp)) return send(res, 404, "not found");

  const ext = path.extname(fp);
  const ct = ext === ".html" ? "text/html; charset=utf-8"
    : ext === ".js" ? "application/javascript; charset=utf-8"
    : ext === ".css" ? "text/css; charset=utf-8"
    : "application/octet-stream";

  res.writeHead(200, { "Content-Type": ct });
  res.end(fs.readFileSync(fp));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, "");

  const pathname = url.parse(req.url).pathname || "/";
  if (pathname.startsWith("/api/")) {
    if (req.method === "GET" && pathname === "/api/cases") {
      return send(res, 200, loadCases());
    }

    const ms = pathname.match(/^\/api\/cases\/(\d+)\/status$/);
    if (req.method === "PATCH" && ms) {
      const id = Number(ms[1]);
      const body = JSON.parse((await readBody(req)) || "{}");
      const rows = loadCases();
      const row = rows.find(r => r._id === id);
      if (!row) return send(res, 404, { error: "not_found" });
      row.status = body.status || row.status;
      saveCases(rows);
      return send(res, 200, { ok: true });
    }

    const mn = pathname.match(/^\/api\/cases\/(\d+)\/note$/);
    if (req.method === "GET" && mn) {
      const id = Number(mn[1]);
      const rows = loadCases();
      const row = rows.find(r => r._id === id);
      if (!row) return send(res, 404, { error: "not_found" });
      if (!row._note) return send(res, 200, { path: "", text: "" });
      return send(res, 200, { path: row._note, text: fs.readFileSync(row._note, "utf8") });
    }
    if (req.method === "POST" && mn) {
      const id = Number(mn[1]);
      const body = JSON.parse((await readBody(req)) || "{}");
      const rows = loadCases();
      const row = rows.find(r => r._id === id);
      if (!row) return send(res, 404, { error: "not_found" });

      // note path: ALWAYS use filename with _id (prevents collisions)
      const base = `${row.date || "no_date"}_${slugify(row.client || "unknown")}_${slugify(row.case || "case")}`;
      const fnOld = `${base}.md`;
      const fnNew = `${base}_${id}.md`;
      const pOld = path.join(casesDir, fnOld);
      const pNew = path.join(casesDir, fnNew);

      // migrate old -> new once
      try {
        if (!fs.existsSync(pNew) && fs.existsSync(pOld)) fs.renameSync(pOld, pNew);
      } catch {}

      row._note = pNew;
      fs.writeFileSync(row._note, String(body.text || ""), "utf8");
      return send(res, 200, { ok: true, path: row._note });
    }

    const mt = pathname.match(/^\/api\/cases\/(\d+)\/tasks$/);
    if (req.method === "POST" && mt) {
      const id = Number(mt[1]);
      const body = JSON.parse((await readBody(req)) || "{}");
      const rows = loadCases();
      const row = rows.find(r => r._id === id);
      if (!row) return send(res, 404, { error: "not_found" });
      row.tasks = Array.isArray(body.tasks) ? body.tasks : (row.tasks || []);
      saveCases(rows);
      return send(res, 200, { ok: true });
    }



    // update case fields (amount)
    const mup = pathname.match(/^\/api\/cases\/(\d+)$/);
    if (req.method === "PATCH" && mup) {
      const id = Number(mup[1]);
      const body = JSON.parse((await readBody(req)) || "{}");
      const rows = loadCases();
      const row = rows.find(r => r._id === id);
      if (!row) return send(res, 404, { error: "not_found" });

      if (body.amount !== undefined) {
        const a = Number(body.amount);
        row.amount = Number.isFinite(a) ? a : 0;
      }

      saveCases(rows);
      return send(res, 200, { ok: true });
    }

    // delete case
    const md = pathname.match(/^\/api\/cases\/(\d+)$/);
    if (req.method === "DELETE" && md) {
      const id = Number(md[1]);
      const rows = loadCases();
      const idx = rows.findIndex(r => r._id === id);
      if (idx === -1) return send(res, 404, { error: "not_found" });

      const row = rows[idx];
      rows.splice(idx, 1);
      saveCases(rows);

      // optional: delete note file if exists
      try {
        if (row._note && fs.existsSync(row._note)) fs.unlinkSync(row._note);
      } catch {}

      return send(res, 200, { ok: true });
    }


    return send(res, 404, { error: "unknown_api" });
  }

  return serveStatic(req, res);
});

const PORT = process.env.CRM_PORT ? Number(process.env.CRM_PORT) : 7777;
server.listen(PORT, () => console.log(`tri-crm http://localhost:${PORT}`));
