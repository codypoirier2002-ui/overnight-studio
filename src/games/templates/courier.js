/* COURIER: top-down delivery dash. Pick up, carry, drop off, dodge. */
OGS.game({
  title: OGS.CFG.title,
  controls: "4way",
  init: function (s) {
    s.hero = { x: 60, y: 180, vx: 0, vy: 0, r: 7 * SIZE };
    s.carrying = false;
    s.delivered = 0;
    s.hearts = 3;
    s.timer = 75;
    s.inv = 0;
    s.msg = "";
    s.msgT = 0;
    s.pick = spot(s, 40, 200);
    s.door = spot(s, s.pick.x, s.pick.y);
    s.hazards = [];
    var n = Math.round(2 + D * 2);
    for (var i = 0; i < n; i++) {
      var p = spot(s, s.hero.x, s.hero.y, 110);
      var a = OGS.rand(0, Math.PI * 2);
      var v = (28 + i * 6) * D * SPD;
      s.hazards.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 8 });
    }
    s.gust = 0;
  },
  update: function (s, dt, input) {
    var h = s.hero;
    var acc = 520 * SPD, max = 105 * SPD, fric = P.ice ? 0.5 : 7;
    var ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    h.vx += ax * acc * dt;
    h.vy += ay * acc * dt;
    if (!ax) h.vx -= h.vx * Math.min(1, fric * dt);
    if (!ay) h.vy -= h.vy * Math.min(1, fric * dt);
    s.gust = gustForce(OGS.time);
    h.vx += s.gust * 140 * dt;
    var sp = Math.sqrt(h.vx * h.vx + h.vy * h.vy);
    if (sp > max) {
      h.vx *= max / sp;
      h.vy *= max / sp;
    }
    h.x = OGS.clamp(h.x + h.vx * dt, 10, W - 10);
    h.y = OGS.clamp(h.y + h.vy * dt, 22, H - 10);

    for (var i = 0; i < s.hazards.length; i++) {
      var z = s.hazards[i];
      z.x += (z.vx + s.gust * 30) * dt;
      z.y += z.vy * dt;
      if (z.x < 10 || z.x > W - 10) z.vx *= -1;
      if (z.y < 24 || z.y > H - 10) z.vy *= -1;
      z.x = OGS.clamp(z.x, 10, W - 10);
      z.y = OGS.clamp(z.y, 24, H - 10);
      if (s.inv <= 0 && OGS.hitCircle(h, z)) {
        s.hearts--;
        s.inv = 1.4;
        OGS.sfx("hit");
        OGS.shake(4);
        OGS.burst(h.x, h.y, PAL.danger, 14);
        if (s.carrying) {
          s.carrying = false;
          say(s, "DROPPED IT!");
        }
        if (s.hearts <= 0) {
          OGS.lose("SPLAT!");
          return;
        }
      }
    }
    if (s.inv > 0) s.inv -= dt;

    if (!s.carrying && OGS.dist(h.x, h.y, s.pick.x, s.pick.y) < 14) {
      s.carrying = true;
      OGS.sfx("coin");
      OGS.burst(s.pick.x, s.pick.y, PAL.accent, 10);
      say(s, "GOT THE " + String(P.itemName).toUpperCase() + "!");
    }
    if (s.carrying && OGS.dist(h.x, h.y, s.door.x, s.door.y) < 16) {
      s.carrying = false;
      s.delivered++;
      OGS.addScore(100 + Math.round(s.timer));
      OGS.sfx("powerup");
      OGS.burst(s.door.x, s.door.y, PAL.accent, 24, 120);
      say(s, "DELIVERED!");
      if (s.delivered >= P.goal) {
        OGS.win("ALL DELIVERED!");
        return;
      }
      s.pick = spot(s, h.x, h.y, 70);
      s.door = spot(s, s.pick.x, s.pick.y, 120);
      for (var j = 0; j < s.hazards.length; j++) {
        s.hazards[j].vx *= 1.06;
        s.hazards[j].vy *= 1.06;
      }
    }
    s.timer -= dt;
    if (s.msgT > 0) s.msgT -= dt;
    if (s.timer <= 0) OGS.lose("OUT OF TIME");
  },
  draw: function (s, g) {
    drawFloor(g);
    // door
    var pulse = 0.5 + Math.sin(g.t * 6) * 0.5;
    g.rect(s.door.x - 11, s.door.y - 14, 22, 26, g.shade(PAL.bg2, -0.3));
    g.rect(s.door.x - 9, s.door.y - 12, 18, 24, s.carrying ? PAL.accent : g.shade(PAL.accent, -0.5));
    if (s.carrying) {
      g.ctx.globalAlpha = 0.3 * pulse;
      g.circle(s.door.x, s.door.y, 22, PAL.accent);
      g.ctx.globalAlpha = 1;
    }
    g.rect(s.door.x + 4, s.door.y, 2, 2, PAL.bg);
    // pickup
    if (!s.carrying) {
      g.ctx.globalAlpha = 0.35;
      g.circle(s.pick.x, s.pick.y, 12 + pulse * 3, PAL.accent);
      g.ctx.globalAlpha = 1;
      g.sprite(P.item, s.pick.x, s.pick.y + Math.sin(g.t * 4) * 2, 16, PAL.accent);
    }
    for (var i = 0; i < s.hazards.length; i++) g.sprite(P.hazard, s.hazards[i].x, s.hazards[i].y, 18, PAL.danger);
    var h = s.hero;
    if (!(s.inv > 0 && Math.floor(g.t * 12) % 2)) {
      g.sprite(P.hero, h.x, h.y, 18 * SIZE, PAL.hero);
      if (s.carrying) g.sprite(P.item, h.x, h.y - 14, 11, PAL.accent);
    }
    // arrow to target
    var tx = s.carrying ? s.door.x : s.pick.x, ty = s.carrying ? s.door.y : s.pick.y;
    var a = Math.atan2(ty - h.y, tx - h.x);
    if (OGS.dist(h.x, h.y, tx, ty) > 40) g.circle(h.x + Math.cos(a) * 18, h.y + Math.sin(a) * 18, 2, PAL.accent);
    g.weather(P.weather, s.gust || WIND * 0.2);
    if (P.dark) g.darkness(h.x, h.y, 60, 0.78);
    if (s.gust) g.text(s.gust > 0 ? "GUST >>" : "<< GUST", W / 2, 22, PAL.text, 1, "center");
    drawHearts(g, s.hearts, W - 10, 14);
    hudRight(g, s.delivered + "/" + P.goal + "  " + Math.ceil(s.timer) + "S", 0);
    banner(g, s.msg, s.msgT);
  },
});

function say(s, m) {
  s.msg = m;
  s.msgT = 1.1;
}

function spot(s, awayX, awayY, minD) {
  minD = minD || 90;
  for (var i = 0; i < 40; i++) {
    var x = OGS.rand(24, W - 24), y = OGS.rand(40, H - 20);
    if (OGS.dist(x, y, awayX, awayY) >= minD) return { x: x, y: y };
  }
  return { x: W - awayX, y: H - awayY + 20 > H - 20 ? 60 : H - awayY + 20 };
}
