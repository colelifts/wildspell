import type Phaser from "phaser";

export interface VirtualViewport {
  width: number;
  height: number;
  renderScale: number;
}

export function virtualViewport(scene: Phaser.Scene): VirtualViewport {
  return {
    width: Number(scene.registry.get("virtualWidth")) || scene.scale.width,
    height: Number(scene.registry.get("virtualHeight")) || scene.scale.height,
    renderScale: Number(scene.registry.get("renderScale")) || 1
  };
}
