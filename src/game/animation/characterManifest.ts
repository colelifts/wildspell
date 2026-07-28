export type CharacterId = "you" | "gabby" | "skeleton";
export type CharacterAction = "idle" | "emote" | "spellcast" | "slash" | "thrust" | "walk" | "hurt";
export type Direction = "down" | "left" | "right" | "up";

export interface AnimationMetadata {
  sheet: string;
  frameWidth: 64;
  frameHeight: 64;
  canvasColumns: 13;
  frames: number;
  directions: Direction[];
  unsupportedLayers: string[];
}

const directionRows: Direction[] = ["down", "left", "right", "up"];
const animationFrames: Record<CharacterAction, number> = {
  idle: 2,
  emote: 3,
  spellcast: 7,
  slash: 6,
  thrust: 8,
  walk: 9,
  hurt: 6
};

const unsupported: Record<CharacterId, Partial<Record<CharacterAction, string[]>>> = {
  you: {
    idle: ["Santa coat"],
    emote: ["Santa coat"],
    hurt: ["Neutral fur-white facial layer"]
  },
  gabby: {
    idle: ["Crystal", "Simple staff"],
    emote: ["Crystal", "Simple staff", "Purple bodice"],
    hurt: ["Closing eyes"]
  },
  skeleton: {
    idle: ["Scythe", "Skeleton body metadata"],
    emote: ["Scythe", "Skeleton body metadata"],
    spellcast: ["Scythe"],
    slash: ["Scythe"],
    thrust: ["Scythe"]
  }
};

export const characterManifest = Object.fromEntries(
  (["you", "gabby", "skeleton"] as CharacterId[]).map((character) => [
    character,
    Object.fromEntries(
      (Object.keys(animationFrames) as CharacterAction[]).map((action) => [
        action,
        {
          sheet: `/characters/${character}/${action}.png`,
          frameWidth: 64,
          frameHeight: 64,
          canvasColumns: 13,
          frames: animationFrames[action],
          directions: action === "hurt" ? ["down"] : directionRows,
          unsupportedLayers: unsupported[character][action] ?? []
        } satisfies AnimationMetadata
      ])
    ) as Record<CharacterAction, AnimationMetadata>
  ])
) as Record<CharacterId, Record<CharacterAction, AnimationMetadata>>;

export function animationKey(character: CharacterId, action: CharacterAction, direction: Direction): string {
  return `${character}:${action}:${direction}`;
}
