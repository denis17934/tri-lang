import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import http from "node:http";
import { lex } from "./lexer.ts";
import { parse, type Expr } from "./parser.ts";
import { VM } from "./vm.ts";
import { AND, OR, XOR, EQ, IMP, NOT, tritToString, type Trit } from "./trit.ts";

const VERSION = "0.1.0";
const V: Trit[] = [0, 0.5, 1];
const L = (t: Trit) => tritToString(t);

function help() {
  console.log(`tri-lang v${VERSION}

Usage:
  tri <file.tri>                       run file
  tri                                  start REPL
  tri --stdin                          run tri program from stdin
  tri test                             run all .tri files in ./examples (from current directory)

  tri server [--port 7331]             start local HTTP API (localhost)

  tri --table <op>                     truth table for op in {and,or,xor,eq,imp,not}
  tri --table <op> --json [--compact]  JSON output for table

  tri --expr "<expr>"                  eval expr for all (a,b) in {0,M,1}^2 (matrix)
  tri --expr "<expr>" --list           9 lines: a b val
  tri --expr "<expr>" --list --json [--compact]  JSON array [{a,b,val}...]
  tri --expr --stdin [--list] [--json] read expression from stdin

Options:
  --help, -h                           show help
  --version, -v                        show version
  --json                               JSON output (where supported)
  --compact                            JSON in one line

Server:
  GET  /health -> {"ok":true,"version":"0.1.0"}
  POST /eval       {"expr":"a imp b","a":"M","b":"0"} -> {"val":"M"}
  POST /eval_batch {"expr":"a imp b","items":[{"id":1,"a":"M","b":"0"}]} -> {"rows":[...]}
  POST /eval_table {"expr":"a imp b"} -> {"rows":[...]}   (all 9 pairs)
  POST /eval_many_expr {"exprs":["a imp b","a and b"],"a":"1","b":"M"} -> {"vals":[...]}
  POST /table      {"expr":"a imp b","format":"list|matrix"} -> JSON
`);
}

function jsonOut(obj: any, compact: boolean) {
  console.log(compact ? JSON.stringify(obj) : JSON.stringify(obj, null, 2));
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function run(code: string, vm: VM) {
  const tokens = lex(code);
  const ast = parse(tokens);
  vm.exec(ast);
}

function runFile(path: string) {
  const code = readFileSync(path, "utf8");
  const vm = new VM();
  run(code, vm);
}

function runTests() {
  const cwd = process.cwd();
  const examplesDir = resolve(cwd, "examples");
  const files = readdirSync(examplesDir)
    .filter((f) => f.endsWith(".tri"))
    .sort();

  if (files.length === 0) {
    console.error("No .tri files found in ./examples");
    process.exit(1);
  }

  let failed = 0;

  for (const f of files) {
    const full = join(examplesDir, f);
    try {
      runFile(full);
      console.log(`PASS ${f}`);
    } catch (e: any) {
      failed++;
      console.log(`FAIL ${f}: ${String(e?.message ?? e)}`);
    }
  }

  if (failed > 0) process.exit(1);
}

function truthTable(op: string, asJson: boolean, compact: boolean) {
  if (op === "not") {
    const rows = V.map((a) => ({ a: L(a), val: L(NOT(a)) }));
    if (asJson) return jsonOut({ op, rows }, compact);

    console.log(["op", ...V.map(L)].join("\t"));
    for (const r of rows) console.log(`${r.a}\t${r.val}`);
    return;
  }

  const f = (a: Trit, b: Trit): Trit => {
    if (op === "and") return AND(a, b);
    if (op === "or") return OR(a, b);
    if (op === "xor") return XOR(a, b);
    if (op === "eq") return EQ(a, b);
    if (op === "imp") return IMP(a, b);
    throw new Error(`Unknown op for table: ${op}`);
  };

  const rows = V.map((a) => ({
    a: L(a),
    row: V.map((b) => L(f(a, b))),
  }));

  if (asJson) return jsonOut({ op, cols: V.map(L), rows }, compact);

  console.log(["op", ...V.map(L)].join("\t"));
  for (const r of rows) console.log([r.a, ...r.row].join("\t"));
}

function parseExprFromString(exprStr: string): Expr {
  const code = `print (${exprStr});`;
  const tokens = lex(code);
  const ast = parse(tokens);
  const first: any = ast[0];
  if (!first || first.type !== "print") throw new Error("Failed to parse expression");
  return first.expr as Expr;
}

function parseAB(x: any): Trit {
  if (x === 0 || x === "0") return 0;
  if (x === 1 || x === "1") return 1;
  if (x === 0.5 || x === "0.5" || x === "M" || x === "m") return 0.5;
  throw new Error(`Bad trit value: ${x} (use 0, M, 1)`);
}

function evalExprFor(a: Trit, b: Trit, expr: Expr): Trit {
  const vm = new VM();
  const env = new Map<string, Trit>([
    ["a", a],
    ["b", b],
  ]);
  return vm.evalExpr(expr as any, env);
}

function exprList(exprStr: string) {
  const expr = parseExprFromString(exprStr);
  const rows: Array<{ a: string; b: string; val: string }> = [];
  for (const a of V) for (const b of V) rows.push({ a: L(a), b: L(b), val: L(evalExprFor(a, b, expr)) });
  return rows;
}

function exprMatrix(exprStr: string) {
  const expr = parseExprFromString(exprStr);
  const rows = V.map((a) => ({
    a: L(a),
    row: V.map((b) => L(evalExprFor(a, b, expr))),
  }));
  return { expr: exprStr, cols: V.map(L), rows };
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
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end("Use POST");
        return;
      }

      const bodyText = await readBody();
      const body = bodyText ? JSON.parse(bodyText) : {};

      if (req.url === "/eval") {
        const exprStr = String(body.expr ?? "");
        const a = parseAB(body.a);
        const b = parseAB(body.b);
        const expr = parseExprFromString(exprStr);
        const val = L(evalExprFor(a, b, expr));
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ val }));
        return;
      }

      if (req.url === "/eval_batch") {
        const exprStr = String(body.expr ?? "");
        const items = Array.isArray(body.items) ? body.items : [];
        const expr = parseExprFromString(exprStr);

        const rows = items.map((it: any) => {
          const aT = parseAB(it.a);
          const bT = parseAB(it.b);
          const val = L(evalExprFor(aT, bT, expr));
          const row: any = { a: L(aT), b: L(bT), val };
          if (it.id !== undefined) row.id = it.id;
          return row;
        });

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ rows }));
        return;
      }

      if (req.url === "/eval_table") {
        const exprStr = String(body.expr ?? "");
        const expr = parseExprFromString(exprStr);

        const rows: Array<{ a: string; b: string; val: string }> = [];
        for (const a of V) {
          for (const b of V) {
            rows.push({ a: L(a), b: L(b), val: L(evalExprFor(a, b, expr)) });
          }
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ rows }));
        return;
      }

      if (req.url === "/eval_many_expr") {
        const exprs = Array.isArray(body.exprs) ? body.exprs : [];
        const a = parseAB(body.a);
        const b = parseAB(body.b);

        const vals = exprs.map((e: any) => {
          const exprStr = String(e);
          const expr = parseExprFromString(exprStr);
          return { expr: exprStr, val: L(evalExprFor(a, b, expr)) };
        });

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ vals }));
        return;
      }

      if (req.url === "/table") {
        const exprStr = String(body.expr ?? "");
        const format = String(body.format ?? "matrix"); // list|matrix
        const out = format === "list" ? exprList(exprStr) : exprMatrix(exprStr);
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

  server.on("error", (err) => {
    console.error("server error:", (err as any).message ?? err);
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`tri server listening on http://127.0.0.1:${port}`);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) { help(); process.exit(0); }
  if (args.includes("--version") || args.includes("-v")) { console.log(VERSION); process.exit(0); }

  const compact = args.includes("--compact");
  const asJson = args.includes("--json");
  const stdinMode = args.includes("--stdin");

  if (args[0] === "server") {
    const pIdx = args.indexOf("--port");
    const port = pIdx !== -1 ? Number(args[pIdx + 1]) : 7331;
    const p = Number.isFinite(port) ? port : 7331;
    console.log(`starting tri server on 127.0.0.1:${p} ...`);
    startServer(p);
    return;
  }

  if (args[0] === "test") { runTests(); process.exit(0); }

  const tableIdx = args.indexOf("--table");
  if (tableIdx !== -1) {
    const op = args[tableIdx + 1];
    if (!op) { console.error("Missing op. Use: tri --table and|or|xor|eq|imp|not"); process.exit(1); }
    truthTable(op, asJson, compact);
    process.exit(0);
  }

  const exprIdx = args.indexOf("--expr");
  if (exprIdx !== -1) {
    let exprStr = args[exprIdx + 1];
    const asList = args.includes("--list");

    if (!exprStr || exprStr.startsWith("--") || stdinMode) exprStr = (await readStdin()).trim();
    if (!exprStr) { console.error('Missing expression. Example: tri --expr "a imp b" --list --json'); process.exit(1); }

    if (asList) {
      const rows = exprList(exprStr);
      if (asJson) jsonOut(rows, compact);
      else {
        console.log("a\tb\tval");
        for (const r of rows) console.log(`${r.a}\t${r.b}\t${r.val}`);
      }
    } else {
      const out = exprMatrix(exprStr);
      if (asJson) jsonOut(out, compact);
      else {
        console.log(`expr\t${out.cols.join("\t")}`);
        for (const r of out.rows) console.log([r.a, ...r.row].join("\t"));
      }
    }

    process.exit(0);
  }

  if (stdinMode) {
    const code = await readStdin();
    const vm = new VM();
    run(code, vm);
    process.exit(0);
  }

  const file = args[0];
  if (file) {
    runFile(file);
    process.exit(0);
  }

  // REPL
  const vm = new VM();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("tri REPL. Type statements like: let a = 1;  |  print a xor M;  |  Ctrl+C to exit");
  rl.setPrompt("tri> ");
  rl.prompt();

  rl.on("line", (line) => {
    const src = line.trim();
    if (!src) { rl.prompt(); return; }

    try {
      const needsSemi =
        !src.endsWith(";") &&
        !src.endsWith("}") &&
        !src.startsWith("fn ") &&
        !src.startsWith("if ");

      const code = needsSemi ? src + ";" : src;
      run(code, vm);
    } catch (e: any) {
      console.error(String(e?.message ?? e));
    }

    rl.prompt();
  });
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});