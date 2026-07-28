import { describe, expect, it } from "vitest";
import { buildDeck } from "../../src/game/rules/deck";
import { illegalReason, isLegalCard } from "../../src/game/rules/legalMoves";
import { createGame, reduceGame, resolveChallenge } from "../../src/game/rules/reducer";
import type { Card, CardColor, CardKind, GameState } from "../../src/game/rules/types";

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
    expect(buildDeck("classic", 7).cards).toHaveLength(108);
    expect(buildDeck("wild", 7).cards).toHaveLength(120);
    expect(buildDeck("wild", 7).cards.map((item) => item.id)).toEqual(buildDeck("wild", 7).cards.map((item) => item.id));
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
