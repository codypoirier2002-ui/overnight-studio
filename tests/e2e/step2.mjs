import { openPage, assert, SHOTS } from "./helpers.mjs";

export default async function step2(browser, base) {
  console.log("step 2: agents and the dev diary");
  const { page, context, errors } = await openPage(browser, base);
  await page.fill("#pitch-input", "a pigeon delivering pizza in a storm");
  await page.click("#pitch-btn");
  // watch it play at normal speed for a bit
  await page.waitForSelector(".entry:not(.is-system)", { timeout: 8000 });
  await page.waitForTimeout(4000);
  const early = await page.locator(".entry").count();
  assert(early >= 3, `diary fills in at a readable pace (${early} entries after ~4s)`);
  assert(await page.locator(".stage.is-active").first().isVisible(), "a stage is highlighted");
  assert(await page.locator("#skip-btn").isVisible(), "fast-forward is offered while working");
  // agents walked to the meeting table (scene pixels changed vs desks) - check via bubbles text not possible; check pitch disabled
  assert(await page.locator("#pitch-input").isDisabled(), "pitch box is locked during the night");
  await page.screenshot({ path: `${SHOTS}/step2-kickoff.png` });
  await page.click("#skip-btn");
  await page.waitForFunction(() => document.querySelector("#skip-btn").hidden, null, { timeout: 30000 });
  const texts = await page.locator(".entry").allTextContents();
  const who = await page.locator(".entry[data-who]").evaluateAll((els) => [...new Set(els.map((e) => e.dataset.who))]);
  assert(who.length === 4, "all four agents spoke: " + who.join(","));
  for (const s of ["Kickoff", "Design doc", "Build", "Art pass", "Playtest", "Fixes", "Ship"]) {
    assert(texts.some((t) => t.startsWith(s + " ·")), `diary marks the ${s} stage`);
  }
  assert(texts.some((t) => /Shipped:/.test(t)), "diary ends with a ship line");
  assert((await page.locator(".entry .card dl").count()) >= 1, "design doc card shown");
  assert((await page.locator(".entry .swatches").count()) >= 1, "palette card shown");
  assert((await page.locator(".cart").count()) === 1, "shipped game lands on the shelf");
  const times = await page.locator(".entry .time").allTextContents();
  assert(times[0].includes("PM") && times[times.length - 1].includes("AM"), `clock runs overnight (${times[0]} -> ${times[times.length - 1]})`);
  const done = await page.locator(".stage.is-done").count();
  assert(done === 7, "all seven stages done");
  const lore = await page.evaluate(() => JSON.parse(localStorage.getItem("ogs.v1.lore")));
  assert(lore.gamesShipped === 1, "lore counts the shipped game");
  await page.screenshot({ path: `${SHOTS}/step2-shipped.png` });
  assert(errors.length === 0, "no console errors: " + errors.join(" | "));
  await context.close();
}
