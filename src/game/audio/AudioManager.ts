interface AudioManifest {
  music: Record<string, string>;
  sfx: Record<string, string>;
  voices: Record<string, string>;
}

interface AudioSettings {
  music: boolean;
  sfx: boolean;
  voices: boolean;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
}

const defaults: AudioSettings = { music: true, sfx: true, voices: true, musicVolume: 0.08, sfxVolume: 0.58, voiceVolume: 0.72 };

export class AudioManager {
  private manifest: AudioManifest = { music: {}, sfx: {}, voices: {} };
  private cache = new Map<string, HTMLAudioElement>();
  private currentMusic?: HTMLAudioElement;
  settings: AudioSettings = (() => {
    const saved = JSON.parse(localStorage.getItem("wildspell.audio") ?? "{}") as Partial<AudioSettings>;
    return { ...defaults, ...saved, musicVolume: Math.min(saved.musicVolume ?? defaults.musicVolume, 0.08) };
  })();

  async preload(): Promise<void> {
    try {
      this.manifest = await fetch("/audio-manifest.json").then((response) => response.json()) as AudioManifest;
      const entries = [...Object.entries(this.manifest.sfx), ...Object.entries(this.manifest.voices)];
      await Promise.all(entries.map(async ([name, path]) => {
        const normalized = this.normalize(path);
        try {
          const response = await fetch(normalized, { method: "HEAD" });
          if (!response.ok) return;
          const audio = new Audio(normalized);
          audio.preload = "auto";
          this.cache.set(`${name}:${normalized}`, audio);
        } catch { /* Optional audio fails silently. */ }
      }));
    } catch { /* Manifest is optional during development. */ }
  }

  playSfx(name: string): void { this.play("sfx", name); }
  playVoice(name: string): void { this.play("voices", name); }

  async playMusic(name: string): Promise<void> {
    if (!this.settings.music) return;
    const path = this.manifest.music[name];
    if (!path) return;
    const normalized = this.normalize(path);
    try {
      const response = await fetch(normalized, { method: "HEAD" });
      if (!response.ok) return;
      this.currentMusic?.pause();
      const music = new Audio(normalized);
      music.loop = true;
      music.volume = this.settings.musicVolume;
      this.currentMusic = music;
      await music.play();
    } catch { /* User gesture or missing-file failure is nonfatal. */ }
  }

  duck(duration = 900): void {
    if (!this.currentMusic) return;
    this.currentMusic.volume = Math.min(0.12, this.settings.musicVolume);
    window.setTimeout(() => { if (this.currentMusic) this.currentMusic.volume = this.settings.musicVolume; }, duration);
  }

  save(settings: Partial<AudioSettings>): void {
    Object.assign(this.settings, settings);
    localStorage.setItem("wildspell.audio", JSON.stringify(this.settings));
    if (this.currentMusic) this.currentMusic.volume = this.settings.music ? this.settings.musicVolume : 0;
  }

  private play(group: "sfx" | "voices", name: string): void {
    if (!this.settings[group]) return;
    const path = this.manifest[group][name];
    if (!path) return;
    const normalized = this.normalize(path);
    const cached = this.cache.get(`${name}:${normalized}`) ?? new Audio(normalized);
    const sound = cached.cloneNode() as HTMLAudioElement;
    sound.volume = group === "voices" ? this.settings.voiceVolume : this.settings.sfxVolume;
    void sound.play().catch(() => undefined);
    if (group === "voices") this.duck();
  }

  private normalize(path: string): string {
    return `/${path.replace(/^assets\//, "")}`;
  }
}

export const audioManager = new AudioManager();
