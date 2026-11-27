// Remixing: turn a parsed pitch into a template plus tuning knobs.
import type { GameBuild } from "../brain/brain";
import { GENRE_CONTROLS, type Genre, type PitchInfo } from "../brain/pitch";
import type { Palette } from "../types";

const GOALS: Record<Genre, number> = { courier: 6, catcher: 25, runner: 60, shooter: 3, maze: 0, breaker: 0, stacker: 12, flyer: 15 };

const round = (n: number) => Math.round(n * 100) / 100;

export function remix(info: PitchInfo, _palette: Palette | undefined, difficulty = 1): GameBuild {
  const m = new Set(info.mods);
  const params: Record<string, unknown> = {
    hero: info.hero.shape,
    item: info.item.shape,
    hazard: info.hazard.shape,
    heroName: info.hero.word,
    itemName: info.item.word,
    hazardName: info.hazard.word,
    difficulty: round(difficulty * (m.has("slow") ? 0.8 : 1) * (m.has("fast") ? 1.1 : 1)),
    speed: m.has("fast") ? 1.2 : m.has("slow") ? 0.82 : 1,
    wind: m.has("wind") ? 0.8 : 0,
    dark: m.has("night"),
    ice: m.has("ice"),
    gravity: m.has("space") ? 0.6 : m.has("underwater") ? 0.65 : 1,
    size: m.has("tiny") ? 0.8 : m.has("giant") ? 1.3 : 1,
    weather: info.weather,
    goal: GOALS[info.genre],
    motif: info.motif,
  };
  return { kind: "template", templateId: info.genre, params, controls: GENRE_CONTROLS[info.genre] };
}
