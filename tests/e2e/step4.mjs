import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openPage, assert, startServer, SHOTS } from "./helpers.mjs";
import { startMock } from "./mock-anthropic.mjs";

const KEY = "test-key-not-real";
const MOCK_PORT = 4401;
const PORT = 4402;
const base = `http://127.0.0.1:${PORT}/`;

async function withStudio(env, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ogs-"));
  const server = await startServer("node", ["server/server.mjs", "--port", String(PORT)], base + "api/status", {
    OGS_ENV_FILE: "/nonexistent",
    ANTHROPIC_API_KEY: KEY,
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
    OGS_USAGE_FILE: path.join(dir, "usage.json"),
    ...env,
  });
  try {
    await fn(server);
  } finally {
    server.proc.kill();
  }
}

async function night(browser, pitch, shotName) {
  const { page, context, errors } = await openPage(browser, base);
  const bodies = [];
  page.on("response", async (r) => {
    try {
      bodies.push(await r.text());
    } catch {}
  });
  await page.waitForFunction(() => document.querySelector("#mode-badge").textContent.includes("AI team"));
  await page.fill("#pitch-input", pitch);
  await page.click("#pitch-btn");
  await page.waitForTimeout(400);
  await page.click("#skip-btn");
  await page.waitForFunction(() => document.querySelector("#skip-btn").hidden, null, { timeout: 90000 });
  const texts = await page.locator(".entry").allTextContents();
  const reports = (await page.locator(".entry .card h4").allTextContents()).filter((r) => r === "PASS" || r === "FAIL");
  if (shotName) await page.screenshot({ path: `${SHOTS}/${shotName}.png` });
  return { page, context, errors, texts, reports, bodies };
}

export default async function step4(browser) {
  console.log("step 4: the AI team (against a mock Messages API)");
  const log = path.join(os.tmpdir(), `ogs-mock-${Date.now()}.jsonl`);
  const mock = await startMock(MOCK_PORT, log);
  try {
    // A. first build is broken, the playtest catches it, Bram fixes it, it ships as an AI build
    process.env.MOCK_MODE = "fix-once";
    await withStudio({}, async (server) => {
      const { page, context, errors, texts, reports, bodies } = await night(browser, "a pigeon delivering pizza in a storm", "step4-ai-night");
      assert(texts.some((t) => t.includes("Mock kickoff")), "diary uses the AI-written lines");
      assert(texts.some((t) => t.includes("lines of hand-written JavaScript")), "the Coder's build is noted in the diary");
      assert(reports[0] === "FAIL" && reports.includes("PASS"), `first playtest fails, the fix passes (${reports.join(" -> ")})`);
      assert(texts.some((t) => t.includes("Fix #1")), "Bram's fix #1 is in the diary");
      assert((await page.locator(".cart .tag").first().textContent()) === "AI build", "shipped game is tagged AI build");
      assert((await page.locator(".cart-title").first().textContent()) === "Mock Drizzle DX", "final title comes from the ship stage");
      const sw = await page.locator(".entry .swatches .swatch").allTextContents();
      assert(sw.includes("Peach"), "the art pass palette names are shown");
      await page.click(".cart");
      await page.waitForSelector("#frame-host iframe");
      await page.waitForTimeout(500);
      const frame = page.frames().find((f) => f !== page.mainFrame());
      const hasCode = await frame.evaluate(() => document.body.innerHTML.includes("__ogsLoop")).catch(() => false);
      assert(hasCode, "AI code runs with loop guards in the sandbox");
      await page.screenshot({ path: `${SHOTS}/step4-ai-game.png` });
      assert(!bodies.some((b) => b.includes(KEY)), "the API key never appears in anything sent to the browser");
      assert(!server.log().includes(KEY), "the API key is never printed by the server");
      assert(errors.length === 0, "no console errors: " + errors.join(" | "));
      await context.close();

      const entries = fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      const coder = entries.filter((e) => e.model === "claude-opus-5-5");
      const chatter = entries.filter((e) => e.model === "claude-haiku-5-5");
      assert(coder.length === 2, `two Coder calls on the strong model (build + fix): ${coder.length}`);
      assert(coder.every((e) => e.stream && e.effort === "high" && e.fallbacks === "default" && String(e.beta).includes("server-side-fallback-2026-07-01")), "Coder calls stream with effort high and refusal fallbacks");
      assert(chatter.length >= 6 && chatter.every((e) => e.effort === "low" && e.fallbacks === null), `chatter uses the cheap fast model at low effort (${chatter.length} calls)`);
      assert(entries.every((e) => e.hasKey), "the server authenticates every call with the key");

      // security of the endpoint
      const r1 = await fetch(base + "api/studio", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ task: "kickoff", pitch: "x" }) });
      assert(r1.status === 403, "cross-site style POST without the studio header is refused");
      const r2 = await fetch(base + "api/studio", { method: "POST", headers: { "content-type": "application/json", "x-ogs": "1", origin: "https://evil.example" }, body: "{}" });
      assert(r2.status === 403, "POST from another origin is refused");
      const r3 = await fetch(base + "api/studio", { method: "POST", headers: { "content-type": "application/json", "x-ogs": "1" }, body: JSON.stringify({ task: "do_anything", pitch: "x" }) });
      assert(r3.status === 400, "unknown tasks are refused (no general proxy)");
      for (const p of [".env", "../.env", "%2e%2e/.env", "server/api.mjs", "..%2fpackage.json"]) {
        const r = await fetch(base + p);
        const t = await r.text();
        assert(r.status >= 400 && !t.includes("ANTHROPIC"), `/${p} is not served (${r.status})`);
      }
      const st = await (await fetch(base + "api/status")).json();
      assert(st.ai === true && !JSON.stringify(st).includes(KEY), "status reports AI on without exposing the key");
    });

    // B. the build never passes: three fixes, then the safe template ships
    process.env.MOCK_MODE = "always-broken";
    await withStudio({}, async () => {
      const { context, texts, reports, page } = await night(browser, "a robot barista catching falling coffee cups");
      assert(reports.filter((r) => r === "FAIL").length === 4, `initial test + 3 fixes all fail (${reports.join(" -> ")})`);
      assert(texts.some((t) => /template cabinet|safe build|trusty template/.test(t)), "the crew falls back to the template cabinet");
      assert(reports[reports.length - 1] === "PASS", "the safe build passes and ships");
      assert((await page.locator(".cart .tag").first().textContent()) === "remix", "fallback game is tagged as a remix");
      await context.close();
    });

    // C. a refused code request falls back gracefully
    process.env.MOCK_MODE = "refuse-code";
    await withStudio({}, async () => {
      const { context, texts, reports } = await night(browser, "a frog escaping a lawnmower");
      assert(texts.some((t) => t.includes("passed on that one")), "refusal is explained in the diary");
      assert(reports.includes("PASS"), "the template build ships");
      await context.close();
    });

    // D. the daily cap
    process.env.MOCK_MODE = "fix-once";
    await withStudio({ OGS_DAILY_CALL_CAP: "3" }, async () => {
      const { context, texts, page } = await night(browser, "a bee delivering honey");
      assert(texts.some((t) => t.includes("call budget spent")), "hitting the daily cap is explained and the night continues");
      assert((await page.locator(".cart").count()) === 1, "a game still ships");
      const badge = await page.locator("#mode-badge").textContent();
      assert(/budget spent/.test(badge), `badge shows the budget is spent (${badge})`);
      await context.close();
    });
  } finally {
    mock.close();
  }
}
