// Back up the shelf (games, lore, best scores) to a file, and restore it, e.g.
// to move your arcade from a laptop to a phone.
import type { ShippedGame } from "./types";
import { getShelf, replaceShelf } from "./shelfStore";
import { getLore, setLore, type Lore } from "./lore";
import { readJSON, writeJSON } from "./storage";
import { sanitizeGame } from "./share";

export function exportBackup(): void {
  const data = {
    app: "overnight-game-studio",
    v: 1,
    exportedAt: new Date().toISOString(),
    shelf: getShelf(),
    lore: getLore(),
    best: readJSON<Record<string, number>>("best", {}),
  };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `overnight-studio-shelf-${data.exportedAt.slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Merge a backup into this browser. Returns how many games were added. */
export async function importBackup(file: File): Promise<{ added: number; skipped: number }> {
  if (file.size > 20 * 1024 * 1024) throw new Error("That file is too big to be a shelf backup.");
  const data = JSON.parse(await file.text());
  if (!data || data.app !== "overnight-game-studio" || !Array.isArray(data.shelf)) throw new Error("That doesn't look like an Overnight Game Studio backup.");
  const existing = new Map(getShelf().map((g) => [g.id, g]));
  let added = 0;
  let skipped = 0;
  const incoming: ShippedGame[] = [];
  for (const raw of data.shelf.slice(0, 500)) {
    const g = sanitizeGame(raw);
    if (!g || existing.has(g.id)) {
      skipped++;
      continue;
    }
    incoming.push(g);
    added++;
  }
  const merged = [...incoming, ...existing.values()].sort((a, b) => b.createdAt - a.createdAt);
  if (!replaceShelf(merged)) throw new Error("This browser ran out of storage space while restoring.");
  if (data.lore && typeof data.lore === "object") {
    const cur = getLore();
    const num = (k: keyof Lore) => Math.max(Number(cur[k]) || 0, Number((data.lore as Record<string, unknown>)[k]) || 0);
    setLore({ ...cur, gamesShipped: num("gamesShipped"), bugJar: num("bugJar"), v2Ideas: num("v2Ideas"), duckApprovals: num("duckApprovals"), gerald: num("gerald") });
  }
  if (data.best && typeof data.best === "object") {
    const best = readJSON<Record<string, number>>("best", {});
    for (const [k, v] of Object.entries(data.best as Record<string, unknown>)) {
      if (typeof v === "number" && isFinite(v) && /^[a-z0-9-]{1,48}$/i.test(k)) best[k] = Math.max(best[k] ?? 0, Math.min(1e9, Math.floor(v)));
    }
    writeJSON("best", best);
  }
  return { added, skipped };
}
