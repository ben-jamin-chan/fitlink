import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

type FirebaseEnvKey =
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET'
  | 'VITE_FIREBASE_MESSAGING_SENDER_ID'
  | 'VITE_FIREBASE_APP_ID'
  | 'VITE_FIREBASE_DATABASE_URL'

const getEnvValue = (key: FirebaseEnvKey): string => {
  const value = import.meta.env[key]

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required Firebase env var: ${key}`)
  }

  return value
}

const firebaseConfig = {
  apiKey: getEnvValue('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvValue('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvValue('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvValue('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvValue('VITE_FIREBASE_APP_ID'),
  databaseURL: getEnvValue('VITE_FIREBASE_DATABASE_URL'),
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'asia-southeast1')
