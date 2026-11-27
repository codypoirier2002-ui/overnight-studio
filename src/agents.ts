// The night-shift crew. Everyone here is invented.

export type AgentId = "designer" | "coder" | "artist" | "tester";

export interface AgentLook {
  skin: string;
  hair: string;
  hairStyle: "bun" | "messy" | "beanie" | "curly";
  shirt: string;
  shirtTrim: string;
  extra: "glasses" | "headphones" | "paint" | "bandana";
  extraColor: string;
}

export interface Mug {
  name: string;
  body: string;
  stripe: string;
  drink: string;
  description: string;
}

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  color: string; // diary accent
  personality: string;
  catchphrases: string[];
  mug: Mug;
  look: AgentLook;
}

export const AGENTS: Record<AgentId, Agent> = {
  designer: {
    id: "designer",
    name: "Juno",
    role: "Designer",
    color: "#ff9e7a",
    personality:
      "Big-hearted ideas person. Talks in 'player fantasies', keeps a notebook of v2 ideas that is now three notebooks, and would add a grappling hook to a crossword.",
    catchphrases: ["What's the fantasy here?", "Hear me out.", "Okay, but what if..."],
    mug: {
      name: "The Lighthouse",
      body: "#f4efe6",
      stripe: "#e2574c",
      drink: "oat chai",
      description: "A tall red-and-cream striped mug. Always oat chai, always slightly too hot.",
    },
    look: {
      skin: "#e8b48f",
      hair: "#6b2f3a",
      hairStyle: "bun",
      shirt: "#e46f5a",
      shirtTrim: "#ffc8a8",
      extra: "glasses",
      extraColor: "#2a1d2e",
    },
  },
  coder: {
    id: "coder",
    name: "Bram",
    role: "Coder",
    color: "#7fd6c2",
    personality:
      "Calm, dry and allergic to scope creep. Ships on time by saying 'that's a v2 feature' about forty times a night. Consults the desk duck before every build.",
    catchphrases: ["That's a v2 feature.", "Compiling. Don't touch anything.", "The duck approves."],
    mug: {
      name: "TODO: coffee",
      body: "#25222b",
      stripe: "#7fd6c2",
      drink: "black coffee",
      description: "A matte black mug with '// TODO: coffee' printed on it. The TODO is never done.",
    },
    look: {
      skin: "#c98b62",
      hair: "#1f1a24",
      hairStyle: "messy",
      shirt: "#2f6f6a",
      shirtTrim: "#7fd6c2",
      extra: "headphones",
      extraColor: "#dfe6e9",
    },
  },
  artist: {
    id: "artist",
    name: "Wren",
    role: "Artist",
    color: "#ffd56b",
    personality:
      "Palette purist. Believes any game can be made beautiful with four colours and a stubborn attitude. Names every colour like it's a paint sample.",
    catchphrases: ["Four colours. Maybe five.", "Trust the palette.", "It needs one more highlight."],
    mug: {
      name: "Drip",
      body: "#7a5cff",
      stripe: "#ffd56b",
      drink: "peppermint tea",
      description: "A hand-painted purple mug with yellow drips. Wren painted it during a crunch and won't say which one.",
    },
    look: {
      skin: "#f1c9a5",
      hair: "#e9a23b",
      hairStyle: "beanie",
      shirt: "#5a4fcf",
      shirtTrim: "#ffd56b",
      extra: "paint",
      extraColor: "#ff6fb5",
    },
  },
  tester: {
    id: "tester",
    name: "Moss",
    role: "Playtester",
    color: "#a6e36b",
    personality:
      "Gleeful chaos gremlin. Plays every game wrong on purpose, keeps the Bug Jar, and treats a crash like a birthday present.",
    catchphrases: ["Can I break it?", "Into the Bug Jar!", "Again. One more run."],
    mug: {
      name: "The Bug Jar",
      body: "#b8e3ff",
      stripe: "#a6e36b",
      drink: "lemon fizz",
      description: "A huge glass jar with a handle, labelled BUG JAR. Holds lemon fizz and, legally, no bugs.",
    },
    look: {
      skin: "#8d5a3b",
      hair: "#3f7d3a",
      hairStyle: "curly",
      shirt: "#f3f0e6",
      shirtTrim: "#4aa3df",
      extra: "bandana",
      extraColor: "#a6e36b",
    },
  },
};

export const AGENT_ORDER: AgentId[] = ["designer", "coder", "artist", "tester"];
