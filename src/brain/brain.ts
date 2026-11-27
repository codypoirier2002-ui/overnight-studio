// A Brain writes the crew's words and makes the creative decisions for each
// stage. BuiltinBrain needs nothing but this file; AiBrain (step 4) asks the
// server and falls back to BuiltinBrain whenever anything goes wrong.

import type { CoverSpec, DesignDoc, Palette, PlaytestReport } from "../types";
import type { PitchInfo } from "./pitch";
import { GENRE_CONTROLS } from "./pitch";
import {
  artLines,
  buildDoneLines,
  buildLines,
  designLines,
  fixLines,
  kickoffLines,
  makeDoc,
  playtestLines,
  polishLines,
  shipLines,
  type Line,
  type WriterCtx,
} from "./writer";
import { pickPalette } from "../games/palettes";

export interface GameBuild {
  kind: "template" | "code";
  templateId?: string;
  params?: Record<string, unknown>;
  code?: string;
  controls: string;
}

export interface JobView {
  info: PitchInfo;
  doc?: DesignDoc;
  build?: GameBuild;
  palette?: Palette;
  report?: PlaytestReport;
  attempt: number;
}

export interface Brain {
  readonly name: "builtin" | "ai";
  kickoff(job: JobView, w: WriterCtx): Promise<Line[]>;
  design(job: JobView, w: WriterCtx): Promise<{ doc: DesignDoc; lines: Line[] }>;
  build(job: JobView, w: WriterCtx): Promise<{ build: GameBuild; lines: Line[]; after: Line[] }>;
  art(job: JobView, w: WriterCtx): Promise<{ palette: Palette; cover: CoverSpec; lines: Line[] }>;
  playtestTalk(job: JobView, w: WriterCtx, report: PlaytestReport, attempt: number): Promise<Line[]>;
  fix(job: JobView, w: WriterCtx, report: PlaytestReport, attempt: number): Promise<{ build: GameBuild; lines: Line[] }>;
  polish(job: JobView, w: WriterCtx): Promise<Line[]>;
  ship(job: JobView, w: WriterCtx): Promise<{ title: string; tagline: string; lines: Line[] }>;
}

/** Remixer hook so the built-in brain can turn a pitch into a template build. */
export type Remixer = (info: PitchInfo, palette: Palette | undefined, difficulty: number) => GameBuild;

export class BuiltinBrain implements Brain {
  readonly name = "builtin" as const;
  constructor(private remix: Remixer) {}

  async kickoff(job: JobView, w: WriterCtx): Promise<Line[]> {
    return kickoffLines(w, GENRE_CONTROLS[job.info.genre]);
  }

  async design(job: JobView, w: WriterCtx) {
    const doc = makeDoc(w, GENRE_CONTROLS[job.info.genre]);
    return { doc, lines: designLines(w, doc) };
  }

  async build(job: JobView, w: WriterCtx) {
    const build = this.remix(job.info, job.palette, 1);
    return { build, lines: buildLines(w, build.controls), after: buildDoneLines(w) };
  }

  async art(job: JobView, w: WriterCtx) {
    const palette = pickPalette(job.info, w.rng);
    const cover: CoverSpec = {
      hero: job.info.hero.shape,
      item: job.info.item.shape,
      hazard: job.info.hazard.shape,
      motif: job.info.motif,
    };
    return { palette, cover, lines: artLines(w, palette) };
  }

  async playtestTalk(_job: JobView, w: WriterCtx, report: PlaytestReport, attempt: number) {
    return playtestLines(w, report, attempt);
  }

  async fix(job: JobView, w: WriterCtx, report: PlaytestReport, attempt: number) {
    // Template games fail mostly on balance: ease the difficulty each try.
    const build = this.remix(job.info, job.palette, Math.max(0.35, 1 - attempt * 0.25));
    return { build, lines: fixLines(w, report, attempt) };
  }

  async polish(_job: JobView, w: WriterCtx) {
    return polishLines(w);
  }

  async ship(_job: JobView, w: WriterCtx) {
    const lines = shipLines(w);
    return { title: w.title, tagline: w.tagline, lines };
  }
}
