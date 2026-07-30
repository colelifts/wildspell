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
    // Freeze is the blue signature spell: it is always castable, then leaves
    // blue as the arena color for the next play.
    if (color === "blue") cards.push(makeCard(color, "freeze", serial++), makeCard(color, "freeze", serial++));
    // Draw spells are powerful and extend matches, so each color gets only one +2.
    cards.push(makeCard(color, "draw2", serial++));
  }
  for (let index = 0; index < 2; index += 1) {
    cards.push(makeCard("wild", "wild4", serial++));
  }
  if (ruleset === "wild") {
    cards.push(
      makeCard("red", "arsonist", serial++),
      makeCard("red", "arsonist", serial++),
      makeCard("green", "whirlwind", serial++),
      makeCard("green", "whirlwind", serial++)
    );
  }
  const shuffled = shuffleSeeded(cards, seed);
  return { cards: shuffled.values, seed: shuffled.seed };
}

export function cardPoints(card: Card): number {
  if (card.kind === "number") return card.value ?? 0;
  if (card.kind === "wild4") return 50;
  if (["arsonist", "whirlwind"].includes(card.kind)) return 35;
  return 20;
}
