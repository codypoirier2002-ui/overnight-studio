// The arcade cabinet: plays a shipped game in a sandboxed frame inside a dialog.
import type { ShippedGame } from "../types";
import { buildGameHtml, createGameFrame } from "../games/frame";
import { readJSON, writeJSON } from "../storage";
import { renderArchive } from "./diaryView";
import { $, h } from "./dom";

const CONTROL_HINTS: Record<string, string> = {
  lr: "Move with Left/Right or A/D. On touch, use the arrow buttons.",
  "4way": "Move with the arrow keys or WASD. On touch, use the d-pad.",
  tap: "Space (or tap the screen) is your only button.",
  "lr+a": "Left/Right to move, Space or Z to fire. On touch, use the buttons.",
  "4way+a": "Arrows to move, Space or Z for the action.",
};

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS", "Space", "KeyZ", "KeyX", "KeyJ", "KeyK", "Enter", "ShiftLeft", "ShiftRight"]);

export function bestScores(): Record<string, number> {
  return readJSON<Record<string, number>>("best", {});
}

export interface PlayerHooks {
  onDelete: (game: ShippedGame) => void;
  onShare: (game: ShippedGame) => void;
  onSaveShared: (game: ShippedGame) => void;
  sound: () => boolean;
  onOpenChange: (open: boolean) => void;
}

export class Player {
  private dialog = $("#player") as HTMLDialogElement;
  private frame: HTMLIFrameElement | null = null;
  private game: ShippedGame | null = null;

  constructor(private hooks: PlayerHooks) {
    $("#player-close").addEventListener("click", () => this.close());
    this.dialog.addEventListener("close", () => this.teardown());
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) this.close();
    });
    for (const tab of this.dialog.querySelectorAll<HTMLButtonElement>(".tab")) {
      tab.addEventListener("click", () => this.showTab(tab.dataset.tab ?? "play"));
    }
    $("#delete-btn").addEventListener("click", () => {
      if (this.game && window.confirm(`Remove "${this.game.title}" from your shelf? This can't be undone.`)) {
        const g = this.game;
        this.close();
        this.hooks.onDelete(g);
      }
    });
    $("#share-btn").addEventListener("click", () => this.game && this.hooks.onShare(this.game));
    $("#save-shared-btn").addEventListener("click", () => {
      if (!this.game) return;
      this.hooks.onSaveShared(this.game);
      $("#save-shared-btn").hidden = true;
      $("#delete-btn").hidden = false;
    });
    window.addEventListener("message", (e) => this.onMessage(e));
    const forward = (down: boolean) => (e: KeyboardEvent) => {
      if (!this.dialog.open || !this.frame || !GAME_KEYS.has(e.code)) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement | null)?.closest?.(".player-foot, .player-tabs, .player-head") && (e.code === "Space" || e.code === "Enter")) return;
      e.preventDefault();
      this.frame.contentWindow?.postMessage({ type: "ogs:key", code: e.code, down }, "*");
    };
    window.addEventListener("keydown", forward(true));
    window.addEventListener("keyup", forward(false));
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  open(game: ShippedGame, opts: { shared?: boolean } = {}): void {
    this.teardown();
    this.game = game;
    $("#player-title").textContent = game.title;
    $("#player-tagline").textContent = game.tagline || game.pitch;
    $("#player-controls").textContent = CONTROL_HINTS[game.controls] ?? "";
    renderArchive($("#player-diary"), game.diary);
    this.renderDoc(game);
    $("#save-shared-btn").hidden = !opts.shared;
    $("#delete-btn").hidden = !!opts.shared;
    this.showTab("play");
    const html = buildGameHtml(
      { kind: game.kind, templateId: game.templateId, params: game.params, code: game.code },
      { title: game.title, pal: game.palette, seed: hashId(game.id), best: bestScores()[game.id] ?? 0, sound: this.hooks.sound() },
    );
    this.frame = createGameFrame(html, `${game.title} (game)`);
    this.frame.addEventListener("load", () => this.frame?.focus());
    $("#frame-host").replaceChildren(this.frame);
    if (!this.dialog.open) this.dialog.showModal();
    this.hooks.onOpenChange(true);
  }

  setMuted(muted: boolean): void {
    this.frame?.contentWindow?.postMessage({ type: "ogs:mute", muted }, "*");
  }

  close(): void {
    if (this.dialog.open) this.dialog.close();
    else this.teardown();
  }

  private teardown(): void {
    if (this.frame) {
      this.frame.remove();
      this.frame = null;
    }
    if (this.game) {
      this.game = null;
      this.hooks.onOpenChange(false);
    }
  }

  private showTab(name: string): void {
    for (const t of this.dialog.querySelectorAll<HTMLElement>(".tab")) {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    }
    for (const p of this.dialog.querySelectorAll<HTMLElement>(".tab-pane")) p.classList.toggle("is-active", p.dataset.pane === name);
    if (name === "play") this.frame?.focus();
    else this.frame?.contentWindow?.postMessage({ type: "ogs:release" }, "*");
  }

  private renderDoc(game: ShippedGame): void {
    const host = $("#player-doc");
    const d = game.doc;
    const rows: [string, string][] = d
      ? [["Pitch", game.pitch], ["Logline", d.logline], ["Genre", d.genre], ["Goal", d.goal], ["Controls", d.controls], ["Hazards", d.hazards], ["Twist", d.twist], ["Cut for v2", d.cut.join(", ")]]
      : [["Pitch", game.pitch]];
    rows.push(["Built by", game.source === "ai" ? "The AI team (custom code)" : `The template cabinet (${game.templateId ?? "remix"})`]);
    if (game.playtest) rows.push(["Playtest", `${game.playtest.pass ? "Passed" : "Shipped anyway"}: ${game.playtest.checks.map((c) => c.name + (c.ok ? " ok" : " FAIL")).join(", ")}`]);
    host.replaceChildren(h("div", { class: "card" }, h("dl", {}, ...rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]))));
  }

  private onMessage(e: MessageEvent): void {
    if (!this.frame || e.source !== this.frame.contentWindow || !this.game) return;
    const data = e.data as { type?: string; score?: unknown };
    if (!data || typeof data !== "object") return;
    if (data.type === "ogs:best" && typeof data.score === "number" && isFinite(data.score)) {
      const best = bestScores();
      const id = this.game.id;
      if ((best[id] ?? 0) < data.score) {
        best[id] = Math.min(1e9, Math.floor(data.score));
        writeJSON("best", best);
      }
    }
  }
}

export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
