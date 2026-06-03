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
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
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

/**
 * Completes Google Sign-In using an ID token obtained from the expo-auth-session
 * OAuth flow in LandingScreen.tsx. Browser popup auth is incompatible with EAS
 * development builds and is not used anywhere in this project.
 */
export const signInWithGoogleCredential = async (
  idToken: string
): Promise<UserCredential> => {
  try {
    const credential = GoogleAuthProvider.credential(idToken)

    return await signInWithCredential(auth, credential)
  } catch (error) {
    throw toAppError(error)
  }
}

/**
 * Exchanges an Apple identity token and raw nonce for a Firebase credential.
 * LandingScreen owns the native Apple request; this service stays hook-free.
 */
export const signInWithAppleCredential = async (
  identityToken: string,
  nonce: string
): Promise<UserCredential> => {
  try {
    const provider = new OAuthProvider('apple.com')
    const credential = provider.credential({
      idToken: identityToken,
      rawNonce: nonce,
    })

    return await signInWithCredential(auth, credential)
  } catch (error) {
    throw toAppError(error)
  }
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
