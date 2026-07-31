import type { CharacterId } from "../events";
import { KNOCKOUT_CHARACTERS } from "./characters";
import { EMPTY_KNOCKOUT_INPUT, type KnockoutFighter, type KnockoutInput, type KnockoutState } from "./types";

export const KNOCKOUT_WORLD = {
  width: 1600,
  height: 900,
  platformLeft: 230,
  platformRight: 1370,
  platformY: 690,
  blastPadding: 150
} as const;

const GRAVITY = 1_900;
const ATTACK_DURATION = 280;
const ATTACK_COOLDOWN = 470;
const OPENING_GRACE_MS = 7_000;

function fighter(characterId: CharacterId, x: number, facing: -1 | 1): KnockoutFighter {
  return {
    characterId, x, y: KNOCKOUT_WORLD.platformY, velocityX: 0, velocityY: 0, facing,
    damage: 0, lives: 3, grounded: true, hitstunMs: 0, invulnerableMs: 1_200,
    attackMs: 0, dodgeCooldownMs: 0, abilityCooldownMs: 0, abilityActiveMs: 0, markedMs: 0
  };
}

export function createKnockoutState(characters: [CharacterId, CharacterId]): KnockoutState {
  return {
    version: 1, tick: 0, phase: "countdown", countdownMs: 3_000, elapsedMs: 0, winner: null,
    fighters: [fighter(characters[0], 500, 1), fighter(characters[1], 1100, -1)],
    inputs: [{ ...EMPTY_KNOCKOUT_INPUT }, { ...EMPTY_KNOCKOUT_INPUT }]
  };
}

export function setKnockoutInput(state: KnockoutState, slot: 0 | 1, input: KnockoutInput): KnockoutState {
  if (input.sequence < state.inputs[slot].sequence) return state;
  return { ...state, inputs: state.inputs.map((current, index) => index === slot ? { ...input } : current) as [KnockoutInput, KnockoutInput] };
}

function respawn(fighterState: KnockoutFighter, slot: 0 | 1): void {
  fighterState.x = slot === 0 ? 520 : 1080;
  fighterState.y = KNOCKOUT_WORLD.platformY - 230;
  fighterState.velocityX = 0;
  fighterState.velocityY = 0;
  fighterState.damage = 0;
  fighterState.hitstunMs = 0;
  fighterState.invulnerableMs = 1_800;
  fighterState.abilityActiveMs = 0;
}

function launch(target: KnockoutFighter, attacker: KnockoutFighter, power: number, vertical: number): void {
  const targetStats = KNOCKOUT_CHARACTERS[target.characterId];
  const direction = attacker.x <= target.x ? 1 : -1;
  const damageScale = 1 + target.damage / 82;
  const markedScale = target.markedMs > 0 ? 1.42 : 1;
  target.velocityX = direction * power * damageScale * markedScale / targetStats.weight;
  target.velocityY = -vertical * damageScale * markedScale / targetStats.weight;
  target.hitstunMs = Math.min(820, 150 + target.damage * 4.5);
  target.damage = Math.min(300, target.damage + power * 0.042);
  target.grounded = false;
  target.markedMs = 0;
}

function applyAbility(state: KnockoutState, attackerSlot: 0 | 1): boolean {
  const targetSlot = attackerSlot === 0 ? 1 : 0;
  const attacker = state.fighters[attackerSlot];
  const target = state.fighters[targetSlot];
  const stats = KNOCKOUT_CHARACTERS[attacker.characterId];
  const distance = Math.abs(attacker.x - target.x);
  if (target.invulnerableMs > 0) return false;
  attacker.abilityCooldownMs = stats.abilityCooldownMs;
  attacker.abilityActiveMs = 520;

  if (attacker.characterId === "hisoka" && distance < 610) {
    target.velocityX = (attacker.x - target.x) * 3.1;
    target.velocityY = -210;
    target.hitstunMs = 430;
    target.damage += 8;
    return true;
  }
  if (attacker.characterId === "gojo" && distance < 430) {
    target.damage += 18;
    launch(target, attacker, 610, 410);
    return true;
  }
  if (attacker.characterId === "mob" && distance < 560) {
    target.damage += 16;
    target.velocityX = (target.x - attacker.x) * 0.55;
    target.velocityY = -760;
    target.hitstunMs = 620;
    return true;
  }
  if (attacker.characterId === "hit" && distance < 690) {
    attacker.x = target.x - attacker.facing * 96;
    target.damage += 17;
    launch(target, attacker, 520, 260);
    return true;
  }
  if (attacker.characterId === "ryuk") {
    target.markedMs = 6_000;
    target.damage += 6;
    return true;
  }
  if (distance < (attacker.characterId === "maki" ? 350 : 270)) {
    target.damage += attacker.characterId === "kenpachi" ? 24 : 16;
    launch(target, attacker, attacker.characterId === "kenpachi" ? 690 : 560, attacker.characterId === "kenpachi" ? 370 : 290);
    return true;
  }
  return false;
}

export function stepKnockout(previous: KnockoutState, deltaMs: number): KnockoutState {
  const dtMs = Math.min(34, Math.max(0, deltaMs));
  const dt = dtMs / 1_000;
  const state: KnockoutState = structuredClone(previous);
  state.tick += 1;
  state.elapsedMs += dtMs;

  if (state.phase === "countdown") {
    state.countdownMs = Math.max(0, state.countdownMs - dtMs);
    if (state.countdownMs === 0) state.phase = "playing";
    return state;
  }
  if (state.phase !== "playing") return state;

  for (const slot of [0, 1] as const) {
    const current = state.fighters[slot];
    const rival = state.fighters[slot === 0 ? 1 : 0];
    const input = state.inputs[slot];
    const stats = KNOCKOUT_CHARACTERS[current.characterId];
    current.hitstunMs = Math.max(0, current.hitstunMs - dtMs);
    current.invulnerableMs = Math.max(0, current.invulnerableMs - dtMs);
    current.attackMs = Math.max(0, current.attackMs - dtMs);
    current.dodgeCooldownMs = Math.max(0, current.dodgeCooldownMs - dtMs);
    current.abilityCooldownMs = Math.max(0, current.abilityCooldownMs - dtMs);
    current.abilityActiveMs = Math.max(0, current.abilityActiveMs - dtMs);
    current.markedMs = Math.max(0, current.markedMs - dtMs);

    if (current.hitstunMs <= 0) {
      const acceleration = current.grounded ? 12 : 5.5;
      current.velocityX += (input.move * stats.speed - current.velocityX) * Math.min(1, acceleration * dt);
      if (input.move) current.facing = input.move;
      if (input.jump && current.grounded) {
        current.velocityY = -stats.jump;
        current.grounded = false;
      }
      if (input.dodge && current.dodgeCooldownMs === 0) {
        current.velocityX = current.facing * 680;
        current.invulnerableMs = 360;
        current.dodgeCooldownMs = 1_350;
      }
      if (input.attack && current.attackMs === 0) current.attackMs = ATTACK_DURATION + ATTACK_COOLDOWN;
      if (input.ability && current.abilityCooldownMs === 0) {
        if (applyAbility(state, slot)) state.lastHit = { attacker: slot, target: slot === 0 ? 1 : 0, power: 2, kind: "ability", tick: state.tick };
      }
    }

    const attackWindow = current.attackMs <= ATTACK_DURATION + ATTACK_COOLDOWN && current.attackMs >= ATTACK_COOLDOWN;
    const attackFresh = previous.fighters[slot].attackMs < ATTACK_COOLDOWN;
    if (attackWindow && attackFresh && rival.invulnerableMs === 0 && Math.abs(current.x - rival.x) < 185 && Math.abs(current.y - rival.y) < 155) {
      rival.damage += stats.attackPower;
      launch(rival, current, 390 + stats.attackPower * 7, 250);
      state.lastHit = { attacker: slot, target: slot === 0 ? 1 : 0, power: stats.attackPower, kind: "attack", tick: state.tick };
    }

    current.velocityY += GRAVITY * dt;
    current.x += current.velocityX * dt;
    current.y += current.velocityY * dt;
    const onPlatform = current.x > KNOCKOUT_WORLD.platformLeft && current.x < KNOCKOUT_WORLD.platformRight;
    if (onPlatform && current.velocityY >= 0 && current.y >= KNOCKOUT_WORLD.platformY) {
      current.y = KNOCKOUT_WORLD.platformY;
      current.velocityY = 0;
      current.grounded = true;
    } else current.grounded = false;
  }

  for (const slot of [0, 1] as const) {
    const current = state.fighters[slot];
    const out = current.x < -KNOCKOUT_WORLD.blastPadding || current.x > KNOCKOUT_WORLD.width + KNOCKOUT_WORLD.blastPadding || current.y > KNOCKOUT_WORLD.height + KNOCKOUT_WORLD.blastPadding || current.y < -420;
    if (!out) continue;
    if (state.elapsedMs < OPENING_GRACE_MS) {
      respawn(current, slot);
      continue;
    }
    current.lives -= 1;
    if (current.lives <= 0) {
      state.phase = "round-over";
      state.winner = slot === 0 ? 1 : 0;
    } else respawn(current, slot);
  }
  return state;
}
