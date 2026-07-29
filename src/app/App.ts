import { audioManager } from "../game/audio/AudioManager";
import { gameBus } from "../game/events";
import type { ChallengeType } from "../game/challenges/ChallengeDirector";
import { illegalReason } from "../game/rules/legalMoves";
import type { Difficulty, GameEvent, GameState, Ruleset } from "../game/rules/types";
import { WildSpellGame } from "../game/WildSpellGame";
import { firebaseConfigured } from "../game/multiplayer/firebase";
import { findQuickMatch } from "../game/multiplayer/matchmaking";
import { createRoom, joinRoom, type RoomSession } from "../game/multiplayer/roomService";

export class App {
  private readonly game = new WildSpellGame();
  private state?: GameState;
  private toastTimer?: number;
  private roomSession?: RoomSession;

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.innerHTML = `
      <main class="app-shell">
        <section class="menu-screen" data-screen="menu">
          <div class="sky-glow"></div>
          <div class="menu-content">
            <header class="brand-lockup">
              <span class="brand-kicker">THE ARCANE TOURNAMENT</span>
              <h1>WILDSPELL</h1>
              <p>THE FINAL DRAW</p>
            </header>
            <div class="menu-grid">
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
                  <p class="mode-note">Wild Mode unleashes status spells, mixed draw stacks, and Final Card challenges.</p>
                </div>
                <div class="tab-panel" data-panel="online">
                  <div class="online-banner"><span>✦</span><div><b>FIREBASE ARENA</b><small>Private rooms, invite codes, presence, and reconnect</small></div></div>
                  <label>DISPLAY NAME<input id="online-name" value="Cole" maxlength="18" /></label>
                  <div class="button-pair"><button class="secondary-cta" id="create-room">CREATE ROOM</button><button class="secondary-cta violet" id="quick-match">QUICK MATCH</button></div>
                  <label>ROOM SIGIL<input id="room-code" placeholder="ABC123" maxlength="6" /></label>
                  <button class="primary-cta compact" id="join-room">JOIN PRIVATE DUEL</button>
                  <p class="mode-note" id="online-status">Online services activate when Firebase environment values are configured.</p>
                </div>
                <div class="tab-panel spellbook" data-panel="codex">
                  <article><i class="fire">♨</i><div><b>ARSONIST</b><span>Burn spreads when your rival fails to answer red.</span></div></article>
                  <article><i class="ice">❄</i><div><b>FROSTBITE</b><span>Locks a specific rival card beneath enchanted ice.</span></div></article>
                  <article><i class="wind">◌</i><div><b>WHIRLWIND</b><span>Tears cards from both hands and swaps them midair.</span></div></article>
                  <article><i class="storm">ϟ</i><div><b>STORMCALL</b><span>Demand yellow magic or punish the rival with two draws.</span></div></article>
                  <article><i class="mirror">◈</i><div><b>MIRROR TRICK</b><span>Reflects the most recent special spell.</span></div></article>
                  <article><i class="cleanse">✧</i><div><b>CLEANSE</b><span>Shatters every curse and shifts the active color.</span></div></article>
                </div>
              </section>
              <aside class="showcase-panel rune-frame">
                <div class="character-pedestal gabby-showcase"></div>
                <span class="rival-tag">FEATURED RIVAL</span>
                <h2>GABBY</h2>
                <p>Card illusionist. Impossible to read.<br />Even harder to outplay.</p>
                <div class="feature-chips"><span>4 AI LEVELS</span><span>11 SPELLS</span><span>3 CHALLENGES</span></div>
              </aside>
            </div>
          </div>
          <button class="corner-button" id="open-settings" aria-label="Open settings">⚙</button>
        </section>

        <section class="game-screen hidden" data-screen="game">
          <div id="game-canvas"></div>
          <div class="game-controls" aria-label="Match controls">
            <button id="draw-button" class="control-button draw"><span>✦</span><b>DRAW</b></button>
            <button id="final-button" class="final-button"><span>FINAL</span><strong>CARD!</strong></button>
            <button id="emote-button" class="control-button icon" aria-label="Emote">☄</button>
            <button id="game-settings" class="control-button icon" aria-label="Settings">⚙</button>
            <button id="exit-match" class="control-button icon danger" aria-label="Leave match">×</button>
          </div>
        </section>

        <div class="modal hidden" id="color-modal" role="dialog" aria-modal="true" aria-labelledby="color-title">
          <div class="modal-panel rune-frame color-modal-panel"><span class="modal-kicker">PRISM MAGIC</span><h2 id="color-title">Choose the arena color</h2><div class="color-options"><button data-color="red">FIRE</button><button data-color="blue">TIDE</button><button data-color="green">GROVE</button><button data-color="yellow">STORM</button></div></div>
        </div>
        <div class="modal hidden" id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="modal-panel rune-frame settings-panel"><span class="modal-kicker">ARCANE CONTROLS</span><h2 id="settings-title">Settings</h2>
            <label class="toggle-row"><span><b>Music</b><small>Battle and menu score</small></span><input id="music-toggle" type="checkbox" checked /></label>
            <label class="toggle-row"><span><b>Sound effects</b><small>Cards, spells, and impacts</small></span><input id="sfx-toggle" type="checkbox" checked /></label>
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
    this.root.querySelector("#draw-button")?.addEventListener("click", () => gameBus.dispatchEvent(new Event("draw")));
    this.root.querySelector("#final-button")?.addEventListener("click", () => gameBus.dispatchEvent(new Event("call-final")));
    this.root.querySelector("#emote-button")?.addEventListener("click", () => gameBus.dispatchEvent(new Event("emote")));
    this.root.querySelector("#exit-match")?.addEventListener("click", () => this.exitMatch());
    this.root.querySelector("#open-settings")?.addEventListener("click", () => this.openSettings());
    this.root.querySelector("#game-settings")?.addEventListener("click", () => this.openSettings());
    this.root.querySelector("#close-settings")?.addEventListener("click", () => this.closeSettings());
    this.root.querySelector("#music-toggle")?.addEventListener("change", (event) => audioManager.save({ music: (event.target as HTMLInputElement).checked }));
    this.root.querySelector("#sfx-toggle")?.addEventListener("change", (event) => audioManager.save({ sfx: (event.target as HTMLInputElement).checked }));
    this.root.querySelector("#voice-toggle")?.addEventListener("change", (event) => audioManager.save({ voices: (event.target as HTMLInputElement).checked }));
    this.root.querySelector("#motion-toggle")?.addEventListener("change", (event) => document.documentElement.classList.toggle("reduced-motion", (event.target as HTMLInputElement).checked));
    this.root.querySelector("#create-room")?.addEventListener("click", () => void this.createOnlineRoom());
    this.root.querySelector("#quick-match")?.addEventListener("click", () => void this.quickMatch());
    this.root.querySelector("#join-room")?.addEventListener("click", () => void this.joinOnlineRoom());

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
  }

  private startSolo(): void {
    const playerName = (this.root.querySelector("#player-name") as HTMLInputElement).value.trim() || "Cole";
    const difficulty = (this.root.querySelector("#difficulty") as HTMLSelectElement).value as Difficulty;
    const ruleset = (this.root.querySelector("#ruleset") as HTMLSelectElement).value as Ruleset;
    this.root.querySelector('[data-screen="menu"]')?.classList.add("hidden");
    this.root.querySelector('[data-screen="game"]')?.classList.remove("hidden");
    const requestedChallenge = new URLSearchParams(window.location.search).get("challenge");
    const challengePreview = (["rune-memory", "spell-timing", "arcane-clash"] as ChallengeType[]).find((type) => type === requestedChallenge);
    this.game.start({ playerName, difficulty, ruleset, ...(challengePreview ? { challengePreview } : {}) });
    audioManager.playSfx("deal");
  }

  private exitMatch(): void {
    this.game.destroy();
    this.root.querySelector('[data-screen="game"]')?.classList.add("hidden");
    this.root.querySelector('[data-screen="menu"]')?.classList.remove("hidden");
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
      return `Room ${this.roomSession.code} is open. Share the sigil; synchronized combat is still in beta.`;
    });
  }

  private async joinOnlineRoom(): Promise<void> {
    await this.withOnlineStatus("Joining the private arena…", async () => {
      const { name } = this.onlineValues();
      const code = (this.root.querySelector("#room-code") as HTMLInputElement).value;
      this.roomSession = await joinRoom(code, name);
      return `Joined room ${this.roomSession.code}. Presence is live; synchronized combat is still in beta.`;
    });
  }

  private async quickMatch(): Promise<void> {
    await this.withOnlineStatus("Searching the arcane queue…", async () => {
      const { name, ruleset } = this.onlineValues();
      this.roomSession = await findQuickMatch(name, ruleset);
      (this.root.querySelector("#room-code") as HTMLInputElement).value = this.roomSession.code;
      return this.roomSession.slot === 0
        ? `Queued in room ${this.roomSession.code}. Waiting for a rival…`
        : `Matched in room ${this.roomSession.code}. Presence is live; synchronized combat is still in beta.`;
    });
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
    const draw = this.root.querySelector<HTMLButtonElement>("#draw-button")!;
    const final = this.root.querySelector<HTMLButtonElement>("#final-button")!;
    draw.disabled = state.turn !== 0 || state.phase !== "playing" || Boolean(state.drawnCardId) || state.hands[0].some((card) => !illegalReason(state, card, 0));
    final.disabled = state.turn !== 0 || state.hands[0].length !== 2;
    final.classList.toggle("called", state.finalCalled[0]);
  }

  private reactToEvent(event: GameEvent): void {
    if (event.type === "final-card") this.showToast(event.success ? "FINAL CARD CALLED — challenge the rival!" : "Missed call! Draw two.");
    if (event.type === "cards-drawn" && event.actor === 0) this.showToast(`Drew ${event.count}: ${event.reason}.`);
    if (event.type === "round-won") this.showToast(event.actor === 0 ? "ROUND WON! The crowd erupts." : "Gabby takes the round.");
  }

  private openSettings(): void { this.root.querySelector("#settings-modal")?.classList.remove("hidden"); }
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
