# CODEX PROMPT — Task 66: Apple Sign-In Production Flow

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2E — Auth Production Fixes. Task 65 (Google Sign-In) is complete. This task replaces the
`signInWithApple` stub that has existed since Task 09 (Phase 1.4) with a fully working
implementation using `@invertase/react-native-apple-authentication`.

**Current state of the stub (from Phase 1.4 CHANGELOG):**
> `signInWithApple` is a stub — needs `@invertase/react-native-apple-authentication`
> and a development build.

**Existing files Codex must read before making any change:**

- `services/firebase/auth.ts` — contains the current `signInWithApple` stub export and
  the newly added `signInWithGoogleCredential(idToken)` from Task 65. The stub must be
  **replaced in-place**, not added alongside. Also contains `AppError`, `signOut`,
  `subscribeToAuthState`, `signInWithEmail`, `signUpWithEmail`, `sendOTP`, `verifyOTP`, and
  `signInWithGoogleCredential`. Do **not** touch any of those.
- `app/auth/LandingScreen.tsx` — owns all auth-provider button interactions. Task 65 added
  `Google.useAuthRequest`, `WebBrowser.maybeCompleteAuthSession()`, `handleGooglePress`, and
  `handleGoogleToken`. The Apple Sign-In button is already rendered here behind
  `Platform.OS === 'ios'`, but it currently calls the old stub. The Task 65 `!request`
  disabled guard on the Google button must remain untouched.
- `store/authStore.ts` — exposes `setIsLoading` (used by Task 65 for global loading state),
  `setUser`, and `logout`. Apple Sign-In must use `setIsLoading` consistently with the
  Google pattern — do **not** add a new loading action.
- `utils/errorUtils.ts` — `mapFirebaseError(error)` maps Firebase error codes to i18n keys.
  Apple Sign-In errors must go through this utility before any user-facing display.
- `i18n/en.json` — already contains `auth.google.*` keys from Task 65. New
  `auth.apple.*` error keys added by this task must mirror to `my.json`, `zh.json`, and
  `ta.json` with English placeholder values.
- `app.json` — Task 48 already added
  `["@invertase/react-native-apple-authentication", {}]` to the plugins array. Codex must
  verify the plugin is present before the install step and **must not add a duplicate entry**.

**Package installation:**
`@invertase/react-native-apple-authentication` was listed in the Task 48 install block in
`TASKS_PHASE2.md`. Verify it is present in `package.json` dependencies. If it is absent,
install it with `npx expo install @invertase/react-native-apple-authentication`. Do **not**
run a bare `npm install`.

**Critical architectural boundary — Task 65 pattern must be mirrored exactly:**

> In Task 65, the Google OAuth hook lives in `LandingScreen.tsx` (because it is a React
> hook), and `services/firebase/auth.ts` exposes only a plain credential-exchange helper
> (`signInWithGoogleCredential`). Apple Sign-In follows the same split:
>
> - `auth.ts` exposes `signInWithAppleCredential(identityToken: string, nonce: string)` —
>   a plain async function, no hooks, no `appleAuth` imports that depend on component context.
> - `LandingScreen.tsx` calls `appleAuth.performRequest(...)`, extracts the identity token
>   and nonce, then calls `auth.signInWithAppleCredential(...)`.
>
> **The old `signInWithApple()` stub in `auth.ts` must be deleted entirely.** No stub,
> no comment-out — remove it. `LandingScreen.tsx` must not import it after this task.

---

## Task 66 — Apple Sign-In Production Flow

**Files to modify:**
- `services/firebase/auth.ts` — replace `signInWithApple` stub with
  `signInWithAppleCredential(identityToken, nonce)`
- `app/auth/LandingScreen.tsx` — wire `appleAuth.performRequest`, extract token/nonce,
  call `signInWithAppleCredential`, add `appleAuth.isSupported` guard
- `i18n/en.json` — add `auth.apple.*` error keys
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — mirror same keys with English
  placeholder values

**Files to verify (read-only — do not modify):**
- `app.json` — confirm `@invertase/react-native-apple-authentication` plugin present
- `package.json` — confirm package installed; install only if absent

---

### `services/firebase/auth.ts` — Update

> Replace the existing `signInWithApple` stub. Add `signInWithAppleCredential`. The rest
> of the file (`AppError`, `sendOTP`, `verifyOTP`, `signInWithEmail`, `signUpWithEmail`,
> `signInWithGoogleCredential`, `signOut`, `subscribeToAuthState`) must not be touched.

```typescript
// ─── ADD: new import at the top of the Firebase/third-party imports block ───
import { OAuthProvider, signInWithCredential } from 'firebase/auth'

// ─── REMOVE entirely (stub from Task 09 / Phase 1.4): ───
// export const signInWithApple = async (): Promise<UserCredential> => {
//   throw new AppError('apple-not-implemented', 'Apple Sign-In not yet implemented')
// }

// ─── ADD: production credential helper ───
/**
 * Exchange an Apple identity token + raw nonce for a Firebase UserCredential.
 * Called by LandingScreen after appleAuth.performRequest() succeeds.
 * Never import appleAuth here — this function is intentionally hook-free.
 */
export const signInWithAppleCredential = async (
  identityToken: string,
  nonce: string,
): Promise<UserCredential> => {
  try {
    const provider = new OAuthProvider('apple.com')
    const credential = provider.credential({ idToken: identityToken, rawNonce: nonce })
    return await signInWithCredential(auth, credential)
  } catch (error) {
    throw new AppError(
      'apple-credential-failed',
      mapFirebaseError(error),
    )
  }
}
```

> `OAuthProvider` and `signInWithCredential` are already available in the `firebase/auth`
> package that powers the rest of this file — no new dependency is needed.
>
> `mapFirebaseError` is imported from `@/utils/errorUtils` at the top of `auth.ts` (it was
> added in Phase 1.4). Use the existing import — do not add a second one.
>
> Do not touch the existing `UserCredential` type import, `auth` instance, or any other
> export in this file.

---

### `app/auth/LandingScreen.tsx` — Update

> Wire the Apple Sign-In button to the real implementation. The Google Sign-In section
> (Task 65) must be left entirely unchanged — do not touch `Google.useAuthRequest`,
> `handleGooglePress`, `handleGoogleToken`, or the `!request` disabled guard.

```typescript
// ─── ADD: new import in the third-party block (keep alphabetical within block) ───
import appleAuth from '@invertase/react-native-apple-authentication'

// ─── ADD: import the new credential helper (remove old stub import if present) ───
import { signInWithAppleCredential, signInWithGoogleCredential } from '@/services/firebase/auth'
// Note: if auth.ts currently exports signInWithApple, that import must be removed here.

// ─── ADD: inside the component, after the Google hook declarations ───

/**
 * Apple Sign-In handler.
 * Calls appleAuth.performRequest on the JS thread, then hands the credential
 * to signInWithAppleCredential which signs into Firebase.
 * Guarded by appleAuth.isSupported — this function is never called on Android.
 */
const handleApplePress = async (): Promise<void> => {
  if (!appleAuth.isSupported) return
  authStore.setIsLoading(true)
  try {
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    })

    const { identityToken, nonce } = appleAuthRequestResponse

    if (!identityToken || !nonce) {
      throw new Error(t('auth.apple.missingToken'))
    }

    await signInWithAppleCredential(identityToken, nonce)
    // RootNavigator will react to onAuthStateChanged — no manual navigation needed.
  } catch (error: unknown) {
    // Ignore user-cancelled errors (error code 1001)
    const isUserCancel =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === appleAuth.Error.CANCELED

    if (!isUserCancel) {
      const message =
        error instanceof Error ? error.message : t('errors.generic')
      showToast(message, 'error')
    }
  } finally {
    authStore.setIsLoading(false)
  }
}

// ─── UPDATE: Apple Sign-In button JSX (already rendered behind Platform.OS === 'ios') ───
// BEFORE (stub call):
//   onPress={() => authStore.setIsLoading(true) /* stub */}
//   or similar placeholder
//
// AFTER:
//   onPress={handleApplePress}
//   disabled={!appleAuth.isSupported || authStore.isLoading}
//
// The button must remain wrapped in: {Platform.OS === 'ios' && ( ... )}
// Do not remove the Platform guard. Do not add a separate appleAuth.isSupported
// conditional outside the button — the disabled prop handles unsupported devices silently.
```

> **`showToast` pattern:** Use whichever toast utility is currently called in
> `LandingScreen.tsx` for the Google error path (Task 65 introduced it). Do not add a
> second import or a different toast mechanism.
>
> **User-cancel suppression:** Apple returns error code `1001` when the user taps "Cancel"
> on the system sheet. This is not an error condition. The `isUserCancel` check above
> suppresses the toast for this case. The exact code is `appleAuth.Error.CANCELED` —
> use the enum rather than hardcoding the number.
>
> **`nonce` requirement:** Firebase's Apple OAuth provider requires the raw nonce (not
> hashed) to be passed through. `appleAuth.performRequest` returns the raw nonce directly
> in its response object. Pass it as-is to `signInWithAppleCredential`.
>
> **No `crypto` / `expo-crypto` needed:** Unlike some Apple Sign-In flows, the
> `@invertase/react-native-apple-authentication` library handles nonce generation internally.
> Do not introduce `expo-crypto` or any manual SHA-256 hashing in this task.
>
> Do not modify any part of `LandingScreen.tsx` unrelated to Apple Sign-In:
> — `Google.useAuthRequest`, `handleGooglePress`, `handleGoogleToken`, and the
>   `!request` disabled guard must remain exactly as Task 65 left them.
> — The `StyleSheet`, all other button handlers, and the Terms text must not be touched.

---

### `i18n/en.json` — Update

> Add Apple-specific error keys under the `auth` namespace. Place them directly after the
> existing `auth.google.*` block to keep the namespace tidy.

```json
// Add inside the "auth" object, after "google":
"apple": {
  "missingToken": "Apple Sign-In failed: missing token. Please try again.",
  "cancelledByUser": "Apple Sign-In was cancelled.",
  "failed": "Apple Sign-In failed. Please try again."
}
```

> `auth.apple.missingToken` is referenced in `handleApplePress` above.
> `auth.apple.cancelledByUser` and `auth.apple.failed` are available for future use or
> more granular error mapping — include them now to keep the key set consistent with the
> `auth.google.*` pattern from Task 65.

---

### `i18n/my.json` — Update

```json
// Mirror exactly — English placeholder values per CONVENTIONS.md Section 8:
"apple": {
  "missingToken": "Apple Sign-In failed: missing token. Please try again.",
  "cancelledByUser": "Apple Sign-In was cancelled.",
  "failed": "Apple Sign-In failed. Please try again."
}
```

---

### `i18n/zh.json` — Update

```json
// Mirror exactly — English placeholder values per CONVENTIONS.md Section 8:
"apple": {
  "missingToken": "Apple Sign-In failed: missing token. Please try again.",
  "cancelledByUser": "Apple Sign-In was cancelled.",
  "failed": "Apple Sign-In failed. Please try again."
}
```

---

### `i18n/ta.json` — Update

```json
// Mirror exactly — English placeholder values per CONVENTIONS.md Section 8:
"apple": {
  "missingToken": "Apple Sign-In failed: missing token. Please try again.",
  "cancelledByUser": "Apple Sign-In was cancelled.",
  "failed": "Apple Sign-In failed. Please try again."
}
```

---

## Important Architecture Notes for Codex

1. **Delete the stub entirely — do not leave it behind.** The `signInWithApple` stub in
   `services/firebase/auth.ts` must be removed from the file. Any import of `signInWithApple`
   in `LandingScreen.tsx` must also be removed. After this task, `signInWithApple` must not
   appear anywhere in the client source tree.

2. **`appleAuth` is a default import.** `@invertase/react-native-apple-authentication`
   exports a default object. The correct import is:
   ```typescript
   import appleAuth from '@invertase/react-native-apple-authentication'
   ```
   Do not use `import { appleAuth }` (named import) — it will produce a TypeScript error.

3. **`signInWithAppleCredential` must be hook-free.** `auth.ts` is a plain service module.
   The `appleAuth.performRequest()` call lives in `LandingScreen.tsx`. `auth.ts` receives
   only the resolved `identityToken` and `nonce` strings. This mirrors the Task 65 split
   exactly: hook logic in the screen, credential exchange in the service.

4. **`Platform.OS === 'ios'` guard is already in JSX — do not move it.** The Apple button
   is already wrapped in a platform conditional. The `appleAuth.isSupported` check inside
   `handleApplePress` is a secondary runtime guard for edge cases (e.g., older iOS versions).
   Both guards are needed and must coexist.

5. **`OAuthProvider` import comes from `firebase/auth`.** This package is already a
   dependency. Do not add `firebase` to `package.json`. Do not import from `firebase/compat`.

6. **Do not hash the nonce manually.** The `@invertase` library handles nonce generation and
   delivery to Apple's servers internally. Passing `appleAuthRequestResponse.nonce` directly
   to `signInWithAppleCredential` is correct.

7. **This task requires a development build.** Apple Sign-In cannot be tested in Expo Go.
   Document this in `BUILD.md` if a note is not already present. Do not add any runtime
   Expo Go detection logic — the feature simply will not render on non-iOS platforms due to
   the existing `Platform.OS === 'ios'` guard.

8. **`setIsLoading` is the correct loading action.** `authStore.setIsLoading(true/false)`
   is used — not a local `useState`. This matches the Task 65 Google pattern and keeps the
   global loading indicator consistent across auth providers.

---

## Acceptance Criteria

- [ ] `signInWithApple` stub is deleted from `services/firebase/auth.ts` — no remnant stub,
  no commented-out code, no re-export
- [ ] `signInWithAppleCredential(identityToken: string, nonce: string): Promise<UserCredential>`
  is exported from `services/firebase/auth.ts` as a named export
- [ ] `appleAuth.performRequest` is called in `LandingScreen.tsx` inside `handleApplePress`
- [ ] `appleAuth.isSupported` guard is present inside `handleApplePress` (early return if false)
- [ ] User-cancel errors (error code `appleAuth.Error.CANCELED`) are suppressed — no toast
  shown when the user dismisses the system sheet
- [ ] Apple Sign-In button in `LandingScreen.tsx` calls `handleApplePress` (not the old stub)
- [ ] Apple Sign-In button remains wrapped in `{Platform.OS === 'ios' && ( ... )}`
- [ ] Google Sign-In section in `LandingScreen.tsx` is unchanged — `handleGooglePress`,
  `handleGoogleToken`, `Google.useAuthRequest`, and `!request` disabled guard untouched
- [ ] `auth.apple.missingToken`, `auth.apple.cancelledByUser`, `auth.apple.failed` keys
  present in all four i18n files (`en`, `my`, `zh`, `ta`)
- [ ] `app.json` has exactly one entry for `@invertase/react-native-apple-authentication`
  in the plugins array — no duplicates
- [ ] `@invertase/react-native-apple-authentication` is present in `package.json` dependencies
- [ ] Zero `any` types introduced in any modified file
- [ ] Zero inline `style={{ }}` in any modified file
- [ ] Zero `console.log` or `console.warn` left in any modified file
- [ ] All imports in modified files use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `types/user.ts`,
`types/subscription.ts`, `types/fitness.ts`, `store/discoveryStore.ts`,
`store/subscriptionStore.ts`, `store/profileStore.ts`, `store/fitnessStore.ts`,
`store/matchStore.ts`, `store/chatStore.ts`, `services/firebase/firestore.ts`,
`services/firebase/storage.ts`, `services/firebase/realtime.ts`,
`utils/errorUtils.ts`, `constants/`, `firestore.rules`, `functions/`,
`components/`, `app/navigation/`

---

## Commit

```
git commit -m "task-66: apple sign-in production flow with invertase library"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2E — Task 66] — YYYY-MM-DD

### Completed

- Task 66: Apple Sign-In production flow — signInWithApple stub replaced with @invertase/react-native-apple-authentication
- services/firebase/auth.ts: signInWithApple stub deleted; signInWithAppleCredential(identityToken, nonce) added as named export
- LandingScreen.tsx: appleAuth.performRequest wired in handleApplePress; appleAuth.isSupported guard added; user-cancel suppressed; button wired to handleApplePress
- i18n: auth.apple.missingToken, cancelledByUser, failed added to all 4 language files

### Files Created / Modified

- services/firebase/auth.ts: signInWithApple removed, signInWithAppleCredential(identityToken, nonce) added
- app/auth/LandingScreen.tsx: handleApplePress added; Apple button wired; appleAuth default import added
- i18n/en.json: auth.apple.* keys added
- i18n/my.json, zh.json, ta.json: auth.apple.* mirrored with English placeholders

### Architecture Decisions

- LandingScreen owns appleAuth.performRequest (hook-adjacent imperative call); auth.ts receives only resolved identityToken + nonce strings — mirrors Task 65 Google split exactly
- appleAuth.Error.CANCELED used (not hardcoded 1001) for user-cancel suppression
- No manual nonce hashing — @invertase library handles nonce lifecycle internally
- OAuthProvider from firebase/auth; no new package dependency

### Known Issues / Deferred

- Apple Sign-In requires a development build; cannot be verified in Expo Go
- Task 67 (Crashlytics) will replace console.error in remaining auth error paths

### Verification

- npx tsc --noEmit passes
- Targeted checks: signInWithApple absent from client source, zero any, zero inline style={{ }}, zero console.log in touched files, valid i18n JSON

### Next Up

- Task 67: Firebase Crashlytics Integration (services/crashlytics.ts, ErrorBoundary, authStore setUser)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 67 prompt.

---

## Reasoning Level

Medium
