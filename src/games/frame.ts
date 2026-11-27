// Builds the self-contained HTML document a game runs in, and the sandboxed
// iframe that hosts it. The frame gets `sandbox="allow-scripts"` only (no
// same-origin, so no access to the studio's storage, cookies or DOM) plus a
// CSP that blocks every network request.

import { PIXELKIT_SOURCE } from "./kit";
import runtimeSource from "./runtime.js?raw";
import harnessSource from "./harness.js?raw";
import type { Palette } from "../types";
import { TEMPLATE_SOURCES } from "./templates";
import { guardLoops } from "./loopguard";

export interface FrameConfig {
  title: string;
  pal: Palette;
  seed: number;
  best?: number;
  params?: Record<string, unknown>;
  sound?: boolean;
  test?: boolean;
  forcePad?: boolean;
}

export interface Playable {
  kind: "template" | "code";
  templateId?: string;
  params?: Record<string, unknown>;
  code?: string;
}

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src 'none'; connect-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";

const FRAME_CSS = `
html,body{margin:0;height:100%;background:#000;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif}
#ogs-stage{flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center}
#ogs-canvas{image-rendering:pixelated;image-rendering:crisp-edges;max-width:100%;max-height:100%;aspect-ratio:4/3;width:100%;height:auto;display:block;background:#000}
@supports not (aspect-ratio:4/3){#ogs-canvas{height:75vw}}
#ogs-pad{display:none;width:100%;box-sizing:border-box;padding:8px 12px calc(8px + env(safe-area-inset-bottom));justify-content:space-between;align-items:center;gap:12px;background:#120e1c}
body.has-pad #ogs-pad{display:flex}
.pad-dirs{display:flex;gap:10px}
.pad-dirs.four{display:grid;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(2,48px);gap:6px}
.pad-dirs.four .pad-up{grid-column:2;grid-row:1}.pad-dirs.four .pad-left{grid-column:1;grid-row:2}
.pad-dirs.four .pad-down{grid-column:2;grid-row:2}.pad-dirs.four .pad-right{grid-column:3;grid-row:2}
.pad-btn{min-width:56px;min-height:48px;border:2px solid #463758;border-radius:8px;background:#30253f;color:#f4efe6;font:700 18px system-ui,sans-serif;touch-action:none}
.pad-btn.down{background:#ffd56b;color:#2b2033}
.pad-a{min-width:72px;min-height:72px;border-radius:50%;background:#e2574c;border-color:#8a2a3a}
.pad-a.wide{min-width:120px;border-radius:12px}
`;

function scriptSafe(js: string): string {
  // Nothing inside a script may close the tag early or open an HTML comment.
  return js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

function jsonSafe(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function gameSource(p: Playable): string {
  if (p.kind === "code") return guardLoops(p.code ?? "");
  const src = TEMPLATE_SOURCES[p.templateId ?? ""];
  if (!src) return `throw new Error(${JSON.stringify("Unknown template " + p.templateId)});`;
  return src;
}

export function buildGameHtml(p: Playable, cfg: FrameConfig): string {
  const head = [
    `<!doctype html><html><head><meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">`,
    `<style>${FRAME_CSS}</style></head><body>`,
    `<div id="ogs-stage"><canvas id="ogs-canvas" width="320" height="240"></canvas></div><div id="ogs-pad"></div>`,
    `<script>${scriptSafe(PIXELKIT_SOURCE)}</script>`,
  ];
  const runtime = `<script>${scriptSafe(runtimeSource)}</script>`;
  // Line on which the game's own code starts, so errors can point at it.
  const lines = (str: string) => str.split("\n").length;
  const configLine = head.reduce((n, part) => n + lines(part), 0) + 1;
  const codeLine = configLine + 1 + lines(runtime);
  const config = { ...cfg, codeLine, params: { ...(p.params ?? {}), ...(cfg.params ?? {}) } };
  const parts = [
    ...head,
    `<script>window.CFG=${jsonSafe(config)};</script>`,
    runtime,
    `<script>${scriptSafe(gameSource(p))}\n</script>`,
    cfg.test ? `<script>${scriptSafe(harnessSource)}</script>` : "",
    `<script>OGS.__boot();${cfg.test ? "OGS_HARNESS.run();" : ""}</script>`,
    `</body></html>`,
  ];
  return parts.join("\n");
}

export function createGameFrame(html: string, title: string): HTMLIFrameElement {
  const f = document.createElement("iframe");
  f.setAttribute("sandbox", "allow-scripts");
  f.setAttribute("title", title);
  f.setAttribute("referrerpolicy", "no-referrer");
  f.setAttribute("allow", "camera 'none'; microphone 'none'; geolocation 'none'");
  f.srcdoc = html;
  return f;
}
