// The studio: a 320x180 pixel-art office drawn with Canvas 2D and scaled up
// with crisp pixels. Static furniture is cached on an offscreen canvas, so each
// frame is one blit plus a handful of small rects. Runs at ~20 fps and pauses
// when hidden, which keeps it light on older phones and integrated graphics.

import { AGENTS, AGENT_ORDER, type AgentId } from "../agents";
import type { StageId } from "../types";
import { kit } from "../games/kit";

export const SCENE_W = 320;
export const SCENE_H = 180;
const FLOOR_Y = 104;
const FPS = 20;

export type Activity =
  | "desk"
  | "meeting"
  | "whiteboard"
  | "kettle"
  | "window"
  | "shelf"
  | "plant"
  | "celebrate"
  | "sleep";

export type BubbleIcon = "talk" | "!" | "?" | "heart" | "note" | "zzz" | "idea";
export type Weather = "clear" | "rain" | "snow" | "storm";

interface Pt {
  x: number;
  y: number;
}

interface AgentState {
  id: AgentId;
  x: number;
  y: number;
  seated: boolean;
  path: Pt[];
  activity: Activity;
  facing: 1 | -1;
  bubble: { icon: BubbleIcon; until: number } | null;
  walkPhase: number;
  mugHotUntil: number;
  sipUntil: number;
  busy: number; // typing intensity 0..1
}

const DESKS: Record<AgentId, { x: number; y: number; side: 1 | -1 }> = {
  designer: { x: 12, y: 114, side: 1 },
  artist: { x: 260, y: 114, side: -1 },
  coder: { x: 30, y: 150, side: 1 },
  tester: { x: 242, y: 150, side: -1 },
};
const DESK_W = 48;

const SPOTS: Record<Exclude<Activity, "desk" | "celebrate" | "sleep">, Record<AgentId, Pt>> = {
  meeting: {
    designer: { x: 140, y: 127 },
    coder: { x: 180, y: 127 },
    artist: { x: 146, y: 143 },
    tester: { x: 174, y: 143 },
  },
  whiteboard: {
    designer: { x: 226, y: 108 },
    coder: { x: 238, y: 109 },
    artist: { x: 250, y: 108 },
    tester: { x: 214, y: 109 },
  },
  kettle: {
    designer: { x: 104, y: 110 },
    coder: { x: 112, y: 111 },
    artist: { x: 96, y: 111 },
    tester: { x: 120, y: 110 },
  },
  window: {
    designer: { x: 150, y: 108 },
    coder: { x: 162, y: 109 },
    artist: { x: 172, y: 108 },
    tester: { x: 140, y: 109 },
  },
  shelf: {
    designer: { x: 50, y: 108 },
    coder: { x: 62, y: 109 },
    artist: { x: 40, y: 109 },
    tester: { x: 72, y: 108 },
  },
  plant: {
    designer: { x: 290, y: 108 },
    coder: { x: 282, y: 109 },
    artist: { x: 298, y: 109 },
    tester: { x: 276, y: 108 },
  },
};

function seatOf(id: AgentId): Pt {
  const d = DESKS[id];
  return { x: d.x + DESK_W / 2 - d.side * 8, y: d.y };
}
function standOf(id: AgentId): Pt {
  const s = seatOf(id);
  return { x: s.x, y: DESKS[id].y + 18 };
}

// ---------- colour helpers ----------
function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return "#" + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
}

interface SkyKey {
  h: number;
  top: string;
  bottom: string;
  stars: number;
  tint: string;
}
const SKY: SkyKey[] = [
  { h: 0, top: "#0b1030", bottom: "#1d2350", stars: 1, tint: "#8f88c8" },
  { h: 4.5, top: "#0e1336", bottom: "#2a2a5c", stars: 0.9, tint: "#948dc8" },
  { h: 5.5, top: "#2b2a62", bottom: "#b8657a", stars: 0.4, tint: "#b8a2c8" },
  { h: 6.5, top: "#5a78c0", bottom: "#ffb27a", stars: 0, tint: "#f0d8d0" },
  { h: 8, top: "#6fb3ee", bottom: "#cbe8ff", stars: 0, tint: "#ffffff" },
  { h: 17, top: "#6aa8e6", bottom: "#d6ecff", stars: 0, tint: "#ffffff" },
  { h: 18.5, top: "#4a5ba8", bottom: "#ff9f6b", stars: 0.1, tint: "#f2cfc0" },
  { h: 20, top: "#1f2560", bottom: "#7a4a8a", stars: 0.6, tint: "#b0a0d0" },
  { h: 21.5, top: "#0d1234", bottom: "#262a5e", stars: 1, tint: "#8f88c8" },
  { h: 24, top: "#0b1030", bottom: "#1d2350", stars: 1, tint: "#8f88c8" },
];
function skyAt(hour: number): SkyKey {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i];
    const b = SKY[i + 1];
    if (h >= a.h && h <= b.h) {
      const t = (h - a.h) / (b.h - a.h || 1);
      return {
        h,
        top: mix(a.top, b.top, t),
        bottom: mix(a.bottom, b.bottom, t),
        stars: a.stars + (b.stars - a.stars) * t,
        tint: mix(a.tint, b.tint, t),
      };
    }
  }
  return SKY[0];
}

// Deterministic pseudo-random for static decoration
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const WIN = { x: 122, y: 12, w: 76, h: 52 };
const BOARD = { x: 210, y: 16, w: 74, h: 44 };

export class StudioScene {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private bgKey = "";
  private agents: Record<AgentId, AgentState>;
  private running = false;
  private paused = false;
  private last = 0;
  private acc = 0;
  private raf = 0;
  private t = 0;
  private stars: { x: number; y: number; p: number }[];
  private city: { x: number; w: number; h: number; lights: { x: number; y: number; off: number }[] }[];
  private rain: { x: number; y: number; v: number }[];

  // public-ish state set by the app
  hour = 21;
  minute = 0;
  realClock = true;
  stage: StageId | null = null;
  shelf: string[] = [];
  plant = 1;
  weather: Weather = "clear";
  boardWords: string[] = [];
  boardPalette: string[] = [];
  onAgentClick: ((id: AgentId) => void) | null = null;
  private flashUntil = 0;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = SCENE_W;
    canvas.height = SCENE_H;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.bg = document.createElement("canvas");
    this.bg.width = SCENE_W;
    this.bg.height = SCENE_H;

    const rnd = prng(7);
    this.stars = Array.from({ length: 26 }, () => ({
      x: WIN.x + 3 + rnd() * (WIN.w - 6),
      y: WIN.y + 3 + rnd() * (WIN.h * 0.55),
      p: rnd() * 6.28,
    }));
    this.city = [];
    let cx = WIN.x;
    while (cx < WIN.x + WIN.w) {
      const w = 6 + Math.floor(rnd() * 9);
      const h = 8 + Math.floor(rnd() * 18);
      const lights: { x: number; y: number; off: number }[] = [];
      for (let ly = WIN.y + WIN.h - h + 2; ly < WIN.y + WIN.h - 2; ly += 3) {
        for (let lx = cx + 1; lx < cx + w - 1; lx += 2) {
          if (rnd() < 0.35) lights.push({ x: lx, y: ly, off: rnd() * 6 });
        }
      }
      this.city.push({ x: cx, w, h, lights });
      cx += w + (rnd() < 0.3 ? 1 : 0);
    }
    this.rain = Array.from({ length: 28 }, () => ({
      x: WIN.x + rnd() * WIN.w,
      y: WIN.y + rnd() * WIN.h,
      v: 70 + rnd() * 50,
    }));

    this.agents = {} as Record<AgentId, AgentState>;
    for (const id of AGENT_ORDER) {
      const s = seatOf(id);
      this.agents[id] = {
        id,
        x: s.x,
        y: s.y,
        seated: true,
        path: [],
        activity: "desk",
        facing: 1,
        bubble: null,
        walkPhase: 0,
        mugHotUntil: 0,
        sipUntil: 0,
        busy: 0.3,
      };
    }

    canvas.addEventListener("click", (e) => {
      const id = this.hitTest(e.clientX, e.clientY);
      if (id && this.onAgentClick) this.onAgentClick(id);
    });
    canvas.addEventListener("mousemove", (e) => {
      canvas.style.cursor = this.hitTest(e.clientX, e.clientY) ? "pointer" : "default";
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.last = performance.now();
    });
  }

  // ---------- public API ----------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (this.paused || document.hidden) {
        this.last = now;
        return;
      }
      const dt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      this.acc += dt;
      if (this.acc < 1 / FPS) return;
      const step = this.acc;
      this.acc = 0;
      this.update(step);
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
    this.update(0);
    this.render();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  setClock(hour: number, minute: number): void {
    this.realClock = false;
    this.hour = hour;
    this.minute = minute;
  }

  useRealClock(): void {
    this.realClock = true;
  }

  setActivity(id: AgentId, activity: Activity): void {
    const a = this.agents[id];
    if (a.activity === activity && (a.path.length || activity !== "desk" || a.seated)) return;
    a.activity = activity;
    if (activity === "celebrate" || activity === "sleep") {
      a.path = [];
      return;
    }
    const path: Pt[] = [];
    if (a.seated) {
      path.push(standOf(id));
      a.seated = false;
    }
    const from = path.length ? path[path.length - 1] : { x: a.x, y: a.y };
    let dest: Pt;
    if (activity === "desk") {
      dest = standOf(id);
    } else {
      dest = SPOTS[activity][id];
    }
    // Route through the middle aisle when changing rows, to dodge furniture.
    if (Math.abs(from.y - dest.y) > 14 || Math.abs(from.x - dest.x) > 60) {
      path.push({ x: Math.max(96, Math.min(224, (from.x + dest.x) / 2)), y: 138 });
    }
    path.push(dest);
    if (activity === "desk") path.push(seatOf(id));
    a.path = path;
  }

  activityOf(id: AgentId): Activity {
    return this.agents[id].activity;
  }

  everyoneTo(activity: Activity): void {
    for (const id of AGENT_ORDER) this.setActivity(id, activity);
  }

  say(id: AgentId, icon: BubbleIcon = "talk", ms = 1800): void {
    this.agents[id].bubble = { icon, until: this.t + ms / 1000 };
  }

  sip(id: AgentId): void {
    this.agents[id].sipUntil = this.t + 1.2;
  }

  refillMug(id: AgentId): void {
    this.agents[id].mugHotUntil = this.t + 90;
  }

  setBusy(id: AgentId, busy: number): void {
    this.agents[id].busy = busy;
  }

  isWalking(id: AgentId): boolean {
    return this.agents[id].path.length > 0;
  }

  lightning(): void {
    this.flashUntil = this.t + 0.12;
  }

  private glows: Partial<Record<AgentId, CanvasGradient>> = {};
  private glowFor(id: AgentId): CanvasGradient {
    const cached = this.glows[id];
    if (cached) return cached;
    const d = DESKS[id];
    const mx = d.x + DESK_W / 2 + d.side * 12;
    const g = this.ctx.createRadialGradient(mx, d.y - 8, 1, mx, d.y - 8, 20);
    const col = id === "coder" ? "63,224,176" : id === "artist" ? "192,140,255" : id === "tester" ? "127,208,255" : "255,240,216";
    g.addColorStop(0, `rgba(${col},0.45)`);
    g.addColorStop(1, `rgba(${col},0)`);
    this.glows[id] = g;
    return g;
  }

  /** Map a client (CSS) point to an agent under it, if any. */
  hitTest(clientX: number, clientY: number): AgentId | null {
    const r = this.canvas.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * SCENE_W;
    const y = ((clientY - r.top) / r.height) * SCENE_H;
    for (const id of AGENT_ORDER) {
      const b = this.agentBox(id);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return id;
    }
    return null;
  }

  agentBox(id: AgentId): { x: number; y: number; w: number; h: number } {
    const a = this.agents[id];
    if (a.seated) return { x: a.x - 7, y: a.y - 20, w: 14, h: 22 };
    return { x: a.x - 7, y: a.y - 21, w: 14, h: 22 };
  }

  // ---------- simulation ----------

  private update(dt: number): void {
    this.t += dt;
    if (this.realClock) {
      const d = new Date();
      this.hour = d.getHours() + d.getMinutes() / 60;
      this.minute = d.getMinutes();
    }
    for (const id of AGENT_ORDER) {
      const a = this.agents[id];
      if (a.bubble && a.bubble.until < this.t) a.bubble = null;
      if (a.path.length) {
        const target = a.path[0];
        const dx = target.x - a.x;
        const dy = target.y - a.y;
        const dist = Math.hypot(dx, dy);
        const step = 36 * dt;
        if (Math.abs(dx) > 0.5) a.facing = dx > 0 ? 1 : -1;
        a.walkPhase += dt * 8;
        if (dist <= step) {
          a.x = target.x;
          a.y = target.y;
          a.path.shift();
          if (!a.path.length && a.activity === "desk") {
            a.seated = true;
          }
          if (!a.path.length && a.activity === "kettle") this.refillMug(id);
        } else {
          a.x += (dx / dist) * step;
          a.y += (dy / dist) * step;
        }
      }
    }
    if (this.weather === "rain" || this.weather === "storm" || this.weather === "snow") {
      const snow = this.weather === "snow";
      for (const r of this.rain) {
        r.y += (snow ? r.v * 0.18 : r.v) * dt;
        r.x += (snow ? Math.sin(this.t + r.v) * 6 : -18) * dt;
        if (r.y > WIN.y + WIN.h) {
          r.y = WIN.y - 2;
          r.x = WIN.x + Math.random() * (WIN.w + 10);
        }
        if (r.x < WIN.x) r.x += WIN.w;
      }
      if (this.weather === "storm" && Math.random() < dt * 0.15) this.lightning();
    }
  }

  // ---------- rendering ----------

  private render(): void {
    const ctx = this.ctx;
    const sky = skyAt(this.hour);
    const key = [Math.round(sky.h * 4), this.stage, this.shelf.join(","), this.plant, this.boardWords.join("|"), this.boardPalette.join(",")].join(";");
    if (key !== this.bgKey) {
      this.bgKey = key;
      this.drawBackground();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(this.bg, 0, 0);

    // y-sorted dynamic layer: desks, meeting table, agents
    const items: { y: number; draw: () => void }[] = [];
    for (const id of AGENT_ORDER) {
      const d = DESKS[id];
      items.push({ y: d.y + 12, draw: () => this.drawDesk(id) });
      items.push({ y: d.y - 2, draw: () => this.drawChair(id) });
      const a = this.agents[id];
      items.push({ y: a.seated ? d.y - 1 : a.y, draw: () => this.drawAgent(a) });
    }
    items.push({ y: 134, draw: () => this.drawTable() });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();

    // night tint (multiply), skipped in daylight
    if (sky.tint !== "#ffffff") {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = sky.tint;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
      ctx.globalCompositeOperation = "source-over";
    }

    this.drawSky(sky);

    // glows
    ctx.globalCompositeOperation = "lighter";
    const night = sky.stars;
    if (night > 0.05) {
      ctx.globalAlpha = 0.18 * night;
      ctx.fillStyle = "#ffcf7a";
      ctx.beginPath();
      ctx.moveTo(4, 50);
      ctx.lineTo(16, 50);
      ctx.lineTo(34, 104);
      ctx.lineTo(-10, 104);
      ctx.fill();
      ctx.globalAlpha = 0.5 * night;
      for (const id of AGENT_ORDER) {
        if (!this.agents[id].seated) continue;
        const d = DESKS[id];
        const mx = d.x + DESK_W / 2 + d.side * 12;
        ctx.fillStyle = this.glowFor(id);
        ctx.fillRect(mx - 22, d.y - 28, 44, 40);
      }
      ctx.globalAlpha = 1;
    }
    if (this.flashUntil > this.t) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";

    for (const id of AGENT_ORDER) this.drawBubble(this.agents[id]);
  }

  private drawBackground(): void {
    const c = this.bg.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    const R = (x: number, y: number, w: number, h: number, col: string) => {
      c.fillStyle = col;
      c.fillRect(x, y, w, h);
    };
    // wall
    R(0, 0, SCENE_W, FLOOR_Y, "#4b3a5e");
    for (let x = 0; x < SCENE_W; x += 16) R(x, 0, 1, 74, "#47375a");
    R(0, 74, SCENE_W, 28, "#5c4560");
    R(0, 74, SCENE_W, 2, "#6e5670");
    for (let x = 6; x < SCENE_W; x += 20) R(x, 78, 12, 20, "#563f5a");
    R(0, 100, SCENE_W, 4, "#2e2238");
    // floor
    R(0, FLOOR_Y, SCENE_W, SCENE_H - FLOOR_Y, "#7a5236");
    for (let y = FLOOR_Y + 6; y < SCENE_H; y += 8) R(0, y, SCENE_W, 1, "#6a4630");
    const rp = prng(3);
    for (let y = FLOOR_Y; y < SCENE_H; y += 8) {
      let x = Math.floor(rp() * 30);
      while (x < SCENE_W) {
        R(x, y, 1, 6, "#6a4630");
        R(x + 1, y, 1, 6, "#845a3c");
        x += 30 + Math.floor(rp() * 30);
      }
    }
    // rug
    c.fillStyle = "#8f3b4f";
    c.beginPath();
    c.ellipse(160, 137, 50, 13, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#c9655e";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(160, 137, 46, 11, 0, 0, Math.PI * 2);
    c.stroke();

    // window frame (sky is drawn per frame)
    R(WIN.x - 3, WIN.y - 3, WIN.w + 6, WIN.h + 6, "#2b2033");
    R(WIN.x - 5, WIN.y + WIN.h + 2, WIN.w + 10, 3, "#6e5670");
    // curtains
    R(WIN.x - 9, WIN.y - 6, 6, WIN.h + 12, "#a14a5e");
    R(WIN.x + WIN.w + 3, WIN.y - 6, 6, WIN.h + 12, "#a14a5e");
    R(WIN.x - 9, WIN.y - 6, 2, WIN.h + 12, "#c25d72");
    R(WIN.x + WIN.w + 7, WIN.y - 6, 2, WIN.h + 12, "#8a3c50");
    R(WIN.x - 11, WIN.y - 8, WIN.w + 22, 2, "#2b2033");

    // clock
    c.fillStyle = "#2b2033";
    c.beginPath();
    c.arc(104, 26, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f4efe6";
    c.beginPath();
    c.arc(104, 26, 7.5, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      R(Math.round(104 + Math.cos(a) * 6), Math.round(26 + Math.sin(a) * 6), 1, 1, "#7a6a8a");
    }

    // cartridge shelf
    R(14, 44, 78, 3, "#8a5f3a");
    R(14, 47, 78, 1, "#5a3c26");
    R(14, 68, 78, 3, "#8a5f3a");
    R(14, 71, 78, 1, "#5a3c26");
    R(16, 47, 2, 4, "#5a3c26");
    R(88, 47, 2, 4, "#5a3c26");
    const carts = this.shelf.slice(-24);
    carts.forEach((col, i) => {
      const row = i < 12 ? 0 : 1;
      const x = 17 + (i % 12) * 6;
      const y = row === 0 ? 34 : 58;
      R(x, y, 5, 10, "#2a2733");
      R(x + 1, y + 1, 3, 5, col);
      R(x + 1, y + 7, 3, 1, "#6f6a7d");
    });
    if (!carts.length) {
      kit.drawText(c, "EMPTY", 53, 37, "#6e5670", 1, "center");
    }
    // poster
    R(70, 76, 20, 22, "#2b2033");
    R(71, 77, 18, 20, "#f2c14e");
    kit.drawShape(c, "star", 80, 84, 10, "#e2574c");
    kit.drawText(c, "SHIP", 80, 90, "#2b2033", 1, "center");

    // kettle counter
    R(92, 86, 28, 18, "#6a4a3a");
    R(92, 84, 28, 3, "#a87a4f");
    R(94, 90, 11, 12, "#5a3c2e");
    R(107, 90, 11, 12, "#5a3c2e");
    R(103, 95, 2, 2, "#c9a27a");
    R(108, 95, 2, 2, "#c9a27a");
    R(97, 76, 8, 8, "#c9d1d9"); // kettle
    R(98, 74, 6, 2, "#9aa3b5");
    R(105, 78, 3, 2, "#9aa3b5");
    R(110, 79, 7, 5, "#e2574c"); // biscuit tin
    R(110, 79, 7, 1, "#ff8a7a");

    // whiteboard
    R(BOARD.x - 2, BOARD.y - 2, BOARD.w + 4, BOARD.h + 4, "#9aa3b5");
    R(BOARD.x, BOARD.y, BOARD.w, BOARD.h, "#eef2f6");
    R(BOARD.x + 4, BOARD.y + BOARD.h + 2, BOARD.w - 8, 2, "#6f6a7d");
    R(BOARD.x + 8, BOARD.y + BOARD.h + 1, 4, 1, "#e2574c");
    R(BOARD.x + 14, BOARD.y + BOARD.h + 1, 4, 1, "#4aa3df");
    this.drawBoard(c);

    // floor lamp
    R(9, 52, 2, 50, "#2b2033");
    R(5, 101, 10, 3, "#2b2033");
    c.fillStyle = "#f2c14e";
    c.beginPath();
    c.moveTo(4, 52);
    c.lineTo(16, 52);
    c.lineTo(13, 42);
    c.lineTo(7, 42);
    c.fill();

    // Gerald the plant
    const ph = Math.min(10, this.plant);
    R(298, 92, 14, 12, "#b8653a");
    R(297, 90, 16, 3, "#d07a48");
    const leaves = prng(11);
    for (let i = 0; i < 3 + ph * 2; i++) {
      const lx = 305 + (leaves() - 0.5) * (8 + ph * 1.6);
      const ly = 90 - leaves() * (8 + ph * 4);
      R(Math.round(305), Math.round(ly), 1, Math.round(90 - ly), "#3f7d3a");
      kit.drawShape(c, "leaf", lx, ly, 7, i % 2 ? "#5fae4c" : "#7ac74f");
    }
  }

  private drawBoard(c: CanvasRenderingContext2D): void {
    const bx = BOARD.x;
    const by = BOARD.y;
    const ink = "#3a4a8a";
    const red = "#c8443c";
    const R = (x: number, y: number, w: number, h: number, col: string) => {
      c.fillStyle = col;
      c.fillRect(x, y, w, h);
    };
    switch (this.stage) {
      case null: {
        kit.drawText(c, "TONIGHT:", bx + 6, by + 5, ink);
        kit.drawText(c, "???", bx + 6, by + 13, red, 2);
        kit.drawText(c, "PITCH US", bx + 6, by + 30, ink);
        kit.drawText(c, "A GAME", bx + 6, by + 36, ink);
        break;
      }
      case "kickoff": {
        kit.drawText(c, "KICKOFF", bx + 6, by + 5, red);
        this.boardWords.slice(0, 4).forEach((w, i) => {
          kit.drawText(c, w.slice(0, 12), bx + 8, by + 14 + i * 7, ink);
        });
        R(bx + 4, by + 14, 2, 2, red);
        break;
      }
      case "design": {
        kit.drawText(c, "DESIGN", bx + 6, by + 5, red);
        R(bx + 6, by + 14, 18, 12, ink);
        R(bx + 7, by + 15, 16, 10, "#eef2f6");
        R(bx + 30, by + 18, 12, 1, ink);
        R(bx + 40, by + 17, 2, 3, ink);
        R(bx + 46, by + 14, 20, 12, ink);
        R(bx + 47, by + 15, 18, 10, "#eef2f6");
        kit.drawText(c, "LOOP!", bx + 10, by + 32, ink);
        break;
      }
      case "build": {
        kit.drawText(c, "BUILD", bx + 6, by + 5, red);
        for (let i = 0; i < 4; i++) R(bx + 6 + i * 3, by + 14 + i * 5, 30 + ((i * 17) % 24), 2, ink);
        kit.drawText(c, "NO SCOPE", bx + 6, by + 36, red);
        break;
      }
      case "art": {
        kit.drawText(c, "PALETTE", bx + 6, by + 5, red);
        const pal = this.boardPalette.length ? this.boardPalette : ["#e2574c", "#ffd56b", "#4aa3df", "#2b2033"];
        pal.slice(0, 6).forEach((col, i) => R(bx + 6 + i * 11, by + 15, 9, 9, col));
        kit.drawText(c, "4 IS PLENTY", bx + 6, by + 32, ink);
        break;
      }
      case "playtest":
      case "fixes": {
        kit.drawText(c, this.stage === "fixes" ? "FIXES" : "BUGS", bx + 6, by + 5, red);
        for (let i = 0; i < 3; i++) {
          R(bx + 8, by + 15 + i * 8, 4, 4, ink);
          R(bx + 16, by + 16 + i * 8, 26 + i * 6, 2, ink);
        }
        R(bx + 56, by + 14, 10, 1, red);
        R(bx + 56, by + 14, 1, 10, red);
        break;
      }
      case "ship": {
        kit.drawShape(c, "star", bx + 37, by + 18, 20, "#e2a63b");
        kit.drawText(c, "SHIP IT!", bx + 37, by + 32, red, 1, "center");
        break;
      }
    }
  }

  private drawSky(sky: SkyKey): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    const storm = this.weather === "storm" || this.weather === "rain";
    if (sky.stars > 0.05 && !storm) {
      for (const s of this.stars) {
        const tw = 0.5 + 0.5 * Math.sin(this.t * 2 + s.p);
        ctx.globalAlpha = sky.stars * (0.4 + 0.6 * tw);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // moon at night, sun in the day
    const h = sky.h;
    const isNight = h >= 19 || h < 6.5;
    const nh = isNight ? (h >= 19 ? h - 19 : h + 5) / 11.5 : (h - 6.5) / 12.5;
    const bx = WIN.x + 8 + nh * (WIN.w - 16);
    const by = WIN.y + 22 - Math.sin(nh * Math.PI) * 14;
    if (!storm) {
      ctx.fillStyle = isNight ? "#f4efe6" : "#fff2a8";
      ctx.beginPath();
      ctx.arc(bx, by, isNight ? 4 : 5, 0, Math.PI * 2);
      ctx.fill();
      if (isNight) {
        ctx.fillStyle = sky.top;
        ctx.beginPath();
        ctx.arc(bx + 2, by - 1, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "rgba(60,64,90,0.55)";
      ctx.fillRect(WIN.x, WIN.y, WIN.w, 14);
      kit.drawShape(ctx, "cloud", WIN.x + 18, WIN.y + 8, 22, "#5a5f7a");
      kit.drawShape(ctx, "cloud", WIN.x + 54, WIN.y + 10, 26, "#4e5370");
    }
    // city
    const late = h >= 1 && h < 5 ? 0.5 : h >= 23 || h < 1 ? 0.25 : 0;
    const building = mix("#17142a", "#5d6f94", 1 - Math.min(1, sky.stars * 1.6));
    for (const b of this.city) {
      ctx.fillStyle = building;
      ctx.fillRect(b.x, WIN.y + WIN.h - b.h, b.w, b.h);
      if (sky.stars > 0.2) {
        ctx.fillStyle = "#ffd56b";
        for (const l of b.lights) {
          if (l.off / 6 > late) ctx.fillRect(l.x, l.y, 1, 1);
        }
      }
    }
    if (this.weather !== "clear") {
      ctx.fillStyle = this.weather === "snow" ? "#ffffff" : "#9fc3ff";
      for (const r of this.rain) {
        if (r.x < WIN.x || r.x > WIN.x + WIN.w - 1) continue;
        if (this.weather === "snow") ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 1);
        else ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 3);
      }
    }
    // mullions
    ctx.fillStyle = "#2b2033";
    ctx.fillRect(WIN.x + WIN.w / 2 - 1, WIN.y, 2, WIN.h);
    ctx.fillRect(WIN.x, WIN.y + WIN.h / 2 - 1, WIN.w, 2);

    // clock hands
    const hr = (this.hour % 12) + this.minute / 60 - (this.hour % 1);
    const ha = ((hr % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    const ma = (this.minute / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = "#2b2033";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(104.5, 26.5);
    ctx.lineTo(104.5 + Math.cos(ha) * 3.5, 26.5 + Math.sin(ha) * 3.5);
    ctx.moveTo(104.5, 26.5);
    ctx.lineTo(104.5 + Math.cos(ma) * 5.5, 26.5 + Math.sin(ma) * 5.5);
    ctx.stroke();
  }

  private drawChair(id: AgentId): void {
    const s = seatOf(id);
    const ctx = this.ctx;
    ctx.fillStyle = "#3a3446";
    ctx.fillRect(s.x - 6, s.y - 14, 12, 14);
    ctx.fillStyle = "#4a4258";
    ctx.fillRect(s.x - 5, s.y - 13, 10, 2);
  }

  private drawDesk(id: AgentId): void {
    const d = DESKS[id];
    const ctx = this.ctx;
    const R = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    };
    const a = this.agents[id];
    const atDesk = a.seated;
    // monitor
    const mx = d.x + DESK_W / 2 + d.side * 12 - 8;
    const my = d.y - 14;
    R(mx, my, 16, 11, "#2a2733");
    R(mx + 7, my + 11, 2, 2, "#2a2733");
    R(mx + 4, my + 12, 8, 1, "#2a2733");
    this.drawScreen(id, mx + 1, my + 1, 14, 9, atDesk);
    // desk
    R(d.x, d.y, DESK_W, 3, "#b4865a");
    R(d.x, d.y + 3, DESK_W, 11, "#8a5f3a");
    R(d.x, d.y + 3, DESK_W, 1, "#6e4a2e");
    R(d.x + 3, d.y + 6, DESK_W - 6, 1, "#6e4a2e");
    R(d.x + DESK_W / 2 - 3, d.y + 8, 6, 1, "#c9a27a");
    R(d.x + 1, d.y + 14, 3, 2, "#5a3c26");
    R(d.x + DESK_W - 4, d.y + 14, 3, 2, "#5a3c26");
    // keyboard when seated
    const s = seatOf(id);
    R(s.x - 5, d.y - 1, 10, 2, "#c9d1d9");
    // mug
    const mug = AGENTS[id].mug;
    const mugX = d.x + DESK_W / 2 - d.side * 20 - 2;
    const sipping = a.sipUntil > this.t && a.seated;
    if (!sipping) {
      R(mugX, d.y - 5, 4, 5, mug.body);
      R(mugX, d.y - 3, 4, 1, mug.stripe);
      R(mugX + (d.side > 0 ? -1 : 4), d.y - 4, 1, 3, mug.body);
      if (a.mugHotUntil > this.t) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        const p = this.t * 3 + mugX;
        for (let i = 0; i < 3; i++) {
          const sy = d.y - 7 - ((p + i * 1.4) % 4.2) * 1.6;
          ctx.fillRect(Math.round(mugX + 1 + Math.sin(p + i) * 1.2), Math.round(sy), 1, 1);
        }
      }
    }
    // little desk props
    if (id === "coder") {
      // the duck
      R(d.x + 4, d.y - 4, 4, 4, "#ffd23f");
      R(d.x + 6, d.y - 6, 3, 3, "#ffd23f");
      R(d.x + 9, d.y - 5, 2, 1, "#ff8a1f");
    } else if (id === "designer") {
      R(d.x + 36, d.y - 2, 9, 2, "#e46f5a");
      R(d.x + 37, d.y - 4, 8, 2, "#4aa3df");
    } else if (id === "artist") {
      R(d.x + 4, d.y - 6, 2, 6, "#ff6fb5");
      R(d.x + 7, d.y - 7, 2, 7, "#4aa3df");
      R(d.x + 3, d.y - 1, 8, 1, "#7a5cff");
    } else if (id === "tester") {
      // the bug jar
      R(d.x + 38, d.y - 7, 6, 7, "#b8e3ff");
      R(d.x + 38, d.y - 8, 6, 1, "#9aa3b5");
      R(d.x + 40, d.y - 4, 2, 2, "#2a2733");
    }
  }

  private drawScreen(id: AgentId, x: number, y: number, w: number, h: number, on: boolean): void {
    const ctx = this.ctx;
    const t = this.t;
    if (!on) {
      ctx.fillStyle = "#121222";
      ctx.fillRect(x, y, w, h);
      const bx = x + Math.abs(((t * 3) % (2 * (w - 2))) - (w - 2));
      const by = y + Math.abs(((t * 2) % (2 * (h - 2))) - (h - 2));
      ctx.fillStyle = AGENTS[id].color;
      ctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
      return;
    }
    const busy = this.agents[id].busy;
    switch (id) {
      case "coder": {
        ctx.fillStyle = "#0f1f22";
        ctx.fillRect(x, y, w, h);
        const cols = ["#7fd6c2", "#ffd56b", "#ff8fa3", "#9fc3ff"];
        const scroll = Math.floor(t * (1 + busy * 5));
        for (let i = 0; i < 4; i++) {
          const n = scroll + i;
          ctx.fillStyle = cols[n % 4];
          const indent = (n * 7) % 3;
          ctx.fillRect(x + 1 + indent * 2, y + 1 + i * 2, 3 + ((n * 13) % 8), 1);
        }
        if (Math.floor(t * 3) % 2) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x + 11, y + 7, 1, 1);
        }
        break;
      }
      case "designer": {
        ctx.fillStyle = "#f4efe6";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#e46f5a";
        ctx.fillRect(x + 1, y + 1, 7, 1);
        ctx.fillStyle = "#9a8aa8";
        const lines = 1 + (Math.floor(t * (0.5 + busy * 2)) % 4);
        for (let i = 0; i < lines; i++) ctx.fillRect(x + 1, y + 3 + i * 2, 6 + ((i * 5) % 6), 1);
        break;
      }
      case "artist": {
        ctx.fillStyle = "#2b2033";
        ctx.fillRect(x, y, w, h);
        const pal = this.boardPalette.length ? this.boardPalette : ["#e2574c", "#ffd56b", "#4aa3df", "#a6e36b"];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = pal[i % pal.length];
          ctx.fillRect(x + 1 + i * 3, y + 1, 2, 2);
        }
        ctx.fillStyle = pal[Math.floor(t) % pal.length];
        const bx = x + 2 + ((Math.sin(t * 2) + 1) / 2) * (w - 6);
        ctx.fillRect(Math.round(bx), y + 5, 3, 2);
        break;
      }
      case "tester": {
        ctx.fillStyle = "#1a2a4a";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#7ac74f";
        ctx.fillRect(x, y + h - 2, w, 2);
        const jump = Math.abs(Math.sin(t * 4)) * 4;
        ctx.fillStyle = "#ffd56b";
        ctx.fillRect(x + 4, Math.round(y + h - 4 - jump), 2, 2);
        ctx.fillStyle = "#ff5a5a";
        const ox = x + w - 1 - ((t * 8) % w);
        ctx.fillRect(Math.round(ox), y + h - 4, 2, 2);
        break;
      }
    }
  }

  private drawTable(): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#5a3c26";
    ctx.fillRect(157, 130, 6, 6);
    ctx.fillRect(150, 135, 20, 2);
    ctx.fillStyle = "#b4865a";
    ctx.beginPath();
    ctx.ellipse(160, 128, 19, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c99a6a";
    ctx.fillRect(150, 126, 8, 1);
    // papers + a plate of biscuits
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(152, 127, 6, 3);
    ctx.fillRect(164, 126, 5, 3);
    ctx.fillStyle = "#d39b5a";
    ctx.fillRect(159, 126, 2, 1);
    ctx.fillRect(161, 127, 2, 1);
  }

  private drawAgent(a: AgentState): void {
    const ctx = this.ctx;
    const look = AGENTS[a.id].look;
    const R = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    let x = Math.round(a.x);
    let y = Math.round(a.y);
    let bob = 0;
    if (a.activity === "celebrate" && !a.path.length) {
      bob = -Math.round(Math.abs(Math.sin(this.t * 7)) * 4);
    }
    const walking = a.path.length > 0;
    if (walking) bob = Math.floor(a.walkPhase) % 2 === 0 ? 0 : -1;
    const sleeping = a.activity === "sleep" && a.seated;

    if (a.seated) {
      // seated: torso bottom hidden behind desk; base y = desk top
      const base = y + 3;
      const headY = base - 17 + (sleeping ? 4 : 0);
      R(x - 4, base - 10, 8, 10, look.shirt);
      R(x - 4, base - 10, 8, 1, look.shirtTrim);
      // arms typing
      const typing = !sleeping && a.busy > 0.05 && Math.sin(this.t * (8 + a.busy * 10) + x) > 0;
      const sipping = a.sipUntil > this.t;
      R(x - 5, base - 8, 1, 6, look.shirt);
      if (sipping) {
        R(x + 4, base - 12, 1, 5, look.shirt);
        const mug = AGENTS[a.id].mug;
        R(x + 3, headY + 6, 3, 3, mug.body);
        R(x + 3, headY + 7, 3, 1, mug.stripe);
      } else {
        R(x + 4, base - 8, 1, 6, look.shirt);
      }
      R(x - 4, base - 3 - (typing ? 1 : 0), 2, 1, look.skin);
      if (!sipping) R(x + 2, base - 3 - (typing ? 0 : 1), 2, 1, look.skin);
      this.drawHead(a, x, headY, sleeping);
      return;
    }

    y += bob;
    // legs
    const step = walking ? Math.floor(a.walkPhase) % 2 : 0;
    R(x - 3, y - 4, 2, 4 - step, "#2b2738");
    R(x + 1, y - 4, 2, 4 - (1 - step), "#2b2738");
    if (!walking || step === 0) R(x - 3, y - 1, 2, 1, "#1a1622");
    // torso
    R(x - 4, y - 11, 8, 7, look.shirt);
    R(x - 4, y - 11, 8, 1, look.shirtTrim);
    // arms
    const wave = a.activity === "celebrate" && !walking;
    if (wave) {
      R(x - 5, y - 15, 1, 5, look.shirt);
      R(x + 4, y - 15, 1, 5, look.shirt);
      R(x - 5, y - 16, 1, 1, look.skin);
      R(x + 4, y - 16, 1, 1, look.skin);
    } else {
      const swing = walking ? (step ? 1 : -1) : 0;
      R(x - 5, y - 10 + swing, 1, 5, look.shirt);
      R(x + 4, y - 10 - swing, 1, 5, look.shirt);
      R(x - 5, y - 5 + swing, 1, 1, look.skin);
      R(x + 4, y - 5 - swing, 1, 1, look.skin);
    }
    this.drawHead(a, x, y - 18, false);
  }

  private drawHead(a: AgentState, x: number, hy: number, sleeping: boolean): void {
    const ctx = this.ctx;
    const look = AGENTS[a.id].look;
    const R = (px: number, py: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(px), Math.round(py), w, h);
    };
    R(x - 4, hy, 8, 7, look.skin);
    // hair
    switch (look.hairStyle) {
      case "bun":
        R(x - 4, hy - 1, 8, 3, look.hair);
        R(x - 4, hy, 1, 4, look.hair);
        R(x + 3, hy, 1, 4, look.hair);
        R(x - 2, hy - 4, 4, 3, look.hair);
        break;
      case "messy":
        R(x - 4, hy - 1, 8, 3, look.hair);
        R(x - 3, hy - 2, 2, 1, look.hair);
        R(x + 1, hy - 2, 3, 1, look.hair);
        R(x - 4, hy + 2, 1, 2, look.hair);
        break;
      case "beanie":
        R(x - 5, hy - 2, 10, 4, look.hair);
        R(x - 5, hy + 1, 10, 1, "#c9822a");
        R(x - 1, hy - 3, 2, 1, look.hair);
        break;
      case "curly":
        R(x - 5, hy - 2, 10, 3, look.hair);
        R(x - 5, hy + 1, 2, 3, look.hair);
        R(x + 3, hy + 1, 2, 3, look.hair);
        R(x - 4, hy - 3, 2, 1, look.hair);
        R(x + 1, hy - 3, 2, 1, look.hair);
        break;
    }
    // face
    const lookX = a.facing > 0 ? 1 : 0;
    if (sleeping) {
      R(x - 2, hy + 4, 2, 1, "#2a1d2e");
      R(x + 1, hy + 4, 2, 1, "#2a1d2e");
    } else {
      const blink = Math.sin(this.t * 1.3 + x) > 0.97;
      if (!blink) {
        R(x - 2 + lookX, hy + 3, 1, 2, "#2a1d2e");
        R(x + 1 + lookX, hy + 3, 1, 2, "#2a1d2e");
      } else {
        R(x - 2 + lookX, hy + 4, 1, 1, "#2a1d2e");
        R(x + 1 + lookX, hy + 4, 1, 1, "#2a1d2e");
      }
      if (a.activity === "celebrate") R(x - 1 + lookX, hy + 5, 2, 1, "#8a2a3a");
    }
    // extras
    switch (look.extra) {
      case "glasses":
        if (!sleeping) {
          R(x - 3 + lookX, hy + 2, 3, 1, look.extraColor);
          R(x + lookX, hy + 2, 3, 1, look.extraColor);
        }
        break;
      case "headphones":
        R(x - 5, hy + 2, 1, 3, look.extraColor);
        R(x + 4, hy + 2, 1, 3, look.extraColor);
        R(x - 4, hy - 2, 8, 1, look.extraColor);
        break;
      case "paint":
        R(x + 2, hy + 5, 1, 1, look.extraColor);
        break;
      case "bandana":
        R(x - 4, hy + 1, 8, 1, look.extraColor);
        R(x + 4, hy + 1, 2, 2, look.extraColor);
        break;
    }
  }

  private drawBubble(a: AgentState): void {
    const ctx = this.ctx;
    const sleeping = a.activity === "sleep" && a.seated;
    const icon: BubbleIcon | null = a.bubble ? a.bubble.icon : sleeping ? "zzz" : null;
    if (!icon) return;
    const box = this.agentBox(a.id);
    const bx = Math.round(Math.min(SCENE_W - 14, Math.max(1, a.x - 6)));
    const by = Math.round(box.y - 11);
    if (icon === "zzz") {
      const p = (this.t * 0.8) % 1;
      kit.drawText(ctx, "Z", bx + 8 + p * 3, by + 4 - p * 6, "#e6f0ff");
      kit.drawText(ctx, "z", bx + 4, by + 6, "#c9d1e9");
      return;
    }
    ctx.fillStyle = "#fdfaf3";
    ctx.fillRect(bx, by, 13, 9);
    ctx.fillRect(bx + 1, by - 1, 11, 11);
    ctx.fillRect(bx + 4, by + 10, 2, 1);
    ctx.fillRect(bx + 4, by + 11, 1, 1);
    const col = AGENTS[a.id].color;
    const dark = "#2b2033";
    switch (icon) {
      case "talk": {
        const n = Math.floor(this.t * 4) % 4;
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i < n ? dark : "#c9c2d6";
          ctx.fillRect(bx + 3 + i * 3, by + 4, 2, 2);
        }
        break;
      }
      case "!":
        kit.drawText(ctx, "!", bx + 5, by + 2, "#c8443c");
        kit.drawText(ctx, "!", bx + 8, by + 2, "#c8443c");
        break;
      case "?":
        kit.drawText(ctx, "?", bx + 5, by + 2, dark);
        break;
      case "heart":
        kit.drawShape(ctx, "heart", bx + 6.5, by + 5, 9, "#e2574c");
        break;
      case "note":
        kit.drawShape(ctx, "note", bx + 6.5, by + 4.5, 8, col === "#ffd56b" ? dark : dark);
        break;
      case "idea":
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(bx + 5, by + 2, 3, 4);
        ctx.fillStyle = dark;
        ctx.fillRect(bx + 5, by + 6, 3, 2);
        break;
    }
  }
}
