import type { CardColor, Difficulty, GameEvent, GameState, Ruleset } from "./rules/types";
import type { ChallengeType } from "./challenges/ChallengeDirector";

export type ResultPreview = "round" | "match";

export interface StartMatchDetail {
  playerName: string;
  difficulty: Difficulty;
  ruleset: Ruleset;
  challengePreview?: ChallengeType;
  resultPreview?: ResultPreview;
}

export const gameBus = new EventTarget();

export function emitGameState(state: GameState): void {
  gameBus.dispatchEvent(new CustomEvent<GameState>("state", { detail: state }));
}

export function emitGameEvents(events: GameEvent[]): void {
  for (const event of events) gameBus.dispatchEvent(new CustomEvent<GameEvent>("game-event", { detail: event }));
}

export function requestColor(resolve: (color: Exclude<CardColor, "wild">) => void): void {
  gameBus.dispatchEvent(new CustomEvent("choose-color", { detail: { resolve } }));
}
