import "./style.css";
import { StudioScene } from "./studio/scene";
import { renderStages } from "./ui/stagesView";
import { renderShelf } from "./ui/shelfView";
import { showAgentCard } from "./ui/agentCard";
import { loadShelf, onShelfChange, getShelf } from "./shelfStore";
import { $ } from "./ui/dom";

const scene = new StudioScene($("#scene") as HTMLCanvasElement);
scene.onAgentClick = (id) => showAgentCard(id);

function refreshShelf(): void {
  const games = getShelf();
  renderShelf(games, (id) => console.info("open", id));
  scene.shelf = games.map((g) => g.palette.hero);
}

loadShelf();
onShelfChange(refreshShelf);
refreshShelf();
renderStages(null, new Set());
scene.start();

$("#pitch-form").addEventListener("submit", (e) => {
  e.preventDefault();
  scene.everyoneTo("meeting");
});
