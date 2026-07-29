import { get, onValue, ref, remove, runTransaction, serverTimestamp, set, update, type Unsubscribe } from "firebase/database";
import { advanceRound, createGame, reduceGame, resolveChallenge, restartMatch } from "../rules/reducer";
import type { GameCommand, GameState, Ruleset } from "../rules/types";
import { getFirebaseServices } from "./firebase";
import { PROTOCOL_VERSION, type RoomPlayer, type RoomRecord } from "./protocol";
import { attachPresence } from "./presence";
import { hydrateGameState } from "./perspective";

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function roomSeed(code: string, createdAt: number): number {
  let seed = createdAt >>> 0;
  for (const character of code) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  return seed || 1;
}

function challengeType(turnNumber: number): "rune-memory" | "spell-timing" | "arcane-clash" {
  return (["rune-memory", "spell-timing", "arcane-clash"] as const)[turnNumber % 3]!;
}

function playerSlot(room: RoomRecord, uid: string): 0 | 1 | null {
  if (room.players?.[0]?.uid === uid) return 0;
  if (room.players?.[1]?.uid === uid) return 1;
  return null;
}

async function incrementRevision(code: string): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  await runTransaction(ref(services.database, `rooms/${code}/revision`), (value: number | null) => (value ?? 0) + 1);
}

export interface RoomSession {
  code: string;
  slot: 0 | 1;
  uid: string;
  stopPresence: () => void;
}

export async function createRoom(name: string, ruleset: Ruleset): Promise<RoomSession> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const code = makeCode();
  const now = Date.now();
  const room: RoomRecord = {
    version: PROTOCOL_VERSION,
    hostUid: services.user.uid,
    ruleset,
    status: "waiting",
    createdAt: now,
    updatedAt: now,
    players: { 0: { uid: services.user.uid, name, joinedAt: now } },
    revision: 0
  };
  await set(ref(services.database, `rooms/${code}`), room);
  const stopPresence = await attachPresence(services.database, code, 0, services.user.uid);
  return { code, slot: 0, uid: services.user.uid, stopPresence };
}

export async function joinRoom(codeInput: string, name: string): Promise<RoomSession> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const code = codeInput.trim().toUpperCase();
  if (!code) throw new Error("Enter a room sigil.");
  const roomRef = ref(services.database, `rooms/${code}`);
  const initial = (await get(roomRef)).val() as RoomRecord | null;
  if (!initial || initial.version !== PROTOCOL_VERSION || !initial.players?.[0]) throw new Error("Room not found.");

  let slot = playerSlot(initial, services.user.uid);
  if (slot == null) {
    const player: RoomPlayer = { uid: services.user.uid, name, joinedAt: Date.now() };
    const claim = await runTransaction(ref(services.database, `rooms/${code}/players/1`), (current: RoomPlayer | null) => current ?? player);
    const claimed = claim.snapshot.val() as RoomPlayer | null;
    if (!claim.committed || claimed?.uid !== services.user.uid) throw new Error("Room is already full.");
    slot = 1;
  } else await update(ref(services.database, `rooms/${code}/players/${slot}`), { name });

  const latest = (await get(roomRef)).val() as RoomRecord;
  const first = latest.players?.[0];
  const second = latest.players?.[1];
  if (!first || !second) throw new Error("The rival seat could not be claimed.");
  const stateResult = await runTransaction(ref(services.database, `rooms/${code}/state`), (state: GameState | null) => state ?? createGame([first.name, second.name], latest.ruleset, "normal", roomSeed(code, latest.createdAt)));
  if (!stateResult.committed) throw new Error("The online match could not start.");
  await update(roomRef, { status: "playing", updatedAt: Date.now() });
  if (!latest.state) await incrementRevision(code);
  const stopPresence = await attachPresence(services.database, code, slot, services.user.uid);
  return { code, slot, uid: services.user.uid, stopPresence };
}

export async function commitRoomCommand(session: RoomSession, command: GameCommand): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const room = (await get(ref(services.database, `rooms/${session.code}`))).val() as RoomRecord | null;
  if (!room || playerSlot(room, session.uid) !== session.slot || command.player !== session.slot) throw new Error("Your room seat is no longer valid.");
  let rejection = "That move is no longer legal.";
  const transaction = await runTransaction(ref(services.database, `rooms/${session.code}/state`), (state: GameState | null) => {
    if (!state) return;
    const result = reduceGame(hydrateGameState(state), command);
    if (!result.accepted) {
      rejection = result.reason ?? rejection;
      return;
    }
    return result.state;
  });
  const committedStateRaw = transaction.snapshot.val() as GameState | null;
  const committedState = committedStateRaw ? hydrateGameState(committedStateRaw) : null;
  if (!transaction.committed || !committedState) throw new Error(rejection);
  await incrementRevision(session.code);
  await update(ref(services.database, `rooms/${session.code}`), {
    updatedAt: Date.now(),
    status: committedState.phase === "match-over" ? "complete" : "playing"
  });
  if (committedState.phase === "challenge") {
    const id = `${committedState.roundNumber}-${committedState.turnNumber}-${committedState.challengeOwner}`;
    await set(ref(services.database, `rooms/${session.code}/challenge`), { id, type: challengeType(committedState.turnNumber), startedAt: Date.now(), scores: {} });
  } else await remove(ref(services.database, `rooms/${session.code}/challenge`));
}

export async function submitChallengeScore(session: RoomSession, score: number): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const challengeRef = ref(services.database, `rooms/${session.code}/challenge`);
  const challenge = (await get(challengeRef)).val() as RoomRecord["challenge"];
  if (!challenge) throw new Error("That challenge has already resolved.");
  await set(ref(services.database, `rooms/${session.code}/challenge/scores/${session.slot}`), Math.max(0, Math.round(score)));
  const scores = (await get(ref(services.database, `rooms/${session.code}/challenge/scores`))).val() as Partial<Record<0 | 1, number>> | null;
  if (scores?.[0] == null || scores?.[1] == null) return;
  const stateTransaction = await runTransaction(ref(services.database, `rooms/${session.code}/state`), (state: GameState | null) => {
    if (!state || state.phase !== "challenge") return;
    return resolveChallenge(hydrateGameState(state), scores[0]!, scores[1]!);
  });
  if (stateTransaction.committed) {
    await remove(challengeRef);
    await incrementRevision(session.code);
  }
}

export async function resolveRoomChallengeTimeout(session: RoomSession): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  const challengeRef = ref(services.database, `rooms/${session.code}/challenge`);
  const challenge = (await get(challengeRef)).val() as RoomRecord["challenge"];
  if (!challenge || Date.now() - challenge.startedAt < 10_000) return;
  const scores = challenge.scores ?? {};
  const transaction = await runTransaction(ref(services.database, `rooms/${session.code}/state`), (state: GameState | null) => {
    if (!state || state.phase !== "challenge") return;
    return resolveChallenge(hydrateGameState(state), scores[0] ?? 0, scores[1] ?? 0);
  });
  if (transaction.committed) {
    await remove(challengeRef);
    await incrementRevision(session.code);
  }
}

export async function advanceRoomRound(session: RoomSession): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const transaction = await runTransaction(ref(services.database, `rooms/${session.code}/state`), (state: GameState | null) => state?.phase === "round-over" ? advanceRound(hydrateGameState(state)) : undefined);
  if (transaction.committed) await incrementRevision(session.code);
}

export async function restartRoomMatch(session: RoomSession): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const transaction = await runTransaction(ref(services.database, `rooms/${session.code}/state`), (state: GameState | null) => state?.phase === "match-over" ? restartMatch(hydrateGameState(state)) : undefined);
  if (transaction.committed) {
    await update(ref(services.database, `rooms/${session.code}`), { status: "playing", updatedAt: Date.now() });
    await incrementRevision(session.code);
  }
}

export async function roomExists(code: string): Promise<boolean> {
  const services = await getFirebaseServices();
  if (!services) return false;
  return (await get(ref(services.database, `rooms/${code.toUpperCase()}`))).exists();
}

export async function subscribeRoom(code: string, listener: (room: RoomRecord | null) => void): Promise<Unsubscribe> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  return onValue(ref(services.database, `rooms/${code.toUpperCase()}`), (snapshot) => listener(snapshot.val() as RoomRecord | null));
}

export const firebaseServerTime = serverTimestamp;
