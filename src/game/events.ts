import type { CardColor, CardKind, Difficulty, GameEvent, GameState, Ruleset } from "./rules/types";
import type { ChallengeType } from "./challenges/ChallengeDirector";
import type { RoomRecord } from "./multiplayer/protocol";
import type { RoomSession } from "./multiplayer/roomService";

export type ResultPreview = "round" | "match";
export type CharacterId = "kenpachi" | "hisoka" | "gojo" | "mob" | "hit" | "ryuk" | "maki";

export interface StartMatchDetail {
  playerName: string;
  opponentName?: string;
  characterId?: CharacterId;
  difficulty: Difficulty;
  ruleset: Ruleset;
  challengePreview?: ChallengeType;
  spellPreview?: CardKind;
  resultPreview?: ResultPreview;
  online?: { session: RoomSession; room: RoomRecord };
  render?: { width: number; height: number; scale: number };
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
