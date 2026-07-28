import type { CardKind } from "./types";

export const CARD_NAMES: Record<CardKind, string> = {
  number: "Number",
  freeze: "Freeze",
  rewind: "Rewind",
  draw2: "Arcane +2",
  prism: "Prism Shift",
  wild4: "Chaos +4",
  arsonist: "Arsonist",
  whirlwind: "Whirlwind Swap",
  stormcall: "Stormcall",
  frostbite: "Frostbite",
  mirror: "Mirror Trick",
  cleanse: "Cleanse"
};

export const CARD_GLYPHS: Record<CardKind, string> = {
  number: "",
  freeze: "❄",
  rewind: "↶",
  draw2: "+2",
  prism: "✦",
  wild4: "+4",
  arsonist: "♨",
  whirlwind: "◌",
  stormcall: "ϟ",
  frostbite: "◇",
  mirror: "◈",
  cleanse: "✧"
};

export const SPECIAL_KINDS = new Set<CardKind>([
  "freeze",
  "rewind",
  "draw2",
  "prism",
  "wild4",
  "arsonist",
  "whirlwind",
  "stormcall",
  "frostbite",
  "mirror",
  "cleanse"
]);

export const isDrawCard = (kind: CardKind): kind is "draw2" | "wild4" =>
  kind === "draw2" || kind === "wild4";
