import { expect, test } from "@playwright/test";

test("opens the rebuilt menu and enters the Phaser arena", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("#loading-veil")).toBeHidden();
  await expect(page.getByRole("heading", { name: "WILDSPELL" })).toBeVisible();
  await page.screenshot({ path: `artifacts/rebuild/menu-${testInfo.project.name}.png`, fullPage: true });
  await page.getByTestId("start-solo").click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "FINAL CARD!" })).toBeVisible();
  // The premium character and arena textures are intentionally high resolution.
  // Wait for Phaser's first fully rendered match frame before capturing evidence.
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `artifacts/rebuild/arena-${testInfo.project.name}.png`, fullPage: true });
});
