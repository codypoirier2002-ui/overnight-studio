# Overnight Game Studio

Type a one-line game pitch. A cosy pixel-art studio of four colleagues works
through the night (kickoff, design doc, build, art pass, playtest, fixes, ship)
and by dawn there's a small playable browser game on your arcade shelf.

- **Juno** (Designer): big ideas, a v2 notebook that is now three notebooks. Oat chai.
- **Bram** (Coder): calm, dry, "that's a v2 feature". Consults the desk duck. Black coffee.
- **Wren** (Artist): four colours, maybe five. Peppermint tea in a hand-painted mug.
- **Moss** (Playtester): breaks everything on purpose, keeps the Bug Jar. Lemon fizz.

Everything is invented: the studio, the crew, the games. No real games, brands or people.

## Quick start

```bash
npm install
npm start          # builds, then serves at http://localhost:8787
```

Without an API key the studio still works fully: the crew writes their own
diary and remixes eight built-in game templates (courier, catcher, runner,
shooter, maze, breaker, stacker, flyer) to fit your pitch.

For development with hot reload: `npm run dev` (same address).

## Turning on the AI team (your API key)

1. In the project folder (the one with `package.json` in it), copy `.env.example` to a new file named **`.env`**:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and paste your Anthropic API key after the equals sign on the first line:
   ```
   ANTHROPIC_API_KEY=sk-ant-...your key...
   ```
3. Restart the server (`npm start`). The badge in the top bar changes to **AI team**.

Where the key goes, and where it doesn't:

- Only the Node server (`server/`) reads `.env`. The key is never sent to the
  browser, never written into the build, and never printed in logs.
- `.env` is listed in `.gitignore`, so it won't be committed.
- The GitHub Pages site has no server, so it never has your key. It runs in template mode.

With a key, Claude plays the crew:

| Job | Model | Why |
| --- | --- | --- |
| Bram writes and fixes the game code | `claude-opus-5-5`, effort `high`, streamed | the strong model for real code |
| Kickoff, design doc, art pass, playtest chat, ship | `claude-haiku-5-5`, effort `low` | the cheap, fast model for chatter |

Change them in `.env` (`OGS_CODER_MODEL`, `OGS_CHATTER_MODEL`, `OGS_CODER_EFFORT`).
Code calls use server-side refusal fallbacks, so a declined request is retried on a fallback model.

### Spending limits

- `OGS_DAILY_CALL_CAP` (default **60**): every Claude call per day (UTC).
- `OGS_DAILY_CODER_CAP` (default **16**): code-writing calls per day. One night uses 1 build call plus up to 3 fixes.

A typical night is about 7 to 10 calls. When a cap is reached the crew says so
in the diary and finishes the night with the template cabinet. Usage is stored
in `server/.usage.json`.

## How a night works

1. **Kickoff**: the crew reads your pitch at the round table and argues (nicely) about scope.
2. **Design doc**: Juno writes it; Bram cuts features into the v2 notebook.
3. **Build**: Bram writes the game: a remixed template, or real JavaScript from Claude.
4. **Art pass**: Wren picks a six-slot palette with paint-sample names and draws the cover.
5. **Playtest**: Moss's automated playtest runs the game in a hidden sandbox: does it boot,
   draw, move, respond to controls, avoid crashes, give a fair start, and run fast?
6. **Fixes**: if it fails, Bram gets the report and fixes it, up to three tries. If it still
   fails, the crew ships a safe template build so you always get a game.
7. **Ship**: title vote (the duck breaks ties), tagline, confetti, sunrise.

Use **Fast-forward** to skip to dawn, or the **1x/2x/4x** button to change the pace.

## Safety

- Games run in an `<iframe sandbox="allow-scripts">`: no access to the studio page,
  its storage or cookies. A Content Security Policy blocks all network requests from games.
- Every loop in Claude-written or shared code gets a loop guard, so a runaway loop
  shows an error screen instead of freezing the tab.
- The server owns every prompt and only accepts a fixed set of tasks from the studio
  page (same-origin, custom header), so it can't be used as a general proxy.
- Share links and backup files are validated field by field before anything is shown or run.

## Your shelf, saves and sharing

- The shelf, studio lore (Bug Jar, Gerald the plant), best scores and settings are saved in
  your browser's local storage.
- A night in progress is saved after every stage. Reload, or come back later, and the crew
  picks up where they left off.
- **Back up** downloads your shelf as a file; **Restore** loads one (for example on your phone).
- **Copy share link** puts the whole game in the link (`#play=...`, compressed). Whoever opens it
  can play it and add it to their own shelf. No server involved.

## Play on your phone

**GitHub Pages (template mode, works anywhere):**

1. On GitHub, open the repository's **Settings → Pages**, and under *Build and deployment*
   set **Source** to **GitHub Actions** (one time).
2. Merge to `main`. The workflow in `.github/workflows/pages.yml` tests, builds and deploys.
3. Open `https://<your-user>.github.io/overnight-studio/` on your phone. Add it to your home screen
   for a full-screen app.

**With the AI team on your Wi-Fi:** start the server with `HOST=0.0.0.0 npm start`, then open
`http://<your-computer's-local-IP>:8787` on your phone. Only do this on a network you trust,
since anyone on it could use your daily call budget.

## Performance

The studio is a 320×180 canvas scaled up with crisp pixels, with static furniture cached
and the animation capped at 20 fps. It pauses when the tab is hidden or a game is open.
Games draw at 320×240. The playtest flags anything slower than about 12 ms a frame.

## Project layout

```
server/            Node server: static files, /api/status, /api/studio, prompts, daily caps
src/studio/        the pixel office (scene), the Director that runs a night, sounds, idle life
src/brain/         pitch reader, built-in writer, BuiltinBrain and AiBrain
src/games/         runtime + PixelKit sprites (run inside the sandbox), templates,
                   playtest harness, loop guard, remixer, palettes, runtime-api.md
src/ui/            diary, shelf, covers, player dialog, title screen
tests/unit/        vitest: pitch reader, writer, loop guard, share links
tests/e2e/         Playwright: one script per build step, plus a mock Claude API
```

## Tests

```bash
npm test                 # unit tests
npm run build && npm run e2e   # browser tests (needs Playwright's Chromium)
```

The AI tests run against a local mock of the Messages API (`tests/e2e/mock-anthropic.mjs`),
so they need no key and cost nothing.
