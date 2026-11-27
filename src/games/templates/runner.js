/* RUNNER: auto-run, one-button jump, hold to jump higher. */
var GROUND = 196;
OGS.game({
  title: OGS.CFG.title,
  controls: "tap",
  init: function (s) {
    s.y = GROUND;
    s.vy = 0;
    s.onGround = true;
    s.jumpHold = 0;
    s.dist = 0;
    s.speed = 120 * SPD * (0.8 + D * 0.2);
    s.obs = [];
    s.items = [];
    s.next = 2.2;
    s.nextItem = 1.2;
    s.scroll = 0;
    s.goal = 60;
  },
  update: function (s, dt, input) {
    var grav = 900 * (P.gravity || 1);
    if (input.pressed.a && s.onGround) {
      s.vy = -330 * Math.sqrt(P.gravity || 1);
      s.onGround = false;
      s.jumpHold = 0.18;
      OGS.sfx("jump");
    }
    if (input.a && s.jumpHold > 0 && s.vy < 0) {
      s.vy -= 900 * dt * (P.gravity || 1);
      s.jumpHold -= dt;
    } else s.jumpHold = 0;
    s.vy += grav * dt;
    s.y += s.vy * dt;
    if (s.y >= GROUND) {
      if (!s.onGround) OGS.burst(60, GROUND + 4, PAL.text, 4, 30);
      s.y = GROUND;
      s.vy = 0;
      s.onGround = true;
    }
    s.speed += dt * 2.2 * D;
    var dx = s.speed * dt;
    s.scroll += dx;
    s.dist += dx;
    OGS.setScore(Math.floor(s.dist / 10) + (s.bonus || 0));

    s.next -= dt;
    if (s.next <= 0) {
      var big = OGS.rand() < 0.3 * D;
      s.obs.push({ x: W + 20, w: big ? 22 : 14, h: big ? 24 : 16 });
      s.next = OGS.rand(0.95, 1.9) / (0.75 + D * 0.25) * (130 / s.speed) * 1.1;
    }
    s.nextItem -= dt;
    if (s.nextItem <= 0) {
      s.items.push({ x: W + 20, y: GROUND - OGS.rand(30, 70) });
      s.nextItem = OGS.rand(1.2, 2.6);
    }
    var hb = { x: 52, y: s.y - 16, w: 14, h: 14 };
    for (var i = s.obs.length - 1; i >= 0; i--) {
      var o = s.obs[i];
      o.x -= dx;
      if (o.x < -30) s.obs.splice(i, 1);
      else if (OGS.hitRect(hb, { x: o.x - o.w / 2 + 2, y: GROUND - o.h + 2, w: o.w - 4, h: o.h })) {
        OGS.sfx("hit");
        OGS.shake(5);
        OGS.burst(60, s.y - 8, PAL.danger, 20);
        OGS.lose("BONK!");
        return;
      }
    }
    for (var j = s.items.length - 1; j >= 0; j--) {
      var it = s.items[j];
      it.x -= dx;
      if (it.x < -20) s.items.splice(j, 1);
      else if (OGS.dist(59, s.y - 9, it.x, it.y) < 16) {
        s.items.splice(j, 1);
        s.bonus = (s.bonus || 0) + 25;
        OGS.sfx("coin");
        OGS.burst(it.x, it.y, PAL.accent, 8);
      }
    }
    if (OGS.time >= s.goal) OGS.win("YOU MADE IT!");
  },
  draw: function (s, g) {
    drawScenery(g, s.scroll * 0.3, GROUND + 4);
    g.rect(0, GROUND + 4, W, H - GROUND - 4, PAL.bg2);
    for (var x = -((s.scroll | 0) % 24); x < W; x += 24) g.rect(x, GROUND + 4, 12, 3, g.shade(PAL.bg2, 0.25));
    for (var i = 0; i < s.obs.length; i++) {
      var o = s.obs[i];
      g.sprite(P.hazard, o.x, GROUND + 4 - o.h / 2, Math.max(o.w, o.h) + 4, PAL.danger);
    }
    for (var j = 0; j < s.items.length; j++) g.sprite(P.item, s.items[j].x, s.items[j].y, 14, PAL.accent);
    var bob = s.onGround ? Math.abs(Math.sin(g.t * 14)) * 2 : 0;
    g.sprite(P.hero, 59, s.y - 9 - bob, 22 * SIZE, PAL.hero);
    g.weather(P.weather, WIND * 0.5);
    if (P.dark) g.darkness(59, s.y - 9, 80, 0.7);
    hudRight(g, Math.max(0, Math.ceil(s.goal - OGS.time)) + "S TO GO", 0);
    if (OGS.time < 2) g.text("TAP / SPACE TO JUMP", W / 2, 60, PAL.text, 1, "center");
  },
});
