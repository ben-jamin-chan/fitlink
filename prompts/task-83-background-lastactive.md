# CODEX PROMPT — Task 83: Background `lastActive` Updates (iOS)

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 82 (Per-User Timezone Daily Resets) is complete. Both `recordSwipe.ts` and
`verifyProfilePhoto.ts` now read `users/{uid}.timezone` from Firestore and compute
the correct local midnight. `tsc --noEmit` and the functions build are clean.

Relevant existing files for this task:

- `hooks/useLastActive.ts` — existing hook called from `App.tsx` inside `AppRoot`; writes
  `serverTimestamp()` to `users/{uid}.lastActive` on foreground via `AppState` listener
  and a `setInterval` heartbeat every 5 minutes. Currently uses `updateDoc` directly inside
  the hook body (inlined, not extracted to a service function). Background fetch is not yet
  registered — that was deferred from Phase 1 Task 45.
- `services/firebase/firestore.ts` — central Firestore service; already exports
  `createUserProfile`, `updateUserProfile`, `getUserProfile`, `getDailyLikesDoc`,
  `incrementDailyLikes`, and `updateLastActive` is **not yet exported** — it must be
  added here as a standalone named export in this task.
- `store/authStore.ts` — Zustand store with `persist` middleware; stores `uid`,
  `isAuthenticated`, `hasCompletedOnboarding`. Already calls `AsyncStorage` via Zustand
  persist internally, but does **not** explicitly call
  `AsyncStorage.setItem('fitlink-uid', uid)` outside Zustand — that explicit write is
  required so the background task's isolated JS context can read the uid without
  importing Zustand.
- `app.json` — last modified in Task 79 (`expo-location` install, foreground location
  permission strings). This task adds `UIBackgroundModes` to `ios.infoPlist`.
- `BUILD.md` — last modified in Task 77 (`expo-video` development-build note).
  This task adds a background fetch development-build note.

**`TaskManager.defineTask` runs in a completely isolated JS context — Zustand stores are
unavailable. The background task must only use `AsyncStorage` and `updateLastActive`.
Never import any store into the task body or the module-scope task definition block.**

**The `.catch(() => {})` on `registerTaskAsync` is intentional and must remain. Expo Go
and simulators silently reject background fetch registration; swallowing the error prevents
a visible crash in development.**

---

## Task 83 — Background `lastActive` Updates (iOS)

**Files to install:**
```bash
npx expo install expo-background-fetch expo-task-manager
```

**Files to modify:**
- `app.json` — add `UIBackgroundModes` to `ios.infoPlist`
- `services/firebase/firestore.ts` — extract `updateLastActive(uid)` as a named export
- `store/authStore.ts` — persist uid to `AsyncStorage` on login; remove on logout
- `hooks/useLastActive.ts` — define background task at module scope; register it inside
  the hook; update foreground heartbeat to use `updateLastActive`
- `BUILD.md` — document the development-build requirement for background fetch

---

### `app.json` — Update

Add `UIBackgroundModes` inside the `ios.infoPlist` object. If `ios.infoPlist` does not
already exist as a key, create it. Do not remove or rename any existing keys.

```json
// Inside the "expo" → "ios" object, add or merge:
"infoPlist": {
  "UIBackgroundModes": ["fetch", "remote-notification"]
}
```

> Do not touch the `android` block, `plugins`, `extra`, or any other top-level key.
> The `expo-location` permission strings added in Task 79 must remain untouched.

---

### `services/firebase/firestore.ts` — Update

Add `updateLastActive` as a standalone named export. Place it after the existing
`incrementDailyLikes` export and before any Phase 3 additions. Do not modify any other
function in this file.

```typescript
// Add this named export — standalone, no Zustand imports, no store coupling:

export const updateLastActive = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { lastActive: serverTimestamp() })
}
```

> This function exists for two callers: the foreground heartbeat inside `useLastActive`
> and the background task defined at module scope in `useLastActive.ts`. Keeping it here
> makes it importable from any JS context without pulling in Zustand.
>
> The `updateDoc`, `doc`, `db`, and `serverTimestamp` identifiers are already imported
> at the top of `services/firebase/firestore.ts`. Do not add duplicate imports.
>
> Do not touch `createUserProfile`, `updateUserProfile`, `getUserProfile`,
> `getDailyLikesDoc`, or `incrementDailyLikes`.

---

### `store/authStore.ts` — Update

Two targeted changes only — do not alter any other logic, the persist config, or
any other action:

```typescript
// 1. Add import at the top of the file (third-party block, alphabetical order):
import AsyncStorage from '@react-native-async-storage/async-storage'

// 2. After every successful login that resolves a uid, add:
await AsyncStorage.setItem('fitlink-uid', uid)

// This must be added in the onAuthStateChanged / auth listener callback where uid
// is first confirmed. Look for where authStore sets uid and isAuthenticated to true
// after a successful Firebase auth resolution — add the AsyncStorage write there.

// 3. Inside the logout() action, add:
await AsyncStorage.removeItem('fitlink-uid')
// Place this alongside the existing Zustand state reset / SplashScreen / other cleanup.
```

> The explicit `AsyncStorage.setItem` is intentional duplication alongside Zustand
> persist. Zustand persist is unavailable in the background task's isolated JS context;
> the raw AsyncStorage key is the only safe cross-context uid channel.
>
> The key `'fitlink-uid'` must be exactly this string — the task definition in
> `useLastActive.ts` reads this same key.
>
> Do not touch the persist config, `hasCompletedOnboarding`, `isLoading`,
> `setIsLoading`, `fetchProfile` calls, `SplashScreen.hideAsync`, or any other
> existing action.

---

### `hooks/useLastActive.ts` — Full Rewrite

> This file is small enough to rewrite in full to avoid partial-edit drift. The
> existing logic (AppState listener, setInterval heartbeat, auth guard) is preserved
> and extended with:
> 1. Module-scope `TaskManager.defineTask` registration (required before any component
>    mounts — must be at module scope, not inside the hook or a useEffect)
> 2. A `useEffect` inside the hook that calls `BackgroundFetch.registerTaskAsync`
> 3. The foreground heartbeat now calls `updateLastActive(uid)` from the service layer
>    instead of the previously inlined `updateDoc`

```typescript
// 1. React imports
import { useEffect, useRef } from 'react'

// 2. React Native imports
import { AppState, AppStateStatus } from 'react-native'

// 3. Third-party libraries (alphabetical)
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'

// 4. Internal — stores
import { useAuthStore } from '@/store/authStore'

// 7. Internal — services
import { updateLastActive } from '@/services/firebase/firestore'

// ─── Module-scope background task definition ──────────────────────────────────
// Must be defined at module scope — TaskManager requires the task to be registered
// before any component mounts. Never define this inside the hook or a useEffect.
// This code runs in an isolated JS context: no Zustand, no React, AsyncStorage only.

const BACKGROUND_FETCH_TASK = 'fitlink-lastactive-fetch'

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const uid = await AsyncStorage.getItem('fitlink-uid')
    if (!uid) return BackgroundFetch.BackgroundFetchResult.NoData
    await updateLastActive(uid)
    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useLastActive = (): void => {
  const uid = useAuthStore((s) => s.uid)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  // Foreground heartbeat — writes lastActive on foreground and every 5 minutes
  useEffect(() => {
    if (!uid) return

    const writeLastActive = (): void => {
      updateLastActive(uid).catch(() => {
        // Silently ignored — heartbeat failures are non-critical
      })
    }

    const startInterval = (): void => {
      writeLastActive()
      intervalRef.current = setInterval(writeLastActive, 5 * 60 * 1000)
    }

    const stopInterval = (): void => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          startInterval()
        } else if (
          appStateRef.current === 'active' &&
          nextState.match(/inactive|background/)
        ) {
          writeLastActive()
          stopInterval()
        }
        appStateRef.current = nextState
      },
    )

    startInterval()

    return () => {
      subscription.remove()
      stopInterval()
    }
  }, [uid])

  // Background fetch registration — iOS only (Android and Expo Go silently reject)
  useEffect(() => {
    BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 300, // 5 minutes — OS may choose a longer interval
      stopOnTerminate: false,
      startOnBoot: false,
    }).catch(() => {
      // Silently ignored — Expo Go and simulators do not support background fetch.
      // This catch must remain: removing it causes an unhandled rejection in dev.
    })

    return () => {
      BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK).catch(() => {})
    }
  }, [])
}
```

> Do not add a `StyleSheet` block — this is a hook, not a component.
> Do not import `updateDoc`, `doc`, or `serverTimestamp` directly — all Firestore
> writes go through `updateLastActive` from the service layer.
> The `BACKGROUND_FETCH_TASK` string constant must be defined once at module scope and
> referenced in both `defineTask` and `registerTaskAsync` — never duplicated as a
> string literal.

---

### `BUILD.md` — Update

Append the following entry to the existing development-build requirements section.
Do not reformat or remove existing entries (expo-video from Task 77, voice messages
from Task 76, native fitness integrations, Apple Sign-In, biometrics):

```markdown
## Background Fetch (`expo-background-fetch`, `expo-task-manager`)

- Background `lastActive` updates require a **development build** — Expo Go silently
  rejects `BackgroundFetch.registerTaskAsync` and the task will never fire in the
  managed runtime.
- `TaskManager.defineTask` must be called at module scope before any component mounts.
  If the background task is not being triggered in a dev build, confirm the task name
  string in `defineTask` and `registerTaskAsync` match exactly: `'fitlink-lastactive-fetch'`.
- `UIBackgroundModes: ['fetch', 'remote-notification']` is set in `app.json`
  `ios.infoPlist` and is included in all EAS builds automatically.
- The `minimumInterval` of 300 seconds is a hint only — iOS may batch background
  fetches and call the task less frequently (typically every 15–60 minutes in practice).
  This is expected and acceptable for `lastActive` granularity.
```

---

## Important Architecture Notes for Codex

1. **`TaskManager.defineTask` must be at module scope, not inside the hook.** Expo's
   task manager requires tasks to be defined before any component is mounted. If
   `defineTask` is placed inside `useEffect` or the hook body, it will fail silently
   on the first background wake.

2. **No Zustand inside the background task.** The background task body runs in an
   isolated JS context where Zustand stores are not initialised. Only `AsyncStorage`
   and functions that do not transitively import stores may be used. `updateLastActive`
   in `services/firebase/firestore.ts` must remain store-free — do not add store
   imports to it.

3. **`updateLastActive` is the single Firestore write path for `lastActive`.** Both
   the foreground heartbeat and the background task use this function. Never re-inline
   `updateDoc(doc(db, 'users', uid), { lastActive: serverTimestamp() })` in the hook
   body after this task — that would create two independent write paths that can drift.

4. **The `AsyncStorage.setItem('fitlink-uid', uid)` in `authStore` is not redundant
   with Zustand persist.** Zustand's persist rehydration is synchronous but occurs
   only when the store is first accessed from a component. The background task's
   isolated context never triggers Zustand rehydration. The raw `AsyncStorage` key is
   the only reliable uid channel for the task.

5. **The `catch(() => {})` blocks on `registerTaskAsync` and `unregisterTaskAsync`
   must not be removed.** They are intentionally silent to prevent development-time
   crashes in Expo Go and simulators. This is not suppression of a real error — these
   environments legitimately do not support background fetch.

6. **`minimumInterval: 300` is a hint, not a guarantee.** iOS will batch background
   fetch tasks and may call the handler as infrequently as every 15–60 minutes in
   practice. Do not add any logic that relies on precise 5-minute background cadence.

7. **`startOnBoot: false` is correct.** The app requires the user to have logged in
   at least once (to write the uid to AsyncStorage) before the background task is
   meaningful. Boot-start would fire before the user has ever opened the app.

8. **`app.json` ios.infoPlist is additive.** The `expo-location` `NSLocationWhenInUseUsageDescription` added in Task 79 must remain. Only the `UIBackgroundModes` array is added.

---

## Acceptance Criteria

- [ ] `npx expo install expo-background-fetch expo-task-manager` run and both appear in
      `package.json` dependencies
- [ ] `app.json` `ios.infoPlist` contains `"UIBackgroundModes": ["fetch", "remote-notification"]`
      without removing the Task 79 location permission string
- [ ] `services/firebase/firestore.ts` exports `updateLastActive(uid: string): Promise<void>`
      as a named export; no other functions in the file are changed
- [ ] `store/authStore.ts` calls `AsyncStorage.setItem('fitlink-uid', uid)` after
      successful login resolution; calls `AsyncStorage.removeItem('fitlink-uid')` in
      `logout()`; no other logic is altered
- [ ] `hooks/useLastActive.ts` defines `TaskManager.defineTask(BACKGROUND_FETCH_TASK, ...)`
      at **module scope** (outside the hook function body)
- [ ] The background task body uses only `AsyncStorage.getItem` and `updateLastActive` —
      no Zustand store import anywhere in the task definition
- [ ] `BACKGROUND_FETCH_TASK` constant is defined once as `'fitlink-lastactive-fetch'`
      and referenced in both `defineTask` and `registerTaskAsync` — no string literal
      duplication
- [ ] `BackgroundFetch.registerTaskAsync` is called inside a `useEffect(() => {}, [])` in
      the hook; its returned Promise has a `.catch(() => {})` that is not removed
- [ ] `BackgroundFetch.unregisterTaskAsync` is called in the `useEffect` cleanup with
      its own `.catch(() => {})`
- [ ] Foreground heartbeat calls `updateLastActive(uid)` — no direct `updateDoc` call
      remains in `useLastActive.ts`
- [ ] `AppState` listener and `setInterval` heartbeat logic from the original hook is
      preserved: write on foreground return, write + stop interval on background
- [ ] `BUILD.md` documents that background fetch requires a development build and notes
      the task name string for debugging
- [ ] All imports in `hooks/useLastActive.ts` use `@/` alias for internal modules
- [ ] Zero `any`, zero `console.*`, zero inline styles in all touched files
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`functions/src/`, `firestore.rules`, `firestore.indexes.json`,
`store/discoveryStore.ts`, `store/profileStore.ts`, `store/matchStore.ts`,
`store/chatStore.ts`, `store/checkinStore.ts`, `store/eventsStore.ts`,
`store/fitnessStore.ts`, `services/firebase/auth.ts`, `services/firebase/storage.ts`,
`services/firebase/realtime.ts`, `services/places.ts`, `types/`, `constants/`,
`i18n/`, `components/`, `app/`, `hooks/useNotifications.ts`, `hooks/useBiometric.ts`,
`App.tsx`

---

## Commit

```
git commit -m "task-83: background lastActive updates for iOS via expo-background-fetch"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3D - Task 83] - YYYY-MM-DD

### Completed

- Task 83: Background lastActive Updates (iOS)
- expo-background-fetch and expo-task-manager installed
- updateLastActive(uid): extracted as named export from services/firebase/firestore.ts;
  used by both foreground heartbeat and background task
- useLastActive.ts: TaskManager.defineTask registered at module scope with
  'fitlink-lastactive-fetch' task name; BackgroundFetch.registerTaskAsync called in
  a useEffect(() => {}, []) with silent catch; foreground heartbeat refactored to call
  updateLastActive() from the service layer
- authStore: AsyncStorage.setItem('fitlink-uid', uid) on login;
  AsyncStorage.removeItem('fitlink-uid') in logout() — provides uid to isolated
  background task JS context without Zustand
- app.json: UIBackgroundModes ['fetch', 'remote-notification'] added to ios.infoPlist
- BUILD.md: background fetch development-build requirement documented with task name
  string and minimumInterval behaviour note

### Files Created / Modified

- services/firebase/firestore.ts: updateLastActive(uid) named export added
- store/authStore.ts: AsyncStorage uid persistence on login/logout added
- hooks/useLastActive.ts: rewritten — module-scope task definition, background
  fetch registration useEffect, foreground heartbeat using service layer
- app.json: UIBackgroundModes added to ios.infoPlist
- BUILD.md: background fetch section added

### Architecture Decisions

- TaskManager.defineTask placed at module scope to satisfy Expo's requirement that
  tasks are registered before any component mounts
- Background task body imports only AsyncStorage and updateLastActive — no Zustand,
  no React, no store — because it runs in an isolated JS context
- AsyncStorage.setItem('fitlink-uid') duplicates Zustand persist intentionally;
  Zustand rehydration is not available in the isolated background task context
- catch(() => {}) on registerTaskAsync and unregisterTaskAsync is intentional and
  must not be removed; Expo Go and simulators legitimately reject background fetch

### Known Issues / Deferred

- Background fetch requires a development build; cannot be verified in Expo Go
- iOS calls the handler as infrequently as every 15–60 minutes regardless of
  minimumInterval: 300 — this is expected OS behaviour, not a bug
- Android background fetch support is not addressed in this task; Android uses
  WorkManager under the hood via expo-background-fetch but the implementation is
  iOS-primary per the task spec

### Verification

- npx tsc --noEmit passes
- git diff --check passes
- Scoped scans confirm no any, no console.*, no inline style={{ }}, no Zustand
  imports inside the TaskManager.defineTask callback, no direct updateDoc calls
  remaining in useLastActive.ts

### Next Up

- Task 84: Notification Badge Count & Granular Preferences
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 84 prompt.  

---

## Reasoning Level

High

> Rationale: This task spans three distinct execution contexts (foreground React component
> tree, AppState listener interval, and the isolated background JS context), each with
> different import constraints. A single misplaced import of Zustand into the background
> task body causes a silent runtime failure that is difficult to diagnose in a development
> build. The `TaskManager.defineTask` / `registerTaskAsync` split, the intentional
> `AsyncStorage` uid duplication, and the foreground-to-service-layer refactor all carry
> meaningful drift risk if implemented out of order or partially.
