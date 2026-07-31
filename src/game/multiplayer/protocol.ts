import type { GameCommand, GameState, Ruleset } from "../rules/types";
import type { ChallengeType } from "../challenges/ChallengeDirector";
import type { CharacterId, WildSpellMode } from "../events";
import type { KnockoutInput, KnockoutState } from "../knockout/types";

export const PROTOCOL_VERSION = 1;

export interface RoomPlayer {
  uid: string;
  name: string;
  characterId: CharacterId;
  joinedAt: number;
}

export interface RoomRecord {
  version: typeof PROTOCOL_VERSION;
  hostUid: string;
  ruleset: Ruleset;
  gameMode?: WildSpellMode;
  status: "waiting" | "playing" | "complete";
  createdAt: number;
  updatedAt: number;
  players: Partial<Record<0 | 1, RoomPlayer>>;
  revision: number;
  state?: GameState;
  knockout?: {
    state: KnockoutState;
    inputs: Partial<Record<0 | 1, KnockoutInput>>;
  };
  challenge?: {
    id: string;
    type: ChallengeType;
    startedAt: number;
    scores: Partial<Record<0 | 1, number>>;
  };
  presence?: Partial<Record<0 | 1, PresenceRecord>>;
}

export interface CommandEnvelope {
  id: string;
  roomCode: string;
  playerUid: string;
  expectedRevision: number;
  createdAt: number;
  command: GameCommand;
}

export interface PresenceRecord {
  uid: string;
  connected: boolean;
  lastSeen: number | object;
}
