import type { ShippedGame } from "../types";
import { drawCover } from "./cover";
import { $, h } from "./dom";

export function renderShelf(games: ShippedGame[], onOpen: (id: string) => void): void {
  const host = $("#shelf");
  host.replaceChildren();
  $("#shelf-count").textContent = games.length ? `${games.length} game${games.length === 1 ? "" : "s"}` : "";
  if (!games.length) {
    host.append(
      h("p", { class: "shelf-empty" }, "The shelf is empty. Pitch a game tonight and it'll be here by morning."),
    );
    return;
  }
  for (const g of games) {
    const canvas = h("canvas", { width: 160, height: 120, "aria-hidden": "true" });
    drawCover(canvas, g);
    const date = new Date(g.createdAt);
    const btn = h(
      "button",
      { class: "cart", type: "button", "data-id": g.id, "aria-label": `Play ${g.title}` },
      canvas,
      h("span", { class: "cart-title" }, g.title),
      h(
        "span",
        { class: "cart-sub" },
        h("span", {}, date.toLocaleDateString(undefined, { month: "short", day: "numeric" })),
        h("span", { class: "tag" }, g.shared ? "shared" : g.source === "ai" ? "AI build" : "remix"),
      ),
    );
    btn.addEventListener("click", () => onOpen(g.id));
    host.append(btn);
  }
}
