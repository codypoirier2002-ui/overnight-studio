import "./style.css";
import { StudioScene } from "./studio/scene";
import { Director, loadJob } from "./studio/director";
import { StudioSound } from "./studio/sound";
import { StudioLife } from "./studio/life";
import { BuiltinBrain } from "./brain/brain";
import { AiBrain, fetchStatus, type StudioStatus } from "./brain/aiBrain";
import { PITCH_IDEAS, parsePitch } from "./brain/pitch";
import { rngFrom } from "./brain/writer";
import { createMaker } from "./games/maker";
import { remix } from "./games/remix";
import { runPlaytest } from "./games/playtest";
import { pickPalette } from "./games/palettes";
import { buildGameHtml } from "./games/frame";
import { Player } from "./ui/player";
import { renderStages } from "./ui/stagesView";
import { renderShelf } from "./ui/shelfView";
import { showAgentCard } from "./ui/agentCard";
import { DiaryView } from "./ui/diaryView";
import { loadShelf, onShelfChange, getShelf, addGame, getGame, removeGame } from "./shelfStore";
import { loadLore, getLore } from "./lore";
import { readJSON, writeJSON } from "./storage";
import { $, toast } from "./ui/dom";
import { showTitle, titleAlreadySeen } from "./ui/titleScreen";
import { decodeGame, encodeGame, readShareToken, shareUrl } from "./share";
import { exportBackup, importBackup } from "./backup";
import type { ShippedGame } from "./types";

interface Settings {
  speed: number;
  sound: boolean;
}
const settings: Settings = { speed: 1, sound: true, ...readJSON<Partial<Settings>>("settings", {}) };
const saveSettings = () => writeJSON("settings", settings);

const sound = new StudioSound();
sound.setEnabled(settings.sound);
const scene = new StudioScene($("#scene") as HTMLCanvasElement);
const diary = new DiaryView($("#diary"));
const maker = createMaker();
const builtin = new BuiltinBrain(remix);
let status: StudioStatus | null = null;
const aiBrain = new AiBrain(builtin, (usage) => {
  if (status) {
    status.usage = usage;
    renderBadge();
  }
});

scene.onAgentClick = (id) => {
  showAgentCard(id);
  scene.say(id, "heart", 1600);
  sound.play("blip-" + id);
};

function renderBadge(): void {
  const b = $("#mode-badge");
  if (status?.ai) {
    const left = Math.max(0, status.usage.cap - status.usage.calls);
    b.textContent = left > 0 ? `AI team · ${left} calls left today` : "AI budget spent · template mode";
    b.className = left > 0 ? "badge is-ai" : "badge is-builtin";
    b.title = `Coder: ${status.models.coder}. Chatter: ${status.models.chatter}. Daily cap ${status.usage.cap} calls (${status.usage.coderCap} coding calls).`;
  } else {
    b.textContent = "Template mode";
    b.className = "badge is-builtin";
    b.title = "No AI server connected: the crew writes and remixes from the built-in template cabinet.";
  }
}

const director = new Director({
  scene,
  diary,
  brain: () => (status?.ai ? aiBrain : builtin),
  builtin,
  maker,
  onStage: (stage, done, retry) => renderStages(stage, done, retry),
  onShip: (game) => {
    if (!addGame(game)) toast("Couldn't save to the shelf: browser storage is full or blocked.");
  },
  onEnd: () => setBusy(false),
  sfx: (name) => sound.play(name),
});
director.speed = settings.speed;

const life = new StudioLife(scene, () => director.running, sound);

const player = new Player({
  onDelete: (g) => {
    removeGame(g.id);
    toast(`"${g.title}" was taken off the shelf.`);
  },
  onShare: (g) => void shareGame(g),
  onSaveShared: (g) => {
    addGame({ ...g, shared: true });
    toast("Added to your shelf.");
  },
  sound: () => settings.sound,
  onOpenChange: (open) => {
    scene.setPaused(open);
    if (!open && readShareToken()) history.replaceState(null, "", location.pathname + location.search);
  },
});

function refreshShelf(): void {
  const games = getShelf();
  renderShelf(games, (id) => {
    const g = getGame(id);
    if (g) {
      sound.play("click");
      player.open(g);
    }
  });
  scene.shelf = games.map((g) => g.palette.hero).reverse();
  scene.plant = 1 + getLore().gerald;
}

function setBusy(busy: boolean): void {
  ($("#pitch-btn") as HTMLButtonElement).disabled = busy;
  ($("#pitch-input") as HTMLInputElement).disabled = busy;
  $("#skip-btn").hidden = !busy;
  if (!busy) {
    scene.weather = "clear";
    refreshShelf();
  }
}

function renderSoundBtn(): void {
  const b = $("#sound-btn");
  b.textContent = settings.sound ? "Sound on" : "Sound off";
  b.setAttribute("aria-pressed", String(settings.sound));
}

loadLore();
loadShelf();
onShelfChange(refreshShelf);
refreshShelf();
renderStages(null, new Set());
renderSoundBtn();
scene.start();
life.start();

$("#speed-btn").textContent = `${settings.speed}x`;
$("#speed-btn").addEventListener("click", () => {
  settings.speed = settings.speed === 1 ? 2 : settings.speed === 2 ? 4 : 1;
  director.speed = settings.speed;
  $("#speed-btn").textContent = `${settings.speed}x`;
  saveSettings();
});
$("#sound-btn").addEventListener("click", () => {
  settings.sound = !settings.sound;
  sound.setEnabled(settings.sound);
  player.setMuted(!settings.sound);
  renderSoundBtn();
  saveSettings();
  if (settings.sound) sound.play("pop");
});
$("#skip-btn").addEventListener("click", () => director.fastForward());
$("#dice-btn").addEventListener("click", () => {
  const input = $("#pitch-input") as HTMLInputElement;
  const options = PITCH_IDEAS.filter((p) => p !== input.value);
  input.value = options[Math.floor(Math.random() * options.length)];
  input.focus();
  sound.play("click");
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

async function shareGame(g: ShippedGame): Promise<void> {
  const url = shareUrl(await encodeGame(g));
  if (url.length > 60000) {
    toast("This game is too big to fit in a link. Use Back up instead.");
    return;
  }
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  try {
    if (coarse && navigator.share) {
      await navigator.share({ title: g.title, text: `${g.title}: ${g.tagline}`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast(local ? "Link copied. It points at this computer: share from the GitHub Pages site so others can open it." : "Share link copied. The whole game is inside the link.", 4200);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    window.prompt("Copy this link to share the game:", url);
  }
}

async function openShared(): Promise<boolean> {
  const token = readShareToken();
  if (!token) return false;
  const game = await decodeGame(token);
  if (!game) {
    toast("That share link looks broken or incomplete.");
    history.replaceState(null, "", location.pathname + location.search);
    return false;
  }
  const mine = getGame(game.id);
  player.open(mine ?? game, { shared: !mine });
  toast(mine ? "That one's already on your shelf." : "Someone shared a game from their night shift with you!", 3800);
  return true;
}

$("#backup-btn").addEventListener("click", () => {
  if (!getShelf().length) {
    toast("Nothing on the shelf to back up yet.");
    return;
  }
  exportBackup();
});
$("#restore-input").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const { added, skipped } = await importBackup(file);
    loadLore();
    refreshShelf();
    toast(`Restored ${added} game${added === 1 ? "" : "s"}${skipped ? ` (${skipped} already here or unreadable)` : ""}.`);
  } catch (err) {
    toast((err as Error).message || "Couldn't read that backup.");
  }
});
window.addEventListener("hashchange", () => void openShared());

const pending = loadJob();
const statusReady = fetchStatus().then((s) => {
  status = s;
  renderBadge();
});

function resumeIfPending(): void {
  if (!pending || director.running) return;
  void statusReady.then(() => {
    setBusy(true);
    toast("The crew picks up where they left off.");
    void director.run(pending);
  });
}

void (async () => {
  if (await openShared()) return;
  if (titleAlreadySeen()) {
    resumeIfPending();
    return;
  }
  const n = getShelf().length;
  const meta = pending
    ? `The crew is mid-shift on "${pending.pitch}". They'll pick up where they left off.`
    : n
      ? `${n} game${n === 1 ? "" : "s"} on the shelf. The kettle's on.`
      : "The shelf is empty. The kettle's on.";
  showTitle({ meta, onEnter: () => {
    sound.play("pop");
    resumeIfPending();
  } });
})();

// Small hook for the automated browser tests (tests/e2e).
(window as unknown as Record<string, unknown>).__OGS_TEST__ = { runPlaytest, parsePitch, remix, pickPalette, rngFrom, buildGameHtml, scene, life };
