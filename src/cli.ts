import { readFileSync } from "node:fs";
import http from "node:http";
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { VM } from "./vm.ts";

const VERSION = "0.1.1";

function runFile(file: string) {
  const code = readFileSync(file, "utf8");
  const tokens = lex(code);
  const ast = parse(tokens);
  const vm = new VM();
  vm.exec(ast);
}

function evalExprFor(a: "0"|"M"|"1", b: "0"|"M"|"1", exprStr: string): string {
  const vm = new VM();
  const toTrit = (s: string) => (s === "0" ? 0 : s === "1" ? 1 : 0.5);
  vm.env.set("a", { kind: "trit", v: toTrit(a) } as any);
  vm.env.set("b", { kind: "trit", v: toTrit(b) } as any);

  const code = `print ${exprStr};`;
  const stmt: any = parse(lex(code))[0];
  const val: any = vm.evalExpr(stmt.expr);

  if (val.kind === "trit") return val.v === 0.5 ? "M" : String(val.v);
  return String(val.v);
}

function exprList(exprStr: string) {
  const vals: any[] = [];
  const V: Array<"0"|"M"|"1"> = ["0","M","1"];
  for (const a of V) for (const b of V) vals.push({ a, b, val: evalExprFor(a,b,exprStr) });
  return vals;
}

function exprMatrix(exprStr: string) {
  const V: Array<"0"|"M"|"1"> = ["0","M","1"];
  return {
    expr: exprStr,
    cols: V,
    rows: V.map(a => ({ a, row: V.map(b => evalExprFor(a,b,exprStr)) }))
  };
}

function startServer(port: number) {
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

    const readBody = async () =>
      new Promise<string>((resolve) => {
        let data = "";
        req.setEncoding("utf8");
        req.on("data", (c) => (data += c));
        req.on("end", () => resolve(data));
      });

    try {
      if (req.method !== "POST") { res.statusCode = 405; res.end("Use POST"); return; }
      const bodyText = await readBody();
      const body = bodyText ? JSON.parse(bodyText) : {};

      if (req.url === "/eval") {
        const expr = String(body.expr ?? "");
        const a = String(body.a ?? "M") as any;
        const b = String(body.b ?? "M") as any;
        const val = evalExprFor(a, b, expr);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ val }));
        return;
      }

      if (req.url === "/eval_batch") {
        const expr = String(body.expr ?? "");
        const items = Array.isArray(body.items) ? body.items : [];
        const rows = items.map((it: any) => {
          const a = String(it.a ?? "M") as any;
          const b = String(it.b ?? "M") as any;
          const val = evalExprFor(a,b,expr);
          const row: any = { a, b, val };
          if (it.id !== undefined) row.id = it.id;
          return row;
        });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ rows }));
        return;
      }

      if (req.url === "/table") {
        const expr = String(body.expr ?? "");
        const format = String(body.format ?? "matrix");
        const out = format === "list" ? exprList(expr) : exprMatrix(expr);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(out));
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
  });
}

const args = process.argv.slice(2);

if (args[0] === "--version" || args[0] === "-v") {
  console.log(VERSION);
  process.exit(0);
}

// server mode
if (args[0] === "server") {
  const i = args.indexOf("--port");
  const port = i >= 0 ? Number(args[i+1]) : 7331;
  console.log(`starting tri server on 127.0.0.1:${port} ...`);
  startServer(port);
  setInterval(() => {}, 1 << 30);
} else if (args[0] === "--table") {
  const op = args[1] ?? "";
  const json = args.includes("--json");
  const compact = args.includes("--compact");
  const out = exprMatrix(`a ${op} b`);
  if (!json) {
    console.log("op\t0\tM\t1");
    for (const r of out.rows) console.log(`${r.a}\t${r.row.join("\t")}`);
  } else {
    const payload = compact ? { op, cols: out.cols, rows: out.rows } : out;
    console.log(JSON.stringify(payload, null, compact ? 0 : 2));
  }
  process.exit(0);
} else if (args[0] === "--expr") {
  const list = args.includes("--list");
  const json = args.includes("--json");
  const compact = args.includes("--compact");
  const stdin = args.includes("--stdin");

  let exprStr = "";
  if (stdin) exprStr = readFileSync(0, "utf8").trim();
  else exprStr = args[1] ?? "";

  if (list) {
    const rows = exprList(exprStr);
    if (!json) {
      console.log("a\tb\tval");
      for (const r of rows) console.log(`${r.a}\t${r.b}\t${r.val}`);
    } else {
      console.log(JSON.stringify(rows, null, compact ? 0 : 2));
    }
  } else {
    const v = evalExprFor("M","M",exprStr);
    console.log(json ? JSON.stringify({ val: v }) : v);
  }
  process.exit(0);
} else if (!args[0]) {
  console.log("Usage:\n  tri <file.tri>\n  tri server [--port N]\n  tri --table <op>\n  tri --expr <expr> [--list] [--stdin] [--json] [--compact]\n  tri --version");
  process.exit(0);
} else {
  runFile(args[0]);
}