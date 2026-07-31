import type { CharacterId } from "../events";
import type { KnockoutCharacterDefinition } from "./types";

export const KNOCKOUT_CHARACTERS: Record<CharacterId, KnockoutCharacterDefinition> = {
  kenpachi: {
    name: "Kenpachi", title: "The Relentless Blade", ability: "Blade Storm",
    abilityDescription: "A brutal armored slash with enormous launch power.",
    abilityCooldownMs: 9_000, speed: 285, jump: 650, weight: 1.22, attackPower: 15, accent: 0xff3a32
  },
  hisoka: {
    name: "Hisoka", title: "The Deceptive Joker", ability: "Bungee Snare",
    abilityDescription: "Hooks the rival and violently pulls them into striking range.",
    abilityCooldownMs: 8_000, speed: 330, jump: 690, weight: 0.96, attackPower: 11, accent: 0xd64cff
  },
  gojo: {
    name: "Gojo", title: "The Limitless", ability: "Infinity Burst",
    abilityDescription: "Repels everything nearby with a huge spatial shockwave.",
    abilityCooldownMs: 10_000, speed: 310, jump: 680, weight: 1.02, attackPower: 12, accent: 0x786dff
  },
  mob: {
    name: "Mob", title: "The Quiet Esper", ability: "Psychic Slam",
    abilityDescription: "Lifts the rival, then drives them down with telekinesis.",
    abilityCooldownMs: 9_500, speed: 275, jump: 640, weight: 1, attackPower: 12, accent: 0x6fdcff
  },
  hit: {
    name: "Hit", title: "The Silent Assassin", ability: "Time Skip",
    abilityDescription: "Vanishes forward and lands an instant precision strike.",
    abilityCooldownMs: 8_500, speed: 345, jump: 660, weight: 1.08, attackPower: 13, accent: 0x9c63ff
  },
  ryuk: {
    name: "Ryuk", title: "The Watching Reaper", ability: "Death Mark",
    abilityDescription: "Marks the rival so their next hit launches dramatically farther.",
    abilityCooldownMs: 11_000, speed: 290, jump: 700, weight: 0.92, attackPower: 11, accent: 0xffce38
  },
  maki: {
    name: "Maki", title: "The Cursed Weapon", ability: "Weapon Rush",
    abilityDescription: "A fast advancing polearm combo that breaks through dodges.",
    abilityCooldownMs: 8_000, speed: 335, jump: 670, weight: 1.04, attackPower: 12, accent: 0x55e58b
  }
};
