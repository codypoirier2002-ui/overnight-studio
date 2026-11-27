import { STAGES, type StageId } from "../types";
import { $, h } from "./dom";

export function renderStages(active: StageId | null, done: Set<StageId>, retry = false): void {
  const host = $("#stages");
  host.replaceChildren(
    ...STAGES.map((s, i) => {
      const cls = ["stage"];
      if (s.id === active) cls.push(retry && s.id === "fixes" ? "is-active is-retry" : "is-active");
      else if (done.has(s.id)) cls.push("is-done");
      return h(
        "li",
        { class: cls.join(" "), "data-stage": s.id, "aria-current": s.id === active ? "step" : undefined },
        h("span", { class: "n" }, String(i + 1)),
        h("span", { class: "full" }, s.label),
        h("span", { class: "short" }, s.short),
      );
    }),
  );
}
