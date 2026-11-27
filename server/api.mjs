// API routes. Step 4 adds the AI team; for now only status.
export function createApi() {
  const ai = Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
  const status = () => ({ ai, models: { coder: null, chatter: null }, usage: { calls: 0, cap: 0 } });
  return {
    status,
    async handle(req, res) {
      const url = new URL(req.url, "http://x");
      if (req.method === "GET" && url.pathname === "/api/status") {
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify(status()));
        return;
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
    },
  };
}
