import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "phone-small", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone-landscape", width: 844, height: 390 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
  { name: "qhd", width: 2560, height: 1440 },
  { name: "ultrawide", width: 3440, height: 1440 }
] as const;

type Box = { x: number; y: number; width: number; height: number; right: number; bottom: number };

async function box(page: Page, selector: string): Promise<Box> {
  return page.locator(selector).first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
  });
}

function expectInsideViewport(item: Box, width: number, height: number, label: string): void {
  expect(item.x, `${label} left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(item.y, `${label} top edge`).toBeGreaterThanOrEqual(-0.5);
  expect(item.right, `${label} right edge`).toBeLessThanOrEqual(width + 0.5);
  expect(item.bottom, `${label} bottom edge`).toBeLessThanOrEqual(height + 0.5);
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.right - 0.5 && a.right > b.x + 0.5 && a.y < b.bottom - 0.5 && a.bottom > b.y + 0.5;
}

test("fighter select stays composed from small phones through ultrawide displays", async ({ page }) => {
  test.setTimeout(120_000);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.locator("#loading-veil")).toBeHidden();
    await page.getByTestId("start-solo").click();
    await expect(page.getByRole("heading", { name: "SELECT YOUR DUELIST" })).toBeVisible();

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      activePlayerFighters: document.querySelectorAll(".fighter-side-player .fighter-figure img.active").length,
      paintedPlayerFighters: [...document.querySelectorAll<HTMLElement>(".fighter-side-player .fighter-figure img")]
        .filter((fighter) => getComputedStyle(fighter).display !== "none").length,
      playerCards: document.querySelectorAll(".fighter-side-player .roster-card").length,
      rivalCards: document.querySelectorAll(".fighter-side-rival .rival-roster-card").length
    }));
    expect(metrics.scrollWidth, `${viewport.name} horizontal overflow`).toBe(viewport.width);
    expect(metrics.scrollHeight, `${viewport.name} vertical overflow`).toBe(viewport.height);
    expect(metrics.activePlayerFighters).toBe(1);
    expect(metrics.paintedPlayerFighters).toBe(1);
    expect(metrics.playerCards).toBe(12);
    expect(metrics.rivalCards).toBe(12);

    for (const [selector, label] of [
      [".select-back", "back button"],
      [".select-brand", "logo"],
      [".fighter-side-player .fighter-heading", "player name"],
      [".fighter-side-rival .fighter-heading", "rival name"],
      [".fighter-side-player .side-roster", "player roster"],
      [".fighter-side-rival .side-roster", "rival roster"],
      [".versus-core", "versus control"]
    ] as const) expectInsideViewport(await box(page, selector), viewport.width, viewport.height, `${viewport.name} ${label}`);

    const playerRoster = await box(page, ".fighter-side-player .side-roster");
    const rivalRoster = await box(page, ".fighter-side-rival .side-roster");
    expect(playerRoster.right, `${viewport.name} rosters collide`).toBeLessThanOrEqual(rivalRoster.x + 0.5);

    for (const side of [".fighter-side-player", ".fighter-side-rival"] as const) {
      const cards = await page.locator(`${side} .roster-card, ${side} .rival-roster-card`).evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
      }));
      cards.forEach((card, index) => expectInsideViewport(card, viewport.width, viewport.height, `${viewport.name} ${side} card ${index + 1}`));
      for (let first = 0; first < cards.length; first += 1) {
        for (let second = first + 1; second < cards.length; second += 1) {
          expect(intersects(cards[first]!, cards[second]!), `${viewport.name} ${side} cards ${first + 1}/${second + 1} overlap: ${JSON.stringify(cards[first])} / ${JSON.stringify(cards[second])}`).toBe(false);
        }
      }
    }

    const playerBanner = await box(page, ".fighter-side-player .fighter-team-banner");
    const rivalBanner = await box(page, ".fighter-side-rival .fighter-team-banner");
    expect(playerBanner.bottom, `${viewport.name} player banner overlaps roster`).toBeLessThanOrEqual(playerRoster.y + 0.5);
    expect(rivalBanner.bottom, `${viewport.name} rival banner overlaps roster`).toBeLessThanOrEqual(rivalRoster.y + 0.5);
    if (viewport.width > 680) {
      const playerHeading = await box(page, ".fighter-side-player .fighter-heading");
      const rivalHeading = await box(page, ".fighter-side-rival .fighter-heading");
      const playerTrait = await box(page, ".fighter-trait-player");
      const rivalTrait = await box(page, ".fighter-trait-rival");
      expect(playerHeading.bottom, `${viewport.name} player heading overlaps trait`).toBeLessThanOrEqual(playerTrait.y + 0.5);
      expect(rivalHeading.bottom, `${viewport.name} rival heading overlaps trait`).toBeLessThanOrEqual(rivalTrait.y + 0.5);
    }

    await page.getByRole("radio", { name: "MAKI" }).hover();
    await expect(page.locator('[data-player-fighter="maki"].active')).toBeVisible();
    await expect.poll(() => page.locator('[data-player-fighter="maki"].active').evaluate((element) => getComputedStyle(element).filter))
      .toContain("saturate(1.15)");
    await expect.poll(() => page.locator('[data-player-fighter="maki"].active').evaluate((element) => getComputedStyle(element).animationName))
      .toContain("ws-fighter-idle");
    await page.getByRole("radio", { name: "MAKI" }).click();
    await expect(page.getByTestId("confirm-character")).toBeEnabled();
    expectInsideViewport(await box(page, ".confirm-fighter"), viewport.width, viewport.height, `${viewport.name} fight button`);
    await page.waitForTimeout(450);

    await page.screenshot({ path: `artifacts/selector-matrix/${viewport.name}.png`, fullPage: false });
  }

  await page.evaluate(() => document.documentElement.classList.add("reduced-motion"));
  await expect.poll(() => page.locator(".fighter-side-player .fighter-figure img.active").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await expect.poll(() => page.locator(".fighter-side-player .fighter-figure").evaluate((element) => getComputedStyle(element, "::before").animationName)).toBe("none");
});
