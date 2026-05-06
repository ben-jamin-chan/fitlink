# CODEX PROMPT — Task 09
# Auth Service Layer

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1.3 complete. The following now exist and must not be touched:
- `services/firebase/config.ts` — exports `auth`, `db`, `storage`, `rtdb`
- `store/authStore.ts` — stub store with `isAuthenticated`, `isLoading`, `hasCompletedOnboarding`
- `app/navigation/` — RootNavigator, AuthNavigator, MainTabNavigator all working
- `.env` — populated with real Firebase values
- `GoogleService-Info.plist` and `google-services.json` — present in project root
- `types/user.ts` — `UserProfile` and related types defined
- `i18n/en.json` — all auth error keys already defined under `errors.auth`

Task 09 creates the Firebase auth service layer. This is a pure service file — no UI, no stores. It exports typed async functions that the auth screens (Tasks 11–14) and auth store (Task 10) will call.

---

## Task 09 — Auth Service Layer

**Files to create:**
- `services/firebase/auth.ts`
- `utils/errorUtils.ts`

**Do not create** any screen files, store files, or hook files in this task.

---

### `utils/errorUtils.ts`

Create a Firebase error mapping utility. This is the `mapFirebaseError` function referenced throughout CONVENTIONS.md. It maps raw Firebase error codes to i18n keys from `en.json`.

```typescript
import { FirebaseError } from 'firebase/app'

// Maps Firebase auth error codes to i18n translation keys
// All keys must exist in i18n/en.json under the errors namespace
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
}

export const mapFirebaseError = (error: unknown): string => {
  if (error instanceof FirebaseError) {
    return FIREBASE_ERROR_MAP[error.code] ?? 'errors.generic'
  }
  return 'errors.generic'
}

// Type guard for FirebaseError
export const isFirebaseError = (error: unknown): error is FirebaseError => {
  return error instanceof FirebaseError
}
```

Note: `mapFirebaseError` returns an **i18n key** (e.g. `'errors.auth.invalidOtp'`), not a translated string. The calling component passes this key to `t()` from `useTranslation()`. This keeps the service layer free of React hooks.

---

### `services/firebase/auth.ts`

Create typed async functions for all auth operations needed in Phase 1.

```typescript
import {
  signInWithPhoneNumber,
  ConfirmationResult,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  UserCredential,
  User,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '@/services/firebase/config'
import { mapFirebaseError } from '@/utils/errorUtils'

// ─── Error type ────────────────────────────────────────────────────────────────

export interface AppError {
  code: string        // i18n key — pass to t() in component
  raw?: string        // original Firebase error code for debugging
}

const toAppError = (error: unknown): AppError => {
  const key = mapFirebaseError(error)
  const raw = error instanceof Error ? error.message : String(error)
  return { code: key, raw }
}

// ─── Phone Auth ────────────────────────────────────────────────────────────────

export const sendOTP = async (
  phoneNumber: string
): Promise<ConfirmationResult> => {
  try {
    // Note: reCAPTCHA verifier is required for web — for Expo Go use
    // expo-firebase-recaptcha or bypass with test phone numbers in Firebase Console
    // For production builds, integrate FirebaseRecaptchaVerifierModal
    const confirmation = await signInWithPhoneNumber(auth, phoneNumber)
    return confirmation
  } catch (error) {
    throw toAppError(error)
  }
}

export const verifyOTP = async (
  confirmationResult: ConfirmationResult,
  otp: string
): Promise<UserCredential> => {
  try {
    const credential = await confirmationResult.confirm(otp)
    return credential
  } catch (error) {
    throw toAppError(error)
  }
}

// ─── Email Auth ────────────────────────────────────────────────────────────────

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

// ─── Google Auth ───────────────────────────────────────────────────────────────

export const signInWithGoogle = async (): Promise<UserCredential> => {
  try {
    const provider = new GoogleAuthProvider()
    provider.addScope('profile')
    provider.addScope('email')
    return await signInWithPopup(auth, provider)
  } catch (error) {
    throw toAppError(error)
  }
}

// ─── Sign Out ──────────────────────────────────────────────────────────────────

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth)
  } catch (error) {
    throw toAppError(error)
  }
}

// ─── Auth State ────────────────────────────────────────────────────────────────

export const getCurrentUser = (): User | null => {
  return auth.currentUser
}

export const subscribeToAuthState = (
  callback: (user: User | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, callback)
}
```

---

## Important Notes for Codex

**Phone auth and reCAPTCHA:** `signInWithPhoneNumber` in a bare Expo Go environment requires a reCAPTCHA verifier. For now, add test phone numbers in Firebase Console (Authentication → Sign-in method → Phone → Phone numbers for testing) so the OTP flow can be tested without a real reCAPTCHA setup. Production reCAPTCHA integration happens in Task 12 when the phone login screen is built.

**Google Sign-In:** `signInWithPopup` works in Expo Go for development but will need to be replaced with `expo-auth-session` for production builds. Add a comment to the `signInWithGoogle` function noting this:
```typescript
// TODO: Replace signInWithPopup with expo-auth-session for production builds
// signInWithPopup works in Expo Go dev only
```

**Apple Sign-In:** Not implemented in this task — Apple auth requires a native module (`@invertase/react-native-apple-authentication`) that needs a development build, not Expo Go. Add a stub:
```typescript
export const signInWithApple = async (): Promise<UserCredential> => {
  // TODO: Task 11 — implement with @invertase/react-native-apple-authentication
  // Requires development build, not available in Expo Go
  throw { code: 'errors.generic', raw: 'Apple Sign-In not yet implemented' } satisfies AppError
}
```

---

## Acceptance Criteria

- [ ] `utils/errorUtils.ts` created — `mapFirebaseError` returns i18n key string, not translated text
- [ ] `services/firebase/auth.ts` created — all 7 functions exported as named exports
- [ ] `AppError` interface exported from `auth.ts`
- [ ] Every function wraps errors with `toAppError()` — no raw Firebase errors ever thrown
- [ ] `subscribeToAuthState` returns the unsubscribe function (critical for cleanup in Task 10)
- [ ] `signInWithGoogle` has TODO comment for production replacement
- [ ] `signInWithApple` stub exists with TODO comment
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Zero `any` usage
- [ ] No UI code, no React hooks, no store imports in either file

## Do Not Touch
`store/authStore.ts`, `app/navigation/`, `App.tsx`, `types/`, `constants/`, `i18n/`, `services/firebase/config.ts`

## Commit
`git commit -m "task-09: auth service layer and error utils"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1.4] — YYYY-MM-DD
### Completed
- Task 09: Auth service layer created (sendOTP, verifyOTP, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple stub, signOut, subscribeToAuthState)
- utils/errorUtils.ts created (mapFirebaseError returns i18n keys)

### Files Created / Modified
- services/firebase/auth.ts: all auth functions, AppError type
- utils/errorUtils.ts: mapFirebaseError, isFirebaseError, FIREBASE_ERROR_MAP

### Known Issues / Deferred
- signInWithGoogle uses signInWithPopup — works in Expo Go dev only, needs expo-auth-session for production (TODO comment added)
- signInWithApple is a stub — needs @invertase/react-native-apple-authentication and a development build
- Phone auth reCAPTCHA: use Firebase Console test phone numbers for now — production reCAPTCHA wired in Task 12

### Next Up
- Task 10: Auth Zustand store (full implementation — replaces stub, wires subscribeToAuthState, persists with AsyncStorage)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 10 prompt.

---

## Reasoning Level
**Medium** — straightforward service layer with explicit function signatures provided. The reCAPTCHA nuance and Google/Apple caveats are explained inline so no creative problem-solving is needed.
