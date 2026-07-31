import type { KnockoutInput, KnockoutState } from "./types";

export function knockoutAiInput(state: KnockoutState, slot: 0 | 1, sequence: number): KnockoutInput {
  const fighter = state.fighters[slot];
  const rival = state.fighters[slot === 0 ? 1 : 0];
  const distance = rival.x - fighter.x;
  const nearEdge = fighter.x < 310 || fighter.x > 1290;
  const attackRange = Math.abs(distance) < 190;
  const abilityRange = Math.abs(distance) < 520;
  const pulse = Math.floor(state.tick / 17);
  return {
    move: Math.abs(distance) > 135 ? (distance > 0 ? 1 : -1) : 0,
    jump: (nearEdge || rival.y < fighter.y - 120) && fighter.grounded,
    attack: attackRange && pulse % 3 === 0,
    dodge: attackRange && rival.attackMs > 430 && fighter.dodgeCooldownMs === 0,
    ability: abilityRange && fighter.abilityCooldownMs === 0 && pulse % 5 === 0,
    sequence
  };
}
