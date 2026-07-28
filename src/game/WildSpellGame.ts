import Phaser from "phaser";
import type { StartMatchDetail } from "./events";
import { MatchScene } from "./scenes/MatchScene";

export class WildSpellGame {
  private game?: Phaser.Game;

  start(config: StartMatchDetail): void {
    this.destroy();
    const portrait = window.matchMedia("(max-width: 700px) and (orientation: portrait)").matches;
    const width = portrait ? 576 : 1024;
    const height = portrait ? 1024 : 576;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-canvas",
      width,
      height,
      backgroundColor: "#07112c",
      scene: MatchScene,
      render: { antialias: false, pixelArt: true, roundPixels: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width, height }
    });
    this.game.scene.start("MatchScene", config);
  }

  destroy(): void {
    this.game?.destroy(true);
    this.game = undefined;
  }
}
