import Phaser from "phaser";
import { virtualViewport } from "../render/virtualViewport";

export type ChallengeType = "rune-memory" | "spell-timing" | "arcane-clash";

export interface ChallengeResult {
  type: ChallengeType;
  score: number;
  durationMs: number;
}

export class ChallengeDirector {
  private layer?: Phaser.GameObjects.Container;
  private cleanup: Array<() => void> = [];
  private resolved = false;

  constructor(private readonly scene: Phaser.Scene) {}

  start(type: ChallengeType): Promise<ChallengeResult> {
    this.destroy();
    this.resolved = false;
    const startedAt = Date.now();
    const { width, height } = virtualViewport(this.scene);
    const portrait = height > width;
    const background = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x02040e, 0.96);
    const colorWash = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x5427a5, 0.1).setBlendMode(Phaser.BlendModes.ADD);
    const portraitFrameHeight = Math.min(980, height - 50);
    const frame = this.scene.add.rectangle(width / 2, height / 2, Math.min(820, width - 30), portrait ? portraitFrameHeight : 500, 0x091631, 0.98).setStrokeStyle(5, 0xf4cb68);
    const innerFrame = this.scene.add.rectangle(width / 2, height / 2, Math.min(800, width - 50), portrait ? portraitFrameHeight - 20 : 480, 0x0b1d41, 0.35).setStrokeStyle(2, 0x8f6cff, 0.8);
    const header = this.scene.add.text(width / 2, portrait ? height * 0.16 : 92, "FINAL CARD", {
      fontFamily: "Georgia, serif", fontSize: portrait ? "43px" : "52px", fontStyle: "bold", color: "#fff0b3", stroke: "#3d155f", strokeThickness: 10
    }).setOrigin(0.5);
    const subtitle = this.scene.add.text(width / 2, portrait ? height * 0.21 : 145, this.challengeName(type), {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: portrait ? "18px" : "22px", fontStyle: "bold", color: "#9eeaff", letterSpacing: 3
    }).setOrigin(0.5);
    const leftSeal = this.scene.add.circle(portrait ? 58 : width / 2 - 360, portrait ? height * 0.18 : 120, 28, 0x713fc0, 0.2).setStrokeStyle(4, 0xc9a6ff, 0.9);
    const rightSeal = this.scene.add.circle(portrait ? width - 58 : width / 2 + 360, portrait ? height * 0.18 : 120, 28, 0x713fc0, 0.2).setStrokeStyle(4, 0xc9a6ff, 0.9);
    this.layer = this.scene.add.container(0, 0, [background, colorWash, frame, innerFrame, header, subtitle, leftSeal, rightSeal]).setDepth(500).setAlpha(0);
    this.scene.tweens.add({ targets: this.layer, alpha: 1, duration: 220 });
    this.scene.tweens.add({ targets: [leftSeal, rightSeal], angle: 360, scale: 1.15, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    return new Promise((resolve) => {
      const finish = (score: number) => {
        if (this.resolved) return;
        this.resolved = true;
        this.clearActivity();
        const bannerPlate = this.scene.add.rectangle(width / 2, height / 2, portrait ? width - 80 : 520, 120, 0x071126, 0.96).setStrokeStyle(4, 0x8dffd6).setDepth(525).setScale(0.7).setAlpha(0);
        const banner = this.scene.add.text(width / 2, height / 2, `${Math.max(0, Math.round(score))} ARCANE POINTS`, {
          fontFamily: '"Trebuchet MS", sans-serif', fontSize: portrait ? "31px" : "42px", fontStyle: "bold", color: "#adffe2", stroke: "#071126", strokeThickness: 10
        }).setOrigin(0.5).setDepth(526).setScale(0.7).setAlpha(0);
        this.scene.tweens.add({ targets: [bannerPlate, banner], alpha: 1, scale: 1, duration: 230, ease: "Back.Out" });
        const resultTimer = this.scene.time.delayedCall(820, () => {
          banner.destroy();
          bannerPlate.destroy();
          this.destroy();
          resolve({ type, score: Math.max(0, Math.round(score)), durationMs: Date.now() - startedAt });
        });
        this.cleanup.push(() => resultTimer.remove(false));
      };
      if (type === "rune-memory") this.runeMemory(finish);
      else if (type === "spell-timing") this.spellTiming(finish);
      else this.arcaneClash(finish);
    });
  }

  destroy(): void {
    this.clearActivity();
    this.layer?.destroy(true);
    this.layer = undefined;
  }

  private clearActivity(): void {
    for (const dispose of this.cleanup.splice(0)) dispose();
  }

  private add(object: Phaser.GameObjects.GameObject): void {
    this.layer?.add(object);
  }

  private schedule(delay: number, callback: () => void): void {
    const timer = this.scene.time.delayedCall(delay, callback);
    this.cleanup.push(() => timer.remove(false));
  }

  private challengeName(type: ChallengeType): string {
    if (type === "rune-memory") return "RUNE MEMORY";
    if (type === "spell-timing") return "SPELL TIMING";
    return "ARCANE CLASH";
  }

  private runeMemory(done: (score: number) => void): void {
    const { width, height } = virtualViewport(this.scene);
    const portrait = height > width;
    const runes = ["◆", "●", "▲", "✦"];
    const palette = [0xff6b8b, 0x69b8ff, 0x73e6a5, 0xffdc72];
    const seed = Number(this.scene.registry.get("seed")) || 1;
    const sequence = Array.from({ length: 5 }, (_, index) => (seed + index * 7 + Math.floor(index / 2)) % runes.length);
    const instructions = this.scene.add.text(width / 2, portrait ? height * 0.285 : 195, "Watch the spell sequence", { fontSize: portrait ? "21px" : "25px", fontStyle: "bold", color: "#e8f1ff" }).setOrigin(0.5);
    const spotlight = this.scene.add.circle(width / 2, portrait ? height * 0.42 : 300, portrait ? 76 : 88, 0x7f5cff, 0.14).setStrokeStyle(6, 0xb8a5ff, 0.9);
    const display = this.scene.add.text(width / 2, spotlight.y, "✦", { fontSize: portrait ? "72px" : "88px", color: "#ffffff", stroke: "#32185e", strokeThickness: 10 }).setOrigin(0.5).setAlpha(0.25);
    const progress = this.scene.add.text(width / 2, portrait ? height * 0.54 : 390, "○  ○  ○  ○  ○", { fontSize: portrait ? "25px" : "30px", color: "#8094ba" }).setOrigin(0.5);
    this.add(instructions); this.add(spotlight); this.add(display); this.add(progress);

    const buttonY = portrait ? height * 0.69 : 475;
    const gap = portrait ? 112 : 124;
    const buttons = runes.map((rune, index) => {
      const x = width / 2 + (index - 1.5) * gap;
      const plate = this.scene.add.rectangle(x, buttonY, portrait ? 86 : 96, portrait ? 82 : 72, 0x14284f, 0.95).setStrokeStyle(3, palette[index]!, 0.8).setAlpha(0.35);
      const label = this.scene.add.text(x, buttonY, rune, { fontSize: portrait ? "39px" : "43px", color: "#ffffff", stroke: "#091126", strokeThickness: 6 }).setOrigin(0.5).setAlpha(0.35);
      this.add(plate); this.add(label);
      return { plate, label, index };
    });

    let revealIndex = 0;
    let accepting = false;
    const revealNext = () => {
      if (revealIndex >= sequence.length) {
        display.setText("?").setColor("#9fb1d1").setAlpha(0.65);
        spotlight.setFillStyle(0x21345f, 0.22).setStrokeStyle(5, 0x6f8bc8, 0.75);
        instructions.setText("Repeat it — five inputs");
        accepting = true;
        buttons.forEach(({ plate, label, index }) => {
          plate.setAlpha(1).setInteractive({ useHandCursor: true });
          label.setAlpha(1);
          plate.on("pointerdown", () => answer(index));
        });
        const inputTimeout = this.scene.time.delayedCall(5200, () => done(score));
        this.cleanup.push(() => inputTimeout.remove(false));
        return;
      }
      const runeIndex = sequence[revealIndex]!;
      display.setText(runes[runeIndex]!).setColor(`#${palette[runeIndex]!.toString(16).padStart(6, "0")}`).setAlpha(1).setScale(0.55);
      spotlight.setFillStyle(palette[runeIndex]!, 0.24).setStrokeStyle(7, palette[runeIndex]!, 1);
      progress.setText(sequence.map((_item, index) => index === revealIndex ? "●" : "○").join("  "));
      this.scene.tweens.add({ targets: display, scale: 1.25, duration: 170, yoyo: true, ease: "Back.Out" });
      revealIndex += 1;
      this.schedule(620, () => {
        display.setAlpha(0.16);
        this.schedule(190, revealNext);
      });
    };

    const input: number[] = [];
    let score = 0;
    let inputStartedAt = 0;
    const answer = (index: number) => {
      if (!accepting || input.length >= sequence.length) return;
      if (!inputStartedAt) inputStartedAt = Date.now();
      const position = input.length;
      input.push(index);
      const correct = index === sequence[position];
      if (correct) score += 130;
      else score = Math.max(0, score - 35);
      const { plate, label } = buttons[index]!;
      plate.setFillStyle(correct ? 0x16764e : 0x8d243d, 1);
      label.setScale(1.25);
      this.scene.tweens.add({ targets: label, scale: 1, duration: 150, ease: "Back.Out" });
      display.setText(input.map((value) => runes[value]).join(" ")).setColor(correct ? "#aaffd7" : "#ff9aac").setAlpha(1).setFontSize(portrait ? 45 : 52);
      progress.setText(input.map((_value, itemIndex) => itemIndex < input.length ? "●" : "○").concat(Array(Math.max(0, 5 - input.length)).fill("○")).slice(0, 5).join("  "));
      if (input.length === sequence.length) {
        accepting = false;
        const speedBonus = Math.max(0, 420 - Math.floor((Date.now() - inputStartedAt) / 9));
        done(score + speedBonus);
      }
    };

    const keyboard = this.scene.input.keyboard;
    const keyHandler = (event: KeyboardEvent) => {
      const index = ["1", "2", "3", "4"].indexOf(event.key);
      if (index >= 0) answer(index);
    };
    keyboard?.on("keydown", keyHandler);
    this.cleanup.push(() => keyboard?.off("keydown", keyHandler));

    this.schedule(700, revealNext);
  }

  private spellTiming(done: (score: number) => void): void {
    const { width, height } = virtualViewport(this.scene);
    const portrait = height > width;
    const trackWidth = portrait ? width - 82 : 610;
    const trackY = portrait ? height * 0.45 : 325;
    const instructions = this.scene.add.text(width / 2, portrait ? height * 0.285 : 195, "Lock the sigil inside the moving gold zone", { fontSize: portrait ? "19px" : "23px", fontStyle: "bold", color: "#e5efff", wordWrap: { width: width - 70 }, align: "center" }).setOrigin(0.5);
    const trackShadow = this.scene.add.rectangle(width / 2, trackY + 6, trackWidth + 16, 50, 0x02050d, 0.8).setRounded(12);
    const track = this.scene.add.rectangle(width / 2, trackY, trackWidth, 30, 0x1d3563, 1).setStrokeStyle(3, 0x8eaae2).setRounded(9);
    const zone = this.scene.add.rectangle(width / 2, trackY, 96, 54, 0xf3c95e, 0.32).setStrokeStyle(5, 0xffeaa1, 1).setRounded(8);
    const marker = this.scene.add.triangle(width / 2 - trackWidth / 2 + 22, trackY, 0, 30, 18, 0, 36, 30, 0xbffcff).setOrigin(0.5).setStrokeStyle(3, 0xffffff);
    const button = this.scene.add.text(width / 2, portrait ? height * 0.69 : 450, "LOCK SIGIL", { fontSize: portrait ? "27px" : "30px", fontStyle: "bold", backgroundColor: "#b96c19", color: "#fff5cf", padding: { x: 40, y: 17 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const roundText = this.scene.add.text(width / 2, portrait ? height * 0.35 : 248, "ROUND 1 / 3", { fontSize: "21px", fontStyle: "bold", color: "#ffe17c" }).setOrigin(0.5);
    const feedback = this.scene.add.text(width / 2, portrait ? height * 0.57 : 390, "", { fontSize: "24px", fontStyle: "bold", color: "#9dffda" }).setOrigin(0.5);
    [instructions, trackShadow, track, zone, marker, button, roundText, feedback].forEach((item) => this.add(item));

    const seed = Number(this.scene.registry.get("seed")) || 1;
    let round = 1;
    let score = 0;
    let direction = 1;
    let locked = false;
    const placeZone = () => {
      const normalized = ((seed >>> (round * 2)) % 55) / 100 - 0.275;
      zone.x = width / 2 + normalized * trackWidth;
      marker.x = width / 2 - trackWidth / 2 + 22;
      direction = 1;
      locked = false;
      button.setAlpha(1).setInteractive({ useHandCursor: true });
    };
    placeZone();
    const update = (_time: number, delta: number) => {
      if (locked) return;
      marker.x += direction * delta * (0.4 + round * 0.065);
      const max = width / 2 + trackWidth / 2 - 22;
      const min = width / 2 - trackWidth / 2 + 22;
      if (marker.x >= max) { marker.x = max; direction = -1; }
      if (marker.x <= min) { marker.x = min; direction = 1; }
    };
    this.scene.events.on("update", update);
    this.cleanup.push(() => this.scene.events.off("update", update));
    const lockSigil = () => {
      if (locked) return;
      locked = true;
      button.disableInteractive().setAlpha(0.5);
      const distance = Math.abs(marker.x - zone.x);
      const points = Math.max(0, Math.round(340 - distance * 2.35));
      score += points;
      const perfect = distance < 13;
      feedback.setText(perfect ? `PERFECT  +${points}` : distance < 38 ? `GREAT  +${points}` : `HIT  +${points}`).setColor(perfect ? "#fff08a" : distance < 38 ? "#9dffda" : "#a8c8ff").setScale(0.7);
      zone.setFillStyle(perfect ? 0xffee73 : 0x67e7b1, 0.72);
      this.scene.tweens.add({ targets: feedback, scale: 1, duration: 160, ease: "Back.Out" });
      this.scene.cameras.main.flash(100, perfect ? 255 : 120, 235, perfect ? 115 : 200, false);
      this.schedule(520, () => {
        if (round === 3) done(score);
        else {
          round += 1;
          roundText.setText(`ROUND ${round} / 3`);
          feedback.setText("");
          zone.setFillStyle(0xf3c95e, 0.32);
          placeZone();
        }
      });
    };
    button.on("pointerdown", lockSigil);
    const keyboard = this.scene.input.keyboard;
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") lockSigil();
    };
    keyboard?.on("keydown", keyHandler);
    this.cleanup.push(() => keyboard?.off("keydown", keyHandler));
    this.schedule(8500, () => done(score));
  }

  private arcaneClash(done: (score: number) => void): void {
    const { width, height } = virtualViewport(this.scene);
    const portrait = height > width;
    const directions = ["↑", "→", "↓", "←"];
    const keys = ["UP", "RIGHT", "DOWN", "LEFT"];
    const colors = [0xff7c98, 0x78c7ff, 0x82e5a7, 0xffdd78];
    const instructions = this.scene.add.text(width / 2, portrait ? height * 0.285 : 195, "Answer five directional runes — speed and accuracy", { fontSize: portrait ? "18px" : "22px", fontStyle: "bold", color: "#e4efff", wordWrap: { width: width - 70 }, align: "center" }).setOrigin(0.5);
    const promptHalo = this.scene.add.circle(width / 2, portrait ? height * 0.42 : 305, portrait ? 78 : 90, 0x7b4eca, 0.18).setStrokeStyle(6, 0xc6a8ff, 0.9);
    const prompt = this.scene.add.text(width / 2, promptHalo.y, "✦", { fontSize: portrait ? "82px" : "98px", color: "#ffdf75", stroke: "#6c35b7", strokeThickness: 10 }).setOrigin(0.5);
    const progress = this.scene.add.text(width / 2, portrait ? height * 0.55 : 420, "GET READY", { fontSize: "22px", fontStyle: "bold", color: "#9dffda" }).setOrigin(0.5);
    const buttonY = portrait ? height * 0.69 : 480;
    const buttons = directions.map((direction, index) => {
      const x = width / 2 + (index - 1.5) * (portrait ? 112 : 122);
      const button = this.scene.add.text(x, buttonY, direction, { fontSize: portrait ? "39px" : "43px", backgroundColor: "#182c59", color: "#ffffff", padding: { x: portrait ? 18 : 23, y: 12 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      button.setStroke(`#${colors[index]!.toString(16).padStart(6, "0")}`, 3);
      return button;
    });
    [instructions, promptHalo, prompt, progress, ...buttons].forEach((item) => this.add(item));

    let round = -1;
    let score = 0;
    let expected = 0;
    let shownAt = Date.now();
    let accepting = false;
    const advance = () => {
      round += 1;
      if (round >= 5) { accepting = false; done(score); return; }
      expected = ((Number(this.scene.registry.get("seed")) || 1) + round * 11 + Math.floor(round / 2)) % 4;
      shownAt = Date.now();
      accepting = true;
      prompt.setText(directions[expected]!).setColor(`#${colors[expected]!.toString(16).padStart(6, "0")}`).setScale(0.45).setAlpha(1);
      promptHalo.setStrokeStyle(7, colors[expected]!, 1).setFillStyle(colors[expected]!, 0.18);
      progress.setText(`${round + 1} / 5`);
      this.scene.tweens.add({ targets: prompt, scale: 1, duration: 180, ease: "Back.Out" });
    };
    const answer = (index: number) => {
      if (!accepting || round < 0 || round >= 5) return;
      accepting = false;
      const correct = index === expected;
      const reaction = Date.now() - shownAt;
      if (correct) score += Math.max(90, 250 - Math.floor(reaction / 5));
      else score = Math.max(0, score - 45);
      prompt.setText(correct ? "PERFECT" : "MISS").setFontSize(correct ? 34 : 40).setColor(correct ? "#aaffd4" : "#ff91a5");
      this.scene.tweens.add({ targets: promptHalo, scale: 1.28, alpha: 0.08, duration: 170, yoyo: true });
      this.schedule(230, () => {
        prompt.setFontSize(portrait ? 82 : 98);
        advance();
      });
    };
    buttons.forEach((button, index) => button.on("pointerdown", () => answer(index)));
    const keyboard = this.scene.input.keyboard;
    const handlers = keys.map((_key, index) => () => answer(index));
    keys.forEach((key, index) => keyboard?.on(`keydown-${key}`, handlers[index]!));
    this.cleanup.push(() => keys.forEach((key, index) => keyboard?.off(`keydown-${key}`, handlers[index]!)));
    this.schedule(750, advance);
    this.schedule(7200, () => done(score));
  }
}
