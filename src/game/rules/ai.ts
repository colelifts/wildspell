import { legalCards } from "./legalMoves";
import { nextRandom } from "./random";
import type { Card, GameState } from "./types";

function scoreCard(card: Card, state: GameState): number {
  const opponentCards = state.hands[0].length;
  let score = card.kind === "number" ? (card.value ?? 0) * 0.15 : 3;
  if (card.kind === "wild4") score += opponentCards <= 3 ? 12 : 6;
  if (card.kind === "draw2" || card.kind === "freeze") score += opponentCards <= 3 ? 9 : 4;
  if (card.kind === "arsonist" && state.statuses[0].burn < 2) score += 8;
  if (card.kind === "stormcall") score += 6;
  if (card.kind === "frostbite") score += 5;
  if (card.kind === "cleanse" && (state.statuses[1].burn || state.statuses[1].stormcall || state.statuses[1].frozenCardIds.length)) score += 14;
  if (card.kind === "whirlwind" && state.hands[1].length > state.hands[0].length) score += 5;
  return score;
}

export function chooseAiCard(state: GameState): Card | null {
  const options = legalCards(state, 1);
  if (!options.length) return null;
  const [random, seed] = nextRandom(state.rngSeed);
  state.rngSeed = seed;
  if (state.difficulty === "easy") return options[Math.floor(random * options.length)] ?? options[0]!;
  const factor = state.difficulty === "normal" ? 0.8 : state.difficulty === "hard" ? 1.2 : 1.65;
  return [...options].sort((a, b) => scoreCard(b, state) * factor - scoreCard(a, state) * factor)[0]!;
}

export function chooseAiColor(state: GameState): "red" | "blue" | "green" | "yellow" {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const card of state.hands[1]) if (card.color !== "wild") counts[card.color] += 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0] as keyof typeof counts;
}
