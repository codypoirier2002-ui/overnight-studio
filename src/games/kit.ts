// Typed handle on the PixelKit classic script (shared with the game frames).
import "./pixelkit.js";
import pixelkitSource from "./pixelkit.js?raw";

type Ctx = CanvasRenderingContext2D;

export interface PixelKit {
  textWidth(str: string, scale?: number): number;
  drawText(ctx: Ctx, str: string, x: number, y: number, color: string, scale?: number, align?: "left" | "center" | "right"): number;
  wrapText(str: string, maxWidth: number, scale?: number): string[];
  shapeNames: string[];
  drawShape(ctx: Ctx, name: string, x: number, y: number, size: number, color: string, detail?: string, t?: number): void;
  shade(hex: string, amt: number): string;
}

export const kit: PixelKit = (globalThis as unknown as { PIXELKIT: PixelKit }).PIXELKIT;
export const PIXELKIT_SOURCE: string = pixelkitSource;
