import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const [sourcePath, previewPath, sheetPath, themeName = "kenpachi"] = process.argv.slice(2);
if (!sourcePath || !previewPath || !sheetPath) {
  throw new Error("Usage: node build-selection-idle.mjs <source.png> <preview.webp> <sheet.webp> [kenpachi|hisoka]");
}

const frameWidth = 512;
const frameHeight = 768;
const frameCount = 48;
const columns = 8;
const rows = 6;
const frameDelay = 83;
const tau = Math.PI * 2;
const characterWidth = 500;
const characterHeight = 750;
const isHisoka = themeName.toLowerCase() === "hisoka";
const palette = isHisoka
  ? {
      particle: "#ffd7ff",
      glow: "#d530ff",
      energyMid: "#ee5bff",
      energyEnd: "#fff0ff",
      secondary: "#a876ff"
    }
  : {
      particle: "#bff9ff",
      glow: "#30bfff",
      energyMid: "#52dbff",
      energyEnd: "#e9ffff",
      secondary: "#8cecff"
    };

const source = await sharp(sourcePath)
  .resize(characterWidth, characterHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const metadata = await sharp(source).metadata();
if (!metadata.hasAlpha) throw new Error("The approved splash must contain an alpha channel.");

function auraSvg(phase) {
  const pulse = 0.72 + Math.sin(phase) * 0.16;
  const dash = Math.round(70 + Math.sin(phase) * 24);
  const glint = Math.max(0, Math.sin(phase - Math.PI * 0.08)) ** 18;
  const particles = Array.from({ length: 18 }, (_, index) => {
    const lane = (index * 83) % 470 + 21;
    const rise = ((index * 119 + (phase / tau) * 510) % 690) + 34;
    const radius = 1.2 + (index % 4) * 0.65;
    const opacity = 0.2 + (index % 5) * 0.12;
    return `<circle cx="${lane}" cy="${frameHeight - rise}" r="${radius}" fill="${palette.particle}" opacity="${opacity}"/>`;
  }).join("");
  const orbitingCards = isHisoka
    ? Array.from({ length: 3 }, (_, index) => {
        const angle = phase + index * (tau / 3);
        const x = 256 + Math.cos(angle) * (172 + index * 9);
        const y = 380 + Math.sin(angle) * (270 - index * 16);
        const rotation = (angle * 180) / Math.PI + 18;
        return `
          <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)})"
             opacity="${(0.11 + pulse * 0.06).toFixed(3)}">
            <rect x="-7" y="-11" width="14" height="22" rx="2.2"
              fill="#fff4ff" stroke="#ff8cff" stroke-width="1"/>
            <path d="M0 -4 L3 0 L0 4 L-3 0 Z" fill="#b629df"/>
          </g>`;
      }).join("")
    : "";
  const cardGlints = isHisoka
    ? [
        [161, 111, 0],
        [83, 192, 0.8],
        [422, 108, 1.6],
        [451, 239, 2.4],
        [433, 342, 3.2],
        [371, 448, 4],
        [149, 496, 4.8],
        [64, 359, 5.6]
      ].map(([x, y, offset]) => {
        const shine = Math.max(0, Math.sin(phase - offset)) ** 24;
        return `<g opacity="${shine}">
          <circle cx="${x}" cy="${y}" r="9" fill="#ffdcff" opacity=".3" filter="url(#blur)"/>
          <path d="M${x - 8} ${y} H${x + 8} M${x} ${y - 8} V${y + 8}"
            stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
        </g>`;
      }).join("")
    : "";
  const eyeX = isHisoka ? 260 : 281;
  const eyeY = isHisoka ? 98 : 101;

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth}" height="${frameHeight}" viewBox="0 0 ${frameWidth} ${frameHeight}">
      <defs>
        <filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="soft"><feGaussianBlur stdDeviation="2.5"/></filter>
        <linearGradient id="energy" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#1d70df" stop-opacity="0"/>
          <stop offset=".45" stop-color="${palette.energyMid}" stop-opacity=".95"/>
          <stop offset="1" stop-color="${palette.energyEnd}" stop-opacity=".15"/>
        </linearGradient>
      </defs>
      <ellipse cx="256" cy="416" rx="220" ry="326" fill="${palette.glow}" opacity="${0.045 * pulse}" filter="url(#blur)"/>
      <path d="M34 612 C112 516, 78 386, 178 300 S372 196, 470 88"
        fill="none" stroke="url(#energy)" stroke-width="13" stroke-linecap="round"
        stroke-dasharray="${dash} 52" stroke-dashoffset="${Math.round((phase / tau) * -240)}"
        opacity="${0.34 * pulse}" filter="url(#soft)"/>
      <path d="M492 650 C390 562, 446 438, 340 354 S170 262, 52 154"
        fill="none" stroke="${palette.secondary}" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="42 66" stroke-dashoffset="${Math.round((phase / tau) * 190)}"
        opacity="${0.28 * pulse}" filter="url(#soft)"/>
      ${particles}
      ${orbitingCards}
      ${cardGlints}
      <g opacity="${glint}">
        <circle cx="${eyeX}" cy="${eyeY}" r="12" fill="${palette.energyEnd}" opacity=".28" filter="url(#blur)"/>
        <path d="M${eyeX - 13} ${eyeY} H${eyeX + 13} M${eyeX} ${eyeY - 13} V${eyeY + 13}" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="${eyeX}" cy="${eyeY}" r="3.2" fill="#ffffff"/>
      </g>
    </svg>
  `);
}

const frames = [];
for (let index = 0; index < frameCount; index += 1) {
  const phase = (index / frameCount) * tau;
  const breathe = Math.sin(phase);
  const width = Math.round(characterWidth * (1 + breathe * 0.0018));
  const height = Math.round(characterHeight * (1 + breathe * 0.004));
  const character = await sharp(source)
    .resize(width, height, { fit: "fill" })
    .png()
    .toBuffer();
  const left = Math.round((frameWidth - width) / 2 + Math.sin(phase * 0.5) * 0.8);
  const top = frameHeight - height;
  const frame = await sharp({
    create: {
      width: frameWidth,
      height: frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: auraSvg(phase), top: 0, left: 0, blend: "screen" },
      { input: character, top, left }
    ])
    .png()
    .toBuffer();
  frames.push(frame);
}

const previewWidth = 400;
const previewHeight = 600;
const previewFrames = await Promise.all(frames.filter((_frame, index) => index % 2 === 0).map((frame) =>
  sharp(frame).resize(previewWidth, previewHeight).png().toBuffer()
));
const previewColumns = 6;
const previewRows = 4;
const previewLayers = previewFrames.map((input, index) => ({
  input,
  left: (index % previewColumns) * previewWidth,
  top: Math.floor(index / previewColumns) * previewHeight
}));
await sharp({
  create: {
    width: previewWidth * previewColumns,
    height: previewHeight * previewRows,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
  .composite(previewLayers)
  .webp({ quality: 88, alphaQuality: 100, effort: 5 })
  .toFile(previewPath);

const sheetLayers = frames.map((input, index) => ({
  input,
  left: (index % columns) * frameWidth,
  top: Math.floor(index / columns) * frameHeight
}));
await sharp({
  create: {
    width: columns * frameWidth,
    height: rows * frameHeight,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
  .composite(sheetLayers)
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(sheetPath);

const previewMeta = await sharp(previewPath, { animated: true }).metadata();
const sheetMeta = await sharp(sheetPath).metadata();
console.log(JSON.stringify({
  preview: { path: path.resolve(previewPath), width: previewMeta.width, height: previewMeta.height, frames: previewFrames.length, hasAlpha: previewMeta.hasAlpha },
  sheet: { path: path.resolve(sheetPath), width: sheetMeta.width, height: sheetMeta.height, hasAlpha: sheetMeta.hasAlpha },
  frame: { width: frameWidth, height: frameHeight, count: frameCount, fps: 12 }
}, null, 2));
