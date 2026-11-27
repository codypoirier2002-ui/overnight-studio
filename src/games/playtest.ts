// Runs Moss's automated playtest in a hidden, sandboxed frame.
import type { PlaytestReport } from "../types";
import { buildGameHtml, createGameFrame, type FrameConfig, type Playable } from "./frame";

let queue: Promise<unknown> = Promise.resolve();

export function runPlaytest(p: Playable, cfg: FrameConfig, timeoutMs = 20000): Promise<PlaytestReport> {
  // one playtest at a time keeps old phones happy
  const run = queue.then(() => playtestOnce(p, cfg, timeoutMs));
  queue = run.catch(() => undefined);
  return run;
}

function failReport(detail: string, errors: string[] = []): PlaytestReport {
  return {
    pass: false,
    checks: [{ name: "Boots", ok: false, detail }],
    errors,
    frames: 0,
    msPerFrame: 0,
    survivedSeconds: 0,
    score: 0,
  };
}

function playtestOnce(p: Playable, cfg: FrameConfig, timeoutMs: number): Promise<PlaytestReport> {
  return new Promise((resolve) => {
    const html = buildGameHtml(p, { ...cfg, test: true, sound: false });
    const frame = createGameFrame(html, "Playtest");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "320px", height: "240px", border: "0", pointerEvents: "none" });
    const errors: string[] = [];
    let done = false;
    const finish = (r: PlaytestReport) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      window.clearTimeout(timer);
      frame.remove();
      resolve(r);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "ogs:error" && typeof e.data.message === "string") errors.push(e.data.message);
      if (e.data.type === "ogs:report" && e.data.report) finish(sanitizeReport(e.data.report, errors));
    };
    const timer = window.setTimeout(
      () => finish(failReport("The playtest timed out: the game froze or never finished loading.", errors)),
      timeoutMs,
    );
    window.addEventListener("message", onMsg);
    document.body.append(frame);
  });
}

/** Reports come from inside the sandbox: trust nothing, rebuild with known fields. */
export function sanitizeReport(raw: unknown, extraErrors: string[] = []): PlaytestReport {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, n = 200) => String(v ?? "").slice(0, n);
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  const checks = Array.isArray(r.checks)
    ? r.checks.slice(0, 12).map((c: Record<string, unknown>) => ({ name: str(c?.name, 40), ok: c?.ok === true, detail: str(c?.detail) }))
    : [];
  const errors = [...new Set([...(Array.isArray(r.errors) ? r.errors.map((e) => str(e, 300)) : []), ...extraErrors])].slice(0, 10);
  return {
    pass: r.pass === true && checks.length > 0 && checks.every((c) => c.ok),
    checks,
    errors,
    frames: num(r.frames),
    msPerFrame: num(r.msPerFrame),
    survivedSeconds: num(r.survivedSeconds),
    score: num(r.score),
  };
}
