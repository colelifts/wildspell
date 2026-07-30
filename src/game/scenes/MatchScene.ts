import Phaser from "phaser";
import { CARD_BACK_KEY, createPremiumCardAnimations, preloadPremiumCards, premiumCardTexture } from "../animation/CardVisuals";
import { PremiumGabbyDirector, preloadPremiumGabby, type PremiumGabbyPose } from "../animation/PremiumGabbyDirector";
import { PremiumPlayerDirector, preloadPremiumPlayer, type PremiumPlayerPose } from "../animation/PremiumPlayerDirector";
import { ReactiveArena } from "../animation/ReactiveArena";
import { SpellCinematics } from "../animation/SpellCinematics";
import { ChallengeDirector, type ChallengeType } from "../challenges/ChallengeDirector";
import { audioManager } from "../audio/AudioManager";
import { gameBus, emitGameEvents, emitGameState, requestColor, type CharacterId, type StartMatchDetail } from "../events";
import { chooseAiCard, chooseAiColor } from "../rules/ai";
import { CARD_EFFECT_LABELS, CARD_GLYPHS, CARD_NAMES } from "../rules/cards";
import { illegalReason, isLegalCard, legalCards } from "../rules/legalMoves";
import { advanceRound, createGame, reduceGame, resolveChallenge, restartMatch } from "../rules/reducer";
import type { Card, CardColor, CardKind, GameCommand, GameEvent, GameState } from "../rules/types";
import { guidanceFor } from "../ui/GuidanceDirector";
import { advanceRoomRound, commitRoomCommand, resolveRoomChallengeTimeout, restartRoomMatch, submitChallengeScore, subscribeRoom, type RoomSession } from "../multiplayer/roomService";
import { stateForSlot } from "../multiplayer/perspective";
import type { RoomRecord } from "../multiplayer/protocol";
import { virtualViewport } from "../render/virtualViewport";

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

function cardSound(card: Card): string {
  if (card.kind === "number") return `number-${card.color}`;
  if (card.kind === "draw2") return "arcane-2";
  if (card.kind === "wild4") return "chaos-4";
  if (card.kind === "arsonist") return "fire";
  if (card.kind === "freeze") return "freeze";
  if (card.kind === "whirlwind") return "swap";
  return card.color === "wild" ? "wild" : "special";
}

interface CardView {
  card: Card;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
}

export class MatchScene extends Phaser.Scene {
  private state!: GameState;
  private cinematics!: SpellCinematics;
  private arena!: ReactiveArena;
  private playerDirector!: PremiumPlayerDirector | PremiumGabbyDirector;
  private opponentDirector!: PremiumPlayerDirector | PremiumGabbyDirector;
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
  private roundTransitionTimer?: Phaser.Time.TimerEvent;
  private resultOverlayActive = false;
  private onlineSession?: RoomSession;
  private onlineRevision = -1;
  private onlineUnsubscribe?: () => void;
  private virtualWidth = 1024;
  private virtualHeight = 576;
  private renderScale = 1;

  constructor() { super("MatchScene"); }

  init(data: StartMatchDetail): void {
    this.startDetail = data;
    this.virtualWidth = data.render?.width ?? 1024;
    this.virtualHeight = data.render?.height ?? 576;
    this.renderScale = data.render?.scale ?? 1;
    this.registry.set("virtualWidth", this.virtualWidth);
    this.registry.set("virtualHeight", this.virtualHeight);
    this.registry.set("renderScale", this.renderScale);
    this.onlineSession = data.online?.session;
    this.onlineRevision = data.online?.room.state?.syncRevision ?? data.online?.room.revision ?? -1;
    const selected = data.characterId ?? "kenpachi";
    const soloNames: [string, string] = selected === "kenpachi" ? ["KENPACHI", "HISOKA"] : ["HISOKA", "KENPACHI"];
    this.state = data.online?.room.state
      ? stateForSlot(data.online.room.state, data.online.session.slot)
      : createGame(soloNames, data.ruleset, data.difficulty, Date.now() >>> 0);
    if (data.resultPreview) {
      this.state.roundNumber = 2;
      this.state.roundWinner = 0;
      this.state.scores = data.resultPreview === "match" ? [225, 145] : [85, 45];
      this.state.phase = data.resultPreview === "match" ? "match-over" : "round-over";
    }
    this.registry.set("seed", this.state.rngSeed);
  }

  preload(): void {
    this.load.image("arena-premium", "/backgrounds/arena-premium.png");
    this.load.image("ui-nameplate-player", "/ui/nameplate-player.png");
    this.load.image("ui-nameplate-rival", "/ui/nameplate-rival.png");
    this.load.image("ui-guidance", "/ui/guidance-banner.png");
    this.load.image("ui-stack-orb", "/ui/draw-stack-orb.png");
    this.load.image("ui-deck-pedestal", "/ui/deck-pedestal.png");
    this.load.image("ui-results-panel", "/ui/results-panel.png");
    this.load.image("ui-result-banner", "/ui/result-banner.png");
    this.load.image("ui-minigame-frame", "/ui/minigame-frame.png");
    this.load.image("ui-countdown-emblem", "/ui/countdown-emblem.png");
    this.load.image("status-burn", "/effects/status/burn-overlay.png");
    this.load.image("status-freeze", "/effects/status/freeze-overlay.png");
    this.load.image("status-whirlwind", "/effects/status/whirlwind-overlay.png");
    preloadPremiumCards(this);
    preloadPremiumPlayer(this);
    preloadPremiumGabby(this);
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.portrait = this.virtualHeight > this.virtualWidth;
    const width = this.virtualWidth;
    const height = this.virtualHeight;
    const originalText = this.add.text.bind(this.add);
    this.add.text = ((x, y, text, style = {}) => originalText(x, y, text, { ...style, resolution: this.renderScale })) as typeof this.add.text;
    this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height).setZoom(this.renderScale).centerOn(width / 2, height / 2);
    this.game.canvas.dataset.virtualViewport = `${width}x${height}@${this.renderScale.toFixed(2)}`;
    this.cameras.main.setBackgroundColor(0x07112c);
    this.arena = new ReactiveArena(this, this.portrait);
    this.arena.create("arena-premium");
    this.add.rectangle(width / 2, height - 50, width, 100, 0x061020, 0.62).setDepth(5);
    this.add.rectangle(width / 2, this.portrait ? 74 : 38, width, this.portrait ? 148 : 76, 0x061020, 0.72).setDepth(5);

    createPremiumCardAnimations(this);
    const guestPerspective = this.onlineSession?.slot === 1;
    const selectedCharacter: CharacterId = this.startDetail.characterId ?? "kenpachi";
    const playerCharacter: CharacterId = this.onlineSession
      ? (guestPerspective ? "hisoka" : "kenpachi")
      : selectedCharacter;
    const opponentCharacter: CharacterId = playerCharacter === "kenpachi" ? "hisoka" : "kenpachi";
    const baseY = this.portrait ? height * 0.7 : height * 0.94;
    const playerX = this.portrait ? width * 0.12 : width * 0.14;
    const opponentX = this.portrait ? width * 0.88 : width * 0.86;
    const coleHeight = this.portrait ? Phaser.Math.Clamp(height * 0.3, 300, 350) : 350;
    const gabbyHeight = this.portrait ? Phaser.Math.Clamp(height * 0.29, 290, 340) : 330;
    this.playerDirector = playerCharacter === "kenpachi" ? new PremiumPlayerDirector(this) : new PremiumGabbyDirector(this);
    this.playerSprite = this.playerDirector.create(playerX, baseY, playerCharacter === "kenpachi" ? coleHeight : gabbyHeight);
    this.opponentDirector = opponentCharacter === "kenpachi" ? new PremiumPlayerDirector(this) : new PremiumGabbyDirector(this);
    this.opponentSprite = this.opponentDirector.create(opponentX, baseY, opponentCharacter === "kenpachi" ? coleHeight : gabbyHeight);
    this.cinematics = new SpellCinematics(this);
    this.challenges = new ChallengeDirector(this);
    this.bindControls();
    if (this.startDetail.resultPreview) this.game.canvas.dataset.resultState = `active:${this.startDetail.resultPreview}`;
    if (this.onlineSession) this.syncOnlineDataset();
    this.renderState(true);
    this.game.canvas.dataset.matchReady = "true";
    this.game.canvas.dataset.characterId = selectedCharacter;
    if (this.onlineSession) void this.connectOnline();
    if (this.startDetail.challengePreview) {
      this.busy = true;
      this.forcedResolutionTimer?.remove(false);
      this.forcedResolutionTimer = undefined;
      this.setChallengeUi(true);
      this.time.delayedCall(850, () => {
        const previewType = this.startDetail.challengePreview!;
        this.game.canvas.dataset.challengeState = `active:${previewType}`;
        void audioManager.playMusic("challenge");
        void this.challenges.start(previewType)
          .then((result) => {
            this.game.canvas.dataset.challengeState = `complete:${result.type}:${result.score}`;
          })
          .finally(() => {
            void audioManager.playMusic("battle");
            this.busy = false;
            this.setChallengeUi(false);
            this.renderState();
          });
      });
    }
    if (this.startDetail.spellPreview) {
      this.busy = true;
      this.time.delayedCall(850, () => {
        const spell = this.startDetail.spellPreview!;
        const from = new Phaser.Math.Vector2(this.playerSprite.x, this.playerSprite.y - 120);
        const to = new Phaser.Math.Vector2(this.opponentSprite.x, this.opponentSprite.y - 120);
        this.game.canvas.dataset.spellState = `active:${spell}`;
        this.arena.react(spell, to, spell === "wild4" ? 4 : spell === "draw2" ? 2 : 0);
        void this.cinematics.play(spell, from, to).finally(() => {
          this.game.canvas.dataset.spellState = `complete:${spell}`;
          this.busy = false;
        });
      });
    }
    void audioManager.playMusic("battle");
  }

  shutdown(): void {
    this.forcedResolutionTimer?.remove(false);
    this.roundTransitionTimer?.remove(false);
    this.onlineUnsubscribe?.();
    this.onlineUnsubscribe = undefined;
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
    on("emote", () => this.playCharacter(0, "emote"));
    const playCardListener = ((event: CustomEvent<string>) => this.onCardRequested(event.detail)) as EventListener;
    gameBus.addEventListener("play-card", playCardListener);
    this.listeners.push(["play-card", playCardListener]);
  }

  private async connectOnline(): Promise<void> {
    if (!this.onlineSession) return;
    try {
      this.onlineUnsubscribe = await subscribeRoom(this.onlineSession.code, (room) => this.applyOnlineRoom(room));
    } catch (error) {
      gameBus.dispatchEvent(new CustomEvent("toast", { detail: error instanceof Error ? error.message : "Online arena disconnected." }));
    }
  }

  private applyOnlineRoom(room: RoomRecord | null): void {
    if (!room?.state || !this.onlineSession) return;
    const revision = room.state.syncRevision ?? room.revision;
    if (revision <= this.onlineRevision) {
      this.syncOnlineDataset(room);
      return;
    }
    this.onlineRevision = revision;
    this.state = stateForSlot(room.state, this.onlineSession.slot);
    this.busy = false;
    if (this.state.phase !== "challenge") this.finalChallengeRunning = false;
    if (this.state.phase !== "round-over" && this.state.phase !== "match-over") this.resultOverlayActive = false;
    this.syncOnlineDataset(room);
    emitGameEvents(this.state.events);

    const spell = this.state.events.find((event): event is Extract<GameEvent, { type: "spell" }> => event.type === "spell");
    const played = this.state.events.find((event): event is Extract<GameEvent, { type: "card-played" }> => event.type === "card-played");
    if (played) {
      audioManager.playSfx(cardSound(played.card));
      this.playCharacter(played.actor, spell ? "spellcast" : "slash");
    }
    this.renderState();
    if (spell) {
      const actor = spell.actor === 0 ? this.playerSprite : this.opponentSprite;
      const target = spell.target === 0 ? this.playerSprite : this.opponentSprite;
      const from = new Phaser.Math.Vector2(actor.x, actor.y - 120);
      const to = new Phaser.Math.Vector2(target.x, target.y - 120);
      this.busy = true;
      this.arena.react(spell.spell, to, this.state.drawStack.amount);
      if (spell.target === 0) this.playPlayerReaction(spell.spell);
      else this.playOpponentReaction(spell.spell);
      void this.cinematics.play(spell.spell, from, to).finally(() => {
        this.busy = false;
        this.renderState();
      });
    }
  }

  private syncOnlineDataset(room?: RoomRecord): void {
    if (!this.onlineSession) return;
    this.game.canvas.dataset.onlineRoom = this.onlineSession.code;
    this.game.canvas.dataset.onlineSlot = String(this.onlineSession.slot);
    this.game.canvas.dataset.onlineRevision = String(room?.state?.syncRevision ?? this.onlineRevision);
    this.game.canvas.dataset.onlineTurn = String(this.state.turn);
    this.game.canvas.dataset.onlinePhase = this.state.phase;
    this.game.canvas.dataset.onlineColor = this.state.currentColor;
    this.game.canvas.dataset.onlineStack = String(this.state.drawStack.amount);
    this.game.canvas.dataset.onlineRound = String(this.state.roundNumber);
    if (this.state.phase === "round-over") this.game.canvas.dataset.onlineRoundResult = String(this.state.roundNumber);
    this.game.canvas.dataset.onlineHand = String(this.state.hands[0].length);
    this.game.canvas.dataset.onlineRivalHand = String(this.state.hands[1].length);
    if (room?.challenge) this.game.canvas.dataset.onlineChallenge = `${room.challenge.id}:${room.challenge.type}`;
    else if (this.state.phase !== "challenge") delete this.game.canvas.dataset.onlineChallenge;
  }

  private renderState(initial = false): void {
    this.cardInspection?.destroy(true);
    this.cardInspection = undefined;
    this.inspectedCardId = undefined;
    for (const object of this.dynamicObjects) object.destroy();
    this.dynamicObjects = [];
    const top = this.state.discard.at(-1)!;
    this.addHud();
    this.addNameplate(this.portrait ? 118 : 138, this.portrait ? 92 : 36, this.state.names[0], this.state.hands[0].length, this.state.scores[0], this.state.statuses[0], false);
    this.addNameplate(this.portrait ? this.virtualWidth - 118 : this.virtualWidth - 138, this.portrait ? 92 : 36, this.state.names[1], this.state.hands[1].length, this.state.scores[1], this.state.statuses[1], true);
    this.addEnemyHand();
    this.addDrawPile();
    if (this.state.drawStack.amount) this.addStackChain();
    this.addCard(top, this.portrait ? this.virtualWidth * 0.6 : this.virtualWidth / 2 + 66, this.portrait ? this.virtualHeight * 0.43 : 270, false, false, 0, this.portrait ? 1.02 : 0.78);
    this.addPlayerHand(initial);
    this.addStatusAuras();
    this.arena.sync(this.state);
    this.playerDirector.setPersistentPose(this.state.statuses[0].frozen ? "frozen" : this.state.statuses[0].burn ? "burn" : "turn-ready");
    this.opponentDirector.setPersistentPose(this.state.statuses[1].frozen ? "frozen" : this.state.statuses[1].burn ? "burn" : "turn-ready");
    this.syncOnlineDataset();
    emitGameState(this.state);
    if ((this.state.phase === "round-over" || this.state.phase === "match-over") && !this.resultOverlayActive) this.showResultOverlay();
    else if (this.state.phase === "challenge" && !this.finalChallengeRunning) void this.runChallenge();
    else if (this.state.phase === "playing" && !this.busy) {
      const active = this.state.turn;
      const mustDraw = !this.state.drawnCardId && legalCards(this.state, active).length === 0;
      if (mustDraw && (!this.onlineSession || active === 0)) {
        this.forcedResolutionTimer?.remove(false);
        this.forcedResolutionTimer = this.time.delayedCall(850, () => {
          this.forcedResolutionTimer = undefined;
          if (this.state.phase === "playing" && !this.busy && !this.state.drawnCardId && legalCards(this.state, this.state.turn).length === 0) {
            this.commit({ type: "draw", player: this.state.turn });
          }
        });
      } else if (active === 1 && !this.onlineSession) this.time.delayedCall(900, () => void this.runAi());
    }
  }

  private addStackChain(): void {
    const drawCards = this.state.discard.filter((card) => card.kind === this.state.drawStack.kind).slice(-4, -1);
    const baseX = this.portrait ? this.virtualWidth * 0.6 : this.virtualWidth / 2 + 66;
    const baseY = this.portrait ? this.virtualHeight * 0.43 : 270;
    const orb = this.add.image(baseX, baseY - (this.portrait ? 142 : 110), "ui-stack-orb").setDisplaySize(this.portrait ? 118 : 104, this.portrait ? 94 : 82).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    drawCards.forEach((card, index) => {
      const behind = this.addCard(card, baseX - 42 - index * 25, baseY - 8 - index * 4, false, false, -8 - index * 3, this.portrait ? 0.86 : 0.66);
      behind.container.setDepth(8 + index);
    });
    const counter = this.add.text(baseX, baseY - (this.portrait ? 132 : 104), `COUNTER WINDOW  •  +${this.state.drawStack.amount} WAITING`, {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "13px" : "15px", fontStyle: "bold", color: "#fff0a6", stroke: "#4d146f", strokeThickness: 6
    }).setOrigin(0.5).setDepth(32);
    this.tweens.add({ targets: counter, scale: { from: 1, to: 1.08 }, duration: 520, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: orb, angle: 360, scale: { from: 0.94, to: 1.08 }, alpha: { from: 0.72, to: 1 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.dynamicObjects.push(orb, counter);
  }

  private showResultOverlay(): void {
    this.resultOverlayActive = true;
    this.busy = true;
    const winner = this.state.roundWinner ?? 0;
    const playerWon = winner === 0;
    const matchOver = this.state.phase === "match-over";
    const { width, height } = virtualViewport(this);
    const portrait = this.portrait;
    const root = this.add.container(0, 0).setDepth(650).setAlpha(0);
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x02040e, 0.9);
    const washColor = playerWon ? 0x2f8cff : 0xb44cff;
    const wash = this.add.circle(width / 2, height / 2, portrait ? 310 : 440, washColor, 0.13).setBlendMode(Phaser.BlendModes.ADD);
    const panelWidth = portrait ? width - 52 : 700;
    const panelHeight = portrait ? 470 : 390;
    const panel = this.add.image(width / 2, height / 2, "ui-results-panel").setDisplaySize(panelWidth, panelHeight).setAlpha(0.98);
    const inner = this.add.image(width / 2, height / 2 - (portrait ? 105 : 83), "ui-result-banner").setDisplaySize(panelWidth - (portrait ? 62 : 120), portrait ? 132 : 116).setAlpha(0.88);
    const kicker = this.add.text(width / 2, height / 2 - (portrait ? 175 : 145), matchOver ? "ARCANE TOURNAMENT COMPLETE" : `ROUND ${this.state.roundNumber} COMPLETE`, {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: portrait ? "17px" : "20px", fontStyle: "bold", color: "#9eeaff", letterSpacing: 2
    }).setOrigin(0.5);
    const title = this.add.text(width / 2, height / 2 - (portrait ? 112 : 88), matchOver ? (playerWon ? "MATCH CHAMPION" : `${this.state.names[1]} TRIUMPHS`) : (playerWon ? "ROUND WON" : "ROUND LOST"), {
      fontFamily: "Georgia, serif", fontSize: portrait ? "43px" : "56px", fontStyle: "bold", color: matchOver ? "#fff0a8" : "#ffffff", stroke: playerWon ? "#164fa8" : "#5e167f", strokeThickness: 10, align: "center"
    }).setOrigin(0.5);
    const winnerLine = this.add.text(width / 2, height / 2 - (portrait ? 44 : 20), `${this.state.names[winner]} CLAIMS THE ROUND`, {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: portrait ? "16px" : "20px", fontStyle: "bold", color: "#d8e8ff"
    }).setOrigin(0.5);
    const scorePlate = this.add.rectangle(width / 2, height / 2 + (portrait ? 48 : 65), portrait ? panelWidth - 70 : 470, 82, 0x030a19, 0.82).setRounded(14).setStrokeStyle(2, 0x7898d4, 0.8);
    const score = this.add.text(width / 2, scorePlate.y, `${this.state.names[0]}  ${this.state.scores[0]}     —     ${this.state.scores[1]}  ${this.state.names[1]}`, {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: portrait ? "21px" : "26px", fontStyle: "bold", color: "#fff2c2", align: "center"
    }).setOrigin(0.5);
    root.add([backdrop, wash, panel, inner, kicker, title, winnerLine, scorePlate, score]);

    if (matchOver) {
      const rematch = this.add.text(width / 2, height / 2 + (portrait ? 145 : 145), "REMATCH", {
        fontFamily: '"Trebuchet MS", sans-serif', fontSize: portrait ? "25px" : "27px", fontStyle: "bold", backgroundColor: "#9c4be8", color: "#ffffff", padding: { x: 48, y: 16 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      rematch.on("pointerover", () => rematch.setScale(1.06));
      rematch.on("pointerout", () => rematch.setScale(1));
      rematch.on("pointerdown", () => {
        if (this.onlineSession) {
          void restartRoomMatch(this.onlineSession).catch((error) => {
            gameBus.dispatchEvent(new CustomEvent("toast", { detail: error instanceof Error ? error.message : "Rematch could not start." }));
          });
          return;
        }
        if (this.startDetail.resultPreview) this.game.canvas.dataset.resultState = "complete:match";
        this.state = restartMatch(this.state);
        this.resultOverlayActive = false;
        this.busy = false;
        this.renderState(true);
      });
      root.add(rematch);
    } else {
      const nextRound = this.add.text(width / 2, height / 2 + (portrait ? 145 : 145), `ROUND ${this.state.roundNumber + 1} BEGINS…`, {
        fontFamily: '"Trebuchet MS", sans-serif', fontSize: portrait ? "20px" : "23px", fontStyle: "bold", color: "#a9ffd9"
      }).setOrigin(0.5);
      root.add(nextRound);
      this.roundTransitionTimer?.remove(false);
      this.roundTransitionTimer = this.time.delayedCall(this.onlineSession ? 7_000 : 3_000, () => {
        this.roundTransitionTimer = undefined;
        if (this.onlineSession) {
          void advanceRoomRound(this.onlineSession).catch((error) => {
            gameBus.dispatchEvent(new CustomEvent("toast", { detail: error instanceof Error ? error.message : "The next round could not start." }));
          });
          return;
        }
        if (this.startDetail.resultPreview) this.game.canvas.dataset.resultState = "complete:round";
        this.state = advanceRound(this.state);
        this.resultOverlayActive = false;
        this.busy = false;
        this.renderState(true);
      });
    }

    if (playerWon) {
      this.playerDirector.play("victory");
      this.opponentDirector.play("defeat");
    } else {
      this.playerDirector.play("defeat");
      this.opponentDirector.play("victory");
    }
    this.dynamicObjects.push(root);
    this.tweens.add({ targets: root, alpha: 1, duration: 260 });
    this.tweens.add({ targets: panel, scale: { from: 0.88, to: 1 }, duration: 420, ease: "Back.Out" });
    this.tweens.add({ targets: wash, scale: 1.16, alpha: 0.05, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  private addHud(): void {
    const colorName = this.state.currentColor.toUpperCase();
    const turn = this.state.turn === 0 ? "YOUR TURN" : "RIVAL THINKING";
    const guide = guidanceFor(this.state, 0);
    const hud = this.add.text(this.virtualWidth / 2, this.portrait ? 22 : 19, `${turn}   •   ${colorName} MAGIC   •   ROUND ${this.state.roundNumber}`, {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "15px" : "17px", fontStyle: "bold", color: "#fff2bd", stroke: "#081127", strokeThickness: 5
    }).setOrigin(0.5).setDepth(30);
    const guideY = this.portrait ? 172 : 70;
    const guideWidth = this.portrait ? 520 : Math.min(560, this.virtualWidth * 0.47);
    const guidePlate = this.add.image(this.virtualWidth / 2, guideY, "ui-guidance").setDisplaySize(guideWidth + 42, this.portrait ? 68 : 58).setDepth(29);
    const guideText = this.add.text(this.virtualWidth / 2, guideY, guide, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "12px" : "14px", fontStyle: "bold", color: "#f5f8ff", align: "center", wordWrap: { width: guideWidth - 30 } }).setOrigin(0.5).setDepth(30);
    const battleThrill = this.startDetail.characterId === "kenpachi" && this.state.drawStack.amount > 0;
    const stackLabel = battleThrill ? `BATTLE THRILL  •  COUNTER +${this.state.drawStack.amount}` : `ARCANE STACK  +${this.state.drawStack.amount}`;
    const stack = this.add.text(this.virtualWidth / 2, this.portrait ? 218 : 104, this.state.drawStack.amount ? stackLabel : "", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "18px", fontStyle: "bold", color: battleThrill ? "#ffffff" : "#ffe472", stroke: battleThrill ? "#087692" : "#6c2f9f", strokeThickness: battleThrill ? 8 : 6 }).setOrigin(0.5).setDepth(30);
    if (battleThrill) stack.setShadow(0, 0, "#5ce8ff", 18, true, true);
    this.dynamicObjects.push(hud, guidePlate, guideText, stack);
    if (this.state.drawStack.amount) this.tweens.add({ targets: stack, scale: 1.08, alpha: 0.72, duration: 430, yoyo: true, repeat: -1 });
  }

  private addNameplate(x: number, y: number, name: string, count: number, score: number, status: GameState["statuses"][number], alignRight: boolean): void {
    const width = this.portrait ? 214 : 246;
    const half = width / 2;
    const accent = alignRight ? 0xc56bff : 0x55dcff;
    const plate = this.add.image(x, y, alignRight ? "ui-nameplate-rival" : "ui-nameplate-player").setDisplaySize(width, 76).setDepth(24).setFlipX(alignRight);
    const sealX = alignRight ? x + half - 33 : x - half + 33;
    const seal = this.add.circle(sealX, y, 20, 0x071226, 0.82).setStrokeStyle(2, accent, 0.85).setDepth(25);
    const initial = this.add.text(sealX, y, name.slice(0, 1).toUpperCase(), { fontFamily: "Georgia, serif", fontSize: "18px", fontStyle: "bold", color: "#fff0c2", stroke: "#02040b", strokeThickness: 3 }).setOrigin(0.5).setDepth(26);
    const anchor = alignRight ? x + half - 60 : x - half + 60;
    const origin = alignRight ? 1 : 0;
    const kicker = this.add.text(anchor, y - 23, alignRight ? "RIVAL" : "DUELIST", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "7px", fontStyle: "bold", color: `#${accent.toString(16).padStart(6, "0")}`, letterSpacing: 1 }).setOrigin(origin, 0).setDepth(26);
    const label = this.add.text(anchor, y - 12, name.toUpperCase(), { fontFamily: "Georgia, serif", fontSize: "15px", fontStyle: "bold", color: "#fff8e7", stroke: "#02040b", strokeThickness: 3 }).setOrigin(origin, 0).setDepth(26);
    const condition = status.frozen ? "FROZEN" : status.burn ? `BURN ${status.burn}` : "READY";
    const detail = this.add.text(anchor, y + 10, `${count} CARDS  •  ${score} PTS  •  ${condition}`, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "8px" : "9px", fontStyle: "bold", color: status.burn ? "#ff9a6f" : "#cfe8ff" }).setOrigin(origin, 0).setDepth(26);
    this.dynamicObjects.push(plate, seal, initial, kicker, label, detail);
  }

  private addLegacyNameplate(x: number, y: number, name: string, count: number, score: number, status: GameState["statuses"][number], alignRight: boolean): void {
    const width = this.portrait ? 174 : 188;
    const half = width / 2;
    const accent = alignRight ? 0xc56bff : 0x55dcff;
    const points = alignRight
      ? [new Phaser.Geom.Point(x - half + 10, y - 22), new Phaser.Geom.Point(x + half, y - 22), new Phaser.Geom.Point(x + half, y + 22), new Phaser.Geom.Point(x - half + 10, y + 22), new Phaser.Geom.Point(x - half, y + 10), new Phaser.Geom.Point(x - half, y - 10)]
      : [new Phaser.Geom.Point(x - half, y - 22), new Phaser.Geom.Point(x + half - 10, y - 22), new Phaser.Geom.Point(x + half, y - 10), new Phaser.Geom.Point(x + half, y + 10), new Phaser.Geom.Point(x + half - 10, y + 22), new Phaser.Geom.Point(x - half, y + 22)];
    const plate = this.add.graphics().setDepth(24);
    plate.fillStyle(0x030817, 0.96).fillPoints(points, true);
    plate.lineStyle(2, 0xb79a62, 0.9).strokePoints(points, true);
    plate.lineStyle(2, accent, 0.9).lineBetween(x - half + 12, y + 19, x + half - 12, y + 19);
    const sealX = alignRight ? x + half - 18 : x - half + 18;
    const seal = this.add.circle(sealX, y, 11, 0x091229, 1).setStrokeStyle(1.5, accent, 0.92).setDepth(25);
    const initial = this.add.text(sealX, y, name.slice(0, 1).toUpperCase(), { fontFamily: "Georgia, serif", fontSize: "11px", fontStyle: "bold", color: "#fff0c2", stroke: "#02040b", strokeThickness: 2 }).setOrigin(0.5).setDepth(26);
    const anchor = alignRight ? x + half - 34 : x - half + 34;
    const origin = alignRight ? 1 : 0;
    const kicker = this.add.text(anchor, y - 17, alignRight ? "RIVAL" : "DUELIST", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "6px", fontStyle: "bold", color: `#${accent.toString(16).padStart(6, "0")}`, letterSpacing: 1 }).setOrigin(origin, 0).setDepth(26);
    const label = this.add.text(anchor, y - 8, name.toUpperCase(), { fontFamily: "Georgia, serif", fontSize: "13px", fontStyle: "bold", color: "#fff8e7", stroke: "#02040b", strokeThickness: 3 }).setOrigin(origin, 0).setDepth(26);
    const condition = status.frozen ? "FROZEN" : status.burn ? `BURN ${status.burn}` : "READY";
    const detail = this.add.text(anchor, y + 11, `${count} CARDS  •  ${score} PTS  •  ${condition}`, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "8px" : "10px", fontStyle: "bold", color: status.burn ? "#ff9a6f" : "#cfe8ff" }).setOrigin(origin, 0).setDepth(26);
    this.dynamicObjects.push(plate, seal, initial, kicker, label, detail);
  }

  private addEnemyHand(): void {
    const count = this.state.hands[1].length;
    const spacing = Math.min(this.portrait ? 32 : 35, (this.portrait ? 310 : 312) / Math.max(1, count - 1));
    for (let index = 0; index < count; index += 1) {
      const x = this.virtualWidth / 2 + (index - (count - 1) / 2) * spacing;
      const card = this.addCard(this.state.hands[1][index]!, x, (this.portrait ? this.virtualHeight * 0.245 : 154) + Math.abs(index - (count - 1) / 2) * 1.6, true, false, (index - (count - 1) / 2) * 1.8, this.portrait ? 0.58 : 0.42);
      card.container.setDepth(11 + index);
    }
  }

  private addDrawPile(): void {
    const fake: Card = { id: "deck", color: "wild", kind: "prism" };
    const deckX = this.virtualWidth / 2 - (this.portrait ? 58 : 70);
    const deckY = this.portrait ? this.virtualHeight * 0.43 : 270;
    const pedestal = this.add.image(deckX, deckY + (this.portrait ? 68 : 54), "ui-deck-pedestal").setDisplaySize(this.portrait ? 162 : 142, this.portrait ? 140 : 122).setDepth(7).setAlpha(0.88);
    this.dynamicObjects.push(pedestal);
    const view = this.addCard(fake, deckX, deckY, true, false, -4, this.portrait ? 1.04 : 0.86);
    view.container.setInteractive(new Phaser.Geom.Rectangle(-55, -80, 110, 160), Phaser.Geom.Rectangle.Contains).on("pointerdown", () => this.commit({ type: "draw", player: 0 }));
    const labelY = deckY + (this.portrait ? 102 : 62);
    const deckBadge = this.add.graphics().setDepth(29);
    deckBadge.fillStyle(0x071226, 0.92).fillRoundedRect(deckX - 51, labelY - 12, 102, 24, 9);
    deckBadge.lineStyle(1.5, 0x6bcfff, 0.72).strokeRoundedRect(deckX - 51, labelY - 12, 102, 24, 9);
    const deckLabel = this.add.text(deckX, labelY, `${this.state.drawPile.length} IN DECK`, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "12px", fontStyle: "bold", color: "#f3f8ff" }).setOrigin(0.5).setDepth(30);
    this.dynamicObjects.push(deckBadge, deckLabel);
    if (this.state.turn === 0 && !legalCards(this.state, 0).length) this.tweens.add({ targets: view.container, scale: 1.12, duration: 550, yoyo: true, repeat: -1 });
  }

  private addPlayerHand(initial: boolean): void {
    const hand = this.state.hands[0];
    const spacing = Math.min(this.portrait ? 66 : 72, (this.portrait ? 455 : Math.min(650, this.virtualWidth * 0.52)) / Math.max(1, hand.length - 1));
    hand.forEach((card, index) => {
      const offset = index - (hand.length - 1) / 2;
      const x = this.virtualWidth / 2 + offset * spacing;
      const y = (this.portrait ? this.virtualHeight * 0.79 : 430) + Math.abs(offset) * 2.1;
      const angle = offset * 2.2;
      const cardScale = this.portrait ? 0.9 : 0.72;
      const playable = isLegalCard(this.state, card, 0);
      const view = this.addCard(card, x, initial ? (this.portrait ? this.virtualHeight + 120 : 620) : y, false, playable, angle, cardScale);
      view.container.setDepth(80 + index);
      if (this.startDetail.characterId === "hisoka" && playable && card.color === "wild") {
        const misdirectionGlow = this.add.rectangle(0, 0, 116, 170, 0xa54cff, 0.08).setRounded(13).setStrokeStyle(3, 0xf07cff, 0.82);
        view.container.addAt(misdirectionGlow, 0);
        this.tweens.add({ targets: misdirectionGlow, alpha: { from: 0.18, to: 0.72 }, scale: { from: 1, to: 1.06 }, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      }
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
        this.addSpecialCardChrome(container, card);
      } else if (card.kind === "number") {
        this.addNumberCardFace(container, card);
      } else {
        this.addFallbackSpecialFace(container, card);
      }
      const isBurned = this.state?.statuses[0].burnedCardIds.includes(card.id) ?? false;
      if (isBurned) this.addCardStatusOverlay(container, "status-burn", "BURNED • LOCKED", "#ffd3a0", "#5a0804dd", 430);
      if (false && isBurned) {
        const burnWash = this.add.rectangle(0, 0, 106, 159, 0x5a0702, 0.48).setRounded(10).setStrokeStyle(5, 0xff4b1f, 0.98).setBlendMode(Phaser.BlendModes.ADD);
        const burn = this.add.text(0, -8, "♨", { fontSize: "55px", color: "#ffbd55", stroke: "#6b0902", strokeThickness: 8 }).setOrigin(0.5);
        const locked = this.add.text(0, 54, "BURNED • LOCKED", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "10px", fontStyle: "bold", color: "#fff3d0", backgroundColor: "#5a0804dd", padding: { x: 6, y: 4 } }).setOrigin(0.5);
        container.add([burnWash, burn, locked]);
        this.tweens.add({ targets: [burnWash, burn], alpha: { from: 0.48, to: 0.9 }, scale: { from: 0.96, to: 1.04 }, duration: 420, yoyo: true, repeat: -1 });
        for (let index = 0; index < 9; index += 1) {
          const flame = this.add.ellipse(-48 + index * 12, 66 + (index % 3) * 5, 13 + (index % 2) * 7, 35 + (index % 3) * 8, index % 2 ? 0xffb21c : 0xff3d12, 0.86)
            .setBlendMode(Phaser.BlendModes.ADD).setAngle(index % 2 ? 12 : -12);
          container.add(flame);
          this.tweens.add({ targets: flame, y: 20 - (index % 4) * 10, x: flame.x + (index % 2 ? 7 : -7), alpha: 0.12, scaleX: 0.35, duration: 520 + index * 55, delay: index * 60, repeat: -1 });
        }
      }
      const isFrozen = this.state?.statuses[0].frozenCardIds.includes(card.id) ?? false;
      if (isFrozen) this.addCardStatusOverlay(container, "status-freeze", "FROZEN • LOCKED", "#efffff", "#123d66dd", 920);
      if (false && isFrozen) {
        const frostWash = this.add.rectangle(0, 0, 106, 159, 0x65d7ff, 0.33).setRounded(10).setBlendMode(Phaser.BlendModes.SCREEN);
        const frost = this.add.text(0, -9, "❄", { fontSize: "62px", color: "#e4fdff", stroke: "#26618d", strokeThickness: 6 }).setOrigin(0.5).setAlpha(0.92);
        const locked = this.add.text(0, 54, "FROZEN • LOCKED", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "10px", fontStyle: "bold", color: "#efffff", backgroundColor: "#123d66dd", padding: { x: 6, y: 4 } }).setOrigin(0.5);
        container.add([frostWash, frost, locked]);
        const cracks = this.add.graphics();
        cracks.lineStyle(2, 0xd9fbff, 0.9);
        [[-48,-66,-10,-25],[-10,-25,-37,5],[-10,-25,18,4],[48,-50,14,-9],[14,-9,45,24],[-45,38,-8,15],[-8,15,20,54]].forEach(([x1,y1,x2,y2]) => cracks.lineBetween(x1!, y1!, x2!, y2!));
        container.add(cracks);
        for (let index = 0; index < 7; index += 1) {
          const mote = this.add.circle(-45 + index * 15, 72 - (index % 3) * 18, 2 + (index % 2), 0xe9ffff, 0.9).setBlendMode(Phaser.BlendModes.ADD);
          container.add(mote);
          this.tweens.add({ targets: mote, y: -74, x: mote.x + (index % 2 ? 8 : -8), alpha: 0.05, duration: 1050 + index * 90, delay: index * 100, repeat: -1 });
        }
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

  private addCardStatusOverlay(container: Phaser.GameObjects.Container, texture: string, label: string, color: string, backgroundColor: string, duration: number): void {
    const overlay = this.add.image(0, 0, texture).setDisplaySize(122, 183).setAlpha(0.94).setBlendMode(Phaser.BlendModes.ADD);
    const echo = this.add.image(0, 0, texture).setDisplaySize(118, 177).setAlpha(0.3).setFlipX(true).setBlendMode(Phaser.BlendModes.SCREEN);
    const locked = this.add.text(0, 57, label, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "9px", fontStyle: "bold", color, backgroundColor, padding: { x: 6, y: 4 } }).setOrigin(0.5);
    container.add([overlay, echo, locked]);
    this.tweens.add({ targets: overlay, alpha: { from: 0.72, to: 1 }, scale: { from: 0.98, to: 1.035 }, duration, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({ targets: echo, alpha: { from: 0.12, to: 0.44 }, x: { from: -2, to: 2 }, duration: duration * 1.37, yoyo: true, repeat: -1, ease: "Sine.InOut" });
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
    const addAura = (x: number, y: number, color: number, text: string, texture: "status-burn" | "status-freeze") => {
      const ring = this.add.circle(x, y, 85, color, 0.13).setStrokeStyle(5, color, 0.58).setDepth(16);
      const frame = this.add.image(x, y - 8, texture)
        .setDisplaySize(this.portrait ? 154 : 178, this.portrait ? 252 : 286)
        .setDepth(18)
        .setAlpha(0.72)
        .setBlendMode(texture === "status-burn" ? Phaser.BlendModes.ADD : Phaser.BlendModes.SCREEN);
      const echo = this.add.image(x, y - 8, texture)
        .setDisplaySize(this.portrait ? 162 : 188, this.portrait ? 262 : 298)
        .setDepth(17)
        .setAlpha(0.2)
        .setFlipX(true)
        .setBlendMode(Phaser.BlendModes.ADD);
      const label = this.add.text(x, y - 125, text, { fontSize: "15px", fontStyle: "bold", color: `#${color.toString(16).padStart(6, "0")}`, stroke: "#071126", strokeThickness: 5 }).setOrigin(0.5).setDepth(26);
      this.tweens.add({ targets: ring, scale: 1.16, alpha: 0.03, duration: 700, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: frame, alpha: { from: 0.5, to: 0.92 }, scale: { from: 0.98, to: 1.035 }, duration: texture === "status-burn" ? 430 : 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: echo, alpha: { from: 0.08, to: 0.34 }, angle: { from: -1.5, to: 1.5 }, duration: texture === "status-burn" ? 610 : 1250, yoyo: true, repeat: -1 });
      this.dynamicObjects.push(ring, frame, echo, label);
    };
    const player = this.state.statuses[0];
    const opponent = this.state.statuses[1];
    const auraY = this.virtualHeight * (this.portrait ? 0.57 : 0.63);
    const playerX = this.virtualWidth * (this.portrait ? 0.17 : 0.2);
    const opponentX = this.virtualWidth * (this.portrait ? 0.83 : 0.8);
    if (player.burn) addAura(playerX, auraY, 0xff643b, `BURN ${player.burn}`, "status-burn");
    if (opponent.burn) addAura(opponentX, auraY, 0xff643b, `BURN ${opponent.burn}`, "status-burn");
    if (player.frozen) addAura(playerX, auraY, 0x79e8ff, "FROZEN", "status-freeze");
    if (opponent.frozen) addAura(opponentX, auraY, 0x79e8ff, "FROZEN", "status-freeze");
  }

  private onCardSelected(view: CardView): void {
    if (this.busy) {
      gameBus.dispatchEvent(new CustomEvent("toast", { detail: "The spell is still resolving. Your card is safe." }));
      return;
    }
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

  private addSpecialCardChrome(container: Phaser.GameObjects.Container, card: Card): void {
    const color = card.kind === "draw2" ? CARD_COLORS[card.color] : (SPELL_COLORS[card.kind] ?? CARD_COLORS[card.color]);
    const plate = this.add.rectangle(0, 55, 102, 47, 0x030611, 0.91).setRounded(8).setStrokeStyle(1.5, 0xffe6a6, 0.9);
    const rule = this.add.rectangle(0, 74, 96, 1.5, color, 0.9).setBlendMode(Phaser.BlendModes.ADD);
    const badge = this.add.circle(-40, -64, 12, 0x050814, 0.94).setStrokeStyle(2, color, 1);
    const glyph = this.add.text(-40, -64, CARD_GLYPHS[card.kind], {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: card.kind === "draw2" || card.kind === "wild4" ? "12px" : "15px", fontStyle: "bold", color: "#ffffff", stroke: "#050611", strokeThickness: 3
    }).setOrigin(0.5);
    const title = this.add.text(0, 46, CARD_NAMES[card.kind].toUpperCase(), {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: CARD_NAMES[card.kind].length > 11 ? "9px" : "11px", fontStyle: "bold", color: "#fff4ce", stroke: "#02030a", strokeThickness: 3, align: "center"
    }).setOrigin(0.5);
    const effect = this.add.text(0, 64, CARD_EFFECT_LABELS[card.kind], {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: "7px", fontStyle: "bold", color: "#eef7ff", align: "center", wordWrap: { width: 92 }
    }).setOrigin(0.5);
    container.add([plate, rule, badge, glyph, title, effect]);
    const aura = this.add.rectangle(0, 0, 104, 158, color, 0.035).setRounded(11).setStrokeStyle(2, color, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    container.addAt(aura, 1);
    this.tweens.add({ targets: aura, alpha: { from: 0.04, to: 0.24 }, scale: { from: 0.98, to: 1.035 }, duration: card.kind === "arsonist" ? 430 : 760, yoyo: true, repeat: -1 });
    for (let index = 0; index < 4; index += 1) {
      const spark = this.add.circle(index % 2 ? 48 : -48, -55 + index * 35, 1.8, color, 0.9).setBlendMode(Phaser.BlendModes.ADD);
      container.add(spark);
      this.tweens.add({ targets: spark, y: spark.y - 38, alpha: 0.05, duration: 650 + index * 160, repeat: -1, delay: index * 130 });
    }
  }

  private onCardRequested(cardId: string): void {
    if (this.busy) {
      gameBus.dispatchEvent(new CustomEvent("toast", { detail: "The spell is still resolving. Your card is safe." }));
      return;
    }
    const card = this.state.hands[0].find((item) => item.id === cardId);
    if (!card) return;
    const reason = illegalReason(this.state, card, 0);
    if (reason) {
      gameBus.dispatchEvent(new CustomEvent("toast", { detail: reason }));
      return;
    }
    if (card.color === "wild" || card.kind === "cleanse") requestColor((color) => this.playCard(card, color));
    else this.playCard(card);
  }

  private playCard(card: Card, colorChoice?: Exclude<CardColor, "wild">): void {
    const start = new Phaser.Math.Vector2(this.playerSprite.x, this.playerSprite.y - 120);
    const target = new Phaser.Math.Vector2(this.opponentSprite.x, this.opponentSprite.y - 120);
    this.commit({ type: "play", player: 0, cardId: card.id, ...(colorChoice ? { colorChoice } : {}) }, start, target);
  }

  private commit(command: Parameters<typeof reduceGame>[1], from = new Phaser.Math.Vector2(430, 285), to = new Phaser.Math.Vector2(590, 240)): void {
    if (this.busy) return;
    if (this.onlineSession) {
      const preview = reduceGame(this.state, command);
      if (!preview.accepted) {
        audioManager.playSfx("invalid");
        gameBus.dispatchEvent(new CustomEvent("toast", { detail: preview.reason }));
        return;
      }
      const onlineCommand = { ...command, player: this.onlineSession.slot } as GameCommand;
      this.busy = true;
      void commitRoomCommand(this.onlineSession, onlineCommand).catch((error) => {
        this.busy = false;
        gameBus.dispatchEvent(new CustomEvent("toast", { detail: error instanceof Error ? error.message : "The online move was rejected." }));
      });
      return;
    }
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
      audioManager.playSfx(cardSound(played.card));
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
    if (this.onlineSession || this.busy || this.state.turn !== 1 || this.state.phase !== "playing") return;
    this.busy = true;
    await new Promise<void>((resolve) => this.time.delayedCall(980, resolve));
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
    const y = this.portrait ? this.virtualHeight * 0.48 : this.virtualHeight * 0.43;
    const width = this.portrait ? 228 : 188;
    const height = width * 1.5;
    const root = this.add.container(this.virtualWidth / 2, y).setDepth(520).setAlpha(0).setScale(0.72);
    const shadow = this.add.rectangle(10, 12, width + 18, height + 18, 0x000000, 0.72).setRounded(18);
    const halo = this.add.rectangle(0, 0, width + 12, height + 12, SPELL_COLORS[card.kind] ?? 0xb887ff, 0.15).setRounded(16).setStrokeStyle(4, 0xffe49a, 0.98).setBlendMode(Phaser.BlendModes.ADD);
    const face = this.add.sprite(0, 0, premium.texture, premium.animation ? Phaser.Math.Between(0, 47) : 0).setDisplaySize(width, height);
    if (premium.animation) face.play({ key: premium.animation, startFrame: Phaser.Math.Between(0, 47) });
    const infoPlate = this.add.rectangle(0, height / 2 + (this.portrait ? 50 : 47), width + 20, this.portrait ? 74 : 66, 0x030714, 0.97).setRounded(13).setStrokeStyle(2, SPELL_COLORS[card.kind] ?? 0xb887ff, 0.9);
    const effect = this.add.text(0, height / 2 + (this.portrait ? 34 : 30), CARD_EFFECT_LABELS[card.kind], { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "17px" : "16px", fontStyle: "bold", color: "#ffffff", stroke: "#070b18", strokeThickness: 5, align: "center", wordWrap: { width: width - 10 } }).setOrigin(0.5);
    const instruction = this.add.text(0, height / 2 + (this.portrait ? 65 : 59), this.portrait ? "TAP THE CARD AGAIN TO CAST" : "MOVE AWAY TO RETURN", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "11px" : "10px", fontStyle: "bold", color: "#ffe69a", letterSpacing: 1 }).setOrigin(0.5);
    root.add([shadow, halo, face, infoPlate, effect, instruction]);
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
    if (this.onlineSession) {
      await this.runOnlineChallenge();
      return;
    }
    this.finalChallengeRunning = true;
    this.busy = true;
    this.setChallengeUi(true);
    this.cardInspection?.destroy(true);
    this.cardInspection = undefined;
    this.inspectedCardId = undefined;
    this.game.canvas.dataset.challengeState = "countdown";
    audioManager.playSfx("challenge");
    void audioManager.playMusic("challenge");
    const types: ChallengeType[] = ["rune-memory", "spell-timing", "arcane-clash"];
    const type = types[this.state.turnNumber % types.length]!;
    this.game.canvas.dataset.challengeState = `active:${type}`;
    const result = await this.challenges.start(type);
    const ranges = { easy: [260, 520], normal: [430, 680], hard: [590, 790], nightmare: [700, 900] } as const;
    const [low, high] = ranges[this.state.difficulty];
    const aiScore = Math.round(low + ((this.state.rngSeed % 1000) / 1000) * (high - low));
    const challengeOwner = this.state.challengeOwner ?? 0;
    this.state = resolveChallenge(this.state, result.score, aiScore);
    const finalResult = this.state.events.find((event): event is Extract<GameEvent, { type: "final-card" }> => event.type === "final-card");
    if (finalResult) {
      const winner = finalResult.success ? finalResult.actor : 1 - finalResult.actor;
      this.playerDirector.play(winner === 0 ? "victory" : "defeat", finalResult.success ? 1300 : 1500);
      this.opponentDirector.play(winner === 1 ? "victory" : "defeat", finalResult.success ? 1300 : 1500);
      await this.showChallengeOutcome(result.score, aiScore, winner === 0, challengeOwner);
    }
    gameBus.dispatchEvent(new CustomEvent("toast", { detail: `${CARD_NAMES.prism}: You ${result.score} • Rival ${aiScore}` }));
    this.finalChallengeRunning = false;
    this.busy = false;
    this.setChallengeUi(false);
    void audioManager.playMusic("battle");
    this.renderState();
  }

  private showChallengeOutcome(playerScore: number, rivalScore: number, playerWon: boolean, challengeOwner: 0 | 1): Promise<void> {
    const { width, height } = virtualViewport(this);
    const root = this.add.container(0, 0).setDepth(700).setAlpha(0);
    const color = playerWon ? 0x49e7bd : 0xff557c;
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x02030b, 0.94);
    const burst = this.add.circle(width / 2, height / 2, this.portrait ? 250 : 340, color, 0.12).setBlendMode(Phaser.BlendModes.ADD);
    const plate = this.add.image(width / 2, height / 2, "ui-result-banner")
      .setDisplaySize(this.portrait ? width - 44 : 720, this.portrait ? 390 : 350)
      .setTint(color)
      .setAlpha(0.98);
    const kicker = this.add.text(width / 2, height / 2 - 115, "ARCANE SHOWDOWN COMPLETE", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "15px" : "18px", fontStyle: "bold", color: "#ffdda1", letterSpacing: 2 }).setOrigin(0.5);
    const rivalName = this.state.names[1];
    const title = this.add.text(width / 2, height / 2 - 55, playerWon ? "YOU WIN" : `${rivalName} WINS`, { fontFamily: "Georgia, serif", fontSize: this.portrait ? "54px" : "68px", fontStyle: "bold", color: playerWon ? "#b9ffe8" : "#ffb1c2", stroke: playerWon ? "#075645" : "#6b1230", strokeThickness: 11 }).setOrigin(0.5);
    const score = this.add.text(width / 2, height / 2 + 28, `YOU  ${playerScore}     VS     ${rivalScore}  ${rivalName}`, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "20px" : "25px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5);
    const consequenceText = challengeOwner === 0
      ? (playerWon ? "REWARD: Your final card stays safe." : "CONSEQUENCE: You draw 2 cards.")
      : (playerWon ? `CONSEQUENCE: ${rivalName} draws 2 cards.` : `REWARD: ${rivalName}'s final card stays safe.`);
    const consequence = this.add.text(width / 2, height / 2 + 91, consequenceText, { fontFamily: '"Trebuchet MS", sans-serif', fontSize: this.portrait ? "17px" : "21px", fontStyle: "bold", color: playerWon ? "#8fffd8" : "#ff9caf" }).setOrigin(0.5);
    root.add([backdrop, burst, plate, kicker, title, score, consequence]);
    this.tweens.add({ targets: root, alpha: 1, duration: 260 });
    this.tweens.add({ targets: burst, scale: 1.35, alpha: 0.03, duration: 850, yoyo: true, repeat: -1 });
    return new Promise((resolve) => this.time.delayedCall(2750, () => {
      this.tweens.add({ targets: root, alpha: 0, duration: 260, onComplete: () => { root.destroy(true); resolve(); } });
    }));
  }

  private setChallengeUi(active: boolean): void {
    document.querySelector(".game-controls")?.classList.toggle("hidden", active);
    document.querySelector("#accessible-hand")?.classList.toggle("hidden", active);
  }

  private async runOnlineChallenge(): Promise<void> {
    if (!this.onlineSession || this.finalChallengeRunning) return;
    this.finalChallengeRunning = true;
    this.busy = true;
    this.setChallengeUi(true);
    this.cardInspection?.destroy(true);
    this.cardInspection = undefined;
    this.inspectedCardId = undefined;
    void audioManager.playMusic("challenge");
    const types: ChallengeType[] = ["rune-memory", "spell-timing", "arcane-clash"];
    const type = types[this.state.turnNumber % types.length]!;
    this.game.canvas.dataset.challengeState = `active:${type}`;
    try {
      const result = await this.challenges.start(type);
      this.game.canvas.dataset.challengeState = `submitted:${type}:${result.score}`;
      gameBus.dispatchEvent(new CustomEvent("toast", { detail: `${result.score} arcane points submitted. Waiting for your rival…` }));
      await submitChallengeScore(this.onlineSession, result.score);
      this.time.delayedCall(10_500, () => {
        if (this.onlineSession && this.state.phase === "challenge") void resolveRoomChallengeTimeout(this.onlineSession);
      });
    } catch (error) {
      this.finalChallengeRunning = false;
      this.game.canvas.dataset.challengeState = `error:${type}`;
      gameBus.dispatchEvent(new CustomEvent("toast", { detail: error instanceof Error ? error.message : "Challenge synchronization failed." }));
    } finally {
      this.busy = false;
      if (this.state.phase !== "challenge") this.setChallengeUi(false);
      void audioManager.playMusic("battle");
    }
  }
}
