# Overnight Game Studio runtime API

Your game is ONE plain JavaScript script (no modules, no imports, no HTML) that
runs inside a sandboxed iframe after the runtime has loaded. There is no
network and no storage: everything must be drawn with code.

## Register the game

```js
OGS.game({
  title: "Storm Slice",       // optional, shown on the title screen
  controls: "4way",           // one of: "lr", "4way", "tap", "lr+a", "4way+a"
  hud: true,                  // optional; false hides the runtime's "SCORE n" in the top-left
  init(s) { /* reset state: s is a fresh empty object for every run */ },
  update(s, dt, input) { /* advance the game by dt seconds (dt <= 1/30) */ },
  draw(s, g) { /* draw the current state; the screen is cleared to PAL.bg first */ },
});
```

The runtime owns the title screen, the game-over screen, restarting, the
score display and best score. Call `OGS.lose(msg)` or `OGS.win(msg)` to end a
run (short messages like "SPLAT!" or "DELIVERED!"). Never block, never use
`alert`, timers or `requestAnimationFrame`: everything happens in `update`.

## Screen

The canvas is `W` x `H` = 320 x 240 logical pixels, scaled up crisply. Origin
top-left, y grows downward. Keep important things away from the top 14 pixels
(score bar). Draw extra HUD text at the top-right, e.g. `g.text("3/6", W - 4, 4, PAL.text, 1, "right")`.

## Colours: always use PAL

`PAL` has six colour slots that the Artist recolours in the art pass. Use only
these (plus `g.shade(colour, amount)` for lighter/darker variants, amount -1..1):

- `PAL.bg`: background, `PAL.bg2`: secondary background (ground, walls, platforms)
- `PAL.hero`: the player, `PAL.accent`: pickups and goals, `PAL.danger`: hazards and enemies
- `PAL.text`: text and highlights

## Input (the `input` argument of update)

- Held: `input.left`, `input.right`, `input.up`, `input.down`, `input.a`, `input.b` (booleans)
- Pressed this frame: `input.pressed.left` ... `input.pressed.a`, `input.pressed.b`
- Pointer: `input.pointer.x`, `.y`, `.down`, `.pressed` (in game pixels)

Keyboard: arrows/WASD, A = Space/Z/Enter, B = X/Shift. On phones the runtime
shows touch buttons that match `controls` ("tap" makes a tap anywhere count
as `a`). Design for the controls you declare and make them visibly do something.

## Drawing (the `g` argument of draw)

- `g.clear(colour)`, `g.rect(x, y, w, h, colour)`, `g.circle(x, y, r, colour)`, `g.line(x1, y1, x2, y2, colour, width)`
- `g.text(str, x, y, colour, scale = 1, align = "left" | "center" | "right")`: chunky pixel font, upper-case, 4px per character at scale 1 (5px tall)
- `g.sprite(name, x, y, size, colour)`: a code-drawn sprite centred on (x, y), animated over time. Names:
  creatures: blob, bird, cat, dog, fish, frog, robot, ghost, bee, slime, person, knight, ship, rocket, ufo, car, boat, snail, mouse, penguin, duck, crab, bat, wasp;
  items: pizza, coin, gem, star, heart, letter, box, cake, apple, carrot, donut, cookie, flower, key, mushroom, bone, cup, note, drop, leaf, battery, sock;
  hazards: rock, spike, cloud, bolt, fire, bomb, saw, puddle, tornado, alarm
- `g.weather("rain" | "snow" | "storm", windStrength)`: animated weather overlay
- `g.darkness(x, y, radius, alpha)`: darken everything except a circle of light
- `g.shade(colour, amount)`, `g.t` (seconds since load), `g.ctx` (raw CanvasRenderingContext2D, for anything else)

## Helpers

- `OGS.rand(a, b)`, `OGS.randInt(a, b)`, `OGS.pick(array)`, `OGS.clamp(v, a, b)`, `OGS.lerp(a, b, t)`, `OGS.dist(ax, ay, bx, by)`
- `OGS.hitRect(a, b)` for `{x, y, w, h}` boxes (top-left), `OGS.hitCircle(a, b)` for `{x, y, r}` circles
- `OGS.addScore(n)`, `OGS.setScore(n)`, `OGS.score`, `OGS.time` (seconds into this run)
- `OGS.sfx(name)`: "jump", "coin", "hit", "boom", "shoot", "blip", "powerup" ("win"/"lose" play automatically)
- `OGS.burst(x, y, colour, count, speed)`: particle burst; `OGS.shake(magnitude, seconds)`; `OGS.flash(colour, seconds)`

## Rules the playtest checks

1. The script must call `OGS.game({...})` and must not throw.
2. Something must be visible and moving within the first seconds.
3. The declared controls must visibly change what's on screen.
4. Fair start: the run must not end in the first 2 seconds if the player does nothing.
5. Fast: under ~2 ms per frame. No `getImageData`, no huge loops, keep arrays bounded (remove off-screen objects).
6. Use `dt` for all motion so the game runs the same at any frame rate.

## Example

```js
OGS.game({
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
    g.sprite("cat", s.x, 205, 22, PAL.hero);
    g.text("MISSED " + s.missed + "/3", W - 4, 4, PAL.text, 1, "right");
  },
});
```
