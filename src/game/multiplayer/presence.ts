import { onDisconnect, ref, remove, serverTimestamp, set, type Database } from "firebase/database";

export async function attachPresence(database: Database, roomCode: string, slot: 0 | 1, uid: string): Promise<() => void> {
  const presenceRef = ref(database, `rooms/${roomCode}/presence/${slot}`);
  const disconnect = onDisconnect(presenceRef);
  await disconnect.set({ uid, connected: false, lastSeen: serverTimestamp() });
  await set(presenceRef, { uid, connected: true, lastSeen: serverTimestamp() });
  const heartbeat = window.setInterval(() => void set(presenceRef, { uid, connected: true, lastSeen: serverTimestamp() }), 10_000);
  return () => {
    window.clearInterval(heartbeat);
    void disconnect.cancel().then(() => remove(presenceRef));
  };
}
