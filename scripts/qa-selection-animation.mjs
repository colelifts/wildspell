import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

const [videoUrl, outputDirectory] = process.argv.slice(2);
if (!videoUrl || !outputDirectory) {
  throw new Error("Usage: node qa-selection-animation.mjs <video-url> <output-directory>");
}

await fs.mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 720, height: 900 } });
  await page.goto(new URL(videoUrl).origin);
  await page.setContent(`
    <!doctype html>
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
      body {
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 50% 44%, #18314a 0%, #08101f 48%, #02050d 100%);
      }
      video { width: 600px; height: 800px; object-fit: contain; }
    </style>
    <video id="preview" muted playsinline></video>
  `);

  const metadata = await page.evaluate(async (source) => {
    const video = document.querySelector("#preview");
    video.src = source;
    await new Promise((resolve, reject) => {
      video.addEventListener("loadedmetadata", resolve, { once: true });
      video.addEventListener("error", () => reject(video.error), { once: true });
    });
    return {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight
    };
  }, videoUrl);

  for (const [name, time] of [["start", 0.1], ["middle", 2], ["seam", 3.8]]) {
    await page.evaluate(async ({ target }) => {
      const video = document.querySelector("#preview");
      video.currentTime = target;
      await new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
    }, { target: time });
    await page.screenshot({ path: `${outputDirectory}/kenpachi-selection-${name}.png` });
  }

  console.log(JSON.stringify(metadata));
} finally {
  await browser.close();
}
