/* CATCHER: slide along the bottom, catch the good stuff, dodge the bad. */
OGS.game({
  title: OGS.CFG.title,
  controls: "lr",
  init: function (s) {
    s.x = W / 2;
    s.vx = 0;
    s.lives = 3;
    s.caught = 0;
    s.drops = [];
    s.spawn = 1.2;
    s.inv = 0;
    s.combo = 0;
    s.msg = "";
    s.msgT = 0;
  },
  update: function (s, dt, input) {
    var max = 170 * SPD;
    var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (P.ice) s.vx += dir * 600 * dt, (s.vx -= s.vx * Math.min(1, 1.5 * dt));
    else s.vx = dir * max;
    s.vx = OGS.clamp(s.vx, -max, max);
    s.x = OGS.clamp(s.x + s.vx * dt, 14, W - 14);
    var gust = gustForce(OGS.time);

    s.spawn -= dt;
    var rate = Math.max(0.35, (1.05 - OGS.time * 0.012) / (0.7 + D * 0.3));
    if (s.spawn <= 0) {
      s.spawn = rate;
      var bad = OGS.rand() < 0.18 + D * 0.1 + Math.min(0.15, OGS.time * 0.004);
      s.drops.push({ x: OGS.rand(16, W - 16), y: -10, vy: (55 + OGS.rand(0, 30) + OGS.time * 1.2) * SPD * (0.8 + D * 0.2), bad: bad, spin: OGS.rand(0, 6) });
    }
    for (var i = s.drops.length - 1; i >= 0; i--) {
      var d = s.drops[i];
      d.y += d.vy * dt;
      d.x = OGS.clamp(d.x + gust * 50 * dt, 8, W - 8);
      if (d.y > 196 && d.y < 222 && Math.abs(d.x - s.x) < 18 * SIZE) {
        s.drops.splice(i, 1);
        if (d.bad) {
          if (s.inv <= 0) {
            s.lives--;
            s.inv = 1;
            s.combo = 0;
            OGS.sfx("boom");
            OGS.shake(5);
            OGS.burst(d.x, d.y, PAL.danger, 18);
            say(s, "OUCH!");
          }
        } else {
          s.caught++;
          s.combo++;
          OGS.addScore(10 * Math.min(5, s.combo));
          OGS.sfx("coin");
          OGS.burst(d.x, d.y, PAL.accent, 8);
          if (s.combo % 5 === 0) say(s, "COMBO X" + Math.min(5, s.combo));
          if (s.caught >= P.goal) {
            OGS.win("BASKET FULL!");
            return;
          }
        }
      } else if (d.y > H + 10) {
        s.drops.splice(i, 1);
        if (!d.bad) {
          s.lives--;
          s.combo = 0;
          OGS.sfx("hit");
          say(s, "MISSED ONE!");
        }
      }
      if (s.lives <= 0) {
        OGS.lose("DROPPED IT ALL");
        return;
      }
    }
    if (s.inv > 0) s.inv -= dt;
    if (s.msgT > 0) s.msgT -= dt;
  },
  draw: function (s, g) {
    drawScenery(g, OGS.time * 4, 214);
    g.rect(0, 214, W, H - 214, PAL.bg2);
    g.rect(0, 214, W, 2, g.shade(PAL.bg2, 0.3));
    for (var i = 0; i < s.drops.length; i++) {
      var d = s.drops[i];
      g.sprite(d.bad ? P.hazard : P.item, d.x, d.y, d.bad ? 18 : 16, d.bad ? PAL.danger : PAL.accent);
    }
    if (!(s.inv > 0 && Math.floor(g.t * 12) % 2)) {
      g.sprite(P.hero, s.x, 203, 22 * SIZE, PAL.hero);
      g.rect(s.x - 14 * SIZE, 212, 28 * SIZE, 3, PAL.text);
    }
    g.weather(P.weather, gustForce(OGS.time) + WIND * 0.2);
    drawHearts(g, s.lives, W - 10, 14);
    hudRight(g, s.caught + "/" + P.goal, 2);
    banner(g, s.msg, s.msgT);
  },
});

function say(s, m) {
  s.msg = m;
  s.msgT = 0.9;
}
