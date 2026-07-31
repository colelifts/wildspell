import { get, onValue, ref, remove, runTransaction, serverTimestamp, set, update, type Unsubscribe } from "firebase/database";
import { advanceRound, createGame, reduceGame, resolveChallenge, restartMatch } from "../rules/reducer";
import type { GameCommand, GameState, Ruleset } from "../rules/types";
import { getFirebaseServices } from "./firebase";
import { PROTOCOL_VERSION, type RoomPlayer, type RoomRecord } from "./protocol";
import type { CharacterId, WildSpellMode } from "../events";
import type { KnockoutInput, KnockoutState } from "../knockout/types";
import { createKnockoutState } from "../knockout/simulation";
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

export interface RoomSession {
  code: string;
  slot: 0 | 1;
  uid: string;
  stopPresence: () => void;
}

export async function createRoom(name: string, ruleset: Ruleset, characterId: CharacterId, gameMode: WildSpellMode = "final-draw"): Promise<RoomSession> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const code = makeCode();
  const now = Date.now();
  const room: RoomRecord = {
    version: PROTOCOL_VERSION,
    hostUid: services.user.uid,
    ruleset,
    gameMode,
    status: "waiting",
    createdAt: now,
    updatedAt: now,
    players: { 0: { uid: services.user.uid, name, characterId, joinedAt: now } },
    revision: 0
  };
  await set(ref(services.database, `rooms/${code}`), room);
  const stopPresence = await attachPresence(services.database, code, 0, services.user.uid);
  return { code, slot: 0, uid: services.user.uid, stopPresence };
}

export async function joinRoom(codeInput: string, name: string, characterId: CharacterId): Promise<RoomSession> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const code = codeInput.trim().toUpperCase();
  if (!code) throw new Error("Enter a room sigil.");
  const roomRef = ref(services.database, `rooms/${code}`);
  const initial = (await get(roomRef)).val() as RoomRecord | null;
  if (!initial || initial.version !== PROTOCOL_VERSION || !initial.players?.[0]) throw new Error("Room not found.");

  let slot = playerSlot(initial, services.user.uid);
  if (slot == null) {
    const player: RoomPlayer = { uid: services.user.uid, name, characterId, joinedAt: Date.now() };
    const claim = await runTransaction(ref(services.database, `rooms/${code}/players/1`), (current: RoomPlayer | null) => current ?? player);
    const claimed = claim.snapshot.val() as RoomPlayer | null;
    if (!claim.committed || claimed?.uid !== services.user.uid) throw new Error("Room is already full.");
    slot = 1;
  } else await update(ref(services.database, `rooms/${code}/players/${slot}`), { name, characterId });

  const latest = (await get(roomRef)).val() as RoomRecord;
  const first = latest.players?.[0];
  const second = latest.players?.[1];
  if (!first || !second) throw new Error("The rival seat could not be claimed.");
  if (latest.gameMode === "knockout") {
    const knockoutResult = await runTransaction(ref(services.database, `rooms/${code}/knockout`), (current: RoomRecord["knockout"] | null) => current ?? {
      state: createKnockoutState([first.characterId, second.characterId]),
      inputs: {}
    });
    if (!knockoutResult.committed) throw new Error("The online knockout could not start.");
  } else {
    const stateResult = await runTransaction(ref(services.database, `rooms/${code}/state`), (state: GameState | null) => state ?? createGame([first.name, second.name], latest.ruleset, "normal", roomSeed(code, latest.createdAt)));
    if (!stateResult.committed) throw new Error("The online match could not start.");
  }
  await update(roomRef, { status: "playing", updatedAt: Date.now() });
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
    result.state.syncRevision = (state.syncRevision ?? 0) + 1;
    return result.state;
  });
  const committedStateRaw = transaction.snapshot.val() as GameState | null;
  const committedState = committedStateRaw ? hydrateGameState(committedStateRaw) : null;
  if (!transaction.committed || !committedState) throw new Error(rejection);
  await update(ref(services.database, `rooms/${session.code}`), {
    revision: committedState.syncRevision,
    updatedAt: Date.now(),
    status: committedState.phase === "match-over" ? "complete" : "playing"
  });
  if (committedState.phase === "challenge") {
    const id = `${committedState.roundNumber}-${committedState.turnNumber}-${committedState.challengeOwner}`;
    await set(ref(services.database, `rooms/${session.code}/challenge`), { id, type: challengeType(committedState.turnNumber), startedAt: Date.now(), scores: {} });
  } else await remove(ref(services.database, `rooms/${session.code}/challenge`));
}

export async function writeKnockoutInput(session: RoomSession, input: KnockoutInput): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  await set(ref(services.database, `rooms/${session.code}/knockout/inputs/${session.slot}`), input);
}

export async function writeKnockoutSnapshot(session: RoomSession, state: KnockoutState): Promise<void> {
  if (session.slot !== 0) return;
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  await set(ref(services.database, `rooms/${session.code}/knockout/state`), state);
  await update(ref(services.database, `rooms/${session.code}`), {
    updatedAt: Date.now(),
    status: state.phase === "round-over" ? "complete" : "playing"
  });
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
    const next = resolveChallenge(hydrateGameState(state), scores[0]!, scores[1]!);
    next.syncRevision = (state.syncRevision ?? 0) + 1;
    return next;
  });
  if (stateTransaction.committed) {
    await remove(challengeRef);
    const state = stateTransaction.snapshot.val() as GameState | null;
    if (state) await update(ref(services.database, `rooms/${session.code}`), { revision: state.syncRevision, updatedAt: Date.now() });
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
    const next = resolveChallenge(hydrateGameState(state), scores[0] ?? 0, scores[1] ?? 0);
    next.syncRevision = (state.syncRevision ?? 0) + 1;
    return next;
  });
  if (transaction.committed) {
    await remove(challengeRef);
    const state = transaction.snapshot.val() as GameState | null;
    if (state) await update(ref(services.database, `rooms/${session.code}`), { revision: state.syncRevision, updatedAt: Date.now() });
  }
}

export async function advanceRoomRound(session: RoomSession): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const transaction = await runTransaction(ref(services.database, `rooms/${session.code}/state`), (state: GameState | null) => {
    if (state?.phase !== "round-over") return;
    const next = advanceRound(hydrateGameState(state));
    next.syncRevision = (state.syncRevision ?? 0) + 1;
    return next;
  });
  const state = transaction.snapshot.val() as GameState | null;
  if (transaction.committed && state) await update(ref(services.database, `rooms/${session.code}`), { revision: state.syncRevision, updatedAt: Date.now() });
}

export async function restartRoomMatch(session: RoomSession): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const transaction = await runTransaction(ref(services.database, `rooms/${session.code}/state`), (state: GameState | null) => {
    if (state?.phase !== "match-over") return;
    const next = restartMatch(hydrateGameState(state));
    next.syncRevision = (state.syncRevision ?? 0) + 1;
    return next;
  });
  if (transaction.committed) {
    const state = transaction.snapshot.val() as GameState | null;
    await update(ref(services.database, `rooms/${session.code}`), { status: "playing", revision: state?.syncRevision ?? 0, updatedAt: Date.now() });
  }
}

export async function abandonWaitingRoom(session: RoomSession): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  const roomRef = ref(services.database, `rooms/${session.code}`);
  const room = (await get(roomRef)).val() as RoomRecord | null;
  if (!room || room.hostUid !== session.uid || room.players?.[1] || room.status !== "waiting") return;
  const transaction = await runTransaction(roomRef, (current: RoomRecord | null) => {
    if (!current || current.hostUid !== session.uid || current.players?.[1] || current.status !== "waiting") return;
    return null;
  });
  if (!transaction.committed) return;
  session.stopPresence();
  await runTransaction(ref(services.database, `matchmaking/${room.gameMode ?? "final-draw"}-${room.ruleset}`), (entry: { code?: string; uid?: string } | null) => {
    if (entry?.code === session.code && entry.uid === session.uid) return null;
    return;
  });
}

export async function roomExists(code: string): Promise<boolean> {
  const services = await getFirebaseServices();
  if (!services) return false;
  return (await get(ref(services.database, `rooms/${code.toUpperCase()}`))).exists();
}

export async function subscribeRoom(code: string, listener: (room: RoomRecord | null) => void): Promise<Unsubscribe> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const roomRef = ref(services.database, `rooms/${code.toUpperCase()}`);
  let stopped = false;
  const unsubscribe = onValue(roomRef, (snapshot) => {
    if (!stopped) listener(snapshot.val() as RoomRecord | null);
  });
  const reconcile = window.setInterval(() => {
    void get(roomRef).then((snapshot) => {
      if (!stopped) listener(snapshot.val() as RoomRecord | null);
    }).catch(() => undefined);
  }, 4_000);
  return () => {
    stopped = true;
    window.clearInterval(reconcile);
    unsubscribe();
  };
}

export const firebaseServerTime = serverTimestamp;
