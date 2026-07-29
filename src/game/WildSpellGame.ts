import Phaser from "phaser";
import type { StartMatchDetail } from "./events";
import { MatchScene } from "./scenes/MatchScene";

export class WildSpellGame {
  private game?: Phaser.Game;

  start(config: StartMatchDetail): void {
    this.destroy();
    const portrait = window.matchMedia("(max-width: 700px) and (orientation: portrait)").matches;
    const virtualWidth = portrait ? 576 : 1024;
    const virtualHeight = portrait ? 1024 : 576;
    const viewportScale = Math.max(window.innerWidth / virtualWidth, window.innerHeight / virtualHeight);
    const renderScale = Math.min(2, Math.max(window.devicePixelRatio || 1, viewportScale));
    const width = Math.round(virtualWidth * renderScale);
    const height = Math.round(virtualHeight * renderScale);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-canvas",
      width,
      height,
      backgroundColor: "#07112c",
      scene: MatchScene,
      render: { antialias: true, pixelArt: false, roundPixels: true, powerPreference: "high-performance" },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width, height }
    });
    this.game.scene.start("MatchScene", { ...config, render: { width: virtualWidth, height: virtualHeight, scale: renderScale } });
  }

  destroy(): void {
    this.game?.destroy(true);
    this.game = undefined;
  }
}
