import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { VM } from "./vm.ts";

export function startServer(port: number, VERSION: string) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

    if (req.method === "GET" && req.url === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, version: VERSION }));
      return;
    }

    if (req.method === "GET" && req.url === "/rules") {
      const rulePath = resolve(process.cwd(), "rules", "risk.json");
      const txt = readFileSync(rulePath, "utf8");
      res.setHeader("Content-Type", "application/json");
      res.end(txt);
      return;
    }

    const readBody = async () =>
      new Promise<string>((resolveBody) => {
        let data = "";
        req.setEncoding("utf8");
        req.on("data", (c) => (data += c));
        req.on("end", () => resolveBody(data));
      });

    try {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end("Use POST");
        return;
      }

      const bodyText = await readBody();
      const body = bodyText ? JSON.parse(bodyText) : {};

      if (req.url === "/rules") {
        const expr = String(body.expr ?? "").trim();
        const need = Array.isArray(body.need) ? body.need.map(String) : [];
        const labelIn = (body.label && typeof body.label === "object") ? body.label : {};
        if (!expr) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "expr is required" }));
          return;
        }
        const ruleObj = {
          expr,
          need,
          label: {
            "0": String(labelIn["0"] ?? "REJECT"),
            "M": String(labelIn["M"] ?? "REVIEW"),
            "1": String(labelIn["1"] ?? "APPROVE")
          }
        };
        const dir = resolve(process.cwd(), "rules");
        const rulePath = resolve(dir, "risk.json");
        mkdirSync(dir, { recursive: true });
        writeFileSync(rulePath, JSON.stringify(ruleObj, null, 2) + "\n", "utf8");
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      const triEval = (exprStr: string, env: Record<string, any>) => {
        const assigns = Object.entries(env)
          .map(([k,v]) => `let ${k} = ${String(v)};`)
          .join("\n");
        const program = `${assigns}\nprint (${exprStr});`;
        const tokens = lex(program);
        const ast = parse(tokens);
        const vm = new VM();
        (vm as any).capture = true;
        (vm as any).outputs = [];
        vm.exec(ast);
        const outs: string[] = (vm as any).outputs ?? [];
        return outs[outs.length - 1] ?? "M";
      };

      if (req.url === "/risk") {
        const env = (body.env && typeof body.env === "object") ? body.env : {};
        const rulePath = resolve(process.cwd(), "rules", "risk.json");
        const rule = JSON.parse(readFileSync(rulePath, "utf8"));

        const decision = triEval(String(rule.expr ?? ""), env);

        const needArr: string[] = Array.isArray(rule.need) ? rule.need.map(String) : [];
        const need_list = needArr.filter((k) => String(env[k] ?? "M") === "M");

        const labelMap = (rule.label && typeof rule.label === "object") ? rule.label : {};
        const label = String(labelMap[decision] ?? (decision==="1"?"APPROVE":decision==="0"?"REJECT":"REVIEW"));
        const need = need_list.length;

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ decision, label, need, need_list }));
        return;
      }

      res.statusCode = 404;
      res.end("Not found");
    } catch (e: any) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: String(e?.message ?? e) }));
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`tri server listening on http://127.0.0.1:${port}`);
    console.log(`GET  /health`);
    console.log(`GET  /rules`);
    console.log(`POST /rules`);
    console.log(`POST /risk`);
  });
}
