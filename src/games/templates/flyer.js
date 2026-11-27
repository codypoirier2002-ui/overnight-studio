/* FLYER: tap to flap, thread the gaps. Hovers until the first flap. */
OGS.game({
  title: OGS.CFG.title,
  controls: "tap",
  init: function (s) {
    s.y = 110;
    s.vy = 0;
    s.started = false;
    s.cols = [];
    s.items = [];
    s.passed = 0;
    s.scroll = 0;
    s.next = 0;
    s.gap = 92 - D * 14;
  },
  update: function (s, dt, input) {
    var grav = 520 * (P.gravity || 1);
    var flap = -175 * Math.sqrt(P.gravity || 1);
    if (!s.started) {
      s.y = 110 + Math.sin(OGS.time * 3) * 6;
      if (input.pressed.a) {
        s.started = true;
        s.vy = flap;
        OGS.sfx("jump");
      }
      return;
    }
    if (input.pressed.a) {
      s.vy = flap;
      OGS.sfx("jump");
      OGS.burst(70, s.y + 6, PAL.text, 3, 30);
    }
    s.vy = Math.min(s.vy + grav * dt, 260);
    s.y += s.vy * dt;
    var speed = 70 * SPD * (0.8 + D * 0.2) + s.passed * 1.5;
    var dx = speed * dt;
    s.scroll += dx;
    s.next -= dx;
    if (s.next <= 0) {
      var gy = OGS.rand(48, H - 48 - s.gap);
      s.cols.push({ x: W + 20, top: gy, bot: gy + s.gap, scored: false });
      if (OGS.rand() < 0.6) s.items.push({ x: W + 20, y: gy + s.gap / 2 });
      s.next = OGS.rand(130, 170);
    }
    var hero = { x: 72, y: s.y, r: 7 * SIZE };
    for (var i = s.cols.length - 1; i >= 0; i--) {
      var c = s.cols[i];
      c.x -= dx;
      if (c.x < -30) {
        s.cols.splice(i, 1);
        continue;
      }
      if (!c.scored && c.x < 60) {
        c.scored = true;
        s.passed++;
        OGS.addScore(10);
        OGS.sfx("blip");
        if (s.passed >= P.goal) {
          OGS.win("TOUCHDOWN!");
          return;
        }
      }
      if (Math.abs(c.x - hero.x) < 14 + hero.r && (hero.y - hero.r < c.top || hero.y + hero.r > c.bot)) {
        crash(s);
        return;
      }
    }
    for (var j = s.items.length - 1; j >= 0; j--) {
      var it = s.items[j];
      it.x -= dx;
      if (it.x < -20) s.items.splice(j, 1);
      else if (OGS.dist(hero.x, hero.y, it.x, it.y) < 14) {
        s.items.splice(j, 1);
        OGS.addScore(25);
        OGS.sfx("coin");
        OGS.burst(it.x, it.y, PAL.accent, 8);
      }
    }
    if (s.y > H - 12 || s.y < 6) crash(s);
  },
  draw: function (s, g) {
    drawScenery(g, s.scroll * 0.3, H - 8);
    for (var i = 0; i < s.cols.length; i++) {
      var c = s.cols[i];
      g.rect(c.x - 14, 0, 28, c.top, g.shade(PAL.danger, -0.35));
      g.rect(c.x - 14, c.bot, 28, H - c.bot, g.shade(PAL.danger, -0.35));
      g.rect(c.x - 16, c.top - 6, 32, 6, PAL.danger);
      g.rect(c.x - 16, c.bot, 32, 6, PAL.danger);
      g.sprite(P.hazard, c.x, c.top - 14, 14, PAL.danger);
      g.sprite(P.hazard, c.x, c.bot + 14, 14, PAL.danger);
    }
    for (var j = 0; j < s.items.length; j++) g.sprite(P.item, s.items[j].x, s.items[j].y, 14, PAL.accent);
    g.rect(0, H - 8, W, 8, PAL.bg2);
    g.sprite(P.hero, 72, s.y, 20 * SIZE, PAL.hero);
    g.weather(P.weather, WIND * 0.5);
    hudRight(g, s.passed + "/" + P.goal, 0);
    if (!s.started) g.text("TAP / SPACE TO FLAP", W / 2, 150, PAL.text, 1, "center");
  },
});

function crash(s) {
  OGS.sfx("hit");
  OGS.shake(5);
  OGS.burst(72, s.y, PAL.danger, 20);
  OGS.lose("THUD!");
}
