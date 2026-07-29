import { expect, test, type Page } from "@playwright/test";
import { createGame } from "../../src/game/rules/reducer";
import type { Card, GameState, Ruleset } from "../../src/game/rules/types";

const databaseRoot = "https://wildspell-default-rtdb.firebaseio.com";

async function patchRoom(code: string, patch: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${databaseRoot}/rooms/${code}.json`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch)
  });
  expect(response.ok).toBe(true);
}

async function nextServerRevision(code: string): Promise<number> {
  const response = await fetch(`${databaseRoot}/rooms/${code}/state/syncRevision.json`, { cache: "no-store" });
  expect(response.ok).toBe(true);
  return Number(await response.json() ?? 0) + 1;
}

async function deleteQueueIfCode(ruleset: Ruleset, code: string): Promise<void> {
  const url = `${databaseRoot}/matchmaking/${ruleset}.json`;
  const current = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
  if (!current.ok) return;
  const entry = await current.json() as { code?: string } | null;
  const etag = current.headers.get("etag");
  if (entry?.code !== code || !etag) return;
  await fetch(url, { method: "DELETE", headers: { "if-match": etag } });
}

async function openOnline(page: Page, name: string): Promise<void> {
  await page.goto("/");
  await expect(page.locator("#loading-veil")).toBeHidden();
  await page.getByRole("button", { name: "ONLINE BETA" }).click();
  await page.locator("#online-name").fill(name);
}

function testCard(id: string, color: Card["color"], kind: Card["kind"], value?: number): Card {
  return { id, color, kind, ...(value == null ? {} : { value }) };
}

function controlledState(): GameState {
  const state = createGame(["Cole", "Gabby"], "wild", "normal", 424242);
  state.hands = [
    [testCard("host-chaos", "wild", "wild4"), testCard("host-arcane", "red", "draw2"), testCard("host-red-7", "red", "number", 7), testCard("host-green-2", "green", "number", 2)],
    [testCard("guest-arcane", "blue", "draw2"), testCard("guest-blue-4", "blue", "number", 4), testCard("guest-yellow-8", "yellow", "number", 8)]
  ];
  state.discard = [testCard("top-red-3", "red", "number", 3)];
  state.currentColor = "red";
  state.turn = 0;
  state.turnNumber = 1;
  state.drawStack = { amount: 0, kind: null };
  state.drawnCardId = null;
  state.phase = "playing";
  state.challengeOwner = null;
  state.roundWinner = null;
  state.events = [{ type: "turn", actor: 0 }];
  return state;
}

async function answerArcaneClash(page: Page): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const portrait = box!.height > box!.width;
  await page.waitForTimeout(900);
  for (let round = 0; round < 5; round += 1) {
    await page.mouse.click(
      box!.x + box!.width * (portrait ? 0.208 : 0.385),
      box!.y + box!.height * (portrait ? 0.713 : 0.667)
    );
    await page.waitForTimeout(360);
  }
}

test("two browsers synchronize color, mixed stacks, reconnect, challenge, and round transition", async ({ browser, page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`host: ${error.message}`));
  const guestContext = await browser.newContext({ viewport: page.viewportSize() ?? { width: 1280, height: 720 } });
  let guest = await guestContext.newPage();
  guest.on("pageerror", (error) => errors.push(`guest: ${error.message}`));
  let code = "";

  try {
    await openOnline(page, "Cole");
    await page.getByRole("button", { name: "CREATE ROOM" }).click();
    await expect(page.locator("#online-lobby")).toBeVisible({ timeout: 15_000 });
    code = await page.locator("#room-code").inputValue();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    await guest.goto(`/?room=${code}`);
    await expect(guest.locator("#loading-veil")).toBeHidden();
    await guest.locator("#online-name").fill("Gabby");
    await guest.getByRole("button", { name: "JOIN PRIVATE DUEL" }).click();

    const hostCanvas = page.locator("canvas");
    let guestCanvas = guest.locator("canvas");
    await expect(hostCanvas).toHaveAttribute("data-online-room", code, { timeout: 20_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-room", code, { timeout: 20_000 });
    await expect(hostCanvas).toHaveAttribute("data-online-slot", "0");
    await expect(guestCanvas).toHaveAttribute("data-online-slot", "1");

    let revision = await nextServerRevision(code);
    const initialState = controlledState();
    initialState.syncRevision = revision;
    await patchRoom(code, { state: initialState, revision });
    await expect(hostCanvas).toHaveAttribute("data-online-revision", String(revision), { timeout: 15_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-revision", String(revision), { timeout: 15_000 });

    await page.getByRole("button", { name: /Play Wild Chaos \+4/i }).focus();
    await page.keyboard.press("Enter");
    await page.locator('#color-modal:not(.hidden) [data-color="blue"]').click();
    await expect(hostCanvas).toHaveAttribute("data-online-color", "blue", { timeout: 15_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-color", "blue", { timeout: 15_000 });
    await expect(hostCanvas).toHaveAttribute("data-online-stack", "4", { timeout: 15_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-stack", "4", { timeout: 15_000 });

    await guest.waitForTimeout(2_200);
    await guest.getByRole("button", { name: /Play blue Arcane \+2/i }).focus();
    await guest.keyboard.press("Enter");
    await expect(hostCanvas).toHaveAttribute("data-online-stack", "6", { timeout: 15_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-stack", "6", { timeout: 15_000 });
    await page.screenshot({ path: `artifacts/online/host-${testInfo.project.name}.png`, fullPage: true });
    await guest.screenshot({ path: `artifacts/online/guest-${testInfo.project.name}.png`, fullPage: true });

    const stackedRevision = Number(await guestCanvas.getAttribute("data-online-revision"));
    await guest.close();
    guest = await guestContext.newPage();
    guest.on("pageerror", (error) => errors.push(`reconnect: ${error.message}`));
    await guest.goto(`/?room=${code}`);
    await expect(guest.locator("#loading-veil")).toBeHidden();
    await guest.locator("#online-name").fill("Gabby");
    await guest.getByRole("button", { name: "JOIN PRIVATE DUEL" }).click();
    guestCanvas = guest.locator("canvas");
    await expect(guestCanvas).toHaveAttribute("data-online-slot", "1", { timeout: 20_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-stack", "6", { timeout: 20_000 });
    await expect.poll(async () => Number(await guestCanvas.getAttribute("data-online-revision")), { timeout: 15_000 }).toBeGreaterThanOrEqual(stackedRevision);
    await guest.screenshot({ path: `artifacts/online/reconnect-${testInfo.project.name}.png`, fullPage: true });

    const challengeState = controlledState();
    challengeState.phase = "challenge";
    challengeState.challengeOwner = 0;
    challengeState.turn = 1;
    challengeState.turnNumber = 2;
    challengeState.drawStack = { amount: 0, kind: null };
    challengeState.events = [{ type: "final-card", actor: 0, success: true }];
    revision = await nextServerRevision(code);
    challengeState.syncRevision = revision;
    await patchRoom(code, {
      state: challengeState,
      revision,
      challenge: { id: "1-2-0", type: "arcane-clash", startedAt: Date.now(), scores: {} }
    });
    await expect(hostCanvas).toHaveAttribute("data-challenge-state", "active:arcane-clash", { timeout: 15_000 });
    await expect(guestCanvas).toHaveAttribute("data-challenge-state", "active:arcane-clash", { timeout: 15_000 });
    await Promise.all([answerArcaneClash(page), answerArcaneClash(guest)]);
    await expect(hostCanvas).toHaveAttribute("data-online-phase", "playing", { timeout: 20_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-phase", "playing", { timeout: 20_000 });
    await expect.poll(async () => {
      const [hostRevision, guestRevision] = await Promise.all([
        hostCanvas.getAttribute("data-online-revision"),
        guestCanvas.getAttribute("data-online-revision")
      ]);
      return hostRevision === guestRevision;
    }, { timeout: 15_000 }).toBe(true);

    const roundState = controlledState();
    roundState.phase = "round-over";
    roundState.roundWinner = 0;
    roundState.scores = [55, 20];
    roundState.events = [{ type: "round-won", actor: 0 }];
    const observedRevision = Math.max(
      Number(await hostCanvas.getAttribute("data-online-revision")),
      Number(await guestCanvas.getAttribute("data-online-revision"))
    );
    revision = Math.max(await nextServerRevision(code), observedRevision + 1);
    roundState.syncRevision = revision;
    await patchRoom(code, { state: roundState, revision, challenge: null });
    const seededRound = await (await fetch(`${databaseRoot}/rooms/${code}.json`, { cache: "no-store" })).json() as { revision: number; state: GameState };
    expect(seededRound.revision).toBe(revision);
    expect(seededRound.state.phase).toBe("round-over");
    await expect(hostCanvas).toHaveAttribute("data-online-round-result", "1", { timeout: 15_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-round-result", "1", { timeout: 15_000 });
    await expect(hostCanvas).toHaveAttribute("data-online-round", "2", { timeout: 12_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-round", "2", { timeout: 12_000 });
    await expect(hostCanvas).toHaveAttribute("data-online-phase", "playing", { timeout: 12_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-phase", "playing", { timeout: 12_000 });
    expect(errors).toEqual([]);
  } finally {
    await guestContext.close();
    if (code) await fetch(`${databaseRoot}/rooms/${code}.json`, { method: "DELETE" });
  }
});

test("Quick Match atomically pairs two simultaneous browsers", async ({ browser, page }, testInfo) => {
  test.setTimeout(60_000);
  const ruleset: Ruleset = testInfo.project.name === "desktop" ? "classic" : "wild";
  const guestContext = await browser.newContext({ viewport: page.viewportSize() ?? { width: 1280, height: 720 } });
  const guest = await guestContext.newPage();
  let code = "";
  try {
    await Promise.all([openOnline(page, "Cole"), openOnline(guest, "Gabby")]);
    await page.locator("#ruleset").evaluate((element, value) => {
      (element as HTMLSelectElement).value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, ruleset);
    await guest.locator("#ruleset").evaluate((element, value) => {
      (element as HTMLSelectElement).value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, ruleset);
    await Promise.all([
      page.getByRole("button", { name: "QUICK MATCH" }).click(),
      guest.getByRole("button", { name: "QUICK MATCH" }).click()
    ]);
    const hostCanvas = page.locator("canvas");
    const guestCanvas = guest.locator("canvas");
    await expect(hostCanvas).toHaveAttribute("data-online-room", /^[A-Z2-9]{6}$/, { timeout: 25_000 });
    await expect(guestCanvas).toHaveAttribute("data-online-room", /^[A-Z2-9]{6}$/, { timeout: 25_000 });
    code = (await hostCanvas.getAttribute("data-online-room")) ?? "";
    expect(await guestCanvas.getAttribute("data-online-room")).toBe(code);
    expect(new Set([await hostCanvas.getAttribute("data-online-slot"), await guestCanvas.getAttribute("data-online-slot")])).toEqual(new Set(["0", "1"]));
  } finally {
    await guestContext.close();
    if (code) {
      await fetch(`${databaseRoot}/rooms/${code}.json`, { method: "DELETE" });
      await deleteQueueIfCode(ruleset, code);
    }
  }
});
