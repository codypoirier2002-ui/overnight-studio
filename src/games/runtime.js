/* Overnight Game Studio runtime. Injected into every sandboxed game frame.
 * Gives games a 320x240 pixel canvas, keyboard + touch input, a title and
 * game-over flow, score/best, particles, screen shake, synth sounds and a
 * few helpers. Games call OGS.game({...}). See runtime-api.md. */
(function () {
  "use strict";
  var W = 320, H = 240;
  var K = window.PIXELKIT;
  var CFG = window.CFG || {};
  var PAL = CFG.pal || { bg: "#1b1528", bg2: "#30253f", hero: "#ffd56b", accent: "#7fd6c2", danger: "#ff5a5a", text: "#f4efe6" };
  var TEST = !!CFG.test;
  var CONTROLS = { lr: 1, "4way": 1, tap: 1, "lr+a": 1, "4way+a": 1 };

  var canvas, ctx, game = null, state = null, phase = "boot", time = 0, runTime = 0, frames = 0;
  var score = 0, best = Number(CFG.best) || 0, endMsg = "", won = false, endAt = 0;
  var errors = [], crashed = null;
  var particles = [], shakeT = 0, shakeMag = 0, flashT = 0, flashCol = "#ffffff";
  var muted = CFG.sound === false;
  var keys = {}, prevKeys = {};
  var pointer = { x: 0, y: 0, down: false, pressed: false };
  var touchHeld = {};
  var rngState = (Number(CFG.seed) >>> 0) || 1234567;

  // Loop guard: AI-written code has every loop condition wrapped in __ogsLoop()
  // (see loopguard.ts), so a runaway loop throws instead of freezing the page.
  var loopCount = 0;
  window.__ogsLoop = function () {
    if (++loopCount > 3000000) {
      loopCount = 0;
      throw new Error("Infinite loop stopped: a loop ran 3 million times in one frame");
    }
    return true;
  };

  function post(msg) {
    try {
      parent.postMessage(msg, "*");
    } catch (e) {}
  }

  function reportError(msg) {
    msg = String(msg || "Unknown error").slice(0, 300);
    if (errors.indexOf(msg) < 0 && errors.length < 20) errors.push(msg);
    post({ type: "ogs:error", message: msg });
  }

  window.addEventListener("error", function (e) {
    var start = Number(CFG.codeLine) || 0;
    var where = e && e.lineno ? (start && e.lineno >= start ? " (game code line " + (e.lineno - start + 1) + ")" : " (line " + e.lineno + ")") : "";
    reportError((e && e.message ? e.message : "Script error") + where);
  });
  window.addEventListener("unhandledrejection", function (e) {
    reportError("Unhandled promise rejection: " + (e && e.reason && e.reason.message ? e.reason.message : e && e.reason));
  });

  // ---------- helpers ----------
  function rand(a, b) {
    rngState ^= rngState << 13;
    rngState ^= rngState >>> 17;
    rngState ^= rngState << 5;
    var r = ((rngState >>> 0) % 1000000) / 1000000;
    if (a === undefined) return r;
    if (b === undefined) return r * a;
    return a + r * (b - a);
  }
  function randInt(a, b) {
    return Math.floor(rand(a, b + 1));
  }
  function pick(arr) {
    return arr[Math.floor(rand() * arr.length)];
  }
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function dist(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function hitRect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function hitCircle(a, b) {
    return dist(a.x, a.y, b.x, b.y) < (a.r || 0) + (b.r || 0);
  }

  // ---------- sound ----------
  var audio = null;
  function ensureAudio() {
    if (audio || muted || TEST) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audio = new AC();
    } catch (e) {
      audio = null;
    }
  }
  var SFX = {
    jump: [["square", 320, 640, 0.12, 0.12]],
    coin: [["square", 880, 880, 0.06, 0.1], ["square", 1320, 1320, 0.1, 0.1, 0.06]],
    hit: [["sawtooth", 220, 60, 0.2, 0.16]],
    boom: [["noise", 0, 0, 0.3, 0.22]],
    shoot: [["square", 900, 300, 0.08, 0.08]],
    blip: [["triangle", 660, 660, 0.05, 0.12]],
    powerup: [["square", 400, 1200, 0.25, 0.1]],
    win: [["square", 523, 523, 0.1, 0.12], ["square", 659, 659, 0.1, 0.12, 0.1], ["square", 784, 784, 0.1, 0.12, 0.2], ["square", 1046, 1046, 0.25, 0.12, 0.3]],
    lose: [["square", 392, 392, 0.12, 0.12], ["square", 330, 330, 0.12, 0.12, 0.12], ["square", 262, 200, 0.3, 0.12, 0.24]],
    start: [["triangle", 523, 1046, 0.15, 0.12]],
  };
  function sfx(name) {
    if (muted || TEST || !audio) return;
    var parts = SFX[name] || SFX.blip;
    var now = audio.currentTime;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var t0 = now + (p[5] || 0);
      var gain = audio.createGain();
      gain.gain.setValueAtTime(p[4], t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + p[3]);
      gain.connect(audio.destination);
      if (p[0] === "noise") {
        var len = Math.floor(audio.sampleRate * p[3]);
        var buf = audio.createBuffer(1, len, audio.sampleRate);
        var d = buf.getChannelData(0);
        for (var j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
        var src = audio.createBufferSource();
        src.buffer = buf;
        src.connect(gain);
        src.start(t0);
      } else {
        var o = audio.createOscillator();
        o.type = p[0];
        o.frequency.setValueAtTime(p[1], t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, p[2]), t0 + p[3]);
        o.connect(gain);
        o.start(t0);
        o.stop(t0 + p[3] + 0.02);
      }
    }
  }

  // ---------- particles / juice ----------
  function burst(x, y, color, n, speed) {
    n = Math.min(n || 10, 40);
    speed = speed || 80;
    for (var i = 0; i < n && particles.length < 300; i++) {
      var a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life: rand(0.3, 0.7), c: color || PAL.accent });
    }
  }
  function shake(mag, t) {
    shakeMag = Math.max(shakeMag, mag || 3);
    shakeT = Math.max(shakeT, t || 0.25);
  }
  function flash(color, t) {
    flashCol = color || "#ffffff";
    flashT = t || 0.1;
  }

  // ---------- weather / darkness helpers for games ----------
  var drops = null;
  function weather(g, kind, wind) {
    if (!kind || kind === "clear") return;
    if (!drops) {
      drops = [];
      for (var i = 0; i < 70; i++) drops.push({ x: rand(0, W), y: rand(0, H), v: rand(0.6, 1) });
    }
    var snow = kind === "snow";
    var w = wind || 0;
    ctx.fillStyle = snow ? "rgba(255,255,255,0.8)" : "rgba(170,200,255,0.55)";
    for (var j = 0; j < drops.length; j++) {
      var d = drops[j];
      d.y += (snow ? 30 : 260) * d.v / 60;
      d.x += (w * 90 + (snow ? Math.sin(time * 2 + j) * 12 : -30)) / 60;
      if (d.y > H) { d.y = -4; d.x = rand(0, W); }
      if (d.x < -4) d.x += W + 8;
      if (d.x > W + 4) d.x -= W + 8;
      if (snow) ctx.fillRect(d.x | 0, d.y | 0, 2, 2);
      else ctx.fillRect(d.x | 0, d.y | 0, 1, 5);
    }
    if (kind === "storm" && rand() < 0.004) flash("#ffffff", 0.08);
  }
  function darkness(g, x, y, r, alpha) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0," + (alpha === undefined ? 0.82 : alpha) + ")";
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(x, y, r, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
  }

  // ---------- drawing API ----------
  var g = {
    get ctx() {
      return ctx;
    },
    get t() {
      return time;
    },
    W: W,
    H: H,
    clear: function (c) {
      ctx.fillStyle = c || PAL.bg;
      ctx.fillRect(0, 0, W, H);
    },
    rect: function (x, y, w, h, c) {
      ctx.fillStyle = c || PAL.text;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    },
    circle: function (x, y, r, c) {
      ctx.fillStyle = c || PAL.text;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
    },
    line: function (x1, y1, x2, y2, c, w) {
      ctx.strokeStyle = c || PAL.text;
      ctx.lineWidth = w || 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    text: function (str, x, y, c, scale, align) {
      return K.drawText(ctx, str, x, y, c || PAL.text, scale || 1, align || "left");
    },
    textWidth: function (str, scale) {
      return K.textWidth(str, scale || 1);
    },
    sprite: function (name, x, y, size, c, detail) {
      K.drawShape(ctx, name, x, y, size, c || PAL.hero, detail, time);
    },
    shade: function (hex, amt) {
      return K.shade(hex, amt);
    },
    weather: function (kind, wind) {
      weather(g, kind, wind);
    },
    darkness: function (x, y, r, alpha) {
      darkness(g, x, y, r, alpha);
    },
  };

  // ---------- input ----------
  var KEYMAP = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    Space: "a", KeyZ: "a", KeyJ: "a", Enter: "a", KeyX: "b", KeyK: "b", ShiftLeft: "b", ShiftRight: "b",
  };
  function setKey(code, down) {
    var k = KEYMAP[code];
    if (!k) return false;
    keys[k] = down;
    if (down) ensureAudio();
    return true;
  }
  window.addEventListener("keydown", function (e) {
    if (setKey(e.code, true)) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) {
    if (setKey(e.code, false)) e.preventDefault();
  });
  window.addEventListener("blur", function () {
    keys = {};
  });
  window.addEventListener("message", function (e) {
    if (e.source !== parent || !e.data || typeof e.data !== "object") return;
    if (e.data.type === "ogs:key") setKey(e.data.code, !!e.data.down);
    else if (e.data.type === "ogs:mute") {
      muted = !!e.data.muted;
      if (!muted) ensureAudio();
    } else if (e.data.type === "ogs:release") keys = {};
  });

  function input() {
    var held = {};
    var names = ["left", "right", "up", "down", "a", "b"];
    for (var i = 0; i < names.length; i++) held[names[i]] = !!(keys[names[i]] || touchHeld[names[i]]);
    var pressed = {};
    for (var j = 0; j < names.length; j++) pressed[names[j]] = held[names[j]] && !prevKeys[names[j]];
    return { held: held, pressed: pressed };
  }

  // ---------- touch controls ----------
  function isTouch() {
    return ("ontouchstart" in window) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  }
  function buildTouch(controls) {
    var bar = document.getElementById("ogs-pad");
    if (!bar) return;
    bar.innerHTML = "";
    var four = controls.indexOf("4way") === 0;
    var lr = controls.indexOf("lr") === 0;
    var hasA = controls === "tap" || controls.indexOf("+a") > 0;
    var left = document.createElement("div");
    left.className = "pad-dirs" + (four ? " four" : "");
    var dirs = four ? ["up", "left", "right", "down"] : lr ? ["left", "right"] : [];
    var labels = { up: "▲", down: "▼", left: "◀", right: "▶" };
    dirs.forEach(function (d) {
      var b = document.createElement("button");
      b.className = "pad-btn pad-" + d;
      b.setAttribute("aria-label", d);
      b.textContent = labels[d];
      bindHold(b, d);
      left.appendChild(b);
    });
    bar.appendChild(left);
    if (hasA) {
      var a = document.createElement("button");
      a.className = "pad-btn pad-a" + (controls === "tap" ? " wide" : "");
      a.textContent = controls === "tap" ? "TAP" : "A";
      bindHold(a, "a");
      bar.appendChild(a);
    }
  }
  function bindHold(el, name) {
    function on(e) {
      e.preventDefault();
      touchHeld[name] = true;
      el.classList.add("down");
      ensureAudio();
    }
    function off(e) {
      if (e) e.preventDefault();
      touchHeld[name] = false;
      el.classList.remove("down");
    }
    el.addEventListener("pointerdown", function (e) {
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      on(e);
    });
    el.addEventListener("pointerup", off);
    el.addEventListener("pointercancel", off);
    el.addEventListener("lostpointercapture", function () { off(); });
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  // ---------- flow ----------
  var api = {
    W: W, H: H, PAL: PAL, CFG: CFG,
    rand: rand, randInt: randInt, pick: pick, clamp: clamp, lerp: lerp, dist: dist, hitRect: hitRect, hitCircle: hitCircle,
    sfx: function (n) { sfx(n); },
    burst: burst, shake: shake, flash: flash,
    get time() { return runTime; },
    get score() { return score; },
    setScore: function (n) { score = Math.max(0, Math.floor(Number(n) || 0)); },
    addScore: function (n) { score = Math.max(0, score + Math.floor(Number(n) || 0)); },
    win: function (msg) { end(true, msg); },
    lose: function (msg) { end(false, msg); },
    game: function (def) {
      if (!def || typeof def.update !== "function" || typeof def.draw !== "function") {
        reportError("OGS.game() needs an object with update() and draw() functions");
        return;
      }
      game = def;
      if (!CONTROLS[def.controls]) def.controls = "4way+a";
      post({ type: "ogs:registered", controls: def.controls });
    },
  };
  window.OGS = api;
  window.W = W;
  window.H = H;
  window.PAL = PAL;
  window.K = K;

  function end(isWin, msg) {
    if (phase !== "play") return;
    phase = "over";
    won = !!isWin;
    endMsg = String(msg || (isWin ? "YOU WIN!" : "GAME OVER")).slice(0, 40);
    endAt = time;
    if (score > best) {
      best = score;
      post({ type: "ogs:best", score: best });
    }
    sfx(isWin ? "win" : "lose");
    post({ type: "ogs:end", win: won, score: score });
  }

  function safe(fn, label) {
    try {
      return fn();
    } catch (e) {
      crashed = label + ": " + (e && e.message ? e.message : String(e));
      reportError(crashed);
      phase = "crash";
      return undefined;
    }
  }

  function startRun() {
    loopCount = 0;
    state = {};
    score = 0;
    runTime = 0;
    particles = [];
    shakeT = 0;
    drops = null;
    phase = "play";
    if (game.init) safe(function () { game.init(state); }, "init");
    sfx("start");
  }

  function step(dt) {
    loopCount = 0;
    time += dt;
    frames++;
    var inp = input();
    var anyPress = inp.pressed.a || inp.pressed.b || pointer.pressed;
    if (phase === "title") {
      var anyKey = anyPress || inp.pressed.left || inp.pressed.right || inp.pressed.up || inp.pressed.down;
      if (game && anyKey) startRun();
    } else if (phase === "over") {
      if ((anyPress) && time - endAt > 0.6) startRun();
    } else if (phase === "play") {
      runTime += dt;
      var gi = {
        left: inp.held.left, right: inp.held.right, up: inp.held.up, down: inp.held.down, a: inp.held.a, b: inp.held.b,
        pressed: inp.pressed,
        pointer: { x: pointer.x, y: pointer.y, down: pointer.down, pressed: pointer.pressed },
      };
      if (game.controls === "tap" && pointer.pressed) {
        gi.a = true;
        gi.pressed = Object.assign({}, gi.pressed, { a: true });
      }
      safe(function () { game.update(state, dt, gi); }, "update");
    }
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (shakeT > 0) shakeT -= dt;
    if (flashT > 0) flashT -= dt;
    prevKeys = inp.held;
    pointer.pressed = false;
  }

  function render() {
    loopCount = 0;
    ctx.save();
    if (shakeT > 0) ctx.translate(Math.round(rand(-shakeMag, shakeMag)), Math.round(rand(-shakeMag, shakeMag)));
    if (phase === "crash") {
      drawCrash();
      ctx.restore();
      return;
    }
    if (!game) {
      g.clear("#000");
      g.text("NO CARTRIDGE", W / 2, H / 2 - 4, "#ff5a5a", 2, "center");
      ctx.restore();
      return;
    }
    if (phase === "title" || !state) {
      drawTitle();
    } else {
      ctx.fillStyle = PAL.bg;
      ctx.fillRect(-8, -8, W + 16, H + 16);
      safe(function () { game.draw(state, g); }, "draw");
      if (phase === "crash") {
        ctx.restore();
        drawCrash();
        return;
      }
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
      }
      if (game.hud !== false) {
        g.text("SCORE " + score, 5, 5, "#000000", 1);
        g.text("SCORE " + score, 4, 4, PAL.text, 1);
      }
      if (phase === "over") drawOver();
    }
    ctx.restore();
    if (flashT > 0) {
      ctx.globalAlpha = Math.min(1, flashT * 6);
      ctx.fillStyle = flashCol;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  var CONTROL_TEXT = {
    lr: "LEFT / RIGHT TO MOVE",
    "4way": "ARROWS TO MOVE",
    tap: "SPACE OR TAP",
    "lr+a": "LEFT/RIGHT + SPACE",
    "4way+a": "ARROWS + SPACE",
  };

  function drawTitle() {
    g.clear(PAL.bg);
    for (var i = 0; i < 24; i++) {
      var sx = (i * 53 + time * 6) % W;
      var sy = (i * 97) % (H - 40);
      ctx.fillStyle = i % 3 ? PAL.bg2 : PAL.accent;
      ctx.fillRect(sx | 0, sy | 0, 2, 2);
    }
    g.rect(0, H - 34, W, 34, PAL.bg2);
    var heroShape = (CFG.params && CFG.params.hero) || (game && game.icon) || "star";
    g.sprite(heroShape, W / 2, 112 + Math.sin(time * 3) * 4, 44, PAL.hero);
    var title = String((game && game.title) || CFG.title || "UNTITLED").toUpperCase();
    var lines = K.wrapText(title, W - 24, 3);
    var scale = lines.length > 2 ? 2 : 3;
    lines = K.wrapText(title, W - 24, scale).slice(0, 3);
    for (var j = 0; j < lines.length; j++) {
      g.text(lines[j], W / 2 + 1, 22 + j * (scale * 7) + 1, "#000000", scale, "center");
      g.text(lines[j], W / 2, 22 + j * (scale * 7), PAL.text, scale, "center");
    }
    if (Math.floor(time * 2) % 2 === 0) g.text("PRESS SPACE OR TAP TO START", W / 2, 160, PAL.accent, 1, "center");
    g.text(CONTROL_TEXT[game ? game.controls : "4way+a"] || "", W / 2, 174, PAL.text, 1, "center");
    if (best > 0) g.text("BEST " + best, W / 2, H - 20, PAL.text, 1, "center");
  }

  function drawOver() {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 70, W, 100);
    g.text(endMsg, W / 2, 86, won ? PAL.accent : PAL.danger, 2, "center");
    g.text("SCORE " + score + (score >= best && score > 0 ? "  NEW BEST!" : "  BEST " + best), W / 2, 112, PAL.text, 1, "center");
    if (time - endAt > 0.6 && Math.floor(time * 2) % 2 === 0) g.text("SPACE OR TAP TO PLAY AGAIN", W / 2, 140, PAL.text, 1, "center");
  }

  function drawCrash() {
    g.clear("#1a0f14");
    g.text("CARTRIDGE ERROR", W / 2, 70, "#ff5a5a", 2, "center");
    var lines = K.wrapText(String(crashed || errors[0] || "Unknown error").toUpperCase(), W - 30, 1).slice(0, 6);
    for (var i = 0; i < lines.length; i++) g.text(lines[i], W / 2, 100 + i * 8, "#f4efe6", 1, "center");
    g.text("THE TEAM HAS BEEN NOTIFIED", W / 2, 170, "#9a8cab", 1, "center");
  }

  // ---------- boot ----------
  var lastT = 0, rafId = 0;
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    var dt = lastT ? Math.min(1 / 30, (now - lastT) / 1000) : 1 / 60;
    lastT = now;
    step(dt);
    render();
  }

  function setup() {
    canvas = document.getElementById("ogs-canvas");
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    canvas.addEventListener("pointerdown", function (e) {
      var p = canvasPoint(e);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.down = true;
      pointer.pressed = true;
      ensureAudio();
    });
    canvas.addEventListener("pointermove", function (e) {
      var p = canvasPoint(e);
      pointer.x = p.x;
      pointer.y = p.y;
    });
    window.addEventListener("pointerup", function () { pointer.down = false; });
    document.addEventListener("visibilitychange", function () { lastT = 0; keys = {}; });
  }

  api.__boot = function () {
    setup();
    phase = "title";
    if (!game) {
      reportError(errors.length ? errors[0] : "The game never called OGS.game()");
    }
    var controls = game ? game.controls : "4way+a";
    var showPad = isTouch() || CFG.forcePad;
    document.body.classList.toggle("has-pad", !!showPad);
    if (showPad) buildTouch(controls);
    if (TEST) return;
    post({ type: "ogs:ready", ok: !!game && !errors.length });
    rafId = requestAnimationFrame(loop);
  };

  // Hooks for the automated playtester (only used when CFG.test is set).
  api.__test = {
    hasGame: function () { return !!game; },
    controls: function () { return game ? game.controls : null; },
    errors: function () { return errors.slice(); },
    phase: function () { return phase; },
    start: function () { keys = {}; prevKeys = {}; touchHeld = {}; startRun(); },
    title: function () { phase = "title"; },
    setKeys: function (k) { keys = k || {}; },
    tap: function (x, y) { pointer.x = x; pointer.y = y; pointer.pressed = true; },
    step: function (dt) { step(dt); },
    render: function () { render(); },
    ctx: function () { return ctx; },
    score: function () { return score; },
    runTime: function () { return runTime; },
    seed: function (s) { rngState = (s >>> 0) || 1; },
  };
})();
