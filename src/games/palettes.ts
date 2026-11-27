// Wren's palette drawer. Six slots, named like paint samples.
import type { Palette } from "../types";
import type { PitchInfo } from "../brain/pitch";

type P = [string, string][]; // [hex, name] x6: bg, bg2, hero, accent, danger, text

const FAMILIES: Record<string, P[]> = {
  storm: [
    [["#1d2340", "Thundercloud"], ["#3b4466", "Wet Slate"], ["#c9c4d9", "Moth Wing"], ["#ffcf5a", "Streetlamp"], ["#7fd6ff", "Lightning Blue"], ["#f4efe6", "Paper Moon"]],
    [["#1a2233", "Gutter Night"], ["#34506a", "Puddle Blue"], ["#e8e2f0", "Raincoat Lilac"], ["#ffb02e", "Hazard Amber"], ["#ff5a5a", "Siren Red"], ["#eef6ff", "Drizzle"]],
  ],
  stars: [
    [["#0d0b1f", "Deep Void"], ["#2b1d4a", "Nebula Plum"], ["#e8f0ff", "Astro White"], ["#ffd56b", "Comet Gold"], ["#a6e36b", "Alien Lime"], ["#f4efe6", "Starlight"]],
    [["#101828", "Night Shift"], ["#263259", "Orbit Blue"], ["#ff9e7a", "Retro Rocket"], ["#7fd6c2", "Space Mint"], ["#ff5a7a", "Red Giant"], ["#fdfaf3", "Moonbeam"]],
  ],
  bubbles: [
    [["#0b2a3a", "Trench"], ["#135a6a", "Lagoon"], ["#ff8fa3", "Coral Pink"], ["#fdf6e3", "Pearl"], ["#8a5cff", "Urchin Purple"], ["#c8fff0", "Seafoam"]],
    [["#082238", "Midnight Tide"], ["#1d4e6e", "Kelp Shadow"], ["#ffb347", "Goldfish"], ["#b8f0ff", "Bubble"], ["#ff5a5a", "Jelly Sting"], ["#e8fbff", "Sea Glass"]],
  ],
  leaf: [
    [["#1f3324", "Moss Floor"], ["#2f5a38", "Fern"], ["#d39b5a", "Acorn"], ["#ffe66b", "Firefly"], ["#e2574c", "Toadstool Red"], ["#f2efe2", "Birch"]],
    [["#233024", "Hedge Dark"], ["#4c6b3a", "Lawn Clippings"], ["#ff9e7a", "Peach Blossom"], ["#fff1a8", "Dandelion"], ["#9b5de5", "Bramble"], ["#f6f3e6", "Morning Dew"]],
  ],
  sun: [
    [["#3a2430", "Dune Dusk"], ["#a1503a", "Sunset Clay"], ["#7ac74f", "Cactus"], ["#ffd56b", "Sun Coin"], ["#c8443c", "Scorpion Red"], ["#fbe7c6", "Sand"]],
    [["#2e2040", "Heatwave Night"], ["#d0663f", "Terracotta"], ["#4ec5c1", "Oasis"], ["#ffe08a", "Lemonade"], ["#ff4d6d", "Chilli"], ["#fff6e5", "Sunscreen"]],
  ],
  grid: [
    [["#2b2238", "Tile Night"], ["#46385a", "Checkerboard"], ["#7fd6c2", "Teapot Teal"], ["#ffe28a", "Butter"], ["#e2574c", "Burnt Toast"], ["#f4efe6", "Steam"]],
    [["#1f2233", "Lino"], ["#3a3f5c", "Filing Cabinet"], ["#ffb38a", "Peach Mug"], ["#a6e36b", "Sticky Note"], ["#ff5a7a", "Red Stapler"], ["#f2f2f2", "Copy Paper"]],
  ],
  city: [
    [["#22202b", "Asphalt"], ["#3d2b4f", "Neon Alley"], ["#7fd6ff", "Shop Sign Blue"], ["#ffd23f", "Cab Yellow"], ["#ff5a7a", "Brake Light"], ["#f4efe6", "Pavement Chalk"]],
    [["#1b1b2f", "Rooftop Night"], ["#463c64", "Fire Escape"], ["#f7a072", "Brick Glow"], ["#c6f68d", "Walk Signal"], ["#ff4d4d", "Stop Signal"], ["#fdfdfd", "Billboard"]],
  ],
  snow: [
    [["#1f3550", "Blizzard Blue"], ["#6c8db8", "Snowbank Shadow"], ["#e2574c", "Mitten Red"], ["#ffd56b", "Lantern"], ["#b8f0ff", "Icicle"], ["#ffffff", "Fresh Snow"]],
  ],
  haunted: [
    [["#1a1426", "Crypt"], ["#3b2a4a", "Old Wallpaper"], ["#d8f8ff", "Ghost Glow"], ["#ffc36b", "Candle"], ["#7cff8a", "Cursed Green"], ["#e6dccb", "Dust Sheet"]],
  ],
  sky: [
    [["#3f6db5", "Big Sky"], ["#8fb8e8", "Cloud Floor"], ["#e2574c", "Kite Red"], ["#ffd56b", "Sun Coin"], ["#4a4e69", "Grumble Grey"], ["#ffffff", "Cumulus"]],
  ],
  rain: [
    [["#1d2340", "Thundercloud"], ["#3b4466", "Wet Slate"], ["#c9c4d9", "Moth Wing"], ["#ffcf5a", "Streetlamp"], ["#7fd6ff", "Lightning Blue"], ["#f4efe6", "Paper Moon"]],
  ],
  arcade: [
    [["#101018", "Arcade Black"], ["#1f3a7a", "Cabinet Blue"], ["#ffb38a", "Pixel Peach"], ["#ffd56b", "Coin Slot"], ["#ff4d6d", "Laser Red"], ["#d8ffd8", "Phosphor"]],
    [["#24152e", "Licorice"], ["#5a2a5e", "Grape Fizz"], ["#7fd6c2", "Mint Chip"], ["#ff8fc7", "Bubblegum"], ["#ffb02e", "Sour Orange"], ["#fff3fb", "Marshmallow"]],
  ],
};

const HERO_COLOURS: Record<string, [string, string]> = {
  pigeon: ["#b9b4d0", "Pigeon Lilac"], crow: ["#6b6b86", "Crow Feather"], raven: ["#6b6b86", "Raven Sheen"], owl: ["#c98b62", "Owl Tweed"],
  parrot: ["#5fd068", "Parrot Green"], chicken: ["#f4efe6", "Eggshell"], duck: ["#ffd23f", "Bath Duck"], penguin: ["#9fb8ff", "Penguin Blue"],
  frog: ["#7ac74f", "Lily Pad"], toad: ["#9aa95a", "Bog"], cat: ["#f0a050", "Marmalade"], kitten: ["#f0a050", "Marmalade"],
  fox: ["#e8743a", "Fox Fur"], dog: ["#d8a066", "Biscuit"], puppy: ["#d8a066", "Biscuit"], corgi: ["#e89a4a", "Corgi Loaf"],
  ghost: ["#e8f6ff", "Bedsheet"], robot: ["#b6c0d4", "Chrome"], bee: ["#ffd23f", "Pollen"], slime: ["#7cff8a", "Gloop"],
  jellyfish: ["#ff9ee0", "Jelly"], goldfish: ["#ff9f43", "Goldfish"], fish: ["#ff9f43", "Goldfish"], snail: ["#e0b070", "Shell Swirl"],
  mouse: ["#c8beb4", "Mousey"], hamster: ["#e8b07a", "Hamster Cheek"], wizard: ["#8a6cff", "Wizard Robe"], witch: ["#8a6cff", "Spell Purple"],
  knight: ["#c9d1d9", "Tin Can"], astronaut: ["#f4f7ff", "Spacesuit"], bunny: ["#f4efe6", "Cottontail"], rabbit: ["#f4efe6", "Cottontail"],
  capybara: ["#c08a5a", "Capybara Calm"], panda: ["#f4efe6", "Bamboo Fluff"], bear: ["#a0704a", "Honey Bear"], alien: ["#a6e36b", "Little Green"],
};

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function pickPalette(info: PitchInfo, rng: () => number): Palette {
  let fam = info.motif;
  if (info.weather === "storm" || info.weather === "rain") fam = "storm";
  else if (info.weather === "snow") fam = "snow";
  else if (info.mods.includes("haunted")) fam = "haunted";
  else if (info.mods.includes("space")) fam = "stars";
  else if (info.mods.includes("underwater")) fam = "bubbles";
  const options = FAMILIES[fam] ?? FAMILIES.arcade;
  const all = rng() < 0.2 ? FAMILIES.arcade : options;
  const p = all[Math.floor(rng() * all.length)] ?? options[0];
  const pal: Palette = {
    bg: p[0][0],
    bg2: p[1][0],
    hero: p[2][0],
    accent: p[3][0],
    danger: p[4][0],
    text: p[5][0],
    names: p.map((x) => x[1]),
  };
  const hc = HERO_COLOURS[info.hero.word];
  if (hc && contrast(hc[0], pal.bg) > 3 && contrast(hc[0], pal.danger) > 1.25) {
    pal.hero = hc[0];
    pal.names[2] = hc[1];
  }
  return pal;
}

export function isPalette(x: unknown): x is Palette {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return ["bg", "bg2", "hero", "accent", "danger", "text"].every((k) => typeof o[k] === "string" && /^#[0-9a-f]{6}$/i.test(o[k] as string));
}

export const PALETTE_KEYS = ["bg", "bg2", "hero", "accent", "danger", "text"] as const;
