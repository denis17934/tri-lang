export type Token =
  | { kind: "int"; value: string }       // 0..9...
  | { kind: "num"; value: string }       // trit 0,1
  | { kind: "M" }                        // trit M
  | { kind: "id"; value: string }
  | { kind: "kw"; value: "let"|"print"|"assert"|"check"|"if"|"maybe"|"else"|"while"|"not"|"and"|"or"|"xor"|"eq"|"imp"|"fn"|"return" }
  | { kind: "sym"; value: "="|"=="|";"|","|"("|")"|"{"|"}"|"+"|"-"|"*"|"/"|"<"|"<="|">"|">="|"!=" };

const KW = new Set(["let","print","assert","check","if","maybe","else","while","not","and","or","xor","eq","imp","fn","return"]);

export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const isSpace = (c: string) => /\s/.test(c);
  const isAlpha = (c: string) => /[A-Za-z_]/.test(c);
  const isAlnum = (c: string) => /[A-Za-z0-9_]/.test(c);
  const isDigit = (c: string) => /[0-9]/.test(c);

  while (i < input.length) {
    const c = input[i];

    // comments
    if (c === "/" && input[i + 1] === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }

    if (isSpace(c)) { i++; continue; }

    // two-char symbols
    const two = input.slice(i, i + 2);
    if (two === "==") { tokens.push({ kind: "sym", value: "==" }); i += 2; continue; }
    if (two === "<=") { tokens.push({ kind: "sym", value: "<=" }); i += 2; continue; }
    if (two === ">=") { tokens.push({ kind: "sym", value: ">=" }); i += 2; continue; }
    if (two === "!=") { tokens.push({ kind: "sym", value: "!=" }); i += 2; continue; }

    // numbers (ints)
    if (isDigit(c)) {
      let j = i + 1;
      while (j < input.length && isDigit(input[j])) j++;
      const num = input.slice(i, j);
      if (num === "0" || num === "1") tokens.push({ kind: "num", value: num });
      else tokens.push({ kind: "int", value: num });
      i = j;
      continue;
    }

    // trit M
    if (c === "M") {
      tokens.push({ kind: "M" });
      i++;
      continue;
    }

    // identifiers / keywords
    if (isAlpha(c)) {
      let j = i + 1;
      while (j < input.length && isAlnum(input[j])) j++;
      const word = input.slice(i, j);
      if (KW.has(word)) tokens.push({ kind: "kw", value: word as any });
      else tokens.push({ kind: "id", value: word });
      i = j;
      continue;
    }

    // one-char symbols
    const symSet = new Set(["=",";","(",")","{","}",",","+","-","*","/","<",">"]);
    if (symSet.has(c)) {
      tokens.push({ kind: "sym", value: c as any });
      i++;
      continue;
    }

    throw new Error(`Unexpected char '${c}' at ${i}`);
  }

  return tokens;
}