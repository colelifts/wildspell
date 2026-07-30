import { expect, test } from "@playwright/test";

test("2K arena uses a high-density backing canvas instead of browser upscaling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One 2K proof capture is sufficient.");
  await page.setViewportSize({ width: 2048, height: 982 });
  await page.goto("/");
  await expect(page.locator("#loading-veil")).toBeHidden();
  await page.getByTestId("start-solo").click();
  await page.getByTestId("confirm-character").click();
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-match-ready", "true", { timeout: 15_000 });
  const density = await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const rect = element.getBoundingClientRect();
    return { backingWidth: canvasElement.width, backingHeight: canvasElement.height, cssWidth: rect.width, cssHeight: rect.height };
  });
  expect(density.backingWidth).toBeGreaterThanOrEqual(Math.floor(density.cssWidth));
  expect(density.backingHeight).toBeGreaterThanOrEqual(Math.floor(density.cssHeight));
  await page.screenshot({ path: "artifacts/clarity/arena-2k.png", fullPage: true });
});
