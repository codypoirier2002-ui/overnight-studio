import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openPage, assert, SHOTS } from "./helpers.mjs";

function pagesServer(port) {
  // Mimics GitHub Pages: the build served under /overnight-studio/, no /api.
  const dist = path.resolve("dist");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json" };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (!u.pathname.startsWith("/overnight-studio/")) return res.writeHead(404).end("404");
    let rel = u.pathname.slice("/overnight-studio".length);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(dist, rel);
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end("404");
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}

async function shipNight(page, pitch) {
  await page.fill("#pitch-input", pitch);
  await page.click("#pitch-btn");
  await page.waitForTimeout(300);
  await page.click("#skip-btn");
  await page.waitForFunction(() => document.querySelector("#skip-btn").hidden, null, { timeout: 60000 });
}

export default async function step6(browser, base) {
  console.log("step 6: title screen, save, share, Pages");

  // 1. title screen
  {
    const { page, context, errors } = await openPage(browser, base, { title: true });
    await page.waitForSelector("#title-screen:not([hidden])");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/step6-title.png` });
    assert((await page.locator("#title-meta").textContent()).includes("kettle"), "title screen greets you");
    await page.keyboard.press("Enter");
    assert(await page.locator("#title-screen").isHidden(), "Enter goes into the studio");
    await page.reload();
    await page.waitForTimeout(300);
    assert(await page.locator("#title-screen").isHidden(), "the title isn't shown again in the same session");
    assert(errors.length === 0, "no console errors: " + errors.join(" | "));
    await context.close();
  }

  // 2. save + resume an interrupted night
  {
    const { page, context, errors } = await openPage(browser, base);
    await page.evaluate(() => {});
    await page.click("#speed-btn"); await page.click("#speed-btn"); // 4x
    await page.fill("#pitch-input", "a snail racing a deadline across the city");
    await page.click("#pitch-btn");
    await page.waitForFunction(() => [...document.querySelectorAll(".entry.is-system")].some((e) => e.textContent.startsWith("Build")), null, { timeout: 60000 });
    const before = await page.locator(".entry").count();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ogs.v1.job")));
    assert(saved && saved.done.includes("design"), `the night is saved as it goes (done: ${saved?.done.join(", ")})`);
    await page.reload();
    await page.waitForSelector("#skip-btn:not([hidden])", { timeout: 10000 });
    const after = await page.locator(".entry").count();
    assert(after >= before - 2, `the diary comes back after a reload (${before} -> ${after})`);
    await page.click("#skip-btn");
    await page.waitForFunction(() => document.querySelector("#skip-btn").hidden, null, { timeout: 60000 });
    assert((await page.locator(".cart").count()) === 1, "the resumed night ships its game");
    assert((await page.evaluate(() => localStorage.getItem("ogs.v1.job"))) === null, "the saved night is cleared once shipped");
    const designDone = await page.locator(".entry.is-system").allTextContents();
    assert(designDone.filter((t) => t.startsWith("Kickoff")).length === 1, "stages already done aren't repeated");
    assert(errors.length === 0, "no console errors: " + errors.join(" | "));
    await context.close();
  }

  // 3. share links + backup on a simulated GitHub Pages deploy (no server, template mode)
  const pages = await pagesServer(4420);
  const pagesBase = "http://127.0.0.1:4420/overnight-studio/";
  try {
    const { page, context, errors } = await openPage(browser, pagesBase);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4420" });
    await page.waitForFunction(() => document.querySelector("#mode-badge").textContent === "Template mode");
    assert(true, "on Pages the studio runs in template mode");
    await shipNight(page, "a giant bee catching honey in a snowstorm");
    await page.click(".cart");
    await page.waitForSelector("#frame-host iframe");
    await page.click("#share-btn");
    await page.waitForTimeout(300);
    const link = await page.evaluate(() => navigator.clipboard.readText());
    assert(link.startsWith(pagesBase + "#play="), `share link copied (${link.length} chars)`);
    await page.click("#player-close");
    const dl = page.waitForEvent("download");
    await page.click("#backup-btn");
    const file = path.join(os.tmpdir(), `ogs-backup-${Date.now()}.json`);
    await (await dl).saveAs(file);
    const backup = JSON.parse(fs.readFileSync(file, "utf8"));
    assert(backup.app === "overnight-game-studio" && backup.shelf.length === 1, "backup file contains the shelf");
    assert(errors.length === 0, "no console errors: " + errors.join(" | "));
    await context.close();

    // a friend opens the link on their phone
    const friend = await openPage(browser, link, { device: "iPhone SE", title: true });
    await friend.page.waitForSelector("#frame-host iframe", { timeout: 10000 });
    assert(await friend.page.locator("#player").isVisible(), "the shared game opens straight away");
    assert(await friend.page.locator("#save-shared-btn").isVisible(), "friend can add it to their shelf");
    const frame = friend.page.frames().find((f) => f !== friend.page.mainFrame());
    await frame.waitForSelector("#ogs-pad .pad-btn");
    assert((await frame.locator("#ogs-pad .pad-btn").count()) >= 2, "touch controls appear on a phone");
    await friend.page.waitForTimeout(400);
    await frame.locator("canvas").tap();
    await frame.locator(".pad-left").dispatchEvent("pointerdown");
    await friend.page.waitForTimeout(500);
    await frame.locator(".pad-left").dispatchEvent("pointerup");
    await friend.page.screenshot({ path: `${SHOTS}/step6-phone-shared.png` });
    await friend.page.click("#save-shared-btn");
    await friend.page.click("#player-close");
    await friend.page.waitForTimeout(200);
    assert((await friend.page.locator(".cart .tag").first().textContent()) === "shared", "the shared game sits on the friend's shelf");
    assert(!(await friend.page.evaluate(() => location.hash)), "the link fragment is tidied away after closing");
    const overflow = await friend.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, "no sideways scrolling on the phone");
    assert(friend.errors.length === 0, "no console errors on the phone: " + friend.errors.join(" | "));
    await friend.context.close();

    // restore the backup in a fresh browser
    const fresh = await openPage(browser, pagesBase);
    await fresh.page.setInputFiles("#restore-input", file);
    await fresh.page.waitForSelector(".cart");
    assert((await fresh.page.locator(".cart").count()) === 1, "restoring a backup brings the games back");
    const lore = await fresh.page.evaluate(() => JSON.parse(localStorage.getItem("ogs.v1.lore")));
    assert(lore.gamesShipped >= 1, "studio lore is restored too");
    await fresh.page.click(".cart");
    await fresh.page.click('.tab[data-tab="diary"]');
    assert((await fresh.page.locator("#player-diary .entry").count()) > 20, "the restored game keeps its dev diary");
    await fresh.context.close();

    // a broken link is handled gently
    const broken = await openPage(browser, pagesBase + "#play=z.garbage");
    await broken.page.waitForTimeout(500);
    assert(!(await broken.page.locator("#player").isVisible()), "a broken share link doesn't open anything");
    assert(broken.errors.length === 0, "and causes no errors");
    await broken.context.close();
  } finally {
    pages.close();
  }
}
