// Code-drawn cartridge covers. Deterministic from the game's palette + cover spec.
import type { ShippedGame } from "../types";
import { kit } from "../games/kit";

export const COVER_W = 160;
export const COVER_H = 120;

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

export function drawCover(canvas: HTMLCanvasElement, game: Pick<ShippedGame, "title" | "palette" | "cover" | "id">): void {
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const p = game.palette;
  const r = rng(hash(game.id + game.title));
  const g = ctx.createLinearGradient(0, 0, 0, COVER_H);
  g.addColorStop(0, p.bg);
  g.addColorStop(1, p.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  drawMotif(ctx, game.cover.motif, p.text, p.accent, r);
  // horizon / ground band
  ctx.fillStyle = kit.shade(p.bg2, -0.25);
  ctx.fillRect(0, 86, COVER_W, 34);
  ctx.fillStyle = kit.shade(p.bg2, 0.12);
  ctx.fillRect(0, 86, COVER_W, 2);
  // cast
  kit.drawShape(ctx, game.cover.hazard, 28 + r() * 10, 70 + r() * 8, 22, p.danger, undefined, r() * 5);
  kit.drawShape(ctx, game.cover.item, 128 - r() * 10, 40 + r() * 14, 18, p.accent, undefined, r() * 5);
  kit.drawShape(ctx, game.cover.item, 112 - r() * 6, 66 + r() * 6, 12, p.accent, undefined, r() * 5);
  kit.drawShape(ctx, game.cover.hero, 76, 58, 40, p.hero, undefined, 0.3);
  // title block
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 92, COVER_W, 28);
  const lines = kit.wrapText(game.title.toUpperCase(), COVER_W - 12, 2).slice(0, 2);
  const scale = lines.length > 1 || kit.textWidth(lines[0] || "", 2) > COVER_W - 12 ? 1 : 2;
  const fitted = scale === 1 ? kit.wrapText(game.title.toUpperCase(), COVER_W - 12, 1).slice(0, 2) : lines;
  fitted.forEach((line, i) => {
    const y = scale === 2 ? 101 : 97 + i * 8 + (fitted.length === 1 ? 4 : 0);
    kit.drawText(ctx, line, COVER_W / 2 + 1, y + 1, "#000000", scale, "center");
    kit.drawText(ctx, line, COVER_W / 2, y, p.text, scale, "center");
  });
  // cartridge frame
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, COVER_W - 2, COVER_H - 2);
}

function drawMotif(ctx: CanvasRenderingContext2D, motif: string, ink: string, accent: string, r: () => number): void {
  ctx.globalAlpha = 0.5;
  switch (motif) {
    case "rain":
      ctx.fillStyle = ink;
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(r() * 160), Math.floor(r() * 90), 1, 4);
      break;
    case "snow":
      ctx.fillStyle = ink;
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(r() * 160), Math.floor(r() * 90), 2, 2);
      break;
    case "bubbles":
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.arc(r() * 160, r() * 86, 2 + r() * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "grid":
      ctx.fillStyle = ink;
      for (let x = 0; x < 160; x += 16) ctx.fillRect(x, 0, 1, 86);
      for (let y = 0; y < 86; y += 16) ctx.fillRect(0, y, 160, 1);
      break;
    case "sun":
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(130, 26, 14, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "city":
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#000000";
      for (let x = 0; x < 160; ) {
        const w = 8 + Math.floor(r() * 14);
        const hgt = 14 + Math.floor(r() * 34);
        ctx.fillRect(x, 86 - hgt, w, hgt);
        x += w + 1;
      }
      break;
    default:
      ctx.fillStyle = ink;
      for (let i = 0; i < 30; i++) ctx.fillRect(Math.floor(r() * 160), Math.floor(r() * 80), 1, 1);
  }
  ctx.globalAlpha = 1;
}
