/* BREAKER: bounce it back, break every block. */
OGS.game({
  title: OGS.CFG.title,
  controls: "lr",
  init: function (s) {
    s.px = W / 2;
    s.pw = 46 * SIZE * (1.15 - D * 0.15);
    s.lives = 3;
    s.blocks = [];
    var rows = 4 + Math.round(D), cols = 10;
    var colours = [PAL.accent, PAL.hero, PAL.danger, PAL.text, PAL.bg2];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        s.blocks.push({ x: 10 + c * 30, y: 30 + r * 14, w: 28, h: 12, col: colours[r % colours.length], bad: OGS.rand() < 0.12 * D, gift: OGS.rand() < 0.1 });
      }
    }
    s.falls = [];
    resetBall(s);
  },
  update: function (s, dt, input) {
    var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    s.px = OGS.clamp(s.px + dir * 190 * SPD * dt, s.pw / 2, W - s.pw / 2);
    var b = s.ball;
    if (s.wait > 0) {
      s.wait -= dt;
      b.x = s.px;
      b.y = 206;
      if (s.wait <= 0 || (input.pressed.left || input.pressed.right) && s.wait < 0.6) {
        s.wait = 0;
        b.vx = OGS.rand(-60, 60);
        b.vy = -150 * SPD * (0.8 + D * 0.2);
      }
      return;
    }
    b.vx += gustForce(OGS.time) * 30 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 4 || b.x > W - 4) {
      b.vx *= -1;
      b.x = OGS.clamp(b.x, 4, W - 4);
      OGS.sfx("blip");
    }
    if (b.y < 18) {
      b.vy = Math.abs(b.vy);
      OGS.sfx("blip");
    }
    if (b.vy > 0 && b.y > 206 && b.y < 216 && Math.abs(b.x - s.px) < s.pw / 2 + 4) {
      var off = (b.x - s.px) / (s.pw / 2);
      var sp = Math.min(280, Math.sqrt(b.vx * b.vx + b.vy * b.vy) * 1.02);
      b.vx = off * sp * 0.75;
      b.vy = -Math.sqrt(Math.max(40 * 40, sp * sp - b.vx * b.vx));
      OGS.sfx("jump");
    }
    for (var i = s.blocks.length - 1; i >= 0; i--) {
      var k = s.blocks[i];
      if (b.x > k.x - 3 && b.x < k.x + k.w + 3 && b.y > k.y - 3 && b.y < k.y + k.h + 3) {
        var fromSide = b.x < k.x || b.x > k.x + k.w;
        if (fromSide) b.vx *= -1;
        else b.vy *= -1;
        s.blocks.splice(i, 1);
        OGS.addScore(10);
        OGS.sfx(k.bad ? "boom" : "coin");
        OGS.burst(k.x + k.w / 2, k.y + k.h / 2, k.col, 10);
        if (k.bad) s.falls.push({ x: k.x + k.w / 2, y: k.y, bad: true });
        else if (k.gift) s.falls.push({ x: k.x + k.w / 2, y: k.y, bad: false });
        if (!s.blocks.length) {
          OGS.addScore(50 * s.lives);
          OGS.win("ALL SMASHED!");
          return;
        }
        break;
      }
    }
    for (var f = s.falls.length - 1; f >= 0; f--) {
      var fl = s.falls[f];
      fl.y += 70 * dt;
      if (fl.y > H) s.falls.splice(f, 1);
      else if (fl.y > 204 && Math.abs(fl.x - s.px) < s.pw / 2) {
        s.falls.splice(f, 1);
        if (fl.bad) {
          s.pw = Math.max(26, s.pw - 8);
          OGS.sfx("hit");
          OGS.shake(3);
        } else {
          s.pw = Math.min(80, s.pw + 8);
          OGS.addScore(25);
          OGS.sfx("powerup");
        }
      }
    }
    if (b.y > H + 6) {
      s.lives--;
      OGS.sfx("hit");
      OGS.shake(4);
      if (s.lives <= 0) {
        OGS.lose("OUT OF BALLS");
        return;
      }
      resetBall(s);
    }
  },
  draw: function (s, g) {
    drawScenery(g, 0, H);
    for (var i = 0; i < s.blocks.length; i++) {
      var k = s.blocks[i];
      g.rect(k.x, k.y, k.w, k.h, k.col);
      g.rect(k.x, k.y, k.w, 2, g.shade(k.col, 0.3));
      if (k.bad) g.sprite(P.hazard, k.x + k.w / 2, k.y + k.h / 2, 10, PAL.bg);
    }
    for (var f = 0; f < s.falls.length; f++) g.sprite(s.falls[f].bad ? P.hazard : P.item, s.falls[f].x, s.falls[f].y, 12, s.falls[f].bad ? PAL.danger : PAL.accent);
    g.rect(s.px - s.pw / 2, 212, s.pw, 6, PAL.text);
    g.sprite(P.hero, s.px, 224, 16 * SIZE, PAL.hero);
    g.sprite(P.item, s.ball.x, s.ball.y, 9, PAL.accent);
    g.weather(P.weather, WIND * 0.3);
    drawHearts(g, s.lives, W - 10, 14);
    if (s.wait > 0) g.text("GET READY", W / 2, 160, PAL.text, 1, "center");
  },
});

function resetBall(s) {
  s.ball = { x: s.px, y: 206, vx: 0, vy: 0 };
  s.wait = 1.4;
}
