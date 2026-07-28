import { COLORS, type Card, type CardColor, type CardKind, type Ruleset } from "./types";
import { shuffleSeeded } from "./random";

function makeCard(color: CardColor, kind: CardKind, serial: number, value?: number): Card {
  return { id: `${color}-${kind}-${value ?? "x"}-${serial}`, color, kind, ...(value == null ? {} : { value }) };
}

export function buildDeck(ruleset: Ruleset, seed = 0xc01ecafe): { cards: Card[]; seed: number } {
  const cards: Card[] = [];
  let serial = 0;
  for (const color of COLORS) {
    cards.push(makeCard(color, "number", serial++, 0));
    for (let value = 1; value <= 9; value += 1) {
      cards.push(makeCard(color, "number", serial++, value), makeCard(color, "number", serial++, value));
    }
    for (const kind of ["freeze", "rewind", "draw2"] as const) {
      cards.push(makeCard(color, kind, serial++), makeCard(color, kind, serial++));
    }
  }
  for (let index = 0; index < 4; index += 1) {
    cards.push(makeCard("wild", "prism", serial++), makeCard("wild", "wild4", serial++));
  }
  if (ruleset === "wild") {
    cards.push(
      makeCard("red", "arsonist", serial++),
      makeCard("red", "arsonist", serial++),
      makeCard("green", "whirlwind", serial++),
      makeCard("green", "whirlwind", serial++),
      makeCard("yellow", "stormcall", serial++),
      makeCard("yellow", "stormcall", serial++),
      makeCard("blue", "frostbite", serial++),
      makeCard("blue", "frostbite", serial++),
      makeCard("wild", "mirror", serial++),
      makeCard("wild", "mirror", serial++),
      makeCard("wild", "cleanse", serial++),
      makeCard("wild", "cleanse", serial++)
    );
  }
  const shuffled = shuffleSeeded(cards, seed);
  return { cards: shuffled.values, seed: shuffled.seed };
}

export function cardPoints(card: Card): number {
  if (card.kind === "number") return card.value ?? 0;
  if (card.kind === "wild4" || card.kind === "prism" || card.kind === "mirror" || card.kind === "cleanse") return 50;
  if (["arsonist", "whirlwind", "stormcall", "frostbite"].includes(card.kind)) return 35;
  return 20;
}
