import Phaser from "phaser";
import { CARD_BACK_KEY, premiumCardTexture } from "./CardVisuals";
import { CARD_NAMES } from "../rules/cards";
import type { CardKind } from "../rules/types";
import { virtualViewport } from "../render/virtualViewport";

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
    const { width, height } = virtualViewport(this.scene);
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
      else if (kind === "arsonist") this.fireSurge(from, to);
      else if (kind === "draw2") this.arcaneVolley(from, to, color);
      else if (kind === "wild4") this.chaosConvergence(to);
      else if (kind === "stormcall") this.lightning(to, color);
      else if (kind === "mirror") this.mirrorShards(width / 2, height / 2, color);
      else if (kind === "cleanse") this.healingRings(from, color);
      else this.projectileBurst(from, to, color, 1);
    });

    await new Promise<void>((resolve) => {
      this.scene.time.delayedCall(1880, () => {
        this.scene.tweens.add({
          targets: [title, veil, colorVeil, reveal],
          alpha: 0,
          duration: 320,
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
    const { width, height } = virtualViewport(this.scene);
    const cardWidth = height > width ? 184 : 224;
    const cardHeight = cardWidth * 1.5;
    const root = this.scene.add.container(width / 2, height * 0.5).setDepth(328).setAlpha(0).setScale(0.32).setAngle(-8);
    const glowOuter = this.scene.add.rectangle(0, 0, cardWidth + 42, cardHeight + 42, color, 0.12).setRounded(28).setStrokeStyle(7, color, 0.75).setBlendMode(Phaser.BlendModes.ADD);
    const glowInner = this.scene.add.rectangle(0, 0, cardWidth + 16, cardHeight + 16, 0x070813, 0.9).setRounded(20).setStrokeStyle(4, 0xffe7a6, 0.95);
    const premium = premiumCardTexture(kind);
    let face: Phaser.GameObjects.GameObject;
    if (premium) {
      const sprite = this.scene.add.sprite(0, 0, premium.texture, premium.animation ? Phaser.Math.Between(0, 47) : 0).setDisplaySize(cardWidth, cardHeight);
      if (premium.animation) sprite.play({ key: premium.animation, startFrame: Phaser.Math.Between(0, 47) });
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
    this.scene.time.delayedCall(860, () => this.scene.tweens.add({ targets: root, x: width * 0.24, y: height * 0.54, scale: 0.64, angle: -4, duration: 380, ease: "Cubic.InOut" }));
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
    const angle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    for (let index = 0; index < 18; index += 1) {
      const shard = this.scene.add.polygon(from.x, from.y, [0, -34, 9, 8, 3, 42, -8, 8], index % 3 ? color : 0xeaffff, 0.92).setStrokeStyle(2, 0xffffff, 0.9).setDepth(320).setAngle(Phaser.Math.RadToDeg(angle) + 90).setScale(0.25).setBlendMode(Phaser.BlendModes.ADD);
      const spread = (index - 8.5) * 13;
      this.scene.tweens.add({ targets: shard, x: to.x + Math.cos(angle + Math.PI / 2) * spread, y: to.y + Math.sin(angle + Math.PI / 2) * spread + 35, angle: shard.angle + 120, scale: 1 + (index % 4) * 0.16, duration: 410 + index * 18, ease: "Cubic.In", onComplete: () => this.scene.tweens.add({ targets: shard, alpha: 0, y: shard.y - 24, duration: 420, onComplete: () => shard.destroy() }) });
    }
    for (let wave = 0; wave < 4; wave += 1) {
      const ring = this.scene.add.ellipse(to.x, to.y + 55, 70, 24, 0x08152a, 0.08).setStrokeStyle(7 - wave, wave % 2 ? 0xffffff : color, 0.9).setDepth(319).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
      this.scene.tweens.add({ targets: ring, scaleX: 3.6 + wave * 0.7, scaleY: 2 + wave * 0.3, alpha: 0, duration: 620, delay: wave * 70, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    }
  }

  private whirlwind(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number): void {
    const centerX = (from.x + to.x) / 2;
    const centerY = (from.y + to.y) / 2;
    this.scene.cameras.main.shake(880, 0.014);
    for (let ring = 0; ring < 9; ring += 1) {
      const ribbon = this.scene.add.ellipse(centerX, to.y + 105 - ring * 24, 90 + ring * 36, 22 + ring * 5, 0x06191b, 0.04).setStrokeStyle(6 - ring * 0.35, ring % 2 ? 0xffffff : color, 0.82).setDepth(320 + ring).setBlendMode(Phaser.BlendModes.ADD).setScale(0.18).setAngle(ring % 2 ? -8 : 8);
      this.scene.tweens.add({ targets: ribbon, scale: 1, angle: ring % 2 ? 350 : -350, alpha: 0, duration: 720 + ring * 65, delay: ring * 22, ease: "Cubic.Out", onComplete: () => ribbon.destroy() });
    }
    for (let index = 0; index < 22; index += 1) {
      const streak = this.scene.add.rectangle(centerX, to.y + 80, 34 + index % 5 * 9, 3, index % 3 ? color : 0xffffff, 0.88).setDepth(330).setBlendMode(Phaser.BlendModes.ADD);
      const angle = index * 1.42;
      const radius = 50 + index * 6;
      streak.setPosition(centerX + Math.cos(angle) * radius, to.y + 80 + Math.sin(angle) * radius * 0.35).setAngle(Phaser.Math.RadToDeg(angle));
      this.scene.tweens.add({ targets: streak, x: centerX + Math.cos(angle + 4.6) * radius * 0.25, y: to.y - 180 + Math.sin(angle) * 35, angle: streak.angle + 600, alpha: 0, scaleX: 0.15, duration: 690 + index * 19, onComplete: () => streak.destroy() });
    }
    for (let index = 0; index < 6; index += 1) {
      const beginsLeft = index % 2 === 0;
      const card = this.scene.add.image(beginsLeft ? from.x : to.x, (beginsLeft ? from.y : to.y) + (index - 2.5) * 10, CARD_BACK_KEY)
        .setDisplaySize(72, 108).setDepth(338 + index).setAngle(beginsLeft ? -18 : 18).setScale(0.42);
      this.scene.tweens.add({
        targets: card,
        x: beginsLeft ? to.x : from.x,
        y: beginsLeft ? to.y : from.y,
        angle: beginsLeft ? 720 : -720,
        scale: 0.78,
        duration: 900,
        delay: index * 65,
        ease: "Sine.InOut",
        onComplete: () => card.destroy()
      });
    }
    const vortex = this.scene.add.circle(centerX, centerY, 42, 0x07191a, 0.35).setStrokeStyle(9, color, 0.95).setDepth(337).setBlendMode(Phaser.BlendModes.ADD).setScale(0.15);
    this.scene.tweens.add({ targets: vortex, scale: 3.6, angle: 720, alpha: 0, duration: 1050, ease: "Cubic.Out", onComplete: () => vortex.destroy() });
  }

  private fireSurge(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): void {
    const angle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    for (let index = 0; index < 3; index += 1) {
      const root = this.scene.add.container(from.x, from.y + (index - 1) * 18).setDepth(324).setRotation(angle).setScale(0.35);
      const wake = this.scene.add.ellipse(-42, 0, 118, 34, 0xff3518, 0.3).setBlendMode(Phaser.BlendModes.ADD);
      const body = this.scene.add.ellipse(0, 0, 64, 46, index === 1 ? 0xffffff : 0xff8a2d, 0.95).setStrokeStyle(8, 0xff3518, 0.9).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.scene.add.circle(8, -4, 12, 0xfff2b0, 1).setBlendMode(Phaser.BlendModes.ADD);
      root.add([wake, body, core]);
      this.scene.tweens.add({ targets: wake, scaleX: 1.5, alpha: 0.08, duration: 140, yoyo: true, repeat: 3 });
      this.scene.tweens.add({ targets: root, x: to.x, y: to.y + (index - 1) * 22, scale: 1 + index * 0.12, duration: 410 + index * 55, delay: index * 45, ease: "Cubic.In", onComplete: () => { this.fireImpact(root.x, root.y); root.destroy(true); } });
    }
  }

  private fireImpact(x: number, y: number): void {
    for (let ring = 0; ring < 3; ring += 1) {
      const shock = this.scene.add.circle(x, y, 24, 0xff3b17, 0.05).setStrokeStyle(9 - ring * 2, ring === 1 ? 0xffd26a : 0xff4a1e, 0.95).setDepth(326).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: shock, scale: 3.5 + ring, alpha: 0, duration: 420 + ring * 90, delay: ring * 35, ease: "Cubic.Out", onComplete: () => shock.destroy() });
    }
    for (let index = 0; index < 24; index += 1) {
      const ember = this.scene.add.circle(x, y, 3 + index % 4, index % 4 ? 0xff5a20 : 0xffffff, 1).setDepth(329).setBlendMode(Phaser.BlendModes.ADD);
      const angle = Math.PI * 2 * index / 24;
      this.scene.tweens.add({ targets: ember, x: x + Math.cos(angle) * (70 + index * 4), y: y + Math.sin(angle) * (55 + index * 2) - 45, alpha: 0, scale: 0.15, duration: 480 + index * 14, onComplete: () => ember.destroy() });
    }
  }

  private arcaneVolley(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number): void {
    for (let index = 0; index < 2; index += 1) {
      const card = this.scene.add.image(from.x + (index ? 24 : -24), from.y, CARD_BACK_KEY).setDisplaySize(72, 108).setDepth(326).setAngle(index ? 18 : -18).setScale(0.35).setBlendMode(Phaser.BlendModes.ADD);
      const halo = this.scene.add.circle(card.x, card.y, 42, color, 0.08).setStrokeStyle(5, color, 0.86).setDepth(325).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: [card, halo], x: to.x + (index ? 30 : -30), y: to.y, scale: index ? 0.72 : 0.78, angle: index ? 382 : -382, alpha: 0, duration: 650, delay: index * 110, ease: "Cubic.In", onComplete: () => { card.destroy(); halo.destroy(); } });
    }
  }

  private chaosConvergence(to: Phaser.Math.Vector2): void {
    const { width, height } = virtualViewport(this.scene);
    const rift = this.scene.add.circle(width / 2, height / 2, 42, 0x130019, 0.72).setStrokeStyle(12, 0xc356ff, 0.9).setDepth(323).setBlendMode(Phaser.BlendModes.ADD).setScale(0.1);
    const core = this.scene.add.star(width / 2, height / 2, 8, 12, 35, 0xff4b38, 0.95).setDepth(324).setBlendMode(Phaser.BlendModes.ADD).setScale(0.1);
    this.scene.tweens.add({ targets: [rift, core], scale: 1.5, angle: 360, duration: 330, ease: "Back.Out" });
    for (let index = 0; index < 4; index += 1) {
      const angle = Math.PI * 2 * index / 4 - Math.PI / 4;
      const seal = this.scene.add.circle(width / 2 + Math.cos(angle) * width * 0.3, height / 2 + Math.sin(angle) * height * 0.34, 38, 0x210008, 0.7).setStrokeStyle(6, index % 2 ? 0xff4b38 : 0xc356ff, 0.96).setDepth(327).setScale(0.2);
      const mark = this.scene.add.text(seal.x, seal.y, "+4", { fontFamily: "Georgia, serif", fontSize: "25px", fontStyle: "bold", color: "#ffffff", stroke: "#340009", strokeThickness: 6 }).setOrigin(0.5).setDepth(328).setAlpha(0);
      this.scene.tweens.add({ targets: [seal, mark], scale: 1, alpha: 1, duration: 250, delay: index * 65, ease: "Back.Out", onComplete: () => this.scene.tweens.add({ targets: [seal, mark], x: to.x, y: to.y, scale: 0.15, alpha: 0, duration: 520, delay: 180, ease: "Cubic.In", onComplete: () => { seal.destroy(); mark.destroy(); } }) });
    }
    this.scene.tweens.add({ targets: [rift, core], x: to.x, y: to.y, scale: 0.15, alpha: 0, duration: 520, delay: 520, ease: "Cubic.In", onComplete: () => { rift.destroy(); core.destroy(); this.fireImpact(to.x, to.y); } });
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
