import { get, ref, runTransaction } from "firebase/database";
import type { Ruleset } from "../rules/types";
import type { CharacterId, WildSpellMode } from "../events";
import { getFirebaseServices } from "./firebase";
import { abandonWaitingRoom, createRoom, joinRoom, roomExists, type RoomSession } from "./roomService";

interface QueueEntry {
  code: string;
  uid: string;
  createdAt: number;
}

const MAX_QUEUE_AGE_MS = 90_000;

function isFresh(entry: QueueEntry | null, now = Date.now()): entry is QueueEntry {
  return Boolean(entry?.code && entry.uid && now - entry.createdAt < MAX_QUEUE_AGE_MS);
}

const queueName = (ruleset: Ruleset, mode: WildSpellMode): string => `${mode}-${ruleset}`;

async function removeIfCurrent(queue: string, candidate: QueueEntry): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  await runTransaction(ref(services.database, `matchmaking/${queue}`), (current: QueueEntry | null) => {
    if (current?.code === candidate.code && current.uid === candidate.uid) return null;
    return;
  });
}

async function joinCandidate(candidate: QueueEntry, name: string, queue: string, characterId: CharacterId): Promise<RoomSession | null> {
  if (!isFresh(candidate) || !await roomExists(candidate.code)) {
    await removeIfCurrent(queue, candidate);
    return null;
  }
  try {
    const session = await joinRoom(candidate.code, name, characterId);
    await removeIfCurrent(queue, candidate);
    return session;
  } catch {
    await removeIfCurrent(queue, candidate);
    return null;
  }
}

export async function findQuickMatch(name: string, ruleset: Ruleset, characterId: CharacterId, gameMode: WildSpellMode = "final-draw"): Promise<RoomSession> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase environment values are not configured.");
  const queue = queueName(ruleset, gameMode);
  const queueRef = ref(services.database, `matchmaking/${queue}`);
  const waiting = (await get(queueRef)).val() as QueueEntry | null;
  if (isFresh(waiting) && waiting.uid !== services.user.uid) {
    const match = await joinCandidate(waiting, name, queue, characterId);
    if (match) return match;
  }

  const ownSession = await createRoom(name, ruleset, characterId, gameMode);
  const ownEntry: QueueEntry = { code: ownSession.code, uid: ownSession.uid, createdAt: Date.now() };
  const claim = await runTransaction(queueRef, (current: QueueEntry | null) => {
    if (isFresh(current) && current.uid !== ownSession.uid) return current;
    return ownEntry;
  });
  const selected = claim.snapshot.val() as QueueEntry | null;
  if (!selected || selected.code === ownEntry.code) return ownSession;

  const match = await joinCandidate(selected, name, queue, characterId);
  if (match) {
    await abandonWaitingRoom(ownSession);
    return match;
  }

  await runTransaction(queueRef, (current: QueueEntry | null) => isFresh(current) ? current : ownEntry);
  return ownSession;
}
