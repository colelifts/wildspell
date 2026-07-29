import Phaser from "phaser";

export type PremiumGabbyPose =
  | "turn-ready"
  | "card-play"
  | "light-cast"
  | "heavy-cast"
  | "hurt"
  | "frozen"
  | "burn"
  | "wind"
  | "final-card"
  | "victory"
  | "defeat";

const GABBY_POSES: Record<PremiumGabbyPose, string> = {
  "turn-ready": "/characters/premium/gabby/turn-ready.png",
  "card-play": "/characters/premium/gabby/card-play.png",
  "light-cast": "/characters/premium/gabby/light-cast.png",
  "heavy-cast": "/characters/premium/gabby/heavy-cast.png",
  hurt: "/characters/premium/gabby/hurt.png",
  frozen: "/characters/premium/gabby/frozen.png",
  burn: "/characters/premium/gabby/burn.png",
  wind: "/characters/premium/gabby/wind.png",
  "final-card": "/characters/premium/gabby/final-card.png",
  victory: "/characters/premium/gabby/victory.png",
  defeat: "/characters/premium/gabby/defeat.png"
};

const textureKey = (pose: PremiumGabbyPose) => `premium-gabby:${pose}`;

export function preloadPremiumGabby(scene: Phaser.Scene): void {
  for (const [pose, path] of Object.entries(GABBY_POSES) as [PremiumGabbyPose, string][]) {
    scene.load.image(textureKey(pose), path);
  }
}

export class PremiumGabbyDirector {
  private image!: Phaser.GameObjects.Image;
  private baseX = 0;
  private baseY = 0;
  private baseHeight = 420;
  private fittedScaleX = 1;
  private fittedScaleY = 1;
  private restoreTimer?: Phaser.Time.TimerEvent;
  private persistentPose: PremiumGabbyPose = "turn-ready";

  constructor(private readonly scene: Phaser.Scene) {}

  create(x: number, y: number, height: number): Phaser.GameObjects.Image {
    this.baseX = x;
    this.baseY = y;
    this.baseHeight = height;
    this.image = this.scene.add.image(x, y, textureKey("turn-ready")).setOrigin(0.5, 1).setDepth(18);
    this.fit("turn-ready");
    const entranceScaleX = this.fittedScaleX * 0.82;
    const entranceScaleY = this.fittedScaleY * 0.82;
    this.image.setAlpha(0).setX(x + 170).setScale(entranceScaleX, entranceScaleY);
    this.scene.tweens.add({
      targets: this.image,
      x,
      alpha: 1,
      scaleX: this.fittedScaleX,
      scaleY: this.fittedScaleY,
      duration: 720,
      ease: "Back.Out",
      onComplete: () => this.startIdleMotion()
    });
    return this.image;
  }

  setPersistentPose(pose: PremiumGabbyPose): void {
    this.persistentPose = pose;
    if (!this.restoreTimer) this.show(pose);
  }

  play(pose: PremiumGabbyPose, duration = 900): void {
    this.restoreTimer?.remove(false);
    this.restoreTimer = undefined;
    this.scene.tweens.killTweensOf(this.image);
    this.show(pose);

    if (pose === "hurt") {
      this.scene.tweens.add({ targets: this.image, x: this.baseX + 16, angle: 2.5, duration: 70, yoyo: true, repeat: 3 });
    } else if (pose === "wind") {
      this.scene.tweens.add({ targets: this.image, x: this.baseX + 22, angle: 4, duration: 180, yoyo: true, repeat: 2, ease: "Sine.InOut" });
    } else if (pose === "heavy-cast") {
      this.image.setScale(this.fittedScaleX * 0.91, this.fittedScaleY * 0.91);
      this.scene.tweens.add({ targets: this.image, scaleX: this.fittedScaleX * 1.04, scaleY: this.fittedScaleY * 1.04, duration: 260, ease: "Back.Out" });
    } else if (pose === "card-play" || pose === "light-cast") {
      this.image.setX(this.baseX + 12);
      this.scene.tweens.add({ targets: this.image, x: this.baseX - 10, duration: 170, yoyo: true, ease: "Quad.Out" });
    } else if (pose === "victory") {
      this.scene.tweens.add({ targets: this.image, y: this.baseY - 16, duration: 360, yoyo: true, repeat: 1, ease: "Back.Out" });
      return;
    } else if (pose === "defeat") {
      this.scene.tweens.add({ targets: this.image, y: this.baseY + 8, alpha: 0.9, duration: 500, ease: "Sine.Out" });
      return;
    }

    this.restoreTimer = this.scene.time.delayedCall(duration, () => {
      this.restoreTimer = undefined;
      this.show(this.persistentPose);
      this.startIdleMotion();
    });
  }

  private show(pose: PremiumGabbyPose): void {
    this.image.setTexture(textureKey(pose)).setPosition(this.baseX, this.baseY).setAngle(0).setAlpha(1);
    this.fit(pose);
  }

  private fit(pose: PremiumGabbyPose): void {
    const source = this.scene.textures.get(textureKey(pose)).getSourceImage() as HTMLImageElement;
    const height = pose === "defeat" ? this.baseHeight * 0.86 : this.baseHeight;
    this.image.setDisplaySize(height * (source.width / source.height), height);
    this.fittedScaleX = this.image.scaleX;
    this.fittedScaleY = this.image.scaleY;
  }

  private startIdleMotion(): void {
    this.scene.tweens.killTweensOf(this.image);
    this.image.setPosition(this.baseX, this.baseY).setAngle(0);
    this.scene.tweens.add({
      targets: this.image,
      y: this.baseY - 4,
      scaleX: this.fittedScaleX * 1.008,
      scaleY: this.fittedScaleY * 0.996,
      angle: -0.35,
      duration: 1560,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
  }
}
