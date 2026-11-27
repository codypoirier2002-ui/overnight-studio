import { openPage, assert, SHOTS } from "./helpers.mjs";

export default async function step5(browser, base) {
  console.log("step 5: covers, sounds and studio life");
  const { page, context, errors } = await openPage(browser, base);
  await page.waitForFunction(() => window.__OGS_TEST__);

  // Studio life: idle crew wanders off and comes back.
  const wander = await page.evaluate(() => {
    const { life, scene } = window.__OGS_TEST__;
    const seen = new Set();
    for (let i = 0; i < 90; i++) {
      life.tick(1);
      for (const id of ["designer", "coder", "artist", "tester"]) seen.add(scene.activityOf(id));
    }
    return [...seen];
  });
  assert(wander.length >= 3, `idle crew gets up to things (${wander.join(", ")})`);

  // Sound: toggling persists and the AudioContext starts after a gesture
  await page.click("#sound-btn");
  let settings = await page.evaluate(() => JSON.parse(localStorage.getItem("ogs.v1.settings")));
  assert(settings.sound === false && (await page.locator("#sound-btn").textContent()) === "Sound off", "sound can be muted and the choice is saved");
  await page.click("#sound-btn");
  settings = await page.evaluate(() => JSON.parse(localStorage.getItem("ogs.v1.settings")));
  assert(settings.sound === true, "sound can be turned back on");

  // A night ends with confetti, a cover in the diary and the board saying ship
  await page.fill("#pitch-input", "a wizard stacking pancakes in a windy tower");
  await page.click("#pitch-btn");
  await page.waitForTimeout(300);
  await page.click("#skip-btn");
  await page.waitForFunction(() => document.querySelector("#skip-btn").hidden, null, { timeout: 60000 });
  assert((await page.locator(".entry .cover-card canvas").count()) === 1, "the diary shows the finished cover");
  const stage = await page.evaluate(() => window.__OGS_TEST__.scene.stage);
  assert(stage === "ship", "the whiteboard says ship after shipping");
  await page.waitForTimeout(200);
  await page.locator(".scene-wrap").screenshot({ path: `${SHOTS}/step5-shipped-scene.png` });

  // Covers for every template look different from each other and aren't blank
  for (const p of ["a robot barista catching falling coffee cups", "a tiny frog escaping a lawnmower", "a penguin defending the last fish from space crabs", "a jellyfish flying through a fizzy soda ocean"]) {
    await page.fill("#pitch-input", p);
    await page.click("#pitch-btn");
    await page.waitForTimeout(200);
    await page.click("#skip-btn");
    await page.waitForFunction(() => document.querySelector("#skip-btn").hidden, null, { timeout: 60000 });
  }
  const hashes = await page.$$eval(".cart canvas", (cs) => cs.map((c) => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let h = 0, colours = new Set();
    for (let i = 0; i < d.length; i += 4 * 11) { h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); }
    return { h, n: colours.size };
  }));
  assert(hashes.length === 5 && new Set(hashes.map((x) => x.h)).size === 5, "five shipped games, five different covers");
  assert(hashes.every((x) => x.n > 12), "covers are colourful, not blank");
  await page.locator("#shelf").screenshot({ path: `${SHOTS}/step5-shelf.png` });
  const carts = await page.evaluate(() => window.__OGS_TEST__.scene.shelf.length);
  assert(carts === 5, "the studio's cartridge shelf shows every shipped game");
  const lore = await page.evaluate(() => JSON.parse(localStorage.getItem("ogs.v1.lore")));
  assert(lore.gamesShipped === 5 && lore.gerald >= 6, `Gerald grows with every game (${lore.gerald} leaves)`);

  // The game frame gets the mute setting
  await page.click("#sound-btn");
  await page.click(".cart");
  await page.waitForSelector("#frame-host iframe");
  const muted = await page.frames()[1].evaluate(() => window.CFG.sound);
  assert(muted === false, "games start muted when the studio is muted");
  await page.click("#player-close");
  await page.locator(".scene-wrap").screenshot({ path: `${SHOTS}/step5-scene.png` });
  assert(errors.length === 0, "no console errors: " + errors.join(" | "));
  await context.close();
}
