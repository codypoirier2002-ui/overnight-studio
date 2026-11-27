import { AGENTS, type AgentId } from "../agents";
import type { DesignDoc, DiaryEntry, Palette, PlaytestReport } from "../types";
import { PALETTE_KEYS } from "../games/palettes";
import { h } from "./dom";

const avatarCache: Partial<Record<AgentId, string>> = {};

/** 16x16 pixel portrait drawn from the agent's look. */
export function avatarFor(id: AgentId): string {
  const hit = avatarCache[id];
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  const a = AGENTS[id];
  const L = a.look;
  const R = (x: number, y: number, w: number, hh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, hh);
  };
  R(0, 0, 16, 16, a.color);
  R(3, 12, 10, 4, L.shirt);
  R(3, 12, 10, 1, L.shirtTrim);
  R(4, 4, 8, 8, L.skin);
  switch (L.hairStyle) {
    case "bun":
      R(4, 3, 8, 3, L.hair);
      R(4, 4, 1, 4, L.hair);
      R(11, 4, 1, 4, L.hair);
      R(6, 1, 4, 2, L.hair);
      break;
    case "messy":
      R(4, 3, 8, 3, L.hair);
      R(5, 2, 2, 1, L.hair);
      R(9, 2, 3, 1, L.hair);
      break;
    case "beanie":
      R(3, 2, 10, 4, L.hair);
      R(3, 5, 10, 1, "#c9822a");
      break;
    case "curly":
      R(3, 2, 10, 3, L.hair);
      R(3, 5, 2, 3, L.hair);
      R(11, 5, 2, 3, L.hair);
      break;
  }
  R(6, 7, 1, 2, "#2a1d2e");
  R(9, 7, 1, 2, "#2a1d2e");
  if (L.extra === "glasses") {
    R(5, 6, 3, 1, L.extraColor);
    R(8, 6, 3, 1, L.extraColor);
  } else if (L.extra === "headphones") {
    R(3, 6, 1, 3, L.extraColor);
    R(12, 6, 1, 3, L.extraColor);
    R(4, 2, 8, 1, L.extraColor);
  } else if (L.extra === "bandana") {
    R(4, 5, 8, 1, L.extraColor);
  } else if (L.extra === "paint") {
    R(10, 10, 1, 1, L.extraColor);
  }
  R(7, 10, 2, 1, "#8a4a4a");
  const url = c.toDataURL();
  avatarCache[id] = url;
  return url;
}

function docCard(doc: DesignDoc): HTMLElement {
  const row = (k: string, v: string) => [h("dt", {}, k), h("dd", {}, v)];
  return h(
    "div",
    { class: "card" },
    h("h4", {}, doc.title),
    h(
      "dl",
      {},
      ...row("Logline", doc.logline),
      ...row("Genre", doc.genre),
      ...row("Goal", doc.goal),
      ...row("Controls", doc.controls),
      ...row("Hazards", doc.hazards),
      ...row("Twist", doc.twist),
      ...row("Cut", doc.cut.join(", ")),
    ),
  );
}

function paletteCard(p: Palette): HTMLElement {
  return h(
    "div",
    { class: "card swatches" },
    ...PALETTE_KEYS.map((k, i) => {
      const sw = h("i");
      sw.style.background = p[k];
      return h("span", { class: "swatch", title: p[k] }, sw, p.names[i] ?? k);
    }),
  );
}

function reportCard(r: PlaytestReport): HTMLElement {
  const list = h(
    "ul",
    { class: "checks" },
    ...r.checks.map((c) => h("li", { class: c.ok ? "" : "bad" }, `${c.name}: ${c.detail}`)),
  );
  return h(
    "div",
    { class: "card" },
    h("h4", {}, r.pass ? "PASS" : "FAIL"),
    list,
    r.errors.length ? h("p", { class: "muted" }, "Errors: " + r.errors.slice(0, 3).join(" | ")) : null,
  );
}

function codeCard(note: string): HTMLElement {
  return h("div", { class: "card" }, h("p", { class: "muted" }, note));
}

export function entryEl(e: DiaryEntry): HTMLElement {
  if (e.who === "system") {
    return h("div", { class: "entry is-system" }, e.text);
  }
  const a = AGENTS[e.who];
  const img = h("img", { class: "avatar", src: avatarFor(e.who), alt: "", width: 32, height: 32 });
  let extra: HTMLElement | null = null;
  if (e.kind === "doc" && e.data) extra = docCard(e.data as DesignDoc);
  else if (e.kind === "palette" && e.data) extra = paletteCard(e.data as Palette);
  else if (e.kind === "report" && e.data) extra = reportCard(e.data as PlaytestReport);
  else if (e.kind === "code" && typeof e.data === "string") extra = codeCard(e.data);
  const who = h("span", { class: "who" }, a.name);
  who.style.color = a.color;
  return h(
    "div",
    { class: "entry", "data-who": e.who, "data-stage": e.stage },
    img,
    h("div", {}, h("div", { class: "meta" }, who, h("span", { class: "time" }, e.time)), h("div", { class: "text" }, e.text), extra),
  );
}

export class DiaryView {
  private typingEl: HTMLElement | null = null;
  constructor(private host: HTMLElement) {}

  clear(): void {
    this.host.replaceChildren();
    this.typingEl = null;
  }

  private nearBottom(): boolean {
    return this.host.scrollHeight - this.host.scrollTop - this.host.clientHeight < 80;
  }

  append(e: DiaryEntry): void {
    const stick = this.nearBottom();
    this.hideTyping();
    this.host.append(entryEl(e));
    if (stick) this.host.scrollTop = this.host.scrollHeight;
  }

  showTyping(who: AgentId | "system"): void {
    if (who === "system") return;
    const stick = this.nearBottom();
    if (!this.typingEl) {
      this.typingEl = h("p", { class: "typing" });
      this.host.append(this.typingEl);
    }
    this.typingEl.textContent = `${AGENTS[who].name} is typing...`;
    if (stick) this.host.scrollTop = this.host.scrollHeight;
  }

  hideTyping(): void {
    if (this.typingEl) {
      this.typingEl.remove();
      this.typingEl = null;
    }
  }

  renderAll(entries: DiaryEntry[]): void {
    this.clear();
    for (const e of entries) this.host.append(entryEl(e));
    this.host.scrollTop = this.host.scrollHeight;
  }
}

export function renderArchive(host: HTMLElement, entries: DiaryEntry[]): void {
  host.replaceChildren(...entries.map(entryEl));
  if (!entries.length) host.append(h("p", { class: "diary-empty" }, "No diary for this one."));
}
