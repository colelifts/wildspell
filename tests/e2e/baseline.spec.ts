import { expect, test } from "@playwright/test";

test("opens the rebuilt menu and enters the Phaser arena", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#loading-veil")).toBeHidden();
  await expect(page.getByRole("heading", { name: "WILDSPELL" })).toBeVisible();
  await page.screenshot({ path: `artifacts/rebuild/menu-${testInfo.project.name}.png`, fullPage: true });
  await page.getByTestId("start-solo").click();
  await expect(page.getByRole("heading", { name: "SELECT YOUR DUELIST" })).toBeVisible();
  await page.screenshot({ path: `artifacts/rebuild/character-select-${testInfo.project.name}.png`, fullPage: true });
  const hisoka = page.getByRole("radio", { name: /HISOKA/ });
  await hisoka.hover();
  await expect(page.locator('[data-screen="character-select"]')).toHaveAttribute("data-preview", "hisoka");
  await expect.poll(() => page.locator('[data-player-fighter="hisoka"].active').evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.95);
  const hoverTreatment = await page.locator('[data-player-fighter="hisoka"].active').evaluate((element) => ({
    opacity: Number(getComputedStyle(element).opacity),
    filter: getComputedStyle(element).filter
  }));
  expect(hoverTreatment.opacity).toBeGreaterThan(0.95);
  expect(hoverTreatment.filter).toContain("saturate(1.15)");
  await page.screenshot({ path: `artifacts/rebuild/character-select-hover-${testInfo.project.name}.png`, fullPage: true });
  await hisoka.click();
  await expect(page.locator("#selected-fighter-name")).toHaveText("HISOKA");
  await page.getByTestId("confirm-character").click();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-match-ready", "true", { timeout: 15_000 });
  await expect(canvas).toHaveAttribute("data-character-id", "hisoka");
  await expect(page.getByRole("button", { name: "FINAL CARD!" })).toBeHidden();
  await expect(page.getByRole("button", { name: "END TURN" })).toHaveCount(0);
  // The premium character and arena textures are intentionally high resolution.
  // Wait for Phaser's first fully rendered match frame before capturing evidence.
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `artifacts/rebuild/arena-${testInfo.project.name}.png`, fullPage: true });
  expect(pageErrors).toEqual([]);
});
