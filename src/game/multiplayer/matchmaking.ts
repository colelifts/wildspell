import { get, ref, remove, set } from "firebase/database";
import type { Ruleset } from "../rules/types";
import { getFirebaseServices } from "./firebase";
import { createRoom, joinRoom, roomExists, type RoomSession } from "./roomService";

interface QueueEntry {
  code: string;
  uid: string;
  createdAt: number;
}

const MAX_QUEUE_AGE_MS = 90_000;

export async function findQuickMatch(name: string, ruleset: Ruleset): Promise<RoomSession> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase environment values are not configured.");
  const queueRef = ref(services.database, `matchmaking/${ruleset}`);
  const waiting = (await get(queueRef)).val() as QueueEntry | null;
  if (waiting && waiting.uid !== services.user.uid && Date.now() - waiting.createdAt < MAX_QUEUE_AGE_MS && await roomExists(waiting.code)) {
    try {
      const session = await joinRoom(waiting.code, name);
      await remove(queueRef);
      return session;
    } catch {
      await remove(queueRef);
    }
  }
  const session = await createRoom(name, ruleset);
  await set(queueRef, { code: session.code, uid: session.uid, createdAt: Date.now() } satisfies QueueEntry);
  return session;
}
