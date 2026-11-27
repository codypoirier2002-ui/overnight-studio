// Usage: node tests/e2e/run.mjs [step1 step2 ...]   (builds first: npm run build)
import { startServer, withBrowser } from "./helpers.mjs";

const all = ["step1", "step2", "step3", "step4", "step5", "step6"];
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : all;
const PORT = 4317;
const base = `http://127.0.0.1:${PORT}/`;

const server = await startServer("node", ["server/server.mjs", "--port", String(PORT)], base + "api/status", {
  ANTHROPIC_API_KEY: "",
  OGS_ENV_FILE: "/nonexistent",
});
let failed = false;
try {
  await withBrowser(async (browser) => {
    for (const name of wanted) {
      let mod;
      try {
        mod = await import(`./${name}.mjs`);
      } catch (e) {
        if (e.code === "ERR_MODULE_NOT_FOUND") continue;
        throw e;
      }
      try {
        await mod.default(browser, base);
      } catch (e) {
        failed = true;
        console.error(`FAILED ${name}:`, e.message);
      }
    }
  });
} finally {
  server.proc.kill();
}
process.exit(failed ? 1 : 0);
