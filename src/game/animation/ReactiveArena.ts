import Phaser from "phaser";
import type { CardKind, GameState } from "../rules/types";

const COLOR_MAGIC = {
  red: 0xff3e25,
  blue: 0x45c9ff,
  green: 0x38e29c,
  yellow: 0xffd34d
} as const;

export class ReactiveArena {
  private background!: Phaser.GameObjects.Image;
  private atmosphere!: Phaser.GameObjects.Rectangle;
  private rune!: Phaser.GameObjects.Graphics;
  private persistentTint = 0x25103b;

  constructor(private readonly scene: Phaser.Scene, private readonly portrait: boolean) {}

  create(backgroundKey: string): void {
    const { width, height } = this.scene.scale;
    this.background = this.scene.add.image(width / 2, height / 2, backgroundKey)
      .setDisplaySize(this.portrait ? 1820 : 1600, this.portrait ? 1024 : 900)
      .setDepth(-30);
    this.scene.tweens.add({
      targets: this.background,
      scaleX: 1.025,
      scaleY: 1.025,
      x: width / 2 + (this.portrait ? 8 : 14),
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });

    const farMist = this.scene.add.ellipse(width * 0.2, height * 0.46, width * 0.7, height * 0.34, 0x8c5cff, 0.06).setDepth(-27).setBlendMode(Phaser.BlendModes.ADD);
    const nearMist = this.scene.add.ellipse(width * 0.78, height * 0.58, width * 0.68, height * 0.28, 0x3ac9ff, 0.05).setDepth(-26).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: farMist, x: width * 0.82, alpha: 0.13, duration: 11500, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.scene.tweens.add({ targets: nearMist, x: width * 0.18, alpha: 0.11, duration: 8900, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.rune = this.scene.add.graphics().setDepth(-12).setAlpha(0.58);
    this.drawRune(width / 2, this.portrait ? height * 0.52 : height * 0.59, this.portrait ? 225 : 255, 0x7d58ff);
    this.scene.tweens.add({ targets: this.rune, angle: 360, duration: 42000, repeat: -1 });

    this.atmosphere = this.scene.add.rectangle(width / 2, height / 2, width, height, this.persistentTint, 0.11)
      .setDepth(-10)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.createAmbientParticles();
  }

  sync(state: GameState): void {
    this.persistentTint = COLOR_MAGIC[state.currentColor];
    const danger = state.statuses.some((status) => status.burn > 0);
    this.atmosphere.setFillStyle(danger ? 0x6a1208 : this.persistentTint, danger ? 0.16 : 0.08);
  }

  react(kind: CardKind, target: Phaser.Math.Vector2, stackAmount: number): void {
    if (kind === "freeze") this.freeze(target);
    else if (kind === "arsonist") this.burn(target);
    else if (kind === "whirlwind") this.whirlwind(target);
    else if (kind === "draw2") this.drawSpell(target, 2, 0x9b67ff);
    else if (kind === "wild4") this.chaos(target, Math.max(4, stackAmount));
  }

  private drawRune(x: number, y: number, radius: number, color: number): void {
    this.rune.clear().lineStyle(2, color, 0.4);
    for (let ring = 0; ring < 4; ring += 1) this.rune.strokeCircle(x, y, radius - ring * 28);
    for (let spoke = 0; spoke < 12; spoke += 1) {
      const angle = (Math.PI * 2 * spoke) / 12;
      this.rune.lineBetween(x + Math.cos(angle) * (radius - 82), y + Math.sin(angle) * (radius - 82), x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
  }

  private createAmbientParticles(): void {
    if (!this.scene.textures.exists("arena-mote")) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff, 1).fillCircle(3, 3, 3).generateTexture("arena-mote", 6, 6).destroy();
    }
    this.scene.add.particles(this.scene.scale.width / 2, this.scene.scale.height * 0.52, "arena-mote", {
      x: { min: -this.scene.scale.width * 0.5, max: this.scene.scale.width * 0.5 },
      y: { min: -this.scene.scale.height * 0.45, max: this.scene.scale.height * 0.45 },
      lifespan: { min: 3000, max: 6200 },
      speedY: { min: -16, max: -4 },
      speedX: { min: -7, max: 7 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.62, end: 0 },
      tint: [0x7fdfff, 0xc078ff, 0xffd36d],
      frequency: 105,
      blendMode: Phaser.BlendModes.ADD
    }).setDepth(-8);
  }

  private flash(color: number, alpha: number, duration: number): void {
    const { width, height } = this.scene.scale;
    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, color, 0).setDepth(250).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: veil, fillAlpha: alpha, duration: duration * 0.25, yoyo: true, hold: duration * 0.45, onComplete: () => veil.destroy() });
  }

  private freeze(target: Phaser.Math.Vector2): void {
    this.flash(0x7ee9ff, 0.34, 1450);
    const frost = this.scene.add.graphics().setDepth(255);
    frost.lineStyle(8, 0xbef7ff, 0.7);
    const { width, height } = this.scene.scale;
    for (let branch = 0; branch < 14; branch += 1) {
      const edgeX = branch % 2 ? 0 : width;
      const edgeY = (branch / 14) * height;
      frost.lineBetween(edgeX, edgeY, edgeX + (edgeX ? -1 : 1) * (45 + branch * 4), edgeY + (branch % 3 - 1) * 42);
    }
    for (let index = 0; index < 46; index += 1) {
      const snow = this.scene.add.circle(Phaser.Math.Between(0, width), Phaser.Math.Between(-80, 20), Phaser.Math.Between(2, 5), 0xe6fdff, Phaser.Math.FloatBetween(0.55, 1)).setDepth(260);
      this.scene.tweens.add({ targets: snow, x: snow.x + Phaser.Math.Between(-90, 90), y: height + 80, angle: 260, duration: Phaser.Math.Between(700, 1300), onComplete: () => snow.destroy() });
    }
    const prison = this.scene.add.circle(target.x, target.y + 40, 72, 0x7ee9ff, 0.12).setStrokeStyle(8, 0xc7fbff, 0.88).setDepth(245);
    this.scene.tweens.add({ targets: prison, scale: 1.24, alpha: 0, duration: 1450, ease: "Cubic.Out", onComplete: () => prison.destroy() });
    this.scene.tweens.add({ targets: frost, alpha: 0, duration: 650, delay: 900, onComplete: () => frost.destroy() });
  }

  private burn(target: Phaser.Math.Vector2): void {
    this.flash(0xff431f, 0.3, 1250);
    const cracks = this.scene.add.graphics().setDepth(245).lineStyle(5, 0xff6b27, 0.92);
    for (let ray = 0; ray < 12; ray += 1) {
      const angle = (Math.PI * 2 * ray) / 12;
      cracks.lineBetween(target.x, target.y + 75, target.x + Math.cos(angle) * Phaser.Math.Between(70, 180), target.y + 75 + Math.sin(angle) * Phaser.Math.Between(45, 110));
    }
    for (let index = 0; index < 42; index += 1) {
      const ember = this.scene.add.circle(target.x + Phaser.Math.Between(-130, 130), target.y + Phaser.Math.Between(20, 130), Phaser.Math.Between(2, 6), index % 3 ? 0xff5b22 : 0xffd064, 0.95).setDepth(260).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: ember, x: ember.x + Phaser.Math.Between(-45, 45), y: ember.y - Phaser.Math.Between(120, 280), alpha: 0, scale: 0.2, duration: Phaser.Math.Between(700, 1450), onComplete: () => ember.destroy() });
    }
    this.scene.tweens.add({ targets: cracks, alpha: 0, duration: 1200, delay: 500, onComplete: () => cracks.destroy() });
  }

  private whirlwind(target: Phaser.Math.Vector2): void {
    const centerX = this.scene.scale.width / 2;
    const centerY = target.y + 45;
    this.scene.tweens.add({ targets: this.scene.cameras.main, rotation: 0.015, duration: 120, yoyo: true, repeat: 5 });
    for (let index = 0; index < 44; index += 1) {
      const debris = this.scene.add.star(centerX, centerY, 5, 2, Phaser.Math.Between(4, 10), index % 3 ? 0xaaf8df : 0x704d35, 0.92).setDepth(260);
      const angle = (Math.PI * 2 * index) / 44;
      const radius = 45 + index * 5;
      debris.setPosition(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius * 0.38);
      this.scene.tweens.add({ targets: debris, angle: 720, x: centerX + Math.cos(angle + Math.PI * 2) * radius * 0.25, y: centerY - 210 + Math.sin(angle) * 40, alpha: 0, scale: 0.15, duration: 780 + index * 14, onComplete: () => debris.destroy() });
    }
  }

  private drawSpell(target: Phaser.Math.Vector2, count: number, color: number): void {
    this.flash(color, 0.2, 900);
    for (let index = 0; index < count; index += 1) {
      const card = this.scene.add.rectangle(this.scene.scale.width / 2 + (index - (count - 1) / 2) * 42, this.scene.scale.height * 0.45, 48, 72, 0x100623, 0.96)
        .setStrokeStyle(4, color, 1)
        .setDepth(270)
        .setAngle((index - (count - 1) / 2) * 18);
      this.scene.tweens.add({ targets: card, x: target.x + (index - (count - 1) / 2) * 34, y: target.y, angle: 360, scale: 0.55, alpha: 0, duration: 700 + index * 90, ease: "Cubic.In", onComplete: () => card.destroy() });
    }
  }

  private chaos(target: Phaser.Math.Vector2, stackAmount: number): void {
    this.flash(0xb30d16, 0.38, 1700);
    this.scene.cameras.main.shake(680, 0.012);
    for (let index = 0; index < 4; index += 1) {
      const angle = (Math.PI * 2 * index) / 4 - Math.PI / 4;
      const seal = this.scene.add.circle(this.scene.scale.width / 2 + Math.cos(angle) * 250, this.scene.scale.height * 0.46 + Math.sin(angle) * 165, 58, 0x250007, 0.72)
        .setStrokeStyle(8, 0xff3c25, 1)
        .setDepth(265)
        .setScale(0.1);
      const label = this.scene.add.text(seal.x, seal.y, `+${Math.max(4, Math.ceil(stackAmount / 4) * 4)}`, { fontFamily: "Georgia", fontSize: "24px", fontStyle: "bold", color: "#fff0df", stroke: "#62040a", strokeThickness: 6 }).setOrigin(0.5).setDepth(266).setAlpha(0);
      this.scene.tweens.add({ targets: seal, scale: 1, angle: 360, duration: 420, delay: index * 150, ease: "Back.Out", onComplete: () => this.scene.tweens.add({ targets: seal, x: target.x, y: target.y, scale: 0.15, alpha: 0, duration: 620, delay: 260, onComplete: () => seal.destroy() }) });
      this.scene.tweens.add({ targets: label, alpha: 1, duration: 220, delay: index * 150 + 180, yoyo: true, hold: 450, onComplete: () => label.destroy() });
    }
  }
}
