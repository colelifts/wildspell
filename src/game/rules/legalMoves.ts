import { isDrawCard } from "./cards";
import type { Card, GameState } from "./types";

export function illegalReason(state: GameState, card: Card, player: 0 | 1): string | null {
  if (state.phase !== "playing") return "The arena is resolving another action.";
  if (state.turn !== player) return `Wait for ${state.names[state.turn]}.`;
  if (state.drawnCardId && state.drawnCardId !== card.id) return "Only the card you just drew can be played now.";
  if (state.statuses[player].burnedCardIds.includes(card.id)) return "That card is burning and cannot be cast until your Burn weakens.";
  if (state.statuses[player].frozenCardIds.includes(card.id)) return "That card is frost-locked for this turn.";
  if (state.drawStack.amount > 0) {
    if (!isDrawCard(card.kind)) return `A +${state.drawStack.amount} stack is active. Counter with another ${state.drawStack.kind === "draw2" ? "+2" : "+4"}.`;
    if (card.kind !== state.drawStack.kind) return `${state.drawStack.kind === "draw2" ? "+2" : "+4"} can only be countered by the same draw spell.`;
    return null;
  }
  // Signature spells are deliberately "always castable" in WildSpell. Their
  // printed color becomes the arena color after resolving, but matching the
  // current discard is never required. Active draw stacks remain the one
  // exception: only the matching counter spell may answer a stack.
  if (card.kind !== "number") return null;
  const top = state.discard.at(-1);
  if (!top) return null;
  if (card.color === "wild") return null;
  if (card.color === state.currentColor) return null;
  if (card.kind === "number" && top.kind === "number" && card.value === top.value) return null;
  return `Match ${state.currentColor}, ${top.kind === "number" ? `the number ${top.value}` : "the spell"}, or play a Wild.`;
}

export const isLegalCard = (state: GameState, card: Card, player: 0 | 1): boolean =>
  illegalReason(state, card, player) === null;

export const legalCards = (state: GameState, player: 0 | 1): Card[] =>
  state.hands[player].filter((card) => isLegalCard(state, card, player));
