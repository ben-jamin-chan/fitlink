/**
 * Firebase configuration — initialised once, exported for use across services.
 *
 * Setup:
 * 1. Copy .env.example to .env in the project root
 * 2. Fill in values from Firebase Console → Project Settings → Your Apps → Web App
 * 3. Never commit .env — it is in .gitignore
 *
 * Named exports: auth, db, functions, storage, rtdb, app
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getApp, getApps, initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import type { Database } from 'firebase/database'
import { getAuth, initializeAuth } from 'firebase/auth'
import type {
  Auth,
  Dependencies,
  Persistence,
  ReactNativeAsyncStorage,
} from 'firebase/auth'
import { getFirestore, initializeFirestore } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import type { Functions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'

declare const require: (moduleName: string) => unknown

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
}

interface FirebaseAuthReactNativeModule {
  getReactNativePersistence: (
    storage: ReactNativeAsyncStorage
  ) => Persistence
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isFirebaseAuthReactNativeModule = (
  value: unknown
): value is FirebaseAuthReactNativeModule => {
  return (
    isRecord(value) && typeof value.getReactNativePersistence === 'function'
  )
}

const getAuthDependencies = (): Dependencies | undefined => {
  const authModule = require('firebase/auth')

  if (!isFirebaseAuthReactNativeModule(authModule)) {
    return undefined
  }

  return {
    persistence: authModule.getReactNativePersistence(AsyncStorage),
  }
}

const isNewApp = getApps().length === 0
const app: FirebaseApp = isNewApp ? initializeApp(firebaseConfig) : getApp()

const initializeFirebaseAuth = (
  firebaseApp: FirebaseApp,
  shouldInitialize: boolean
): Auth => {
  if (!shouldInitialize) {
    return getAuth(firebaseApp)
  }

  return initializeAuth(firebaseApp, getAuthDependencies())
}

export const auth: Auth = initializeFirebaseAuth(app, isNewApp)
export const db: Firestore = isNewApp
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : getFirestore(app)
export const functions: Functions = getFunctions(app, 'asia-southeast1')
export const storage: FirebaseStorage = getStorage(app)
export const rtdb: Database = getDatabase(app)
export { app }
