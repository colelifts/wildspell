import { audioManager } from "../game/audio/AudioManager";
import { gameBus, type CharacterId, type ResultPreview, type StartMatchDetail } from "../game/events";
import type { ChallengeType } from "../game/challenges/ChallengeDirector";
import { illegalReason } from "../game/rules/legalMoves";
import type { CardKind, Difficulty, GameEvent, GameState, Ruleset } from "../game/rules/types";
import { WildSpellGame } from "../game/WildSpellGame";
import { firebaseConfigured } from "../game/multiplayer/firebase";
import { findQuickMatch } from "../game/multiplayer/matchmaking";
import { createRoom, joinRoom, subscribeRoom, type RoomSession } from "../game/multiplayer/roomService";
import type { RoomRecord } from "../game/multiplayer/protocol";
import { CARD_NAMES } from "../game/rules/cards";

const CHARACTER_DATA: Record<CharacterId, {
  name: string;
  title: string;
  trait: string;
  traitCopy: string;
}> = {
  kenpachi: {
    name: "KENPACHI",
    title: "THE RELENTLESS BLADE",
    trait: "BATTLE THRILL",
    traitCopy: "Draw-stack threats pulse brighter, making +2 and +4 counters easier to read."
  },
  hisoka: {
    name: "HISOKA",
    title: "THE DECEPTIVE JOKER",
    trait: "MISDIRECTION",
    traitCopy: "Playable Wild spells shimmer, making color-control opportunities easier to spot."
  }
};

const opposingCharacter = (character: CharacterId): CharacterId => character === "kenpachi" ? "hisoka" : "kenpachi";

export class App {
  private readonly game = new WildSpellGame();
  private state?: GameState;
  private toastTimer?: number;
  private roomSession?: RoomSession;
  private roomUnsubscribe?: () => void;
  private onlineStarted = false;
  private selectedCharacter: CharacterId = "kenpachi";
  private characterSelectionReady = false;
  private pendingSolo?: Pick<StartMatchDetail, "difficulty" | "ruleset" | "challengePreview" | "spellPreview" | "resultPreview">;

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.innerHTML = `
      <main class="app-shell">
        <section class="menu-screen" data-screen="menu">
          <div class="sky-glow"></div>
          <div class="menu-content">
            <header class="brand-lockup">
              <span class="brand-kicker">THE ARCANE TOURNAMENT</span>
              <img class="brand-logo" src="/ui/wildspell-logo.png" alt="WildSpell: The Final Draw" />
              <h1>WILDSPELL</h1>
              <p>THE FINAL DRAW</p>
            </header>
            <div class="menu-grid">
              <aside class="menu-fighter menu-fighter-kenpachi" aria-hidden="true">
                <video src="/characters/kenpachi/selection-idle-ui.webm" muted loop autoplay playsinline></video>
                <div><span>PLAYABLE DUELIST</span><strong>KENPACHI</strong><small>THE RELENTLESS BLADE</small></div>
              </aside>
              <section class="command-panel rune-frame">
                <div class="mode-tabs" role="tablist">
                  <button class="mode-tab active" data-tab="solo">SOLO DUEL</button>
                  <button class="mode-tab" data-tab="online">ONLINE BETA</button>
                  <button class="mode-tab" data-tab="codex">SPELLBOOK</button>
                </div>
                <div class="tab-panel active" data-panel="solo">
                  <label>DUELIST NAME<input id="player-name" value="Cole" maxlength="18" /></label>
                  <div class="field-grid">
                    <label>RIVAL POWER<select id="difficulty"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option><option value="nightmare">Nightmare</option></select></label>
                    <label>RULESET<select id="ruleset"><option value="wild" selected>Wild Mode</option><option value="classic">Classic Mode</option></select></label>
                  </div>
                  <button class="primary-cta" id="start-solo" data-testid="start-solo"><span>⚔</span> ENTER THE ARENA <span>⚔</span></button>
                  <p class="mode-note">Wild Mode unleashes status spells, same-type draw counters, and automatic Final Card challenges.</p>
                </div>
                <div class="tab-panel" data-panel="online">
                  <div class="online-banner"><span>✦</span><div><b>FIREBASE ARENA</b><small>Private rooms, invite codes, presence, and reconnect</small></div></div>
                  <label>DISPLAY NAME<input id="online-name" value="Cole" maxlength="18" /></label>
                  <div class="button-pair"><button class="secondary-cta" id="create-room">CREATE ROOM</button><button class="secondary-cta violet" id="quick-match">QUICK MATCH</button></div>
                  <label>ROOM SIGIL<input id="room-code" placeholder="ABC123" maxlength="6" /></label>
                  <button class="primary-cta compact" id="join-room">JOIN PRIVATE DUEL</button>
                  <p class="mode-note" id="online-status">Create a private arena or enter a six-rune invite code.</p>
                  <section class="online-lobby hidden" id="online-lobby" aria-live="polite">
                    <span class="lobby-kicker">PRIVATE ARENA</span>
                    <div class="lobby-code-row"><strong id="lobby-code">------</strong><button id="copy-invite">COPY INVITE</button></div>
                    <div class="lobby-duelists"><span><b id="lobby-player-0">HOST</b><small id="lobby-presence-0">WAITING</small></span><i>VS</i><span><b id="lobby-player-1">RIVAL</b><small id="lobby-presence-1">WAITING</small></span></div>
                  </section>
                </div>
                <div class="tab-panel spellbook" data-panel="codex">
                  <article><i class="fire">♨</i><div><b>ARSONIST</b><span>Burn spreads when your rival fails to answer red.</span></div></article>
                  <article><i class="ice">❄</i><div><b>FREEZE</b><span>Encases the arena in ice and skips the rival's next turn.</span></div></article>
                  <article><i class="wind">◌</i><div><b>WHIRLWIND</b><span>Exchanges both duelists' entire remaining hands.</span></div></article>
                  <article><i class="mirror">+2</i><div><b>ARCANE +2</b><span>Adds two cards to the live draw stack.</span></div></article>
                  <article><i class="fire">+4</i><div><b>CHAOS +4</b><span>Adds four cards to the draw stack and changes color.</span></div></article>
                </div>
              </section>
              <aside class="showcase-panel rune-frame">
                <video class="character-pedestal hisoka-showcase" src="/characters/hisoka/selection-idle-ui.webm" muted loop autoplay playsinline></video>
                <span class="rival-tag">FEATURED RIVAL</span>
                <h2>HISOKA</h2>
                <p>Deceptive card illusionist. Impossible to read.<br />Even harder to outplay.</p>
                <div class="feature-chips"><span>4 AI LEVELS</span><span>5 SIGNATURE SPELLS</span><span>3 CHALLENGES</span></div>
              </aside>
            </div>
          </div>
          <button class="corner-button" id="open-settings" aria-label="Open settings">⚙</button>
        </section>

        <section class="character-select-screen hidden" data-screen="character-select" data-selected="kenpachi" aria-labelledby="character-select-title">
          <div class="select-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
          <header class="select-header">
            <button class="select-back" id="character-select-back" aria-label="Return to main menu">&#8592; BACK</button>
            <div class="select-brand">
              <img src="/ui/wildspell-logo.png" alt="" />
              <h1 id="character-select-title">SELECT YOUR DUELIST</h1>
            </div>
            <div class="select-mode"><span>SOLO DUEL</span><b>1P VS CPU</b></div>
          </header>

          <div class="versus-stage">
            <article class="fighter-side fighter-side-player" aria-live="polite">
              <div class="fighter-heading"><h2 id="selected-fighter-name">KENPACHI</h2><p id="selected-fighter-title">THE RELENTLESS BLADE</p></div>
              <div class="fighter-trait fighter-trait-player"><span>SIGNATURE TRAIT</span><strong id="selected-trait-name">BATTLE THRILL</strong><p id="selected-trait-copy">Draw-stack threats pulse brighter before you commit a move.</p></div>
              <div class="fighter-figure">
                <img data-player-fighter="kenpachi" src="/characters/kenpachi/selection-splash.png" alt="Kenpachi" />
                <img data-player-fighter="hisoka" src="/characters/hisoka/selection-splash.png" alt="Hisoka" />
              </div>
              <div class="fighter-team-banner"><span>PLAYER 1</span><strong>SELECT</strong></div>
              <div class="side-roster roster" role="radiogroup" aria-label="Available duelists">
                <button class="roster-card selected" data-character="kenpachi" role="radio" aria-label="KENPACHI" aria-checked="true"><img src="/characters/kenpachi/portrait.png" alt="" /><span><b>KENPACHI</b></span></button>
                <button class="roster-card" data-character="hisoka" role="radio" aria-label="HISOKA" aria-checked="false"><img src="/characters/hisoka/portrait.png" alt="" /><span><b>HISOKA</b></span></button>
                ${Array.from({ length: 10 }, () => '<div class="roster-card locked" aria-label="Locked duelist"><i>?</i></div>').join("")}
              </div>
            </article>

            <div class="versus-core">
              <strong>VS</strong>
              <span class="selection-status" id="selection-status">CHOOSE YOUR DUELIST</span>
              <button class="confirm-fighter" id="confirm-character" data-testid="confirm-character" aria-label="Start the duel" disabled><span>BOTH READY</span><b>BEGIN DUEL</b></button>
            </div>

            <article class="fighter-side fighter-side-rival">
              <div class="fighter-heading"><h2 id="rival-fighter-name">HISOKA</h2><p id="rival-fighter-title">THE DECEPTIVE JOKER</p></div>
              <div class="fighter-trait fighter-trait-rival"><span>SIGNATURE TRAIT</span><strong id="rival-trait-name">MISDIRECTION</strong><p id="rival-trait-copy">Playable Wild spells shimmer so color-control options stand out.</p></div>
              <div class="fighter-figure">
                <img data-rival-fighter="hisoka" src="/characters/hisoka/selection-splash.png" alt="Hisoka" />
                <img data-rival-fighter="kenpachi" src="/characters/kenpachi/selection-splash.png" alt="Kenpachi" />
              </div>
              <div class="fighter-team-banner"><span>CPU</span><strong>AUTO PICK</strong></div>
              <div class="side-roster rival-roster" aria-label="Rival roster">
                <div class="rival-roster-card" data-rival-choice="kenpachi"><img src="/characters/kenpachi/portrait.png" alt="" /></div>
                <div class="rival-roster-card selected" data-rival-choice="hisoka"><img src="/characters/hisoka/portrait.png" alt="" /></div>
                ${Array.from({ length: 10 }, () => '<div class="rival-roster-card locked" aria-hidden="true"><i>?</i></div>').join("")}
              </div>
            </article>
          </div>
        </section>

        <section class="game-screen hidden" data-screen="game">
          <div id="game-canvas"></div>
          <div class="game-controls" aria-label="Match controls">
            <button id="draw-button" class="control-button draw"><span>✦</span><b>DRAW</b></button>
            <button id="emote-button" class="control-button icon" aria-label="Emote">☄</button>
            <button id="game-settings" class="control-button icon" aria-label="Settings">⚙</button>
            <button id="exit-match" class="control-button icon danger" aria-label="Leave match">×</button>
          </div>
          <div class="accessible-hand" id="accessible-hand" role="group" aria-label="Your cards"></div>
        </section>

        <div class="modal hidden" id="color-modal" role="dialog" aria-modal="true" aria-labelledby="color-title">
          <div class="modal-panel rune-frame color-modal-panel"><span class="modal-kicker">PRISM MAGIC</span><h2 id="color-title">Choose the arena color</h2><div class="color-options"><button data-color="red">FIRE</button><button data-color="blue">TIDE</button><button data-color="green">GROVE</button><button data-color="yellow">STORM</button></div></div>
        </div>
        <div class="modal hidden" id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="modal-panel rune-frame settings-panel"><span class="modal-kicker">ARCANE CONTROLS</span><h2 id="settings-title">Settings</h2>
            <label class="toggle-row"><span><b>Music</b><small>Battle and menu score</small></span><input id="music-toggle" type="checkbox" checked /></label>
            <label class="volume-row"><span>Music volume</span><input id="music-volume" type="range" min="0" max="0.3" step="0.01" value="0.08" /></label>
            <label class="toggle-row"><span><b>Sound effects</b><small>Cards, spells, and impacts</small></span><input id="sfx-toggle" type="checkbox" checked /></label>
            <label class="volume-row"><span>Effects volume</span><input id="sfx-volume" type="range" min="0" max="1" step="0.01" value="0.58" /></label>
            <label class="toggle-row"><span><b>Voice hooks</b><small>Preloaded supplied voice lines</small></span><input id="voice-toggle" type="checkbox" checked /></label>
            <label class="toggle-row"><span><b>Reduced motion</b><small>Shorter camera and UI movement</small></span><input id="motion-toggle" type="checkbox" /></label>
            <button class="primary-cta compact" id="close-settings">DONE</button>
          </div>
        </div>
        <div id="toast" class="toast" role="status" aria-live="polite"></div>
        <div class="loading-veil" id="loading-veil"><div class="loading-rune">✦</div><h2>OPENING THE ARENA</h2><p>Binding spells and summoning champions…</p></div>
      </main>`;
    this.bind();
    void audioManager.preload().finally(() => window.setTimeout(() => this.root.querySelector("#loading-veil")?.classList.add("depart"), 450));
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => button.addEventListener("click", () => {
      this.root.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === button));
      this.root.querySelectorAll<HTMLElement>("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab));
      audioManager.playSfx("click");
    }));
    this.root.querySelector("#start-solo")?.addEventListener("click", () => this.startSolo());
    this.root.querySelector("#character-select-back")?.addEventListener("click", () => this.closeCharacterSelect());
    this.root.querySelector("#confirm-character")?.addEventListener("click", () => this.confirmCharacter());
    this.root.querySelectorAll<HTMLButtonElement>("[data-character]").forEach((button) => {
      button.addEventListener("click", () => this.selectCharacter(button.dataset.character as CharacterId));
      button.addEventListener("pointerenter", () => {
        this.previewCharacter(button.dataset.character as CharacterId);
        audioManager.playSfx("hover");
      });
      button.addEventListener("pointerleave", () => this.clearCharacterPreview());
      button.addEventListener("focus", () => this.previewCharacter(button.dataset.character as CharacterId));
      button.addEventListener("blur", () => this.clearCharacterPreview());
    });
    this.root.querySelectorAll<HTMLElement>(".fighter-side").forEach((side) => {
      side.addEventListener("pointerenter", () => side.classList.add("spotlight"));
      side.addEventListener("pointerleave", () => side.classList.remove("spotlight"));
    });
    this.root.querySelector("#draw-button")?.addEventListener("click", () => gameBus.dispatchEvent(new Event("draw")));
    this.root.querySelector("#emote-button")?.addEventListener("click", () => gameBus.dispatchEvent(new Event("emote")));
    this.root.querySelector("#exit-match")?.addEventListener("click", () => this.exitMatch());
    this.root.querySelector("#open-settings")?.addEventListener("click", () => this.openSettings());
    this.root.querySelector("#game-settings")?.addEventListener("click", () => this.openSettings());
    this.root.querySelector("#close-settings")?.addEventListener("click", () => this.closeSettings());
    this.root.querySelector("#music-toggle")?.addEventListener("change", (event) => audioManager.save({ music: (event.target as HTMLInputElement).checked }));
    this.root.querySelector("#sfx-toggle")?.addEventListener("change", (event) => audioManager.save({ sfx: (event.target as HTMLInputElement).checked }));
    this.root.querySelector("#voice-toggle")?.addEventListener("change", (event) => audioManager.save({ voices: (event.target as HTMLInputElement).checked }));
    this.root.querySelector("#motion-toggle")?.addEventListener("change", (event) => document.documentElement.classList.toggle("reduced-motion", (event.target as HTMLInputElement).checked));
    this.root.querySelector("#music-volume")?.addEventListener("input", (event) => audioManager.save({ musicVolume: Number((event.target as HTMLInputElement).value) }));
    this.root.querySelector("#sfx-volume")?.addEventListener("input", (event) => audioManager.save({ sfxVolume: Number((event.target as HTMLInputElement).value) }));
    this.root.querySelector("#create-room")?.addEventListener("click", () => void this.createOnlineRoom());
    this.root.querySelector("#quick-match")?.addEventListener("click", () => void this.quickMatch());
    this.root.querySelector("#join-room")?.addEventListener("click", () => void this.joinOnlineRoom());
    this.root.querySelector("#copy-invite")?.addEventListener("click", () => void this.copyInvite());
    window.addEventListener("keydown", (event) => this.handleCharacterSelectKey(event));

    gameBus.addEventListener("state", ((event: CustomEvent<GameState>) => this.updateState(event.detail)) as EventListener);
    gameBus.addEventListener("toast", ((event: CustomEvent<string>) => this.showToast(event.detail)) as EventListener);
    gameBus.addEventListener("game-event", ((event: CustomEvent<GameEvent>) => this.reactToEvent(event.detail)) as EventListener);
    gameBus.addEventListener("choose-color", ((event: CustomEvent<{ resolve: (color: "red" | "blue" | "green" | "yellow") => void }>) => {
      const modal = this.root.querySelector("#color-modal")!;
      modal.classList.remove("hidden");
      this.root.querySelectorAll<HTMLButtonElement>("[data-color]").forEach((button) => {
        button.onclick = () => {
          modal.classList.add("hidden");
          event.detail.resolve(button.dataset.color as "red" | "blue" | "green" | "yellow");
        };
      });
    }) as EventListener);

    const inviteCode = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase();
    if (inviteCode) {
      (this.root.querySelector("#room-code") as HTMLInputElement).value = inviteCode;
      this.root.querySelector<HTMLButtonElement>('[data-tab="online"]')?.click();
      this.root.querySelector<HTMLElement>("#online-status")!.textContent = `Invite ${inviteCode} loaded. Enter your name and join the duel.`;
    }
  }

  private startSolo(): void {
    const difficulty = (this.root.querySelector("#difficulty") as HTMLSelectElement).value as Difficulty;
    const ruleset = (this.root.querySelector("#ruleset") as HTMLSelectElement).value as Ruleset;
    const requestedChallenge = new URLSearchParams(window.location.search).get("challenge");
    const challengePreview = (["rune-memory", "spell-timing", "arcane-clash"] as ChallengeType[]).find((type) => type === requestedChallenge);
    const requestedResult = new URLSearchParams(window.location.search).get("result");
    const resultPreview = (["round", "match"] as ResultPreview[]).find((type) => type === requestedResult);
    const requestedSpell = new URLSearchParams(window.location.search).get("spell");
    const spellPreview = (["arsonist", "freeze", "whirlwind", "draw2", "wild4"] as CardKind[]).find((type) => type === requestedSpell);
    this.pendingSolo = { difficulty, ruleset, ...(challengePreview ? { challengePreview } : {}), ...(spellPreview ? { spellPreview } : {}), ...(resultPreview ? { resultPreview } : {}) };
    this.setMenuMedia(false);
    this.root.querySelector('[data-screen="menu"]')?.classList.add("hidden");
    this.root.querySelector('[data-screen="character-select"]')?.classList.remove("hidden");
    this.characterSelectionReady = false;
    const selectScreen = this.root.querySelector<HTMLElement>('[data-screen="character-select"]')!;
    delete selectScreen.dataset.ready;
    this.root.querySelector<HTMLButtonElement>("#confirm-character")!.disabled = true;
    this.root.querySelector<HTMLElement>("#selection-status")!.textContent = "CHOOSE YOUR DUELIST";
    this.root.querySelectorAll<HTMLButtonElement>("[data-character]").forEach((button) => {
      button.classList.remove("selected");
      button.setAttribute("aria-checked", "false");
    });
    this.renderCharacterPair(this.selectedCharacter);
    this.setCharacterSelectMedia(true);
    void audioManager.playMusic("menu");
    window.setTimeout(() => this.root.querySelector<HTMLButtonElement>(`[data-character="${this.selectedCharacter}"]`)?.focus(), 80);
  }

  private selectCharacter(character: CharacterId, playSound = true): void {
    this.selectedCharacter = character;
    this.characterSelectionReady = true;
    const screen = this.root.querySelector<HTMLElement>('[data-screen="character-select"]')!;
    screen.dataset.selected = character;
    screen.dataset.ready = "true";
    delete screen.dataset.preview;
    this.root.querySelectorAll<HTMLButtonElement>("[data-character]").forEach((button) => {
      const selected = button.dataset.character === character;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-checked", String(selected));
    });
    this.renderCharacterPair(character);
    const confirm = this.root.querySelector<HTMLButtonElement>("#confirm-character")!;
    confirm.disabled = false;
    this.root.querySelector<HTMLElement>("#selection-status")!.textContent = "BOTH DUELISTS READY";
    if (playSound) audioManager.playSfx("click");
  }

  private previewCharacter(character: CharacterId): void {
    const screen = this.root.querySelector<HTMLElement>('[data-screen="character-select"]')!;
    if (screen.classList.contains("hidden")) return;
    screen.dataset.preview = character;
    this.renderCharacterPair(character);
  }

  private clearCharacterPreview(): void {
    const screen = this.root.querySelector<HTMLElement>('[data-screen="character-select"]')!;
    delete screen.dataset.preview;
    this.renderCharacterPair(this.selectedCharacter);
  }

  private renderCharacterPair(character: CharacterId): void {
    const rival = opposingCharacter(character);
    this.root.querySelectorAll<HTMLElement>("[data-player-fighter]").forEach((fighter) => this.setFighterMediaActive(fighter, fighter.dataset.playerFighter === character));
    this.root.querySelectorAll<HTMLElement>("[data-rival-fighter]").forEach((fighter) => this.setFighterMediaActive(fighter, fighter.dataset.rivalFighter === rival));
    this.root.querySelectorAll<HTMLElement>("[data-rival-choice]").forEach((portrait) => portrait.classList.toggle("selected", portrait.dataset.rivalChoice === rival));
    this.root.querySelector<HTMLElement>("#selected-fighter-name")!.textContent = CHARACTER_DATA[character].name;
    this.root.querySelector<HTMLElement>("#selected-fighter-title")!.textContent = CHARACTER_DATA[character].title;
    this.root.querySelector<HTMLElement>("#selected-trait-name")!.textContent = CHARACTER_DATA[character].trait;
    this.root.querySelector<HTMLElement>("#selected-trait-copy")!.textContent = CHARACTER_DATA[character].traitCopy;
    this.root.querySelector<HTMLElement>("#rival-fighter-name")!.textContent = CHARACTER_DATA[rival].name;
    this.root.querySelector<HTMLElement>("#rival-fighter-title")!.textContent = CHARACTER_DATA[rival].title;
    this.root.querySelector<HTMLElement>("#rival-trait-name")!.textContent = CHARACTER_DATA[rival].trait;
    this.root.querySelector<HTMLElement>("#rival-trait-copy")!.textContent = CHARACTER_DATA[rival].traitCopy;
  }

  private setFighterMediaActive(fighter: HTMLElement, active: boolean): void {
    fighter.classList.toggle("active", active);
  }

  private confirmCharacter(): void {
    if (!this.pendingSolo || !this.characterSelectionReady) return;
    const rival = opposingCharacter(this.selectedCharacter);
    this.root.querySelector('[data-screen="character-select"]')?.classList.add("departing");
    this.setCharacterSelectMedia(false);
    audioManager.playSfx("deal");
    window.setTimeout(() => {
      this.root.querySelector('[data-screen="character-select"]')?.classList.add("hidden");
      this.root.querySelector('[data-screen="character-select"]')?.classList.remove("departing");
      this.root.querySelector('[data-screen="game"]')?.classList.remove("hidden");
      this.game.start({
        ...this.pendingSolo!,
        playerName: CHARACTER_DATA[this.selectedCharacter].name,
        opponentName: CHARACTER_DATA[rival].name,
        characterId: this.selectedCharacter
      });
    }, 360);
  }

  private closeCharacterSelect(): void {
    this.root.querySelector('[data-screen="character-select"]')?.classList.add("hidden");
    this.root.querySelector('[data-screen="menu"]')?.classList.remove("hidden");
    this.pendingSolo = undefined;
    this.setCharacterSelectMedia(false);
    this.setMenuMedia(true);
    audioManager.playSfx("click");
  }

  private setMenuMedia(playing: boolean): void {
    this.root.querySelectorAll<HTMLVideoElement>('[data-screen="menu"] video').forEach((video) => {
      if (playing) void video.play().catch(() => undefined);
      else video.pause();
    });
  }

  private setCharacterSelectMedia(playing: boolean): void {
    this.root.querySelectorAll<HTMLVideoElement>('[data-screen="character-select"] video').forEach((video) => {
      if (playing && video.classList.contains("active")) void video.play().catch(() => undefined);
      else video.pause();
    });
  }

  private handleCharacterSelectKey(event: KeyboardEvent): void {
    if (this.root.querySelector('[data-screen="character-select"]')?.classList.contains("hidden")) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      this.selectCharacter(opposingCharacter(this.selectedCharacter));
      this.root.querySelector<HTMLButtonElement>(`[data-character="${this.selectedCharacter}"]`)?.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (this.characterSelectionReady) this.confirmCharacter();
      else this.selectCharacter(this.selectedCharacter);
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.closeCharacterSelect();
    }
  }

  private exitMatch(): void {
    this.game.destroy();
    this.roomUnsubscribe?.();
    this.roomUnsubscribe = undefined;
    this.roomSession?.stopPresence();
    this.roomSession = undefined;
    this.onlineStarted = false;
    this.root.querySelector('[data-screen="game"]')?.classList.add("hidden");
    this.root.querySelector('[data-screen="menu"]')?.classList.remove("hidden");
    this.setMenuMedia(true);
    void audioManager.playMusic("menu");
  }

  private onlineValues(): { name: string; ruleset: Ruleset } {
    return {
      name: (this.root.querySelector("#online-name") as HTMLInputElement).value.trim() || "Cole",
      ruleset: (this.root.querySelector("#ruleset") as HTMLSelectElement).value as Ruleset
    };
  }

  private async createOnlineRoom(): Promise<void> {
    await this.withOnlineStatus("Opening a private arena…", async () => {
      const { name, ruleset } = this.onlineValues();
      this.roomSession = await createRoom(name, ruleset);
      (this.root.querySelector("#room-code") as HTMLInputElement).value = this.roomSession.code;
      await this.watchOnlineRoom(this.roomSession);
      return `Room ${this.roomSession.code} is open. Share the invite; the duel starts when your rival joins.`;
    });
  }

  private async joinOnlineRoom(): Promise<void> {
    await this.withOnlineStatus("Joining the private arena…", async () => {
      const { name } = this.onlineValues();
      const code = (this.root.querySelector("#room-code") as HTMLInputElement).value;
      this.roomSession = await joinRoom(code, name);
      await this.watchOnlineRoom(this.roomSession);
      return `Joined room ${this.roomSession.code}. Synchronizing the arena…`;
    });
  }

  private async quickMatch(): Promise<void> {
    await this.withOnlineStatus("Searching the arcane queue…", async () => {
      const { name, ruleset } = this.onlineValues();
      this.roomSession = await findQuickMatch(name, ruleset);
      (this.root.querySelector("#room-code") as HTMLInputElement).value = this.roomSession.code;
      await this.watchOnlineRoom(this.roomSession);
      return this.roomSession.slot === 0
        ? `Queued in room ${this.roomSession.code}. Waiting for a rival…`
        : `Matched in room ${this.roomSession.code}. Synchronizing the arena…`;
    });
  }

  private async watchOnlineRoom(session: RoomSession): Promise<void> {
    this.roomUnsubscribe?.();
    this.onlineStarted = false;
    this.root.querySelector("#online-lobby")?.classList.remove("hidden");
    this.root.querySelector<HTMLElement>("#lobby-code")!.textContent = session.code;
    this.roomUnsubscribe = await subscribeRoom(session.code, (room) => {
      if (!room) {
        this.root.querySelector<HTMLElement>("#online-status")!.textContent = "That room has closed.";
        return;
      }
      this.updateLobby(room);
      if (room.state && room.players?.[0] && room.players?.[1] && !this.onlineStarted) this.startOnlineMatch(session, room);
    });
  }

  private updateLobby(room: RoomRecord): void {
    for (const slot of [0, 1] as const) {
      const player = room.players?.[slot];
      const presence = room.presence?.[slot];
      this.root.querySelector<HTMLElement>(`#lobby-player-${slot}`)!.textContent = player?.name ?? (slot === 0 ? "HOST" : "WAITING FOR RIVAL");
      const status = this.root.querySelector<HTMLElement>(`#lobby-presence-${slot}`)!;
      status.textContent = presence?.connected ? "CONNECTED" : player ? "RECONNECTING" : "NOT JOINED";
      status.classList.toggle("connected", Boolean(presence?.connected));
    }
  }

  private startOnlineMatch(session: RoomSession, room: RoomRecord): void {
    if (!room.state || this.onlineStarted) return;
    this.onlineStarted = true;
    this.root.querySelector('[data-screen="menu"]')?.classList.add("hidden");
    this.root.querySelector('[data-screen="game"]')?.classList.remove("hidden");
    const playerName = room.players?.[session.slot]?.name ?? "Duelist";
    this.game.start({ playerName, difficulty: "normal", ruleset: room.ruleset, online: { session, room } });
    audioManager.playSfx("deal");
  }

  private async copyInvite(): Promise<void> {
    if (!this.roomSession) return;
    const invite = new URL(window.location.href);
    invite.search = "";
    invite.searchParams.set("room", this.roomSession.code);
    await navigator.clipboard.writeText(invite.toString());
    this.showToast("Invite link copied.");
  }

  private async withOnlineStatus(pending: string, action: () => Promise<string>): Promise<void> {
    const status = this.root.querySelector<HTMLElement>("#online-status")!;
    if (!firebaseConfigured()) {
      status.textContent = "Add VITE_FIREBASE_* values to .env.local to activate online rooms.";
      this.showToast(status.textContent);
      return;
    }
    status.textContent = pending;
    try {
      status.textContent = await action();
      this.showToast(status.textContent);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Online arena unavailable.";
      this.showToast(status.textContent);
    }
  }

  private updateState(state: GameState): void {
    this.state = state;
    this.root.querySelector(".game-controls")?.classList.toggle("hidden", state.phase === "challenge");
    this.root.querySelector("#accessible-hand")?.classList.toggle("hidden", state.phase === "challenge");
    const draw = this.root.querySelector<HTMLButtonElement>("#draw-button")!;
    draw.disabled = state.turn !== 0 || state.phase !== "playing" || Boolean(state.drawnCardId) || state.hands[0].some((card) => !illegalReason(state, card, 0));
    const hand = this.root.querySelector<HTMLElement>("#accessible-hand")!;
    hand.replaceChildren(...state.hands[0].map((card) => {
      const button = document.createElement("button");
      const name = card.kind === "number" ? `${card.color} ${card.value}` : `${card.color === "wild" ? "Wild" : card.color} ${CARD_NAMES[card.kind]}`;
      button.textContent = name;
      button.setAttribute("aria-label", `Play ${name}`);
      button.dataset.cardId = card.id;
      button.dataset.testid = "accessible-card";
      button.disabled = state.turn !== 0 || state.phase !== "playing" || Boolean(illegalReason(state, card, 0));
      button.addEventListener("click", () => gameBus.dispatchEvent(new CustomEvent("play-card", { detail: card.id })));
      return button;
    }));
  }

  private reactToEvent(event: GameEvent): void {
    if (event.type === "final-card") {
      audioManager.playSfx("final-card");
      this.showToast(event.success ? "FINAL CARD — challenge the rival!" : "Final Card challenge lost.");
    }
    if (event.type === "cards-drawn") {
      audioManager.playSfx(event.reason === "Burn" ? "burn-tick" : "draw");
      if (event.actor === 0) this.showToast(`Drew ${event.count}: ${event.reason}.`);
    }
    if (event.type === "round-won") {
      audioManager.playSfx(event.actor === 0 ? "win" : "lose");
      this.showToast(event.actor === 0 ? "ROUND WON! The crowd erupts." : "Gabby takes the round.");
    }
    if (event.type === "match-won") this.showToast(event.actor === 0 ? "MATCH CHAMPION! The arena is yours." : "Gabby wins the tournament. Demand a rematch.");
  }

  private openSettings(): void {
    (this.root.querySelector("#music-toggle") as HTMLInputElement).checked = audioManager.settings.music;
    (this.root.querySelector("#sfx-toggle") as HTMLInputElement).checked = audioManager.settings.sfx;
    (this.root.querySelector("#voice-toggle") as HTMLInputElement).checked = audioManager.settings.voices;
    (this.root.querySelector("#music-volume") as HTMLInputElement).value = String(audioManager.settings.musicVolume);
    (this.root.querySelector("#sfx-volume") as HTMLInputElement).value = String(audioManager.settings.sfxVolume);
    this.root.querySelector("#settings-modal")?.classList.remove("hidden");
  }
  private closeSettings(): void { this.root.querySelector("#settings-modal")?.classList.add("hidden"); }

  private showToast(message: string): void {
    if (!message) return;
    const toast = this.root.querySelector<HTMLElement>("#toast")!;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
  }
}
