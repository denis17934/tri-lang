import type { Token } from "./lexer.ts";

export type Expr =
  | { type: "lit"; value: "0" | "M" | "1" }
  | { type: "var"; name: string }
  | { type: "call"; name: string; args: Expr[] }
  | { type: "un"; op: "not"; a: Expr }
  | { type: "bin"; op: "and" | "or" | "xor" | "eq" | "imp"; a: Expr; b: Expr };

export type Stmt =
  | { type: "let"; name: string; expr: Expr }
  | { type: "set"; name: string; expr: Expr }
  | { type: "print"; expr: Expr }
  | { type: "assert"; expr: Expr }
  | { type: "check"; expr: Expr }
  | { type: "return"; expr: Expr }
  | { type: "fn"; name: string; params: string[]; body: Stmt[] }
  | { type: "if"; cond: Expr; thenBlock: Stmt[]; maybeBlock: Stmt[]; elseBlock: Stmt[] };

export function parse(tokens: Token[]): Stmt[] {
  let p = 0;
  const peek = () => tokens[p];
  const eat = () => tokens[p++];

  function expect(kind: Token["kind"], value?: any): Token {
    const t = peek();
    if (!t || t.kind !== kind) throw new Error(`Expected ${kind} got ${t ? t.kind : "EOF"}`);
    if (value !== undefined) {
      // @ts-ignore
      if (t.value !== value) throw new Error(`Expected ${kind}(${value}) got ${kind}(${(t as any).value})`);
    }
    return eat();
  }

  function parseBlock(): Stmt[] {
    expect("sym", "{");
    const out: Stmt[] = [];
    while (peek() && !(peek().kind === "sym" && (peek() as any).value === "}")) {
      out.push(parseStmt());
    }
    expect("sym", "}");
    return out;
  }

  function parseExpr(): Expr {
    return parseOrXorEqImp();
  }

  // precedence: not > and > (or/xor/eq/imp/==)
  function parseOrXorEqImp(): Expr {
    let left = parseAnd();

    while (true) {
      const t = peek();

      // keyword ops
      if (
        t?.kind === "kw" &&
        (
          (t as any).value === "or" ||
          (t as any).value === "xor" ||
          (t as any).value === "eq" ||
          (t as any).value === "imp"
        )
      ) {
        const op = (eat() as any).value as "or" | "xor" | "eq" | "imp";
        const right = parseAnd();
        left = { type: "bin", op, a: left, b: right };
        continue;
      }

      // symbol alias: ==
      if (t?.kind === "sym" && (t as any).value === "==") {
        eat();
        const right = parseAnd();
        left = { type: "bin", op: "eq", a: left, b: right };
        continue;
      }

      break;
    }

    return left;
  }

  function parseAnd(): Expr {
    let left = parseUnary();
    while (peek()?.kind === "kw" && (peek() as any).value === "and") {
      eat();
      const right = parseUnary();
      left = { type: "bin", op: "and", a: left, b: right };
    }
    return left;
  }

  function parseUnary(): Expr {
    if (peek()?.kind === "kw" && (peek() as any).value === "not") {
      eat();
      const a = parseUnary();
      return { type: "un", op: "not", a };
    }
    return parsePrimary();
  }

  function parsePrimary(): Expr {
    const t = peek();
    if (!t) throw new Error("Unexpected EOF in expression");

    if (t.kind === "num") {
      eat();
      return { type: "lit", value: t.value as "0" | "1" };
    }
    if (t.kind === "M") {
      eat();
      return { type: "lit", value: "M" };
    }

    if (t.kind === "id") {
      const name = eat().value;

      if (peek()?.kind === "sym" && (peek() as any).value === "(") {
        eat(); // (
        const args: Expr[] = [];
        if (!(peek()?.kind === "sym" && (peek() as any).value === ")")) {
          args.push(parseExpr());
          while (peek()?.kind === "sym" && (peek() as any).value === ",") {
            eat();
            args.push(parseExpr());
          }
        }
        expect("sym", ")");
        return { type: "call", name, args };
      }

      return { type: "var", name };
    }

    if (t.kind === "sym" && (t as any).value === "(") {
      eat();
      const e = parseExpr();
      expect("sym", ")");
      return e;
    }

    throw new Error(`Unexpected token in primary: ${t.kind}`);
  }

  function parseParams(): string[] {
    expect("sym", "(");
    const params: string[] = [];
    if (!(peek()?.kind === "sym" && (peek() as any).value === ")")) {
      params.push(expect("id").value);
      while (peek()?.kind === "sym" && (peek() as any).value === ",") {
        eat();
        params.push(expect("id").value);
      }
    }
    expect("sym", ")");
    return params;
  }

  function parseStmt(): Stmt {
    const t = peek();
    if (!t) throw new Error("Unexpected EOF in statement");

    if (t.kind === "kw" && t.value === "fn") {
      eat();
      const name = expect("id").value;
      const params = parseParams();
      const body = parseBlock();
      return { type: "fn", name, params, body };
    }

    if (t.kind === "kw" && t.value === "return") {
      eat();
      const expr = parseExpr();
      expect("sym", ";");
      return { type: "return", expr };
    }

    if (t.kind === "kw" && t.value === "let") {
      eat();
      const name = expect("id").value;
      expect("sym", "=");
      const expr = parseExpr();
      expect("sym", ";");
      return { type: "let", name, expr };
    }

    if (t.kind === "kw" && t.value === "print") {
      eat();
      const expr = parseExpr();
      expect("sym", ";");
      return { type: "print", expr };
    }

    if (t.kind === "kw" && t.value === "assert") {
      eat();
      const expr = parseExpr();
      expect("sym", ";");
      return { type: "assert", expr };
    }

    if (t.kind === "kw" && t.value === "check") {
      eat();
      const expr = parseExpr();
      expect("sym", ";");
      return { type: "check", expr };
    }

    if (t.kind === "kw" && t.value === "if") {
      eat();
      const cond = parseExpr();
      const thenBlock = parseBlock();
      expect("kw", "maybe");
      const maybeBlock = parseBlock();
      expect("kw", "else");
      const elseBlock = parseBlock();
      return { type: "if", cond, thenBlock, maybeBlock, elseBlock };
    }

    if (t.kind === "id") {
      const name = eat().value;
      expect("sym", "=");
      const expr = parseExpr();
      expect("sym", ";");
      return { type: "set", name, expr };
    }

    throw new Error(`Unknown statement starting with ${t.kind}`);
  }

  const prog: Stmt[] = [];
  while (p < tokens.length) prog.push(parseStmt());
  return prog;
}