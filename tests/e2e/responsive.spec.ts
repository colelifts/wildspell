import { expect, test } from "@playwright/test";

const viewports = [
  { name: "qhd", width: 2560, height: 1440 },
  { name: "ultrawide", width: 3000, height: 1200 },
  { name: "laptop", width: 1366, height: 768 }
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} stage fills its viewport with native-density rendering`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Landscape monitor matrix runs once.");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.locator("#loading-veil")).toBeHidden();
    await page.getByTestId("start-solo").click();
    await page.getByTestId("confirm-character").click();
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveAttribute("data-match-ready", "true", { timeout: 15_000 });
    const layout = await canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement;
      const rect = target.getBoundingClientRect();
      return {
        backingWidth: target.width,
        backingHeight: target.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
        viewport: target.dataset.virtualViewport ?? ""
      };
    });
    expect(layout.cssWidth).toBeGreaterThanOrEqual(viewport.width - 2);
    expect(layout.cssHeight).toBeGreaterThanOrEqual(viewport.height - 2);
    expect(layout.backingWidth).toBeGreaterThanOrEqual(Math.floor(layout.cssWidth));
    expect(layout.backingHeight).toBeGreaterThanOrEqual(Math.floor(layout.cssHeight));
    expect(layout.viewport).toMatch(/^\d+x576@/);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `artifacts/responsive/arena-${viewport.name}.png`, fullPage: true });
  });
}
