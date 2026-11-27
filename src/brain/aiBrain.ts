// The AI team: asks the studio server (which holds the API key) for each
// stage. Anything that goes wrong (no server, cap reached, refusal, bad
// output) falls back to the built-in brain for that stage, with a line in the
// diary so the night still ends with a game.

import type { CoverSpec, DesignDoc, Palette, PlaytestReport } from "../types";
import type { BubbleIcon } from "../studio/scene";
import { BuiltinBrain, type Brain, type GameBuild, type JobView } from "./brain";
import type { Line, WriterCtx } from "./writer";
import { buildDoneLines } from "./writer";
import { isPalette } from "../games/palettes";

export interface StudioStatus {
  ai: boolean;
  models: { coder: string | null; chatter: string | null };
  usage: { day: string; calls: number; cap: number; coderCalls: number; coderCap: number };
}

export class StudioError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

const API_BASE = new URL("api/", document.baseURI).toString();

export async function fetchStatus(timeoutMs = 3000): Promise<StudioStatus | null> {
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(API_BASE + "status", { signal: ctl.signal, cache: "no-store" });
    window.clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as StudioStatus;
    return j && typeof j.ai === "boolean" ? j : null;
  } catch {
    return null;
  }
}

type ApiLine = { who: string; text: string; mood: string };

async function studioCall<T>(task: string, body: Record<string, unknown>, timeoutMs: number): Promise<T & { usage?: StudioStatus["usage"] }> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(API_BASE + "studio", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ogs": "1" },
      body: JSON.stringify({ task, ...body }),
      signal: ctl.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new StudioError(String(j.error || "http_" + r.status), r.status);
    return j;
  } catch (e) {
    if (e instanceof StudioError) throw e;
    throw new StudioError(ctl.signal.aborted ? "timeout" : "offline", 0);
  } finally {
    window.clearTimeout(t);
  }
}

const MOOD: Record<string, BubbleIcon> = { talk: "talk", "!": "!", "?": "?", heart: "heart", note: "note", idea: "idea" };

function toLines(lines: ApiLine[] | undefined): Line[] {
  return (lines ?? [])
    .filter((l) => ["designer", "coder", "artist", "tester"].includes(l.who) && l.text)
    .map((l) => ({ who: l.who as Line["who"], text: l.text, icon: MOOD[l.mood] ?? "talk" }));
}

const REASONS: Record<string, string> = {
  daily_cap: "That's today's AI call budget spent. The rest of the night runs on the template cabinet.",
  daily_coder_cap: "We've used today's coding budget. I'm building from the template cabinet instead.",
  no_key: "No API key on the server, so it's the template cabinet tonight.",
  bad_key: "The server's API key was rejected. Template cabinet it is. Someone check the .env file.",
  refused: "The model passed on that one. I'll build it from the template cabinet.",
  rate_limited: "The model's rate-limited right now. Falling back to the template cabinet.",
  timeout: "The model's taking forever. I'm not waiting: template cabinet.",
  offline: "Can't reach the studio server. Template cabinet to the rescue.",
};

export class AiBrain implements Brain {
  readonly name = "ai" as const;
  private capped = false;
  private warned = false;

  constructor(
    private builtin: BuiltinBrain,
    private onUsage: (u: StudioStatus["usage"]) => void,
  ) {}

  private facts(job: JobView, w: WriterCtx): Record<string, unknown> {
    return {
      suggestedGenre: job.info.genre,
      hero: job.info.hero.word,
      item: job.info.item.word,
      hazard: job.info.hazard.word,
      place: job.info.place ?? "",
      weather: job.info.weather,
      moods: job.info.mods.join(", "),
      workingTitle: w.title,
      gamesShippedSoFar: w.lore.gamesShipped,
      thisWillBeGameNumber: w.lore.gamesShipped + 1,
      bugJarCount: w.lore.bugJar,
      v2NotebookIdeas: w.lore.v2Ideas,
    };
  }

  /** Run an AI call; on failure use the built-in result, with one explanatory line. */
  private async attempt<T>(fn: () => Promise<T>, fallback: () => Promise<T>, addNote: (r: T, note: Line) => T): Promise<T> {
    if (this.capped) return fallback();
    try {
      return await fn();
    } catch (e) {
      const code = e instanceof StudioError ? e.code : "failed";
      if (code === "daily_cap" || code === "no_key" || code === "bad_key") this.capped = true;
      const r = await fallback();
      if (this.warned && this.capped) return r;
      this.warned = true;
      return addNote(r, { who: "coder", text: REASONS[code] ?? "The AI call fell over. Template cabinet for this bit.", icon: "!" });
    }
  }

  private call<T>(task: string, body: Record<string, unknown>, timeoutMs = 60000) {
    return studioCall<T>(task, body, timeoutMs).then((r) => {
      if (r.usage) this.onUsage(r.usage);
      return r;
    });
  }

  private static atLeast(lines: Line[], n: number): Line[] {
    if (lines.length < n) throw new StudioError("bad_output", 0);
    return lines;
  }

  async kickoff(job: JobView, w: WriterCtx): Promise<Line[]> {
    return this.attempt(
      async () => AiBrain.atLeast(toLines((await this.call<{ lines: ApiLine[] }>("kickoff", { pitch: job.info.pitch, facts: this.facts(job, w) })).lines), 3),
      () => this.builtin.kickoff(job, w),
      (r, note) => [note, ...r],
    );
  }

  async design(job: JobView, w: WriterCtx) {
    return this.attempt(
      async () => {
        const r = await this.call<{ doc: DesignDoc; lines: ApiLine[] }>("design", { pitch: job.info.pitch, facts: this.facts(job, w) });
        const lines = toLines(r.lines);
        const doc = { ...r.doc, cut: r.doc.cut?.length ? r.doc.cut : w.cut };
        w.title = doc.title;
        const card: Line = { who: "designer", text: "Design doc v1 is up. Be gentle.", kind: "doc", data: doc, icon: "note" };
        return { doc, lines: [...lines.slice(0, 1), card, ...lines.slice(1)] };
      },
      () => this.builtin.design(job, w),
      (r, note) => ({ ...r, lines: [note, ...r.lines] }),
    );
  }

  async build(job: JobView, w: WriterCtx): Promise<{ build: GameBuild; lines: Line[]; after: Line[] }> {
    return this.attempt<{ build: GameBuild; lines: Line[]; after: Line[] }>(
      async () => {
        const r = await this.call<{ code: string; controls: string; lines: ApiLine[] }>(
          "build",
          { pitch: job.info.pitch, doc: job.doc, facts: this.facts(job, w) },
          10 * 60 * 1000,
        );
        const lineCount = r.code.split("\n").length;
        const after: Line[] = [
          { who: "coder", text: `Build's in: ${lineCount} lines of hand-written JavaScript.`, kind: "code", data: `${lineCount} lines, controls: ${r.controls}. Written by the Coder model, running in a sandboxed frame.` },
          ...buildDoneLines(w),
        ];
        return { build: { kind: "code", code: r.code, controls: r.controls }, lines: toLines(r.lines), after };
      },
      () => this.builtin.build(job, w),
      (r, note) => ({ ...r, lines: [note, ...r.lines] }),
    );
  }

  async art(job: JobView, w: WriterCtx): Promise<{ palette: Palette; cover: CoverSpec; lines: Line[] }> {
    return this.attempt(
      async () => {
        const r = await this.call<{ palette: Palette | null; cover: CoverSpec; lines: ApiLine[] }>("art", { pitch: job.info.pitch, doc: job.doc, facts: this.facts(job, w) });
        const base = await this.builtin.art(job, w);
        const palette = r.palette && isPalette(r.palette) ? { ...r.palette, names: fillNames(r.palette.names, base.palette.names) } : base.palette;
        const lines = toLines(r.lines);
        const card: Line = { who: "artist", text: "Swatches, for the record:", kind: "palette", data: palette };
        return { palette, cover: r.cover ?? base.cover, lines: [...lines.slice(0, 1), card, ...lines.slice(1)] };
      },
      () => this.builtin.art(job, w),
      (r, note) => ({ ...r, lines: [note, ...r.lines] }),
    );
  }

  async playtestTalk(job: JobView, w: WriterCtx, report: PlaytestReport, attempt: number): Promise<Line[]> {
    return this.attempt(
      async () => {
        const r = await this.call<{ lines: ApiLine[] }>("playtest", { pitch: job.info.pitch, report: summarise(report), facts: { ...this.facts(job, w), attempt } });
        const lines = AiBrain.atLeast(toLines(r.lines), 1);
        if (!report.pass) w.lore.bugJar += 1;
        const card: Line = { who: "tester", text: attempt === 0 ? "Playtest report:" : `Retest #${attempt}:`, kind: "report", data: report };
        return [...lines.slice(0, 1), card, ...lines.slice(1)];
      },
      () => this.builtin.playtestTalk(job, w, report, attempt),
      (r, note) => [note, ...r],
    );
  }

  async fix(job: JobView, w: WriterCtx, report: PlaytestReport, attempt: number): Promise<{ build: GameBuild; lines: Line[] }> {
    if (job.build?.kind !== "code") return this.builtin.fix(job, w, report, attempt);
    return this.attempt<{ build: GameBuild; lines: Line[] }>(
      async () => {
        const r = await this.call<{ code: string; controls: string; lines: ApiLine[] }>(
          "fix",
          { pitch: job.info.pitch, doc: job.doc, code: job.build!.code, report: summarise(report), attempt, facts: this.facts(job, w) },
          10 * 60 * 1000,
        );
        const lines = toLines(r.lines);
        lines.unshift({ who: "coder", text: `Fix #${attempt}. Reading Moss's report line by line.`, icon: "talk" });
        return { build: { kind: "code" as const, code: r.code, controls: r.controls }, lines };
      },
      () => this.builtin.fix(job, w, report, attempt),
      (r, note) => ({ ...r, lines: [note, ...r.lines] }),
    );
  }

  async polish(job: JobView, w: WriterCtx): Promise<Line[]> {
    return this.attempt(
      async () => AiBrain.atLeast(toLines((await this.call<{ lines: ApiLine[] }>("polish", { pitch: job.info.pitch, facts: this.facts(job, w) })).lines), 1),
      () => this.builtin.polish(job, w),
      (r, note) => [note, ...r],
    );
  }

  async ship(job: JobView, w: WriterCtx): Promise<{ title: string; tagline: string; lines: Line[] }> {
    return this.attempt(
      async () => {
        const r = await this.call<{ title: string; tagline: string; lines: ApiLine[] }>("ship", { pitch: job.info.pitch, doc: job.doc, facts: this.facts(job, w) });
        const lines = AiBrain.atLeast(toLines(r.lines), 2);
        return { title: r.title || w.title, tagline: r.tagline || w.tagline, lines };
      },
      () => this.builtin.ship(job, w),
      (r, note) => ({ ...r, lines: [note, ...r.lines] }),
    );
  }
}

function fillNames(names: string[] | undefined, fallback: string[]): string[] {
  return Array.from({ length: 6 }, (_, i) => (names && names[i]) || fallback[i] || "Mystery");
}

function summarise(r: PlaytestReport) {
  return {
    pass: r.pass,
    checks: r.checks.map((c) => ({ name: c.name, ok: c.ok, detail: c.detail })),
    errors: r.errors.slice(0, 5),
    survivedSecondsOfRandomPlay: r.survivedSeconds,
    bestScore: r.score,
    msPerFrame: r.msPerFrame,
  };
}
