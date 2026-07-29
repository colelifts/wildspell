import { isDrawCard, SPECIAL_KINDS } from "./cards";
import { buildDeck, cardPoints } from "./deck";
import { illegalReason } from "./legalMoves";
import { randomIndex, shuffleSeeded } from "./random";
import type { Card, CardKind, CommandResult, Difficulty, GameCommand, GameEvent, GameState, PlayerStatus, Ruleset } from "./types";

const emptyStatus = (): PlayerStatus => ({ burn: 0, burnedCardIds: [], frozenCardIds: [], stormcall: false });
const other = (player: 0 | 1): 0 | 1 => (player === 0 ? 1 : 0);

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function emit(state: GameState, event: GameEvent): void {
  state.events.push(event);
}

function refill(state: GameState): void {
  if (state.drawPile.length || state.discard.length <= 1) return;
  const top = state.discard.pop()!;
  const shuffled = shuffleSeeded(state.discard, state.rngSeed);
  state.rngSeed = shuffled.seed;
  state.drawPile = shuffled.values;
  state.discard = [top];
}

function drawCards(state: GameState, player: 0 | 1, count: number, reason: string): void {
  let drawn = 0;
  while (drawn < count) {
    refill(state);
    const card = state.drawPile.pop();
    if (!card) break;
    state.hands[player].push(card);
    drawn += 1;
  }
  emit(state, { type: "cards-drawn", actor: player, count: drawn, reason });
}

function drawUntilPlayable(state: GameState, player: 0 | 1): boolean {
  let drawn = 0;
  state.drawnCardId = null;
  while (true) {
    refill(state);
    const card = state.drawPile.pop();
    if (!card) break;
    state.hands[player].push(card);
    drawn += 1;
    state.drawnCardId = card.id;
    if (!illegalReason(state, card, player)) break;
    state.drawnCardId = null;
  }
  emit(state, { type: "cards-drawn", actor: player, count: drawn, reason: "until playable" });
  return Boolean(state.drawnCardId);
}

function chooseColor(hand: Card[]): "red" | "blue" | "green" | "yellow" {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const card of hand) if (card.color !== "wild") counts[card.color] += 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "red") as keyof typeof counts;
}

function markRandomCards(state: GameState, player: 0 | 1, count: number): string[] {
  const choices = state.hands[player].filter((card) => !state.statuses[player].frozenCardIds.includes(card.id));
  const selected: string[] = [];
  while (choices.length && selected.length < count) {
    const [index, seed] = randomIndex(state.rngSeed, choices.length);
    state.rngSeed = seed;
    selected.push(choices.splice(index, 1)[0]!.id);
  }
  return selected;
}

function finishTurnStatuses(state: GameState, player: 0 | 1, playedColor: Card["color"] | null): void {
  const status = state.statuses[player];
  if (status.stormcall) {
    if (playedColor !== "yellow" && playedColor !== "wild") drawCards(state, player, 2, "Stormcall");
    status.stormcall = false;
  }
  if (status.burn > 0) {
    if (playedColor === "red") status.burn = Math.max(0, status.burn - 1) as 0 | 1 | 2;
    else {
      drawCards(state, player, status.burn, "Burn");
      status.burn = Math.min(2, status.burn + 1) as 0 | 1 | 2;
    }
    status.burnedCardIds = markRandomCards(state, player, status.burn);
  }
  status.frozenCardIds = [];
}

function applySpell(state: GameState, card: Card, player: 0 | 1, chosen?: "red" | "blue" | "green" | "yellow", copied = false): boolean {
  const target = other(player);
  let spell = card.kind;
  if (spell === "mirror") {
    spell = state.lastSpecial && state.lastSpecial !== "mirror" ? state.lastSpecial : "freeze";
    emit(state, { type: "spell", actor: player, target, spell: "mirror", copiedSpell: spell });
  } else emit(state, { type: "spell", actor: player, target, spell });

  switch (spell) {
    case "freeze":
      state.turn = player;
      emit(state, { type: "status", actor: target, status: "frozen" });
      return true;
    case "rewind":
      state.turn = player;
      return true;
    case "draw2":
    case "wild4":
      state.drawStack.amount += spell === "draw2" ? 2 : 4;
      state.drawStack.kind = spell;
      emit(state, { type: "stack", actor: player, amount: state.drawStack.amount });
      break;
    case "prism":
      state.currentColor = chosen ?? chooseColor(state.hands[player]);
      break;
    case "arsonist": {
      const status = state.statuses[target];
      status.burn = Math.min(2, status.burn + 1) as 0 | 1 | 2;
      status.burnedCardIds = markRandomCards(state, target, status.burn);
      emit(state, { type: "status", actor: target, status: "burn", amount: status.burn });
      break;
    }
    case "whirlwind": {
      if (state.hands[player].length && state.hands[target].length) {
        const [aIndex, seedA] = randomIndex(state.rngSeed, state.hands[player].length);
        const [bIndex, seedB] = randomIndex(seedA, state.hands[target].length);
        state.rngSeed = seedB;
        const own = state.hands[player].splice(aIndex, 1)[0]!;
        const theirs = state.hands[target].splice(bIndex, 1)[0]!;
        state.hands[player].push(theirs);
        state.hands[target].push(own);
      }
      break;
    }
    case "stormcall":
      state.statuses[target].stormcall = true;
      emit(state, { type: "status", actor: target, status: "stormcall" });
      break;
    case "frostbite": {
      const ids = markRandomCards(state, target, 1);
      state.statuses[target].frozenCardIds = ids;
      emit(state, { type: "status", actor: target, status: "frozen" });
      break;
    }
    case "cleanse":
      state.statuses[player] = emptyStatus();
      state.currentColor = chosen ?? chooseColor(state.hands[player]);
      emit(state, { type: "status", actor: player, status: "cleanse" });
      break;
    case "number":
      break;
  }
  if (!copied && SPECIAL_KINDS.has(card.kind) && card.kind !== "mirror") state.lastSpecial = card.kind;
  state.turn = target;
  return false;
}

export function createGame(names: [string, string], ruleset: Ruleset, difficulty: Difficulty, seed = 0xc01ecafe): GameState {
  const deck = buildDeck(ruleset, seed);
  const cards = deck.cards;
  const hands: [Card[], Card[]] = [cards.splice(-7), cards.splice(-7)];
  let first = cards.pop()!;
  while (first.color === "wild" || first.kind !== "number") {
    cards.unshift(first);
    first = cards.pop()!;
  }
  return {
    ruleset,
    difficulty,
    names,
    hands,
    drawPile: cards,
    discard: [first],
    currentColor: first.color as GameState["currentColor"],
    turn: 0,
    turnNumber: 1,
    drawStack: { amount: 0, kind: null },
    statuses: [emptyStatus(), emptyStatus()],
    finalCalled: [false, false],
    challengeOwner: null,
    drawnCardId: null,
    lastSpecial: null,
    phase: "playing",
    roundWinner: null,
    scores: [0, 0],
    targetScore: 200,
    rngSeed: deck.seed,
    events: [{ type: "turn", actor: 0 }]
  };
}

function reject(state: GameState, player: 0 | 1, reason: string): CommandResult {
  const next = cloneState(state);
  next.events = [{ type: "invalid", actor: player, reason }];
  return { accepted: false, reason, state: next };
}

export function reduceGame(current: GameState, command: GameCommand): CommandResult {
  const state = cloneState(current);
  state.events = [];
  if (command.player !== state.turn) return reject(current, command.player, `Wait for ${state.names[state.turn]}.`);
  if (state.phase !== "playing") return reject(current, command.player, "The arena is resolving another action.");

  if (command.type === "call-final") {
    if (state.hands[command.player].length !== 2) return reject(current, command.player, "Call Final Card only when you have exactly two cards.");
    state.finalCalled[command.player] = true;
    emit(state, { type: "final-card", actor: command.player, success: true });
    return { accepted: true, state };
  }

  if (command.type === "draw") {
    if (state.drawnCardId) return reject(current, command.player, "Play or pass the card you already drew.");
    const playable = state.hands[command.player].some((card) => !illegalReason(state, card, command.player));
    if (playable) return reject(current, command.player, "You already have a playable card.");
    if (state.drawStack.amount > 0) {
      const amount = state.drawStack.amount;
      drawCards(state, command.player, amount, `+${amount} stack`);
      state.drawStack = { amount: 0, kind: null };
      finishTurnStatuses(state, command.player, null);
      state.turn = other(command.player);
      state.turnNumber += 1;
    } else {
      const foundPlayable = drawUntilPlayable(state, command.player);
      if (!foundPlayable) {
        finishTurnStatuses(state, command.player, null);
        state.turn = other(command.player);
        state.turnNumber += 1;
      }
    }
    emit(state, { type: "turn", actor: state.turn });
    return { accepted: true, state };
  }

  if (command.type === "pass") {
    if (!state.drawnCardId) return reject(current, command.player, "Draw a card before ending the turn.");
    state.drawnCardId = null;
    finishTurnStatuses(state, command.player, null);
    state.turn = other(command.player);
    state.turnNumber += 1;
    emit(state, { type: "turn", actor: state.turn });
    return { accepted: true, state };
  }

  const index = state.hands[command.player].findIndex((card) => card.id === command.cardId);
  if (index < 0) return reject(current, command.player, "That card is no longer in your hand.");
  const card = state.hands[command.player][index]!;
  const reason = illegalReason(state, card, command.player);
  if (reason) return reject(current, command.player, reason);
  if ((card.color === "wild" || card.kind === "cleanse") && !command.colorChoice) {
    return reject(current, command.player, "Choose the next color before casting this card.");
  }

  state.hands[command.player].splice(index, 1);
  state.discard.push(card);
  state.currentColor = card.color === "wild" ? command.colorChoice! : card.color;
  state.drawnCardId = null;
  emit(state, { type: "card-played", actor: command.player, target: other(command.player), card });
  const keepsTurn = card.kind === "number" ? false : applySpell(state, card, command.player, command.colorChoice);
  if (card.kind === "number") state.turn = other(command.player);

  if (state.hands[command.player].length === 1) {
    if (!state.finalCalled[command.player]) {
      drawCards(state, command.player, 2, "missed Final Card call");
      emit(state, { type: "final-card", actor: command.player, success: false });
    } else if (state.ruleset === "wild") {
      state.phase = "challenge";
      state.challengeOwner = command.player;
    }
  }
  state.finalCalled[command.player] = false;

  if (state.hands[command.player].length === 0) {
    state.roundWinner = command.player;
    state.phase = "round-over";
    const points = state.hands[other(command.player)].reduce((sum, item) => sum + cardPoints(item), 0);
    state.scores[command.player] += points;
    emit(state, { type: "round-won", actor: command.player });
  } else if (!keepsTurn && state.phase === "playing") {
    finishTurnStatuses(state, command.player, card.color);
    state.turnNumber += 1;
    emit(state, { type: "turn", actor: state.turn });
  }
  return { accepted: true, state };
}

export function resolveChallenge(current: GameState, playerScore: number, opponentScore: number): GameState {
  const state = cloneState(current);
  state.events = [];
  if (state.phase !== "challenge" || state.challengeOwner == null) return state;
  const owner = state.challengeOwner;
  const ownerWon = owner === 0 ? playerScore >= opponentScore : opponentScore >= playerScore;
  if (!ownerWon) drawCards(state, owner, 2, "lost Final Card challenge");
  emit(state, { type: "final-card", actor: owner, success: ownerWon });
  state.phase = "playing";
  state.challengeOwner = null;
  return state;
}
