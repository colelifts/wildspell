import { describe, expect, it } from "vitest";
import { buildDeck } from "../../src/game/rules/deck";
import { illegalReason, isLegalCard } from "../../src/game/rules/legalMoves";
import { advanceRound, createGame, reduceGame, resolveChallenge, restartMatch } from "../../src/game/rules/reducer";
import type { Card, CardColor, CardKind, GameState } from "../../src/game/rules/types";
import { hydrateGameState, stateForSlot } from "../../src/game/multiplayer/perspective";

let serial = 0;
const card = (color: CardColor, kind: CardKind, value?: number): Card => ({ id: `test-${serial++}`, color, kind, ...(value == null ? {} : { value }) });

function stateWith(hands: [Card[], Card[]], top = card("red", "number", 5), ruleset: "classic" | "wild" = "wild"): GameState {
  const state = createGame(["Cole", "Skeleton"], ruleset, "hard", 42);
  state.hands = hands;
  state.discard = [top];
  state.currentColor = top.color === "wild" ? "red" : top.color;
  state.turn = 0;
  state.events = [];
  return state;
}

describe("deck", () => {
  it("builds deterministic Classic and Wild decks", () => {
    expect(buildDeck("classic", 7).cards).toHaveLength(96);
    expect(buildDeck("wild", 7).cards).toHaveLength(100);
    expect(buildDeck("wild", 7).cards.map((item) => item.id)).toEqual(buildDeck("wild", 7).cards.map((item) => item.id));
    const liveSpecials = [...new Set(buildDeck("wild", 7).cards.filter((item) => item.kind !== "number").map((item) => item.kind))].sort();
    expect(liveSpecials).toEqual(["arsonist", "draw2", "freeze", "whirlwind", "wild4"]);
  });
});

describe("legal moves", () => {
  it("matches color, number, spell, or wild and explains rejection", () => {
    const red = card("red", "number", 9);
    const nine = card("blue", "number", 9);
    const freeze = card("green", "freeze");
    const wild = card("wild", "prism");
    const bad = card("blue", "number", 2);
    const state = stateWith([[red, nine, freeze, wild, bad], []], card("green", "number", 9));
    expect([red, nine, freeze, wild].map((item) => isLegalCard(state, item, 0))).toEqual([true, true, true, true]);
    expect(illegalReason(state, bad, 0)).toContain("Match green");
  });

  it("locks a frostbitten card", () => {
    const frozen = card("red", "number", 2);
    const state = stateWith([[frozen], []], card("red", "number", 8));
    state.statuses[0].frozenCardIds = [frozen.id];
    expect(illegalReason(state, frozen, 0)).toContain("frost-locked");
  });
});

describe("turn spells", () => {
  it.each(["freeze", "rewind"] as const)("%s grants another turn in 1v1", (kind) => {
    const spell = card("red", kind);
    const result = reduceGame(stateWith([[spell, card("blue", "number", 1)], [card("blue", "number", 2)]]), { type: "play", player: 0, cardId: spell.id });
    expect(result.accepted).toBe(true);
    expect(result.state.turn).toBe(0);
  });
});

describe("draw stacking", () => {
  it("allows same-type classic stacks and makes the next player take the full amount", () => {
    const first = card("red", "draw2");
    const second = card("blue", "draw2");
    let state = stateWith([[first, card("green", "number", 1)], [second, card("yellow", "number", 2)]], card("red", "number", 4), "classic");
    state = reduceGame(state, { type: "play", player: 0, cardId: first.id }).state;
    expect(state.drawStack.amount).toBe(2);
    state = reduceGame(state, { type: "play", player: 1, cardId: second.id }).state;
    expect(state.drawStack.amount).toBe(4);
    const before = state.hands[0].length;
    state = reduceGame(state, { type: "draw", player: 0 }).state;
    expect(state.hands[0]).toHaveLength(before + 4);
    expect(state.drawStack.amount).toBe(0);
    expect(state.turn).toBe(1);
  });

  it("rejects mixed stacks in Classic and permits them in Wild", () => {
    const plusFour = card("wild", "wild4");
    const classic = stateWith([[plusFour], []], card("red", "draw2"), "classic");
    classic.drawStack = { amount: 2, kind: "draw2" };
    expect(illegalReason(classic, plusFour, 0)).toContain("Classic Mode");
    const wild = structuredClone(classic); wild.ruleset = "wild";
    expect(illegalReason(wild, plusFour, 0)).toBeNull();
  });
});

describe("automatic forced draws", () => {
  it("draws through unusable cards until the first legal card", () => {
    const bad = card("blue", "number", 2);
    const playable = card("red", "number", 7);
    const state = stateWith([[card("green", "number", 1)], [card("yellow", "number", 3)]], card("red", "number", 5));
    state.drawPile = [playable, bad];
    const result = reduceGame(state, { type: "draw", player: 0 });
    expect(result.accepted).toBe(true);
    expect(result.state.hands[0].map((item) => item.id)).toContain(bad.id);
    expect(result.state.hands[0].map((item) => item.id)).toContain(playable.id);
    expect(result.state.drawnCardId).toBe(playable.id);
    expect(result.state.turn).toBe(0);
    expect(result.state.events).toContainEqual(expect.objectContaining({ type: "cards-drawn", count: 2, reason: "until playable" }));
  });

  it("ends the turn when the available deck contains no legal card", () => {
    const state = stateWith([[card("green", "number", 1)], [card("yellow", "number", 3)]], card("red", "number", 5));
    state.drawPile = [card("blue", "number", 2), card("green", "number", 8)];
    const result = reduceGame(state, { type: "draw", player: 0 });
    expect(result.accepted).toBe(true);
    expect(result.state.drawnCardId).toBeNull();
    expect(result.state.turn).toBe(1);
    expect(result.state.turnNumber).toBe(state.turnNumber + 1);
  });

  it("refuses a voluntary draw while a legal play is available", () => {
    const state = stateWith([[card("red", "number", 1)], [card("yellow", "number", 3)]], card("red", "number", 5));
    const result = reduceGame(state, { type: "draw", player: 0 });
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("already have a playable card");
  });
});

describe("Wild statuses and spells", () => {
  it("Arsonist applies Burn and unanswered Burn draws then grows to two", () => {
    const arsonist = card("red", "arsonist");
    let state = stateWith([[arsonist, card("green", "number", 1), card("yellow", "number", 6)], [card("red", "number", 3), card("blue", "number", 4), card("green", "number", 9)]]);
    state = reduceGame(state, { type: "play", player: 0, cardId: arsonist.id }).state;
    expect(state.statuses[1].burn).toBe(1);
    state.currentColor = "blue";
    state.discard.push(card("blue", "number", 8));
    const blue = state.hands[1].find((item) => item.color === "blue")!;
    const before = state.hands[1].length;
    state = reduceGame(state, { type: "play", player: 1, cardId: blue.id }).state;
    expect(state.statuses[1].burn).toBe(2);
    expect(state.hands[1]).toHaveLength(before);
    expect(state.statuses[1].burnedCardIds).toHaveLength(2);
  });

  it("playing red removes one Burn", () => {
    const red = card("red", "number", 6);
    let state = stateWith([[red, card("blue", "number", 2)], []]);
    state.statuses[0].burn = 2;
    state = reduceGame(state, { type: "play", player: 0, cardId: red.id }).state;
    expect(state.statuses[0].burn).toBe(1);
  });

  it("Stormcall punishes a non-yellow answer", () => {
    const blue = card("blue", "number", 4);
    let state = stateWith([[blue, card("green", "number", 1), card("yellow", "number", 6)], []], card("blue", "number", 7));
    state.statuses[0].stormcall = true;
    const before = state.hands[0].length;
    state = reduceGame(state, { type: "play", player: 0, cardId: blue.id }).state;
    expect(state.hands[0]).toHaveLength(before + 1);
    expect(state.statuses[0].stormcall).toBe(false);
  });

  it("Frostbite locks exactly one rival card", () => {
    const frostbite = card("blue", "frostbite");
    let state = stateWith([[frostbite, card("red", "number", 1)], [card("green", "number", 2), card("yellow", "number", 3)]], card("blue", "number", 8));
    state = reduceGame(state, { type: "play", player: 0, cardId: frostbite.id }).state;
    expect(state.statuses[1].frozenCardIds).toHaveLength(1);
    expect(state.hands[1].some((item) => item.id === state.statuses[1].frozenCardIds[0])).toBe(true);
  });

  it("Whirlwind swaps one random card each way", () => {
    const whirlwind = card("green", "whirlwind");
    const own = card("red", "number", 1);
    const rival = card("blue", "number", 2);
    let state = stateWith([[whirlwind, own, card("blue", "number", 7)], [rival, card("yellow", "number", 3)]], card("green", "number", 8));
    state = reduceGame(state, { type: "play", player: 0, cardId: whirlwind.id }).state;
    expect(state.hands[0]).toHaveLength(2);
    expect(state.hands[1]).toHaveLength(2);
    expect(state.hands[0][0]?.id).not.toBe(own.id);
  });

  it("Mirror copies the last non-Mirror spell", () => {
    const mirror = card("wild", "mirror");
    let state = stateWith([[mirror, card("red", "number", 1)], [card("green", "number", 2), card("yellow", "number", 3)]]);
    state.lastSpecial = "arsonist";
    state = reduceGame(state, { type: "play", player: 0, cardId: mirror.id, colorChoice: "red" }).state;
    expect(state.statuses[1].burn).toBe(1);
    expect(state.events.some((event) => event.type === "spell" && event.spell === "mirror" && event.copiedSpell === "arsonist")).toBe(true);
  });

  it("Cleanse clears every negative status and selects a color", () => {
    const cleanse = card("wild", "cleanse");
    let state = stateWith([[cleanse, card("red", "number", 1)], []]);
    state.statuses[0] = { burn: 2, burnedCardIds: ["a", "b"], frozenCardIds: [cleanse.id], stormcall: true };
    state.statuses[0].frozenCardIds = [];
    state = reduceGame(state, { type: "play", player: 0, cardId: cleanse.id, colorChoice: "green" }).state;
    expect(state.statuses[0]).toEqual({ burn: 0, burnedCardIds: [], frozenCardIds: [], stormcall: false });
    expect(state.currentColor).toBe("green");
  });
});

describe("Final Card", () => {
  it("penalizes a missed call and starts a challenge after a successful call", () => {
    const playable = card("red", "number", 8);
    const spare = card("blue", "number", 2);
    const base = stateWith([[playable, spare], [card("green", "number", 3)]]);
    const missed = reduceGame(base, { type: "play", player: 0, cardId: playable.id }).state;
    expect(missed.hands[0]).toHaveLength(3);
    let called = reduceGame(base, { type: "call-final", player: 0 }).state;
    called = reduceGame(called, { type: "play", player: 0, cardId: playable.id }).state;
    expect(called.phase).toBe("challenge");
    expect(called.challengeOwner).toBe(0);
    const resolved = resolveChallenge(called, 900, 500);
    expect(resolved.phase).toBe("playing");
    expect(resolved.hands[0]).toHaveLength(1);
  });
});

describe("round and match flow", () => {
  it("scores the rival hand and advances automatically into a fresh round", () => {
    const finisher = card("red", "number", 8);
    const state = stateWith([[finisher], [card("blue", "number", 7), card("wild", "wild4")]], card("red", "number", 3));
    const won = reduceGame(state, { type: "play", player: 0, cardId: finisher.id }).state;
    expect(won.phase).toBe("round-over");
    expect(won.scores[0]).toBe(57);
    expect(won.roundWinner).toBe(0);

    const next = advanceRound(won);
    expect(next.phase).toBe("playing");
    expect(next.roundNumber).toBe(2);
    expect(next.scores).toEqual([57, 0]);
    expect(next.hands[0]).toHaveLength(7);
    expect(next.hands[1]).toHaveLength(7);
    expect(next.turn).toBe(0);
  });

  it("ends the match at the target score and rematches with clean scores", () => {
    const finisher = card("red", "number", 8);
    const state = stateWith([[finisher], [card("wild", "wild4")]], card("red", "number", 3));
    state.scores = [175, 0];
    const won = reduceGame(state, { type: "play", player: 0, cardId: finisher.id }).state;
    expect(won.phase).toBe("match-over");
    expect(won.scores[0]).toBe(225);
    expect(won.events).toContainEqual({ type: "match-won", actor: 0 });

    const rematch = restartMatch(won);
    expect(rematch.phase).toBe("playing");
    expect(rematch.roundNumber).toBe(1);
    expect(rematch.scores).toEqual([0, 0]);
    expect(rematch.targetScore).toBe(200);
  });
});

describe("online perspective", () => {
  it("restores arrays and null fields omitted by Firebase serialization", () => {
    const state = stateWith([[card("red", "number", 1)], [card("blue", "number", 2)]]);
    const serialized = JSON.parse(JSON.stringify(state)) as GameState;
    delete (serialized.statuses[0] as Partial<GameState["statuses"][0]>).burnedCardIds;
    delete (serialized.statuses[0] as Partial<GameState["statuses"][0]>).frozenCardIds;
    delete (serialized.drawStack as Partial<GameState["drawStack"]>).kind;
    const hydrated = hydrateGameState(serialized);
    expect(hydrated.statuses[0].burnedCardIds).toEqual([]);
    expect(hydrated.statuses[0].frozenCardIds).toEqual([]);
    expect(hydrated.drawStack.kind).toBeNull();
    expect(() => illegalReason(hydrated, hydrated.hands[0][0]!, 0)).not.toThrow();
  });

  it("maps guest state and semantic actors into a local-player-first view", () => {
    const state = stateWith([[card("red", "number", 1)], [card("blue", "number", 2), card("green", "number", 3)]]);
    state.names = ["Cole", "Gabby"];
    state.scores = [40, 70];
    state.turn = 1;
    state.roundWinner = 0;
    state.challengeOwner = 1;
    state.events = [{ type: "card-played", actor: 1, target: 0, card: state.hands[1][0]! }];
    const guest = stateForSlot(state, 1);
    expect(guest.names).toEqual(["Gabby", "Cole"]);
    expect(guest.hands.map((hand) => hand.length)).toEqual([2, 1]);
    expect(guest.scores).toEqual([70, 40]);
    expect(guest.turn).toBe(0);
    expect(guest.roundWinner).toBe(1);
    expect(guest.challengeOwner).toBe(0);
    expect(guest.events[0]).toEqual(expect.objectContaining({ actor: 0, target: 1 }));
  });
});
