import { get, ref, runTransaction } from "firebase/database";
import type { Ruleset } from "../rules/types";
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

async function removeIfCurrent(ruleset: Ruleset, candidate: QueueEntry): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;
  await runTransaction(ref(services.database, `matchmaking/${ruleset}`), (current: QueueEntry | null) => {
    if (current?.code === candidate.code && current.uid === candidate.uid) return null;
    return;
  });
}

async function joinCandidate(candidate: QueueEntry, name: string, ruleset: Ruleset): Promise<RoomSession | null> {
  if (!isFresh(candidate) || !await roomExists(candidate.code)) {
    await removeIfCurrent(ruleset, candidate);
    return null;
  }
  try {
    const session = await joinRoom(candidate.code, name);
    await removeIfCurrent(ruleset, candidate);
    return session;
  } catch {
    await removeIfCurrent(ruleset, candidate);
    return null;
  }
}

export async function findQuickMatch(name: string, ruleset: Ruleset): Promise<RoomSession> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase environment values are not configured.");
  const queueRef = ref(services.database, `matchmaking/${ruleset}`);
  const waiting = (await get(queueRef)).val() as QueueEntry | null;
  if (isFresh(waiting) && waiting.uid !== services.user.uid) {
    const match = await joinCandidate(waiting, name, ruleset);
    if (match) return match;
  }

  const ownSession = await createRoom(name, ruleset);
  const ownEntry: QueueEntry = { code: ownSession.code, uid: ownSession.uid, createdAt: Date.now() };
  const claim = await runTransaction(queueRef, (current: QueueEntry | null) => {
    if (isFresh(current) && current.uid !== ownSession.uid) return current;
    return ownEntry;
  });
  const selected = claim.snapshot.val() as QueueEntry | null;
  if (!selected || selected.code === ownEntry.code) return ownSession;

  const match = await joinCandidate(selected, name, ruleset);
  if (match) {
    await abandonWaitingRoom(ownSession);
    return match;
  }

  await runTransaction(queueRef, (current: QueueEntry | null) => isFresh(current) ? current : ownEntry);
  return ownSession;
}
