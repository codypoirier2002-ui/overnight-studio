/* PixelKit: a tiny bitmap font and a library of code-drawn sprites.
 * Plain classic script on purpose: the studio imports it for covers, and the
 * same source is injected verbatim into every sandboxed game frame. */
(function (root) {
  "use strict";

  // 3x5 glyphs, rows top to bottom.
  var G = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
    E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
    I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
    M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
    Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
    U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
    Y: "101101010010010", Z: "111001010100111",
    "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
    "4": "101101111001001", "5": "111100110001110", "6": "011100111101111", "7": "111001010010010",
    "8": "111101111101111", "9": "111101111001110",
    "!": "010010010000010", "?": "110001010000010", ".": "000000000000010", ",": "000000000010100",
    "-": "000000111000000", ":": "000010000010000", "+": "000010111010000", "#": "101111101111101",
    "/": "001001010100100", "<": "001010100010001", ">": "100010001010100", "=": "000111000111000",
    "'": "010010000000000", "(": "010100100100010", ")": "010001001001010", "*": "000101010101000",
    "%": "101001010100101", "&": "010101010101011", "$": "011110010011110", "@": "010101111100011",
    " ": "000000000000000"
  };

  function textWidth(str, scale) {
    scale = scale || 1;
    return Math.max(0, String(str).length * 4 * scale - scale);
  }

  /** Draw text with the bitmap font. align: "left" | "center" | "right". */
  function drawText(ctx, str, x, y, color, scale, align) {
    scale = scale || 1;
    str = String(str).toUpperCase();
    var w = textWidth(str, scale);
    if (align === "center") x -= Math.floor(w / 2);
    else if (align === "right") x -= w;
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = color;
    for (var i = 0; i < str.length; i++) {
      var g = G[str[i]] || G["?"];
      for (var p = 0; p < 15; p++) {
        if (g.charCodeAt(p) === 49) {
          ctx.fillRect(x + (p % 3) * scale, y + ((p / 3) | 0) * scale, scale, scale);
        }
      }
      x += 4 * scale;
    }
    return w;
  }

  /** Word-wrap into lines that fit maxWidth at the given scale. */
  function wrapText(str, maxWidth, scale) {
    var words = String(str).split(/\s+/);
    var lines = [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (textWidth(test, scale) > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---------- Sprites ----------
  // Every sprite is drawn centred on (x, y) inside a box of size s.
  // c = main colour, k = detail colour (optional). Simple shapes only.

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
  function disc(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
  }
  function poly(ctx, pts, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }
  function eye(ctx, x, y, s) {
    px(ctx, x, y, Math.max(1, s * 0.12), Math.max(1, s * 0.12), "#141018");
  }

  var S = {};

  S.blob = function (ctx, x, y, s, c, k, t) {
    var wob = Math.sin((t || 0) * 6) * s * 0.04;
    poly(ctx, [x - s * 0.45, y + s * 0.4, x - s * 0.38, y - s * 0.1 - wob, x, y - s * 0.42 + wob, x + s * 0.38, y - s * 0.1 - wob, x + s * 0.45, y + s * 0.4], c);
    eye(ctx, x - s * 0.17, y - s * 0.05, s);
    eye(ctx, x + s * 0.08, y - s * 0.05, s);
  };
  S.bird = function (ctx, x, y, s, c, k, t) {
    var flap = Math.sin((t || 0) * 14) > 0 ? -1 : 1;
    disc(ctx, x, y, s * 0.32, c);
    disc(ctx, x + s * 0.24, y - s * 0.2, s * 0.18, c);
    poly(ctx, [x + s * 0.38, y - s * 0.24, x + s * 0.52, y - s * 0.16, x + s * 0.38, y - s * 0.1], k || "#ffb02e");
    eye(ctx, x + s * 0.26, y - s * 0.25, s);
    poly(ctx, [x - s * 0.1, y - s * 0.02, x - s * 0.42, y - s * 0.3 * flap, x + s * 0.12, y + s * 0.04], shade(c, -0.25));
    poly(ctx, [x - s * 0.3, y + s * 0.05, x - s * 0.5, y + s * 0.12, x - s * 0.3, y + s * 0.2], shade(c, -0.15));
  };
  S.cat = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.36, y - s * 0.05, s * 0.72, s * 0.42, c);
    poly(ctx, [x - s * 0.36, y - s * 0.05, x - s * 0.3, y - s * 0.4, x - s * 0.12, y - s * 0.05], c);
    poly(ctx, [x + s * 0.36, y - s * 0.05, x + s * 0.3, y - s * 0.4, x + s * 0.12, y - s * 0.05], c);
    eye(ctx, x - s * 0.18, y + s * 0.06, s);
    eye(ctx, x + s * 0.1, y + s * 0.06, s);
    px(ctx, x - s * 0.04, y + s * 0.18, s * 0.08, s * 0.06, k || "#ff8fa3");
  };
  S.dog = function (ctx, x, y, s, c, k) {
    disc(ctx, x, y, s * 0.34, c);
    px(ctx, x - s * 0.46, y - s * 0.28, s * 0.16, s * 0.4, shade(c, -0.3));
    px(ctx, x + s * 0.3, y - s * 0.28, s * 0.16, s * 0.4, shade(c, -0.3));
    eye(ctx, x - s * 0.16, y - s * 0.08, s);
    eye(ctx, x + s * 0.08, y - s * 0.08, s);
    disc(ctx, x, y + s * 0.12, s * 0.08, k || "#141018");
  };
  S.fish = function (ctx, x, y, s, c, k, t) {
    var w = Math.sin((t || 0) * 10) * s * 0.06;
    poly(ctx, [x - s * 0.4, y, x - s * 0.05, y - s * 0.28, x + s * 0.4, y, x - s * 0.05, y + s * 0.28], c);
    poly(ctx, [x - s * 0.38, y, x - s * 0.55, y - s * 0.22 + w, x - s * 0.55, y + s * 0.22 + w], k || shade(c, -0.25));
    eye(ctx, x + s * 0.18, y - s * 0.06, s);
  };
  S.frog = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.4, y - s * 0.1, s * 0.8, s * 0.42, c);
    disc(ctx, x - s * 0.22, y - s * 0.16, s * 0.14, c);
    disc(ctx, x + s * 0.22, y - s * 0.16, s * 0.14, c);
    eye(ctx, x - s * 0.24, y - s * 0.2, s);
    eye(ctx, x + s * 0.2, y - s * 0.2, s);
    px(ctx, x - s * 0.2, y + s * 0.12, s * 0.4, s * 0.05, k || shade(c, -0.4));
  };
  S.robot = function (ctx, x, y, s, c, k, t) {
    px(ctx, x - s * 0.32, y - s * 0.3, s * 0.64, s * 0.5, c);
    px(ctx, x - s * 0.04, y - s * 0.46, s * 0.08, s * 0.16, shade(c, -0.3));
    disc(ctx, x, y - s * 0.47, s * 0.06, Math.sin((t || 0) * 8) > 0 ? "#ff5a5a" : (k || "#ffd56b"));
    px(ctx, x - s * 0.2, y - s * 0.16, s * 0.12, s * 0.12, k || "#7fd6ff");
    px(ctx, x + s * 0.08, y - s * 0.16, s * 0.12, s * 0.12, k || "#7fd6ff");
    px(ctx, x - s * 0.26, y + s * 0.22, s * 0.52, s * 0.18, shade(c, -0.25));
  };
  S.ghost = function (ctx, x, y, s, c, k, t) {
    var b = Math.sin((t || 0) * 4) * s * 0.05;
    disc(ctx, x, y - s * 0.1 + b, s * 0.32, c);
    px(ctx, x - s * 0.32, y - s * 0.1 + b, s * 0.64, s * 0.4, c);
    for (var i = 0; i < 3; i++) poly(ctx, [x - s * 0.32 + i * s * 0.213, y + s * 0.3 + b, x - s * 0.32 + (i + 0.5) * s * 0.213, y + s * 0.42 + b, x - s * 0.32 + (i + 1) * s * 0.213, y + s * 0.3 + b], c);
    eye(ctx, x - s * 0.14, y - s * 0.12 + b, s);
    eye(ctx, x + s * 0.06, y - s * 0.12 + b, s);
  };
  S.bee = function (ctx, x, y, s, c, k, t) {
    var f = Math.sin((t || 0) * 30) > 0;
    disc(ctx, x - s * 0.08, y - s * 0.32, s * (f ? 0.16 : 0.12), "#e8f6ff");
    disc(ctx, x + s * 0.12, y - s * 0.32, s * (f ? 0.12 : 0.16), "#e8f6ff");
    disc(ctx, x, y, s * 0.3, c);
    px(ctx, x - s * 0.1, y - s * 0.28, s * 0.08, s * 0.56, k || "#141018");
    px(ctx, x + s * 0.08, y - s * 0.26, s * 0.08, s * 0.52, k || "#141018");
    eye(ctx, x + s * 0.2, y - s * 0.06, s);
  };
  S.slime = function (ctx, x, y, s, c, k, t) {
    var sq = Math.sin((t || 0) * 5) * s * 0.05;
    poly(ctx, [x - s * 0.42 - sq, y + s * 0.34, x - s * 0.3, y - s * 0.12 + sq, x, y - s * 0.3 + sq, x + s * 0.3, y - s * 0.12 + sq, x + s * 0.42 + sq, y + s * 0.34], c);
    px(ctx, x - s * 0.2, y - s * 0.12, s * 0.1, s * 0.06, "#ffffff");
    eye(ctx, x - s * 0.12, y + s * 0.04, s);
    eye(ctx, x + s * 0.1, y + s * 0.04, s);
  };
  S.person = function (ctx, x, y, s, c, k) {
    disc(ctx, x, y - s * 0.26, s * 0.16, k || "#e8b48f");
    px(ctx, x - s * 0.2, y - s * 0.1, s * 0.4, s * 0.3, c);
    px(ctx, x - s * 0.16, y + s * 0.2, s * 0.1, s * 0.22, shade(c, -0.4));
    px(ctx, x + s * 0.06, y + s * 0.2, s * 0.1, s * 0.22, shade(c, -0.4));
    eye(ctx, x - s * 0.08, y - s * 0.28, s);
    eye(ctx, x + s * 0.04, y - s * 0.28, s);
  };
  S.knight = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.2, y - s * 0.42, s * 0.4, s * 0.32, k || "#c9d1d9");
    px(ctx, x - s * 0.14, y - s * 0.3, s * 0.28, s * 0.05, "#141018");
    px(ctx, x - s * 0.24, y - s * 0.1, s * 0.48, s * 0.34, c);
    px(ctx, x - s * 0.18, y + s * 0.24, s * 0.12, s * 0.18, shade(c, -0.4));
    px(ctx, x + s * 0.06, y + s * 0.24, s * 0.12, s * 0.18, shade(c, -0.4));
    px(ctx, x + s * 0.28, y - s * 0.4, s * 0.06, s * 0.6, "#e6edf3");
  };
  S.ship = function (ctx, x, y, s, c, k) {
    poly(ctx, [x, y - s * 0.45, x + s * 0.36, y + s * 0.36, x, y + s * 0.18, x - s * 0.36, y + s * 0.36], c);
    px(ctx, x - s * 0.06, y - s * 0.12, s * 0.12, s * 0.16, k || "#7fd6ff");
  };
  S.rocket = function (ctx, x, y, s, c, k, t) {
    poly(ctx, [x, y - s * 0.48, x + s * 0.18, y - s * 0.16, x + s * 0.18, y + s * 0.26, x - s * 0.18, y + s * 0.26, x - s * 0.18, y - s * 0.16], c);
    poly(ctx, [x - s * 0.18, y + s * 0.06, x - s * 0.34, y + s * 0.3, x - s * 0.18, y + s * 0.26], k || "#ff5a5a");
    poly(ctx, [x + s * 0.18, y + s * 0.06, x + s * 0.34, y + s * 0.3, x + s * 0.18, y + s * 0.26], k || "#ff5a5a");
    disc(ctx, x, y - s * 0.12, s * 0.08, "#7fd6ff");
    var fl = 0.14 + Math.abs(Math.sin((t || 0) * 20)) * 0.12;
    poly(ctx, [x - s * 0.1, y + s * 0.26, x, y + s * (0.3 + fl), x + s * 0.1, y + s * 0.26], "#ffb02e");
  };
  S.ufo = function (ctx, x, y, s, c, k, t) {
    disc(ctx, x, y - s * 0.12, s * 0.2, k || "#7fd6ff");
    px(ctx, x - s * 0.44, y - s * 0.04, s * 0.88, s * 0.14, c);
    px(ctx, x - s * 0.3, y + s * 0.1, s * 0.6, s * 0.08, shade(c, -0.3));
    var l = Math.floor((t || 0) * 6) % 3;
    for (var i = 0; i < 3; i++) px(ctx, x - s * 0.3 + i * s * 0.26, y + s * 0.0, s * 0.08, s * 0.06, i === l ? "#ffd56b" : shade(c, 0.3));
  };
  S.car = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.45, y - s * 0.06, s * 0.9, s * 0.26, c);
    px(ctx, x - s * 0.24, y - s * 0.26, s * 0.46, s * 0.22, c);
    px(ctx, x - s * 0.18, y - s * 0.22, s * 0.16, s * 0.14, k || "#7fd6ff");
    px(ctx, x + s * 0.02, y - s * 0.22, s * 0.16, s * 0.14, k || "#7fd6ff");
    disc(ctx, x - s * 0.26, y + s * 0.22, s * 0.11, "#141018");
    disc(ctx, x + s * 0.26, y + s * 0.22, s * 0.11, "#141018");
  };
  S.boat = function (ctx, x, y, s, c, k) {
    poly(ctx, [x - s * 0.45, y + s * 0.05, x + s * 0.45, y + s * 0.05, x + s * 0.3, y + s * 0.3, x - s * 0.3, y + s * 0.3], c);
    px(ctx, x - s * 0.02, y - s * 0.45, s * 0.05, s * 0.5, "#6b4a34");
    poly(ctx, [x + s * 0.03, y - s * 0.42, x + s * 0.36, y, x + s * 0.03, y], k || "#f4efe6");
  };
  S.snail = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.44, y + s * 0.16, s * 0.84, s * 0.16, k || "#d8c49a");
    disc(ctx, x - s * 0.04, y - s * 0.02, s * 0.26, c);
    disc(ctx, x - s * 0.04, y - s * 0.02, s * 0.12, shade(c, -0.3));
    px(ctx, x + s * 0.32, y - s * 0.16, s * 0.04, s * 0.3, k || "#d8c49a");
    eye(ctx, x + s * 0.3, y - s * 0.2, s);
  };
  S.mouse = function (ctx, x, y, s, c, k) {
    disc(ctx, x, y + s * 0.04, s * 0.26, c);
    disc(ctx, x - s * 0.2, y - s * 0.2, s * 0.13, shade(c, 0.15));
    disc(ctx, x + s * 0.2, y - s * 0.2, s * 0.13, shade(c, 0.15));
    eye(ctx, x - s * 0.1, y, s);
    eye(ctx, x + s * 0.06, y, s);
    px(ctx, x + s * 0.24, y + s * 0.2, s * 0.24, s * 0.04, k || "#ff8fa3");
  };
  S.penguin = function (ctx, x, y, s, c, k) {
    disc(ctx, x, y, s * 0.32, c);
    disc(ctx, x, y + s * 0.06, s * 0.2, "#f4efe6");
    eye(ctx, x - s * 0.1, y - s * 0.14, s);
    eye(ctx, x + s * 0.06, y - s * 0.14, s);
    poly(ctx, [x - s * 0.05, y - s * 0.06, x + s * 0.05, y - s * 0.06, x, y + s * 0.02], k || "#ffb02e");
  };
  S.duck = function (ctx, x, y, s, c, k) {
    disc(ctx, x - s * 0.04, y + s * 0.08, s * 0.28, c);
    disc(ctx, x + s * 0.16, y - s * 0.18, s * 0.17, c);
    poly(ctx, [x + s * 0.3, y - s * 0.2, x + s * 0.48, y - s * 0.14, x + s * 0.3, y - s * 0.08], k || "#ff8a1f");
    eye(ctx, x + s * 0.18, y - s * 0.22, s);
  };

  // Items / pickups
  S.pizza = function (ctx, x, y, s, c, k) {
    poly(ctx, [x - s * 0.38, y - s * 0.3, x + s * 0.38, y - s * 0.3, x, y + s * 0.42], c || "#ffd56b");
    px(ctx, x - s * 0.4, y - s * 0.38, s * 0.8, s * 0.1, "#c98b42");
    disc(ctx, x - s * 0.12, y - s * 0.12, s * 0.07, k || "#e2574c");
    disc(ctx, x + s * 0.12, y - s * 0.1, s * 0.07, k || "#e2574c");
    disc(ctx, x, y + s * 0.1, s * 0.06, k || "#e2574c");
  };
  S.coin = function (ctx, x, y, s, c, k, t) {
    var w = Math.abs(Math.cos((t || 0) * 4));
    ctx.fillStyle = c || "#ffd56b";
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(1, s * 0.3 * w), s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    px(ctx, x - s * 0.03, y - s * 0.16, s * 0.06, s * 0.32, k || shade(c || "#ffd56b", -0.3));
  };
  S.gem = function (ctx, x, y, s, c, k) {
    poly(ctx, [x - s * 0.3, y - s * 0.1, x - s * 0.14, y - s * 0.3, x + s * 0.14, y - s * 0.3, x + s * 0.3, y - s * 0.1, x, y + s * 0.34], c || "#7fd6ff");
    poly(ctx, [x - s * 0.14, y - s * 0.3, x, y - s * 0.1, x - s * 0.3, y - s * 0.1], k || shade(c || "#7fd6ff", 0.35));
  };
  S.star = function (ctx, x, y, s, c) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? s * 0.45 : s * 0.2;
      var a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    poly(ctx, pts, c || "#ffd56b");
  };
  S.heart = function (ctx, x, y, s, c) {
    disc(ctx, x - s * 0.15, y - s * 0.1, s * 0.18, c || "#ff5a7a");
    disc(ctx, x + s * 0.15, y - s * 0.1, s * 0.18, c || "#ff5a7a");
    poly(ctx, [x - s * 0.32, y - s * 0.04, x + s * 0.32, y - s * 0.04, x, y + s * 0.36], c || "#ff5a7a");
  };
  S.letter = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.38, y - s * 0.24, s * 0.76, s * 0.48, c || "#f4efe6");
    poly(ctx, [x - s * 0.38, y - s * 0.24, x + s * 0.38, y - s * 0.24, x, y + s * 0.06], k || shade(c || "#f4efe6", -0.2));
    disc(ctx, x, y + s * 0.02, s * 0.06, "#e2574c");
  };
  S.box = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.34, y - s * 0.3, s * 0.68, s * 0.6, c || "#c98b42");
    px(ctx, x - s * 0.04, y - s * 0.3, s * 0.08, s * 0.6, k || shade(c || "#c98b42", -0.3));
    px(ctx, x - s * 0.34, y - s * 0.04, s * 0.68, s * 0.08, k || shade(c || "#c98b42", -0.3));
  };
  S.cake = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.36, y - s * 0.06, s * 0.72, s * 0.36, c || "#ffc8a8");
    px(ctx, x - s * 0.36, y - s * 0.14, s * 0.72, s * 0.1, k || "#f4efe6");
    px(ctx, x - s * 0.03, y - s * 0.36, s * 0.06, s * 0.22, "#7fd6ff");
    disc(ctx, x, y - s * 0.4, s * 0.06, "#ffb02e");
  };
  S.apple = function (ctx, x, y, s, c, k) {
    disc(ctx, x, y + s * 0.04, s * 0.3, c || "#e2574c");
    px(ctx, x - s * 0.02, y - s * 0.38, s * 0.05, s * 0.16, "#6b4a34");
    poly(ctx, [x + s * 0.03, y - s * 0.3, x + s * 0.24, y - s * 0.38, x + s * 0.1, y - s * 0.22], k || "#7ac74f");
  };
  S.carrot = function (ctx, x, y, s, c, k) {
    poly(ctx, [x - s * 0.14, y - s * 0.24, x + s * 0.14, y - s * 0.24, x, y + s * 0.42], c || "#ff8a1f");
    poly(ctx, [x - s * 0.12, y - s * 0.24, x, y - s * 0.46, x + s * 0.12, y - s * 0.24], k || "#7ac74f");
  };
  S.donut = function (ctx, x, y, s, c, k) {
    disc(ctx, x, y, s * 0.34, c || "#ff8fc7");
    disc(ctx, x, y, s * 0.12, k || "#141018");
  };
  S.cookie = function (ctx, x, y, s, c, k) {
    disc(ctx, x, y, s * 0.34, c || "#d39b5a");
    disc(ctx, x - s * 0.12, y - s * 0.08, s * 0.05, k || "#4a2c1d");
    disc(ctx, x + s * 0.1, y - s * 0.12, s * 0.05, k || "#4a2c1d");
    disc(ctx, x + s * 0.04, y + s * 0.12, s * 0.05, k || "#4a2c1d");
  };
  S.flower = function (ctx, x, y, s, c, k) {
    for (var i = 0; i < 5; i++) {
      var a = (i * Math.PI * 2) / 5;
      disc(ctx, x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.2, s * 0.15, c || "#ff8fc7");
    }
    disc(ctx, x, y, s * 0.12, k || "#ffd56b");
  };
  S.key = function (ctx, x, y, s, c) {
    disc(ctx, x - s * 0.2, y, s * 0.16, c || "#ffd56b");
    px(ctx, x - s * 0.08, y - s * 0.04, s * 0.5, s * 0.08, c || "#ffd56b");
    px(ctx, x + s * 0.3, y, s * 0.06, s * 0.14, c || "#ffd56b");
    disc(ctx, x - s * 0.2, y, s * 0.06, "#141018");
  };
  S.mushroom = function (ctx, x, y, s, c, k) {
    poly(ctx, [x - s * 0.4, y, x - s * 0.3, y - s * 0.3, x, y - s * 0.4, x + s * 0.3, y - s * 0.3, x + s * 0.4, y], c || "#e2574c");
    px(ctx, x - s * 0.12, y, s * 0.24, s * 0.34, k || "#f4efe6");
    disc(ctx, x - s * 0.16, y - s * 0.18, s * 0.06, "#f4efe6");
    disc(ctx, x + s * 0.14, y - s * 0.2, s * 0.06, "#f4efe6");
  };
  S.bone = function (ctx, x, y, s, c) {
    px(ctx, x - s * 0.26, y - s * 0.06, s * 0.52, s * 0.12, c || "#f4efe6");
    disc(ctx, x - s * 0.3, y - s * 0.08, s * 0.08, c || "#f4efe6");
    disc(ctx, x - s * 0.3, y + s * 0.08, s * 0.08, c || "#f4efe6");
    disc(ctx, x + s * 0.3, y - s * 0.08, s * 0.08, c || "#f4efe6");
    disc(ctx, x + s * 0.3, y + s * 0.08, s * 0.08, c || "#f4efe6");
  };
  S.cup = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.24, y - s * 0.2, s * 0.4, s * 0.44, c || "#f4efe6");
    px(ctx, x + s * 0.16, y - s * 0.1, s * 0.12, s * 0.06, c || "#f4efe6");
    px(ctx, x + s * 0.24, y - s * 0.1, s * 0.05, s * 0.2, c || "#f4efe6");
    px(ctx, x - s * 0.2, y - s * 0.16, s * 0.32, s * 0.08, k || "#6b4a34");
  };
  S.note = function (ctx, x, y, s, c) {
    disc(ctx, x - s * 0.1, y + s * 0.2, s * 0.14, c || "#141018");
    px(ctx, x + s * 0.02, y - s * 0.34, s * 0.06, s * 0.56, c || "#141018");
    px(ctx, x + s * 0.02, y - s * 0.34, s * 0.24, s * 0.08, c || "#141018");
  };
  S.drop = function (ctx, x, y, s, c) {
    poly(ctx, [x, y - s * 0.4, x + s * 0.22, y, x - s * 0.22, y], c || "#7fd6ff");
    disc(ctx, x, y + s * 0.06, s * 0.22, c || "#7fd6ff");
  };
  S.leaf = function (ctx, x, y, s, c) {
    poly(ctx, [x - s * 0.36, y + s * 0.2, x - s * 0.1, y - s * 0.34, x + s * 0.36, y - s * 0.2, x + s * 0.1, y + s * 0.34], c || "#7ac74f");
  };
  S.battery = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.18, y - s * 0.32, s * 0.36, s * 0.64, k || "#3a3a46");
    px(ctx, x - s * 0.06, y - s * 0.4, s * 0.12, s * 0.08, k || "#3a3a46");
    px(ctx, x - s * 0.12, y - s * 0.02, s * 0.24, s * 0.28, c || "#a6e36b");
  };
  S.sock = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.12, y - s * 0.38, s * 0.24, s * 0.5, c || "#ff8fc7");
    px(ctx, x - s * 0.12, y + s * 0.06, s * 0.44, s * 0.22, c || "#ff8fc7");
    px(ctx, x - s * 0.12, y - s * 0.38, s * 0.24, s * 0.08, k || "#f4efe6");
  };

  // Hazards
  S.rock = function (ctx, x, y, s, c, k) {
    poly(ctx, [x - s * 0.4, y + s * 0.3, x - s * 0.3, y - s * 0.16, x - s * 0.04, y - s * 0.36, x + s * 0.32, y - s * 0.2, x + s * 0.42, y + s * 0.3], c || "#6f6a7d");
    px(ctx, x - s * 0.1, y - s * 0.18, s * 0.14, s * 0.06, k || shade(c || "#6f6a7d", 0.3));
  };
  S.spike = function (ctx, x, y, s, c) {
    poly(ctx, [x - s * 0.4, y + s * 0.36, x - s * 0.2, y - s * 0.36, x, y + s * 0.36], c || "#c9d1d9");
    poly(ctx, [x, y + s * 0.36, x + s * 0.2, y - s * 0.36, x + s * 0.4, y + s * 0.36], c || "#c9d1d9");
  };
  S.cloud = function (ctx, x, y, s, c) {
    disc(ctx, x - s * 0.2, y + s * 0.04, s * 0.2, c || "#c9d1d9");
    disc(ctx, x + s * 0.04, y - s * 0.08, s * 0.26, c || "#c9d1d9");
    disc(ctx, x + s * 0.26, y + s * 0.06, s * 0.18, c || "#c9d1d9");
    px(ctx, x - s * 0.2, y + s * 0.04, s * 0.46, s * 0.2, c || "#c9d1d9");
  };
  S.bolt = function (ctx, x, y, s, c) {
    poly(ctx, [x + s * 0.08, y - s * 0.46, x - s * 0.24, y + s * 0.06, x - s * 0.02, y + s * 0.06, x - s * 0.1, y + s * 0.46, x + s * 0.24, y - s * 0.08, x + s * 0.02, y - s * 0.08], c || "#ffd56b");
  };
  S.fire = function (ctx, x, y, s, c, k, t) {
    var f = Math.sin((t || 0) * 16) * s * 0.06;
    poly(ctx, [x - s * 0.3, y + s * 0.36, x - s * 0.24, y - s * 0.06, x - s * 0.06 + f, y - s * 0.44, x + s * 0.1, y - s * 0.12, x + s * 0.2 - f, y - s * 0.3, x + s * 0.3, y + s * 0.36], c || "#ff6a2a");
    poly(ctx, [x - s * 0.14, y + s * 0.36, x - s * 0.06, y + s * 0.02, x + s * 0.04 + f, y - s * 0.12, x + s * 0.14, y + s * 0.36], k || "#ffd56b");
  };
  S.bomb = function (ctx, x, y, s, c, k, t) {
    disc(ctx, x, y + s * 0.06, s * 0.3, c || "#2a2733");
    px(ctx, x + s * 0.1, y - s * 0.34, s * 0.06, s * 0.16, "#c9d1d9");
    disc(ctx, x + s * 0.14, y - s * 0.38, s * 0.07, Math.sin((t || 0) * 20) > 0 ? "#ffd56b" : "#ff6a2a");
    px(ctx, x - s * 0.14, y - s * 0.06, s * 0.08, s * 0.08, k || "#6f6a7d");
  };
  S.saw = function (ctx, x, y, s, c, k, t) {
    var a0 = (t || 0) * 8;
    var pts = [];
    for (var i = 0; i < 16; i++) {
      var r = i % 2 === 0 ? s * 0.44 : s * 0.3;
      var a = a0 + (i * Math.PI) / 8;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    poly(ctx, pts, c || "#c9d1d9");
    disc(ctx, x, y, s * 0.1, k || "#6f6a7d");
  };
  S.crab = function (ctx, x, y, s, c, k) {
    px(ctx, x - s * 0.3, y - s * 0.1, s * 0.6, s * 0.3, c || "#e2574c");
    disc(ctx, x - s * 0.4, y - s * 0.26, s * 0.12, c || "#e2574c");
    disc(ctx, x + s * 0.4, y - s * 0.26, s * 0.12, c || "#e2574c");
    eye(ctx, x - s * 0.12, y - s * 0.06, s);
    eye(ctx, x + s * 0.06, y - s * 0.06, s);
    px(ctx, x - s * 0.34, y + s * 0.2, s * 0.68, s * 0.06, k || shade(c || "#e2574c", -0.3));
  };
  S.wasp = function (ctx, x, y, s, c, k, t) { S.bee(ctx, x, y, s, c || "#ffb02e", k || "#141018", t); };
  S.bat = function (ctx, x, y, s, c, k, t) {
    var f = Math.sin((t || 0) * 18) > 0 ? 1 : -1;
    disc(ctx, x, y, s * 0.16, c || "#4b3b63");
    poly(ctx, [x - s * 0.1, y, x - s * 0.48, y - s * 0.24 * f, x - s * 0.3, y + s * 0.12], c || "#4b3b63");
    poly(ctx, [x + s * 0.1, y, x + s * 0.48, y - s * 0.24 * f, x + s * 0.3, y + s * 0.12], c || "#4b3b63");
    px(ctx, x - s * 0.08, y - s * 0.04, s * 0.05, s * 0.05, k || "#ff5a5a");
    px(ctx, x + s * 0.04, y - s * 0.04, s * 0.05, s * 0.05, k || "#ff5a5a");
  };
  S.puddle = function (ctx, x, y, s, c) {
    ctx.fillStyle = c || "#4aa3df";
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.2, s * 0.44, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  S.tornado = function (ctx, x, y, s, c, k, t) {
    for (var i = 0; i < 5; i++) {
      var w = s * (0.44 - i * 0.07);
      var off = Math.sin((t || 0) * 6 + i) * s * 0.06;
      px(ctx, x - w + off, y - s * 0.4 + i * s * 0.17, w * 2, s * 0.12, i % 2 ? (c || "#9aa3b5") : shade(c || "#9aa3b5", 0.2));
    }
  };
  S.alarm = function (ctx, x, y, s, c, k, t) {
    disc(ctx, x, y + s * 0.04, s * 0.3, c || "#e2574c");
    disc(ctx, x, y + s * 0.04, s * 0.22, "#f4efe6");
    px(ctx, x - s * 0.02, y - s * 0.12, s * 0.04, s * 0.16, "#141018");
    var j = Math.sin((t || 0) * 30) * s * 0.03;
    disc(ctx, x - s * 0.22 + j, y - s * 0.28, s * 0.09, k || "#ffd56b");
    disc(ctx, x + s * 0.22 - j, y - s * 0.28, s * 0.09, k || "#ffd56b");
  };

  function shade(hex, amt) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return hex;
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(v) {
      v = amt < 0 ? v * (1 + amt) : v + (255 - v) * amt;
      return Math.max(0, Math.min(255, Math.round(v)));
    }
    return "#" + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  }

  function drawShape(ctx, name, x, y, size, color, detail, t) {
    var fn = S[name] || S.blob;
    fn(ctx, x, y, size, color, detail, t || 0);
  }

  root.PIXELKIT = {
    glyphs: G,
    textWidth: textWidth,
    drawText: drawText,
    wrapText: wrapText,
    shapes: S,
    shapeNames: Object.keys(S),
    drawShape: drawShape,
    shade: shade,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
