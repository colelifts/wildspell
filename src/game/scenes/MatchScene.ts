import Phaser from "phaser";
import { CARD_BACK_KEY, createPremiumCardAnimations, preloadPremiumCards, premiumCardTexture } from "../animation/CardVisuals";
import { PremiumGabbyDirector, preloadPremiumGabby, type PremiumGabbyPose } from "../animation/PremiumGabbyDirector";
import { PremiumPlayerDirector, preloadPremiumPlayer, type PremiumPlayerPose } from "../animation/PremiumPlayerDirector";
import { ReactiveArena } from "../animation/ReactiveArena";
import { SpellCinematics } from "../animation/SpellCinematics";
import { ChallengeDirector, type ChallengeType } from "../challenges/ChallengeDirector";
import { audioManager } from "../audio/AudioManager";
import { gameBus, emitGameEvents, emitGameState, requestColor, type StartMatchDetail } from "../events";
import { chooseAiCard, chooseAiColor } from "../rules/ai";
import { CARD_GLYPHS, CARD_NAMES } from "../rules/cards";
import { illegalReason, isLegalCard, legalCards } from "../rules/legalMoves";
import { createGame, reduceGame, resolveChallenge } from "../rules/reducer";
import type { Card, CardColor, CardKind, GameEvent, GameState } from "../rules/types";
import { guidanceFor } from "../ui/GuidanceDirector";

const CARD_COLORS: Record<CardColor, number> = {
  red: 0xe84855,
  blue: 0x2d8df2,
  green: 0x28b875,
  yellow: 0xf1b935,
  wild: 0x7a48da
};

const SPELL_COLORS: Partial<Record<CardKind, number>> = {
  arsonist: 0xff6a35,
  freeze: 0x7fe9ff,
  frostbite: 0xb9f7ff,
  stormcall: 0xffea70,
  whirlwind: 0x78efc5,
  mirror: 0xd8c6ff,
  cleanse: 0xa4ffc0,
  wild4: 0xcf83ff,
  draw2: 0xffda67
};

interface CardView {
  card: Card;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
}

export class MatchScene extends Phaser.Scene {
  private state!: GameState;
  private cinematics!: SpellCinematics;
  private arena!: ReactiveArena;
  private playerDirector!: PremiumPlayerDirector;
  private opponentDirector!: PremiumGabbyDirector;
  private challenges!: ChallengeDirector;
  private playerSprite!: Phaser.GameObjects.Image;
  private opponentSprite!: Phaser.GameObjects.Image;
  private cardInspection?: Phaser.GameObjects.Container;
  private inspectedCardId?: string;
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private busy = false;
  private finalChallengeRunning = false;
  private startDetail!: StartMatchDetail;
  private portrait = false;
  private listeners: Array<[string, EventListener]> = [];
  private forcedResolutionTimer?: Phaser.Time.TimerEvent;

  constructor() { super("MatchScene"); }

  init(data: StartMatchDetail): void {
    this.startDetail = data;
    this.state = createGame([data.playerName, "Gabby"], data.ruleset, data.difficulty, Date.now() >>> 0);
    this.registry.set("seed", this.state.rngSeed);
  }

  preload(): void {
    this.load.image("arena-premium", "/backgrounds/arena-premium.png");
    preloadPremiumCards(this);
    preloadPremiumPlayer(this);
    preloadPremiumGabby(this);
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.portrait = this.scale.height > this.scale.width;
    const width = this.scale.width;
    const height = this.scale.height;
    this.cameras.main.setViewport(0, 0, width, height).setZoom(this.portrait ? 1 : 0.64).centerOn(width / 2, this.portrait ? height / 2 : 360);
    this.cameras.main.setBackgroundColor(0x07112c);
    this.arena = new ReactiveArena(this, this.portrait);
    this.arena.create("arena-premium");
    this.add.rectangle(width / 2, height - 50, width, 100, 0x061020, 0.62).setDepth(5);
    this.add.rectangle(width / 2, this.portrait ? 74 : 38, width, this.portrait ? 148 : 76, 0x061020, 0.72).setDepth(5);

    createPremiumCardAnimations(this);
    this.playerDirector = new PremiumPlayerDirector(this);
    this.playerSprite = this.playerDirector.create(this.portrait ? 102 : 118, this.portrait ? 650 : 425, this.portrait ? 390 : 455);
    this.opponentDirector = new PremiumGabbyDirector(this);
    this.opponentSprite = this.opponentDirector.create(this.portrait ? 475 : 902, this.portrait ? 650 : 425, this.portrait ? 375 : 440);
    this.cinematics = new SpellCinematics(this);
    this.challenges = new ChallengeDirector(this);
    this.bindControls();
    this.renderState(true);
    if (this.startDetail.challengePreview) {
      this.busy = true;
      this.time.delayedCall(850, () => {
        const previewType = this.startDetail.challengePreview!;
        this.game.canvas.dataset.challengeState = `active:${previewType}`;
        void this.challenges.start(previewType)
          .then((result) => {
            this.game.canvas.dataset.challengeState = `complete:${result.type}:${result.score}`;
          })
          .finally(() => {
            this.busy = false;
            this.renderState();
          });
      });
    }
    void audioManager.playMusic("battle");
  }

  shutdown(): void {
    this.forcedResolutionTimer?.remove(false);
    for (const [name, listener] of this.listeners) gameBus.removeEventListener(name, listener);
    this.listeners = [];
  }

  private bindControls(): void {
    const on = (name: string, callback: () => void) => {
      const listener = callback as EventListener;
      gameBus.addEventListener(name, listener);
      this.listeners.push([name, listener]);
    };
    on("draw", () => this.commit({ type: "draw", player: 0 }));
    on("call-final", () => this.commit({ type: "call-final", player: 0 }));
    on("emote", () => this.playCharacter(0, "emote"));
  }

  private renderState(initial = false): void {
    this.cardInspection?.destroy(true);
    this.cardInspection = undefined;
    this.inspectedCardId = undefined;
    for (const object of this.dynamicObjects) object.destroy();
    this.dynamicObjects = [];
    const top = this.state.discard.at(-1)!;
    this.addHud();
    this.addNameplate(this.portrait ? 105 : -170, this.portrait ? 105 : 50, this.state.names[0], this.state.hands[0].length, this.state.statuses[0], false);
    this.addNameplate(this.portrait ? 471 : 1194, this.portrait ? 105 : 50, this.state.names[1], this.state.hands[1].length, this.state.statuses[1], true);
    this.addEnemyHand();
    this.addDrawPile();
    this.addCard(top, this.portrait ? 345 : 512, this.portrait ? 420 : 305, false, false, 0, this.portrait ? 1.08 : 1.06);
    this.addPlayerHand(initial);
    this.addStatusAuras();
    this.arena.sync(this.state);
    this.playerDirector.setPersistentPose(this.state.statuses[0].burn ? "burn" : "turn-ready");
    this.opponentDirector.setPersistentPose(this.state.statuses[1].burn ? "burn" : "turn-ready");
    emitGameState(this.state);
    if (this.state.phase === "challenge" && !this.finalChallengeRunning) void this.runChallenge();
    else if (this.state.phase === "playing" && !this.busy) {
      const active = this.state.turn;
      const mustDraw = !this.state.drawnCardId && legalCards(this.state, active).length === 0;
      if (mustDraw) {
        this.forcedResolutionTimer?.remove(false);
        this.forcedResolutionTimer = this.time.delayedCall(520, () => {
          this.forcedResolutionTimer = undefined;
          if (this.state.phase === "playing" && !this.busy && !this.state.drawnCardId && legalCards(this.state, this.state.turn).length === 0) {
            this.commit({ type: "draw", player: this.state.turn });
          }
        });
      } else if (active === 1) this.time.delayedCall(900, () => void this.runAi());
    }
  }

  private addHud(): void {
    const colorName = this.state.currentColor.toUpperCase();
    const turn = this.state.turn === 0 ? "YOUR TURN" : "RIVAL THINKING";
    const guide = guidanceFor(this.state, 0);
    const hud = this.add.text(this.scale.width / 2, this.portrait ? 22 : 19, `${turn}   •   ${colorName} MAGIC   •   ROUND ${this.state.turnNumber}`, {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "15px" : "17px", fontStyle: "bold", color: "#fff2bd", stroke: "#081127", strokeThickness: 5
    }).setOrigin(0.5).setDepth(30);
    const guideY = this.portrait ? 175 : 94;
    const guidePlate = this.add.rectangle(this.scale.width / 2, guideY, this.portrait ? 520 : 640, this.portrait ? 52 : 42, 0x050b1d, 0.94).setStrokeStyle(2, 0xe4bd62, 1).setDepth(29);
    const guideText = this.add.text(this.scale.width / 2, guideY, guide, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "12px" : "15px", fontStyle: "bold", color: "#f5f8ff", align: "center", wordWrap: { width: this.portrait ? 490 : 610 } }).setOrigin(0.5).setDepth(30);
    const stack = this.add.text(this.scale.width / 2, this.portrait ? 220 : 132, this.state.drawStack.amount ? `ARCANE STACK  +${this.state.drawStack.amount}` : "", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "18px" : "24px", fontStyle: "bold", color: "#ffe472", stroke: "#6c2f9f", strokeThickness: 7 }).setOrigin(0.5).setDepth(30);
    this.dynamicObjects.push(hud, guidePlate, guideText, stack);
    if (this.state.drawStack.amount) this.tweens.add({ targets: stack, scale: 1.08, alpha: 0.72, duration: 430, yoyo: true, repeat: -1 });
  }

  private addNameplate(x: number, y: number, name: string, count: number, status: GameState["statuses"][number], alignRight: boolean): void {
    const plate = this.add.rectangle(x, y, 210, 58, 0x08142c, 0.92).setStrokeStyle(3, alignRight ? 0xbe6cff : 0x55dcff).setDepth(24);
    const anchor = alignRight ? x + 88 : x - 88;
    const origin = alignRight ? 1 : 0;
    const label = this.add.text(anchor, y - 17, name, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "15px", fontStyle: "bold", color: "#ffffff" }).setOrigin(origin, 0).setDepth(25);
    const detail = this.add.text(anchor, y + 3, `${count} CARDS  •  ${status.burn ? `BURN ${status.burn}` : status.stormcall ? "STORMBOUND" : status.frozenCardIds.length ? "FROST-LOCKED" : "READY"}`, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "10px", color: status.burn ? "#ff9a6f" : "#aee9ff" }).setOrigin(origin, 0).setDepth(25);
    this.dynamicObjects.push(plate, label, detail);
  }

  private addEnemyHand(): void {
    const count = this.state.hands[1].length;
    const spacing = Math.min(this.portrait ? 32 : 35, (this.portrait ? 310 : 312) / Math.max(1, count - 1));
    for (let index = 0; index < count; index += 1) {
      const x = this.scale.width / 2 + (index - (count - 1) / 2) * spacing;
      const card = this.addCard(this.state.hands[1][index]!, x, (this.portrait ? 260 : 168) + Math.abs(index - (count - 1) / 2) * 1.6, true, false, (index - (count - 1) / 2) * 1.8, this.portrait ? 0.62 : 0.58);
      card.container.setDepth(11 + index);
    }
  }

  private addDrawPile(): void {
    const fake: Card = { id: "deck", color: "wild", kind: "prism" };
    const deckX = this.portrait ? 225 : 415;
    const deckY = this.portrait ? 420 : 305;
    const view = this.addCard(fake, deckX, deckY, true, false, -4, this.portrait ? 1.04 : 1.02);
    view.container.setInteractive(new Phaser.Geom.Rectangle(-55, -80, 110, 160), Phaser.Geom.Rectangle.Contains).on("pointerdown", () => this.commit({ type: "draw", player: 0 }));
    const deckLabel = this.add.text(deckX, this.portrait ? 515 : 410, `${this.state.drawPile.length} IN DECK`, { fontSize: "12px", fontStyle: "bold", color: "#d6e6ff", stroke: "#061027", strokeThickness: 4 }).setOrigin(0.5).setDepth(30);
    this.dynamicObjects.push(deckLabel);
    if (this.state.turn === 0 && !legalCards(this.state, 0).length) this.tweens.add({ targets: view.container, scale: 1.12, duration: 550, yoyo: true, repeat: -1 });
  }

  private addPlayerHand(initial: boolean): void {
    const hand = this.state.hands[0];
    const spacing = Math.min(this.portrait ? 70 : 94, (this.portrait ? 485 : 760) / Math.max(1, hand.length - 1));
    hand.forEach((card, index) => {
      const offset = index - (hand.length - 1) / 2;
      const x = this.scale.width / 2 + offset * spacing;
      const y = (this.portrait ? 700 : 480) + Math.abs(offset) * 2.4;
      const angle = offset * 2.2;
      const cardScale = this.portrait ? 0.9 : 0.98;
      const playable = isLegalCard(this.state, card, 0);
      const view = this.addCard(card, x, initial ? (this.portrait ? 860 : 580) : y, false, playable, angle, cardScale);
      view.container.setDepth(80 + index);
      if (initial) this.tweens.add({ targets: view.container, y, duration: 480, delay: index * 65, ease: "Back.Out" });
      view.container.setInteractive(new Phaser.Geom.Rectangle(-55, -80, 110, 160), Phaser.Geom.Rectangle.Contains);
      view.container.on("pointerover", () => {
        this.tweens.add({ targets: view.container, y: y - 34, scale: cardScale * 1.14, angle: 0, duration: 150, ease: "Back.Out" });
        this.showCardInspection(card);
        audioManager.playSfx("hover");
      });
      view.container.on("pointerout", () => {
        this.tweens.add({ targets: view.container, y, scale: cardScale, angle, duration: 150 });
        if (!this.portrait || this.inspectedCardId !== card.id) {
          this.cardInspection?.destroy(true);
          this.cardInspection = undefined;
        }
      });
      view.container.on("pointerdown", () => {
        if (this.portrait && premiumCardTexture(card.kind) && this.inspectedCardId !== card.id) {
          this.inspectedCardId = card.id;
          this.showCardInspection(card);
          this.tweens.add({ targets: view.container, y: y - 34, scale: cardScale * 1.14, angle: 0, duration: 150, ease: "Back.Out" });
          return;
        }
        this.onCardSelected(view);
      });
    });
  }

  private addCard(card: Card, x: number, y: number, back: boolean, playable: boolean, angle: number, scale: number): CardView {
    const container = this.add.container(x, y).setAngle(angle).setScale(scale);
    const shadow = this.add.rectangle(7, 10, 112, 164, 0x01030a, 0.74).setRounded(12);
    const frame = this.add.rectangle(0, 0, 110, 164, 0xffffff, 0.001).setRounded(12);
    container.add(shadow);
    if (back) {
      const face = this.add.image(0, 0, CARD_BACK_KEY).setDisplaySize(110, 165);
      const sheen = this.add.rectangle(-26, -6, 18, 145, 0xffffff, 0.08).setAngle(24).setBlendMode(Phaser.BlendModes.ADD);
      container.add([face, sheen]);
      this.tweens.add({ targets: sheen, x: 36, alpha: { from: 0.02, to: 0.14 }, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    } else {
      const premium = premiumCardTexture(card.kind);
      if (premium) {
        const face = this.add.sprite(0, 0, premium.texture, premium.animation ? Phaser.Math.Between(0, 47) : 0).setDisplaySize(110, 165);
        if (premium.animation) face.play({ key: premium.animation, startFrame: Phaser.Math.Between(0, 47) });
        container.add(face);
      } else if (card.kind === "number") {
        this.addNumberCardFace(container, card);
      } else {
        this.addFallbackSpecialFace(container, card);
      }
      if (this.state?.statuses[0].burnedCardIds.includes(card.id)) {
        const burn = this.add.text(33, -58, "♨", { fontSize: "27px", color: "#ff9d54", stroke: "#641006", strokeThickness: 5 }).setOrigin(0.5);
        container.add(burn);
        this.tweens.add({ targets: burn, y: -65, alpha: 0.55, duration: 360, yoyo: true, repeat: -1 });
      }
      if (this.state?.statuses[0].frozenCardIds.includes(card.id)) {
        const frostWash = this.add.rectangle(0, 0, 106, 159, 0x65d7ff, 0.33).setRounded(10).setBlendMode(Phaser.BlendModes.SCREEN);
        const frost = this.add.text(0, 0, "❄", { fontSize: "62px", color: "#e4fdff", stroke: "#26618d", strokeThickness: 6 }).setOrigin(0.5).setAlpha(0.86);
        container.add([frostWash, frost]);
      }
    }
    container.add(frame);
    if (playable) {
      const glow = this.add.rectangle(0, 0, 114, 169, 0xffe580, 0.04).setRounded(13).setStrokeStyle(4, 0xffec85, 0.96).setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
      this.tweens.add({ targets: glow, alpha: { from: 0.16, to: 0.58 }, scale: { from: 1, to: 1.035 }, duration: 680, yoyo: true, repeat: -1 });
    }
    this.dynamicObjects.push(container);
    return { card, container, frame };
  }

  private addNumberCardFace(container: Phaser.GameObjects.Container, card: Card): void {
    const color = CARD_COLORS[card.color];
    const outer = this.add.rectangle(0, 0, 110, 164, 0x090b16, 1).setRounded(12).setStrokeStyle(2, 0xd7c18b, 0.9);
    const panel = this.add.rectangle(0, 0, 96, 150, color, 0.96).setRounded(10).setStrokeStyle(2, 0xffffff, 0.4);
    const inner = this.add.circle(0, 0, 45, 0x050816, 0.2).setStrokeStyle(2, 0xffffff, 0.25);
    const ring = this.add.circle(0, 0, 34, 0xffffff, 0.04).setStrokeStyle(2, 0xffe5aa, 0.52);
    const value = String(card.value);
    const center = this.add.text(0, -1, value, {
      fontFamily: "Georgia, serif", fontSize: "68px", fontStyle: "bold", color: "#fffaf0", stroke: "#11131d", strokeThickness: 8
    }).setOrigin(0.5);
    const cornerStyle = { fontFamily: "Georgia, serif", fontSize: "19px", fontStyle: "bold", color: "#fffaf0", stroke: "#17131b", strokeThickness: 4 };
    const top = this.add.text(-44, -72, value, cornerStyle).setOrigin(0, 0);
    const bottom = this.add.text(44, 72, value, cornerStyle).setOrigin(0, 0).setAngle(180);
    const gloss = this.add.polygon(-9, -12, [-40, -70, -7, -70, 34, 54, 11, 72], 0xffffff, 0.07);
    container.add([outer, panel, inner, ring, gloss, center, top, bottom]);
  }

  private addFallbackSpecialFace(container: Phaser.GameObjects.Container, card: Card): void {
    const color = SPELL_COLORS[card.kind] ?? CARD_COLORS[card.color];
    const symbol = CARD_GLYPHS[card.kind];
    const outer = this.add.rectangle(0, 0, 110, 164, 0x080812, 1).setRounded(12).setStrokeStyle(3, color, 0.9);
    const panel = this.add.rectangle(0, 0, 98, 152, color, 0.18).setRounded(10);
    const aura = this.add.circle(0, -18, 38, color, 0.22).setBlendMode(Phaser.BlendModes.ADD);
    const icon = this.add.text(0, -18, symbol, { fontFamily: "Georgia, serif", fontSize: "45px", fontStyle: "bold", color: "#ffffff", stroke: "#090b15", strokeThickness: 7 }).setOrigin(0.5);
    const title = this.add.text(0, 54, CARD_NAMES[card.kind].toUpperCase(), { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "10px", fontStyle: "bold", color: "#fff4cf", align: "center", wordWrap: { width: 86 } }).setOrigin(0.5);
    container.add([outer, panel, aura, icon, title]);
    this.tweens.add({ targets: aura, scale: 1.25, alpha: 0.05, duration: 620, yoyo: true, repeat: -1 });
  }

  private addStatusAuras(): void {
    const addAura = (x: number, y: number, color: number, text: string) => {
      const ring = this.add.circle(x, y, 85, color, 0.13).setStrokeStyle(5, color, 0.58).setDepth(16);
      const label = this.add.text(x, y - 125, text, { fontSize: "15px", fontStyle: "bold", color: `#${color.toString(16).padStart(6, "0")}`, stroke: "#071126", strokeThickness: 5 }).setOrigin(0.5).setDepth(26);
      this.tweens.add({ targets: ring, scale: 1.16, alpha: 0.03, duration: 700, yoyo: true, repeat: -1 });
      this.dynamicObjects.push(ring, label);
    };
    const player = this.state.statuses[0];
    const opponent = this.state.statuses[1];
    if (player.burn) addAura(this.portrait ? 95 : 125, this.portrait ? 570 : 365, 0xff643b, `BURN ${player.burn}`);
    if (player.stormcall) addAura(this.portrait ? 95 : 125, this.portrait ? 570 : 365, 0xffec6f, "STORMBOUND");
    if (opponent.burn) addAura(this.portrait ? 481 : 850, this.portrait ? 540 : 345, 0xff643b, `BURN ${opponent.burn}`);
    if (opponent.stormcall) addAura(this.portrait ? 481 : 850, this.portrait ? 540 : 345, 0xffec6f, "STORMBOUND");
  }

  private onCardSelected(view: CardView): void {
    if (this.busy) return;
    const reason = illegalReason(this.state, view.card, 0);
    if (reason) {
      audioManager.playSfx("invalid");
      gameBus.dispatchEvent(new CustomEvent("toast", { detail: reason }));
      this.tweens.add({ targets: view.container, x: view.container.x + 10, duration: 45, yoyo: true, repeat: 4 });
      return;
    }
    if (view.card.color === "wild" || view.card.kind === "cleanse") {
      requestColor((color) => this.playCard(view.card, color));
    } else this.playCard(view.card);
  }

  private playCard(card: Card, colorChoice?: Exclude<CardColor, "wild">): void {
    const start = new Phaser.Math.Vector2(this.playerSprite.x, this.playerSprite.y - 120);
    const target = new Phaser.Math.Vector2(this.opponentSprite.x, this.opponentSprite.y - 120);
    this.commit({ type: "play", player: 0, cardId: card.id, ...(colorChoice ? { colorChoice } : {}) }, start, target);
  }

  private commit(command: Parameters<typeof reduceGame>[1], from = new Phaser.Math.Vector2(430, 285), to = new Phaser.Math.Vector2(590, 240)): void {
    if (this.busy && command.type !== "call-final") return;
    const result = reduceGame(this.state, command);
    this.state = result.state;
    emitGameEvents(this.state.events);
    if (!result.accepted) {
      audioManager.playSfx("invalid");
      gameBus.dispatchEvent(new CustomEvent("toast", { detail: result.reason }));
      return;
    }
    const spell = this.state.events.find((event): event is Extract<GameEvent, { type: "spell" }> => event.type === "spell");
    const played = this.state.events.find((event): event is Extract<GameEvent, { type: "card-played" }> => event.type === "card-played");
    const finalCard = this.state.events.find((event): event is Extract<GameEvent, { type: "final-card" }> => event.type === "final-card");
    const roundWon = this.state.events.find((event): event is Extract<GameEvent, { type: "round-won" }> => event.type === "round-won");
    if (played) {
      audioManager.playSfx("play");
      this.playCharacter(command.player, spell ? "spellcast" : "slash");
    }
    if (finalCard?.success) {
      if (finalCard.actor === 0) this.playerDirector.play("final-card", 1350);
      else this.opponentDirector.play("final-card", 1350);
    }
    if (roundWon) {
      this.playerDirector.play(roundWon.actor === 0 ? "victory" : "defeat");
      this.opponentDirector.play(roundWon.actor === 1 ? "victory" : "defeat");
    }
    this.renderState();
    if (spell) {
      this.busy = true;
      this.arena.react(spell.spell, to, this.state.drawStack.amount);
      if (spell.target === 0) this.playPlayerReaction(spell.spell);
      audioManager.duck(1200);
      audioManager.playSfx(spell.spell === "arsonist" ? "fire" : spell.spell === "whirlwind" ? "wind" : spell.spell === "stormcall" ? "lightning" : spell.spell === "freeze" || spell.spell === "frostbite" ? "freeze" : "special");
      void this.cinematics.play(spell.spell, from, to).then(async () => {
        if (spell.spell === "mirror" && spell.copiedSpell) await this.cinematics.play(spell.copiedSpell, to, from);
      }).finally(() => {
        this.busy = false;
        if (spell.target === 1) this.playOpponentReaction(spell.spell);
        if (this.state.turn === 1 && this.state.phase === "playing") this.time.delayedCall(450, () => void this.runAi());
      });
    }
  }

  private async runAi(): Promise<void> {
    if (this.busy || this.state.turn !== 1 || this.state.phase !== "playing") return;
    this.busy = true;
    await new Promise<void>((resolve) => this.time.delayedCall(520, resolve));
    if (this.state.hands[1].length === 2) this.state = reduceGame(this.state, { type: "call-final", player: 1 }).state;
    const card = chooseAiCard(this.state);
    this.busy = false;
    if (!card) {
      this.commit({ type: "draw", player: 1 });
      if (this.state.drawnCardId && !legalCards(this.state, 1).some((item) => item.id === this.state.drawnCardId)) this.time.delayedCall(450, () => this.commit({ type: "pass", player: 1 }));
      else if (this.state.drawnCardId) {
        const drawn = this.state.hands[1].find((item) => item.id === this.state.drawnCardId);
        if (drawn) this.time.delayedCall(450, () => this.playAiCard(drawn));
      }
      return;
    }
    this.playAiCard(card);
  }

  private playAiCard(card: Card): void {
    const colorChoice = card.color === "wild" || card.kind === "cleanse" ? chooseAiColor(this.state) : undefined;
    const from = new Phaser.Math.Vector2(this.opponentSprite.x, this.opponentSprite.y - 120);
    const to = new Phaser.Math.Vector2(this.playerSprite.x, this.playerSprite.y - 120);
    this.commit({ type: "play", player: 1, cardId: card.id, ...(colorChoice ? { colorChoice } : {}) }, from, to);
  }

  private playCharacter(player: number, action: "spellcast" | "slash" | "hurt" | "emote"): void {
    if (player === 0) {
      const pose: PremiumPlayerPose = action === "spellcast" ? "heavy-cast" : action === "slash" ? "card-play" : action === "hurt" ? "hurt" : "final-card";
      this.playerDirector.play(pose, action === "spellcast" ? 1250 : 900);
      return;
    }
    const pose: PremiumGabbyPose = action === "spellcast" ? "heavy-cast" : action === "slash" ? "card-play" : action === "hurt" ? "hurt" : "final-card";
    this.opponentDirector.play(pose, action === "spellcast" ? 1250 : 900);
  }

  private showCardInspection(card: Card): void {
    const premium = premiumCardTexture(card.kind);
    if (!premium) return;
    this.cardInspection?.destroy(true);
    const y = this.portrait ? 535 : 318;
    const width = this.portrait ? 178 : 215;
    const height = width * 1.5;
    const root = this.add.container(this.scale.width / 2, y).setDepth(520).setAlpha(0).setScale(0.72);
    const shadow = this.add.rectangle(10, 12, width + 18, height + 18, 0x000000, 0.72).setRounded(18);
    const halo = this.add.rectangle(0, 0, width + 12, height + 12, SPELL_COLORS[card.kind] ?? 0xb887ff, 0.15).setRounded(16).setStrokeStyle(4, 0xffe49a, 0.98).setBlendMode(Phaser.BlendModes.ADD);
    const face = this.add.sprite(0, 0, premium.texture, premium.animation ? Phaser.Math.Between(0, 47) : 0).setDisplaySize(width, height);
    if (premium.animation) face.play({ key: premium.animation, startFrame: Phaser.Math.Between(0, 47) });
    const instruction = this.portrait ? "TAP THE CARD AGAIN TO CAST" : "MOVE AWAY TO RETURN";
    const label = this.add.text(0, height / 2 + 24, `${CARD_NAMES[card.kind].toUpperCase()}  •  ${instruction}`, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "12px" : "14px", fontStyle: "bold", color: "#fff4c9", stroke: "#070b18", strokeThickness: 5 }).setOrigin(0.5);
    root.add([shadow, halo, face, label]);
    this.cardInspection = root;
    this.tweens.add({ targets: root, alpha: 1, scale: 1, y: y - 8, duration: 180, ease: "Back.Out" });
    this.tweens.add({ targets: halo, alpha: { from: 0.28, to: 0.08 }, duration: 520, yoyo: true, repeat: -1 });
  }

  private playPlayerReaction(spell: CardKind): void {
    const pose: PremiumPlayerPose = spell === "freeze" || spell === "frostbite"
      ? "frozen"
      : spell === "arsonist"
        ? "burn"
        : spell === "whirlwind"
          ? "wind"
          : "hurt";
    this.playerDirector.play(pose, pose === "burn" ? 1450 : 1100);
  }

  private playOpponentReaction(spell: CardKind): void {
    const pose: PremiumGabbyPose = spell === "freeze" || spell === "frostbite"
      ? "frozen"
      : spell === "arsonist"
        ? "burn"
        : spell === "whirlwind"
          ? "wind"
          : "hurt";
    this.opponentDirector.play(pose, pose === "burn" ? 1450 : 1100);
  }

  private async runChallenge(): Promise<void> {
    this.finalChallengeRunning = true;
    this.busy = true;
    audioManager.playSfx("challenge");
    const types: ChallengeType[] = ["rune-memory", "spell-timing", "arcane-clash"];
    const type = types[this.state.turnNumber % types.length]!;
    const result = await this.challenges.start(type);
    const ranges = { easy: [260, 520], normal: [430, 680], hard: [590, 790], nightmare: [700, 900] } as const;
    const [low, high] = ranges[this.state.difficulty];
    const aiScore = Math.round(low + ((this.state.rngSeed % 1000) / 1000) * (high - low));
    this.state = resolveChallenge(this.state, result.score, aiScore);
    const finalResult = this.state.events.find((event): event is Extract<GameEvent, { type: "final-card" }> => event.type === "final-card");
    if (finalResult) {
      const winner = finalResult.success ? finalResult.actor : 1 - finalResult.actor;
      this.playerDirector.play(winner === 0 ? "victory" : "defeat", finalResult.success ? 1300 : 1500);
      this.opponentDirector.play(winner === 1 ? "victory" : "defeat", finalResult.success ? 1300 : 1500);
    }
    gameBus.dispatchEvent(new CustomEvent("toast", { detail: `${CARD_NAMES.prism}: You ${result.score} • Rival ${aiScore}` }));
    this.finalChallengeRunning = false;
    this.busy = false;
    this.renderState();
  }
}
