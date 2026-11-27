// The built-in writer: the crew's voices, their arguments and in-jokes, with no
// AI needed. Seeded by the pitch so a pitch always reads the same way, with
// lore counters (Bug Jar, v2 notebook, Gerald) that carry over between nights.

import type { AgentId } from "../agents";
import type { DesignDoc, DiaryKind, Palette, PlaytestReport } from "../types";
import type { BubbleIcon } from "../studio/scene";
import type { Lore } from "../lore";
import { article, cap, GENRE_NAMES, plural, type Genre, type PitchInfo } from "./pitch";

export interface Line {
  who: AgentId | "system";
  text: string;
  icon?: BubbleIcon;
  kind?: DiaryKind;
  data?: unknown;
}

export type DebateId = "genre" | "scope" | "palette" | "difficulty" | "hero";

export function rngFrom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WriterCtx {
  info: PitchInfo;
  rng: () => number;
  lore: Lore;
  debates: DebateId[];
  used: Set<string>;
  title: string;
  altTitles: string[];
  tagline: string;
  cut: string[];
  extraVerb: string;
  feature: string;
}

const CONTROL_WORDS: Record<string, string> = {
  "4way": "arrow keys or WASD, and a d-pad on touch",
  lr: "left and right, on keys or the touch buttons",
  tap: "one button: Space, or tap the screen",
  "lr+a": "left/right to move, Space or the A button to fire",
  "4way+a": "arrows to move, Space or A for the action",
};

export const MECHANICS: Record<Genre, string> = {
  courier: "pick it up, carry it across, drop it at the glowing door",
  catcher: "slide left and right, catch the good stuff, dodge the bad",
  runner: "auto-run, one-button jump, don't hit anything",
  shooter: "slide along the bottom and zap whatever comes down",
  maze: "sweep the screen for pickups while things chase you",
  breaker: "bounce it back, break every block",
  stacker: "drop each piece on the swinging stack, don't let it topple",
  flyer: "tap to flap, thread the gaps",
};

const GENRE_NOUNS: Record<Genre, string[]> = {
  courier: ["Express", "Rush", "Delivery", "Dispatch", "Run"],
  catcher: ["Catch", "Downpour", "Drop", "Shower", "Scramble"],
  runner: ["Dash", "Getaway", "Escape", "Sprint", "Run"],
  shooter: ["Defence", "Blaster", "Showdown", "Patrol", "Stand"],
  maze: ["Heist", "Hunt", "Sweep", "Caper", "Haul"],
  breaker: ["Smash", "Bonk", "Breakout", "Crunch", "Rumble"],
  stacker: ["Stack", "Tower", "Teeter", "Wobble", "Pile-Up"],
  flyer: ["Flight", "Flap", "Glide", "Drift", "Updraft"],
};

const ALLIT: Record<string, string[]> = {
  a: ["Airborne", "Audacious"], b: ["Brave", "Bouncy"], c: ["Cosmic", "Clumsy"], d: ["Daring", "Dizzy"], e: ["Epic", "Eager"],
  f: ["Frantic", "Fearless"], g: ["Grand", "Gutsy"], h: ["Hasty", "Heroic"], i: ["Intrepid", "Itsy"], j: ["Jumpy", "Jolly"],
  k: ["Kooky", "Keen"], l: ["Lucky", "Lightning"], m: ["Mighty", "Midnight"], n: ["Nimble", "Night-Shift"], o: ["Odd", "Overtime"],
  p: ["Plucky", "Peckish"], q: ["Quick", "Quirky"], r: ["Rapid", "Rogue"], s: ["Speedy", "Sleepy"], t: ["Turbo", "Tiny"],
  u: ["Ultra", "Unstoppable"], v: ["Valiant", "Velvet"], w: ["Wild", "Wobbly"], x: ["Extra", "Xtreme"], y: ["Yappy", "Young"],
  z: ["Zippy", "Zesty"],
};

const BIG_FEATURES = [
  "a day-night cycle", "a crafting system", "a grappling hook", "an open world", "a branching dialogue tree", "online leaderboards",
  "a boss with three phases", "a skill tree", "a photo mode", "an opera mode", "a pet that follows you", "procedural weather",
  "a hat shop", "a morality system", "a second playable character", "a rhythm section", "a fishing minigame",
];

const EXTRA_VERBS = ["wall-jump", "dash", "double-jump", "build a tiny house", "do a little dance", "befriend the hazards", "ride a skateboard", "glide", "throw a boomerang"];

function pickFrom<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function makeTitles(info: PitchInfo, rng: () => number): string[] {
  const H = cap(info.hero.word);
  const I = cap(info.item.word === "pizza" ? "slice" : info.item.word);
  const Z = info.hazard.word.split(" ").map(cap).join(" ");
  const nouns = GENRE_NOUNS[info.genre];
  const N = pickFrom(rng, nouns);
  const N2 = pickFrom(rng, nouns.filter((n) => n !== N));
  const adj = pickFrom(rng, ALLIT[info.hero.word[0]] ?? ALLIT.s);
  const weatherWord = info.weather === "storm" ? "Storm" : info.weather === "rain" ? "Rainy" : info.weather === "snow" ? "Snowbound" : info.mods.includes("night") ? "Midnight" : info.mods.includes("space") ? "Orbital" : "";
  const options = [
    `${adj} ${H}`,
    `${H} ${N}`,
    `${I} ${N2}`,
    weatherWord ? `${weatherWord} ${I}` : `${H} vs. the ${plural(info.hazard.word).split(" ").map(cap).join(" ")}`,
    `${adj} ${H}: ${I} ${N}`,
    `${H}'s Big Night`,
    `${Z} ${N2}`,
    `Night-Shift ${H}`,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of options) {
    if (o.length > 28 || seen.has(o)) continue;
    seen.add(o);
    out.push(o);
  }
  // shuffle deterministically, keep the first three for the vote
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeTagline(info: PitchInfo, rng: () => number): string {
  const it = info.item.word;
  const hz = plural(info.hazard.word);
  const opts: Record<Genre, string[]> = {
    courier: [`Deliver the ${it}. Respect the ${hz}.`, `Every ${it} arrives. Eventually.`, `Signed, sealed, slightly soggy.`],
    catcher: [`Catch the ${plural(it)}. Not the ${hz}.`, `It's raining ${plural(it)}. Mostly.`, `Hold out your hands and hope.`],
    runner: [`Run. Jump. Don't look back at the ${hz}.`, `One button. No brakes.`, `The ${hz} are gaining.`],
    shooter: [`Hold the line. Hold the ${it}.`, `They came from above. You're ready.`, `Zap first, ask questions in v2.`],
    maze: [`Grab every ${it}. Don't get caught.`, `In and out. Mostly out.`, `It's not stealing if it's a video game.`],
    breaker: [`Bounce. Break. Repeat.`, `Every block has it coming.`, `Physics, but rude.`],
    stacker: [`Stack it high. Pray.`, `Gravity is the final boss.`, `One more ${it}. What could go wrong?`],
    flyer: [`Flap. Flap. Flap. Oh no.`, `Thread the gap. Find the ${it}.`, `Wings were a mistake. Keep going.`],
  };
  return pickFrom(rng, opts[info.genre]);
}

export function makeDoc(ctx: WriterCtx, controls: string): DesignDoc {
  const { info } = ctx;
  const twist = twistText(info);
  return {
    title: ctx.title,
    logline: `You are ${article(info.hero.word)} ${info.hero.word} ${info.verb} ${plural(info.item.word)}${info.place ? " in the " + info.place : ""}.`,
    genre: cap(GENRE_NAMES[info.genre]),
    player: `${cap(article(info.hero.word))} ${info.hero.word}. Small, determined, slightly out of their depth.`,
    goal: goalText(info),
    controls: cap(CONTROL_WORDS[controls] ?? controls),
    hazards: `${cap(plural(info.hazard.word))}.${twist ? " " + twist : ""}`,
    twist: twist || "It gets faster the longer you last.",
    cut: ctx.cut,
  };
}

export function twistText(info: PitchInfo): string {
  const t: string[] = [];
  if (info.mods.includes("wind")) t.push("Wind gusts shove you sideways.");
  if (info.weather === "rain" || info.weather === "storm") t.push("It's pouring.");
  if (info.weather === "snow") t.push("Snow everywhere.");
  if (info.mods.includes("night")) t.push("It's dark: you see a little circle of light.");
  if (info.mods.includes("ice")) t.push("Everything is slippery.");
  if (info.mods.includes("fast")) t.push("It's a race against the clock.");
  if (info.mods.includes("slow")) t.push("Cosy pace, gentle difficulty.");
  if (info.mods.includes("space")) t.push("Low gravity.");
  if (info.mods.includes("underwater")) t.push("Floaty underwater physics.");
  if (info.mods.includes("tiny")) t.push("Everything is huge compared to you.");
  if (info.mods.includes("giant")) t.push("You are enormous.");
  return t.slice(0, 2).join(" ");
}

function goalText(info: PitchInfo): string {
  const it = info.item.word;
  switch (info.genre) {
    case "courier": return `Deliver 6 ${plural(it)} before the timer runs out.`;
    case "catcher": return `Catch 25 ${plural(it)}. Three misses and you're out.`;
    case "runner": return `Survive as long as you can. Grab ${plural(it)} for bonus points.`;
    case "shooter": return `Clear three waves of ${plural(info.hazard.word)}.`;
    case "maze": return `Collect every ${it} on the screen without getting caught.`;
    case "breaker": return `Break every block. Don't drop the ball.`;
    case "stacker": return `Stack 12 ${plural(it)} without toppling.`;
    case "flyer": return `Fly through 15 gaps. Collect ${plural(it)} on the way.`;
  }
}

export function newWriterCtx(info: PitchInfo, lore: Lore): WriterCtx {
  const rng = rngFrom(info.seed ^ 0x9e3779b9);
  const pool: DebateId[] = ["genre", "scope", "palette", "difficulty", "hero"];
  const debates: DebateId[] = [];
  while (debates.length < 2) {
    const d = pickFrom(rng, pool);
    if (!debates.includes(d)) debates.push(d);
  }
  const titles = makeTitles(info, rng);
  const feature = pickFrom(rng, BIG_FEATURES);
  const cut = [feature, pickFrom(rng, BIG_FEATURES.filter((f) => f !== feature)), "Juno's opera mode"];
  return {
    info,
    rng,
    lore,
    debates,
    used: new Set(),
    title: titles[0],
    altTitles: titles.slice(1, 4),
    tagline: makeTagline(info, rng),
    cut: [...new Set(cut)],
    extraVerb: pickFrom(rng, EXTRA_VERBS),
    feature,
  };
}

// ---------- templating ----------

function slots(ctx: WriterCtx, extra: Record<string, string> = {}): Record<string, string> {
  const { info, lore } = ctx;
  return {
    pitch: info.pitch,
    hero: info.hero.word,
    Hero: cap(info.hero.word),
    aHero: `${article(info.hero.word)} ${info.hero.word}`,
    heroes: plural(info.hero.word),
    item: info.item.word,
    items: plural(info.item.word),
    Items: cap(plural(info.item.word)),
    hazard: info.hazard.word,
    hazards: plural(info.hazard.word),
    Hazards: cap(plural(info.hazard.word)),
    verb: info.verb,
    inPlace: info.place ? ` in the ${info.place}` : "",
    place: info.place ?? "the level",
    genre: GENRE_NAMES[info.genre],
    aGenre: `${article(GENRE_NAMES[info.genre])} ${GENRE_NAMES[info.genre]}`,
    mechanic: MECHANICS[info.genre],
    title: ctx.title,
    alt1: ctx.altTitles[0] ?? ctx.title + " DX",
    alt2: ctx.altTitles[1] ?? cap(info.hero.word) + " 2",
    tagline: ctx.tagline,
    feature: ctx.feature,
    Feature: cap(ctx.feature),
    extraVerb: ctx.extraVerb,
    bugs: String(lore.bugJar),
    v2: String(lore.v2Ideas),
    games: String(lore.gamesShipped),
    nextGame: String(lore.gamesShipped + 1),
    duck: String(lore.duckApprovals),
    ...extra,
  };
}

export function fill(tpl: string, s: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in s ? s[k] : `{${k}}`));
}

/** Pick a template this production hasn't used yet. */
function say(ctx: WriterCtx, who: AgentId | "system", options: string[], icon?: BubbleIcon, extra?: Record<string, string>): Line {
  const fresh = options.filter((o) => !ctx.used.has(o));
  const tpl = pickFrom(ctx.rng, fresh.length ? fresh : options);
  ctx.used.add(tpl);
  return { who, text: fill(tpl, slots(ctx, extra)), icon };
}

// ---------- stages ----------

export function kickoffLines(ctx: WriterCtx, controls: string): Line[] {
  const { info } = ctx;
  const L: Line[] = [];
  L.push(say(ctx, "designer", [
    "Okay team, gather round. Tonight's pitch: \"{pitch}\". I already love it.",
    "Kettle's on, biscuits are out. The pitch is \"{pitch}\" and I have goosebumps.",
    "New pitch just landed: \"{pitch}\". Nobody say 'scope' yet.",
  ], "talk"));
  L.push(say(ctx, "tester", [
    "{aHero}? Say less. When can I break it?",
    "Does the {hero} have a name? I'm naming it. It's called Gary now.",
    "I have already decided this is my favourite game. Is it out yet?",
    "{Hazards}. Oh, I'm going to find SO many bugs.",
  ], "heart"));
  if (!info.hero.known) {
    L.push(say(ctx, "artist", [
      "Quick question. What does {aHero} look like? Never mind. It's a very confident blob now and we're all going to agree that's {aHero}.",
      "I've never drawn {aHero}. I'm going with 'expressive blob'. Bold. Iconic. A blob.",
    ], "?"));
  } else {
    L.push(say(ctx, "artist", [
      "I can already see the palette. Four colours. Maybe five. The {hero} pops, the {hazards} glow.",
      "I'm going to draw the most lovable {hero} this studio has ever shipped. Don't argue.",
      "Mood board: {aHero}, chunky pixels, a {item} that looks good enough to eat.",
    ], "idea"));
  }
  L.push(say(ctx, "designer", [
    "The fantasy: you ARE {aHero}, {verb} {items}{inPlace}, and nothing can stop you. Except the {hazards}.",
    "Player fantasy: the bravest {hero} alive, {verb} {items} against all odds. Mostly {hazards}.",
    "Picture it. One {hero}. Too many {hazards}. And the {item} must get through.",
  ], "idea"));

  if (ctx.debates.includes("genre")) {
    L.push(say(ctx, "designer", [
      "Hear me out: open world. Every street. Every rooftop. {Feature}.",
      "Okay, what if it's an epic? Twelve chapters. {Feature}. A soundtrack with a choir.",
    ], "idea"));
    L.push(say(ctx, "coder", [
      "We have one night. It's {aGenre}. One screen.",
      "It's {aGenre}. It fits in one screen and one night. That's the deal.",
    ], "!"));
    L.push(say(ctx, "designer", ["...{aGenre} with {feature}?", "A tiny bit of {feature}? As a treat?"], "?"));
    L.push(say(ctx, "coder", ["That's a v2 feature.", "v2.", "Write it in the notebook. That's what it's for."]));
    ctx.lore.v2Ideas += 1;
    L.push({ who: "system", text: fill("Juno adds '{feature}' to the v2 notebook. That's idea #{v2}.", slots(ctx)) });
  } else {
    L.push(say(ctx, "coder", [
      "Sounds like {aGenre}. {Mechanic}. I can build that tonight.",
      "Right. {aGenre}: {mechanic}. One screen, short and sharp.",
    ], "talk", { Mechanic: cap(MECHANICS[info.genre]) }));
    L.push(say(ctx, "designer", ["Yes! That's the loop. Simple, readable, one more go.", "Perfect. Small game, big heart."], "heart"));
  }
  L.push(say(ctx, "coder", [
    "Controls: {controls}. Keyboard and touch both work.",
    "It'll play on {controls}. Phone-friendly from the start.",
  ], "talk", { controls: CONTROL_WORDS[controls] ?? controls }));
  L.push(say(ctx, "tester", [
    "Bug Jar's at {bugs}. It's hungry.",
    "As long as it doesn't wobble. We don't talk about the Wobble.",
    "Just promise me there's a restart button. Last time there wasn't a restart button.",
    "I'm going to speedrun it before the art's even in.",
  ], "talk"));
  L.push(say(ctx, "designer", [
    "Right. Doc in twenty minutes. Someone water Gerald.",
    "Design doc incoming. Bram, kettle?",
    "Break! Back in twenty with a doc. Don't eat all the ginger biscuits.",
  ], "note"));
  return L;
}

export function designLines(ctx: WriterCtx, doc: DesignDoc): Line[] {
  const L: Line[] = [];
  L.push(say(ctx, "designer", [
    "Writing the doc. Working title: {title}.",
    "Doc's taking shape. Working title is {title}, and I'm emotionally attached already.",
  ], "note"));
  L.push({ who: "designer", text: "Design doc v1 is up. Be gentle.", kind: "doc", data: doc, icon: "note" });
  L.push(say(ctx, "coder", [
    "Read it. Cut {cut0}. Everything else fits in one night.",
    "Good doc. {cut0} is out. And {cut1}. And, as always, the opera mode.",
    "I've crossed out {cut0}. Don't look at me like that.",
  ], "!", { cut0: doc.cut[0], cut1: doc.cut[1] ?? "the opera mode" }));
  L.push(say(ctx, "designer", [
    "Fine. FINE. v2.",
    "You cut {cut0} like it owed you money.",
    "I'll allow it. The notebook remembers.",
  ], "talk", { cut0: doc.cut[0] }));
  if (ctx.debates.includes("difficulty")) {
    L.push(say(ctx, "tester", ["The goal says '{goal}'. Can we double it?", "Can it be hard? Like, properly hard?"], "?", { goal: doc.goal.toLowerCase() }));
    L.push(say(ctx, "designer", ["It's a cosy game, Moss.", "Absolutely not. People play these on the bus."], "!"));
    L.push(say(ctx, "coder", ["Compromise: it starts gentle and speeds up. Everyone's happy.", "It ramps. Gentle start, spicy finish. Done."]));
  }
  L.push(say(ctx, "artist", [
    "{title}? I can make that sing.",
    "Love the twist. {twist} Visually: yes please.",
    "I'll start thumbnails for the {hero} while Bram builds.",
  ], "heart", { twist: doc.twist }));
  return L;
}

export function buildLines(ctx: WriterCtx, controls: string): Line[] {
  const L: Line[] = [];
  L.push(say(ctx, "coder", [
    "Starting the build. Headphones on. Duck's in position.",
    "Build time. If anyone needs me, they don't.",
    "Opening a fresh file. My favourite smell.",
  ], "talk"));
  L.push(say(ctx, "coder", ["Core loop's in: {mechanic}.", "Loop works: {mechanic}. Ugly, but it works."], "talk"));
  L.push(say(ctx, "designer", [
    "What if the {hero} could also {extraVerb}?",
    "Tiny idea. Microscopic. The {hero} can {extraVerb}.",
  ], "idea"));
  L.push(say(ctx, "coder", ["v2.", "That's a v2 feature.", "Notebook."], "!"));
  L.push(say(ctx, "coder", [
    "Input's wired: {controls}.",
    "Touch buttons are in, so it plays on phones. Keys too: {controls}.",
  ], "talk", { controls: CONTROL_WORDS[controls] ?? controls }));
  L.push(say(ctx, "tester", ["Is it playable yet?", "Is it playable now?", "How about now?"], "?"));
  L.push(say(ctx, "coder", [
    "No. ...Okay, yes. It's grey boxes, but yes.",
    "It's playable if you squint. Wren's not allowed to look yet.",
  ]));
  L.push(say(ctx, "coder", [
    "Collisions done. The {hazards} hurt now. As they should.",
    "Scoring's in. A {item} is worth more than you'd think.",
  ], "talk"));
  return L;
}

export function buildDoneLines(ctx: WriterCtx): Line[] {
  ctx.lore.duckApprovals += 1;
  return [
    say(ctx, "coder", [
      "Build compiled. The duck approves.",
      "First build done. I showed it to the duck. The duck said nothing, which means yes.",
      "Build's green. Duck approval #{duck}.",
    ], "heart"),
  ];
}

/** Filler for slow stages: life in the studio while something takes time. */
export function fillerLine(ctx: WriterCtx): Line {
  const who = pickFrom(ctx.rng, ["designer", "artist", "tester", "coder"] as AgentId[]);
  const lines: Record<AgentId, string[]> = {
    designer: ["Refilling the chai. Anyone else?", "Wrote three more v2 ideas. Don't tell Bram.", "Is it just me or is Gerald leaning towards the window?"],
    coder: ["Still compiling. Don't touch anything.", "Typing intensifies.", "The duck and I are having a quiet moment."],
    artist: ["Sketching {hero} poses in the margins.", "Mixing a new colour. Calling it 'Two AM'.", "I've redrawn the {item} four times. It's perfect now. No, wait."],
    tester: ["Lemon fizz break. Back in five.", "Practising my button-mashing.", "Someone's left a ginger biscuit on the meeting table. Mine now."],
  };
  return say(ctx, who, lines[who], "talk");
}

export function artLines(ctx: WriterCtx, palette: Palette): Line[] {
  const L: Line[] = [];
  const [bgName, , heroName, accentName, dangerName] = palette.names;
  L.push(say(ctx, "artist", [
    "Art pass! Palette is locked: {c0}, {c2}, {c3} and {c4}.",
    "Palette time. Introducing {c0}, {c2}, {c3}, and for the {hazards}: {c4}.",
  ], "heart", { c0: bgName, c2: heroName, c3: accentName, c4: dangerName }));
  L.push({ who: "artist", text: "Swatches, for the record:", kind: "palette", data: palette });
  L.push(say(ctx, "artist", [
    "The {hero} is {c2} with an outline you could see from space.",
    "{Hero} gets {c2}. The {item} is {c3} so your eye goes straight to it.",
  ], "talk", { c2: heroName, c3: accentName }));
  if (ctx.debates.includes("palette")) {
    L.push(say(ctx, "designer", ["Could it be... more pink?", "Hear me out: rainbow.", "What if everything sparkled?"], "idea"));
    L.push(say(ctx, "artist", [
      "It's {c3}. It's basically pink in the right light.",
      "Four colours, Juno. FOUR. Five if I'm feeling generous.",
    ], "!", { c3: accentName }));
    L.push(say(ctx, "designer", ["I'll allow it.", "Fine. But I'm drawing a sparkle on the cover."]));
  }
  if (ctx.debates.includes("hero")) {
    L.push(say(ctx, "tester", ["Why does the {hero} look like a potato?", "Is that the {hero} or a loaf of bread?"], "?"));
    L.push(say(ctx, "artist", ["It's STYLISED.", "It's a bold silhouette, Moss. Read a book."], "!"));
    L.push(say(ctx, "coder", ["I like the potato.", "The duck likes it."]));
  }
  L.push(say(ctx, "tester", [
    "The {hazard} looks properly menacing now. Good. Menacing is readable.",
    "Ooh, the {item} has a sparkle. I want to eat it.",
  ], "heart"));
  return L;
}

export function playtestIntro(ctx: WriterCtx): Line[] {
  return [
    say(ctx, "tester", [
      "Playtest time. Hands off the keyboard, everyone. This is my keyboard now.",
      "Cracking my knuckles. Firing it up.",
      "Bug Jar is open. Let's see what we catch.",
    ], "talk"),
  ];
}

export function playtestLines(ctx: WriterCtx, report: PlaytestReport, attempt: number): Line[] {
  const L: Line[] = [];
  const secs = report.survivedSeconds.toFixed(1);
  if (report.pass) {
    L.push(say(ctx, "tester", [
      "Ran it hard: {frames} frames, no crashes. Survived {secs}s mashing randomly and scored {score}.",
      "{frames} frames of me pressing everything at once and nothing broke. {score} points. I'm almost disappointed.",
    ], "heart", { frames: String(report.frames), secs, score: String(report.score) }));
  } else {
    const problem = describeProblem(report);
    ctx.lore.bugJar += 1;
    L.push(say(ctx, "tester", [
      "Found one! {problem} Into the Bug Jar! That's #{bugs}.",
      "BUG. {problem} Bug Jar number {bugs}, everyone.",
    ], "!", { problem }));
  }
  L.push({ who: "tester", text: attempt === 0 ? "Playtest report:" : `Retest #${attempt}:`, kind: "report", data: report });
  if (report.pass && attempt === 0) {
    L.push(say(ctx, "designer", ["But is it FUN?", "Okay but how does it FEEL?"], "?"));
    L.push(say(ctx, "tester", [
      "It's fun. I played it way more times than a professional should.",
      "It's the good kind of 'one more go'. I lost track of time. It's 3 AM.",
    ], "heart"));
  }
  return L;
}

export function describeProblem(report: PlaytestReport): string {
  const bad = report.checks.filter((c) => !c.ok);
  if (report.errors.length) return `It throws an error: "${report.errors[0].slice(0, 90)}".`;
  if (!bad.length) return "Something felt off.";
  return bad.map((b) => b.detail).join(" ");
}

export function fixLines(ctx: WriterCtx, report: PlaytestReport, attempt: number): Line[] {
  return [
    say(ctx, "coder", [
      "On it. Fix #{n}: {what}",
      "Right. {what} Patching. Fix #{n}.",
    ], "talk", { n: String(attempt), what: describeProblem(report) }),
    say(ctx, "coder", ["Patched. Duck, do your thing.", "Rebuilt. Moss, again please.", "Try now. Gently. Or not, it's you."]),
  ];
}

export function polishLines(ctx: WriterCtx): Line[] {
  return [
    say(ctx, "coder", [
      "No fixes needed, so I'm polishing: screen shake on hits and a little pop on pickups.",
      "Nothing to fix. I'm spending the time on juice: particles, shake, a satisfying 'blip'.",
    ], "talk"),
    say(ctx, "artist", ["One more highlight on the {hero}. There. Perfect.", "I nudged one pixel. You can't tell. I can tell."], "heart"),
  ];
}

export function gaveUpLines(ctx: WriterCtx): Line[] {
  return [
    say(ctx, "coder", [
      "Three fixes and it still won't behave. I'm shipping the safe build from the template cabinet instead.",
      "We're out of tries. Pulling the trusty template off the shelf so we still ship by dawn.",
    ], "!"),
    say(ctx, "designer", ["A shipped game beats a perfect one. Proud of us.", "Morning's coming. Safe build it is."], "heart"),
  ];
}

export function shipLines(ctx: WriterCtx): Line[] {
  const L: Line[] = [];
  L.push(say(ctx, "designer", ["Title time. I'm proposing {title}.", "Final title. I say {title}."], "idea"));
  L.push(say(ctx, "tester", ["Counter-proposal: {alt1}.", "Hear ME out: {alt1}."], "!"));
  L.push(say(ctx, "coder", ["{alt2}. Short. Fits on the cartridge.", "{alt2}. I'm not attached. I'm a little attached."]));
  const winner = ctx.rng();
  let finalTitle = ctx.title;
  if (winner < 0.6) {
    L.push(say(ctx, "artist", ["Two votes for {title}. The duck abstains.", "I'm with Juno. {title} looks best on the cover."], "heart"));
  } else if (winner < 0.85) {
    finalTitle = ctx.altTitles[0] ?? ctx.title;
    L.push(say(ctx, "artist", ["Honestly? {alt1}. It just looks right in pixels.", "Tie. The duck decides... {alt1}."], "talk"));
  } else {
    finalTitle = ctx.altTitles[1] ?? ctx.title;
    L.push(say(ctx, "artist", ["Tie. The duck decides... {alt2}.", "I'll break the tie: {alt2}. Fight me."], "talk"));
  }
  ctx.title = finalTitle;
  L.push(say(ctx, "designer", ["Tagline: \"{tagline}\"", "Box copy: \"{tagline}\" Chef's kiss."], "note"));
  L.push(say(ctx, "artist", ["Cover's drawn. The {hero}'s front and centre, obviously.", "Cartridge label done. It's my best work. I say that every time."], "heart"));
  L.push(say(ctx, "coder", ["Shipped. And the sun's coming up.", "It's on the shelf. Look at the sky. We did it again."], "heart"));
  L.push(say(ctx, "tester", [
    "Game #{nextGame} on the shelf! Gerald grew a leaf to celebrate.",
    "That's {nextGame} games shipped. Bug Jar's at {bugs}. Gerald approves.",
  ], "heart"));
  return L;
}

export function systemStageLine(stage: string, time: string): Line {
  return { who: "system", text: `${stage} · ${time}` };
}
