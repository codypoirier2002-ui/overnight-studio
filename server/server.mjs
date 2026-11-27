// Overnight Game Studio server.
// - Serves the built app (or the Vite dev server with --dev).
// - Holds the Anthropic API key (from .env) so it never reaches the browser.
// - Owns every prompt: the browser only sends structured inputs.
//
// Usage: node server/server.mjs [--dev] [--port 8787] [--host 127.0.0.1]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./api.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// ---- config ----
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const envFile = process.env.OGS_ENV_FILE || path.join(root, ".env");
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (e) {
    console.warn(`Could not read ${path.basename(envFile)}: ${e.message}`);
  }
}

const DEV = flag("--dev");
const PORT = Number(opt("--port", process.env.PORT || 8787));
const HOST = opt("--host", process.env.HOST || "127.0.0.1");

const api = createApi({ root });

// ---- static files ----
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};
const distDir = path.join(root, "dist");

function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(distDir, rel));
  if (!file.startsWith(distDir + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (!fs.existsSync(path.join(distDir, "index.html"))) {
        res.writeHead(503, { "content-type": "text/plain" }).end("Build the app first: npm run build (or use npm run dev)");
        return;
      }
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": rel.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
      "x-content-type-options": "nosniff",
    });
    fs.createReadStream(file).pipe(res);
  });
}

// ---- boot ----
let vite = null;
if (DEV) {
  const { createServer } = await import("vite");
  vite = await createServer({ root, server: { middlewareMode: true }, appType: "spa" });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url && req.url.startsWith("/api/")) {
      await api.handle(req, res);
      return;
    }
    if (vite) {
      vite.middlewares(req, res, () => res.writeHead(404).end());
      return;
    }
    serveStatic(req, res);
  } catch (e) {
    console.error("Request failed:", e && e.message);
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "server_error" }));
  }
});

server.listen(PORT, HOST, () => {
  const status = api.status();
  console.log(`Overnight Game Studio ${DEV ? "(dev) " : ""}running at http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}/`);
  console.log(
    status.ai
      ? `AI team: on. Coder ${status.models.coder}, chatter ${status.models.chatter}. Daily cap ${status.usage.cap} calls.`
      : "AI team: off (no ANTHROPIC_API_KEY in .env). The studio will remix its built-in templates.",
  );
});
