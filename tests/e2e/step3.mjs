import { openPage, assert, SHOTS } from "./helpers.mjs";

const PITCHES = [
  "a pigeon delivering pizza in a storm",
  "a robot barista catching falling coffee cups",
  "a tiny frog escaping a lawnmower",
  "a penguin defending the last fish from space crabs",
  "a sleepy ghost collecting lost socks in a haunted library",
  "a grandma smashing alien blocks with a teapot",
  "a wizard stacking pancakes in a windy tower",
  "a jellyfish flying through a fizzy soda ocean",
  "a speedy cat delivering letters on icy streets at night",
  "a giant bee catching honey in a snowstorm",
  "an astronaut jumping over craters on the moon",
  "a capybara collecting oranges in a hot spring",
  "a fast snail flying through a rainy garden",
  "a knight stacking crates on a sunny beach",
  "a crab bouncing pebbles at a sandcastle",
  "a ufo shooting meteors in a fast galaxy",
];

const BROKEN = {
  syntax: "OGS.game({ controls: 'lr', update(s,dt,i){ if ( }, draw(s,g){} });",
  noGame: "var x = 1;",
  throwsInUpdate: "OGS.game({ controls:'lr', init(s){s.t=0}, update(s,dt,i){ s.t+=dt; if (s.t>1) null.boom; }, draw(s,g){ g.clear(); g.rect(s.t*50,100,10,10,'#fff'); g.rect(0,0,5,5,'#f00'); } });",
  infiniteLoop: "OGS.game({ controls:'lr', update(s,dt,i){ if (i.right) { while (true) {} } }, draw(s,g){ g.clear(); g.rect(10,10,10,10,'#fff'); g.rect(30,30,10,10,'#f00'); g.rect(50,50,10,10,'#0f0'); } });",
  blank: "OGS.game({ controls:'lr', update(){}, draw(s,g){ g.clear('#000'); } });",
  deafControls: "OGS.game({ controls:'lr', init(s){s.t=0}, update(s,dt){ s.t+=dt; }, draw(s,g){ g.clear('#123'); g.circle(160+Math.sin(s.t*3)*50,120,10,'#fff'); g.rect(0,200,320,40,'#2a4'); } });",
  instadeath: "OGS.game({ controls:'lr', init(s){s.x=160}, update(s,dt,i){ s.x += (i.right-i.left)*100*dt; if (OGS.time > 0.3) OGS.lose('NOPE'); }, draw(s,g){ g.clear('#123'); g.rect(s.x,120,10,10,'#fff'); g.rect(0,200,320,40,'#2a4'); } });",
  good: "OGS.game({ controls:'lr', init(s){s.x=160;s.t=0}, update(s,dt,i){ s.t+=dt; s.x=OGS.clamp(s.x+((i.right?1:0)-(i.left?1:0))*120*dt,0,310); OGS.setScore(Math.floor(s.t*10)); }, draw(s,g){ g.clear(PAL.bg); g.sprite('bird', s.x, 120, 20, PAL.hero); g.circle(160, 60+Math.sin(s.t*2)*20, 6, PAL.accent); g.rect(0,200,320,40,PAL.bg2); } });",
};

export default async function step3(browser, base) {
  console.log("step 3: templates, remixing and the playtest");
  const { page, context, errors } = await openPage(browser, base);
  await page.waitForFunction(() => window.__OGS_TEST__);

  // 1. every pitch remixes into a template build that passes the playtest
  const results = await page.evaluate(async (pitches) => {
    const T = window.__OGS_TEST__;
    const out = [];
    for (const p of pitches) {
      const info = T.parsePitch(p);
      const pal = T.pickPalette(info, T.rngFrom(info.seed));
      const build = T.remix(info, pal, 1);
      const t0 = performance.now();
      const r = await T.runPlaytest(build, { title: "Test", pal, seed: info.seed });
      out.push({ p, tpl: build.templateId, pass: r.pass, ms: Math.round(performance.now() - t0), fails: r.checks.filter((c) => !c.ok).map((c) => c.name + ": " + c.detail), errors: r.errors, msPerFrame: r.msPerFrame, life: r.survivedSeconds });
    }
    return out;
  }, PITCHES);
  const templates = new Set(results.map((r) => r.tpl));
  for (const r of results) {
    console.log(`    ${r.pass ? "PASS" : "FAIL"} ${r.tpl.padEnd(8)} ${String(r.ms).padStart(5)}ms ${r.msPerFrame}ms/f life ${r.life}s  ${r.p}${r.pass ? "" : "\n      " + r.fails.join("\n      ") + " " + r.errors.join(" | ")}`);
  }
  assert(templates.size === 8, `all 8 templates covered (${[...templates].join(", ")})`);
  assert(results.every((r) => r.pass), "every remixed template passes the playtest");

  // 2. the playtest catches broken games
  const broken = await page.evaluate(async (cases) => {
    const T = window.__OGS_TEST__;
    const pal = { bg: "#102030", bg2: "#203040", hero: "#ffd56b", accent: "#7fd6c2", danger: "#ff5a5a", text: "#ffffff", names: [] };
    const out = {};
    for (const [name, code] of Object.entries(cases)) {
      const r = await T.runPlaytest({ kind: "code", code }, { title: name, pal, seed: 42 }, 12000);
      out[name] = { pass: r.pass, failed: r.checks.filter((c) => !c.ok).map((c) => c.name), errors: r.errors.slice(0, 1) };
    }
    return out;
  }, BROKEN);
  for (const [k, v] of Object.entries(broken)) console.log(`    ${k.padEnd(15)} pass=${v.pass} failed=[${v.failed.join(", ")}] ${v.errors.join("")}`);
  assert(!broken.syntax.pass && broken.syntax.failed.includes("Boots"), "syntax error caught");
  assert(!broken.noGame.pass, "missing OGS.game caught");
  assert(!broken.throwsInUpdate.pass && broken.throwsInUpdate.failed.includes("No crashes"), "runtime exception caught");
  assert(!broken.infiniteLoop.pass && broken.infiniteLoop.errors.join("").includes("Infinite loop"), "infinite loop stopped and reported");
  assert(!broken.blank.pass && broken.blank.failed.includes("Draws"), "blank screen caught");
  assert(!broken.deafControls.pass && broken.deafControls.failed.includes("Controls"), "unresponsive controls caught");
  assert(!broken.instadeath.pass && broken.instadeath.failed.includes("Fair start"), "instant game over caught");
  assert(broken.good.pass, "a small correct game passes");
  const unexpected = errors.filter((e) => !/Unexpected token/.test(e));
  assert(unexpected.length === 0, "no unexpected console errors: " + unexpected.join(" | "));
  assert(/game code line 1\)/.test(broken.syntax.errors[0] || ""), "syntax errors point at the game's own line number");
  await context.close();

  // 3. full night -> shelf -> play it
  {
    const { page, context, errors } = await openPage(browser, base);
    await page.fill("#pitch-input", "a pigeon delivering pizza in a storm");
    await page.click("#pitch-btn");
    await page.waitForTimeout(300);
    await page.click("#skip-btn");
    await page.waitForFunction(() => document.querySelector("#skip-btn").hidden, null, { timeout: 60000 });
    const reportText = await page.locator(".entry .card h4").allTextContents();
    assert(reportText.includes("PASS"), "the night's playtest report says PASS");
    await page.click(".cart");
    await page.waitForSelector("#frame-host iframe");
    const sandbox = await page.getAttribute("#frame-host iframe", "sandbox");
    assert(sandbox === "allow-scripts", "game runs in a sandboxed frame (allow-scripts only)");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/step3-title.png` });
    const frame = page.frameLocator("#frame-host iframe");
    await frame.locator("canvas").click();
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(700);
    await page.keyboard.up("ArrowRight");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(400);
    await page.keyboard.up("ArrowUp");
    await page.screenshot({ path: `${SHOTS}/step3-playing.png` });
    // the frame can't touch the studio's storage
    const leaked = await page.frames()[1].evaluate(() => { try { return String(localStorage.length); } catch (e) { return "blocked"; } }).catch(() => "blocked");
    assert(leaked === "blocked", "game frame has no access to studio storage");
    const net = await page.frames()[1].evaluate(async () => { try { await fetch("https://example.com"); return "open"; } catch (e) { return "blocked"; } }).catch(() => "blocked");
    assert(net === "blocked", "game frame cannot make network requests");
    await page.click("#player-close");
    assert(!(await page.locator("#player").isVisible()), "player closes");
    assert(errors.filter((e) => !e.includes("Content Security Policy") && !e.includes("Failed to fetch")).length === 0, "no console errors: " + errors.join(" | "));
    await context.close();
  }
}
