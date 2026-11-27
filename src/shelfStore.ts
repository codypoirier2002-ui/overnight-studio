import type { ShippedGame } from "./types";
import { readJSON, writeJSON } from "./storage";

type Listener = (games: ShippedGame[]) => void;

let games: ShippedGame[] = [];
const listeners: Listener[] = [];

export function loadShelf(): ShippedGame[] {
  const raw = readJSON<unknown>("shelf", []);
  games = Array.isArray(raw) ? (raw.filter((g) => g && typeof g === "object" && typeof (g as ShippedGame).id === "string") as ShippedGame[]) : [];
  return games;
}

export function getShelf(): ShippedGame[] {
  return games;
}

export function getGame(id: string): ShippedGame | undefined {
  return games.find((g) => g.id === id);
}

function persist(): boolean {
  const ok = writeJSON("shelf", games);
  for (const l of listeners) l(games);
  return ok;
}

/** Adds (or replaces) a game. Returns false when the browser refused to store it. */
export function addGame(game: ShippedGame): boolean {
  games = [game, ...games.filter((g) => g.id !== game.id)];
  return persist();
}

export function removeGame(id: string): void {
  games = games.filter((g) => g.id !== id);
  persist();
}

export function replaceShelf(next: ShippedGame[]): boolean {
  games = next;
  return persist();
}

export function onShelfChange(fn: Listener): void {
  listeners.push(fn);
}
