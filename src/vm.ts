import type { Expr, Stmt } from "./parser.ts";
import { AND, NOT, OR, XOR, EQ, IMP, parseTrit, tritToString, type Trit } from "./trit.ts";

class ReturnSignal {
  constructor(public value: Trit) {}
}

type FnDef = { params: string[]; body: Stmt[] };

export class VM {
  env = new Map<string, Trit>();
  fns = new Map<string, FnDef>();

  evalExpr(e: Expr, localEnv?: Map<string, Trit>): Trit {
    const scope = localEnv ?? this.env;

    switch (e.type) {
      case "lit": return parseTrit(e.value);

      case "var": {
        if (scope.has(e.name)) return scope.get(e.name)!;
        if (this.env.has(e.name)) return this.env.get(e.name)!;
        throw new Error(`Undefined variable: ${e.name}`);
      }

      case "call": {
        const fn = this.fns.get(e.name);
        if (!fn) throw new Error(`Undefined function: ${e.name}`);

        if (e.args.length !== fn.params.length) {
          throw new Error(`Arity mismatch: ${e.name} expects ${fn.params.length}, got ${e.args.length}`);
        }

        const callEnv = new Map<string, Trit>();
        for (let i = 0; i < fn.params.length; i++) {
          callEnv.set(fn.params[i], this.evalExpr(e.args[i], scope));
        }

        try {
          this.exec(fn.body, callEnv);
          return 0.5;
        } catch (err) {
          if (err instanceof ReturnSignal) return err.value;
          throw err;
        }
      }

      case "un":
        return NOT(this.evalExpr(e.a, scope));

      case "bin": {
        const a = this.evalExpr(e.a, scope);
        const b = this.evalExpr(e.b, scope);
        if (e.op === "and") return AND(a, b);
        if (e.op === "or") return OR(a, b);
        if (e.op === "xor") return XOR(a, b);
        if (e.op === "eq") return EQ(a, b);
        if (e.op === "imp") return IMP(a, b);
        throw new Error(`Unknown bin op: ${e.op}`);
      }
    }
  }

  exec(stmts: Stmt[], localEnv?: Map<string, Trit>): void {
    for (const s of stmts) this.execStmt(s, localEnv);
  }

  execStmt(s: Stmt, localEnv?: Map<string, Trit>): void {
    const scope = localEnv ?? this.env;

    switch (s.type) {
      case "fn": {
        this.fns.set(s.name, { params: s.params, body: s.body });
        return;
      }

      case "return": {
        const v = this.evalExpr(s.expr, scope);
        throw new ReturnSignal(v);
      }

      case "let": {
        if (scope.has(s.name)) throw new Error(`Already defined: ${s.name}`);
        scope.set(s.name, this.evalExpr(s.expr, scope));
        return;
      }

      case "set": {
        if (localEnv && localEnv.has(s.name)) {
          localEnv.set(s.name, this.evalExpr(s.expr, scope));
          return;
        }
        if (this.env.has(s.name)) {
          this.env.set(s.name, this.evalExpr(s.expr, scope));
          return;
        }
        throw new Error(`Undefined variable: ${s.name}`);
      }

      case "print": {
        const v = this.evalExpr(s.expr, scope);
        console.log(tritToString(v));
        return;
      }

      case "assert": {
        const v = this.evalExpr(s.expr, scope);
        if (v !== 1) throw new Error(`ASSERT FAILED (expected 1, got ${tritToString(v)})`);
        return;
      }

      case "check": {
        const v = this.evalExpr(s.expr, scope);
        if (v === 1) console.log("OK");
        else console.log(`FAIL:${tritToString(v)}`);
        return;
      }

      case "if": {
        const c = this.evalExpr(s.cond, scope);
        if (c === 1) return this.exec(s.thenBlock, localEnv);
        if (c === 0.5) return this.exec(s.maybeBlock, localEnv);
        return this.exec(s.elseBlock, localEnv);
      }
    }
  }
}