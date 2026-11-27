import { describe, expect, it } from "vitest";
import { guardLoops } from "../../src/games/loopguard";

function runGuarded(code: string, limit = 1000): unknown {
  let n = 0;
  const __ogsLoop = () => {
    if (++n > limit) throw new Error("Infinite loop stopped");
    return true;
  };
  return new Function("__ogsLoop", guardLoops(code))(__ogsLoop);
}

describe("guardLoops", () => {
  it("stops while(true), for(;;) and do/while", () => {
    expect(() => runGuarded("while (true) {}")).toThrow(/Infinite/);
    expect(() => runGuarded("for (;;) {}")).toThrow(/Infinite/);
    expect(() => runGuarded("let i = 0; do { i++ } while (i > -1)")).toThrow(/Infinite/);
    expect(() => runGuarded("for (let i = 0; i >= 0; i++) x = i; var x;")).toThrow(/Infinite/);
  });
  it("leaves finite loops working", () => {
    expect(runGuarded("let s = 0; for (let i = 0; i < 10; i++) { s += i } return s")).toBe(45);
    expect(runGuarded("let s = 0, i = 0; while (i < 5) s += i++; return s")).toBe(10);
    expect(runGuarded("let s = 0; for (const v of [1,2,3]) s += v; for (const k in {a:1,b:2}) s += k.length; return s")).toBe(8);
    expect(runGuarded("let s=0; for (let i=0;i<3;i++) for (let j=0;j<3;j++) s++; return s")).toBe(9);
  });
  it("ignores loop words inside strings, comments, regexes and properties", () => {
    const code = `
      // while (true) {}
      /* for (;;) {} */
      const a = "while (x)"; const b = 'for (;;)'; const c = \`for (;;) \${1 + 1}\`;
      const r = /while\\s*\\(/g; const o = { while: 1, for: 2 }; const d = o.while + o.for;
      return [a, b, c, r.source, d].join("|");`;
    expect(guardLoops(code)).not.toContain("__ogsLoop");
    expect(runGuarded(code)).toBe('while (x)|for (;;)|for (;;) 2|while\\s*\\(|3');
  });
  it("handles division vs regex", () => {
    expect(runGuarded("let a = 10, b = 2, g = 1; let s = 0; for (let i = 0; i < a / b / g; i++) s++; return s")).toBe(5);
  });
});
