import { describe, expect, it } from "vitest";
import { parsePitch, PITCH_IDEAS } from "../../src/brain/pitch";

describe("parsePitch", () => {
  it("reads the example pitch", () => {
    const p = parsePitch("a pigeon delivering pizza in a storm");
    expect(p.hero).toMatchObject({ word: "pigeon", shape: "bird" });
    expect(p.item).toMatchObject({ word: "pizza", shape: "pizza" });
    expect(p.genre).toBe("courier");
    expect(p.weather).toBe("storm");
    expect(p.mods).toContain("wind");
    expect(p.hazard.shape).toBe("bolt");
  });

  it("handles unknown heroes with a blob", () => {
    const p = parsePitch("a capybara collecting oranges in a hot spring");
    expect(p.hero).toMatchObject({ word: "capybara", shape: "blob", known: false });
    expect(p.genre).toBe("maze");
  });

  it("finds places, mods and hazards", () => {
    const p = parsePitch("a sleepy ghost collecting lost socks in a haunted library");
    expect(p.hero.shape).toBe("ghost");
    expect(p.item.word).toBe("sock");
    expect(p.place).toBe("library");
    expect(p.mods).toEqual(expect.arrayContaining(["slow", "night", "haunted"]));
  });

  it("is deterministic and never throws on odd input", () => {
    for (const s of [...PITCH_IDEAS, "", "!!!", "x", "the the the", "🍕🍕", "a".repeat(500), "<script>alert(1)</script>"]) {
      const a = parsePitch(s);
      const b = parsePitch(s);
      expect(a).toEqual(b);
      expect(a.hero.word.length).toBeGreaterThan(0);
      expect(a.pitch.length).toBeLessThanOrEqual(120);
    }
  });

  it("maps every example pitch to a sensible genre", () => {
    const genres = PITCH_IDEAS.map((s) => [s, parsePitch(s).genre, parsePitch(s).hero.word, parsePitch(s).item.word, parsePitch(s).hazard.word]);
    console.table(genres);
    expect(new Set(genres.map((g) => g[1])).size).toBeGreaterThanOrEqual(6);
  });
});
