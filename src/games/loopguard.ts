// Wraps every for/while loop condition in AI-written game code with a call to
// __ogsLoop() (defined by the runtime), so an accidental infinite loop throws
// an error instead of freezing the browser tab. A tiny scanner: it skips
// strings, template literals, comments and regex literals, then rewrites
//   while (c)        -> while (__ogsLoop() && (c))
//   for (a; c; b)    -> for (a; __ogsLoop() && (c); b)
//   for (a;; b)      -> for (a; __ogsLoop(); b)
// for..in / for..of loops are finite and left alone.

const REGEX_PREV = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
const REGEX_KEYWORDS = new Set(["return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "yield", "await"]);

function isIdent(c: string | undefined): boolean {
  return !!c && /[A-Za-z0-9_$]/.test(c);
}

/** Index just past a string/template/comment/regex starting at i, or -1 if none starts here. */
function skipLiteral(src: string, i: number, prevSignificant: string, prevWord: string): number {
  const c = src[i];
  const n = src[i + 1];
  if (c === "/" && n === "/") {
    const e = src.indexOf("\n", i);
    return e < 0 ? src.length : e;
  }
  if (c === "/" && n === "*") {
    const e = src.indexOf("*/", i + 2);
    return e < 0 ? src.length : e + 2;
  }
  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < src.length && src[j] !== c) {
      if (src[j] === "\\") j++;
      else if (src[j] === "\n") break;
      j++;
    }
    return j + 1;
  }
  if (c === "`") {
    let j = i + 1;
    let depth = 0;
    while (j < src.length) {
      if (src[j] === "\\") {
        j += 2;
        continue;
      }
      if (depth === 0 && src[j] === "`") return j + 1;
      if (src[j] === "$" && src[j + 1] === "{") {
        depth++;
        j += 2;
        continue;
      }
      if (depth > 0 && src[j] === "}") depth--;
      else if (depth > 0 && src[j] === "{") depth++;
      j++;
    }
    return j;
  }
  if (c === "/" && (prevSignificant === "" || REGEX_PREV.has(prevSignificant) || REGEX_KEYWORDS.has(prevWord))) {
    let j = i + 1;
    let inClass = false;
    while (j < src.length && src[j] !== "\n") {
      if (src[j] === "\\") {
        j += 2;
        continue;
      }
      if (src[j] === "[") inClass = true;
      else if (src[j] === "]") inClass = false;
      else if (src[j] === "/" && !inClass) {
        j++;
        while (isIdent(src[j])) j++;
        return j;
      }
      j++;
    }
    return j;
  }
  return -1;
}

/** Find the index of the ')' matching the '(' at open, respecting literals. */
function matchParen(src: string, open: number): { close: number; semis: number[] } | null {
  let depth = 0;
  const semis: number[] = [];
  let prev = "(";
  let prevWord = "";
  for (let i = open; i < src.length; ) {
    const lit = skipLiteral(src, i, prev, prevWord);
    if (lit > i) {
      i = lit;
      prev = "a";
      continue;
    }
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return c === ")" ? { close: i, semis } : null;
    } else if (c === ";" && depth === 1) semis.push(i);
    if (!/\s/.test(c)) {
      if (isIdent(c)) {
        let j = i;
        while (isIdent(src[j])) j++;
        prevWord = src.slice(i, j);
        prev = "a";
        i = j;
        continue;
      }
      prev = c;
      prevWord = "";
    }
    i++;
  }
  return null;
}

export function guardLoops(src: string): string {
  const edits: { at: number; end: number; text: string }[] = [];
  let prev = "";
  let prevWord = "";
  for (let i = 0; i < src.length; ) {
    const lit = skipLiteral(src, i, prev, prevWord);
    if (lit > i) {
      i = lit;
      prev = "a";
      prevWord = "";
      continue;
    }
    const c = src[i];
    if (isIdent(c)) {
      let j = i;
      while (isIdent(src[j])) j++;
      const word = src.slice(i, j);
      const before = src[i - 1];
      if ((word === "while" || word === "for") && before !== "." && !isIdent(before)) {
        let k = j;
        while (/\s/.test(src[k] ?? "")) k++;
        if (word === "for" && src.slice(k, k + 5) === "await") {
          i = j;
          prevWord = word;
          prev = "a";
          continue;
        }
        if (src[k] === "(") {
          const m = matchParen(src, k);
          if (m) {
            if (word === "while") {
              edits.push({ at: k + 1, end: m.close, text: `__ogsLoop() && (${src.slice(k + 1, m.close)})` });
            } else if (m.semis.length === 2) {
              const [s1, s2] = m.semis;
              const cond = src.slice(s1 + 1, s2);
              edits.push({ at: s1 + 1, end: s2, text: cond.trim() ? ` __ogsLoop() && (${cond})` : " __ogsLoop()" });
            }
          }
        }
      }
      prevWord = word;
      prev = "a";
      i = j;
      continue;
    }
    if (!/\s/.test(c)) {
      prev = c;
      prevWord = "";
    }
    i++;
  }
  return applyNested(src, edits.sort((a, b) => a.at - b.at));
}

function applyNested(src: string, edits: { at: number; end: number; text: string }[]): string {
  // Edits never partially overlap: each is a loop header range; an inner loop
  // can only sit inside another header if written as a lambda inside a
  // condition (rare). Apply in order, skipping any edit nested in a previous one.
  let out = "";
  let pos = 0;
  for (const e of edits) {
    if (e.at < pos) continue;
    out += src.slice(pos, e.at) + e.text;
    pos = e.end;
  }
  return out + src.slice(pos);
}
