// Share a game by link. The whole game travels in the URL fragment
// (#play=...), which browsers never send to a server. Compressed with
// deflate-raw where the browser supports it. Everything decoded is treated as
// untrusted: validated field by field, and the game still runs in the sandbox.

import type { CoverSpec, DesignDoc, DiaryEntry, Palette, ShippedGame, StageId } from "./types";
import { STAGES } from "./types";
import { TEMPLATE_IDS } from "./games/templates";
import { sanitizeReport } from "./games/playtest";

const AGENT_KEYS = ["designer", "coder", "artist", "tester", "system"] as const;
const CONTROLS = ["lr", "4way", "tap", "lr+a", "4way+a"];
const MAX_CODE = 80000;

interface Packed {
  v: 1;
  t: string;
  g: string;
  p: string;
  s: "builtin" | "ai";
  k: "template" | "code";
  tp?: string;
  pr?: Record<string, unknown>;
  c?: string;
  ct: string;
  pl: (string | string[])[];
  cv: string[];
  d?: DesignDoc;
  y?: [number, string, string, number][]; // who, text, time, stage index
  at: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

const canCompress = typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

export function packGame(g: ShippedGame): Packed {
  return {
    v: 1,
    t: g.title,
    g: g.tagline,
    p: g.pitch,
    s: g.source,
    k: g.kind,
    tp: g.templateId,
    pr: g.params,
    c: g.code,
    ct: g.controls,
    pl: [g.palette.bg, g.palette.bg2, g.palette.hero, g.palette.accent, g.palette.danger, g.palette.text, g.palette.names],
    cv: [g.cover.hero, g.cover.item, g.cover.hazard, g.cover.motif],
    d: g.doc,
    y: g.diary
      .filter((e) => !e.kind || e.kind === "line")
      .slice(-80)
      .map((e) => [AGENT_KEYS.indexOf(e.who), e.text.slice(0, 240), e.time, Math.max(0, STAGES.findIndex((s) => s.id === e.stage))]),
    at: g.createdAt,
  };
}

export async function encodeGame(g: ShippedGame): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(packGame(g)));
  if (canCompress) {
    try {
      return "z." + b64urlEncode(await pipe(json, new CompressionStream("deflate-raw")));
    } catch {
      /* fall through */
    }
  }
  return "j." + b64urlEncode(json);
}

export async function decodeGame(token: string): Promise<ShippedGame | null> {
  try {
    if (token.length > 200000) return null;
    let bytes: Uint8Array;
    if (token.startsWith("z.")) {
      if (!canCompress) return null;
      bytes = await pipe(b64urlDecode(token.slice(2)), new DecompressionStream("deflate-raw"));
    } else if (token.startsWith("j.")) {
      bytes = b64urlDecode(token.slice(2));
    } else return null;
    if (bytes.length > 400000) return null;
    return unpack(JSON.parse(new TextDecoder().decode(bytes)), token);
  } catch {
    return null;
  }
}

const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
const word = (v: unknown, fallback: string) => (typeof v === "string" && /^[a-z]{2,12}$/.test(v) ? v : fallback);

function unpack(o: Packed, token: string): ShippedGame | null {
  if (!o || o.v !== 1) return null;
  const kind = o.k === "code" ? "code" : "template";
  if (kind === "template" && !TEMPLATE_IDS.includes(String(o.tp))) return null;
  if (kind === "code" && (typeof o.c !== "string" || o.c.length > MAX_CODE || !o.c.includes("OGS.game"))) return null;
  const pl = Array.isArray(o.pl) ? o.pl : [];
  const colours = pl.slice(0, 6).map(hex);
  if (colours.some((c) => !c)) return null;
  const names = Array.isArray(pl[6]) ? (pl[6] as unknown[]).slice(0, 6).map((n) => str(n, 28)) : [];
  const palette: Palette = {
    bg: colours[0]!, bg2: colours[1]!, hero: colours[2]!, accent: colours[3]!, danger: colours[4]!, text: colours[5]!,
    names: Array.from({ length: 6 }, (_, i) => names[i] || "Mystery"),
  };
  const cv = Array.isArray(o.cv) ? o.cv : [];
  const cover: CoverSpec = { hero: word(cv[0], "blob"), item: word(cv[1], "star"), hazard: word(cv[2], "rock"), motif: word(cv[3], "stars") };
  const params: Record<string, unknown> = {};
  if (o.pr && typeof o.pr === "object") {
    for (const [k, v] of Object.entries(o.pr).slice(0, 30)) {
      if (!/^[a-zA-Z]{1,16}$/.test(k)) continue;
      if (typeof v === "number" && isFinite(v)) params[k] = Math.max(-1000, Math.min(1000, v));
      else if (typeof v === "boolean") params[k] = v;
      else if (typeof v === "string") params[k] = v.slice(0, 40);
    }
  }
  const doc = o.d && typeof o.d === "object" ? sanitizeDoc(o.d) : undefined;
  const diary: DiaryEntry[] = (Array.isArray(o.y) ? o.y : []).slice(0, 80).flatMap((e) => {
    if (!Array.isArray(e)) return [];
    const who = AGENT_KEYS[Number(e[0])];
    const stage: StageId = STAGES[Number(e[3])]?.id ?? "kickoff";
    if (!who) return [];
    return [{ who, text: str(e[1], 240), time: str(e[2], 12), stage }];
  });
  return {
    id: "shared-" + hashToken(token),
    title: str(o.t, 40) || "Shared game",
    tagline: str(o.g, 80),
    pitch: str(o.p, 140),
    createdAt: typeof o.at === "number" && isFinite(o.at) ? o.at : Date.now(),
    source: o.s === "ai" ? "ai" : "builtin",
    kind,
    templateId: kind === "template" ? String(o.tp) : undefined,
    params: kind === "template" ? params : undefined,
    code: kind === "code" ? o.c : undefined,
    controls: CONTROLS.includes(o.ct) ? o.ct : "4way+a",
    palette,
    cover,
    doc,
    diary,
    shared: true,
  };
}

/** Validate a game from a backup file: same checks as a share link, keeping the full diary. */
export function sanitizeGame(raw: unknown): ShippedGame | null {
  try {
    const g = raw as ShippedGame;
    if (!g || typeof g !== "object" || !g.palette || !g.cover || !Array.isArray(g.diary)) return null;
    const base = unpack(JSON.parse(JSON.stringify(packGame(g))), String(g.id));
    if (!base) return null;
    const id = typeof g.id === "string" && /^[a-z0-9-]{1,48}$/i.test(g.id) ? g.id : base.id;
    const diary: DiaryEntry[] = g.diary.slice(0, 200).flatMap((e) => {
      const who = AGENT_KEYS.find((k) => k === e?.who);
      const stage = STAGES.find((s) => s.id === e?.stage)?.id;
      if (!who || !stage) return [];
      const entry: DiaryEntry = { who, text: str(e.text, 300), time: str(e.time, 12), stage };
      if (e.kind === "doc" && e.data) Object.assign(entry, { kind: "doc", data: sanitizeDoc(e.data as DesignDoc) });
      else if (e.kind === "palette") Object.assign(entry, { kind: "palette", data: base.palette });
      else if (e.kind === "report" && e.data) Object.assign(entry, { kind: "report", data: sanitizeReport(e.data) });
      else if (e.kind === "cover") Object.assign(entry, { kind: "cover", data: { id, title: base.title, palette: base.palette, cover: base.cover, templateId: base.templateId, kind: base.kind, source: base.source } });
      else if (e.kind === "code") Object.assign(entry, { kind: "code", data: str(e.data, 200) });
      return [entry];
    });
    return { ...base, id, shared: g.shared === true, diary, playtest: g.playtest ? sanitizeReport(g.playtest) : undefined };
  } catch {
    return null;
  }
}

function sanitizeDoc(d: DesignDoc): DesignDoc {
  return {
    title: str(d.title, 40),
    logline: str(d.logline, 200),
    genre: str(d.genre, 60),
    player: str(d.player, 160),
    goal: str(d.goal, 200),
    controls: str(d.controls, 120),
    hazards: str(d.hazards, 200),
    twist: str(d.twist, 200),
    cut: Array.isArray(d.cut) ? d.cut.slice(0, 4).map((c) => str(c, 80)) : [],
  };
}

function hashToken(t: string): string {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function shareUrl(token: string): string {
  return `${location.origin}${location.pathname}#play=${token}`;
}

export function readShareToken(): string | null {
  const m = /^#play=([A-Za-z0-9._-]+)$/.exec(location.hash);
  return m ? m[1] : null;
}
