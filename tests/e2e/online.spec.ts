import { expect, test } from "@playwright/test";

test("two browsers create, join, and synchronize a legal turn", async ({ browser, page }, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`host: ${error.message}`));
  const guestContext = await browser.newContext({ viewport: page.viewportSize() ?? { width: 1280, height: 720 } });
  let guest = await guestContext.newPage();
  guest.on("pageerror", (error) => errors.push(`guest: ${error.message}`));
  let code = "";

  try {
    await page.goto("/");
    await expect(page.locator("#loading-veil")).toBeHidden();
    await page.getByRole("button", { name: "ONLINE BETA" }).click();
    await page.locator("#online-name").fill("Cole");
    await page.getByRole("button", { name: "CREATE ROOM" }).click();
    await expect(page.locator("#online-lobby")).toBeVisible({ timeout: 15_000 });
    code = await page.locator("#room-code").inputValue();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    await guest.goto(`/?room=${code}`);
    await expect(guest.locator("#loading-veil")).toBeHidden();
    await guest.locator("#online-name").fill("Gabby");
    await guest.getByRole("button", { name: "JOIN PRIVATE DUEL" }).click();
    await expect(guest.locator("#online-status")).toContainText("Synchronizing", { timeout: 15_000 });
    await expect(page.locator("#lobby-player-1")).toHaveText("Gabby", { timeout: 15_000 });

    const hostCanvas = page.locator("canvas");
    const guestCanvas = guest.locator("canvas");
    await expect(hostCanvas).toHaveAttribute("data-online-room", code, { timeout: 20_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-room", code, { timeout: 20_000 });
    await expect(hostCanvas).toHaveAttribute("data-online-slot", "0");
    await expect(guestCanvas).toHaveAttribute("data-online-slot", "1");

    await expect.poll(async () => {
      const hostMoves = await page.locator("#accessible-hand button:enabled").count();
      const guestMoves = await guest.locator("#accessible-hand button:enabled").count();
      return hostMoves + guestMoves;
    }, { timeout: 15_000 }).toBeGreaterThan(0);

    const hostMoves = await page.locator("#accessible-hand button:enabled").count();
    const active = hostMoves ? page : guest;
    const passive = hostMoves ? guest : page;
    const activeCanvas = active.locator("canvas");
    const passiveCanvas = passive.locator("canvas");
    const beforeRevision = Number(await activeCanvas.getAttribute("data-online-revision"));
    await active.locator("#accessible-hand button:enabled").first().focus();
    await active.keyboard.press("Enter");
    const colorModal = active.locator("#color-modal:not(.hidden)");
    if (await colorModal.count()) await colorModal.locator('[data-color="red"]').click();

    await expect.poll(async () => Number(await activeCanvas.getAttribute("data-online-revision")), { timeout: 15_000 }).toBeGreaterThan(beforeRevision);
    await expect.poll(async () => await passiveCanvas.getAttribute("data-online-revision"), { timeout: 15_000 }).toBe(await activeCanvas.getAttribute("data-online-revision"));
    await page.screenshot({ path: `artifacts/online/host-${testInfo.project.name}.png`, fullPage: true });
    await guest.screenshot({ path: `artifacts/online/guest-${testInfo.project.name}.png`, fullPage: true });

    const syncedRevision = Number(await guestCanvas.getAttribute("data-online-revision"));
    await guest.close();
    guest = await guestContext.newPage();
    guest.on("pageerror", (error) => errors.push(`reconnect: ${error.message}`));
    await guest.goto(`/?room=${code}`);
    await expect(guest.locator("#loading-veil")).toBeHidden();
    await guest.locator("#online-name").fill("Gabby");
    await guest.getByRole("button", { name: "JOIN PRIVATE DUEL" }).click();
    const reconnectCanvas = guest.locator("canvas");
    await expect(reconnectCanvas).toHaveAttribute("data-online-slot", "1", { timeout: 20_000 });
    await expect.poll(async () => Number(await reconnectCanvas.getAttribute("data-online-revision")), { timeout: 15_000 }).toBeGreaterThanOrEqual(syncedRevision);
    await guest.screenshot({ path: `artifacts/online/reconnect-${testInfo.project.name}.png`, fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await guestContext.close();
    if (code) await fetch(`https://wildspell-default-rtdb.firebaseio.com/rooms/${code}.json`, { method: "DELETE" });
  }
});
