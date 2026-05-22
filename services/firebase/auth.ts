import {
  deleteDoc,
  doc,
} from 'firebase/firestore'
import {
  deleteObject,
  listAll,
  ref,
} from 'firebase/storage'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import type { ConfirmationResult, User, UserCredential } from 'firebase/auth'

import { auth, db, storage } from '@/services/firebase/config'
import { isFirebaseError, mapFirebaseError } from '@/utils/errorUtils'

// Module-level store for ConfirmationResult.
// ConfirmationResult cannot be serialised into nav params or AsyncStorage.
// PhoneLoginScreen writes it; OTPVerifyScreen reads it.
let _pendingConfirmation: ConfirmationResult | null = null

export const setPendingConfirmation = (
  result: ConfirmationResult | null
): void => {
  _pendingConfirmation = result
}

export const getPendingConfirmation = (): ConfirmationResult | null => {
  return _pendingConfirmation
}

export interface AppError {
  code: string
  raw?: string
}

const toAppError = (error: unknown): AppError => {
  const code = mapFirebaseError(error)
  const raw = isFirebaseError(error)
    ? error.code
    : error instanceof Error
      ? error.message
      : String(error)

  return { code, raw }
}

export const sendOTP = async (
  phoneNumber: string
): Promise<ConfirmationResult> => {
  try {
    // Note: reCAPTCHA verifier is required for web. For Expo Go, use
    // Firebase Console test phone numbers until Task 12 wires production setup.
    return await signInWithPhoneNumber(auth, phoneNumber)
  } catch (error) {
    throw toAppError(error)
  }
}

export const verifyOTP = async (
  confirmationResult: ConfirmationResult,
  otp: string
): Promise<UserCredential> => {
  try {
    return await confirmationResult.confirm(otp)
  } catch (error) {
    throw toAppError(error)
  }
}

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  try {
    return await signInWithEmailAndPassword(auth, email, password)
  } catch (error) {
    throw toAppError(error)
  }
}

export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  try {
    return await createUserWithEmailAndPassword(auth, email, password)
  } catch (error) {
    throw toAppError(error)
  }
}

export const signInWithGoogle = async (): Promise<UserCredential> => {
  try {
    // TODO: Replace signInWithPopup with expo-auth-session for production builds.
    // signInWithPopup works in Expo Go dev only.
    const provider = new GoogleAuthProvider()
    provider.addScope('profile')
    provider.addScope('email')

    return await signInWithPopup(auth, provider)
  } catch (error) {
    throw toAppError(error)
  }
}

export const signInWithApple = async (): Promise<UserCredential> => {
  // TODO: Task 11 - implement with @invertase/react-native-apple-authentication.
  // Requires development build, not available in Expo Go.
  throw {
    code: 'errors.generic',
    raw: 'Apple Sign-In not yet implemented',
  } satisfies AppError
}

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth)
  } catch (error) {
    throw toAppError(error)
  }
}

export const deleteAccount = async (): Promise<void> => {
  const user = auth.currentUser

  if (user === null) {
    throw {
      code: 'errors.auth.userNotFound',
      raw: 'auth/no-user',
    } satisfies AppError
  }

  const uid = user.uid

  try {
    const storageRef = ref(storage, `users/${uid}/photos`)
    const photoList = await listAll(storageRef)
    await Promise.all(
      photoList.items.map((itemRef): Promise<void> => deleteObject(itemRef))
    )
  } catch {
    // Best-effort only; missing Storage objects should not block account deletion.
  }

  try {
    // TODO Phase 2: onUserDeleted Cloud Function cleans up matches, swipes, chats.
    await deleteDoc(doc(db, 'users', uid))
    await user.delete()
  } catch (error: unknown) {
    throw toAppError(error)
  }
}

export const getCurrentUser = (): User | null => {
  try {
    return auth.currentUser
  } catch (error) {
    throw toAppError(error)
  }
}

export const subscribeToAuthState = (
  callback: (user: User | null) => void
): (() => void) => {
  try {
    return onAuthStateChanged(auth, callback)
  } catch (error) {
    throw toAppError(error)
  }
}
