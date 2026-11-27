/* STACKER: drop each piece on the stack. Overhangs fall off. */
var BASE_Y = 216, PIECE_H = 14;
OGS.game({
  title: OGS.CFG.title,
  controls: "tap",
  init: function (s) {
    s.stack = [{ x: W / 2 - 40, w: 80 }];
    s.piece = { x: 0, w: 80, dir: 1 };
    s.camera = 0;
    s.camTarget = 0;
    s.falling = [];
    s.dropping = null;
    s.perfect = 0;
    s.msg = "";
    s.msgT = 0;
  },
  update: function (s, dt, input) {
    var level = s.stack.length;
    var speed = (70 + level * 7 * D) * SPD * (1 + gustForce(OGS.time) * 0.6);
    if (!s.dropping) {
      s.piece.x += s.piece.dir * speed * dt;
      if (s.piece.x < 4) {
        s.piece.x = 4;
        s.piece.dir = 1;
      }
      if (s.piece.x + s.piece.w > W - 4) {
        s.piece.x = W - 4 - s.piece.w;
        s.piece.dir = -1;
      }
      if (input.pressed.a) {
        s.dropping = { x: s.piece.x, w: s.piece.w, y: topY(s) - 60, vy: 0 };
        OGS.sfx("blip");
      }
    } else {
      var d = s.dropping;
      d.vy += 900 * dt;
      d.y += d.vy * dt;
      if (d.y >= topY(s) - PIECE_H) land(s);
      if (s.lost) return;
    }
    for (var i = s.falling.length - 1; i >= 0; i--) {
      var f = s.falling[i];
      f.vy += 600 * dt;
      f.y += f.vy * dt;
      f.x += f.vx * dt;
      if (f.y > s.camera + H + 40) s.falling.splice(i, 1);
    }
    s.camTarget = Math.max(0, (s.stack.length - 7) * PIECE_H);
    s.camera += (s.camTarget - s.camera) * Math.min(1, dt * 4);
    if (s.msgT > 0) s.msgT -= dt;
  },
  draw: function (s, g) {
    drawScenery(g, s.camera * 0.5, H);
    var cam = s.camera;
    g.rect(W / 2 - 60, BASE_Y + cam, 120, H - BASE_Y + 4, PAL.bg2);
    for (var i = 0; i < s.stack.length; i++) {
      var p = s.stack[i];
      var y = BASE_Y - (i + 1) * PIECE_H + cam;
      if (y > H || y < -PIECE_H) continue;
      drawPiece(g, p.x, y, p.w, i);
    }
    for (var j = 0; j < s.falling.length; j++) drawPiece(g, s.falling[j].x, s.falling[j].y + cam, s.falling[j].w, 3);
    var ty = topY(s) + cam;
    g.sprite(P.hero, s.stack[s.stack.length - 1].x + s.stack[s.stack.length - 1].w / 2, ty - 9, 16 * SIZE, PAL.hero);
    if (s.dropping) drawPiece(g, s.dropping.x, s.dropping.y + cam, s.dropping.w, s.stack.length);
    else drawPiece(g, s.piece.x, ty - 60, s.piece.w, s.stack.length);
    g.weather(P.weather, gustForce(OGS.time) + WIND * 0.2);
    hudRight(g, s.stack.length - 1 + "/" + P.goal, 0);
    if (s.stack.length === 1 && !s.dropping) g.text("TAP / SPACE TO DROP", W / 2, 150, PAL.text, 1, "center");
    banner(g, s.msg, s.msgT);
  },
});

function topY(s) {
  return BASE_Y - s.stack.length * PIECE_H;
}

function drawPiece(g, x, y, w, i) {
  var col = i % 2 ? PAL.accent : g.shade(PAL.accent, -0.2);
  g.rect(x, y, w, PIECE_H - 1, col);
  g.rect(x, y, w, 2, g.shade(col, 0.3));
  var n = Math.max(1, Math.floor(w / 22));
  for (var k = 0; k < n; k++) g.sprite(P.item, x + (k + 0.5) * (w / n), y + PIECE_H / 2, 10, g.shade(col, -0.35));
}

function land(s) {
  var d = s.dropping;
  var top = s.stack[s.stack.length - 1];
  var left = Math.max(d.x, top.x), right = Math.min(d.x + d.w, top.x + top.w);
  var overlap = right - left;
  s.dropping = null;
  var y = topY(s) - PIECE_H;
  if (overlap <= 2) {
    s.falling.push({ x: d.x, y: y, w: d.w, vy: 0, vx: d.x < top.x ? -40 : 40 });
    OGS.sfx("hit");
    OGS.shake(6);
    s.lost = true;
    OGS.lose("TOPPLED!");
    return;
  }
  if (Math.abs(d.x - top.x) < 3) {
    // perfect: snap and reward
    left = top.x;
    overlap = top.w;
    s.perfect++;
    OGS.addScore(25);
    say(s, "PERFECT!");
    OGS.sfx("powerup");
  } else {
    var cutX = d.x < top.x ? d.x : right;
    var cutW = d.w - overlap;
    if (cutW > 0) s.falling.push({ x: cutX, y: y, w: cutW, vy: 0, vx: d.x < top.x ? -30 : 30 });
    OGS.sfx("coin");
  }
  s.stack.push({ x: left, w: overlap });
  OGS.addScore(10);
  OGS.burst(left + overlap / 2, y + s.camera, PAL.text, 6, 40);
  s.piece = { x: s.piece.dir > 0 ? 4 : W - 4 - overlap, w: overlap, dir: s.piece.dir };
  if (s.stack.length - 1 >= P.goal) OGS.win("SKY HIGH!");
}

function say(s, m) {
  s.msg = m;
  s.msgT = 0.8;
}
