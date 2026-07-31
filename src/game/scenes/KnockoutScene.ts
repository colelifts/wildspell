import Phaser from "phaser";
import { gameBus, type StartMatchDetail } from "../events";
import { knockoutAiInput } from "../knockout/ai";
import { KNOCKOUT_CHARACTERS } from "../knockout/characters";
import { createKnockoutState, KNOCKOUT_WORLD, setKnockoutInput, stepKnockout } from "../knockout/simulation";
import type { KnockoutInput, KnockoutState } from "../knockout/types";
import { subscribeRoom, writeKnockoutInput, writeKnockoutSnapshot } from "../multiplayer/roomService";

const CHARACTER_IDS = ["kenpachi", "hisoka", "gojo", "mob", "hit", "ryuk", "maki"] as const;

export class KnockoutScene extends Phaser.Scene {
  private config!: StartMatchDetail;
  private state!: KnockoutState;
  private fighterSprites!: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private damageTexts!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private lifeTexts!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private abilityButton!: Phaser.GameObjects.Container;
  private abilityFill!: Phaser.GameObjects.Rectangle;
  private abilityText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private resultOverlay?: Phaser.GameObjects.Container;
  private keys!: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; jump: Phaser.Input.Keyboard.Key; attack: Phaser.Input.Keyboard.Key; dodge: Phaser.Input.Keyboard.Key; ability: Phaser.Input.Keyboard.Key };
  private abilityQueued = false;
  private localSlot: 0 | 1 = 0;
  private remoteInput?: KnockoutInput;
  private unsubscribeRoom?: () => void;
  private networkElapsed = 0;
  private lastSnapshotTick = -1;
  private lastAuthoritativeTick = -1;
  private touchMove: -1 | 0 | 1 = 0;
  private touchJump = false;
  private touchAttack = false;
  private touchDodge = false;
  private inputSequence = 0;
  private lastHitTick = -1;
  private accumulator = 0;
  private readonly fixedStep = 1000 / 60;

  constructor() {
    super("KnockoutScene");
  }

  init(data: StartMatchDetail): void {
    this.config = data;
    this.localSlot = data.online?.session.slot ?? 0;
    if (data.online?.room.knockout?.state) {
      this.state = data.online.room.knockout.state;
      return;
    }
    const player = data.characterId ?? "kenpachi";
    const opponent = data.opponentCharacterId ?? (player === "hisoka" ? "kenpachi" : "hisoka");
    this.state = createKnockoutState([player, opponent]);
  }

  preload(): void {
    this.load.image("knockout-arena", "/backgrounds/arena-premium.png");
    for (const id of CHARACTER_IDS) {
      const path = id === "kenpachi" ? "/characters/kenpachi/portrait.png" : `/characters/${id}/select-cutout.png`;
      this.load.image(`fighter-${id}`, path);
    }
  }

  create(): void {
    this.game.canvas.dataset.mode = "knockout";
    this.game.canvas.dataset.playerCharacter = this.state.fighters[this.localSlot].characterId;
    this.game.canvas.dataset.opponentCharacter = this.state.fighters[this.localSlot === 0 ? 1 : 0].characterId;
    if (this.config.online) {
      this.game.canvas.dataset.onlineRoom = this.config.online.session.code;
      this.game.canvas.dataset.onlineSlot = String(this.config.online.session.slot);
    }
    const width = this.scale.width;
    const height = this.scale.height;
    this.add.image(width / 2, height / 2, "knockout-arena").setDisplaySize(width, height).setTint(0x8294bd);
    this.add.rectangle(width / 2, height / 2, width, height, 0x050916, 0.28);
    this.add.ellipse(width / 2, height * 0.77, width * 0.72, height * 0.17, 0x091225, 0.96).setStrokeStyle(5, 0x7db7ff, 0.75);
    this.add.ellipse(width / 2, height * 0.755, width * 0.66, height * 0.11, 0x273d6a, 0.56).setStrokeStyle(2, 0xf7d775, 0.6);

    const playerTexture = `fighter-${this.state.fighters[0].characterId}`;
    const opponentTexture = `fighter-${this.state.fighters[1].characterId}`;
    this.fighterSprites = [
      this.add.image(0, 0, playerTexture).setOrigin(0.5, 1),
      this.add.image(0, 0, opponentTexture).setOrigin(0.5, 1).setFlipX(true)
    ];
    this.fighterSprites.forEach((sprite) => {
      const targetHeight = height * 0.5;
      sprite.setScale(targetHeight / Math.max(1, sprite.height)).setDepth(5);
    });

    this.createHud();
    this.createControls();
    if (this.config.online) void this.connectOnline();
    this.countdownText = this.add.text(width / 2, height * 0.29, "3", {
      fontFamily: "Impact, sans-serif", fontSize: `${Math.round(height * 0.16)}px`, color: "#fff7d0",
      stroke: "#1a0a21", strokeThickness: 12, align: "center"
    }).setOrigin(0.5).setDepth(20);
    this.cameras.main.fadeIn(360, 4, 6, 18);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      delete this.game.canvas.dataset.mode;
      delete this.game.canvas.dataset.onlineRoom;
      delete this.game.canvas.dataset.onlineSlot;
      delete this.game.canvas.dataset.onlineTick;
      delete this.game.canvas.dataset.playerCharacter;
      delete this.game.canvas.dataset.opponentCharacter;
      this.unsubscribeRoom?.();
    });
  }

  private createHud(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const makePanel = (slot: 0 | 1, x: number, align: "left" | "right") => {
      const fighter = this.state.fighters[slot];
      const info = KNOCKOUT_CHARACTERS[fighter.characterId];
      const panel = this.add.rectangle(x, height * 0.09, width * 0.39, height * 0.13, 0x05091a, 0.88)
        .setStrokeStyle(3, info.accent, 0.9).setDepth(12);
      const anchor = align === "left" ? x - width * 0.175 : x + width * 0.175;
      this.add.text(anchor, height * 0.045, info.name.toUpperCase(), {
        fontFamily: "Impact, sans-serif", fontSize: `${Math.round(height * 0.052)}px`, color: "#fff7e4",
        stroke: "#050714", strokeThickness: 6, align
      }).setOrigin(align === "left" ? 0 : 1, 0).setDepth(13);
      this.add.text(anchor, height * 0.098, info.title.toUpperCase(), {
        fontFamily: "Arial, sans-serif", fontStyle: "bold", fontSize: `${Math.round(height * 0.018)}px`, color: Phaser.Display.Color.IntegerToColor(info.accent).rgba, align
      }).setOrigin(align === "left" ? 0 : 1, 0).setDepth(13);
      const damage = this.add.text(align === "left" ? x + width * 0.115 : x - width * 0.115, height * 0.065, "0%", {
        fontFamily: "Impact, sans-serif", fontSize: `${Math.round(height * 0.064)}px`, color: "#ffffff", stroke: "#000000", strokeThickness: 7
      }).setOrigin(0.5).setDepth(13);
      const lives = this.add.text(align === "left" ? x + width * 0.13 : x - width * 0.13, height * 0.125, "◆ ◆ ◆", {
        fontFamily: "Arial", fontSize: `${Math.round(height * 0.02)}px`, color: "#ffd66d"
      }).setOrigin(0.5).setDepth(13);
      return { panel, damage, lives };
    };
    const left = makePanel(0, width * 0.22, "left");
    const right = makePanel(1, width * 0.78, "right");
    this.damageTexts = [left.damage, right.damage];
    this.lifeTexts = [left.lives, right.lives];
    this.add.text(width / 2, height * 0.055, "KNOCKOUT ARENA", {
      fontFamily: "Impact, sans-serif", fontSize: `${Math.round(height * 0.043)}px`, color: "#ffe7a0", stroke: "#36164c", strokeThickness: 6, letterSpacing: 3
    }).setOrigin(0.5).setDepth(13);
  }

  private createControls(): void {
    const keyboard = this.input.keyboard!;
    this.keys = keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.W, attack: Phaser.Input.Keyboard.KeyCodes.J,
      dodge: Phaser.Input.Keyboard.KeyCodes.K, ability: Phaser.Input.Keyboard.KeyCodes.L
    }) as typeof this.keys;

    const width = this.scale.width;
    const height = this.scale.height;
    const info = KNOCKOUT_CHARACTERS[this.state.fighters[this.localSlot].characterId];
    const background = this.add.rectangle(0, 0, width * 0.22, height * 0.09, 0x120b21, 0.95).setStrokeStyle(3, info.accent, 1);
    this.abilityFill = this.add.rectangle(-width * 0.105, height * 0.039, width * 0.21, height * 0.008, info.accent, 0.9).setOrigin(0, 0.5);
    this.abilityText = this.add.text(0, -height * 0.008, `${info.ability.toUpperCase()}  [L]`, {
      fontFamily: "Arial, sans-serif", fontStyle: "bold", fontSize: `${Math.round(height * 0.021)}px`, color: "#ffffff"
    }).setOrigin(0.5);
    const sub = this.add.text(0, height * 0.023, "SIGNATURE READY", {
      fontFamily: "Arial", fontSize: `${Math.round(height * 0.013)}px`, color: "#ffd66d"
    }).setOrigin(0.5);
    this.abilityButton = this.add.container(width * 0.5, height * 0.915, [background, this.abilityFill, this.abilityText, sub]).setDepth(30).setSize(width * 0.22, height * 0.09).setInteractive({ useHandCursor: true });
    this.abilityButton.on("pointerdown", () => { this.abilityQueued = true; });
    this.abilityButton.on("pointerover", () => background.setFillStyle(0x24143f, 1));
    this.abilityButton.on("pointerout", () => background.setFillStyle(0x120b21, 0.95));

    this.add.text(width * 0.03, height * 0.93, "A/D MOVE   W JUMP   J ATTACK   K DODGE", {
      fontFamily: "Arial", fontStyle: "bold", fontSize: `${Math.round(height * 0.017)}px`, color: "#dce8ff"
    }).setDepth(20);

    const makeTouchButton = (x: number, y: number, label: string, down: () => void, up: () => void) => {
      const disc = this.add.circle(x, y, height * 0.042, 0x071126, 0.78).setStrokeStyle(2, 0xe5cc75, 0.72).setDepth(31).setInteractive({ useHandCursor: true });
      this.add.text(x, y, label, { fontFamily: "Arial", fontStyle: "bold", fontSize: `${Math.round(height * 0.025)}px`, color: "#ffffff" }).setOrigin(0.5).setDepth(32);
      disc.on("pointerdown", down).on("pointerup", up).on("pointerout", up);
    };
    makeTouchButton(width * 0.08, height * 0.88, "◀", () => { this.touchMove = -1; }, () => { if (this.touchMove === -1) this.touchMove = 0; });
    makeTouchButton(width * 0.16, height * 0.88, "▶", () => { this.touchMove = 1; }, () => { if (this.touchMove === 1) this.touchMove = 0; });
    makeTouchButton(width * 0.78, height * 0.88, "JUMP", () => { this.touchJump = true; }, () => undefined);
    makeTouchButton(width * 0.86, height * 0.88, "HIT", () => { this.touchAttack = true; }, () => undefined);
    makeTouchButton(width * 0.94, height * 0.88, "DASH", () => { this.touchDodge = true; }, () => undefined);
  }

  update(_time: number, delta: number): void {
    if (this.state.phase === "round-over") return;
    this.accumulator += Math.min(delta, 50);
    const playerInput = this.readPlayerInput();
    this.state = setKnockoutInput(this.state, this.localSlot, playerInput);
    if (!this.config.online) this.state = setKnockoutInput(this.state, 1, knockoutAiInput(this.state, 1, ++this.inputSequence));
    else if (this.remoteInput) this.state = setKnockoutInput(this.state, this.localSlot === 0 ? 1 : 0, this.remoteInput);
    while (this.accumulator >= this.fixedStep) {
      this.state = stepKnockout(this.state, this.fixedStep);
      this.accumulator -= this.fixedStep;
    }
    if (this.config.online) {
      this.networkElapsed += delta;
      if (this.networkElapsed >= 50 || playerInput.jump || playerInput.attack || playerInput.dodge || playerInput.ability) {
        this.networkElapsed = 0;
        void writeKnockoutInput(this.config.online.session, playerInput).catch(() => undefined);
      }
      if (this.localSlot === 0 && this.state.tick % 6 === 0 && this.state.tick !== this.lastSnapshotTick) {
        this.lastSnapshotTick = this.state.tick;
        void writeKnockoutSnapshot(this.config.online.session, this.state).catch(() => undefined);
      }
    }
    this.renderState();
  }

  private readPlayerInput(): KnockoutInput {
    return {
      move: this.keys.left.isDown ? -1 : this.keys.right.isDown ? 1 : this.touchMove,
      jump: Phaser.Input.Keyboard.JustDown(this.keys.jump) || this.consumeTouch("jump"),
      attack: Phaser.Input.Keyboard.JustDown(this.keys.attack) || this.consumeTouch("attack"),
      dodge: Phaser.Input.Keyboard.JustDown(this.keys.dodge) || this.consumeTouch("dodge"),
      ability: Phaser.Input.Keyboard.JustDown(this.keys.ability) || this.consumeAbilityQueue(),
      sequence: ++this.inputSequence
    };
  }

  private consumeTouch(kind: "jump" | "attack" | "dodge"): boolean {
    const value = kind === "jump" ? this.touchJump : kind === "attack" ? this.touchAttack : this.touchDodge;
    if (kind === "jump") this.touchJump = false;
    else if (kind === "attack") this.touchAttack = false;
    else this.touchDodge = false;
    return value;
  }

  private async connectOnline(): Promise<void> {
    const online = this.config.online;
    if (!online) return;
    this.unsubscribeRoom = await subscribeRoom(online.session.code, (room) => {
      const knockout = room?.knockout;
      if (!knockout) return;
      const opponentSlot = this.localSlot === 0 ? 1 : 0;
      this.remoteInput = knockout.inputs?.[opponentSlot];
      if (this.localSlot === 1 && knockout.state && knockout.state.tick > this.lastAuthoritativeTick) {
        this.lastAuthoritativeTick = knockout.state.tick;
        this.state = knockout.state;
      }
    });
  }

  private consumeAbilityQueue(): boolean {
    const queued = this.abilityQueued;
    this.abilityQueued = false;
    return queued;
  }

  private renderState(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    if (this.config.online) this.game.canvas.dataset.onlineTick = String(this.state.tick);
    for (const slot of [0, 1] as const) {
      const fighter = this.state.fighters[slot];
      const sprite = this.fighterSprites[slot];
      sprite.setPosition(fighter.x / KNOCKOUT_WORLD.width * width, fighter.y / KNOCKOUT_WORLD.height * height);
      sprite.setFlipX(fighter.facing === (slot === 0 ? -1 : 1));
      sprite.setAlpha(fighter.invulnerableMs > 0 && Math.floor(fighter.invulnerableMs / 80) % 2 ? 0.45 : 1);
      sprite.setTint(fighter.hitstunMs > 0 ? 0xffc6c6 : fighter.markedMs > 0 ? 0xffd35a : 0xffffff);
      sprite.setAngle(Phaser.Math.Clamp(fighter.velocityX / 55, -8, 8));
      this.damageTexts[slot].setText(`${Math.round(fighter.damage)}%`).setColor(fighter.damage > 130 ? "#ff4d55" : fighter.damage > 70 ? "#ffbe55" : "#ffffff");
      this.lifeTexts[slot].setText(Array.from({ length: fighter.lives }, () => "◆").join(" "));
    }
    if (this.state.phase === "countdown") this.countdownText.setText(String(Math.max(1, Math.ceil(this.state.countdownMs / 1_000)))).setVisible(true);
    else if (this.state.phase === "playing") this.countdownText.setText("FIGHT!").setVisible(this.state.elapsedMs < 3_650);

    const player = this.state.fighters[this.localSlot];
    const info = KNOCKOUT_CHARACTERS[player.characterId];
    const ready = player.abilityCooldownMs <= 0;
    this.abilityFill.scaleX = ready ? 1 : 1 - player.abilityCooldownMs / info.abilityCooldownMs;
    this.abilityText.setText(ready ? `${info.ability.toUpperCase()}  [L]` : `${info.ability.toUpperCase()}  ${(player.abilityCooldownMs / 1000).toFixed(1)}s`);
    this.abilityButton.setAlpha(ready ? 1 : 0.68);

    if (this.state.lastHit && this.state.lastHit.tick !== this.lastHitTick) {
      this.lastHitTick = this.state.lastHit.tick;
      this.cameras.main.shake(this.state.lastHit.kind === "ability" ? 180 : 90, this.state.lastHit.kind === "ability" ? 0.012 : 0.005);
      const target = this.fighterSprites[this.state.lastHit.target];
      this.tweens.add({ targets: target, scaleX: target.scaleX * 1.1, scaleY: target.scaleY * 0.88, duration: 80, yoyo: true });
      this.showImpact(this.state.lastHit.target, this.state.lastHit.kind);
    }
    if (this.state.phase === "round-over" && !this.resultOverlay) this.showResult();
  }

  private showResult(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const won = this.state.winner === this.localSlot;
    const veil = this.add.rectangle(0, 0, width, height, 0x02040b, 0.78).setOrigin(0);
    const title = this.add.text(width / 2, height * 0.42, won ? "VICTORY" : "DEFEAT", {
      fontFamily: "Impact, sans-serif", fontSize: `${Math.round(height * 0.13)}px`, color: won ? "#ffe187" : "#ff6573", stroke: "#0a0610", strokeThickness: 12
    }).setOrigin(0.5);
    const detail = this.add.text(width / 2, height * 0.56, won ? "RIVAL KNOCKED OUT" : "YOU WERE KNOCKED OUT", {
      fontFamily: "Arial", fontStyle: "bold", fontSize: `${Math.round(height * 0.027)}px`, color: "#ffffff"
    }).setOrigin(0.5);
    const buttonBody = this.add.rectangle(width / 2, height * 0.69, width * 0.25, height * 0.085, won ? 0xd88916 : 0x253456, 1)
      .setStrokeStyle(3, 0xffe48b, 1).setInteractive({ useHandCursor: true });
    const buttonText = this.add.text(width / 2, height * 0.69, "RETURN TO TOURNAMENT", {
      fontFamily: "Arial", fontStyle: "bold", fontSize: `${Math.round(height * 0.021)}px`, color: "#ffffff"
    }).setOrigin(0.5);
    buttonBody.on("pointerdown", () => gameBus.dispatchEvent(new Event("exit-match")));
    this.resultOverlay = this.add.container(0, 0, [veil, title, detail, buttonBody, buttonText]).setDepth(100);
    gameBus.dispatchEvent(new CustomEvent("toast", { detail: won ? "Knockout victory." : "Knockout defeat." }));
  }

  private showImpact(targetSlot: 0 | 1, kind: "attack" | "ability"): void {
    const target = this.fighterSprites[targetSlot];
    const color = kind === "ability"
      ? KNOCKOUT_CHARACTERS[this.state.fighters[this.state.lastHit!.attacker].characterId].accent
      : 0xffe7a1;
    const ring = this.add.circle(target.x, target.y - target.displayHeight * 0.42, kind === "ability" ? 74 : 44, color, 0.16)
      .setStrokeStyle(kind === "ability" ? 9 : 5, color, 0.95).setDepth(18);
    const slash = this.add.rectangle(target.x, target.y - target.displayHeight * 0.42, kind === "ability" ? 210 : 130, 10, color, 0.92)
      .setAngle(this.state.lastHit!.attacker === 0 ? -24 : 24).setDepth(19);
    this.tweens.add({ targets: [ring, slash], alpha: 0, scaleX: 1.65, scaleY: 1.65, duration: kind === "ability" ? 360 : 210, ease: "Cubic.Out", onComplete: () => { ring.destroy(); slash.destroy(); } });
  }
}
