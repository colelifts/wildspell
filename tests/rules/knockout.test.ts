import { describe, expect, it } from "vitest";
import { knockoutAiInput } from "../../src/game/knockout/ai";
import { createKnockoutState, setKnockoutInput, stepKnockout } from "../../src/game/knockout/simulation";

describe("Knockout simulation", () => {
  it("starts after a visible countdown", () => {
    let state = createKnockoutState(["kenpachi", "hisoka"]);
    const startingLives = state.fighters.map((fighter) => fighter.lives);
    for (let time = 0; time < 3_100; time += 20) state = stepKnockout(state, 20);
    expect(state.phase).toBe("playing");
    expect(state.fighters.map((fighter) => fighter.lives)).toEqual(startingLives);
  });

  it("applies attacks and rising damage", () => {
    let state = createKnockoutState(["kenpachi", "hisoka"]);
    state.phase = "playing";
    state.fighters[0].x = 700;
    state.fighters[1].x = 820;
    state.fighters[1].invulnerableMs = 0;
    state = setKnockoutInput(state, 0, { move: 0, jump: false, attack: true, dodge: false, ability: false, sequence: 1 });
    state = stepKnockout(state, 16);
    expect(state.fighters[1].damage).toBeGreaterThan(0);
    expect(state.lastHit?.attacker).toBe(0);
  });

  it("rejects stale input sequences", () => {
    let state = createKnockoutState(["mob", "hit"]);
    state = setKnockoutInput(state, 0, { move: 1, jump: false, attack: false, dodge: false, ability: false, sequence: 4 });
    state = setKnockoutInput(state, 0, { move: -1, jump: false, attack: false, dodge: false, ability: false, sequence: 2 });
    expect(state.inputs[0].move).toBe(1);
  });

  it("ends when a fighter loses the final life", () => {
    let state = createKnockoutState(["gojo", "ryuk"]);
    state.phase = "playing";
    state.elapsedMs = 8_000;
    state.fighters[1].lives = 1;
    state.fighters[1].x = 2_000;
    state = stepKnockout(state, 16);
    expect(state.phase).toBe("round-over");
    expect(state.winner).toBe(0);
  });

  it("gives a stationary player time to react after the countdown", () => {
    let state = createKnockoutState(["kenpachi", "hisoka"]);
    let sequence = 0;
    for (let elapsed = 0; elapsed < 8_000; elapsed += 16) {
      state = setKnockoutInput(state, 0, { move: 0, jump: false, attack: false, dodge: false, ability: false, sequence: ++sequence });
      state = setKnockoutInput(state, 1, knockoutAiInput(state, 1, ++sequence));
      state = stepKnockout(state, 16);
    }
    expect(state.fighters[0].lives).toBeGreaterThanOrEqual(2);
    expect(state.phase).not.toBe("round-over");
  });
});
