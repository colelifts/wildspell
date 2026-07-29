import type { GameEvent, GameState, PlayerStatus } from "../rules/types";

const flip = (value: number): 0 | 1 => value === 0 ? 1 : 0;

function flipEvent(event: GameEvent): GameEvent {
  const next = structuredClone(event) as GameEvent & { actor: number; target?: number };
  next.actor = flip(next.actor);
  if (typeof next.target === "number") next.target = flip(next.target);
  return next;
}

const emptyStatus = (): PlayerStatus => ({ burn: 0, burnedCardIds: [], frozenCardIds: [], stormcall: false });

export function hydrateGameState(raw: GameState): GameState {
  const state = structuredClone(raw);
  const status = (value: Partial<PlayerStatus> | undefined): PlayerStatus => ({
    ...emptyStatus(),
    ...value,
    burn: value?.burn ?? 0,
    burnedCardIds: value?.burnedCardIds ?? [],
    frozenCardIds: value?.frozenCardIds ?? [],
    stormcall: value?.stormcall ?? false
  });
  state.hands = [state.hands?.[0] ?? [], state.hands?.[1] ?? []];
  state.statuses = [status(state.statuses?.[0]), status(state.statuses?.[1])];
  state.finalCalled = [state.finalCalled?.[0] ?? false, state.finalCalled?.[1] ?? false];
  state.scores = [state.scores?.[0] ?? 0, state.scores?.[1] ?? 0];
  state.drawPile = state.drawPile ?? [];
  state.discard = state.discard ?? [];
  state.events = state.events ?? [];
  state.drawStack = { amount: state.drawStack?.amount ?? 0, kind: state.drawStack?.kind ?? null };
  state.drawnCardId = state.drawnCardId ?? null;
  state.lastSpecial = state.lastSpecial ?? null;
  state.challengeOwner = state.challengeOwner ?? null;
  state.roundWinner = state.roundWinner ?? null;
  state.roundNumber = state.roundNumber ?? 1;
  state.turnNumber = state.turnNumber ?? 1;
  state.targetScore = state.targetScore ?? 200;
  return state;
}

export function stateForSlot(state: GameState, slot: 0 | 1): GameState {
  const hydrated = hydrateGameState(state);
  const next = structuredClone(hydrated);
  if (slot === 0) return next;
  next.names = [hydrated.names[1], hydrated.names[0]];
  next.hands = [structuredClone(hydrated.hands[1]), structuredClone(hydrated.hands[0])];
  next.statuses = [structuredClone(hydrated.statuses[1]), structuredClone(hydrated.statuses[0])];
  next.finalCalled = [hydrated.finalCalled[1], hydrated.finalCalled[0]];
  next.scores = [hydrated.scores[1], hydrated.scores[0]];
  next.turn = flip(hydrated.turn);
  next.roundWinner = hydrated.roundWinner == null ? null : flip(hydrated.roundWinner);
  next.challengeOwner = hydrated.challengeOwner == null ? null : flip(hydrated.challengeOwner);
  next.events = hydrated.events.map(flipEvent);
  return next;
}
