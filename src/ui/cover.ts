// Code-drawn cartridge covers: deterministic from the game's palette, sprites,
// genre and title. Every cover is a little scene from its game.
import type { ShippedGame } from "../types";
import { kit } from "../games/kit";

export const COVER_W = 160;
export const COVER_H = 120;
const PLAY_H = 92; // above the title band

type CoverGame = Pick<ShippedGame, "title" | "palette" | "cover" | "id"> & Partial<Pick<ShippedGame, "templateId" | "source" | "kind">>;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export function drawCover(canvas: HTMLCanvasElement, game: CoverGame): void {
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const p = game.palette;
  const c = game.cover;
  const r = rng(hash(game.id + game.title));
  const S = (name: string, x: number, y: number, size: number, col: string, t = 0.3) => kit.drawShape(ctx, name, x, y, size, col, undefined, t);
  const R = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const g = ctx.createLinearGradient(0, 0, 0, COVER_H);
  g.addColorStop(0, kit.shade(p.bg, -0.15));
  g.addColorStop(1, kit.shade(p.bg, 0.15));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  drawMotif(ctx, c.motif, p, r);

  switch (game.kind === "code" ? "code" : game.templateId) {
    case "courier": {
      R(124, 34, 22, 34, kit.shade(p.bg2, -0.3));
      R(127, 37, 16, 31, p.accent);
      R(138, 52, 2, 2, p.bg);
      ctx.fillStyle = p.accent;
      for (let x = 50; x < 120; x += 8) ctx.fillRect(x, 64 + Math.sin(x / 9) * 4, 4, 1);
      S(c.hazard, 98, 26, 16, p.danger);
      S(c.hazard, 30, 78, 14, p.danger);
      S(c.hero, 44, 58, 32, p.hero);
      S(c.item, 44, 34, 16, p.accent);
      break;
    }
    case "catcher": {
      R(0, 82, COVER_W, 10, p.bg2);
      for (let i = 0; i < 6; i++) S(c.item, 18 + i * 25 + r() * 8, 8 + r() * 54, 13, p.accent, r() * 4);
      S(c.hazard, 120, 30, 16, p.danger);
      S(c.hero, 70, 70, 28, p.hero);
      R(54, 82, 32, 3, p.text);
      break;
    }
    case "runner": {
      R(0, 80, COVER_W, 12, p.bg2);
      for (let i = 0; i < 5; i++) R(10 + i * 6, 40 + i * 5, 14, 1, kit.shade(p.text, -0.3));
      S(c.hazard, 120, 70, 20, p.danger);
      for (let i = 0; i < 4; i++) S(c.item, 70 + i * 14, 26 + Math.abs(i - 1.5) * 6, 10, p.accent, i);
      S(c.hero, 50, 50, 30, p.hero);
      break;
    }
    case "shooter": {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) S(c.hazard, 26 + col * 27, 16 + row * 18, 14, p.danger, col);
      R(79, 44, 2, 30, p.accent);
      R(0, 86, COVER_W, 6, p.bg2);
      S(c.hero, 80, 76, 26, p.hero);
      break;
    }
    case "maze": {
      for (let x = 0; x < COVER_W; x += 20) for (let y = 0; y < PLAY_H; y += 20) if ((x / 20 + y / 20) % 2 === 0 && r() < 0.7) R(x + 4, y + 4, 12, 12, kit.shade(p.bg2, 0.1));
      for (let i = 0; i < 9; i++) S(c.item, 10 + r() * 140, 10 + r() * 72, 8, p.accent);
      S(c.hazard, 122, 30, 22, p.danger);
      S(c.hero, 52, 56, 30, p.hero);
      break;
    }
    case "breaker": {
      const cols = [p.accent, p.hero, p.danger, p.text];
      for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) if (r() < 0.85) R(6 + col * 21, 8 + row * 9, 19, 7, cols[row % cols.length]);
      S(c.item, 98, 56, 10, p.accent);
      R(56, 78, 42, 4, p.text);
      S(c.hero, 77, 88, 14, p.hero);
      break;
    }
    case "stacker": {
      let w = 70;
      let x = 45;
      for (let i = 0; i < 5; i++) {
        R(x, 80 - i * 11, w, 10, i % 2 ? p.accent : kit.shade(p.accent, -0.2));
        S(c.item, x + w / 2, 85 - i * 11, 8, kit.shade(p.accent, -0.45));
        x += (r() - 0.5) * 8;
        w -= 4;
      }
      S(c.hero, x + w / 2, 18, 22, p.hero);
      R(104, 8, 38, 9, kit.shade(p.accent, 0.15));
      break;
    }
    case "flyer": {
      R(96, 0, 22, 30, kit.shade(p.danger, -0.35));
      R(93, 26, 28, 5, p.danger);
      R(96, 64, 22, 28, kit.shade(p.danger, -0.35));
      R(93, 62, 28, 5, p.danger);
      S(c.item, 107, 46, 10, p.accent);
      S(c.hero, 52, 44, 30, p.hero);
      for (let i = 0; i < 3; i++) R(20 + i * 6, 50 + i * 4, 10, 1, kit.shade(p.text, -0.3));
      break;
    }
    default: {
      ctx.fillStyle = kit.shade(p.accent, -0.4);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(80, 48);
        ctx.lineTo(80 + Math.cos(a) * 90, 48 + Math.sin(a) * 90);
        ctx.lineTo(80 + Math.cos(a + 0.18) * 90, 48 + Math.sin(a + 0.18) * 90);
        ctx.fill();
      }
      S(c.hazard, 26, 70, 20, p.danger);
      S(c.item, 128, 24, 18, p.accent);
      S(c.item, 136, 66, 12, p.accent);
      S(c.hero, 80, 48, 42, p.hero);
    }
  }

  // label band
  R(0, PLAY_H, COVER_W, COVER_H - PLAY_H, kit.shade(p.bg, -0.45));
  R(0, PLAY_H, COVER_W, 2, p.accent);
  const title = game.title.toUpperCase();
  const fits2 = kit.textWidth(title, 2) <= COVER_W - 12;
  if (fits2) {
    kit.drawText(ctx, title, COVER_W / 2 + 1, 102, "#000000", 2, "center");
    kit.drawText(ctx, title, COVER_W / 2, 101, p.text, 2, "center");
  } else {
    const lines = kit.wrapText(title, COVER_W - 10, 1).slice(0, 2);
    lines.forEach((line, i) => {
      const y = lines.length === 1 ? 103 : 98 + i * 8;
      kit.drawText(ctx, line, COVER_W / 2 + 1, y + 1, "#000000", 1, "center");
      kit.drawText(ctx, line, COVER_W / 2, y, p.text, 1, "center");
    });
  }
  // studio mark + AI ribbon
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(3, 3, 37, 9);
  ctx.fillStyle = "#ffd56b";
  ctx.beginPath();
  ctx.arc(8, 7.5, 3, 0, Math.PI * 2);
  ctx.fill();
  kit.drawText(ctx, "OGS", 13, 5, "#f4efe6", 1);
  kit.drawText(ctx, "#" + ((hash(game.id) % 900) + 100), 27, 5, "#9a8cab", 1);
  if (game.source === "ai") {
    R(COVER_W - 22, 3, 19, 9, p.accent);
    kit.drawText(ctx, "AI", COVER_W - 12, 5, kit.shade(p.bg, -0.4), 1, "center");
  }
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, COVER_W - 2, COVER_H - 2);
}

function drawMotif(ctx: CanvasRenderingContext2D, motif: string, p: ShippedGame["palette"], r: () => number): void {
  ctx.globalAlpha = 0.45;
  switch (motif) {
    case "rain":
      ctx.fillStyle = p.text;
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(r() * 160), Math.floor(r() * PLAY_H), 1, 4);
      break;
    case "snow":
      ctx.fillStyle = p.text;
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(r() * 160), Math.floor(r() * PLAY_H), 2, 2);
      break;
    case "bubbles":
      ctx.strokeStyle = p.text;
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.arc(r() * 160, r() * PLAY_H, 2 + r() * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "grid":
      ctx.fillStyle = p.bg2;
      for (let x = 0; x < 160; x += 16) ctx.fillRect(x, 0, 1, PLAY_H);
      for (let y = 0; y < PLAY_H; y += 16) ctx.fillRect(0, y, 160, 1);
      break;
    case "sun":
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.arc(132, 26, 14, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "city":
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = p.bg2;
      for (let x = 0; x < 160; ) {
        const w = 8 + Math.floor(r() * 14);
        const hgt = 14 + Math.floor(r() * 34);
        ctx.fillRect(x, PLAY_H - hgt, w, hgt);
        x += w + 1;
      }
      break;
    case "leaf":
      ctx.fillStyle = p.bg2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(r() * 160, PLAY_H, 14 + r() * 14, Math.PI, 0);
        ctx.fill();
      }
      break;
    default:
      ctx.fillStyle = p.text;
      for (let i = 0; i < 30; i++) ctx.fillRect(Math.floor(r() * 160), Math.floor(r() * PLAY_H), 1, 1);
  }
  ctx.globalAlpha = 1;
}
