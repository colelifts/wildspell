export const COLORS = ["red", "blue", "green", "yellow"] as const;
export type CardColor = (typeof COLORS)[number] | "wild";
export type Ruleset = "classic" | "wild";
export type Difficulty = "easy" | "normal" | "hard" | "nightmare";

export type CardKind =
  | "number"
  | "freeze"
  | "rewind"
  | "draw2"
  | "prism"
  | "wild4"
  | "arsonist"
  | "whirlwind"
  | "stormcall"
  | "frostbite"
  | "mirror"
  | "cleanse";

export interface Card {
  id: string;
  color: CardColor;
  kind: CardKind;
  value?: number;
}

export interface PlayerStatus {
  burn: 0 | 1 | 2;
  burnedCardIds: string[];
  frozenCardIds: string[];
  stormcall: boolean;
}

export type GamePhase = "playing" | "color-choice" | "challenge" | "round-over" | "match-over";

export type GameEvent =
  | { type: "card-played"; actor: number; target: number; card: Card }
  | { type: "cards-drawn"; actor: number; count: number; reason: string }
  | { type: "spell"; actor: number; target: number; spell: CardKind; copiedSpell?: CardKind }
  | { type: "status"; actor: number; status: "burn" | "frozen" | "stormcall" | "cleanse"; amount?: number }
  | { type: "stack"; actor: number; amount: number }
  | { type: "invalid"; actor: number; reason: string }
  | { type: "turn"; actor: number }
  | { type: "final-card"; actor: number; success: boolean }
  | { type: "round-won"; actor: number }
  | { type: "match-won"; actor: number };

export interface GameState {
  ruleset: Ruleset;
  difficulty: Difficulty;
  names: [string, string];
  hands: [Card[], Card[]];
  drawPile: Card[];
  discard: Card[];
  currentColor: Exclude<CardColor, "wild">;
  turn: 0 | 1;
  turnNumber: number;
  roundNumber: number;
  drawStack: { amount: number; kind: "draw2" | "wild4" | null };
  statuses: [PlayerStatus, PlayerStatus];
  finalCalled: [boolean, boolean];
  challengeOwner: 0 | 1 | null;
  drawnCardId: string | null;
  lastSpecial: CardKind | null;
  phase: GamePhase;
  roundWinner: 0 | 1 | null;
  scores: [number, number];
  targetScore: number;
  rngSeed: number;
  events: GameEvent[];
}

export type GameCommand =
  | { type: "play"; player: 0 | 1; cardId: string; colorChoice?: Exclude<CardColor, "wild"> }
  | { type: "draw"; player: 0 | 1 }
  | { type: "pass"; player: 0 | 1 }
  | { type: "call-final"; player: 0 | 1 };

export interface CommandResult {
  accepted: boolean;
  reason?: string;
  state: GameState;
}
