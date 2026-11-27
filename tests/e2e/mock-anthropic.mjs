// A tiny stand-in for the Claude Messages API, for testing the AI team without a key.
// MOCK_MODE: "fix-once" (first build is broken, the fix works), "always-broken", "refuse-code".
import http from "node:http";
import fs from "node:fs";

const GOOD = `OGS.game({
  title: "Coin Drizzle",
  controls: "lr",
  init(s) { s.x = W / 2; s.coins = []; s.timer = 0; s.missed = 0; },
  update(s, dt, input) {
    s.x = OGS.clamp(s.x + ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 150 * dt, 12, W - 12);
    s.timer -= dt;
    if (s.timer <= 0) { s.timer = 0.8; s.coins.push({ x: OGS.rand(10, W - 10), y: -8 }); }
    for (let i = s.coins.length - 1; i >= 0; i--) {
      const c = s.coins[i];
      c.y += 70 * dt;
      if (c.y > 200 && c.y < 220 && Math.abs(c.x - s.x) < 16) { s.coins.splice(i, 1); OGS.addScore(10); OGS.sfx("coin"); OGS.burst(c.x, c.y, PAL.accent, 8); }
      else if (c.y > H) { s.coins.splice(i, 1); if (++s.missed >= 3) OGS.lose("BUTTERFINGERS"); }
    }
  },
  draw(s, g) {
    g.rect(0, 216, W, 24, PAL.bg2);
    for (const c of s.coins) g.sprite("coin", c.x, c.y, 14, PAL.accent);
    g.sprite("bird", s.x, 205, 22, PAL.hero);
    g.text("MISSED " + s.missed + "/3", W - 4, 4, PAL.text, 1, "right");
  },
});`;
const BROKEN = GOOD.replace("s.timer -= dt;", "s.timer -= dt; if (OGS.time > 0.5) s.oops.boom();");

const line = (who, text, mood = "talk") => ({ who, text, mood });
const LINES = [line("designer", "Mock kickoff! The pitch is lovely."), line("coder", "One screen. That's the deal.", "!"), line("artist", "Four colours, maybe five."), line("tester", "Can I break it yet?", "?")];

function answerFor(body) {
  const sys = typeof body.system === "string" ? body.system : JSON.stringify(body.system);
  const user = JSON.stringify(body.messages);
  const props = body.output_config?.format?.schema?.properties ?? {};
  const mode = process.env.MOCK_MODE || "fix-once";
  if (sys.includes("You are Bram, the Coder")) {
    if (mode === "refuse-code") return { refusal: true };
    const isFix = user.includes("playtest FAILED");
    const code = mode === "always-broken" ? BROKEN : isFix ? GOOD : BROKEN;
    return { json: { code, controls: "lr", lines: [line("coder", isFix ? "Found it. Patched." : "Build's in. The duck approves.")] } };
  }
  if (props.logline) return { json: { title: "Mock Drizzle", logline: "You catch coins.", genre: "catcher", player: "A bird.", goal: "Catch 20 coins.", controls: "lr", hazards: "Gravity.", twist: "Wind.", cut: ["opera mode", "a hat shop"], lines: LINES } };
  if (props.palette) return { json: { palette: { bg: "#101828", bg2: "#263259", hero: "#ff9e7a", accent: "#7fd6c2", danger: "#ff5a7a", text: "#fdfaf3" }, names: ["Night", "Orbit", "Peach", "Mint", "Red", "Moon"], cover: { hero: "bird", item: "coin", hazard: "rock", motif: "stars" }, lines: LINES } };
  if (props.tagline) return { json: { title: "Mock Drizzle DX", tagline: "Catch it if you can.", lines: [...LINES, line("tester", "Game on the shelf! Gerald approves.", "heart")] } };
  return { json: { lines: LINES } };
}

function message(model, text, stop = "end_turn") {
  return { id: "msg_mock", type: "message", role: "assistant", model, content: text === null ? [] : [{ type: "text", text }], stop_reason: stop, stop_sequence: null, stop_details: null, usage: { input_tokens: 42, output_tokens: 99 } };
}

export function startMock(port, logFile) {
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      const ans = answerFor(body);
      if (logFile) fs.appendFileSync(logFile, JSON.stringify({ path: req.url, model: body.model, beta: req.headers["anthropic-beta"] || null, fallbacks: body.fallbacks ?? null, effort: body.output_config?.effort, stream: !!body.stream, hasKey: Object.values(req.headers).some((v) => String(v).includes("test-key-not-real")), authHeaders: Object.keys(req.headers).filter((k) => /key|auth/i.test(k)), thinking: body.thinking ?? null }) + "\n");
      const text = ans.refusal ? "" : JSON.stringify(ans.json);
      const stop = ans.refusal ? "refusal" : "end_turn";
      if (!body.stream) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(message(body.model, text, stop)));
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      ev("message_start", { message: { ...message(body.model, null, null), stop_reason: null } });
      ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
      for (let i = 0; i < text.length; i += 400) ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(i, i + 400) } });
      ev("content_block_stop", { index: 0 });
      ev("message_delta", { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 99 } });
      ev("message_stop", {});
      res.end();
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
