import Phaser from "phaser";
import type { CardKind, GameState } from "../rules/types";
import { virtualViewport } from "../render/virtualViewport";

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
    const { width, height } = virtualViewport(this.scene);
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
    if (kind === "freeze" || kind === "frostbite") this.freeze(target);
    else if (kind === "arsonist") this.burn(target);
    else if (kind === "whirlwind") this.whirlwind(target);
    else if (kind === "draw2") this.drawSpell(target, 2, 0x9b67ff);
    else if (kind === "wild4") this.chaos(target, Math.max(4, stackAmount));
    else if (kind === "stormcall") this.storm(target);
    else if (kind === "mirror") this.mirror(target);
    else if (kind === "cleanse") this.cleanse(target);
    else if (kind === "prism") this.prismShift();
    else if (kind === "rewind") this.rewind(target);
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
    const { width, height } = virtualViewport(this.scene);
    if (!this.scene.textures.exists("arena-mote")) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff, 1).fillCircle(3, 3, 3).generateTexture("arena-mote", 6, 6).destroy();
    }
    this.scene.add.particles(width / 2, height * 0.52, "arena-mote", {
      x: { min: -width * 0.5, max: width * 0.5 },
      y: { min: -height * 0.45, max: height * 0.45 },
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
    const { width, height } = virtualViewport(this.scene);
    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, color, 0).setDepth(250).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: veil, fillAlpha: alpha, duration: duration * 0.25, yoyo: true, hold: duration * 0.45, onComplete: () => veil.destroy() });
  }

  private freeze(target: Phaser.Math.Vector2): void {
    this.flash(0x7ee9ff, 0.42, 1650);
    const { width, height } = virtualViewport(this.scene);
    const frost = this.scene.add.graphics().setDepth(255).setBlendMode(Phaser.BlendModes.ADD);
    frost.lineStyle(18, 0x5bc8ff, 0.18).strokeRect(4, 4, width - 8, height - 8);
    frost.lineStyle(4, 0xd9fbff, 0.9);
    for (let branch = 0; branch < 22; branch += 1) {
      const horizontal = branch % 2 === 0;
      const edgeX = horizontal ? (branch % 4 ? 0 : width) : (branch / 22) * width;
      const edgeY = horizontal ? (branch / 22) * height : (branch % 4 ? 0 : height);
      const inwardX = horizontal ? (edgeX ? -1 : 1) * (55 + (branch % 5) * 18) : (branch % 3 - 1) * 32;
      const inwardY = horizontal ? (branch % 3 - 1) * 28 : (edgeY ? -1 : 1) * (50 + (branch % 6) * 14);
      frost.beginPath().moveTo(edgeX, edgeY).lineTo(edgeX + inwardX, edgeY + inwardY).lineTo(edgeX + inwardX * 1.35, edgeY + inwardY * 0.72).strokePath();
    }
    for (let index = 0; index < 38; index += 1) {
      const streak = this.scene.add.rectangle(Phaser.Math.Between(-100, width), Phaser.Math.Between(-120, height), Phaser.Math.Between(18, 54), Phaser.Math.Between(2, 5), index % 4 ? 0xdffbff : 0x75dfff, Phaser.Math.FloatBetween(0.55, 0.95)).setDepth(260).setAngle(-24).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: streak, x: streak.x + Phaser.Math.Between(180, 360), y: streak.y + Phaser.Math.Between(260, 520), alpha: 0, scaleX: 0.25, duration: Phaser.Math.Between(620, 1150), delay: index * 12, ease: "Cubic.In", onComplete: () => streak.destroy() });
    }
    const shell = this.scene.add.circle(target.x, target.y + 35, 78, 0x73dcff, 0.16).setStrokeStyle(9, 0xd7fbff, 0.94).setDepth(251).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35);
    const innerShell = this.scene.add.circle(target.x, target.y + 35, 55, 0xcaf7ff, 0.12).setStrokeStyle(3, 0xffffff, 0.86).setDepth(252).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35);
    this.scene.tweens.add({ targets: [shell, innerShell], scale: 1, duration: 280, ease: "Back.Out" });
    for (let index = 0; index < 14; index += 1) {
      const angle = Math.PI * 2 * index / 14;
      const spike = this.scene.add.triangle(target.x + Math.cos(angle) * 76, target.y + 35 + Math.sin(angle) * 76, 0, 34, 8, 0, 16, 34, index % 3 ? 0x8ee9ff : 0xe6fdff, 0.92).setDepth(253).setAngle(Phaser.Math.RadToDeg(angle) + 90).setScale(0.1).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: spike, scale: 1, duration: 260, delay: index * 18, ease: "Back.Out", onComplete: () => this.scene.tweens.add({ targets: spike, alpha: 0, scale: 1.4, duration: 520, delay: 520, onComplete: () => spike.destroy() }) });
    }
    this.scene.tweens.add({ targets: [shell, innerShell], alpha: 0, scale: 1.18, duration: 620, delay: 850, onComplete: () => { shell.destroy(); innerShell.destroy(); } });
    this.scene.tweens.add({ targets: frost, alpha: 0, duration: 650, delay: 1050, onComplete: () => frost.destroy() });
  }

  private burn(target: Phaser.Math.Vector2): void {
    this.flash(0xff3518, 0.38, 1650);
    const magmaOuter = this.scene.add.ellipse(target.x, target.y + 110, 286, 96, 0x290104, 0.9).setStrokeStyle(10, 0xff3518, 0.82).setDepth(242).setBlendMode(Phaser.BlendModes.ADD).setScale(0.25);
    const magmaCore = this.scene.add.ellipse(target.x, target.y + 110, 194, 58, 0xff5b20, 0.46).setStrokeStyle(5, 0xffdc76, 0.95).setDepth(243).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
    this.scene.tweens.add({ targets: [magmaOuter, magmaCore], scale: 1, duration: 250, ease: "Back.Out" });
    const cracks = this.scene.add.graphics().setDepth(245).lineStyle(9, 0x7a0804, 0.82);
    for (let ray = 0; ray < 12; ray += 1) {
      const angle = (Math.PI * 2 * ray) / 12;
      cracks.lineBetween(target.x, target.y + 75, target.x + Math.cos(angle) * Phaser.Math.Between(70, 180), target.y + 75 + Math.sin(angle) * Phaser.Math.Between(45, 110));
    }
    cracks.lineStyle(4, 0xff7a29, 1);
    for (let ray = 0; ray < 12; ray += 1) {
      const angle = (Math.PI * 2 * ray) / 12;
      cracks.lineBetween(target.x, target.y + 75, target.x + Math.cos(angle) * (65 + ray * 8), target.y + 75 + Math.sin(angle) * (45 + ray * 4));
    }
    for (let index = 0; index < 18; index += 1) {
      const flame = this.createFlame(target.x + Phaser.Math.Between(-105, 105), target.y + 112, 0.7 + (index % 5) * 0.16, index % 3 === 0);
      this.scene.tweens.add({ targets: flame, y: flame.y - Phaser.Math.Between(105, 235), x: flame.x + Phaser.Math.Between(-28, 28), scaleX: 0.45, scaleY: 1.35, alpha: 0, angle: Phaser.Math.Between(-14, 14), duration: Phaser.Math.Between(780, 1300), delay: index * 30, ease: "Cubic.Out", onComplete: () => flame.destroy(true) });
    }
    for (let index = 0; index < 28; index += 1) {
      const ember = this.scene.add.circle(target.x + Phaser.Math.Between(-120, 120), target.y + Phaser.Math.Between(30, 125), Phaser.Math.Between(2, 5), index % 4 ? 0xff6a24 : 0xffe096, 0.96).setDepth(260).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: ember, x: ember.x + Phaser.Math.Between(-55, 55), y: ember.y - Phaser.Math.Between(150, 310), alpha: 0, scale: 0.1, duration: Phaser.Math.Between(760, 1450), onComplete: () => ember.destroy() });
    }
    for (let index = 0; index < 7; index += 1) {
      const smoke = this.scene.add.circle(target.x + Phaser.Math.Between(-70, 70), target.y + 15, 22 + index * 3, 0x16070a, 0.34).setDepth(256).setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.scene.tweens.add({ targets: smoke, y: smoke.y - 160 - index * 18, x: smoke.x + Phaser.Math.Between(-50, 50), scale: 1.8, alpha: 0, duration: 1250 + index * 70, delay: index * 80, onComplete: () => smoke.destroy() });
    }
    this.scene.tweens.add({ targets: [magmaOuter, magmaCore], scaleX: 1.18, scaleY: 0.78, alpha: 0, duration: 700, delay: 900, ease: "Cubic.Out", onComplete: () => { magmaOuter.destroy(); magmaCore.destroy(); } });
    this.scene.tweens.add({ targets: cracks, alpha: 0, duration: 1200, delay: 500, onComplete: () => cracks.destroy() });
  }

  private whirlwind(target: Phaser.Math.Vector2): void {
    const centerX = virtualViewport(this.scene).width / 2;
    const centerY = target.y + 45;
    this.scene.tweens.add({ targets: this.scene.cameras.main, rotation: 0.015, duration: 120, yoyo: true, repeat: 5 });
    for (let ring = 0; ring < 8; ring += 1) {
      const ribbon = this.scene.add.ellipse(centerX, centerY + 100 - ring * 32, 140 + ring * 38, 34 + ring * 8, 0x07171a, 0.03).setStrokeStyle(5 - ring * 0.25, ring % 2 ? 0xe8fff9 : 0x65e8c8, 0.75).setDepth(255 + ring).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAngle(ring % 2 ? -8 : 8);
      this.scene.tweens.add({ targets: ribbon, scale: 1, angle: ring % 2 ? 355 : -355, alpha: 0, duration: 920 + ring * 70, delay: ring * 30, ease: "Cubic.Out", onComplete: () => ribbon.destroy() });
    }
    for (let index = 0; index < 34; index += 1) {
      const debris = index % 3 === 0
        ? this.scene.add.rectangle(centerX, centerY, Phaser.Math.Between(10, 24), Phaser.Math.Between(3, 7), 0x8b765c, 0.9).setDepth(264)
        : this.scene.add.circle(centerX, centerY, Phaser.Math.Between(2, 5), 0xc8fff0, 0.9).setDepth(264).setBlendMode(Phaser.BlendModes.ADD);
      const angle = index * 1.7;
      const radius = 55 + index * 4.8;
      debris.setPosition(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius * 0.34);
      this.scene.tweens.add({ targets: debris, angle: 900, x: centerX + Math.cos(angle + Math.PI * 1.6) * radius * 0.3, y: centerY - 250 + Math.sin(angle) * 55, alpha: 0, scale: 0.15, duration: 760 + index * 16, onComplete: () => debris.destroy() });
    }
  }

  private createFlame(x: number, y: number, scale: number, whiteHot: boolean): Phaser.GameObjects.Container {
    const root = this.scene.add.container(x, y).setDepth(258).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
    const outer = this.scene.add.graphics().fillStyle(0xff3517, 0.86).fillPoints([
      new Phaser.Geom.Point(0, -58), new Phaser.Geom.Point(-7, -35), new Phaser.Geom.Point(-18, -13), new Phaser.Geom.Point(-27, 12), new Phaser.Geom.Point(-24, 42), new Phaser.Geom.Point(24, 42), new Phaser.Geom.Point(29, 15), new Phaser.Geom.Point(20, -8), new Phaser.Geom.Point(8, -25)
    ], true);
    const inner = this.scene.add.graphics().fillStyle(whiteHot ? 0xffffff : 0xffd45f, 0.92).fillPoints([
      new Phaser.Geom.Point(3, -28), new Phaser.Geom.Point(-5, -6), new Phaser.Geom.Point(-14, 17), new Phaser.Geom.Point(-11, 39), new Phaser.Geom.Point(12, 39), new Phaser.Geom.Point(17, 19), new Phaser.Geom.Point(10, 1)
    ], true);
    root.add([outer, inner]);
    return root;
  }

  private drawSpell(target: Phaser.Math.Vector2, count: number, color: number): void {
    this.flash(color, 0.2, 900);
    const { width, height } = virtualViewport(this.scene);
    for (let index = 0; index < count; index += 1) {
      const card = this.scene.add.rectangle(width / 2 + (index - (count - 1) / 2) * 42, height * 0.45, 48, 72, 0x100623, 0.96)
        .setStrokeStyle(4, color, 1)
        .setDepth(270)
        .setAngle((index - (count - 1) / 2) * 18);
      this.scene.tweens.add({ targets: card, x: target.x + (index - (count - 1) / 2) * 34, y: target.y, angle: 360, scale: 0.55, alpha: 0, duration: 700 + index * 90, ease: "Cubic.In", onComplete: () => card.destroy() });
    }
  }

  private chaos(target: Phaser.Math.Vector2, stackAmount: number): void {
    this.flash(0xb30d16, 0.38, 1700);
    this.scene.cameras.main.shake(680, 0.012);
    const { width, height } = virtualViewport(this.scene);
    for (let index = 0; index < 4; index += 1) {
      const angle = (Math.PI * 2 * index) / 4 - Math.PI / 4;
      const seal = this.scene.add.circle(width / 2 + Math.cos(angle) * 250, height * 0.46 + Math.sin(angle) * 165, 58, 0x250007, 0.72)
        .setStrokeStyle(8, 0xff3c25, 1)
        .setDepth(265)
        .setScale(0.1);
      const label = this.scene.add.text(seal.x, seal.y, `+${Math.max(4, Math.ceil(stackAmount / 4) * 4)}`, { fontFamily: "Georgia", fontSize: "24px", fontStyle: "bold", color: "#fff0df", stroke: "#62040a", strokeThickness: 6 }).setOrigin(0.5).setDepth(266).setAlpha(0);
      this.scene.tweens.add({ targets: seal, scale: 1, angle: 360, duration: 420, delay: index * 150, ease: "Back.Out", onComplete: () => this.scene.tweens.add({ targets: seal, x: target.x, y: target.y, scale: 0.15, alpha: 0, duration: 620, delay: 260, onComplete: () => seal.destroy() }) });
      this.scene.tweens.add({ targets: label, alpha: 1, duration: 220, delay: index * 150 + 180, yoyo: true, hold: 450, onComplete: () => label.destroy() });
    }
  }

  private storm(target: Phaser.Math.Vector2): void {
    this.flash(0xffef87, 0.48, 1050);
    this.scene.cameras.main.shake(520, 0.011);
    for (let bolt = 0; bolt < 4; bolt += 1) {
      const graphics = this.scene.add.graphics().setDepth(270).setAlpha(0);
      const offset = (bolt - 1.5) * 34;
      graphics.lineStyle(18, 0x7d68ff, 0.38).beginPath().moveTo(target.x + offset - 70, -30).lineTo(target.x + offset + 18, target.y - 90).lineTo(target.x + offset - 25, target.y - 20).lineTo(target.x + offset + 4, target.y + 105).strokePath();
      graphics.lineStyle(6, 0xffffff, 1).strokePath();
      this.scene.tweens.add({ targets: graphics, alpha: { from: 0, to: 1 }, duration: 70, delay: bolt * 90, yoyo: true, hold: 70, onComplete: () => graphics.destroy() });
    }
  }

  private mirror(target: Phaser.Math.Vector2): void {
    this.flash(0xd8c6ff, 0.26, 1250);
    for (let index = 0; index < 20; index += 1) {
      const shard = this.scene.add.polygon(target.x, target.y, [0, -34, 17, -5, 8, 38, -14, 12], index % 2 ? 0xb99cff : 0xe9f7ff, 0.36).setStrokeStyle(2, 0xffffff, 0.8).setDepth(265).setBlendMode(Phaser.BlendModes.ADD);
      const angle = Math.PI * 2 * index / 20;
      this.scene.tweens.add({ targets: shard, x: target.x + Math.cos(angle) * Phaser.Math.Between(120, 390), y: target.y + Math.sin(angle) * Phaser.Math.Between(90, 240), angle: Phaser.Math.Between(-480, 480), alpha: 0, scale: 0.3, duration: 920 + index * 18, ease: "Cubic.Out", onComplete: () => shard.destroy() });
    }
  }

  private cleanse(target: Phaser.Math.Vector2): void {
    this.flash(0x9dffc1, 0.2, 1100);
    for (let ring = 0; ring < 5; ring += 1) {
      const halo = this.scene.add.circle(target.x, target.y + 40, 28, 0x9dffc1, 0).setStrokeStyle(8 - ring, ring % 2 ? 0xffffff : 0x76ffb4, 0.85).setDepth(262).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: halo, scale: 3.5 + ring * 0.55, y: halo.y - ring * 18, alpha: 0, duration: 850, delay: ring * 100, ease: "Cubic.Out", onComplete: () => halo.destroy() });
    }
  }

  private prismShift(): void {
    const { width, height } = virtualViewport(this.scene);
    const colors = [0xff4055, 0x49a8ff, 0x39de91, 0xffd650];
    colors.forEach((color, index) => {
      const band = this.scene.add.rectangle(width / 2, height / 2, width * 1.5, height * 0.18, color, 0).setDepth(260).setAngle(-18 + index * 12).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: band, fillAlpha: 0.24, x: width / 2 + (index - 1.5) * 90, yoyo: true, duration: 310, delay: index * 75, onComplete: () => band.destroy() });
    });
  }

  private rewind(target: Phaser.Math.Vector2): void {
    this.flash(0x5ff0b1, 0.18, 1050);
    for (let ring = 0; ring < 4; ring += 1) {
      const clock = this.scene.add.circle(target.x, target.y + 35, 48 + ring * 24, 0x071a1a, 0.12).setStrokeStyle(5, ring % 2 ? 0xffffff : 0x5ff0b1, 0.82).setDepth(263).setBlendMode(Phaser.BlendModes.ADD);
      clock.setScale(0.25).setAngle(120);
      this.scene.tweens.add({ targets: clock, scale: 1.2, angle: -360, alpha: 0, duration: 980, delay: ring * 85, ease: "Cubic.Out", onComplete: () => clock.destroy() });
    }
  }
}
