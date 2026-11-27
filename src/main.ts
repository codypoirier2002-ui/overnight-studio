import "./style.css";
import { StudioScene } from "./studio/scene";
import { Director, loadJob } from "./studio/director";
import type { GameMaker } from "./studio/director";
import { BuiltinBrain, type Brain } from "./brain/brain";
import { PITCH_IDEAS } from "./brain/pitch";
import { createMaker } from "./games/maker";
import { remix } from "./games/remix";
import { Player } from "./ui/player";
import { renderStages } from "./ui/stagesView";
import { renderShelf } from "./ui/shelfView";
import { showAgentCard } from "./ui/agentCard";
import { DiaryView } from "./ui/diaryView";
import { loadShelf, onShelfChange, getShelf, addGame, getGame, removeGame } from "./shelfStore";
import { loadLore, getLore } from "./lore";
import { readJSON, writeJSON } from "./storage";
import { $, toast } from "./ui/dom";

interface Settings {
  speed: number;
  sound: boolean;
}
const settings: Settings = { speed: 1, sound: true, ...readJSON<Partial<Settings>>("settings", {}) };
const saveSettings = () => writeJSON("settings", settings);

const scene = new StudioScene($("#scene") as HTMLCanvasElement);
scene.onAgentClick = (id) => showAgentCard(id);
const diary = new DiaryView($("#diary"));

const maker: GameMaker = createMaker();
const builtin: Brain = new BuiltinBrain(remix);

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

const player = new Player({
  onDelete: (g) => {
    removeGame(g.id);
    toast(`"${g.title}" was taken off the shelf.`);
  },
  onShare: () => toast("Share links arrive in step 6."),
  onSaveShared: (g) => {
    addGame({ ...g, shared: true });
    toast("Added to your shelf.");
  },
  sound: () => settings.sound,
  onOpenChange: (open) => scene.setPaused(open),
});

function refreshShelf(): void {
  const games = getShelf();
  renderShelf(games, (id) => {
    const g = getGame(id);
    if (g) player.open(g);
  });
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

// Small hook for the automated browser tests (tests/e2e).
import { runPlaytest } from "./games/playtest";
import { parsePitch } from "./brain/pitch";
import { pickPalette } from "./games/palettes";
import { rngFrom } from "./brain/writer";
import { buildGameHtml } from "./games/frame";
(window as unknown as Record<string, unknown>).__OGS_TEST__ = { runPlaytest, parsePitch, remix, pickPalette, rngFrom, buildGameHtml };
