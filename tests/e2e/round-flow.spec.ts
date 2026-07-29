import { expect, test } from "@playwright/test";

for (const result of ["round", "match"] as const) {
  test(`${result} result presentation is readable and continues`, async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`/?result=${result}`);
    await expect(page.locator("#loading-veil")).toBeHidden();
    await page.getByTestId("start-solo").click();
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveAttribute("data-result-state", `active:${result}`, { timeout: 10_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `artifacts/results/${result}-${testInfo.project.name}.png`, fullPage: true });

    if (result === "match") {
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const portrait = box!.height > box!.width;
      await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * (portrait ? 0.642 : 0.58));
    }
    await expect(canvas).toHaveAttribute("data-result-state", `complete:${result}`, { timeout: 5_000 });
    expect(pageErrors).toEqual([]);
  });
}
