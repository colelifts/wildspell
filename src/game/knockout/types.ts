import type { CharacterId } from "../events";

export type KnockoutPhase = "countdown" | "playing" | "round-over";

export interface KnockoutInput {
  move: -1 | 0 | 1;
  jump: boolean;
  attack: boolean;
  dodge: boolean;
  ability: boolean;
  sequence: number;
}

export interface KnockoutFighter {
  characterId: CharacterId;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  facing: -1 | 1;
  damage: number;
  lives: number;
  grounded: boolean;
  hitstunMs: number;
  invulnerableMs: number;
  attackMs: number;
  dodgeCooldownMs: number;
  abilityCooldownMs: number;
  abilityActiveMs: number;
  markedMs: number;
}

export interface KnockoutState {
  version: 1;
  tick: number;
  phase: KnockoutPhase;
  countdownMs: number;
  elapsedMs: number;
  winner: 0 | 1 | null;
  fighters: [KnockoutFighter, KnockoutFighter];
  inputs: [KnockoutInput, KnockoutInput];
  lastHit?: {
    attacker: 0 | 1;
    target: 0 | 1;
    power: number;
    kind: "attack" | "ability";
    tick: number;
  };
}

export interface KnockoutCharacterDefinition {
  name: string;
  title: string;
  ability: string;
  abilityDescription: string;
  abilityCooldownMs: number;
  speed: number;
  jump: number;
  weight: number;
  attackPower: number;
  accent: number;
}

export const EMPTY_KNOCKOUT_INPUT: KnockoutInput = {
  move: 0,
  jump: false,
  attack: false,
  dodge: false,
  ability: false,
  sequence: 0
};
