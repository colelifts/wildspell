import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth, type User } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  database: Database;
  user: User;
}

let servicesPromise: Promise<FirebaseServices | null> | undefined;

export function firebaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_DATABASE_URL && import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

export function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (servicesPromise) return servicesPromise;
  servicesPromise = (async () => {
    if (!firebaseConfigured()) return null;
    const config = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    const app = getApps().length ? getApp() : initializeApp(config);
    const auth = getAuth(app);
    const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
    return { app, auth, database: getDatabase(app), user: credential.user };
  })();
  return servicesPromise;
}
