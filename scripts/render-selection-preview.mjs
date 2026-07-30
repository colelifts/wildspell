import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

const [
  sheetUrl,
  outputPath,
  widthArg = "400",
  heightArg = "600",
  columnsArg = "6",
  frameCountArg = "24",
  fpsArg = "6"
] = process.argv.slice(2);
if (!sheetUrl || !outputPath) {
  throw new Error("Usage: node render-selection-preview.mjs <sheet-url> <output.webm> [frame-width] [frame-height] [columns] [frame-count] [fps]");
}
const previewWidth = Number(widthArg);
const previewHeight = Number(heightArg);
const sheetColumns = Number(columnsArg);
const totalFrames = Number(frameCountArg);
const playbackFps = Number(fpsArg);

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(new URL(sheetUrl).origin);
  await page.setContent(`<!doctype html><canvas id="stage" width="${previewWidth}" height="${previewHeight}"></canvas>`);
  const base64 = await page.evaluate(async ({ source, previewWidth, previewHeight, sheetColumns, totalFrames, playbackFps }) => {
    const canvas = document.querySelector("#stage");
    const context = canvas.getContext("2d", { alpha: true });
    const image = new Image();
    image.src = source;
    await image.decode();

    const stream = canvas.captureStream(24);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise((resolve) => recorder.addEventListener("stop", resolve, { once: true }));
    recorder.start();

    const fps = playbackFps;
    const frameCount = totalFrames;
    const columns = sheetColumns;
    const frameWidth = previewWidth;
    const frameHeight = previewHeight;
    for (let frame = 0; frame < frameCount; frame += 1) {
      context.clearRect(0, 0, frameWidth, frameHeight);
      context.drawImage(
        image,
        (frame % columns) * frameWidth,
        Math.floor(frame / columns) * frameHeight,
        frameWidth,
        frameHeight,
        0,
        0,
        frameWidth,
        frameHeight
      );
      await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    }
    recorder.stop();
    await stopped;
    const bytes = new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer());
    let binary = "";
    const block = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += block) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
    }
    return btoa(binary);
  }, { source: sheetUrl, previewWidth, previewHeight, sheetColumns, totalFrames, playbackFps });
  await fs.writeFile(outputPath, Buffer.from(base64, "base64"));
  console.log(outputPath);
} finally {
  await browser.close();
}
