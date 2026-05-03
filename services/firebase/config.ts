/**
 * Firebase configuration — initialised once, exported for use across services.
 *
 * Setup:
 * 1. Copy .env.example to .env in the project root
 * 2. Fill in values from Firebase Console → Project Settings → Your Apps → Web App
 * 3. Never commit .env — it is in .gitignore
 *
 * Named exports: auth, db, storage, rtdb, app
 */
import { getApp, getApps, initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import type { Database } from 'firebase/database'
import { getAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
}

const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const auth: Auth = getAuth(app)
export const db: Firestore = getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)
export const rtdb: Database = getDatabase(app)
export { app }
