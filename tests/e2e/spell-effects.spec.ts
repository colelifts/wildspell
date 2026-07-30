import { expect, test } from "@playwright/test";

const spells = ["arsonist", "freeze", "whirlwind", "draw2", "wild4"] as const;

for (const spell of spells) {
  test(`${spell} has an arena-scale cinematic proof frame`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One desktop cinematic proof matrix is sufficient.");
    await page.goto(`/?spell=${spell}`);
    await expect(page.locator("#loading-veil")).toBeHidden();
    await page.getByTestId("start-solo").click();
    await page.getByTestId("confirm-character").click();
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveAttribute("data-spell-state", `active:${spell}`, { timeout: 15_000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `artifacts/spells/${spell}.png`, fullPage: true });
    await expect(canvas).toHaveAttribute("data-spell-state", `complete:${spell}`, { timeout: 5_000 });
  });
}
