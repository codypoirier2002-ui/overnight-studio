import type { AgentId } from "./agents";

export type StageId = "kickoff" | "design" | "build" | "art" | "playtest" | "fixes" | "ship";

export const STAGES: { id: StageId; label: string; short: string }[] = [
  { id: "kickoff", label: "Kickoff", short: "Kick" },
  { id: "design", label: "Design doc", short: "Doc" },
  { id: "build", label: "Build", short: "Build" },
  { id: "art", label: "Art pass", short: "Art" },
  { id: "playtest", label: "Playtest", short: "Test" },
  { id: "fixes", label: "Fixes", short: "Fix" },
  { id: "ship", label: "Ship", short: "Ship" },
];

/** Six named slots every game draws with. The Artist's pass swaps these. */
export interface Palette {
  bg: string;
  bg2: string;
  hero: string;
  accent: string;
  danger: string;
  text: string;
  names: string[]; // Wren's paint-sample names, same order as the keys above
}

export interface DesignDoc {
  title: string;
  logline: string;
  genre: string;
  player: string;
  goal: string;
  controls: string;
  hazards: string;
  twist: string;
  cut: string[];
}

export interface CoverSpec {
  hero: string; // shape name
  item: string;
  hazard: string;
  motif: string; // background motif, e.g. "rain", "stars", "bubbles"
}

export type DiaryKind = "line" | "doc" | "palette" | "report" | "note" | "code";

export interface DiaryEntry {
  who: AgentId | "system";
  text: string;
  time: string; // studio clock, e.g. "02:14"
  stage: StageId;
  kind?: DiaryKind;
  data?: unknown;
}

export interface PlaytestCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface PlaytestReport {
  pass: boolean;
  checks: PlaytestCheck[];
  errors: string[];
  frames: number;
  msPerFrame: number;
  survivedSeconds: number;
  score: number;
}

export interface ShippedGame {
  id: string;
  title: string;
  tagline: string;
  pitch: string;
  createdAt: number;
  source: "builtin" | "ai";
  kind: "template" | "code";
  templateId?: string;
  params?: Record<string, unknown>;
  code?: string;
  controls: string; // "lr", "4way", "tap", "lr+a", "4way+a"
  palette: Palette;
  cover: CoverSpec;
  doc?: DesignDoc;
  diary: DiaryEntry[];
  playtest?: PlaytestReport;
  shared?: boolean; // arrived via a share link
}
