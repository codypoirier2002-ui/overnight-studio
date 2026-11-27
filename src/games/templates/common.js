/* Shared prelude for the built-in templates (prepended to each one). */
var P = Object.assign(
  {
    hero: "blob", item: "star", hazard: "rock", heroName: "hero", itemName: "star", hazardName: "rock",
    difficulty: 1, speed: 1, wind: 0, dark: false, ice: false, gravity: 1, size: 1, weather: "clear", goal: 10, motif: "stars",
  },
  OGS.CFG.params || {}
);
var D = Math.max(0.3, Math.min(1.5, Number(P.difficulty) || 1));
var SPD = Math.max(0.5, Math.min(1.6, Number(P.speed) || 1));
var SIZE = Math.max(0.7, Math.min(1.4, Number(P.size) || 1));
var WIND = Math.max(0, Math.min(1, Number(P.wind) || 0));

function makeLayer(draw) {
  var c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  var x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  draw(x);
  return c;
}

function seeded(n) {
  var s = n || 7;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Top-down floor pattern for the motif, cached. */
var _floor = null;
function drawFloor(g) {
  if (!_floor) {
    _floor = makeLayer(function (x) {
      var r = seeded(3);
      x.fillStyle = PAL.bg;
      x.fillRect(0, 0, W, H);
      var m = P.motif;
      x.fillStyle = PAL.bg2;
      if (m === "city" || m === "rain") {
        // rooftops seen from above, separated by streets with dashed lines
        x.fillStyle = K.shade(PAL.bg, -0.25);
        x.fillRect(0, 0, W, H);
        for (var bx = 6; bx < W; bx += 80) {
          for (var by = 20; by < H; by += 70) {
            x.fillStyle = PAL.bg2;
            x.fillRect(bx, by, 58, 48);
            x.fillStyle = K.shade(PAL.bg2, 0.18);
            x.fillRect(bx, by, 58, 3);
            x.fillStyle = K.shade(PAL.bg2, -0.2);
            x.fillRect(bx + 8 + ((r() * 30) | 0), by + 12 + ((r() * 18) | 0), 10, 8);
          }
        }
        x.fillStyle = K.shade(PAL.text, -0.55);
        for (var dx = 0; dx < W; dx += 12) {
          x.fillRect(dx, 78, 6, 1);
          x.fillRect(dx, 148, 6, 1);
        }
        for (var dy = 0; dy < H; dy += 12) {
          x.fillRect(72, dy, 1, 6);
          x.fillRect(152, dy, 1, 6);
          x.fillRect(232, dy, 1, 6);
        }
      } else if (m === "grid") {
        for (var gx = 0; gx < W; gx += 32) for (var gy = 0; gy < H; gy += 32) if (((gx + gy) / 32) % 2 === 0) x.fillRect(gx, gy, 32, 32);
      } else if (m === "leaf") {
        for (var i = 0; i < 60; i++) x.fillRect((r() * W) | 0, (r() * H) | 0, 3, 2);
        x.fillStyle = K.shade(PAL.bg2, -0.2);
        for (var j = 0; j < 14; j++) {
          x.beginPath();
          x.arc(r() * W, r() * H, 6 + r() * 8, 0, 6.3);
          x.fill();
        }
      } else if (m === "bubbles") {
        x.strokeStyle = PAL.bg2;
        for (var b = 0; b < 30; b++) {
          x.beginPath();
          x.arc(r() * W, r() * H, 2 + r() * 6, 0, 6.3);
          x.stroke();
        }
      } else if (m === "sun") {
        for (var d = 0; d < 9; d++) {
          x.beginPath();
          x.ellipse(r() * W, r() * H, 30 + r() * 30, 8 + r() * 6, 0, 0, 6.3);
          x.fill();
        }
      } else if (m === "snow") {
        x.fillStyle = K.shade(PAL.bg, 0.25);
        for (var s = 0; s < 80; s++) x.fillRect((r() * W) | 0, (r() * H) | 0, 2, 2);
      } else {
        for (var t = 0; t < 70; t++) x.fillRect((r() * W) | 0, (r() * H) | 0, 1, 1);
      }
    });
  }
  g.ctx.drawImage(_floor, 0, 0);
}

/** Side-view sky + far layer for the motif, scrolled for parallax. */
var _far = null, _sky = null;
function drawScenery(g, scroll, groundY) {
  if (!_far) {
    _far = makeLayer(function (x) {
      var r = seeded(9);
      var m = P.motif;
      x.fillStyle = PAL.bg2;
      if (m === "city" || m === "rain" || m === "grid") {
        for (var bx = 0; bx < W; ) {
          var w = 14 + ((r() * 26) | 0), h = 30 + ((r() * 70) | 0);
          x.fillRect(bx, groundY - h, w, h);
          x.fillStyle = K.shade(PAL.accent, -0.35);
          for (var wy = groundY - h + 5; wy < groundY - 4; wy += 8) for (var wx = bx + 3; wx < bx + w - 3; wx += 6) if (r() < 0.4) x.fillRect(wx, wy, 2, 3);
          x.fillStyle = PAL.bg2;
          bx += w + 2;
        }
      } else if (m === "leaf" || m === "snow") {
        for (var tx = 0; tx < W; tx += 18 + ((r() * 20) | 0)) {
          var th = 30 + r() * 40;
          x.beginPath();
          x.moveTo(tx - 12, groundY);
          x.lineTo(tx, groundY - th);
          x.lineTo(tx + 12, groundY);
          x.fill();
        }
        if (m === "snow") {
          x.fillStyle = "#ffffff";
          for (var sx = 0; sx < W; sx += 9) x.fillRect(sx, groundY - 2 - ((r() * 3) | 0), 7, 3);
        }
      } else if (m === "sun") {
        x.fillStyle = PAL.accent;
        x.beginPath();
        x.arc(262, groundY - 64, 22, 0, 6.3);
        x.fill();
        x.fillStyle = PAL.bg2;
        for (var dx = -40; dx < W + 40; dx += 70) {
          x.beginPath();
          x.ellipse(dx + r() * 20, groundY, 60, 24 + r() * 16, 0, Math.PI, 0);
          x.fill();
        }
      } else if (m === "bubbles") {
        for (var k = 0; k < W; k += 10) {
          var kh = 20 + Math.sin(k * 0.13) * 12 + r() * 20;
          x.fillRect(k, groundY - kh, 3, kh);
        }
      } else {
        x.fillStyle = PAL.text;
        for (var st = 0; st < 50; st++) x.fillRect((r() * W) | 0, (r() * (groundY - 20)) | 0, 1, 1);
        x.fillStyle = PAL.bg2;
        for (var hx = -30; hx < W + 30; hx += 60) {
          x.beginPath();
          x.ellipse(hx, groundY, 50, 30, 0, Math.PI, 0);
          x.fill();
        }
      }
    });
  }
  if (!_sky) {
    _sky = g.ctx.createLinearGradient(0, 0, 0, H);
    _sky.addColorStop(0, K.shade(PAL.bg, -0.15));
    _sky.addColorStop(1, K.shade(PAL.bg, 0.12));
  }
  g.ctx.fillStyle = _sky;
  g.ctx.fillRect(0, 0, W, H);
  var off = ((scroll % W) + W) % W;
  g.ctx.drawImage(_far, -off, 0);
  g.ctx.drawImage(_far, W - off, 0);
}

function drawHearts(g, n, x, y) {
  for (var i = 0; i < n; i++) g.sprite("heart", x - i * 11, y + 4, 10, "#ff5a7a");
}

function hudRight(g, text, row) {
  var y = 4 + (row || 0) * 9;
  g.text(text, W - 3, y + 1, "#000000", 1, "right");
  g.text(text, W - 4, y, PAL.text, 1, "right");
}

function banner(g, text, t) {
  if (t <= 0) return;
  var y = 100;
  g.ctx.globalAlpha = Math.min(1, t * 2);
  g.rect(0, y - 4, W, 18, "rgba(0,0,0,0.5)");
  g.text(text, W / 2, y, PAL.accent, 2, "center");
  g.ctx.globalAlpha = 1;
}

function gustForce(t) {
  // wind comes in gusts: mostly calm, sometimes a shove
  if (!WIND) return 0;
  var phase = Math.sin(t * 0.7) + Math.sin(t * 1.9 + 1) * 0.5;
  return phase > 0.9 ? WIND * Math.sign(Math.sin(t * 0.21) || 1) : 0;
}
