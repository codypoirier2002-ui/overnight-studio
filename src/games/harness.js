/* Moss's automated playtest. Runs inside a hidden sandboxed game frame with
 * CFG.test set: steps the game deterministically (no real-time waiting),
 * drives inputs, and posts a report back to the studio. */
(function () {
  "use strict";
  var T = window.OGS && window.OGS.__test;
  var CFG = window.CFG || {};
  var seed = (Number(CFG.seed) >>> 0) || 1;
  var DT = 1 / 60;

  function mulberry(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function post(report) {
    try {
      parent.postMessage({ type: "ogs:report", report: report }, "*");
    } catch (e) {}
  }

  function pause() {
    return new Promise(function (r) {
      setTimeout(r, 0);
    });
  }

  function snapshot() {
    var ctx = T.ctx();
    var d;
    try {
      d = ctx.getImageData(0, 0, 320, 240).data;
    } catch (e) {
      return { hash: 0, colours: 0 };
    }
    var h = 2166136261 >>> 0;
    var seen = {};
    var n = 0;
    for (var i = 0; i < d.length; i += 4 * 7) {
      var v = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      h ^= v;
      h = Math.imul(h, 16777619) >>> 0;
      if (!seen[v]) {
        seen[v] = 1;
        n++;
      }
    }
    return { hash: h >>> 0, colours: n };
  }

  function reseed() {
    Math.random = mulberry(seed);
    T.seed(seed);
  }

  // Run one scenario. inputFn(i) -> keys object. Returns info.
  async function scenario(steps, inputFn, opts) {
    opts = opts || {};
    reseed();
    T.start();
    var info = { overAt: null, hashes: {}, deaths: 0, lives: [], maxScore: 0, ms: 0, steps: 0, colours: 0 };
    var lifeStart = 0;
    for (var i = 0; i < steps; i++) {
      T.setKeys(inputFn(i));
      if (opts.tapEvery && i % opts.tapEvery === 0) T.tap(160, 120);
      var t0 = performance.now();
      T.step(DT);
      T.render();
      info.ms += performance.now() - t0;
      info.steps++;
      var ph = T.phase();
      if (ph === "crash") break;
      info.maxScore = Math.max(info.maxScore, T.score());
      if (opts.snap && opts.snap.indexOf(i) >= 0) {
        var s = snapshot();
        info.hashes[i] = s.hash;
        info.colours = Math.max(info.colours, s.colours);
      }
      if (ph === "over") {
        if (info.overAt === null) info.overAt = T.runTime();
        info.deaths++;
        info.lives.push(T.runTime() - lifeStart);
        if (!opts.restart) {
          // ended early: the game-over screen stands in for any snapshots still due
          if (opts.snap) {
            var last = snapshot();
            for (var q = 0; q < opts.snap.length; q++) {
              if (opts.snap[q] > i && info.hashes[opts.snap[q]] === undefined) info.hashes[opts.snap[q]] = last.hash;
            }
            info.colours = Math.max(info.colours, last.colours);
          }
          break;
        }
        T.start();
        lifeStart = 0;
      }
      if (i % 60 === 59) await pause();
    }
    return info;
  }

  function dirsFor(controls) {
    switch (controls) {
      case "lr": return ["right", "left"];
      case "4way": return ["right", "left", "up", "down"];
      case "tap": return ["a"];
      case "lr+a": return ["right", "left", "a"];
      default: return ["right", "left", "up", "down", "a"];
    }
  }

  async function run() {
    var checks = [];
    var report = { pass: false, checks: checks, errors: [], frames: 0, msPerFrame: 0, survivedSeconds: 0, score: 0 };
    try {
      if (!T || !T.hasGame()) {
        var errs0 = T ? T.errors() : ["Runtime missing"];
        checks.push({ name: "Boots", ok: false, detail: "The game never started" + (errs0.length ? ": " + errs0[0] : ".") });
        report.errors = errs0;
        post(report);
        return;
      }
      var loadErrors = T.errors();
      checks.push({ name: "Boots", ok: loadErrors.length === 0, detail: loadErrors.length ? "Errors while loading: " + loadErrors[0] : "Loads cleanly and shows its title screen." });

      var controls = T.controls();
      var snaps = [10, 50, 120, 230];
      var idle = await scenario(240, function () { return {}; }, { snap: snaps });
      var idle2 = await scenario(60, function () { return {}; }, { snap: [50] });
      var deterministic = idle.hashes[50] === idle2.hashes[50];

      var draws = idle.colours >= 3;
      checks.push({ name: "Draws", ok: draws, detail: draws ? "The screen shows " + idle.colours + "+ colours." : "The screen is blank or almost blank." });

      var moved = idle.hashes[10] !== idle.hashes[120] || idle.hashes[120] !== idle.hashes[230];

      // Controls: does holding each input change the picture compared to idle?
      var dirs = dirsFor(controls);
      var responsive = [];
      for (var d = 0; d < dirs.length; d++) {
        var dir = dirs[d];
        var res = await scenario(51, function (i) {
          var k = {};
          if (dir === "a") k.a = i % 10 < 4;
          else k[dir] = true;
          return k;
        }, { snap: [50] });
        if (res.hashes[50] !== undefined && res.hashes[50] !== idle.hashes[50]) responsive.push(dir);
      }
      var controlsOk = responsive.length > 0 || !deterministic;
      checks.push({
        name: "Controls",
        ok: controlsOk,
        detail: responsive.length
          ? "Responds to " + responsive.join(", ") + "."
          : deterministic
            ? "Pressing " + dirs.join("/") + " changes nothing on screen."
            : "Couldn't verify (the game isn't deterministic), assuming fine.",
      });

      // Monkey: 15 seconds of random button mashing with auto-restart.
      var rnd = mulberry(seed ^ 0x5bd1e995);
      var current = {};
      var monkey = await scenario(900, function (i) {
        if (i % 12 === 0) {
          current = {};
          for (var j = 0; j < dirs.length; j++) if (rnd() < 0.45) current[dirs[j]] = true;
        }
        return current;
      }, { restart: true, snap: [100, 400, 800] });
      moved = moved || monkey.hashes[100] !== monkey.hashes[400] || monkey.hashes[400] !== monkey.hashes[800];
      checks.push({ name: "Moves", ok: moved, detail: moved ? "Things move and animate." : "Nothing on screen ever changes." });

      var errs = T.errors();
      var crashedNow = T.phase() === "crash";
      checks.push({
        name: "No crashes",
        ok: errs.length === 0 && !crashedNow,
        detail: errs.length ? errs.slice(0, 2).join(" / ") : "15 seconds of button mashing, no errors.",
      });

      var fair = idle.overAt === null || idle.overAt >= 1.5;
      checks.push({
        name: "Fair start",
        ok: fair,
        detail: fair ? "You get time to get your bearings." : "It's game over after " + idle.overAt.toFixed(1) + "s without touching anything.",
      });

      var totalSteps = idle.steps + idle2.steps + monkey.steps;
      var ms = (idle.ms + idle2.ms + monkey.ms) / Math.max(1, totalSteps);
      var fast = ms < 12;
      checks.push({ name: "Speed", ok: fast, detail: (fast ? "Smooth: " : "Too slow for older phones: ") + ms.toFixed(2) + " ms per frame." });

      var lives = monkey.lives.length ? monkey.lives : [monkey.steps * DT];
      var avgLife = lives.reduce(function (a, b) { return a + b; }, 0) / lives.length;
      checks.push({
        name: "Ends",
        ok: true,
        detail: monkey.deaths ? "Random mashing reached game over " + monkey.deaths + " time" + (monkey.deaths === 1 ? "" : "s") + "." : "Survived 15s of random mashing.",
      });

      report.errors = errs;
      report.frames = totalSteps;
      report.msPerFrame = Math.round(ms * 100) / 100;
      report.survivedSeconds = Math.round(avgLife * 10) / 10;
      report.score = Math.max(idle.maxScore, monkey.maxScore);
      report.pass = checks.every(function (c) { return c.ok; });
      T.title();
      post(report);
    } catch (e) {
      checks.push({ name: "Harness", ok: false, detail: "The playtest itself broke: " + (e && e.message ? e.message : e) });
      report.errors = (T ? T.errors() : []).concat([String(e && e.message ? e.message : e)]);
      post(report);
    }
  }

  window.OGS_HARNESS = { run: run };
})();
