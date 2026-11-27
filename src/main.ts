import "./style.css";
import { StudioScene } from "./studio/scene";
import { Director, loadJob } from "./studio/director";
import type { GameMaker } from "./studio/director";
import { BuiltinBrain, type Brain, type GameBuild } from "./brain/brain";
import { GENRE_CONTROLS, PITCH_IDEAS } from "./brain/pitch";
import { renderStages } from "./ui/stagesView";
import { renderShelf } from "./ui/shelfView";
import { showAgentCard } from "./ui/agentCard";
import { DiaryView } from "./ui/diaryView";
import { loadShelf, onShelfChange, getShelf, addGame } from "./shelfStore";
import { loadLore, getLore } from "./lore";
import { readJSON, writeJSON } from "./storage";
import { $, toast } from "./ui/dom";
import type { PlaytestReport } from "./types";

interface Settings {
  speed: number;
  sound: boolean;
}
const settings: Settings = { speed: 1, sound: true, ...readJSON<Partial<Settings>>("settings", {}) };
const saveSettings = () => writeJSON("settings", settings);

const scene = new StudioScene($("#scene") as HTMLCanvasElement);
scene.onAgentClick = (id) => showAgentCard(id);
const diary = new DiaryView($("#diary"));

// Step 2 placeholder maker: templates and the real playtest arrive in step 3.
const maker: GameMaker = {
  fallback: (info): GameBuild => ({ kind: "template", templateId: info.genre, params: {}, controls: GENRE_CONTROLS[info.genre] }),
  playtest: async (): Promise<PlaytestReport> => ({
    pass: true,
    checks: [{ name: "Boots", ok: true, detail: "placeholder" }],
    errors: [],
    frames: 600,
    msPerFrame: 0.4,
    survivedSeconds: 10,
    score: 0,
  }),
};
const builtin: Brain = new BuiltinBrain((info) => maker.fallback(info, undefined));

const director = new Director({
  scene,
  diary,
  brain: () => builtin,
  builtin,
  maker,
  onStage: (stage, done, retry) => renderStages(stage, done, retry),
  onShip: (game) => {
    if (!addGame(game)) toast("Couldn't save to the shelf: browser storage is full or blocked.");
  },
  onEnd: () => setBusy(false),
});
director.speed = settings.speed;

function refreshShelf(): void {
  const games = getShelf();
  renderShelf(games, (id) => console.info("open", id));
  scene.shelf = games.map((g) => g.palette.hero);
  scene.plant = 1 + getLore().gerald;
}

function setBusy(busy: boolean): void {
  ($("#pitch-btn") as HTMLButtonElement).disabled = busy;
  ($("#pitch-input") as HTMLInputElement).disabled = busy;
  $("#skip-btn").hidden = !busy;
}

function speedLabel(): string {
  return `${settings.speed}x`;
}

loadLore();
loadShelf();
onShelfChange(refreshShelf);
refreshShelf();
renderStages(null, new Set());
scene.start();

$("#speed-btn").textContent = speedLabel();
$("#speed-btn").addEventListener("click", () => {
  settings.speed = settings.speed === 1 ? 2 : settings.speed === 2 ? 4 : 1;
  director.speed = settings.speed;
  $("#speed-btn").textContent = speedLabel();
  saveSettings();
});
$("#skip-btn").addEventListener("click", () => director.fastForward());
$("#dice-btn").addEventListener("click", () => {
  const input = $("#pitch-input") as HTMLInputElement;
  const options = PITCH_IDEAS.filter((p) => p !== input.value);
  input.value = options[Math.floor(Math.random() * options.length)];
  input.focus();
});

$("#pitch-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#pitch-input") as HTMLInputElement;
  const pitch = input.value.trim();
  if (!pitch || director.running) return;
  setBusy(true);
  void director.run(director.newJob(pitch)).catch((err) => {
    console.error(err);
    toast("The night shift hit a snag. Try another pitch?");
  });
});

const pending = loadJob();
if (pending) {
  setBusy(true);
  void director.run(pending);
}
