import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const [sourcePath, previewPath, sheetPath] = process.argv.slice(2);
if (!sourcePath || !previewPath || !sheetPath) {
  throw new Error("Usage: node build-portrait-idle.mjs <source.png> <preview.webp> <sheet.webp>");
}

const frameSize = 512;
const artSize = 500;
const frameCount = 48;
const columns = 8;
const rows = 6;
const tau = Math.PI * 2;

const source = await sharp(sourcePath)
  .resize(artSize, artSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const metadata = await sharp(source).metadata();
if (!metadata.hasAlpha) throw new Error("The portrait must contain an alpha channel.");

function effectsSvg(phase) {
  const pulse = 0.72 + Math.sin(phase) * 0.18;
  const eyeGlint = Math.max(0, Math.sin(phase - 0.45)) ** 24;
  const hairShimmer = 0.08 + Math.max(0, Math.sin(phase + 0.6)) * 0.11;
  const particles = Array.from({ length: 22 }, (_, index) => {
    const angle = phase * (index % 2 ? 0.8 : -0.55) + index * 1.91;
    const radius = 176 + (index % 5) * 15;
    const x = 256 + Math.cos(angle) * radius;
    const y = 278 + Math.sin(angle) * radius * 0.82;
    const dot = 1.1 + (index % 4) * 0.6;
    const opacity = 0.18 + (index % 6) * 0.09;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dot}" fill="#ffd8ff" opacity="${opacity}"/>`;
  }).join("");

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="soft"><feGaussianBlur stdDeviation="2.5"/></filter>
        <linearGradient id="ring" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#8e24cf" stop-opacity="0"/>
          <stop offset=".5" stop-color="#ff67ef" stop-opacity=".85"/>
          <stop offset="1" stop-color="#fff0ff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <ellipse cx="256" cy="278" rx="212" ry="204" fill="#cf35ff" opacity="${0.04 * pulse}" filter="url(#blur)"/>
      <ellipse cx="256" cy="278" rx="219" ry="207" fill="none" stroke="url(#ring)" stroke-width="8"
        stroke-linecap="round" stroke-dasharray="72 58" stroke-dashoffset="${Math.round(-phase * 42)}"
        opacity="${0.22 * pulse}" filter="url(#soft)"/>
      ${particles}
      <path d="M156 111 C206 61, 303 39, 369 96" fill="none" stroke="#ff557b" stroke-width="18"
        stroke-linecap="round" opacity="${hairShimmer}" filter="url(#blur)"/>
      <g opacity="${eyeGlint}">
        <circle cx="291" cy="195" r="13" fill="#ffdfff" opacity=".32" filter="url(#blur)"/>
        <path d="M278 195 H304 M291 182 V208" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="291" cy="195" r="3" fill="#ffffff"/>
      </g>
    </svg>
  `);
}

const frames = [];
for (let index = 0; index < frameCount; index += 1) {
  const phase = (index / frameCount) * tau;
  const breathe = Math.sin(phase);
  const size = Math.round(artSize * (1 + breathe * 0.004));
  const portrait = await sharp(source).resize(size, size, { fit: "fill" }).png().toBuffer();
  const offset = Math.round((frameSize - size) / 2);
  const frame = await sharp({
    create: {
      width: frameSize,
      height: frameSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: effectsSvg(phase), top: 0, left: 0, blend: "screen" },
      { input: portrait, top: offset, left: offset }
    ])
    .png()
    .toBuffer();
  frames.push(frame);
}

const previewSize = 384;
const previewFrames = await Promise.all(
  frames.filter((_frame, index) => index % 2 === 0).map((frame) =>
    sharp(frame).resize(previewSize, previewSize).png().toBuffer()
  )
);
const previewColumns = 6;
const previewRows = 4;
await sharp({
  create: {
    width: previewSize * previewColumns,
    height: previewSize * previewRows,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
  .composite(previewFrames.map((input, index) => ({
    input,
    left: (index % previewColumns) * previewSize,
    top: Math.floor(index / previewColumns) * previewSize
  })))
  .webp({ quality: 88, alphaQuality: 100, effort: 5 })
  .toFile(previewPath);

await sharp({
  create: {
    width: frameSize * columns,
    height: frameSize * rows,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
  .composite(frames.map((input, index) => ({
    input,
    left: (index % columns) * frameSize,
    top: Math.floor(index / columns) * frameSize
  })))
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(sheetPath);

console.log(JSON.stringify({
  preview: { path: path.resolve(previewPath), frames: previewFrames.length },
  sheet: { path: path.resolve(sheetPath), frames: frameCount },
  frame: { width: frameSize, height: frameSize, fps: 12 }
}, null, 2));
