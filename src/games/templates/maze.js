/* MAZE: sweep the room for pickups while things chase you. */
var CELL = 16, COLS = 20, ROWS = 14, TOP = 16;
OGS.game({
  title: OGS.CFG.title,
  controls: "4way",
  init: function (s) {
    s.walls = [];
    var r = seeded(Number(OGS.CFG.seed) || 5);
    for (var cy = 0; cy < ROWS; cy++) {
      for (var cx = 0; cx < COLS; cx++) {
        var border = cx === 0 || cy === 0 || cx === COLS - 1 || cy === ROWS - 1;
        var pillar = cx % 2 === 0 && cy % 2 === 0 && r() < 0.8;
        if (border || pillar) s.walls.push({ x: cx * CELL, y: TOP + cy * CELL, w: CELL, h: CELL });
      }
    }
    s.items = [];
    var free = [];
    for (var y = 1; y < ROWS - 1; y++) for (var x = 1; x < COLS - 1; x++) if (!blocked(s, x * CELL + 8, TOP + y * CELL + 8)) free.push({ x: x * CELL + 8, y: TOP + y * CELL + 8 });
    free = free.filter(function (f) { return OGS.dist(f.x, f.y, 24, TOP + 24) >= 30; });
    var want = Math.min(free.length, Math.round(14 + D * 6));
    while (s.items.length < want && free.length) {
      s.items.push(free.splice(Math.floor(OGS.rand(0, free.length)), 1)[0]);
    }
    s.total = s.items.length;
    s.hero = { x: 24, y: TOP + 24, r: 6 };
    s.lives = 3;
    s.inv = 0;
    s.chasers = [];
    var corners = [[W - 24, TOP + 24], [W - 24, TOP + ROWS * CELL - 24], [24, TOP + ROWS * CELL - 24], [W / 2, TOP + ROWS * CELL / 2]];
    var n = Math.round(2 + D * 1.5);
    for (var c = 0; c < n; c++) {
      var p = corners[c % corners.length];
      s.chasers.push({ x: p[0], y: p[1], r: 6, dx: 0, dy: 0, think: 0, home: p, wake: 1.8 + c * 0.6 });
    }
  },
  update: function (s, dt, input) {
    var h = s.hero;
    var sp = 78 * SPD;
    var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    move(s, h, mx * sp * dt, my * sp * dt);
    for (var i = s.items.length - 1; i >= 0; i--) {
      if (OGS.dist(h.x, h.y, s.items[i].x, s.items[i].y) < 10) {
        OGS.burst(s.items[i].x, s.items[i].y, PAL.accent, 6);
        s.items.splice(i, 1);
        OGS.addScore(10);
        OGS.sfx("coin");
        if (!s.items.length) {
          OGS.addScore(100 * s.lives);
          OGS.win("ALL COLLECTED!");
          return;
        }
      }
    }
    var csp = (44 + (s.total - s.items.length) * 0.8) * SPD * (0.7 + D * 0.3);
    for (var c = 0; c < s.chasers.length; c++) {
      var z = s.chasers[c];
      if (OGS.time < z.wake) continue;
      z.think -= dt;
      if (z.think <= 0) {
        z.think = OGS.rand(0.3, 0.8);
        var tx = h.x - z.x, ty = h.y - z.y;
        if (OGS.rand() < 0.25) {
          var a = OGS.randInt(0, 3);
          z.dx = [1, -1, 0, 0][a];
          z.dy = [0, 0, 1, -1][a];
        } else if (Math.abs(tx) > Math.abs(ty)) {
          z.dx = Math.sign(tx);
          z.dy = 0;
        } else {
          z.dx = 0;
          z.dy = Math.sign(ty);
        }
      }
      var ox = z.x, oy = z.y;
      move(s, z, z.dx * csp * dt, z.dy * csp * dt);
      if (z.x === ox && z.y === oy) z.think = 0;
      if (s.inv <= 0 && OGS.hitCircle(h, z)) {
        s.lives--;
        s.inv = 1.6;
        OGS.sfx("hit");
        OGS.shake(4);
        OGS.burst(h.x, h.y, PAL.danger, 14);
        h.x = 24;
        h.y = TOP + 24;
        if (s.lives <= 0) {
          OGS.lose("CAUGHT!");
          return;
        }
      }
    }
    if (s.inv > 0) s.inv -= dt;
  },
  draw: function (s, g) {
    drawFloor(g);
    for (var i = 0; i < s.walls.length; i++) {
      var w = s.walls[i];
      g.rect(w.x, w.y, w.w, w.h, g.shade(PAL.bg2, 0.12));
      g.rect(w.x, w.y, w.w, 3, g.shade(PAL.bg2, 0.35));
    }
    for (var j = 0; j < s.items.length; j++) g.sprite(P.item, s.items[j].x, s.items[j].y, 11, PAL.accent);
    for (var c = 0; c < s.chasers.length; c++) {
      var z = s.chasers[c];
      g.ctx.globalAlpha = OGS.time < z.wake ? 0.5 : 1;
      g.sprite(P.hazard, z.x, z.y, 15, PAL.danger);
      g.ctx.globalAlpha = 1;
    }
    var h = s.hero;
    if (!(s.inv > 0 && Math.floor(g.t * 12) % 2)) g.sprite(P.hero, h.x, h.y, 15 * SIZE, PAL.hero);
    g.weather(P.weather, WIND * 0.3);
    if (P.dark) g.darkness(h.x, h.y, 56, 0.85);
    g.rect(0, 0, W, TOP, PAL.bg);
    g.text("SCORE " + OGS.score, 4, 4, PAL.text, 1);
    drawHearts(g, s.lives, W - 10, 4);
    g.text(s.total - s.items.length + "/" + s.total, W / 2, 4, PAL.accent, 1, "center");
  },
  hud: false,
});

function blocked(s, x, y) {
  for (var i = 0; i < s.walls.length; i++) {
    var w = s.walls[i];
    if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return true;
  }
  return false;
}

function hits(s, o) {
  var b = { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 };
  for (var i = 0; i < s.walls.length; i++) if (OGS.hitRect(b, s.walls[i])) return true;
  return false;
}

function move(s, o, dx, dy) {
  o.x += dx;
  if (hits(s, o)) o.x -= dx;
  o.y += dy;
  if (hits(s, o)) o.y -= dy;
}
