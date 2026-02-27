export type Trit = 0 | 0.5 | 1;

export const T0: Trit = 0;
export const TM: Trit = 0.5;
export const T1: Trit = 1;

export function parseTrit(s: string): Trit {
  if (s === "0") return 0;
  if (s === "M") return 0.5;
  if (s === "1") return 1;
  throw new Error(`Invalid trit literal: ${s}`);
}

export function tritToString(t: Trit): string {
  return t === 0.5 ? "M" : String(t);
}

export function NOT(a: Trit): Trit {
  return (1 - a) as Trit;
}

export function AND(a: Trit, b: Trit): Trit {
  return Math.min(a, b) as Trit;
}

export function OR(a: Trit, b: Trit): Trit {
  return Math.max(a, b) as Trit;
}

export function XOR(a: Trit, b: Trit): Trit {
  return Math.abs(a - b) as Trit;
}

export function EQ(a: Trit, b: Trit): Trit {
  return (1 - Math.abs(a - b)) as Trit;
}

// implication: a -> b = (not a) or b
export function IMP(a: Trit, b: Trit): Trit {
  return OR(NOT(a), b);
}