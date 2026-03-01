import type { Expr, Stmt } from "./parser.ts";
import { AND, NOT, OR, XOR, EQ, IMP, parseTrit, tritToString, type Trit } from "./trit.ts";
import { writeFileSync } from "node:fs";

type Value =
  | { kind: "trit"; v: Trit }
  | { kind: "int"; v: number };

const Vt = (v: Trit): Value => ({ kind: "trit", v });
const Vi = (v: number): Value => ({ kind: "int", v });

function asTrit(x: Value): Trit {
  if (x.kind === "trit") return x.v;
  if (x.kind === "int" && (x.v === 0 || x.v === 1)) return x.v as Trit;
  throw new Error("Expected trit (0/M/1)");
}
function asInt(x: Value): number {
  if (x.kind === "int") return x.v;
  if (x.kind === "trit" && (x.v === 0 || x.v === 1)) return x.v as number;
  throw new Error("Expected int");
}
function truthyToTrit(x: Value): Trit {
  if (x.kind === "trit") return x.v;
  return x.v === 0 ? 0 : 1;
}
function valueToString(x: Value): string {
  return x.kind === "trit" ? tritToString(x.v) : String(x.v);
}

class ReturnSignal { constructor(public value: Value) {} }
type FnDef = { params: string[]; body: Stmt[] };

export class VM {
  env = new Map<string, Value>();
  fns = new Map<string, FnDef>();

  heap: Value[] = [];

  private heapCheck(addr: number) {
    if (!Number.isInteger(addr) || addr < 0 || addr >= this.heap.length) {
      throw new Error(`heap: bad address ${addr} (0..${this.heap.length - 1})`);
    }
  }

  private callBuiltin(name: string, args: Value[]): Value | null {
    // heap
    if (name === "alloc") {
      if (args.length !== 1) throw new Error("alloc expects 1 arg");
      const n = asInt(args[0]);
      if (n < 0) throw new Error("alloc: n must be >= 0");
      const base = this.heap.length;
      for (let i = 0; i < n; i++) this.heap.push(Vt(0.5));
      return Vi(base);
    }
    if (name === "load") {
      if (args.length !== 1) throw new Error("load expects 1 arg");
      const addr = asInt(args[0]);
      this.heapCheck(addr);
      return this.heap[addr];
    }
    if (name === "store") {
      if (args.length !== 2) throw new Error("store expects 2 args");
      const addr = asInt(args[0]);
      this.heapCheck(addr);
      this.heap[addr] = args[1];
      return args[1];
    }

    // digits_fact
    if (name === "digits_fact") {
      if (args.length !== 1) throw new Error("digits_fact expects 1 arg");
      const n = asInt(args[0]);
      if (n < 0) return Vt(0.5);
      if (n <= 1) return Vi(1);
      const x =
        n * (Math.log10(n) - Math.log10(Math.E)) +
        0.5 * Math.log10(2 * Math.PI * n);
      return Vi(Math.floor(x) + 1);
    }

    // fact_mod
    if (name === "fact_mod") {
      if (args.length !== 2) throw new Error("fact_mod expects 2 args");
      const n = asInt(args[0]);
      const p = asInt(args[1]);
      if (p <= 0) throw new Error("fact_mod: p must be > 0");
      if (n < 0) return Vt(0.5);
      if (n === 0 || n === 1) return Vi(1 % p);

      const mod = BigInt(p);
      let acc = 1n;
      for (let k = 2; k <= n; k++) {
        acc = (acc * BigInt(k)) % mod;
        if (acc === 0n) break;
      }
      return Vi(Number(acc));
    }

    // ✅ fact_file(n): writes n! to ./fact_<n>.txt, returns digit count
    if (name === "fact_file") {
      if (args.length !== 1) throw new Error("fact_file expects 1 arg");
      const n = asInt(args[0]);
      if (n < 0) return Vt(0.5);

      let acc = 1n;
      for (let k = 2; k <= n; k++) acc *= BigInt(k);

      const s = acc.toString();
      const path = `fact_${n}.txt`;
      writeFileSync(path, s, "utf8");
      return Vi(s.length);
    }

    return null;
  }

  evalExpr(e: Expr, localEnv?: Map<string, Value>): Value {
    const scope = localEnv ?? this.env;

    switch (e.type) {
      case "lit": return Vt(parseTrit(e.value));
      case "int": return Vi(e.value);

      case "var": {
        if (scope.has(e.name)) return scope.get(e.name)!;
        if (this.env.has(e.name)) return this.env.get(e.name)!;
        throw new Error(`Undefined variable: ${e.name}`);
      }

      case "call": {
        const argVals = e.args.map(a => this.evalExpr(a, scope));
        const builtin = this.callBuiltin(e.name, argVals);
        if (builtin) return builtin;

        const fn = this.fns.get(e.name);
        if (!fn) throw new Error(`Undefined function: ${e.name}`);

        if (argVals.length !== fn.params.length) {
          throw new Error(`Arity mismatch: ${e.name} expects ${fn.params.length}, got ${argVals.length}`);
        }

        const callEnv = new Map<string, Value>();
        for (let i = 0; i < fn.params.length; i++) callEnv.set(fn.params[i], argVals[i]);

        try {
          this.exec(fn.body, callEnv);
          return Vt(0.5);
        } catch (err) {
          if (err instanceof ReturnSignal) return err.value;
          throw err;
        }
      }

      case "un": {
        const a = this.evalExpr(e.a, scope);
        if (e.op === "not") return Vt(NOT(asTrit(a)));
        if (e.op === "neg") return Vi(-asInt(a));
        throw new Error(`Unknown unary op: ${e.op}`);
      }

      case "bin": {
        const a = this.evalExpr(e.a, scope);
        const b = this.evalExpr(e.b, scope);

        if (e.op === "and") return Vt(AND(asTrit(a), asTrit(b)));
        if (e.op === "or") return Vt(OR(asTrit(a), asTrit(b)));
        if (e.op === "xor") return Vt(XOR(asTrit(a), asTrit(b)));
        if (e.op === "imp") return Vt(IMP(asTrit(a), asTrit(b)));

        if (e.op === "eq") {
          if (a.kind === "trit" && b.kind === "trit") return Vt(EQ(a.v, b.v));
          if (a.kind === "int" && b.kind === "int") return Vt(a.v === b.v ? 1 : 0);
          throw new Error("eq requires same kind");
        }

        if (e.op === "+") return Vi(asInt(a) + asInt(b));
        if (e.op === "-") return Vi(asInt(a) - asInt(b));
        if (e.op === "*") return Vi(asInt(a) * asInt(b));
        if (e.op === "/") return Vi(Math.trunc(asInt(a) / asInt(b)));

        if (e.op === "<") return Vt(asInt(a) < asInt(b) ? 1 : 0);
        if (e.op === "<=") return Vt(asInt(a) <= asInt(b) ? 1 : 0);
        if (e.op === ">") return Vt(asInt(a) > asInt(b) ? 1 : 0);
        if (e.op === ">=") return Vt(asInt(a) >= asInt(b) ? 1 : 0);
        if (e.op === "!=") return Vt(asInt(a) !== asInt(b) ? 1 : 0);

        throw new Error(`Unknown bin op: ${e.op}`);
      }
    }
  }

  exec(stmts: Stmt[], localEnv?: Map<string, Value>): void {
    for (const s of stmts) this.execStmt(s, localEnv);
  }

  execStmt(s: Stmt, localEnv?: Map<string, Value>): void {
    const scope = localEnv ?? this.env;

    switch (s.type) {
      case "fn": this.fns.set(s.name, { params: s.params, body: s.body }); return;
      case "return": throw new ReturnSignal(this.evalExpr(s.expr, scope));

      case "let":
        if (scope.has(s.name)) throw new Error(`Already defined: ${s.name}`);
        scope.set(s.name, this.evalExpr(s.expr, scope));
        return;

      case "set":
        if (localEnv && localEnv.has(s.name)) { localEnv.set(s.name, this.evalExpr(s.expr, scope)); return; }
        if (this.env.has(s.name)) { this.env.set(s.name, this.evalExpr(s.expr, scope)); return; }
        throw new Error(`Undefined variable: ${s.name}`);

      case "expr":
        this.evalExpr(s.expr, scope);
        return;

      case "print":
        console.log(valueToString(this.evalExpr(s.expr, scope)));
        return;

      case "assert": {
        const t = truthyToTrit(this.evalExpr(s.expr, scope));
        if (t !== 1) throw new Error(`ASSERT FAILED (expected 1, got ${tritToString(t)})`);
        return;
      }

      case "check": {
        const t = truthyToTrit(this.evalExpr(s.expr, scope));
        console.log(t === 1 ? "OK" : `FAIL:${tritToString(t)}`);
        return;
      }

      case "if": {
        const c = truthyToTrit(this.evalExpr(s.cond, scope));
        if (c === 1) return this.exec(s.thenBlock, localEnv);
        if (c === 0.5) return this.exec(s.maybeBlock, localEnv);
        return this.exec(s.elseBlock, localEnv);
      }

      case "while": {
        while (true) {
          const c = truthyToTrit(this.evalExpr(s.cond, scope));
          if (c !== 1) break;
          this.exec(s.body, localEnv);
        }
        return;
      }
    }
  }
}