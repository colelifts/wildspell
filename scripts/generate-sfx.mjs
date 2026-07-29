import fs from "node:fs";
import path from "node:path";

const rate = 44100;
const out = path.resolve("assets/sfx");
fs.mkdirSync(out, { recursive: true });

const presets = {
  hover: [0.09, 720, 1080, 0.08, 0.0], click: [0.12, 240, 150, 0.18, 0.08],
  deal: [0.3, 480, 760, 0.12, 0.2], draw: [0.34, 310, 920, 0.14, 0.22], play: [0.38, 210, 680, 0.2, 0.12],
  invalid: [0.3, 145, 82, 0.25, 0.12], freeze: [0.95, 1300, 280, 0.18, 0.42], fire: [1.05, 120, 540, 0.24, 0.5],
  wind: [1.15, 180, 920, 0.17, 0.68], stack: [0.65, 260, 980, 0.2, 0.15], wild: [1.1, 190, 1420, 0.19, 0.26],
  special: [0.85, 330, 1180, 0.2, 0.2], challenge: [0.8, 420, 840, 0.2, 0.08], win: [1.35, 392, 1175, 0.2, 0.05],
  lose: [1.05, 310, 98, 0.2, 0.12], "final-card": [1.0, 520, 1560, 0.2, 0.08],
  "number-red": [0.35, 180, 470, 0.18, 0.16], "number-blue": [0.4, 690, 380, 0.16, 0.15],
  "number-green": [0.4, 310, 760, 0.16, 0.18], "number-yellow": [0.38, 880, 1280, 0.14, 0.08],
  "arcane-2": [0.9, 280, 1040, 0.2, 0.18], "chaos-4": [1.2, 92, 680, 0.25, 0.36], "burn-tick": [0.6, 105, 330, 0.2, 0.5],
  thaw: [0.7, 980, 240, 0.16, 0.32], swap: [1.0, 220, 1120, 0.18, 0.62]
};

function wav(name, [duration, start, end, gain, noiseMix]) {
  const count = Math.floor(rate * duration);
  const data = Buffer.alloc(count * 2);
  let seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 1) >>> 0;
  for (let i = 0; i < count; i += 1) {
    const t = i / rate;
    const p = i / count;
    const frequency = start * Math.pow(end / start, p);
    const attack = Math.min(1, p / 0.035);
    const release = Math.pow(Math.max(0, 1 - p), 2.2);
    const pulse = 0.72 + Math.sin(Math.PI * 2 * 7 * t) * 0.08;
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const tone = Math.sin(Math.PI * 2 * frequency * t) * 0.72 + Math.sin(Math.PI * 4 * frequency * t) * 0.2;
    const sample = Math.max(-1, Math.min(1, (tone * (1 - noiseMix) + noise * noiseMix) * gain * attack * release * pulse));
    data.writeInt16LE(Math.round(sample * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.concat([header, data]));
}

for (const entry of Object.entries(presets)) wav(entry[0], entry[1]);
