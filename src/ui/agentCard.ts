import { AGENTS, type AgentId } from "../agents";
import { $, h } from "./dom";

export function showAgentCard(id: AgentId): void {
  const a = AGENTS[id];
  const card = $("#agent-card");
  const close = h("button", { class: "close-card", type: "button", "aria-label": "Close" }, "x");
  close.addEventListener("click", () => (card.hidden = true));
  const swatch = h("i", { class: "mug-swatch" });
  swatch.style.background = `linear-gradient(${a.mug.body} 0 40%, ${a.mug.stripe} 40% 60%, ${a.mug.body} 60%)`;
  card.replaceChildren(
    close,
    h("h3", {}, h("span", {}, a.name), h("span", { class: "role" }, a.role)),
    h("p", {}, a.personality),
    h("p", {}, h("em", {}, `"${a.catchphrases[0]}"`)),
    h("div", { class: "mug-line" }, swatch, h("span", {}, h("strong", {}, a.mug.name + ": "), a.mug.description)),
  );
  card.style.borderColor = a.color;
  card.hidden = false;
}

export function hideAgentCard(): void {
  $("#agent-card").hidden = true;
}
