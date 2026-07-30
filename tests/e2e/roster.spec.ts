import { expect, test } from "@playwright/test";

test("all seven duelists preview correctly and a new fighter enters the arena", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "WILDSPELL" })).toBeVisible();
  await page.getByTestId("start-solo").click();

  const roster = ["KENPACHI", "HISOKA", "GOJO", "MOB", "HIT", "RYUK", "MAKI"];
  for (const name of roster) {
    await page.getByRole("radio", { name }).click();
    await expect(page.locator("#selected-fighter-name")).toHaveText(name);
    await expect(page.locator(".fighter-side-player .fighter-art.active")).toHaveAttribute("aria-label", name);
    await expect(page.locator("#selected-trait-name")).not.toBeEmpty();
  }

  await expect(page.getByTestId("confirm-character")).toBeEnabled();
  await page.getByTestId("confirm-character").click();
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-match-ready", "true", { timeout: 15_000 });
  await expect(canvas).toHaveAttribute("data-character-id", "maki");
});
