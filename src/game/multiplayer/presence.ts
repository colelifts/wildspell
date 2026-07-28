import { onDisconnect, ref, serverTimestamp, set, type Database } from "firebase/database";

export async function attachPresence(database: Database, roomCode: string, slot: 0 | 1, uid: string): Promise<() => void> {
  const presenceRef = ref(database, `rooms/${roomCode}/presence/${slot}`);
  await onDisconnect(presenceRef).set({ uid, connected: false, lastSeen: serverTimestamp() });
  await set(presenceRef, { uid, connected: true, lastSeen: serverTimestamp() });
  const heartbeat = window.setInterval(() => void set(presenceRef, { uid, connected: true, lastSeen: serverTimestamp() }), 10_000);
  return () => {
    window.clearInterval(heartbeat);
    void set(presenceRef, { uid, connected: false, lastSeen: serverTimestamp() });
  };
}
