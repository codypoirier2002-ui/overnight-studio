import { describe, expect, it } from "vitest";
import { decodeGame, encodeGame, sanitizeGame } from "../../src/share";
import type { ShippedGame } from "../../src/types";

const pal = { bg: "#101828", bg2: "#263259", hero: "#ff9e7a", accent: "#7fd6c2", danger: "#ff5a7a", text: "#fdfaf3", names: ["A", "B", "C", "D", "E", "F"] };
const base: ShippedGame = {
  id: "abc123", title: "Storm Slice", tagline: "Deliver the pizza.", pitch: "a pigeon delivering pizza in a storm", createdAt: 1764000000000,
  source: "builtin", kind: "template", templateId: "courier", params: { hero: "bird", difficulty: 1, dark: false, weather: "storm" },
  controls: "4way", palette: pal, cover: { hero: "bird", item: "pizza", hazard: "bolt", motif: "rain" },
  doc: { title: "Storm Slice", logline: "x", genre: "y", player: "z", goal: "g", controls: "c", hazards: "h", twist: "t", cut: ["opera mode"] },
  diary: [
    { who: "designer", text: "Hello <b>team</b>", time: "9:06 PM", stage: "kickoff" },
    { who: "system", text: "Kickoff · 9:00 PM", time: "9:00 PM", stage: "kickoff" },
    { who: "artist", text: "Swatches", time: "1:00 AM", stage: "art", kind: "palette", data: pal },
  ],
};

describe("share links", () => {
  it("round-trips a template game", async () => {
    const token = await encodeGame(base);
    expect(token).toMatch(/^[zj]\.[A-Za-z0-9_-]+$/);
    const g = await decodeGame(token);
    expect(g).not.toBeNull();
    expect(g!.title).toBe("Storm Slice");
    expect(g!.templateId).toBe("courier");
    expect(g!.params).toMatchObject({ hero: "bird", weather: "storm" });
    expect(g!.palette.bg).toBe("#101828");
    expect(g!.shared).toBe(true);
    expect(g!.diary.map((d) => d.text)).toEqual(["Hello <b>team</b>", "Kickoff · 9:00 PM"]);
  });

  it("round-trips an AI code game and keeps links short-ish", async () => {
    const code = "OGS.game({controls:'lr', update(){}, draw(s,g){g.rect(0,0,10,10,PAL.hero)}});\n".repeat(60);
    const token = await encodeGame({ ...base, kind: "code", templateId: undefined, params: undefined, code, source: "ai" });
    const g = await decodeGame(token);
    expect(g!.kind).toBe("code");
    expect(g!.code).toBe(code);
    expect(token.length).toBeLessThan(code.length);
  });

  it("rejects tampered or hostile links", async () => {
    expect(await decodeGame("z.notbase64!!")).toBeNull();
    expect(await decodeGame("x.abc")).toBeNull();
    const bad = async (patch: Record<string, unknown>) => {
      const json = JSON.stringify({ ...(JSON.parse(new TextDecoder().decode(await toBytes(base))) as object), ...patch });
      return decodeGame("j." + Buffer.from(json).toString("base64url"));
    };
    expect(await bad({ pl: ["red", "#000000", "#000000", "#000000", "#000000", "#000000"] })).toBeNull();
    expect(await bad({ tp: "../../etc" })).toBeNull();
    expect(await bad({ k: "code", c: "alert(1)" })).toBeNull();
    const g = await bad({ cv: ["<img>", "x", "y", "z"], ct: "javascript:", pr: { "__proto__": 1, ok: 2, s: "<script>" } });
    expect(g!.cover.hero).toBe("blob");
    expect(g!.controls).toBe("4way+a");
    expect(Object.keys(g!.params!)).toEqual(["ok", "s"]);
  });

  it("sanitizes games restored from a backup file but keeps their diary cards", () => {
    const g = sanitizeGame(base)!;
    expect(g.id).toBe("abc123");
    expect(g.diary).toHaveLength(3);
    expect(g.diary[2].kind).toBe("palette");
    expect(sanitizeGame({ ...base, palette: { ...pal, bg: "url(https://x)" } })).toBeNull();
    expect(sanitizeGame("nope")).toBeNull();
  });
});

async function toBytes(g: ShippedGame): Promise<Uint8Array> {
  const t = await encodeGame(g);
  if (t.startsWith("j.")) return Buffer.from(t.slice(2), "base64url");
  const ds = new DecompressionStream("deflate-raw");
  const res = new Response(new Blob([Buffer.from(t.slice(2), "base64url")]).stream().pipeThrough(ds));
  return new Uint8Array(await res.arrayBuffer());
}
