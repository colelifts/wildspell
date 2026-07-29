import { expect, test } from "@playwright/test";

for (const challenge of ["rune-memory", "spell-timing", "arcane-clash"] as const) {
  test(`${challenge} opens, remains stable, and renders its active phase`, async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`/?challenge=${challenge}`);
    await expect(page.locator("#loading-veil")).toBeHidden();
    await page.getByTestId("start-solo").click();
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("data-challenge-state", `active:${challenge}`, { timeout: 12_000 });
    // Keep the capture inside each challenge's interactive window.
    await page.waitForTimeout(challenge === "rune-memory" ? 5_000 : 900);
    await page.screenshot({ path: `artifacts/challenges/${challenge}-${testInfo.project.name}.png`, fullPage: true });

    if (challenge === "rune-memory") {
      for (let index = 0; index < 5; index += 1) await page.keyboard.press("1");
    } else if (challenge === "spell-timing") {
      for (let round = 0; round < 3; round += 1) {
        await page.keyboard.press("Space");
        await page.waitForTimeout(650);
      }
    } else {
      for (let round = 0; round < 5; round += 1) {
        await page.keyboard.press("ArrowUp");
        await page.waitForTimeout(360);
      }
    }
    await expect(canvas).toHaveAttribute("data-challenge-state", new RegExp(`^complete:${challenge}:\\d+$`), { timeout: 5_000 });
    expect(pageErrors).toEqual([]);
  });
}
