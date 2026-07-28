import { get, onValue, push, ref, runTransaction, serverTimestamp, set, type Unsubscribe } from "firebase/database";
import { getFirebaseServices } from "./firebase";
import { PROTOCOL_VERSION, type CommandEnvelope, type RoomRecord } from "./protocol";
import { attachPresence } from "./presence";
import type { GameCommand, Ruleset } from "../rules/types";

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export interface RoomSession {
  code: string;
  slot: 0 | 1;
  uid: string;
  stopPresence: () => void;
}

export async function createRoom(name: string, ruleset: Ruleset): Promise<RoomSession> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase environment values are not configured.");
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
  if (!services) throw new Error("Firebase environment values are not configured.");
  const code = codeInput.trim().toUpperCase();
  const roomRef = ref(services.database, `rooms/${code}`);
  const result = await runTransaction(roomRef, (room: RoomRecord | null) => {
    if (!room || room.players[1]) return;
    room.players[1] = { uid: services.user.uid, name, joinedAt: Date.now() };
    room.status = "playing";
    room.updatedAt = Date.now();
    return room;
  });
  if (!result.committed) throw new Error("Room not found or already full.");
  const stopPresence = await attachPresence(services.database, code, 1, services.user.uid);
  return { code, slot: 1, uid: services.user.uid, stopPresence };
}

export async function enqueueCommand(session: RoomSession, command: GameCommand, expectedRevision: number): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  const commandRef = push(ref(services.database, `rooms/${session.code}/commands`));
  const envelope: CommandEnvelope = {
    id: commandRef.key!,
    roomCode: session.code,
    playerUid: session.uid,
    expectedRevision,
    createdAt: Date.now(),
    command
  };
  await set(commandRef, envelope);
}

export async function roomExists(code: string): Promise<boolean> {
  const services = await getFirebaseServices();
  if (!services) return false;
  return (await get(ref(services.database, `rooms/${code.toUpperCase()}`))).exists();
}

export async function subscribeRoom(code: string, listener: (room: RoomRecord | null) => void): Promise<Unsubscribe> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is unavailable.");
  return onValue(ref(services.database, `rooms/${code}`), (snapshot) => listener(snapshot.val() as RoomRecord | null));
}

export const firebaseServerTime = serverTimestamp;
