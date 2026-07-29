import { expect, test } from "@playwright/test";

test("opens the rebuilt menu and enters the Phaser arena", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#loading-veil")).toBeHidden();
  await expect(page.getByRole("heading", { name: "WILDSPELL" })).toBeVisible();
  await page.screenshot({ path: `artifacts/rebuild/menu-${testInfo.project.name}.png`, fullPage: true });
  await page.getByTestId("start-solo").click();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-match-ready", "true", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "FINAL CARD!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "END TURN" })).toHaveCount(0);
  // The premium character and arena textures are intentionally high resolution.
  // Wait for Phaser's first fully rendered match frame before capturing evidence.
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `artifacts/rebuild/arena-${testInfo.project.name}.png`, fullPage: true });
  expect(pageErrors).toEqual([]);
});
