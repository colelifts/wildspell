import Phaser from "phaser";
import { premiumCardTexture } from "./CardVisuals";
import { CARD_NAMES } from "../rules/cards";
import type { CardKind } from "../rules/types";

const COLORS: Partial<Record<CardKind, number>> = {
  freeze: 0x78e8ff,
  rewind: 0x5ff0b1,
  draw2: 0xffdd67,
  wild4: 0xc178ff,
  prism: 0xff77df,
  arsonist: 0xff542e,
  whirlwind: 0x69efbd,
  stormcall: 0xffec66,
  frostbite: 0xb7f4ff,
  mirror: 0xd9c4ff,
  cleanse: 0xa6ffc1
};

export class SpellCinematics {
  private active = false;

  constructor(private readonly scene: Phaser.Scene) {}

  async play(kind: CardKind, from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): Promise<void> {
    if (kind === "number" || this.active) return;
    this.active = true;
    const color = COLORS[kind] ?? 0xffffff;
    const { width, height } = this.scene.scale;
    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x02030b, 0).setDepth(300);
    const colorVeil = this.scene.add.rectangle(width / 2, height / 2, width, height, color, 0).setDepth(301).setBlendMode(Phaser.BlendModes.ADD);
    const title = this.scene.add.text(width / 2, height * 0.13, CARD_NAMES[kind].toUpperCase(), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: "54px",
      fontStyle: "bold",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#071126",
      strokeThickness: 12
    }).setOrigin(0.5).setAlpha(0).setScale(0.45).setDepth(330);
    const reveal = this.cardReveal(kind, color);
    this.scene.cameras.main.shake(kind === "wild4" || kind === "arsonist" ? 620 : 320, 0.009);
    this.scene.tweens.add({ targets: veil, fillAlpha: 0.62, duration: 180 });
    this.scene.tweens.add({ targets: colorVeil, fillAlpha: kind === "stormcall" ? 0.34 : 0.16, yoyo: true, duration: 260 });
    this.scene.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 260, ease: "Back.Out" });

    this.scene.time.delayedCall(360, () => {
      if (kind === "whirlwind") this.whirlwind(from, to, color);
      else if (kind === "freeze" || kind === "frostbite") this.iceWave(from, to, color);
      else if (kind === "stormcall") this.lightning(to, color);
      else if (kind === "mirror") this.mirrorShards(width / 2, height / 2, color);
      else if (kind === "cleanse") this.healingRings(from, color);
      else this.projectileBurst(from, to, color, kind === "wild4" ? 4 : kind === "draw2" ? 2 : 1);
    });

    await new Promise<void>((resolve) => {
      this.scene.time.delayedCall(1460, () => {
        this.scene.tweens.add({
          targets: [title, veil, colorVeil, reveal],
          alpha: 0,
          duration: 260,
          onComplete: () => {
            title.destroy();
            veil.destroy();
            colorVeil.destroy();
            reveal.destroy(true);
            this.active = false;
            resolve();
          }
        });
      });
    });
  }

  private cardReveal(kind: CardKind, color: number): Phaser.GameObjects.Container {
    const { width, height } = this.scene.scale;
    const cardWidth = height > width ? 184 : 224;
    const cardHeight = cardWidth * 1.5;
    const root = this.scene.add.container(width / 2, height * 0.5).setDepth(328).setAlpha(0).setScale(0.32).setAngle(-8);
    const glowOuter = this.scene.add.rectangle(0, 0, cardWidth + 42, cardHeight + 42, color, 0.12).setRounded(28).setStrokeStyle(7, color, 0.75).setBlendMode(Phaser.BlendModes.ADD);
    const glowInner = this.scene.add.rectangle(0, 0, cardWidth + 16, cardHeight + 16, 0x070813, 0.9).setRounded(20).setStrokeStyle(4, 0xffe7a6, 0.95);
    const premium = premiumCardTexture(kind);
    let face: Phaser.GameObjects.GameObject;
    if (premium) {
      const sprite = this.scene.add.sprite(0, 0, premium.texture, Phaser.Math.Between(0, 47)).setDisplaySize(cardWidth, cardHeight);
      sprite.play({ key: premium.animation, startFrame: Phaser.Math.Between(0, 47) });
      face = sprite;
    } else {
      const panel = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x090c1c, 1).setRounded(16).setStrokeStyle(5, color, 1);
      const sigil = this.scene.add.circle(0, -24, cardWidth * 0.28, color, 0.18).setStrokeStyle(6, color, 0.9).setBlendMode(Phaser.BlendModes.ADD);
      const name = this.scene.add.text(0, cardHeight * 0.28, CARD_NAMES[kind].toUpperCase(), { fontFamily: "Georgia, serif", fontSize: `${Math.max(18, cardWidth * 0.1)}px`, fontStyle: "bold", color: "#fff4d6", stroke: "#060713", strokeThickness: 7, align: "center", wordWrap: { width: cardWidth * 0.8 } }).setOrigin(0.5);
      const fallback = this.scene.add.container(0, 0, [panel, sigil, name]);
      face = fallback;
    }
    root.add([glowOuter, glowInner, face]);
    this.scene.tweens.add({ targets: root, alpha: 1, scale: 1, angle: 0, duration: 330, ease: "Back.Out" });
    this.scene.tweens.add({ targets: glowOuter, scale: 1.12, alpha: 0.04, duration: 420, yoyo: true, repeat: 2, ease: "Sine.InOut" });
    this.scene.time.delayedCall(690, () => this.scene.tweens.add({ targets: root, x: width * 0.24, y: height * 0.54, scale: 0.64, angle: -4, duration: 300, ease: "Cubic.InOut" }));
    return root;
  }

  private projectileBurst(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const orb = this.scene.add.container(from.x, from.y).setDepth(320);
      const outer = this.scene.add.circle(0, 0, 28 + index * 3, color, 0.22).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.scene.add.circle(0, 0, 14 + index * 2, color, 0.95).setStrokeStyle(5, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD);
      const whiteHot = this.scene.add.circle(-4, -4, 5 + index, 0xffffff, 0.92).setBlendMode(Phaser.BlendModes.ADD);
      orb.add([outer, core, whiteHot]);
      for (let trail = 0; trail < 10; trail += 1) {
        const ember = this.scene.add.circle(from.x, from.y, 3 + trail % 3, trail % 2 ? color : 0xffe19a, 0.9).setDepth(319).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: ember, x: to.x + (index - (count - 1) / 2) * 30 - 18 - trail * 9, y: to.y + Math.sin(index) * 45 + Phaser.Math.Between(-18, 18), alpha: 0, scale: 0.15, duration: 440 + index * 70 + trail * 18, ease: "Cubic.In", onComplete: () => ember.destroy() });
      }
      this.scene.tweens.add({
        targets: orb,
        x: to.x + (index - (count - 1) / 2) * 30,
        y: to.y + Math.sin(index) * 45,
        scale: 1.35,
        duration: 430 + index * 70,
        ease: "Cubic.In",
        onComplete: () => this.burst(orb.x, orb.y, color, orb)
      });
    }
  }

  private iceWave(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number): void {
    for (let index = 0; index < 12; index += 1) {
      const shard = this.scene.add.triangle(from.x, from.y, 0, 28, 10, 0, 20, 28, color, 0.95).setDepth(320);
      this.scene.tweens.add({ targets: shard, x: to.x + (index - 6) * 14, y: to.y + 80 - Math.abs(index - 6) * 9, angle: 160, duration: 380 + index * 25, ease: "Cubic.In", onComplete: () => shard.destroy() });
    }
  }

  private whirlwind(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number): void {
    const centerX = (from.x + to.x) / 2;
    for (let index = 0; index < 18; index += 1) {
      const mote = this.scene.add.star(centerX, to.y + 80, 5, 3, 8, color, 0.9).setDepth(320);
      const angle = index * 0.72;
      this.scene.tweens.add({ targets: mote, x: centerX + Math.cos(angle) * (40 + index * 4), y: to.y + 100 - index * 17, angle: 540, scale: 0.2, alpha: 0, duration: 720 + index * 18, onComplete: () => mote.destroy() });
    }
  }

  private lightning(to: Phaser.Math.Vector2, color: number): void {
    const graphics = this.scene.add.graphics().setDepth(325);
    graphics.lineStyle(8, 0xffffff, 1).beginPath().moveTo(to.x - 80, 0).lineTo(to.x + 10, to.y - 80).lineTo(to.x - 25, to.y - 25).lineTo(to.x, to.y + 55).strokePath();
    graphics.lineStyle(18, color, 0.55).strokePath();
    this.scene.tweens.add({ targets: graphics, alpha: 0, duration: 380, onComplete: () => graphics.destroy() });
  }

  private mirrorShards(x: number, y: number, color: number): void {
    for (let index = 0; index < 14; index += 1) {
      const shard = this.scene.add.polygon(x, y, [0, -24, 12, 0, 4, 28, -10, 5], color, 0.72).setStrokeStyle(2, 0xffffff).setDepth(320);
      const angle = (Math.PI * 2 * index) / 14;
      this.scene.tweens.add({ targets: shard, x: x + Math.cos(angle) * 310, y: y + Math.sin(angle) * 190, angle: 360, alpha: 0, duration: 760, onComplete: () => shard.destroy() });
    }
  }

  private healingRings(from: Phaser.Math.Vector2, color: number): void {
    for (let index = 0; index < 4; index += 1) {
      const ring = this.scene.add.circle(from.x, from.y, 35, color, 0).setStrokeStyle(7, color, 0.9).setDepth(320);
      this.scene.tweens.add({ targets: ring, scale: 4 + index, alpha: 0, duration: 700, delay: index * 90, onComplete: () => ring.destroy() });
    }
  }

  private burst(x: number, y: number, color: number, source: Phaser.GameObjects.GameObject): void {
    source.destroy();
    for (let index = 0; index < 18; index += 1) {
      const spark = this.scene.add.circle(x, y, 3 + (index % 3), index % 2 ? color : 0xffffff, 1).setDepth(325).setBlendMode(Phaser.BlendModes.ADD);
      const angle = (Math.PI * 2 * index) / 18;
      this.scene.tweens.add({ targets: spark, x: x + Math.cos(angle) * 100, y: y + Math.sin(angle) * 100, alpha: 0, scale: 0, duration: 430, onComplete: () => spark.destroy() });
    }
  }
}
