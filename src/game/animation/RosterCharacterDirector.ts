import Phaser from "phaser";
import type { CharacterId } from "../events";

export type RosterPose =
  | "turn-ready" | "card-play" | "light-cast" | "heavy-cast" | "hurt"
  | "frozen" | "burn" | "wind" | "final-card" | "victory" | "defeat";

const ROSTER_CHARACTERS: Exclude<CharacterId, "kenpachi" | "hisoka">[] = ["gojo", "mob", "hit", "ryuk", "maki"];
const COLORS: Record<(typeof ROSTER_CHARACTERS)[number], number> = {
  gojo: 0x8fdcff,
  mob: 0xb48cff,
  hit: 0xa778ff,
  ryuk: 0xff536d,
  maki: 0x70efb5
};
const key = (character: CharacterId) => `roster-character:${character}`;

export function preloadRosterCharacters(scene: Phaser.Scene): void {
  for (const character of ROSTER_CHARACTERS) scene.load.image(key(character), `/characters/${character}/selection-splash.png`);
}

export class RosterCharacterDirector {
  private image!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Ellipse;
  private baseX = 0;
  private baseY = 0;
  private scaleX = 1;
  private scaleY = 1;
  private restore?: Phaser.Time.TimerEvent;
  private persistent: RosterPose = "turn-ready";
  private readonly accent: number;

  constructor(private readonly scene: Phaser.Scene, private readonly character: Exclude<CharacterId, "kenpachi" | "hisoka">, private readonly facing: 1 | -1) {
    this.accent = COLORS[character];
  }

  create(x: number, y: number, height: number): Phaser.GameObjects.Image {
    this.baseX = x;
    this.baseY = y;
    this.aura = this.scene.add.ellipse(x, y - height * .38, height * .55, height * .84, this.accent, .12)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
    this.image = this.scene.add.image(x, y, key(this.character)).setOrigin(.5, 1).setDepth(18);
    const source = this.scene.textures.get(key(this.character)).getSourceImage() as HTMLImageElement;
    this.image.setDisplaySize(height * (source.width / source.height), height);
    this.scaleX = this.image.scaleX;
    this.scaleY = this.image.scaleY;
    this.image.setAlpha(0).setX(x - 150 * this.facing);
    this.scene.tweens.add({ targets: [this.image, this.aura], x, alpha: 1, duration: 620, ease: "Back.Out", onComplete: () => this.idle() });
    this.aura.setAlpha(.15);
    return this.image;
  }

  setPersistentPose(pose: RosterPose): void {
    this.persistent = pose;
    if (!this.restore) this.applyStatus(pose);
  }

  play(pose: RosterPose, duration = 900): void {
    this.restore?.remove(false);
    this.restore = undefined;
    this.scene.tweens.killTweensOf(this.image);
    this.image.setPosition(this.baseX, this.baseY).setAngle(0).setScale(this.scaleX, this.scaleY).setAlpha(1);
    this.applyStatus(pose);
    const cast = pose === "card-play" || pose === "light-cast" || pose === "heavy-cast";
    if (cast) {
      const ring = this.scene.add.circle(this.baseX + 34 * this.facing, this.baseY - 150, 18, this.accent, .65).setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: ring, scale: pose === "heavy-cast" ? 5 : 3, alpha: 0, duration: 480, onComplete: () => ring.destroy() });
      this.scene.tweens.add({ targets: this.image, x: this.baseX + 22 * this.facing, angle: 1.5 * this.facing, duration: 170, yoyo: true, ease: "Quad.Out" });
    } else if (pose === "hurt") {
      this.scene.cameras.main.shake(140, .003);
      this.scene.tweens.add({ targets: this.image, x: this.baseX - 14 * this.facing, angle: -3 * this.facing, duration: 65, yoyo: true, repeat: 3 });
    } else if (pose === "wind") {
      this.scene.tweens.add({ targets: this.image, x: this.baseX - 24 * this.facing, angle: -5 * this.facing, duration: 150, yoyo: true, repeat: 2 });
    } else if (pose === "victory" || pose === "final-card") {
      this.scene.tweens.add({ targets: [this.image, this.aura], y: `-=${pose === "victory" ? 18 : 10}`, duration: 300, yoyo: true, repeat: 1, ease: "Back.Out" });
    } else if (pose === "defeat") {
      this.scene.tweens.add({ targets: this.image, y: this.baseY + 12, alpha: .65, angle: -4 * this.facing, duration: 520 });
      return;
    }
    this.restore = this.scene.time.delayedCall(duration, () => {
      this.restore = undefined;
      this.applyStatus(this.persistent);
      this.idle();
    });
  }

  private applyStatus(pose: RosterPose): void {
    this.image.clearTint().setAlpha(1);
    this.aura.setFillStyle(this.accent, .14);
    if (pose === "frozen") this.image.setTint(0x8fdfff);
    if (pose === "burn") this.image.setTint(0xff8a58);
    if (pose === "defeat") this.image.setTint(0x778096);
  }

  private idle(): void {
    this.scene.tweens.killTweensOf(this.image);
    this.scene.tweens.killTweensOf(this.aura);
    this.image.setPosition(this.baseX, this.baseY).setAngle(0).setScale(this.scaleX, this.scaleY);
    this.aura.setPosition(this.baseX, this.baseY - this.image.displayHeight * .38);
    this.scene.tweens.add({ targets: this.image, y: this.baseY - 5, angle: .35 * this.facing, duration: 1550, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.scene.tweens.add({ targets: this.aura, scaleX: 1.12, scaleY: .94, alpha: .28, duration: 1250, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }
}
