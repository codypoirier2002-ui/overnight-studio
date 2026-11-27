// The title screen: a pixel night sky over the city, one lit window (ours).
import { $ } from "./dom";

export function showTitle(opts: { meta: string; onEnter: () => void }): void {
  const screen = $("#title-screen");
  const canvas = $("#title-sky") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  $("#title-meta").textContent = opts.meta;
  screen.hidden = false;
  document.body.style.overflow = "hidden";

  let s = 99;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const stars = Array.from({ length: 70 }, () => ({ x: r() * 320, y: r() * 120, p: r() * 6.3 }));
  const city: { x: number; w: number; h: number; lit: [number, number][] }[] = [];
  for (let x = 0; x < 320; ) {
    const w = 10 + Math.floor(r() * 18);
    const h = 18 + Math.floor(r() * 50);
    const lit: [number, number][] = [];
    for (let wy = 180 - h + 4; wy < 176; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < 0.25) lit.push([wx, wy]);
    city.push({ x, w, h, lit });
    x += w + 1;
  }
  const studio = city[Math.floor(city.length / 2)];

  let raf = 0;
  let last = 0;
  const draw = (now: number) => {
    raf = requestAnimationFrame(draw);
    if (now - last < 66) return; // ~15 fps is plenty for twinkles
    last = now;
    const t = now / 1000;
    const g = ctx.createLinearGradient(0, 0, 0, 180);
    g.addColorStop(0, "#070a22");
    g.addColorStop(1, "#2a2a5c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 180);
    for (const st of stars) {
      ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.7 + st.p));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(st.x), Math.round(st.y), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f4efe6";
    ctx.beginPath();
    ctx.arc(262, 34, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#070a22";
    ctx.beginPath();
    ctx.arc(268, 30, 9, 0, Math.PI * 2);
    ctx.fill();
    for (const b of city) {
      ctx.fillStyle = "#120f24";
      ctx.fillRect(b.x, 180 - b.h, b.w, b.h);
      ctx.fillStyle = "#ffd56b";
      for (const [x, y] of b.lit) if (Math.sin(t * 0.3 + x * 7 + y) > -0.8) ctx.fillRect(x, y, 2, 2);
    }
    // our studio: the warm window with four tiny silhouettes
    const wx = studio.x + Math.floor(studio.w / 2) - 7;
    const wy = 180 - studio.h + 8;
    ctx.fillStyle = "#ffcf7a";
    ctx.fillRect(wx, wy, 14, 9);
    ctx.fillStyle = "#2b2033";
    for (let i = 0; i < 4; i++) ctx.fillRect(wx + 1 + i * 3 + (Math.sin(t * 2 + i) > 0.6 ? 1 : 0), wy + 4, 2, 5);
  };
  raf = requestAnimationFrame(draw);

  const enter = () => {
    cancelAnimationFrame(raf);
    screen.hidden = true;
    document.body.style.overflow = "";
    window.removeEventListener("keydown", onKey);
    try {
      sessionStorage.setItem("ogs.entered", "1");
    } catch {
      /* ignore */
    }
    opts.onEnter();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      enter();
    }
  };
  $("#title-enter").addEventListener("click", enter, { once: true });
  window.addEventListener("keydown", onKey);
  ($("#title-enter") as HTMLButtonElement).focus();
}

export function titleAlreadySeen(): boolean {
  try {
    return sessionStorage.getItem("ogs.entered") === "1";
  } catch {
    return false;
  }
}
