import { expect, test } from "@playwright/test";

test("opens the existing WildSpell menu and records the baseline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "CREATE PRIVATE ROOM" })).toBeVisible();
  await page.getByRole("button", { name: "SOLO", exact: true }).click();
  await expect(page.getByRole("button", { name: "BATTLE SKELETON AI" })).toBeVisible();
  await page.screenshot({ path: "artifacts/baseline/menu-desktop.png", fullPage: true });
});
