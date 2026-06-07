# CODEX PROMPT — Task 67: Firebase Crashlytics Integration

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2E authentication production fixes are now complete. Tasks 65 and 66 replaced all
`signInWithPopup` and `signInWithApple` stubs with production OAuth flows. Task 67 closes
the final Phase 2E deferred item: wiring Firebase Crashlytics so the `ErrorBoundary`'s
`console.error` and any remaining auth error paths report to Crashlytics instead of the
console.

**Existing files Codex must read before touching anything:**

- `components/ui/ErrorBoundary.tsx` — class component; `componentDidCatch` currently calls
  `console.error`; this is the primary call site to replace
- `store/authStore.ts` — `setUser(user)` action sets the authenticated user; this is where
  `crashlytics.setUser(uid)` must be called after login
- `services/firebase/auth.ts` — `signInWithGoogleCredential` and `signInWithAppleCredential`
  are named exports; `AppError` type defined here; do **not** add Crashlytics calls here —
  the screen layer already catches and surfaces these errors
- `app/auth/LandingScreen.tsx` — handles `handleGooglePress` and `handleApplePress` with
  try/catch; error paths call `showToast`; do **not** touch this file
- `app.json` — already has `@invertase/react-native-apple-authentication` as a plugin entry;
  two new native plugins will be appended here
- `services/firebase/config.ts` — exports `auth`, `db`, `storage`, `rtdb`; do **not**
  touch; Crashlytics initialises automatically via its native plugin, no JS config call needed
- `i18n/en.json` — already contains `errors.*` keys; no new i18n keys are needed for this task

**Architecture boundary:** `@react-native-firebase/app` and `@react-native-firebase/crashlytics`
are native modules that require an Expo development build. They **cannot** be tested in Expo
Go. The acceptance gate is `npx tsc --noEmit` passing and the service wiring being correct —
not a live Crashlytics dashboard verification. Document this constraint in `BUILD.md`.

**Do not add Crashlytics calls inside Cloud Functions (`functions/src/`).** Cloud Functions
use Google Cloud Logging natively; Crashlytics is a client-side SDK only.

---

## Task 67 — Firebase Crashlytics Integration

**Files to create:**
- `services/crashlytics.ts`

**Files to modify:**
- `app.json` — add `@react-native-firebase/app` and `@react-native-firebase/crashlytics` plugins
- `components/ui/ErrorBoundary.tsx` — replace `console.error` with `crashlytics.logError`
- `store/authStore.ts` — call `crashlytics.setUser(uid)` inside `setUser` action after user is set
- `BUILD.md` — document that Crashlytics requires a development build

---

### `services/crashlytics.ts`

> Thin wrapper around `@react-native-firebase/crashlytics`. Provides three named exports used
> across the codebase: `logError` (ErrorBoundary), `setUser` (authStore), and `log`
> (breadcrumb logging for future use). Isolating the import here means the rest of the
> codebase never imports from `@react-native-firebase/crashlytics` directly, keeping the
> native dependency contained to one file and making it trivially mockable in tests.

```typescript
// 1. React Native imports
import { Platform } from 'react-native'

// 2. Third-party libraries
import crashlytics from '@react-native-firebase/crashlytics'

/**
 * Record a JavaScript Error to Firebase Crashlytics.
 * Safe to call from any thread; the native SDK handles the upload.
 *
 * @param error   - The Error object to record
 * @param context - Optional key/value pairs attached as custom attributes
 *                  (e.g. { componentStack: '...' })
 */
export const logError = (
  error: Error,
  context?: Record<string, string>
): void => {
  try {
    if (context !== undefined) {
      const entries = Object.entries(context)
      for (const [key, value] of entries) {
        crashlytics().setAttribute(key, value)
      }
    }
    crashlytics().recordError(error)
  } catch {
    // Crashlytics must never throw — swallow silently so the app keeps running
  }
}

/**
 * Tag the current Crashlytics session with the authenticated user's UID.
 * Call this immediately after a successful sign-in. Pass an empty string
 * to clear the user identity on sign-out.
 *
 * @param uid - Firebase Auth UID (or '' to clear)
 */
export const setUser = (uid: string): void => {
  try {
    crashlytics().setUserId(uid)
    crashlytics().setAttribute('platform', Platform.OS)
  } catch {
    // Swallow — must never interrupt the auth flow
  }
}

/**
 * Write a breadcrumb log entry that appears in the Crashlytics crash report
 * if a subsequent crash occurs in the same session.
 *
 * @param message - Short, descriptive breadcrumb string
 */
export const log = (message: string): void => {
  try {
    crashlytics().log(message)
  } catch {
    // Swallow — breadcrumb logging is non-critical
  }
}
```

---

### `app.json` — Update

> Append two plugin entries for `@react-native-firebase/app` and
> `@react-native-firebase/crashlytics`. The existing `plugins` array already contains
> `@stripe/stripe-react-native`, `expo-camera`, `@invertase/react-native-apple-authentication`,
> and `expo-localization`. Do **not** remove or reorder any existing entry.

```jsonc
// In the "expo" → "plugins" array, append after the last existing entry:
"@react-native-firebase/app",
"@react-native-firebase/crashlytics"

// The full plugins array should look like (order matters — do not change existing entries):
// [
//   "@stripe/stripe-react-native",
//   "expo-camera",
//   ["@invertase/react-native-apple-authentication", {}],
//   "expo-localization",
//   "@react-native-firebase/app",
//   "@react-native-firebase/crashlytics"
// ]
```

Also add the following installation commands before touching `app.json`:

```bash
npx expo install @react-native-firebase/app @react-native-firebase/crashlytics
```

---

### `components/ui/ErrorBoundary.tsx` — Update

> Replace the existing `console.error` call in `componentDidCatch` with `logError` from
> `services/crashlytics`. The rest of the class — state, `getDerivedStateFromError`,
> the fallback render, and the `StyleSheet` — must not be touched.

```typescript
// Add import at the top of the file (after React import, before RN imports):
import { logError } from '@/services/crashlytics'

// In componentDidCatch, replace:
//   console.error('ErrorBoundary caught:', error, info)
// with:
componentDidCatch(error: Error, info: React.ErrorInfo): void {
  logError(error, {
    componentStack: info.componentStack ?? '',
  })
}
```

> Do not touch `getDerivedStateFromError`, the render method, the `ErrorBoundaryState`
> interface, the `ErrorBoundaryProps` interface, or the `StyleSheet` at the bottom.

---

### `store/authStore.ts` — Update

> Add `crashlytics.setUser(uid)` inside the `setUser` action immediately after the user is
> written to state, and add `crashlytics.setUser('')` inside the `logout` action immediately
> after auth state is cleared. Do not touch any other action, the `persist` middleware
> config, the `initialise()` function, or the `subscribeToAuthState` listener.

```typescript
// Add import near the top of the file (after existing service imports):
import { setUser as setCrashlyticsUser } from '@/services/crashlytics'

// Inside the setUser action, immediately after assigning user to state:
// (The existing action sets: state.user = user, state.isAuthenticated = true, etc.)
// Add this call right after those assignments:
setCrashlyticsUser(user.uid)

// Inside the logout action (or wherever Firebase signOut is called and state is cleared),
// add after auth state is cleared:
setCrashlyticsUser('')
```

> Do not rename the existing `setUser` action — the import alias `setCrashlyticsUser` is
> used only locally in this file to avoid shadowing the store action name.
> Do not touch `initialise()`, `hasCompletedOnboarding`, `setIsLoading`, or any persist
> middleware configuration.

---

### `BUILD.md` — Update

> Append a new section documenting the Crashlytics development-build requirement. Do not
> modify any existing content.

```markdown
## Native Modules — Development Build Required

The following native modules **cannot** be tested in Expo Go. A development build
(`eas build --profile development`) is required:

| Module | Feature |
|---|---|
| `@invertase/react-native-apple-authentication` | Apple Sign-In (Task 66) |
| `@react-native-google-signin/google-signin` | Google Sign-In (Task 65) |
| `@react-native-firebase/crashlytics` | Error reporting (Task 67) |

### Verifying Crashlytics

1. Trigger a test crash from the ErrorBoundary in a development build:
   ```typescript
   // Temporary — remove after verifying
   crashlytics().crash()
   ```
2. Reopen the app — the crash report is uploaded on next launch.
3. Check Firebase Console → Crashlytics → Issues within ~5 minutes.

### Crashlytics in Production

Crashlytics is automatically enabled in production EAS builds. No additional configuration
is required beyond the `app.json` plugin entries added in Task 67.
```

---

## Important Architecture Notes for Codex

1. **`try/catch` in every Crashlytics wrapper.** Every function in `services/crashlytics.ts`
   must be wrapped in `try/catch` that swallows exceptions silently. Crashlytics must never
   throw and must never interrupt any user flow — if the SDK is unavailable (e.g. running in
   Expo Go without a dev build), the app must continue normally.

2. **No Crashlytics import outside `services/crashlytics.ts`.** All other files import only
   from `@/services/crashlytics` — never directly from `@react-native-firebase/crashlytics`.
   This isolates the native dependency and makes the entire codebase testable without a native
   build environment.

3. **No console.log, console.error, or console.warn left in touched files.** The `console.error`
   in `ErrorBoundary.tsx` is replaced — not supplemented. After this task, touched files must
   have zero console calls.

4. **`setUser` import alias in authStore.** The authStore already has an action named `setUser`.
   Import the Crashlytics helper as `setCrashlyticsUser` to prevent shadowing. The alias is
   local to `store/authStore.ts` only.

5. **`logError` receives an `Error` object, not a string.** When calling `logError` from
   `ErrorBoundary.componentDidCatch`, the first argument is already an `Error` object — pass it
   directly. Do not convert it to a string with `.message` or `String()`.

6. **`Platform.OS` attribute set once in `setUser`.** The `setAttribute('platform', Platform.OS)`
   call in `services/crashlytics.ts` runs once on every successful sign-in. This is intentional
   — Crashlytics attributes persist for the session and help filter crash reports by platform.

7. **No changes to Cloud Functions.** `functions/src/` is out of scope for this task entirely.
   Cloud Functions use Google Cloud Logging, not Crashlytics.

---

## Acceptance Criteria

- [ ] `services/crashlytics.ts` created with named exports `logError`, `setUser`, and `log`
- [ ] All three functions in `services/crashlytics.ts` wrapped in `try/catch` that swallows silently
- [ ] `@react-native-firebase/app` and `@react-native-firebase/crashlytics` installed via `npx expo install`
- [ ] Both packages added to `app.json` plugins array without removing or reordering existing entries
- [ ] `components/ui/ErrorBoundary.tsx`: `console.error` replaced with `logError(error, { componentStack: info.componentStack ?? '' })`
- [ ] `components/ui/ErrorBoundary.tsx`: no other changes made to the class — `getDerivedStateFromError`, render method, and `StyleSheet` untouched
- [ ] `store/authStore.ts`: `setCrashlyticsUser(user.uid)` called inside `setUser` action after user is written to state
- [ ] `store/authStore.ts`: `setCrashlyticsUser('')` called inside `logout` action after auth state is cleared
- [ ] `store/authStore.ts`: import alias `setCrashlyticsUser` used — no shadowing of the existing `setUser` action name
- [ ] `BUILD.md` updated with Crashlytics native module section and verification steps
- [ ] Zero `console.error`, `console.log`, or `console.warn` in any touched file
- [ ] Zero `any` in `services/crashlytics.ts`
- [ ] Zero inline `style={{ }}` in any touched file
- [ ] All imports in touched files use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `app/auth/LandingScreen.tsx`, `services/firebase/auth.ts`,
`services/firebase/config.ts`, `store/profileStore.ts`, `store/discoveryStore.ts`,
`store/matchStore.ts`, `store/chatStore.ts`, `store/fitnessStore.ts`,
`store/subscriptionStore.ts`, `types/`, `constants/`, `i18n/`,
`firestore.rules`, `firestore.indexes.json`, `functions/`

---

## Commit

```
git commit -m "task-67: integrate Firebase Crashlytics for error reporting"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2E — Task 67] — YYYY-MM-DD

### Completed

- Task 67: Firebase Crashlytics integration
- services/crashlytics.ts: logError, setUser, log named exports; all wrapped in try/catch to
  prevent Crashlytics from interrupting app flows
- ErrorBoundary.tsx: console.error replaced with logError(error, { componentStack })
- authStore.ts: setCrashlyticsUser called on setUser (uid) and logout ('')
- app.json: @react-native-firebase/app and @react-native-firebase/crashlytics plugins added
- BUILD.md: native module table and Crashlytics verification steps documented

### Files Created / Modified

- services/crashlytics.ts: created — logError, setUser, log; sole import point for
  @react-native-firebase/crashlytics across the codebase
- components/ui/ErrorBoundary.tsx: console.error → logError call in componentDidCatch
- store/authStore.ts: setCrashlyticsUser added to setUser and logout actions
- app.json: two @react-native-firebase plugin entries appended to plugins array
- BUILD.md: "Native Modules — Development Build Required" section added

### Architecture Decisions

- All Crashlytics calls isolated to services/crashlytics.ts — no direct imports of
  @react-native-firebase/crashlytics elsewhere, so the native module is mockable in tests
- try/catch in every wrapper function — Crashlytics must never throw and must never
  block the UI or auth flow if unavailable (e.g. Expo Go)
- setCrashlyticsUser import alias in authStore to avoid shadowing the existing setUser action

### Known Issues / Deferred

- Crashlytics requires a development build; cannot be verified in Expo Go
- Live crash verification (Firebase Console → Crashlytics) deferred to development build
  testing after Task 68 (security rules) and Task 69 (indexes) complete Phase 2

### Next Up

- Task 68: Update Firestore Security Rules for Phase 2 (deny client writes to /swipes/,
  premium.*, photoVerified, verifiedAt, banned, age, verificationAttempts, dailyLikes)
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

Medium
