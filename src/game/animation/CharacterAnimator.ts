import Phaser from "phaser";
import { animationKey, characterManifest, type CharacterAction, type CharacterId, type Direction } from "./characterManifest";

const rowFor: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

export class CharacterAnimator {
  constructor(private readonly scene: Phaser.Scene) {}

  preload(): void {
    for (const [character, animations] of Object.entries(characterManifest)) {
      for (const [action, metadata] of Object.entries(animations)) {
        this.scene.load.spritesheet(`${character}:${action}`, metadata.sheet, {
          frameWidth: metadata.frameWidth,
          frameHeight: metadata.frameHeight
        });
      }
    }
  }

  createAnimations(): void {
    for (const [character, animations] of Object.entries(characterManifest) as [CharacterId, typeof characterManifest[CharacterId]][]) {
      for (const [action, metadata] of Object.entries(animations) as [CharacterAction, typeof animations[CharacterAction]][]) {
        for (const direction of metadata.directions) {
          const row = action === "hurt" ? 0 : rowFor[direction];
          const frames = Array.from({ length: metadata.frames }, (_, index) => ({
            key: `${character}:${action}`,
            frame: row * metadata.canvasColumns + index
          }));
          const key = animationKey(character, action, direction);
          if (!this.scene.anims.exists(key)) {
            this.scene.anims.create({
              key,
              frames,
              frameRate: action === "idle" ? 2.2 : action === "walk" ? 10 : 8,
              repeat: action === "idle" || (character === "skeleton" && action === "walk") ? -1 : 0
            });
          }
        }
      }
    }
  }

  play(sprite: Phaser.GameObjects.Sprite, character: CharacterId, action: CharacterAction, direction: Direction): void {
    const safeAction = character === "skeleton" && (action === "idle" || action === "emote") ? "walk" : action;
    const safeDirection = safeAction === "hurt" ? "down" : direction;
    sprite.play(animationKey(character, safeAction, safeDirection), true);
  }
}
