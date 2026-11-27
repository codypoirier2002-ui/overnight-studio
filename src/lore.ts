// Studio lore: running jokes that persist between nights.
import { readJSON, writeJSON } from "./storage";

export interface Lore {
  gamesShipped: number;
  bugJar: number;
  v2Ideas: number;
  duckApprovals: number;
  gerald: number; // leaves on the office plant
  lastTitles: string[];
}

const DEFAULT: Lore = { gamesShipped: 0, bugJar: 36, v2Ideas: 211, duckApprovals: 88, gerald: 1, lastTitles: [] };

let lore: Lore = { ...DEFAULT };

export function loadLore(): Lore {
  lore = { ...DEFAULT, ...readJSON<Partial<Lore>>("lore", {}) };
  return lore;
}

export function getLore(): Lore {
  return lore;
}

export function bumpLore(patch: Partial<Record<keyof Omit<Lore, "lastTitles">, number>>, title?: string): Lore {
  for (const [k, v] of Object.entries(patch)) {
    (lore as unknown as Record<string, number>)[k] = ((lore as unknown as Record<string, number>)[k] || 0) + (v as number);
  }
  if (title) lore.lastTitles = [title, ...lore.lastTitles].slice(0, 6);
  writeJSON("lore", lore);
  return lore;
}

export function setLore(next: Lore): void {
  lore = { ...DEFAULT, ...next };
  writeJSON("lore", lore);
}
