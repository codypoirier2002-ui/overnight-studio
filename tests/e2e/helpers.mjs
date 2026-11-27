// Tiny e2e helpers: start a server, open pages, collect console errors.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// Playwright is a test-only tool: use a project install if present, else a global one.
let pw;
try {
  pw = await import("playwright");
} catch {
  pw = createRequire(import.meta.url)("playwright");
}
const { chromium, devices } = pw.default || pw;

export const SHOTS = process.env.SHOTS_DIR || "test-results";

export async function startServer(cmd, args, url, env = {}) {
  const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
  let out = "";
  proc.stdout.on("data", (d) => (out += d));
  proc.stderr.on("data", (d) => (out += d));
  const start = Date.now();
  while (Date.now() - start < 20000) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return { proc, log: () => out };
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error("Server did not start: " + out);
}

export async function openPage(browser, url, opts = {}) {
  const context = await browser.newContext(opts.device ? { ...devices[opts.device] } : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  if (!opts.title) await context.addInitScript(() => { try { sessionStorage.setItem("ogs.entered", "1"); } catch {} });
  if (opts.init) await context.addInitScript(opts.init);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  await page.goto(url, { waitUntil: "load" });
  return { page, context, errors };
}

export function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT: " + msg);
  console.log("  ok -", msg);
}

export async function withBrowser(fn) {
  const browser = await chromium.launch();
  try {
    await fn(browser);
  } finally {
    await browser.close();
  }
}
