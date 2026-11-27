/* SHOOTER: hold the line against three waves coming down from above. */
OGS.game({
  title: OGS.CFG.title,
  controls: "lr+a",
  init: function (s) {
    s.x = W / 2;
    s.lives = 3;
    s.wave = 0;
    s.shots = [];
    s.bombs = [];
    s.power = 0;
    s.drops = [];
    s.cool = 0;
    s.inv = 0;
    s.msgT = 0;
    s.msg = "";
    nextWave(s);
  },
  update: function (s, dt, input) {
    var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    s.x = OGS.clamp(s.x + dir * 150 * SPD * dt, 12, W - 12);
    s.cool -= dt;
    if (input.a && s.cool <= 0) {
      s.cool = s.power > 0 ? 0.18 : 0.3;
      s.shots.push({ x: s.x, y: 204, vx: 0 });
      if (s.power > 0) {
        s.shots.push({ x: s.x, y: 204, vx: -60 });
        s.shots.push({ x: s.x, y: 204, vx: 60 });
      }
      OGS.sfx("shoot");
    }
    if (s.power > 0) s.power -= dt;
    for (var i = s.shots.length - 1; i >= 0; i--) {
      var b = s.shots[i];
      b.y -= 260 * dt;
      b.x += b.vx * dt;
      if (b.y < -6) s.shots.splice(i, 1);
    }
    // formation movement
    var f = s.form;
    f.x += f.dir * f.speed * dt;
    var minX = 999, maxX = -999, maxY = 0, alive = 0;
    for (var e = 0; e < s.foes.length; e++) {
      var z = s.foes[e];
      if (!z.alive) continue;
      alive++;
      var zx = f.x + z.cx, zy = f.y + z.cy + Math.sin(OGS.time * 3 + z.cx) * 2;
      z.x = zx;
      z.y = zy;
      minX = Math.min(minX, zx);
      maxX = Math.max(maxX, zx);
      maxY = Math.max(maxY, zy);
      for (var k = s.shots.length - 1; k >= 0; k--) {
        var sh = s.shots[k];
        if (Math.abs(sh.x - zx) < 10 && Math.abs(sh.y - zy) < 10) {
          z.alive = false;
          s.shots.splice(k, 1);
          OGS.addScore(15 + s.wave * 5);
          OGS.sfx("boom");
          OGS.burst(zx, zy, PAL.danger, 12);
          if (OGS.rand() < 0.08) s.drops.push({ x: zx, y: zy });
          break;
        }
      }
    }
    if (minX < 12 || maxX > W - 12) {
      f.dir *= -1;
      f.y += 8;
      f.x += f.dir * 4;
    }
    if (alive === 0) {
      if (s.wave >= 3) {
        OGS.win("SKY CLEARED!");
        return;
      }
      nextWave(s);
      return;
    }
    if (maxY > 196) {
      OGS.lose("THEY LANDED!");
      return;
    }
    // bombs
    s.bombT -= dt;
    if (s.bombT <= 0 && OGS.time > 1.5) {
      var shooters = s.foes.filter(function (q) { return q.alive; });
      var sh2 = OGS.pick(shooters);
      s.bombs.push({ x: sh2.x, y: sh2.y + 8 });
      s.bombT = OGS.rand(0.6, 1.4) / (0.7 + D * 0.3 + s.wave * 0.1);
    }
    for (var j = s.bombs.length - 1; j >= 0; j--) {
      var bm = s.bombs[j];
      bm.y += (90 + s.wave * 15) * SPD * dt;
      if (bm.y > H) s.bombs.splice(j, 1);
      else if (s.inv <= 0 && Math.abs(bm.x - s.x) < 10 && Math.abs(bm.y - 208) < 10) {
        s.bombs.splice(j, 1);
        s.lives--;
        s.inv = 1.2;
        OGS.sfx("hit");
        OGS.shake(5);
        OGS.burst(s.x, 208, PAL.hero, 16);
        if (s.lives <= 0) {
          OGS.lose("SHOT DOWN");
          return;
        }
      }
    }
    for (var d = s.drops.length - 1; d >= 0; d--) {
      var dr = s.drops[d];
      dr.y += 60 * dt;
      if (dr.y > H) s.drops.splice(d, 1);
      else if (Math.abs(dr.x - s.x) < 14 && Math.abs(dr.y - 208) < 12) {
        s.drops.splice(d, 1);
        s.power = 6;
        OGS.sfx("powerup");
        say(s, "TRIPLE SHOT!");
      }
    }
    if (s.inv > 0) s.inv -= dt;
    if (s.msgT > 0) s.msgT -= dt;
  },
  draw: function (s, g) {
    drawScenery(g, OGS.time * 6, 226);
    g.rect(0, 226, W, 14, PAL.bg2);
    for (var i = 0; i < s.foes.length; i++) if (s.foes[i].alive) g.sprite(P.hazard, s.foes[i].x, s.foes[i].y, 16, PAL.danger);
    for (var j = 0; j < s.shots.length; j++) g.rect(s.shots[j].x - 1, s.shots[j].y - 4, 2, 7, PAL.accent);
    for (var k = 0; k < s.bombs.length; k++) g.circle(s.bombs[k].x, s.bombs[k].y, 2.5, PAL.danger);
    for (var d = 0; d < s.drops.length; d++) g.sprite(P.item, s.drops[d].x, s.drops[d].y, 14, PAL.accent);
    if (!(s.inv > 0 && Math.floor(g.t * 12) % 2)) g.sprite(P.hero, s.x, 210, 22 * SIZE, PAL.hero);
    g.weather(P.weather, WIND * 0.3);
    drawHearts(g, s.lives, W - 10, 14);
    hudRight(g, "WAVE " + s.wave + "/3", 2);
    banner(g, s.msg, s.msgT);
  },
});

function nextWave(s) {
  s.wave++;
  var cols = 5 + s.wave, rows = 2 + Math.min(2, s.wave - 1);
  s.foes = [];
  for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) s.foes.push({ cx: c * 26, cy: r * 20, alive: true, x: 0, y: 0 });
  s.form = { x: (W - (cols - 1) * 26) / 2, y: 30, dir: 1, speed: (24 + s.wave * 8) * SPD * (0.7 + D * 0.3) };
  s.bombT = 1.5;
  s.shots = [];
  s.bombs = [];
  say(s, "WAVE " + s.wave);
}

function say(s, m) {
  s.msg = m;
  s.msgT = 1.2;
}
