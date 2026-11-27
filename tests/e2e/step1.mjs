import { openPage, assert, SHOTS } from "./helpers.mjs";

const FAKE = [{
  id: "fake1", title: "Storm Slice", tagline: "Deliver the pizza. Respect the wind.", pitch: "a pigeon delivering pizza in a storm",
  createdAt: Date.now(), source: "builtin", kind: "template", templateId: "courier", params: {}, controls: "4way",
  palette: { bg: "#1d2a4a", bg2: "#3a4a6a", hero: "#c9d1d9", accent: "#ffd56b", danger: "#7fd6ff", text: "#f4efe6", names: ["a","b","c","d","e","f"] },
  cover: { hero: "bird", item: "pizza", hazard: "bolt", motif: "rain" }, diary: [],
}];

export default async function step1(browser, base) {
  console.log("step 1: studio, pitch box, shelf");
  {
    const { page, context, errors } = await openPage(browser, base);
    await page.waitForTimeout(600);
    const nonBlank = await page.evaluate(() => {
      const c = document.querySelector("#scene");
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4 * 37) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return seen.size;
    });
    assert(nonBlank > 20, `scene canvas is drawn (${nonBlank} distinct colours sampled)`);
    assert((await page.locator("#stages li").count()) === 7, "seven production stages shown");
    assert(await page.locator(".shelf-empty").isVisible(), "empty shelf message shown");
    assert(await page.locator("#pitch-input").isVisible(), "pitch box visible");
    // click Bram (coder) seated at desk: seat x = 30+24-8 = 46, y ~ 140 in scene px
    const box = await page.locator("#scene").boundingBox();
    await page.mouse.click(box.x + (46 / 320) * box.width, box.y + (140 / 180) * box.height);
    await page.waitForTimeout(100);
    assert(await page.locator("#agent-card").isVisible(), "clicking an agent opens their card");
    assert((await page.locator("#agent-card").textContent()).includes("Bram"), "card shows Bram the Coder");
    await page.screenshot({ path: `${SHOTS}/step1-desktop.png` });
    assert(errors.length === 0, "no console errors: " + errors.join(" | "));
    await context.close();
  }
  {
    const { page, context, errors } = await openPage(browser, base, {
      device: "iPhone SE",
      init: `localStorage.setItem("ogs.v1.shelf", ${JSON.stringify(JSON.stringify(FAKE))});`,
    });
    await page.waitForTimeout(500);
    assert((await page.locator(".cart").count()) === 1, "saved game appears on the shelf after reload");
    assert((await page.locator(".cart-title").first().textContent()) === "Storm Slice", "cart shows its title");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `no horizontal scroll on phone (overflow ${overflow}px)`);
    await page.screenshot({ path: `${SHOTS}/step1-phone.png`, fullPage: true });
    assert(errors.length === 0, "no console errors on phone: " + errors.join(" | "));
    await context.close();
  }
}
