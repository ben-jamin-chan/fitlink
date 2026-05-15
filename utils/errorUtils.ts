import { FirebaseError } from 'firebase/app'

// Maps Firebase auth error codes to i18n translation keys.
const FIREBASE_ERROR_MAP: Record<string, string> = {
  'auth/invalid-phone-number': 'errors.auth.invalidPhone',
  'auth/invalid-verification-code': 'errors.auth.invalidOtp',
  'auth/code-expired': 'errors.auth.invalidOtp',
  'auth/too-many-requests': 'errors.auth.tooManyAttempts',
  'auth/invalid-email': 'errors.auth.invalidEmail',
  'auth/weak-password': 'errors.auth.weakPassword',
  'auth/email-already-in-use': 'errors.auth.emailInUse',
  'auth/user-not-found': 'errors.auth.userNotFound',
  'auth/wrong-password': 'errors.auth.wrongPassword',
  'auth/network-request-failed': 'errors.network',
  'auth/operation-not-allowed': 'errors.generic',
  'auth/account-exists-with-different-credential': 'errors.auth.emailInUse',
  'storage/unauthorized': 'errors.photo.uploadFailed',
  'storage/canceled': 'errors.photo.uploadFailed',
  'storage/retry-limit-exceeded': 'errors.network',
  'storage/quota-exceeded': 'errors.photo.uploadFailed',
  'storage/unknown': 'errors.photo.uploadFailed',
}

export const mapFirebaseError = (error: unknown): string => {
  if (error instanceof FirebaseError) {
    return FIREBASE_ERROR_MAP[error.code] ?? 'errors.generic'
  }

  if (error instanceof Error && error.message === 'firestore-write-timeout') {
    return 'errors.network'
  }

  return 'errors.generic'
}

export const isFirebaseError = (error: unknown): error is FirebaseError => {
  return error instanceof FirebaseError
}
