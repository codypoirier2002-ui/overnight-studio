import type { GameMaker } from "../studio/director";
import { remix } from "./remix";
import { runPlaytest } from "./playtest";
import { hashString } from "../brain/pitch";

export function createMaker(): GameMaker {
  return {
    fallback: (info, palette) => remix(info, palette, 0.8),
    playtest: (build, palette, title) =>
      runPlaytest(
        { kind: build.kind, templateId: build.templateId, params: build.params, code: build.code },
        { title, pal: palette, seed: hashString(title) },
      ),
  };
}
