# CODEX PROMPT — Task 45
# lastActive Heartbeat

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1F is nearly complete. Relevant existing files:

- `store/authStore.ts` — exports `useAuthStore`; state includes `user: FirebaseUser | null`, `isAuthenticated: boolean`. The `initialise()` function is called from `App.tsx` on mount.
- `store/profileStore.ts` — exports `useProfileStore`; `profile: UserProfile | null` with `fetchProfile()` and `updateProfile()`. `updateProfile()` calls Firestore `updateDoc` with a partial payload.
- `services/firebase/firestore.ts` — Firestore helpers live here. `updateProfile()` in `profileStore` calls `updateDoc(doc(db, 'users', uid), partial)` directly or via a service function.
- `services/firebase/config.ts` — exports `db` (Firestore instance).
- `App.tsx` — has an `AppRoot` inner component where hooks like `useNotifications()` are already called. `useLastActive()` must be called here too.
- `hooks/useNotifications.ts` — reference for hook pattern called from `AppRoot`.
- `hooks/useBiometric.ts` — reference for hook pattern using `AppState` listener.
- `constants/theme.ts` — all theme tokens. Do not add new constants here.

The `lastActive` field on `/users/{userId}` powers:
- Online status in the chat header ("Active now", "Active 5m ago")
- Online indicator dot in the Matches grid
- Scoring boost in `getDiscoveryStack` Cloud Function (candidates active in last 24h get +5 score)

`lastActive` must be a Firestore `Timestamp` (server-side), written using `serverTimestamp()` — never `new Date()`.

---

## Task 45 — lastActive Heartbeat

**Files to create:**
- `hooks/useLastActive.ts`

**Files to modify:**
- `App.tsx` — call `useLastActive()` inside `AppRoot`

---

### `hooks/useLastActive.ts`

A fire-and-forget hook. No return value. No UI. Invisible infrastructure.

**Behaviour spec:**

1. **On app foreground** (AppState changes to `'active'`): write `lastActive = serverTimestamp()` to `/users/{userId}`.
2. **Interval while foregrounded**: repeat every 5 minutes (300 000 ms) while app remains in `'active'` state.
3. **On app background** (`AppState` changes to `'background'` or `'inactive'`): write one final `lastActive` update, then clear the interval.
4. **On mount** (initial app open): treat as a foreground transition — write immediately and start interval.
5. **On unmount** (rare — app unmounting): clear interval and listener.
6. **Guard**: only write if `isAuthenticated === true` AND `user?.uid` is present. Never write for unauthenticated sessions.
7. **Silent errors**: catch all Firestore write errors and log to console in `__DEV__`. Never surface errors to the user — this is background infrastructure.

**Implementation notes:**

- Use `AppState` from `react-native` for foreground/background detection.
- Use `useRef` for the interval ID (`intervalRef`) and the AppState subscription (`appStateSubscriptionRef`) so they survive re-renders without triggering effects.
- The write is a simple `updateDoc` — do **not** use `setDoc` (would overwrite the entire document). Import `db` from `@/services/firebase/config`, `doc`, `updateDoc`, `serverTimestamp` from `firebase/firestore`.
- Do not call `profileStore.updateProfile()` for this — that function is for user-initiated profile edits and fires loading state. Write directly with `updateDoc` to avoid polluting loading state.
- The `useEffect` dependency array should contain only `[isAuthenticated, user?.uid]` — re-run if auth state changes.

```typescript
// hooks/useLastActive.ts

import { useEffect, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { useAuthStore } from '@/store/authStore'

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000   // 5 minutes

export const useLastActive = (): void => {
  const { isAuthenticated, user } = useAuthStore()

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const appStateSubscriptionRef = useRef<ReturnType<typeof AppState.addEventListener> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) {
      return
    }

    const uid = user.uid

    const writeLastActive = async (): Promise<void> => {
      try {
        await updateDoc(doc(db, 'users', uid), {
          lastActive: serverTimestamp(),
        })
      } catch (error) {
        if (__DEV__) {
          console.log('[useLastActive] write failed:', error)
        }
      }
    }

    const startHeartbeat = (): void => {
      // Write immediately on foreground
      void writeLastActive()

      // Clear any existing interval before starting a new one
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
      intervalRef.current = setInterval(() => {
        void writeLastActive()
      }, HEARTBEAT_INTERVAL_MS)
    }

    const stopHeartbeat = (): void => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Final write on background
      void writeLastActive()
    }

    const handleAppStateChange = (nextState: AppStateStatus): void => {
      if (nextState === 'active') {
        startHeartbeat()
      } else if (nextState === 'background' || nextState === 'inactive') {
        stopHeartbeat()
      }
    }

    // Initial mount — treat as foreground
    startHeartbeat()

    // Subscribe to AppState changes
    appStateSubscriptionRef.current = AppState.addEventListener(
      'change',
      handleAppStateChange
    )

    return (): void => {
      // Cleanup on unmount or auth change
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (appStateSubscriptionRef.current !== null) {
        appStateSubscriptionRef.current.remove()
        appStateSubscriptionRef.current = null
      }
    }
  }, [isAuthenticated, user?.uid])
}
```

---

### `App.tsx` — Modification

Add `useLastActive()` call inside `AppRoot`, alongside the existing `useNotifications()` call.

```typescript
// Add import:
import { useLastActive } from '@/hooks/useLastActive'

// Inside AppRoot(), add alongside useNotifications():
useLastActive()
```

The full `AppRoot` component already calls `useNotifications(navigationRef)`. `useLastActive()` takes no arguments and returns nothing — add it on the line immediately after `useNotifications`.

Do not touch the provider stack (`GestureHandlerRootView`, `SafeAreaProvider`, `NavigationContainer`), the `navigationRef`, or `ErrorBoundary`.

---

## Architecture Notes for Codex

1. **No profileStore involvement.** Writing `lastActive` must bypass `profileStore.updateProfile()` entirely. That function manages user-initiated form saves and sets `isLoading`. A background heartbeat must not toggle loading state.

2. **`serverTimestamp()` only.** The `lastActive` field is a Firestore `Timestamp`. Never pass `new Date()` or `Date.now()`. The server-side timestamp ensures cross-timezone consistency and powers the discovery scoring algorithm correctly.

3. **Interval restarts on foreground.** When the app returns from background (`AppState → 'active'`), call `startHeartbeat()` which writes immediately AND restarts the 5-minute interval from zero. This prevents a scenario where the user backgrounds for 4 minutes and 50 seconds, then foregrounds — the heartbeat would otherwise not fire for another 10 seconds. Immediate write on foreground is correct.

4. **`void` prefix on async calls in sync context.** `writeLastActive()` is async. When called inside `setInterval` callback (which is sync), prefix with `void` to make the floating promise explicit and satisfy TypeScript strict mode.

5. **`ReturnType<typeof setInterval>`** is the correct type for the interval ref in both browser and React Native environments. Do not use `NodeJS.Timer` or `number`.

6. **`AppState.addEventListener` returns a subscription object** with a `.remove()` method (React Native 0.65+). Store it in a ref and call `.remove()` in cleanup. Do not use the deprecated `AppState.removeEventListener`.

7. **Auth guard placement.** The guard `if (!isAuthenticated || !user?.uid) return` is at the top of the `useEffect`. When the user logs out, `isAuthenticated` becomes `false`, the effect re-runs, the early return fires, and the cleanup function from the previous run removes the interval and AppState listener. No writes occur after logout.

---

## Acceptance Criteria

- [ ] `hooks/useLastActive.ts` created and exported as a named export
- [ ] Hook writes `lastActive: serverTimestamp()` to `/users/{userId}` on mount
- [ ] Hook writes every 5 minutes while app is in foreground
- [ ] Hook writes a final time and clears interval when app goes to background/inactive
- [ ] Hook restarts interval (with immediate write) when app returns to foreground
- [ ] No write occurs when `isAuthenticated === false` or `user?.uid` is undefined
- [ ] All Firestore errors caught silently; logged in `__DEV__` only
- [ ] `updateDoc` used (not `setDoc`) — no other fields overwritten
- [ ] `serverTimestamp()` used (never `new Date()`)
- [ ] Interval ref and AppState subscription ref cleaned up on unmount
- [ ] `useLastActive()` called in `App.tsx` inside `AppRoot` alongside `useNotifications()`
- [ ] No loading state, no toast, no UI side effects
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch

`store/profileStore.ts`, `store/authStore.ts`, `store/discoveryStore.ts`, `services/firebase/firestore.ts`, `hooks/useNotifications.ts`, `hooks/useBiometric.ts`, `components/`, `types/`, `constants/`, `i18n/`, `firestore.rules`, `functions/`

## Commit

`git commit -m "task-45: lastActive heartbeat hook with AppState listener and 5-min interval"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1F — Task 45] — YYYY-MM-DD

### Completed

- Task 45: lastActive heartbeat — useLastActive hook wired into AppRoot
- Writes serverTimestamp() to /users/{uid}.lastActive on app foreground and every 5 minutes
- Final write on background/inactive, interval restarted on return to foreground
- Auth guard prevents writes for unauthenticated sessions
- AppState subscription and interval ref cleaned up on unmount / auth change

### Files Created / Modified

- hooks/useLastActive.ts: AppState listener, setInterval heartbeat, updateDoc serverTimestamp, silent error handling
- App.tsx: useLastActive() called inside AppRoot alongside useNotifications()

### Architecture Decisions

- Direct updateDoc to Firestore — bypasses profileStore.updateProfile() to avoid loading state pollution
- serverTimestamp() enforced — no client Date objects
- Interval restarts with immediate write on foreground — prevents stale lastActive after long backgrounds
- AppState.addEventListener subscription object stored in ref, .remove() called on cleanup

### Known Issues / Deferred

- Background fetch / silent push to trigger lastActive update when app is fully quit — deferred to Phase 2
- lastActive write on app quit (not just background) not guaranteed on iOS — OS may kill app before write completes; acceptable for Phase 1

### Next Up

- Task 46: Final app wiring audit (App.tsx provider order, tsc --noEmit, hardcoded string grep, splash screen)
```

Then bring ARCHITECT.md + this CHANGELOG entry to claude.ai for the Task 46 prompt.

---

## Reasoning Level
Low
