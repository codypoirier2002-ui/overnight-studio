// The Director runs a night: it walks a Job through the seven stages, paces
// the diary, moves the crew around the office and advances the studio clock.
// Jobs are plain JSON and saved after every stage, so a night can be resumed.

import type { AgentId } from "../agents";
import { AGENT_ORDER } from "../agents";
import type { CoverSpec, DesignDoc, DiaryEntry, Palette, PlaytestReport, ShippedGame, StageId } from "../types";
import { STAGES } from "../types";
import type { Brain, GameBuild, JobView } from "../brain/brain";
import { parsePitch, type PitchInfo } from "../brain/pitch";
import { fillerLine, gaveUpLines, newWriterCtx, playtestIntro, type Line, type WriterCtx } from "../brain/writer";
import type { StudioScene } from "./scene";
import type { DiaryView } from "../ui/diaryView";
import { getLore, bumpLore } from "../lore";
import { readJSON, removeKey, uid, writeJSON } from "../storage";

export const MAX_FIXES = 3;

export interface Job {
  v: 1;
  id: string;
  pitch: string;
  stage: StageId;
  done: StageId[];
  attempt: number;
  clock: number; // minutes since 9 PM
  diary: DiaryEntry[];
  brain: "builtin" | "ai";
  doc?: DesignDoc;
  build?: GameBuild;
  palette?: Palette;
  cover?: CoverSpec;
  report?: PlaytestReport;
  title?: string;
  tagline?: string;
  fellBack?: boolean;
}

export interface GameMaker {
  /** Safe template build for a pitch (used when the AI build can't pass). */
  fallback(info: PitchInfo, palette: Palette | undefined): GameBuild;
  /** Run the automated playtest in a hidden sandboxed frame. */
  playtest(build: GameBuild, palette: Palette, title: string): Promise<PlaytestReport>;
}

export interface DirectorHooks {
  scene: StudioScene;
  diary: DiaryView;
  brain: () => Brain;
  builtin: Brain;
  maker: GameMaker;
  onStage: (stage: StageId | null, done: Set<StageId>, retry: boolean) => void;
  onShip: (game: ShippedGame) => void;
  onLine?: (entry: DiaryEntry) => void;
  onEnd?: () => void;
  sfx?: (name: string) => void;
}

const STAGE_START: Record<StageId, number> = {
  kickoff: 0,
  design: 40,
  build: 75,
  art: 255,
  playtest: 335,
  fixes: 395,
  ship: 495,
};
const STAGE_END = 560;

export function clockLabel(minutes: number): string {
  const total = (21 * 60 + Math.round(minutes)) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

export function clockHour(minutes: number): number {
  return ((21 * 60 + minutes) / 60) % 24;
}

export function saveJob(job: Job | null): void {
  if (job) writeJSON("job", job);
  else removeKey("job");
}

export function loadJob(): Job | null {
  const j = readJSON<Job | null>("job", null);
  if (!j || j.v !== 1 || typeof j.pitch !== "string" || !Array.isArray(j.diary)) return null;
  return j;
}

export class Director {
  speed = 1;
  private skipping = false;
  private wake: (() => void) | null = null;
  running = false;
  job: Job | null = null;
  private w: WriterCtx | null = null;
  private info: PitchInfo | null = null;

  constructor(private hooks: DirectorHooks) {}

  newJob(pitch: string): Job {
    return {
      v: 1,
      id: uid(),
      pitch,
      stage: "kickoff",
      done: [],
      attempt: 0,
      clock: 0,
      diary: [],
      brain: this.hooks.brain().name,
    };
  }

  /** Cut the current wait short and run the rest of the night instantly. */
  fastForward(): void {
    this.skipping = true;
    if (this.wake) this.wake();
  }

  private wait(ms: number): Promise<void> {
    if (this.skipping || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const t = window.setTimeout(done, ms / this.speed);
      function done() {
        window.clearTimeout(t);
        resolve();
      }
      this.wake = () => {
        this.wake = null;
        done();
      };
    });
  }

  private get view(): JobView {
    const j = this.job!;
    return { info: this.info!, doc: j.doc, build: j.build, palette: j.palette, report: j.report, attempt: j.attempt };
  }

  private setClock(min: number): void {
    const j = this.job!;
    j.clock = min;
    this.hooks.scene.setClock(Math.floor(clockHour(min)), Math.round(min) % 60);
  }

  private emit(line: Line, stage: StageId): DiaryEntry {
    const j = this.job!;
    const entry: DiaryEntry = { who: line.who, text: line.text, time: clockLabel(j.clock), stage, kind: line.kind, data: line.data };
    j.diary.push(entry);
    this.hooks.diary.append(entry);
    this.hooks.onLine?.(entry);
    if (line.who !== "system") {
      this.hooks.scene.say(line.who, line.icon ?? "talk", 2200);
      if (line.icon === "!") this.hooks.sfx?.("debate");
      else this.hooks.sfx?.("blip-" + line.who);
    }
    return entry;
  }

  private async play(lines: Line[], stage: StageId): Promise<void> {
    const j = this.job!;
    const nextStart = stage === "ship" ? STAGE_END : STAGE_START[STAGES[STAGES.findIndex((s) => s.id === stage) + 1].id];
    for (const line of lines) {
      if (line.who !== "system" && !this.skipping) {
        this.hooks.diary.showTyping(line.who);
        this.hooks.scene.say(line.who, "talk", 1500);
        const len = line.text.length;
        await this.wait(Math.min(3400, 650 + len * 22) + (line.kind ? 600 : 0));
      }
      const step = 2 + Math.floor(this.w!.rng() * 5);
      this.setClock(Math.min(nextStart - 3, j.clock + step));
      this.emit(line, stage);
    }
    this.hooks.diary.hideTyping();
  }

  /** Keep the studio chatty while a slow promise (an AI call) resolves. */
  private async withFiller<T>(p: Promise<T>, stage: StageId): Promise<T> {
    let settled = false;
    const done = p.finally(() => (settled = true));
    let fillers = 0;
    while (!settled && fillers < 12) {
      await Promise.race([done.catch(() => undefined), this.wait(5200)]);
      if (settled) break;
      if (this.skipping) {
        await done.catch(() => undefined);
        break;
      }
      await this.play([fillerLine(this.w!)], stage);
      fillers++;
    }
    return done;
  }

  private choreograph(stage: StageId): void {
    const s = this.hooks.scene;
    const set = (id: AgentId, a: Parameters<StudioScene["setActivity"]>[1]) => s.setActivity(id, a);
    for (const id of AGENT_ORDER) s.setBusy(id, 0.2);
    switch (stage) {
      case "kickoff":
        s.everyoneTo("meeting");
        break;
      case "design":
        set("designer", "whiteboard");
        set("coder", "kettle");
        set("artist", "desk");
        set("tester", "desk");
        break;
      case "build":
        set("designer", "desk");
        set("coder", "desk");
        set("artist", "desk");
        set("tester", "window");
        s.setBusy("coder", 1);
        break;
      case "art":
        set("artist", "desk");
        set("designer", "kettle");
        set("tester", "desk");
        set("coder", "desk");
        s.setBusy("artist", 1);
        break;
      case "playtest":
        set("tester", "desk");
        set("designer", "shelf");
        set("artist", "window");
        set("coder", "desk");
        s.setBusy("tester", 1);
        break;
      case "fixes":
        for (const id of AGENT_ORDER) set(id, "desk");
        s.setBusy("coder", 1);
        break;
      case "ship":
        s.everyoneTo("meeting");
        break;
    }
  }

  private enterStage(stage: StageId): void {
    const j = this.job!;
    j.stage = stage;
    if (j.clock < STAGE_START[stage]) this.setClock(STAGE_START[stage]);
    this.hooks.scene.stage = stage;
    this.choreograph(stage);
    this.hooks.onStage(stage, new Set(j.done), stage === "fixes" && j.report ? !j.report.pass : false);
    const label = STAGES.find((s) => s.id === stage)!.label;
    this.emit({ who: "system", text: `${label} · ${clockLabel(j.clock)}` }, stage);
    this.hooks.sfx?.("stage");
  }

  private finishStage(stage: StageId): void {
    const j = this.job!;
    if (!j.done.includes(stage)) j.done.push(stage);
    const idx = STAGES.findIndex((s) => s.id === stage);
    j.stage = idx + 1 < STAGES.length ? STAGES[idx + 1].id : "ship";
    saveJob(j);
  }

  async run(job: Job): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.skipping = false;
    this.job = job;
    this.info = parsePitch(job.pitch);
    this.w = newWriterCtx(this.info, getLore());
    this.hooks.scene.boardWords = this.info.words.map((x) => x.toUpperCase());
    this.hooks.scene.weather = this.info.weather;
    if (job.palette) this.hooks.scene.boardPalette = paletteColours(job.palette);
    if (job.title) this.w.title = job.title;
    if (job.diary.length) this.hooks.diary.renderAll(job.diary);
    else this.hooks.diary.clear();
    saveJob(job);
    try {
      const order = STAGES.map((s) => s.id);
      for (let i = order.indexOf(job.stage); i < order.length; i++) {
        const stage = order[i];
        this.enterStage(stage);
        await this.runStage(stage);
        this.finishStage(stage);
      }
    } finally {
      this.running = false;
      this.skipping = false;
      this.hooks.diary.hideTyping();
      this.hooks.onEnd?.();
    }
  }

  private brainFor(): Brain {
    return this.job!.fellBack ? this.hooks.builtin : this.hooks.brain();
  }

  private async runStage(stage: StageId): Promise<void> {
    const j = this.job!;
    const w = this.w!;
    const brain = this.brainFor();
    switch (stage) {
      case "kickoff": {
        const lines = await this.withFiller(brain.kickoff(this.view, w), stage);
        await this.play(lines, stage);
        break;
      }
      case "design": {
        const { doc, lines } = await this.withFiller(brain.design(this.view, w), stage);
        j.doc = doc;
        j.title = doc.title;
        w.title = doc.title;
        await this.play(lines, stage);
        break;
      }
      case "build": {
        const res = await this.withFiller(brain.build(this.view, w), stage);
        await this.play(res.lines, stage);
        j.build = res.build;
        await this.play(res.after, stage);
        break;
      }
      case "art": {
        const { palette, cover, lines } = await this.withFiller(brain.art(this.view, w), stage);
        j.palette = palette;
        j.cover = cover;
        this.hooks.scene.boardPalette = paletteColours(palette);
        await this.play(lines, stage);
        break;
      }
      case "playtest": {
        await this.play(playtestIntro(w), stage);
        const report = await this.withFiller(this.hooks.maker.playtest(j.build!, j.palette!, j.title ?? "Untitled"), stage);
        j.report = report;
        if (!report.pass) this.hooks.sfx?.("bug");
        const talk = await brain.playtestTalk(this.view, w, report, 0);
        await this.play(talk, stage);
        break;
      }
      case "fixes": {
        if (j.report?.pass) {
          await this.play(await brain.polish(this.view, w), stage);
          break;
        }
        while (j.report && !j.report.pass && j.attempt < MAX_FIXES) {
          j.attempt += 1;
          this.hooks.onStage("fixes", new Set(j.done), true);
          const { build, lines } = await this.withFiller(this.brainFor().fix(this.view, w, j.report, j.attempt), stage);
          await this.play(lines, stage);
          j.build = build;
          const report = await this.withFiller(this.hooks.maker.playtest(build, j.palette!, j.title ?? "Untitled"), stage);
          j.report = report;
          if (!report.pass) this.hooks.sfx?.("bug");
          await this.play(await this.brainFor().playtestTalk(this.view, w, report, j.attempt), stage);
          saveJob(j);
        }
        if (j.report && !j.report.pass) {
          // Out of tries: ship the safe template build so the night still ends with a game.
          await this.play(gaveUpLines(w), stage);
          j.build = this.hooks.maker.fallback(this.info!, j.palette);
          j.fellBack = true;
          const report = await this.hooks.maker.playtest(j.build, j.palette!, j.title ?? "Untitled");
          j.report = report;
          await this.play(await this.hooks.builtin.playtestTalk(this.view, w, report, j.attempt + 1), stage);
        }
        break;
      }
      case "ship": {
        const { title, tagline, lines } = await this.withFiller(brain.ship(this.view, w), stage);
        await this.play(lines.slice(0, -2), stage);
        j.title = title;
        j.tagline = tagline;
        const game = this.toShipped(j);
        bumpLore({ gamesShipped: 1, gerald: 1 }, title);
        this.hooks.onShip(game);
        this.hooks.sfx?.("ship");
        for (const id of AGENT_ORDER) this.hooks.scene.setActivity(id, "celebrate");
        await this.play(lines.slice(-2), stage);
        this.emit({ who: "system", text: `Shipped: ${title} · ${clockLabel(j.clock)}` }, stage);
        game.diary = [...j.diary];
        this.hooks.onShip(game);
        saveJob(null);
        await this.wait(2500);
        for (const id of AGENT_ORDER) this.hooks.scene.setActivity(id, "desk");
        this.hooks.onStage(null, new Set(STAGES.map((s) => s.id)), false);
        break;
      }
    }
  }

  private toShipped(j: Job): ShippedGame {
    const info = this.info!;
    const build = j.build!;
    return {
      id: j.id,
      title: j.title ?? "Untitled",
      tagline: j.tagline ?? "",
      pitch: j.pitch,
      createdAt: Date.now(),
      source: j.brain === "ai" && !j.fellBack && build.kind === "code" ? "ai" : "builtin",
      kind: build.kind,
      templateId: build.templateId,
      params: build.params,
      code: build.code,
      controls: build.controls,
      palette: j.palette!,
      cover: j.cover ?? { hero: info.hero.shape, item: info.item.shape, hazard: info.hazard.shape, motif: info.motif },
      doc: j.doc,
      diary: [...j.diary],
      playtest: j.report,
    };
  }
}

function paletteColours(p: Palette): string[] {
  return [p.bg, p.bg2, p.hero, p.accent, p.danger, p.text];
}
