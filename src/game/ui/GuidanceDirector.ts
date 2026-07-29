import { legalCards } from "../rules/legalMoves";
import type { GameState } from "../rules/types";

export function guidanceFor(state: GameState, player: 0 | 1): string {
  if (state.phase === "challenge") return "Final Card challenge! Win to stay safe.";
  if (state.phase === "round-over") return state.roundWinner === player ? "Round won — the arena is yours!" : "Round lost. Prepare your counterspell.";
  if (state.turn !== player) return `Waiting for ${state.names[state.turn]}…`;
  if (state.drawStack.amount) return `A +${state.drawStack.amount} stack is charged. Stack another draw spell or take the full blast.`;
  if (state.drawnCardId) {
    const drawn = state.hands[player].find((card) => card.id === state.drawnCardId);
    const playable = drawn && legalCards(state, player).some((card) => card.id === drawn.id);
    return playable ? "Your drawn card is playable. Cast it or end your turn." : "The drawn card cannot be played. End your turn.";
  }
  if (state.hands[player].length === 2 && !state.finalCalled[player]) return "Call FINAL CARD before playing down to one!";
  if (state.statuses[player].stormcall) return "Stormcall crackles around you. Answer with yellow or Wild to avoid drawing two.";
  const legal = legalCards(state, player);
  if (!legal.length) return "No legal card — drawing automatically until a playable card appears.";
  return `Cast ${state.currentColor}, match the discard, use a Wild, or draw. ${legal.length} legal card${legal.length === 1 ? "" : "s"}.`;
}
