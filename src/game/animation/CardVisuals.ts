import Phaser from "phaser";
import type { CardKind } from "../rules/types";

const PREMIUM_SHEETS: Partial<Record<CardKind, { key: string; path: string }>> = {
  arsonist: { key: "card-arsonist", path: "/cards/arsonist/arsonist-ultimate-sheet.webp" },
  freeze: { key: "card-freeze", path: "/cards/freeze/freeze-ultimate-sheet.webp" },
  whirlwind: { key: "card-whirlwind", path: "/cards/whirlwind/whirlwind-ultimate-sheet.webp" },
  draw2: { key: "card-draw2", path: "/cards/arcane/arcane-plus-two-ultimate-sheet.webp" },
  wild4: { key: "card-wild4", path: "/cards/chaos/chaos-plus-four-ultimate-sheet.webp" }
};

export const CARD_BACK_KEY = "wildspell-card-back";

export function preloadPremiumCards(scene: Phaser.Scene): void {
  scene.load.image(CARD_BACK_KEY, "/cards/shared/wildspell-card-back.png");
  for (const { key, path } of Object.values(PREMIUM_SHEETS)) {
    scene.load.spritesheet(key, path, { frameWidth: 384, frameHeight: 576 });
  }
}

export function createPremiumCardAnimations(scene: Phaser.Scene): void {
  for (const { key } of Object.values(PREMIUM_SHEETS)) {
    const animationKey = `${key}-loop`;
    if (scene.anims.exists(animationKey)) continue;
    scene.anims.create({
      key: animationKey,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 47 }),
      frameRate: 12,
      repeat: -1
    });
  }
}

export function premiumCardTexture(kind: CardKind): { texture: string; animation: string } | undefined {
  const entry = PREMIUM_SHEETS[kind];
  return entry ? { texture: entry.key, animation: `${entry.key}-loop` } : undefined;
}
