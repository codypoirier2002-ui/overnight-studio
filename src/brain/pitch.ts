// Reads a one-line pitch into the bits the team needs: who the hero is, what
// they do, what they carry, what's in the way, where, and the weather.
// Pure functions, no DOM: shared by the built-in writer, the remixer and tests.

export type Genre = "courier" | "catcher" | "runner" | "shooter" | "maze" | "breaker" | "stacker" | "flyer";
export type Weather = "clear" | "rain" | "snow" | "storm";

export interface Thing {
  word: string; // as the pitch said it (singular)
  shape: string; // PixelKit shape
  known: boolean; // false = we made up a blob for it
}

export interface PitchInfo {
  pitch: string;
  seed: number;
  hero: Thing;
  item: Thing;
  hazard: Thing;
  verb: string; // e.g. "delivering"
  genre: Genre;
  place: string | null;
  motif: string; // cover / background motif
  weather: Weather;
  mods: string[]; // "wind", "night", "ice", "fast", "slow", "tiny", "giant", "space", "underwater", "haunted"
  words: string[]; // meaningful words for the whiteboard
}

const HEROES: Record<string, string> = {
  pigeon: "bird", bird: "bird", crow: "bird", raven: "bird", seagull: "bird", gull: "bird", owl: "bird", parrot: "bird",
  chicken: "bird", hen: "bird", sparrow: "bird", robin: "bird", flamingo: "bird", goose: "duck", duck: "duck", duckling: "duck",
  penguin: "penguin", cat: "cat", kitten: "cat", kitty: "cat", fox: "cat", raccoon: "cat", tiger: "cat", lion: "cat",
  dog: "dog", puppy: "dog", corgi: "dog", pup: "dog", wolf: "dog", bear: "dog", panda: "dog", hamster: "mouse", mouse: "mouse",
  rat: "mouse", squirrel: "mouse", rabbit: "mouse", bunny: "mouse", fish: "fish", goldfish: "fish", shark: "fish", whale: "fish",
  dolphin: "fish", frog: "frog", toad: "frog", turtle: "snail", tortoise: "snail", snail: "snail", slug: "snail",
  robot: "robot", android: "robot", bot: "robot", drone: "robot", ghost: "ghost", spirit: "ghost", spectre: "ghost",
  bee: "bee", bumblebee: "bee", ant: "bee", ladybug: "bee", beetle: "bee", butterfly: "bee", slime: "slime", blob: "slime",
  jelly: "slime", jellyfish: "slime", alien: "slime", octopus: "slime", knight: "knight", wizard: "knight", witch: "knight",
  princess: "knight", prince: "knight", viking: "knight", samurai: "knight", ninja: "person", pirate: "person",
  chef: "person", baker: "person", courier: "person", postman: "person", postwoman: "person", mail: "letter", grandma: "person",
  grandpa: "person", granny: "person", kid: "person", child: "person", astronaut: "person", detective: "person",
  librarian: "person", farmer: "person", janitor: "person", barista: "person", firefighter: "person", nurse: "person",
  student: "person", teacher: "person", skater: "person", gardener: "person", plumber: "person", intern: "person",
  rocket: "rocket", spaceship: "ship", starship: "ship", ship: "ship", ufo: "ufo", saucer: "ufo", car: "car", taxi: "car",
  van: "car", truck: "car", bus: "car", boat: "boat", submarine: "boat", sub: "boat", raft: "boat", bat: "bat", crab: "crab",
  penguins: "penguin",
};

const ITEMS: Record<string, string> = {
  pizza: "pizza", slice: "pizza", cheese: "pizza", coin: "coin", money: "coin", gold: "coin", treasure: "gem", gem: "gem",
  crystal: "gem", diamond: "gem", jewel: "gem", star: "star", stardust: "star", heart: "heart", love: "heart",
  letter: "letter", mail: "letter", postcard: "letter", parcel: "box", package: "box", box: "box", crate: "box",
  present: "box", gift: "box", cake: "cake", cupcake: "cake", birthday: "cake", apple: "apple", fruit: "apple",
  cherry: "apple", tomato: "apple", carrot: "carrot", vegetable: "carrot", veggie: "carrot", donut: "donut",
  doughnut: "donut", bagel: "donut", cookie: "cookie", biscuit: "cookie", flower: "flower", seed: "flower",
  petal: "flower", key: "key", mushroom: "mushroom", bone: "bone", coffee: "cup", tea: "cup", cup: "cup", soup: "cup",
  noodle: "cup", ramen: "cup", music: "note", song: "note", note: "note", melody: "note", water: "drop", leaf: "leaf",
  battery: "battery", energy: "battery", power: "battery", sock: "sock", laundry: "sock", egg: "coin", honey: "drop",
  pie: "pizza", sandwich: "box", burger: "cookie", taco: "pizza", sushi: "box", milk: "cup", acorn: "apple", nut: "apple",
  book: "box", sticker: "star", fish: "fish", pancake: "cookie", waffle: "box", block: "box", brick: "box",
  orange: "apple", lemon: "apple", banana: "carrot", pea: "apple", bean: "apple", crumb: "cookie", pebble: "rock", candy: "gem", sweet: "gem", lantern: "battery", firefly: "star", snack: "cookie",
};

const HAZARDS: Record<string, string> = {
  storm: "bolt", thunder: "bolt", lightning: "bolt", thunderstorm: "bolt", rain: "drop", snow: "cloud", blizzard: "cloud",
  wind: "tornado", gust: "tornado", tornado: "tornado", hurricane: "tornado", fire: "fire", lava: "fire", flame: "fire",
  volcano: "fire", bomb: "bomb", saw: "saw", blade: "saw", spike: "spike", thorn: "spike", cactus: "spike", rock: "rock",
  asteroid: "rock", meteor: "rock", boulder: "rock", rubble: "rock", wasp: "wasp", hornet: "wasp", puddle: "puddle",
  flood: "puddle", alarm: "alarm", deadline: "alarm", clock: "alarm", cloud: "cloud", fog: "cloud", traffic: "car",
  pothole: "puddle", vacuum: "robot", seagull: "bird", crow: "bird", cat: "cat", dog: "dog", ghost: "ghost", bat: "bat",
  crab: "crab", shark: "fish", slime: "slime", alien: "ufo", invader: "ufo", zombie: "slime", monster: "slime",
  robot: "robot", drone: "robot", bee: "wasp", spider: "crab", snake: "slime", dragon: "fire", goblin: "slime",
  pigeon: "bird", taxi: "car", bus: "car", car: "car", mosquito: "wasp", dust: "cloud", germ: "slime", bug: "crab",
  lawnmower: "saw", mower: "saw", blender: "saw", knife: "saw", scissors: "saw", hoover: "robot", broom: "spike",
  crater: "puddle", hole: "puddle", wave: "drop", iceberg: "rock", log: "rock", cone: "spike", fork: "spike",
};

const PLACES: Record<string, string> = {
  city: "city", town: "city", street: "city", streets: "city", rooftop: "city", rooftops: "city", downtown: "city",
  space: "stars", moon: "stars", galaxy: "stars", orbit: "stars", planet: "stars", mars: "stars", cosmos: "stars",
  ocean: "bubbles", sea: "bubbles", underwater: "bubbles", reef: "bubbles", lake: "bubbles", river: "bubbles", pond: "bubbles",
  forest: "leaf", woods: "leaf", garden: "leaf", jungle: "leaf", park: "leaf", farm: "leaf", meadow: "leaf",
  desert: "sun", beach: "sun", island: "sun", kitchen: "grid", bakery: "grid", cafe: "grid", diner: "grid",
  office: "grid", castle: "grid", dungeon: "grid", library: "grid", museum: "grid", school: "grid", factory: "grid",
  arctic: "snow", tundra: "snow", mountain: "snow", mountains: "snow", glacier: "snow", sky: "sky", clouds: "sky",
  house: "grid", mansion: "grid", supermarket: "grid", mall: "grid", hospital: "grid", subway: "city", station: "city",
  volcano: "sun", cave: "grid", swamp: "leaf", night: "stars",
};

const VERBS: [RegExp, Genre][] = [
  [/^(deliver|delivering|delivers|delivery|courier|carry|carrying|carries|fetch|fetching|bring|bringing|rescue|rescuing|escort|escorting|ferry|ferrying|return|returning|post|posting|smuggle|smuggling)$/, "courier"],
  [/^(catch|catching|catches|juggle|juggling|grab|grabbing|scoop|scooping|bake|baking|cook|cooking|serve|serving|feed|feeding)$/, "catcher"],
  [/^(fly|flying|flies|flap|flapping|glide|gliding|swim|swimming|float|floating|soar|soaring|hover|hovering|paddle|paddling)$/, "flyer"],
  [/^(shoot|shooting|blast|blasting|defend|defending|protect|protecting|invade|invading|battle|battling|fight|fighting|zap|zapping|guard|guarding|repel|repelling)$/, "shooter"],
  [/^(collect|collecting|gather|gathering|find|finding|forage|foraging|harvest|harvesting|explore|exploring|sneak|sneaking|steal|stealing|hunt|hunting|search|searching|haunt|haunting|clean|cleaning|tidy|tidying|mow|mowing)$/, "maze"],
  [/^(bounce|bouncing|break|breaking|smash|smashing|bonk|bonking|bash|bashing|demolish|demolishing|pop|popping)$/, "breaker"],
  [/^(stack|stacking|build|building|tower|pile|piling|balance|balancing|pack|packing)$/, "stacker"],
  [/^(run|running|runs|escape|escaping|escapes|flee|fleeing|chase|chased|chasing|race|racing|dash|dashing|jump|jumping|hop|hopping|skate|skating|surf|surfing|ride|riding|roll|rolling|sprint|sprinting|commute|commuting|dodge|dodging|avoid|avoiding|survive|surviving|outrun|outrunning)$/, "runner"],
];

const MODS: [RegExp, string][] = [
  [/^(storm|stormy|windy|wind|gust|gusts|gale|hurricane|tornado|thunderstorm|blustery)$/, "wind"],
  [/^(night|midnight|dark|darkness|nocturnal|haunted|spooky|moonlit)$/, "night"],
  [/^(ice|icy|frozen|slippery|skate|skating|snowy)$/, "ice"],
  [/^(fast|speedy|turbo|rush|rushing|hurry|late|deadline|frantic|panicked|speed)$/, "fast"],
  [/^(sleepy|slow|lazy|tired|drowsy|cosy|cozy|calm|gentle)$/, "slow"],
  [/^(tiny|small|little|mini|micro)$/, "tiny"],
  [/^(giant|huge|big|enormous|massive|mega)$/, "giant"],
  [/^(space|orbit|moon|galaxy|zero-g|cosmic|planet|mars)$/, "space"],
  [/^(underwater|ocean|sea|reef|sunken|aquarium)$/, "underwater"],
  [/^(haunted|ghostly|cursed|spooky)$/, "haunted"],
];

const STOP = new Set(
  "a an the of in on at to into onto with from for by and or but is are was be as through across over under around while who that this his her their its your my our very just really some one two three during before after up down out off than then so like about against inside outside near between game".split(" "),
);

const DEFAULTS: Record<Genre, { item: string; itemShape: string; hazard: string; hazardShape: string }> = {
  courier: { item: "parcel", itemShape: "box", hazard: "puddle", hazardShape: "puddle" },
  catcher: { item: "star", itemShape: "star", hazard: "bomb", hazardShape: "bomb" },
  runner: { item: "coin", itemShape: "coin", hazard: "rock", hazardShape: "rock" },
  shooter: { item: "star", itemShape: "star", hazard: "invader", hazardShape: "ufo" },
  maze: { item: "gem", itemShape: "gem", hazard: "ghost", hazardShape: "ghost" },
  breaker: { item: "gem", itemShape: "gem", hazard: "bomb", hazardShape: "bomb" },
  stacker: { item: "box", itemShape: "box", hazard: "wind", hazardShape: "tornado" },
  flyer: { item: "star", itemShape: "star", hazard: "cloud", hazardShape: "cloud" },
};

// Weather words read badly as countable hazards ("the storms hurt"): name the thing that hits you.
const HAZARD_ALIAS: Record<string, string> = {
  storm: "lightning bolt", thunder: "lightning bolt", thunderstorm: "lightning bolt", lightning: "lightning bolt",
  rain: "raindrop", snow: "snowball", blizzard: "snowball", wind: "gust", hurricane: "twister", tornado: "twister",
  fire: "flame", lava: "lava blob", fog: "fog cloud", dust: "dust bunny", traffic: "car", flood: "puddle", water: "wave",
};

const ALT_HAZARDS = [
  { word: "bat", shape: "bat" },
  { word: "slime", shape: "slime" },
  { word: "spike", shape: "spike" },
];

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function singular(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(sses|shes|ches|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

function lookup(table: Record<string, string>, w: string): string | undefined {
  return table[w] ?? table[singular(w)];
}

const VERBISH = /(ing|ed)$/;
const ADJ = /^(angry|happy|sad|brave|tiny|giant|little|big|small|lonely|grumpy|sleepy|hungry|clumsy|fancy|retired|secret|lost|last|first|magic|magical|cursed|haunted|ancient|spooky|cosmic|rainy|stormy|windy|frozen|icy|dark|late|night|midnight|super|mega|ultra|turbo|wobbly|sneaky|lazy|speedy|fast|slow|old|young|new|tired|anxious|cheerful|reluctant|heroic|nervous|overworked|underpaid|feral|polite|rogue|plucky|mighty)$/;

export function parsePitch(raw: string): PitchInfo {
  const pitch = raw.trim().replace(/\s+/g, " ").slice(0, 120);
  const seed = hashString(pitch.toLowerCase());
  const tokens = pitch
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, "").replace(/'s$/, ""))
    .filter(Boolean);

  let genre: Genre | null = null;
  let verb = "";
  let verbIndex = -1;
  tokens.forEach((t, i) => {
    if (genre) return;
    for (const [re, g] of VERBS) {
      if (re.test(t)) {
        genre = g;
        verb = t;
        verbIndex = i;
        return;
      }
    }
  });

  const escapeVerb = /^(escap|flee|outrun|avoid|dodg|surviv|chase|jump|hop|skat|surf|rac|dash|run|sprint|commut|roll)/.test(verb);
  const mods = new Set<string>();
  for (const t of tokens) for (const [re, m] of MODS) if (re.test(t)) mods.add(m);

  let weather: Weather = "clear";
  if (tokens.some((t) => /^(storm|stormy|thunder|thunderstorm|lightning|hurricane|gale)$/.test(t))) weather = "storm";
  else if (tokens.some((t) => /^(rain|rainy|raining|drizzle|monsoon|downpour|puddles?)$/.test(t))) weather = "rain";
  else if (tokens.some((t) => /^(snow|snowy|blizzard|winter|snowstorm|frost|frosty)$/.test(t))) weather = "snow";

  let hero: Thing | null = null;
  let item: Thing | null = null;
  let hazard: Thing | null = null;
  let place: string | null = null;
  let motif = "";
  const words: string[] = [];

  tokens.forEach((t, i) => {
    if (STOP.has(t) || /^\d+$/.test(t)) return;
    const s = singular(t);
    const placeMotif = lookup(PLACES, t);
    if (placeMotif && !place && !(lookup(HEROES, t) && !hero && i < verbIndex)) {
      place = s === "street" ? "streets" : t;
      motif = placeMotif;
      words.push(t);
      return;
    }
    const heroShape = lookup(HEROES, t);
    const itemShape = lookup(ITEMS, t);
    const hazardShape = lookup(HAZARDS, t);
    const afterVerb = verbIndex >= 0 && i > verbIndex;
    if (!hero && heroShape && (!afterVerb || verbIndex < 0)) {
      hero = { word: s, shape: heroShape, known: true };
      words.push(s);
      return;
    }
    if (hero && itemShape && !item && (afterVerb || verbIndex < 0)) {
      item = { word: s, shape: itemShape, known: true };
      words.push(s);
      return;
    }
    if (hero && hazardShape && !hazard) {
      hazard = { word: s, shape: hazardShape, known: true };
      words.push(s);
      return;
    }
    if (!hero && itemShape && !item) {
      item = { word: s, shape: itemShape, known: true };
      words.push(s);
      return;
    }
    // Unknown noun-ish word before the verb becomes the hero; after it, the item
    // (or the obstacle, for running/escaping pitches). A word directly followed
    // by another content word is probably an adjective ("fizzy soda ocean").
    const next = tokens[i + 1];
    const adjectival = next !== undefined && !STOP.has(next) && i + 1 !== verbIndex && !VERBS.some(([re]) => re.test(next));
    if (i !== verbIndex && !ADJ.test(t) && !VERBISH.test(t) && t.length > 2 && !MODS.some(([re]) => re.test(t)) && !adjectival) {
      if (!hero && (i < verbIndex || verbIndex < 0)) {
        hero = { word: s, shape: /(er|or|ist|ian|man|woman|chef)$/.test(s) ? "person" : "blob", known: false };
        words.push(s);
      } else if (hero && afterVerb && (escapeVerb || genre === "runner") && !hazard) {
        hazard = { word: s, shape: hazardShape ?? "rock", known: Boolean(hazardShape) };
        words.push(s);
      } else if (hero && !item && afterVerb && !hazardShape) {
        item = { word: s, shape: "gem", known: false };
        words.push(s);
      }
    }
  });

  if (hazard) {
    const alias = HAZARD_ALIAS[(hazard as Thing).word];
    if (alias) hazard = { ...(hazard as Thing), word: alias };
  }
  const g: Genre = genre ?? pickGenre(seed, mods);
  const d = DEFAULTS[g];
  const finalHero: Thing = hero ?? { word: "hero", shape: "blob", known: false };
  const finalItem: Thing = item ?? { word: d.item, shape: d.itemShape, known: true };
  let finalHazard: Thing = hazard ?? { word: d.hazard, shape: d.hazardShape, known: true };
  if (!hazard && weather === "storm") finalHazard = { word: "lightning bolt", shape: "bolt", known: true };
  else if (!hazard && weather === "rain") finalHazard = { word: "puddle", shape: "puddle", known: true };
  else if (!hazard && weather === "snow") finalHazard = { word: "snowdrift", shape: "cloud", known: true };
  if (finalHazard.shape === finalHero.shape) {
    const alt = ALT_HAZARDS.find((a) => a.shape !== finalHero.shape)!;
    finalHazard = { ...alt, known: true };
  }
  if (!hazard && finalHazard.shape === "cloud" && (motif === "bubbles" || mods.has("underwater"))) {
    finalHazard = { word: "crab", shape: "crab", known: true };
  }

  if (!motif) {
    if (mods.has("space")) motif = "stars";
    else if (mods.has("underwater")) motif = "bubbles";
    else if (weather === "rain" || weather === "storm") motif = "rain";
    else if (weather === "snow") motif = "snow";
    else if (mods.has("night")) motif = "stars";
    else motif = ["city", "sun", "grid", "stars", "leaf"][seed % 5];
  }
  if (weather === "rain" || weather === "storm") {
    if (motif === "sun" || motif === "sky") motif = "rain";
  }

  return {
    pitch,
    seed,
    hero: finalHero,
    item: finalItem,
    hazard: finalHazard,
    verb: verb || verbFor(g),
    genre: g,
    place,
    motif,
    weather,
    mods: [...mods],
    words: words.length ? words : tokens.filter((t) => !STOP.has(t)).slice(0, 4),
  };
}

function pickGenre(seed: number, mods: Set<string>): Genre {
  if (mods.has("space")) return "shooter";
  if (mods.has("underwater")) return "flyer";
  const all: Genre[] = ["courier", "catcher", "runner", "maze", "flyer", "breaker", "stacker", "shooter"];
  return all[seed % all.length];
}

function verbFor(g: Genre): string {
  return {
    courier: "delivering",
    catcher: "catching",
    runner: "running",
    shooter: "defending",
    maze: "collecting",
    breaker: "smashing",
    stacker: "stacking",
    flyer: "flying",
  }[g];
}

export function article(word: string): string {
  return /^[aeiou]/i.test(word) && !/^(uni|use|eu|one)/i.test(word) ? "an" : "a";
}

// Stuff you don't count: "catch the honey", not "catch the honeys".
const MASS = new Set(["honey", "water", "milk", "tea", "coffee", "soup", "cheese", "money", "gold", "energy", "power", "love", "music", "treasure", "laundry", "stardust", "candy", "rice", "sand", "snow", "lava", "fog", "dust", "traffic", "rubble", "ramen", "sushi", "popcorn", "jam", "toast", "bread", "mail"]);

export function plural(word: string): string {
  if (MASS.has(word) || MASS.has(word.split(" ").pop() ?? "")) return word;
  if (/(s|sh|ch|x|z)$/.test(word)) return word + "es";
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
  if (word === "mouse") return "mice";
  if (word === "goose") return "geese";
  if (word === "fish" || word === "sheep") return word;
  return word + "s";
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const GENRE_NAMES: Record<Genre, string> = {
  courier: "top-down delivery dash",
  catcher: "catch-'em-all arcade game",
  runner: "endless runner",
  shooter: "fixed-screen shooter",
  maze: "maze chase",
  breaker: "block breaker",
  stacker: "stacking game",
  flyer: "flap-and-dodge flyer",
};

export const GENRE_CONTROLS: Record<Genre, string> = {
  courier: "4way",
  catcher: "lr",
  runner: "tap",
  shooter: "lr+a",
  maze: "4way",
  breaker: "lr",
  stacker: "tap",
  flyer: "tap",
};

export const PITCH_IDEAS = [
  "a pigeon delivering pizza in a storm",
  "a sleepy ghost collecting lost socks in a haunted library",
  "a robot barista catching falling coffee cups",
  "a tiny frog escaping a lawnmower",
  "a penguin defending the last fish from space crabs",
  "a snail racing a deadline across the city",
  "a wizard stacking pancakes in a windy tower",
  "a goldfish swimming through a flooded kitchen",
  "a grandma smashing alien blocks with a teapot",
  "a bee delivering honey to a grumpy beehive",
  "a cat burglar stealing gems in a dark museum",
  "a jellyfish flying through a fizzy soda ocean",
];
