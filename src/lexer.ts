export type Token =
  | { kind: "num"; value: string }
  | { kind: "M" }
  | { kind: "id"; value: string }
  | { kind: "kw"; value: "let" | "print" | "assert" | "check" | "if" | "maybe" | "else" | "not" | "and" | "or" | "xor" | "eq" | "imp" | "fn" | "return" }
  | { kind: "sym"; value: "=" | "==" | ";" | "," | "(" | ")" | "{" | "}" };

const KW = new Set(["let","print","assert","check","if","maybe","else","not","and","or","xor","eq","imp","fn","return"]);

export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const isSpace = (c: string) => /\s/.test(c);
  const isAlpha = (c: string) => /[A-Za-z_]/.test(c);
  const isAlnum = (c: string) => /[A-Za-z0-9_]/.test(c);

  while (i < input.length) {
    const c = input[i];

    // comments
    if (c === "/" && input[i + 1] === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }

    if (isSpace(c)) { i++; continue; }

    // ==
    if (c === "=" && input[i + 1] === "=") {
      tokens.push({ kind: "sym", value: "==" });
      i += 2;
      continue;
    }

    if (c === "0" || c === "1") {
      tokens.push({ kind: "num", value: c });
      i++;
      continue;
    }

    if (c === "M") {
      tokens.push({ kind: "M" });
      i++;
      continue;
    }

    if (isAlpha(c)) {
      let j = i + 1;
      while (j < input.length && isAlnum(input[j])) j++;
      const word = input.slice(i, j);
      if (KW.has(word)) tokens.push({ kind: "kw", value: word as any });
      else tokens.push({ kind: "id", value: word });
      i = j;
      continue;
    }

    const symSet = new Set(["=", ";", ",", "(", ")", "{", "}"]);
    if (symSet.has(c)) {
      tokens.push({ kind: "sym", value: c as any });
      i++;
      continue;
    }

    throw new Error(`Unexpected char '${c}' at ${i}`);
  }

  return tokens;
}