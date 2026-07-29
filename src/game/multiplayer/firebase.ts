import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth | null;
  database: Database;
  user: { uid: string };
}

let servicesPromise: Promise<FirebaseServices | null> | undefined;

const LEGACY_PUBLIC_CONFIG = {
  apiKey: "AIzaSyA9sFi7r006bjzRd4jNUGPPbZ8KDjlif04",
  authDomain: "wildspell.firebaseapp.com",
  databaseURL: "https://wildspell-default-rtdb.firebaseio.com",
  projectId: "wildspell",
  storageBucket: "wildspell.firebasestorage.app",
  messagingSenderId: "601752417654",
  appId: "1:601752417654:web:50219d23c03b47bc5ff657"
};

function localIdentity(): { uid: string } {
  const key = "wildspell-online-id";
  let uid = window.localStorage.getItem(key);
  if (!uid) {
    uid = `guest-${crypto.randomUUID()}`;
    window.localStorage.setItem(key, uid);
  }
  return { uid };
}

export function firebaseConfigured(): boolean {
  return Boolean((import.meta.env.VITE_FIREBASE_DATABASE_URL && import.meta.env.VITE_FIREBASE_PROJECT_ID) || LEGACY_PUBLIC_CONFIG.databaseURL);
}

export function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (servicesPromise) return servicesPromise;
  servicesPromise = (async () => {
    if (!firebaseConfigured()) return null;
    const config = import.meta.env.VITE_FIREBASE_DATABASE_URL ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    } : LEGACY_PUBLIC_CONFIG;
    const app = getApps().length ? getApp() : initializeApp(config);
    let auth: Auth | null = null;
    let user = localIdentity();
    try {
      auth = getAuth(app);
      const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
      user = credential.user;
    } catch {
      // The original public WildSpell database currently permits guest rooms
      // without Firebase Auth. Keep a stable per-browser identity for reconnects.
      auth = null;
    }
    return { app, auth, database: getDatabase(app), user };
  })();
  return servicesPromise;
}
