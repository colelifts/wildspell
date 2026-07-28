import Phaser from "phaser";

export type ChallengeType = "rune-memory" | "spell-timing" | "arcane-clash";

export interface ChallengeResult {
  type: ChallengeType;
  score: number;
  durationMs: number;
}

export class ChallengeDirector {
  private layer?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene) {}

  start(type: ChallengeType): Promise<ChallengeResult> {
    this.destroy();
    const startedAt = Date.now();
    const { width, height } = this.scene.scale;
    const portrait = height > width;
    const background = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x05091c, 0.92);
    const frame = this.scene.add.rectangle(width / 2, height / 2, Math.min(760, width - 40), portrait ? 620 : 470, 0x0d1b3d, 1).setStrokeStyle(5, 0xf6c85f);
    const title = this.scene.add.text(width / 2, portrait ? 280 : 150, "FINAL CARD CHALLENGE", {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: portrait ? "27px" : "34px", fontStyle: "bold", color: "#ffe17c", stroke: "#39135f", strokeThickness: 8
    }).setOrigin(0.5);
    this.layer = this.scene.add.container(0, 0, [background, frame, title]).setDepth(500);
    return new Promise((resolve) => {
      const finish = (score: number) => {
        const durationMs = Date.now() - startedAt;
        const banner = this.scene.add.text(width / 2, height / 2, `${score} ARCANE POINTS`, {
          fontFamily: '"Trebuchet MS", sans-serif', fontSize: "42px", fontStyle: "bold", color: "#9dffda", stroke: "#071126", strokeThickness: 10
        }).setOrigin(0.5).setDepth(520);
        this.scene.tweens.add({ targets: banner, scale: 1.18, yoyo: true, duration: 220 });
        this.scene.time.delayedCall(750, () => {
          banner.destroy();
          this.destroy();
          resolve({ type, score, durationMs });
        });
      };
      if (type === "rune-memory") this.runeMemory(finish);
      else if (type === "spell-timing") this.spellTiming(finish);
      else this.arcaneClash(finish);
    });
  }

  destroy(): void {
    this.layer?.destroy(true);
    this.layer = undefined;
  }

  private add(object: Phaser.GameObjects.GameObject): void {
    this.layer?.add(object);
  }

  private runeMemory(done: (score: number) => void): void {
    const { width, height } = this.scene.scale;
    const portrait = height > width;
    const runes = ["◆", "●", "▲", "✦"];
    const sequence = Array.from({ length: 5 }, (_, index) => runes[(this.scene.registry.get("seed") + index * 7) % runes.length]!);
    const instructions = this.scene.add.text(width / 2, portrait ? 380 : 210, "Memorize the five-rune spell…", { fontSize: portrait ? "19px" : "22px", color: "#dbe9ff" }).setOrigin(0.5);
    const display = this.scene.add.text(width / 2, portrait ? 500 : 320, sequence.join("   "), { fontSize: portrait ? "46px" : "58px", color: "#8deaff", stroke: "#2340a0", strokeThickness: 8 }).setOrigin(0.5);
    this.add(instructions); this.add(display);
    this.scene.time.delayedCall(2300, () => {
      display.setText("?   ?   ?   ?   ?").setColor("#536888");
      instructions.setText("Repeat it before the spell collapses!");
      const buttons = runes.map((rune, index) => {
        const button = this.scene.add.text(width / 2 - (portrait ? 165 : 180) + index * (portrait ? 110 : 120), portrait ? 640 : 455, rune, { fontSize: portrait ? "40px" : "48px", backgroundColor: "#182c59", color: "#ffffff", padding: { x: portrait ? 16 : 22, y: 14 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.add(button);
        return button;
      });
      const input: string[] = [];
      const began = Date.now();
      buttons.forEach((button, index) => button.on("pointerdown", () => {
        input.push(runes[index]!);
        button.setTint(0x7fffd4);
        this.scene.time.delayedCall(110, () => button.clearTint());
        if (input.length === sequence.length) {
          const correct = input.filter((rune, itemIndex) => rune === sequence[itemIndex]).length;
          const speed = Math.max(0, 500 - Math.floor((Date.now() - began) / 10));
          done(correct * 100 + speed);
        }
      }));
      this.scene.time.delayedCall(5200, () => {
        if (input.length < sequence.length) done(input.filter((rune, itemIndex) => rune === sequence[itemIndex]).length * 100);
      });
    });
  }

  private spellTiming(done: (score: number) => void): void {
    const { width, height } = this.scene.scale;
    const portrait = height > width;
    const trackWidth = portrait ? width - 90 : 560;
    const trackY = portrait ? 520 : 340;
    const instructions = this.scene.add.text(width / 2, portrait ? 375 : 210, "Stop the sigil inside the gold zone — three rounds", { fontSize: portrait ? "18px" : "22px", color: "#dbe9ff", wordWrap: { width: width - 80 }, align: "center" }).setOrigin(0.5);
    const track = this.scene.add.rectangle(width / 2, trackY, trackWidth, 28, 0x203762).setStrokeStyle(3, 0x88a8e8);
    const zone = this.scene.add.rectangle(width / 2, trackY, 92, 44, 0x74ed9d, 0.85).setStrokeStyle(3, 0xffe479);
    const marker = this.scene.add.triangle(width / 2 - trackWidth / 2 + 20, trackY, 0, 25, 16, 0, 32, 25, 0xffffff).setOrigin(0.5);
    const button = this.scene.add.text(width / 2, portrait ? 650 : 455, "LOCK SIGIL", { fontSize: "28px", fontStyle: "bold", backgroundColor: "#c4771f", color: "#fff5cf", padding: { x: 34, y: 16 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const roundText = this.scene.add.text(width / 2, portrait ? 445 : 270, "ROUND 1 / 3", { fontSize: "20px", color: "#ffe17c" }).setOrigin(0.5);
    [instructions, track, zone, marker, button, roundText].forEach((item) => this.add(item));
    let round = 1;
    let score = 0;
    let direction = 1;
    const update = (_time: number, delta: number) => {
      marker.x += direction * delta * (0.36 + round * 0.045);
      if (marker.x > width / 2 + trackWidth / 2 - 20 || marker.x < width / 2 - trackWidth / 2 + 20) direction *= -1;
    };
    this.scene.events.on("update", update);
    button.on("pointerdown", () => {
      const distance = Math.abs(marker.x - width / 2);
      score += Math.max(0, Math.round(330 - distance * 1.25));
      this.scene.cameras.main.flash(90, 255, 225, 110, false);
      if (round === 3) {
        this.scene.events.off("update", update);
        done(score);
      } else {
        round += 1;
        roundText.setText(`ROUND ${round} / 3`);
        marker.x = width / 2 - trackWidth / 2 + 20;
        direction = 1;
      }
    });
    this.scene.time.delayedCall(8500, () => {
      this.scene.events.off("update", update);
      if (this.layer) done(score);
    });
  }

  private arcaneClash(done: (score: number) => void): void {
    const { width, height } = this.scene.scale;
    const portrait = height > width;
    const directions = ["↑", "→", "↓", "←"];
    const keys = ["UP", "RIGHT", "DOWN", "LEFT"];
    const instructions = this.scene.add.text(width / 2, portrait ? 380 : 210, "Answer five directional runes — fast and accurate", { fontSize: portrait ? "18px" : "22px", color: "#dbe9ff", wordWrap: { width: width - 80 }, align: "center" }).setOrigin(0.5);
    const prompt = this.scene.add.text(width / 2, portrait ? 515 : 330, "✦", { fontSize: "92px", color: "#ffdf75", stroke: "#6c35b7", strokeThickness: 10 }).setOrigin(0.5);
    const progress = this.scene.add.text(width / 2, portrait ? 650 : 455, "READY", { fontSize: "22px", color: "#9dffda" }).setOrigin(0.5);
    const buttons = directions.map((direction, index) => this.scene.add.text(width / 2 - (portrait ? 165 : 165) + index * 110, portrait ? 720 : 515, direction, { fontSize: "34px", backgroundColor: "#182c59", color: "#ffffff", padding: { x: portrait ? 14 : 18, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    [instructions, prompt, progress, ...buttons].forEach((item) => this.add(item));
    let round = -1;
    let score = 0;
    let expected = 0;
    let shownAt = Date.now();
    const advance = () => {
      round += 1;
      if (round >= 5) { done(score); return; }
      expected = (this.scene.registry.get("seed") + round * 11) % 4;
      shownAt = Date.now();
      prompt.setText(directions[expected]!);
      progress.setText(`${round + 1} / 5`);
    };
    const answer = (index: number) => {
      if (round < 0 || round >= 5) return;
      if (index === expected) score += Math.max(80, 220 - Math.floor((Date.now() - shownAt) / 6));
      else score = Math.max(0, score - 40);
      this.scene.tweens.add({ targets: prompt, scale: 1.35, duration: 90, yoyo: true });
      advance();
    };
    buttons.forEach((button, index) => button.on("pointerdown", () => answer(index)));
    const keyboard = this.scene.input.keyboard;
    keys.forEach((key, index) => keyboard?.on(`keydown-${key}`, () => answer(index)));
    this.scene.time.delayedCall(900, advance);
    this.scene.time.delayedCall(7200, () => {
      keys.forEach((key, index) => keyboard?.off(`keydown-${key}`, () => answer(index)));
      if (this.layer) done(score);
    });
  }
}
