// API routes for the studio. The browser sends small structured requests; the
// server builds the prompts, calls Claude with the key from .env, validates
// the output and enforces a daily call budget.
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createUsage } from "./usage.mjs";
import {
  CHATTER_SYSTEM, CONTROLS, CREATURES, HAZARDS, ITEMS, MOODS, MOTIFS, SCHEMAS, TASKS, WHO, coderSystem, factsBlock,
} from "./prompts.mjs";

// Models that accept server-side refusal fallbacks (fallbacks: "default").
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1", "claude-sonnet-5-5"]);
const MAX_BODY = 256 * 1024;

export function createApi({ root }) {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  const ai = key.length > 0;
  const coderModel = process.env.OGS_CODER_MODEL || "claude-opus-5-5";
  const chatterModel = process.env.OGS_CHATTER_MODEL || "claude-haiku-5-5";
  const coderEffort = process.env.OGS_CODER_EFFORT || "high";
  const cap = Math.max(0, Number(process.env.OGS_DAILY_CALL_CAP || 60));
  const coderCap = Math.max(0, Number(process.env.OGS_DAILY_CODER_CAP || 16));
  const usage = createUsage({ file: process.env.OGS_USAGE_FILE || path.join(root, "server", ".usage.json"), cap, coderCap });
  // The key is handed to the SDK and never logged or sent to the browser.
  const client = ai ? new Anthropic({ apiKey: key, maxRetries: 2, timeout: 10 * 60 * 1000 }) : null;
  let coderInFlight = 0;

  const status = () => ({
    ai,
    models: ai ? { coder: coderModel, chatter: chatterModel } : { coder: null, chatter: null },
    usage: usage.snapshot(),
  });

  function send(res, code, body) {
    res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(JSON.stringify(body));
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) {
          reject(Object.assign(new Error("too_large"), { code: 413 }));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
        } catch {
          reject(Object.assign(new Error("bad_json"), { code: 400 }));
        }
      });
      req.on("error", reject);
    });
  }

  /** Only accept requests from the studio page itself. */
  function sameOrigin(req) {
    if (req.headers["x-ogs"] !== "1") return false;
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return false;
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  }

  async function callClaude({ kind, system, user, schema }) {
    const model = kind === "coder" ? coderModel : chatterModel;
    const params = {
      model,
      max_tokens: kind === "coder" ? 32000 : 4000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort: kind === "coder" ? coderEffort : "low", format: { type: "json_schema", schema } },
    };
    const started = Date.now();
    let msg;
    if (FALLBACK_MODELS.has(model)) {
      // Opt into server-side refusal fallbacks; stream so long builds can't time out.
      msg = await client.beta.messages
        .stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
        .finalMessage();
    } else {
      msg = await client.messages.stream(params).finalMessage();
    }
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[claude] ${kind} ${msg.model} ${secs}s in=${msg.usage?.input_tokens ?? "?"} out=${msg.usage?.output_tokens ?? "?"} stop=${msg.stop_reason}`);
    if (msg.stop_reason === "refusal") throw Object.assign(new Error("refused"), { code: 422 });
    if (msg.stop_reason === "max_tokens") throw Object.assign(new Error("truncated"), { code: 502 });
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try {
      return JSON.parse(text);
    } catch {
      throw Object.assign(new Error("bad_output"), { code: 502 });
    }
  }

  // ---------- validation of model output ----------
  const str = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const hex = (v) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null);
  const oneOf = (v, list, d) => (list.includes(v) ? v : d);

  function cleanLines(lines, max = 14) {
    if (!Array.isArray(lines)) return [];
    return lines
      .filter((l) => l && WHO.includes(l.who) && typeof l.text === "string" && l.text.trim())
      .slice(0, max)
      .map((l) => ({ who: l.who, text: str(l.text, 240), mood: oneOf(l.mood, MOODS, "talk") }));
  }

  function cleanFacts(f) {
    // Facts come from the browser: keep only short, known fields.
    const o = f && typeof f === "object" ? f : {};
    const out = {};
    for (const [k, v] of Object.entries(o).slice(0, 24)) {
      if (typeof v === "string") out[k] = v.slice(0, 600);
      else if (typeof v === "number" && isFinite(v)) out[k] = v;
      else if (typeof v === "boolean") out[k] = v;
      else if (v && typeof v === "object") out[k] = safeJSON(v, 1500);
    }
    return out;
  }

  function safeJSON(v, limit) {
    const s = JSON.stringify(v ?? null);
    return s.length > limit ? s.slice(0, limit) + "..." : s;
  }

  async function runTask(body) {
    const task = String(body.task || "");
    const pitch = str(body.pitch, 140);
    if (!pitch) throw Object.assign(new Error("missing_pitch"), { code: 400 });

    if (task === "build" || task === "fix") {
      if (coderInFlight >= 2) throw Object.assign(new Error("busy"), { code: 429 });
      const denied = usage.take("coder");
      if (denied) throw Object.assign(new Error(denied), { code: 429 });
      const doc = body.doc && typeof body.doc === "object" ? body.doc : {};
      let user = `Tonight's pitch: "${pitch}"\n\nDesign doc (JSON): ${safeJSON(doc, 3000)}\n`;
      if (task === "fix") {
        const code = String(body.code || "").slice(0, 60000);
        user += `\nMoss's automated playtest FAILED (attempt ${Number(body.attempt) || 1} of 3). Report (JSON): ${safeJSON(body.report, 4000)}\n\nYour current script:\n\`\`\`js\n${code}\n\`\`\`\n\nFind the cause of every failed check and error, fix it, and return the complete corrected script (not a diff). Keep what already works.`;
      } else {
        user += `\nWrite the game now.`;
      }
      user += `\n\n${factsBlock(cleanFacts(body.facts))}`;
      coderInFlight++;
      try {
        const out = await callClaude({ kind: "coder", system: coderSystem(), user, schema: SCHEMAS.code });
        const code = String(out.code || "");
        if (!/OGS\.game\s*\(/.test(code) || code.length > 80000) throw Object.assign(new Error("bad_code"), { code: 502 });
        return { code, controls: oneOf(out.controls, CONTROLS, "4way+a"), lines: cleanLines(out.lines, 6) };
      } finally {
        coderInFlight--;
      }
    }

    const spec = TASKS[task];
    if (!spec) throw Object.assign(new Error("unknown_task"), { code: 400 });
    const denied = usage.take("chatter");
    if (denied) throw Object.assign(new Error(denied), { code: 429 });
    const facts = cleanFacts({ ...(body.facts || {}), pitch });
    const extra = [];
    if (body.doc) extra.push(`Design doc (JSON): ${safeJSON(body.doc, 3000)}`);
    if (body.report) extra.push(`Playtest report (JSON): ${safeJSON(body.report, 3000)}`);
    const user = `${spec.ask}\n\nTonight's pitch: "${pitch}"\n${extra.join("\n")}\n\n${factsBlock(facts)}`;
    const out = await callClaude({ kind: "chatter", system: CHATTER_SYSTEM, user, schema: SCHEMAS[spec.schema] });
    const lines = cleanLines(out.lines);
    switch (spec.schema) {
      case "lines":
        return { lines };
      case "design":
        return {
          lines,
          doc: {
            title: str(out.title, 28) || "Untitled",
            logline: str(out.logline, 200),
            genre: str(out.genre, 60),
            player: str(out.player, 160),
            goal: str(out.goal, 200),
            controls: oneOf(out.controls, CONTROLS, "4way+a"),
            hazards: str(out.hazards, 200),
            twist: str(out.twist, 200),
            cut: (Array.isArray(out.cut) ? out.cut : []).slice(0, 4).map((c) => str(c, 80)).filter(Boolean),
          },
        };
      case "art": {
        const p = out.palette || {};
        const palette = { bg: hex(p.bg), bg2: hex(p.bg2), hero: hex(p.hero), accent: hex(p.accent), danger: hex(p.danger), text: hex(p.text) };
        const ok = Object.values(palette).every(Boolean);
        return {
          lines,
          palette: ok ? { ...palette, names: (Array.isArray(out.names) ? out.names : []).slice(0, 6).map((n) => str(n, 28)) } : null,
          cover: {
            hero: oneOf(out.cover?.hero, CREATURES, "blob"),
            item: oneOf(out.cover?.item, ITEMS, "star"),
            hazard: oneOf(out.cover?.hazard, HAZARDS, "rock"),
            motif: oneOf(out.cover?.motif, MOTIFS, "stars"),
          },
        };
      }
      case "ship":
        return { lines, title: str(out.title, 28), tagline: str(out.tagline, 70) };
    }
    return { lines };
  }

  return {
    status,
    async handle(req, res) {
      const url = new URL(req.url, "http://x");
      if (req.method === "GET" && url.pathname === "/api/status") {
        send(res, 200, status());
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/studio") {
        if (!sameOrigin(req)) return send(res, 403, { error: "forbidden" });
        if (!ai) return send(res, 503, { error: "no_key" });
        let body;
        try {
          body = await readBody(req);
        } catch (e) {
          return send(res, e.code || 400, { error: e.message });
        }
        try {
          const out = await runTask(body);
          send(res, 200, { ok: true, ...out, usage: usage.snapshot() });
        } catch (e) {
          if (e instanceof Anthropic.AuthenticationError) {
            console.error("[claude] authentication failed: check ANTHROPIC_API_KEY in .env");
            return send(res, 502, { error: "bad_key" });
          }
          if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: "rate_limited" });
          if (e instanceof Anthropic.APIError) {
            console.error(`[claude] API error ${e.status}: ${e.message}`);
            return send(res, 502, { error: "api_error" });
          }
          if (e && e.code && typeof e.code === "number") return send(res, e.code, { error: e.message });
          console.error("[claude] failed:", e && e.message);
          send(res, 502, { error: "failed" });
        }
        return;
      }
      send(res, 404, { error: "not_found" });
    },
  };
}
