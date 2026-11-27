import { describe, expect, it } from "vitest";
import { parsePitch, PITCH_IDEAS, GENRE_CONTROLS } from "../../src/brain/pitch";
import {
  newWriterCtx, kickoffLines, designLines, buildLines, buildDoneLines, artLines, playtestIntro, playtestLines,
  fixLines, polishLines, shipLines, makeDoc, fillerLine, type Line,
} from "../../src/brain/writer";
import { pickPalette } from "../../src/games/palettes";
import type { PlaytestReport } from "../../src/types";

const lore = () => ({ gamesShipped: 3, bugJar: 40, v2Ideas: 212, duckApprovals: 90, gerald: 4, lastTitles: [] });
const pass: PlaytestReport = { pass: true, checks: [{ name: "Boots", ok: true, detail: "ok" }], errors: [], frames: 900, msPerFrame: 0.5, survivedSeconds: 12.5, score: 140 };
const fail: PlaytestReport = { pass: false, checks: [{ name: "Controls", ok: false, detail: "Pressing left does nothing." }], errors: [], frames: 900, msPerFrame: 0.5, survivedSeconds: 1.2, score: 0 };

function night(pitch: string): Line[] {
  const info = parsePitch(pitch);
  const w = newWriterCtx(info, lore());
  const c = GENRE_CONTROLS[info.genre];
  const doc = makeDoc(w, c);
  const pal = pickPalette(info, w.rng);
  return [
    ...kickoffLines(w, c), ...designLines(w, doc), ...buildLines(w, c), ...buildDoneLines(w), fillerLine(w),
    ...artLines(w, pal), ...playtestIntro(w), ...playtestLines(w, fail, 0), ...fixLines(w, fail, 1),
    ...playtestLines(w, pass, 1), ...polishLines(w), ...shipLines(w),
  ];
}

describe("built-in writer", () => {
  const pitches = [...PITCH_IDEAS, "a capybara collecting oranges in a hot spring", "x", "an owl racing a train", "two robots stacking boxes on the moon"];
  it("fills every slot and never says undefined", () => {
    for (const p of pitches) {
      for (const l of night(p)) {
        expect(l.text, p).not.toMatch(/\{\w+\}|undefined|NaN|\[object/);
        expect(l.text.length).toBeGreaterThan(1);
      }
    }
  });
  it("gives every crew member a voice and includes a disagreement", () => {
    for (const p of pitches) {
      const lines = night(p);
      for (const who of ["designer", "coder", "artist", "tester"]) expect(lines.some((l) => l.who === who), `${who} in ${p}`).toBe(true);
      expect(lines.some((l) => l.icon === "!"), p).toBe(true);
      expect(lines.length).toBeGreaterThan(30);
    }
  });
  it("is deterministic per pitch and varies across pitches", () => {
    expect(night(PITCH_IDEAS[0]).map((l) => l.text)).toEqual(night(PITCH_IDEAS[0]).map((l) => l.text));
    expect(night(PITCH_IDEAS[0]).map((l) => l.text)).not.toEqual(night(PITCH_IDEAS[1]).map((l) => l.text));
  });
  it("prints a sample night", () => {
    const lines = night("a pigeon delivering pizza in a storm");
    console.log(lines.map((l) => `${l.who.padEnd(8)} ${l.icon ?? ""}\t${l.text}`).join("\n"));
  });
});
