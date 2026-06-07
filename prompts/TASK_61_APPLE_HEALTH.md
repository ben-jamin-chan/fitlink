# CODEX PROMPT — Task 61: Apple Health Integration
@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2D — Fitness Integrations. Task 60 (Strava OAuth) is complete and verified.

The fitness infrastructure is fully in place:

- `types/fitness.ts` — canonical fitness type re-export point: `FitnessSource`, `TodayStats`, `WorkoutSession`, `FitnessConnectionStatus`, `StravaActivity`
- `types/subscription.ts` — source of truth for `TodayStats`, `WorkoutSession`, `FitnessTrackingSource`; `TodayStats.updatedAt` is typed as `Timestamp | null`
- `store/fitnessStore.ts` — `useFitnessStore` with `fetchTodayStats(uid)`, `setShareOnProfile(uid, enabled)`, `connectSource(source, uid)`, `disconnectSource(source, uid)`, `syncNow(source, uid)`, `setConnectionStatus(source, status)` — the strava branch in `connectSource`/`disconnectSource`/`syncNow` is already wired; the `appleHealth` branch currently hits the stub code path (`console.warn`)
- `services/strava.ts` — `connectStrava()`, `syncStrava()`, `disconnectStrava()` — pattern reference for how a fitness source service is structured
- `services/firebase/firestore.ts` — `updateUserProfile(uid, partial)` available
- `constants/theme.ts` — `colors`, `spacing`, `typography` re-exported
- `i18n/en.json` — `fitness.*` namespace fully seeded in all 4 language files; add any new keys under `fitness.appleHealth.*`
- `utils/imageUtils.ts` — `compressImage()` available as a reference (same pattern for async utility functions)

**The `connectSource` / `disconnectSource` / `syncNow` dispatch in `fitnessStore.ts` already has stubs for `'appleHealth'`. This task wires those stubs to real implementations. Do not restructure the store's dispatch shape — only replace the `console.warn` stub bodies with real calls.**

**This entire task is iOS-only. Every function in `services/healthKit.ts` and every call-site in `hooks/useAppleHealth.ts` must be guarded with `Platform.OS === 'ios'`. If `Platform.OS !== 'ios'`, return early or resolve with a safe no-op value. Never call any HealthKit API on Android.**

**`react-native-health` is a bare workflow native module. It requires a development build — it does not work in Expo Go. Add a comment where the install command is required and document this in the task's acceptance criteria.**

---

## Task 61 — Apple Health Integration (iOS)

**Files to create:**
- `services/healthKit.ts`
- `hooks/useAppleHealth.ts`

**Files to modify:**
- `store/fitnessStore.ts` — wire `appleHealth` branch in `connectSource`, `disconnectSource`, `syncNow`
- `i18n/en.json` — add `fitness.appleHealth.*` keys
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — mirror new keys with English placeholders

---

### Install Step (Document — Codex cannot run this)

Before writing any code, add this comment block at the top of `services/healthKit.ts`:

```typescript
/*
 * INSTALL REQUIRED (development build only — does not work in Expo Go):
 *   npx expo install react-native-health
 *
 * Add to app.json plugins array:
 *   ["react-native-health", {
 *     "NSHealthShareUsageDescription": "fitlink reads your activity to show your fitness stats to matches.",
 *     "NSHealthUpdateUsageDescription": "fitlink does not write to Apple Health."
 *   }]
 *
 * Then rebuild: eas build --profile development --platform ios
 */
```

---

### `services/healthKit.ts`

This is the sole interface between the app and Apple HealthKit. All HealthKit logic is isolated here — no HealthKit imports anywhere else. The store and hook call only the functions exported from this file.

```typescript
// 1. React imports
import { Platform } from 'react-native'

// 2. Third-party libraries
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
} from 'react-native-health'

// 3. Internal — services
import { updateUserProfile } from '@/services/firebase/firestore'

// 4. Internal — types
import type { TodayStats, WorkoutSession } from '@/types/fitness'
import type { Timestamp } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Permission set
// ---------------------------------------------------------------------------

const HEALTHKIT_PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.Workout,
    ],
    write: [],
  },
}

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

/**
 * Returns true if HealthKit can be used on this device.
 * Always false on Android.
 */
export const isAppleHealthAvailable = (): boolean => {
  if (Platform.OS !== 'ios') return false
  return AppleHealthKit.isAvailable !== undefined
}

// ---------------------------------------------------------------------------
// requestPermissions
// ---------------------------------------------------------------------------

/**
 * Requests HealthKit read permissions for steps, distance, active energy, and
 * workouts. Resolves true on success, false on denial or non-iOS.
 */
export const requestAppleHealthPermissions = (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return Promise.resolve(false)

  return new Promise<boolean>((resolve) => {
    AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (err: string) => {
      if (err) {
        resolve(false)
        return
      }
      resolve(true)
    })
  })
}

// ---------------------------------------------------------------------------
// fetchTodayStats
// ---------------------------------------------------------------------------

/**
 * Reads today's step count, walking/running distance (converted km), active
 * calories, and workout sessions from HealthKit.
 * Returns a TodayStats object with updatedAt: null — Firestore serverTimestamp
 * is written by updateAppleHealthFirestore.
 * Safe no-op on Android.
 */
export const fetchAppleHealthTodayStats = (): Promise<TodayStats> => {
  if (Platform.OS !== 'ios') {
    return Promise.resolve({
      steps: 0,
      distance: 0,
      calories: 0,
      workouts: [],
      updatedAt: null,
    })
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const options = {
    date: startOfToday.toISOString(),
    includeManuallyAdded: true,
  }

  const fetchSteps = (): Promise<number> =>
    new Promise<number>((resolve) => {
      AppleHealthKit.getStepCount(options, (_err: string, result: HealthValue) => {
        resolve(result?.value ?? 0)
      })
    })

  const fetchDistance = (): Promise<number> =>
    new Promise<number>((resolve) => {
      AppleHealthKit.getDistanceWalkingRunning(
        options,
        (_err: string, result: HealthValue) => {
          // HealthKit returns metres — convert to km
          resolve((result?.value ?? 0) / 1000)
        },
      )
    })

  const fetchCalories = (): Promise<number> =>
    new Promise<number>((resolve) => {
      AppleHealthKit.getActiveEnergyBurned(
        { ...options, startDate: startOfToday.toISOString(), endDate: new Date().toISOString() },
        (_err: string, results: HealthValue[]) => {
          const total = Array.isArray(results)
            ? results.reduce((sum, r) => sum + (r.value ?? 0), 0)
            : 0
          resolve(Math.round(total))
        },
      )
    })

  const fetchWorkouts = (): Promise<WorkoutSession[]> =>
    new Promise<WorkoutSession[]>((resolve) => {
      AppleHealthKit.getSamples(
        {
          startDate: startOfToday.toISOString(),
          endDate: new Date().toISOString(),
          type: 'Workout',
        },
        (_err: string, results: Array<Record<string, unknown>>) => {
          if (!Array.isArray(results)) {
            resolve([])
            return
          }
          const sessions: WorkoutSession[] = results.map((w) => ({
            type: typeof w['activityName'] === 'string' ? w['activityName'] : 'Workout',
            duration:
              typeof w['duration'] === 'number'
                ? Math.round(w['duration'] / 60) // seconds → minutes
                : 0,
            distance:
              typeof w['distance'] === 'number'
                ? w['distance'] / 1000 // metres → km
                : undefined,
            calories:
              typeof w['calories'] === 'number'
                ? Math.round(w['calories'])
                : undefined,
          }))
          resolve(sessions)
        },
      )
    })

  return Promise.all([fetchSteps(), fetchDistance(), fetchCalories(), fetchWorkouts()]).then(
    ([steps, distance, calories, workouts]) => ({
      steps,
      distance,
      calories,
      workouts,
      updatedAt: null, // set server-side in updateAppleHealthFirestore
    }),
  )
}

// ---------------------------------------------------------------------------
// updateAppleHealthFirestore
// ---------------------------------------------------------------------------

/**
 * Writes today's HealthKit stats to Firestore under
 * users/{uid}.fitnessTracking.todayStats.
 * Uses updateUserProfile so the write respects security rules.
 * Safe no-op on Android.
 */
export const updateAppleHealthFirestore = async (
  uid: string,
  stats: Omit<TodayStats, 'updatedAt'>,
): Promise<void> => {
  if (Platform.OS !== 'ios') return

  const { serverTimestamp } = await import('firebase/firestore')

  await updateUserProfile(uid, {
    'fitnessTracking.todayStats': {
      ...stats,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    },
  })
}

// ---------------------------------------------------------------------------
// setAppleHealthConnected
// ---------------------------------------------------------------------------

/**
 * Updates users/{uid}.fitnessTracking.appleHealth.connected and lastSync
 * in Firestore. Safe no-op on Android.
 */
export const setAppleHealthConnected = async (
  uid: string,
  connected: boolean,
): Promise<void> => {
  if (Platform.OS !== 'ios') return

  const { serverTimestamp } = await import('firebase/firestore')

  await updateUserProfile(uid, {
    'fitnessTracking.appleHealth': {
      connected,
      lastSync: connected ? (serverTimestamp() as unknown as Timestamp) : null,
    },
  })
}
```

---

### `hooks/useAppleHealth.ts`

This hook owns the iOS-side HealthKit lifecycle: permission request on mount, foreground auto-sync via `AppState`, and exposes `isConnected`, `todayStats`, `sync()`, and `disconnect()` to callers.

The hook is consumed by `fitnessStore` through `connectSource` / `disconnectSource` / `syncNow`. It should not be called directly from screens — screens read from `fitnessStore`.

```typescript
// 1. React imports
import { useEffect, useRef, useCallback } from 'react'

// 2. React Native imports
import { Platform, AppState, AppStateStatus } from 'react-native'

// 3. Internal — stores
import { useFitnessStore } from '@/store/fitnessStore'
import { useAuthStore } from '@/store/authStore'

// 4. Internal — services
import {
  requestAppleHealthPermissions,
  fetchAppleHealthTodayStats,
  updateAppleHealthFirestore,
  setAppleHealthConnected,
} from '@/services/healthKit'

// 5. Internal — types
import type { TodayStats } from '@/types/fitness'

// ---------------------------------------------------------------------------

interface UseAppleHealthReturn {
  isConnected: boolean
  todayStats: TodayStats | null
  sync: () => Promise<void>
  disconnect: () => Promise<void>
}

export const useAppleHealth = (): UseAppleHealthReturn => {
  // Non-iOS: return a static no-op object — hook body must not call any
  // HealthKit APIs on Android
  if (Platform.OS !== 'ios') {
    return {
      isConnected: false,
      todayStats: null,
      sync: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
    }
  }

  const { user } = useAuthStore()
  const { connections, todayStats, setConnectionStatus, fetchTodayStats } = useFitnessStore()

  const isConnected = connections.appleHealth?.connected ?? false
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const syncInFlightRef = useRef<boolean>(false)

  // ---------------------------------------------------------------------------
  // sync: fetch from HealthKit → write to Firestore → refresh store
  // ---------------------------------------------------------------------------

  const sync = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'ios') return
    if (!user?.uid) return
    if (syncInFlightRef.current) return

    syncInFlightRef.current = true
    try {
      const stats = await fetchAppleHealthTodayStats()
      await updateAppleHealthFirestore(user.uid, {
        steps: stats.steps,
        distance: stats.distance,
        calories: stats.calories,
        workouts: stats.workouts,
      })
      await fetchTodayStats(user.uid)
    } finally {
      syncInFlightRef.current = false
    }
  }, [user?.uid, fetchTodayStats])

  // ---------------------------------------------------------------------------
  // disconnect: mark disconnected in Firestore and update store
  // ---------------------------------------------------------------------------

  const disconnect = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'ios') return
    if (!user?.uid) return

    await setAppleHealthConnected(user.uid, false)
    setConnectionStatus('appleHealth', { connected: false, lastSync: null })
  }, [user?.uid, setConnectionStatus])

  // ---------------------------------------------------------------------------
  // On mount: request permissions if not yet connected, then sync
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    if (!user?.uid) return

    const init = async (): Promise<void> => {
      if (!isConnected) {
        const granted = await requestAppleHealthPermissions()
        if (!granted) return

        await setAppleHealthConnected(user.uid!, true)
        setConnectionStatus('appleHealth', {
          connected: true,
          lastSync: null, // Firestore serverTimestamp written by setAppleHealthConnected
        })
      }
      await sync()
    }

    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  // ---------------------------------------------------------------------------
  // AppState listener: auto-sync when app comes to foreground
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === 'active' &&
          isConnected
        ) {
          void sync()
        }
        appStateRef.current = nextState
      },
    )

    return () => {
      subscription.remove()
    }
  }, [isConnected, sync])

  return {
    isConnected,
    todayStats,
    sync,
    disconnect,
  }
}
```

---

### `store/fitnessStore.ts` — Update (appleHealth branch only)

Wire the `appleHealth` stub branches in `connectSource`, `disconnectSource`, and `syncNow` to call `services/healthKit.ts`. Do not touch the `strava` or `googleFit` branches, and do not restructure the dispatch shape.

The store cannot call the hook directly (hooks cannot be called from outside React components). Instead, the store's `connectSource('appleHealth', uid)` branch should call `requestAppleHealthPermissions()` and `setAppleHealthConnected()` directly — these are plain async functions, not hooks.

`syncNow('appleHealth', uid)` should call `fetchAppleHealthTodayStats()` → `updateAppleHealthFirestore()` → `fetchTodayStats(uid)`.

`disconnectSource('appleHealth', uid)` should call `setAppleHealthConnected(uid, false)` then `setConnectionStatus`.

```typescript
// Add imports at top of store/fitnessStore.ts (after existing imports):
import {
  requestAppleHealthPermissions,
  fetchAppleHealthTodayStats,
  updateAppleHealthFirestore,
  setAppleHealthConnected,
} from '@/services/healthKit'

// Replace only the 'appleHealth' case inside connectSource:
case 'appleHealth': {
  if (Platform.OS !== 'ios') return
  const granted = await requestAppleHealthPermissions()
  if (!granted) return
  await setAppleHealthConnected(uid, true)
  set((s) => ({
    connections: {
      ...s.connections,
      appleHealth: { connected: true, lastSync: null },
    },
  }))
  break
}

// Replace only the 'appleHealth' case inside disconnectSource:
case 'appleHealth': {
  if (Platform.OS !== 'ios') return
  await setAppleHealthConnected(uid, false)
  get().setConnectionStatus('appleHealth', { connected: false, lastSync: null })
  break
}

// Replace only the 'appleHealth' case inside syncNow:
case 'appleHealth': {
  if (Platform.OS !== 'ios') return
  const stats = await fetchAppleHealthTodayStats()
  await updateAppleHealthFirestore(uid, {
    steps: stats.steps,
    distance: stats.distance,
    calories: stats.calories,
    workouts: stats.workouts,
  })
  await get().fetchTodayStats(uid)
  break
}
```

Add `import { Platform } from 'react-native'` to `store/fitnessStore.ts` if not already present.

---

### `i18n/en.json` — Update

Add under the `fitness` namespace (alongside the existing `fitness.appleHealth` placeholder if one exists, otherwise add the full block):

```json
{
  "fitness": {
    "appleHealth": {
      "name": "Apple Health",
      "connectPrompt": "Connect Apple Health to share your activity with matches.",
      "permissionDenied": "Permission denied. Enable Apple Health access in your device Settings.",
      "syncSuccess": "Apple Health synced",
      "syncError": "Could not sync Apple Health. Please try again.",
      "disconnectConfirmTitle": "Disconnect Apple Health?",
      "disconnectConfirmMessage": "Your activity stats will no longer update from Apple Health.",
      "notAvailable": "Apple Health is only available on iOS."
    }
  }
}
```

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Mirror the same `fitness.appleHealth.*` keys with the same English values as placeholders. Do not modify any other keys in these files.

---

## Important Architecture Notes for Codex

1. **iOS-only guard is unconditional.** Every exported function in `services/healthKit.ts` must return a safe resolved value (`false`, `0`, `[]`, or `Promise.resolve()`) when `Platform.OS !== 'ios'`. The same guard must appear at the top of `hooks/useAppleHealth.ts`. If `Platform.OS !== 'ios'` is ever absent from a HealthKit call site, that is a bug and must be corrected before committing.

2. **No inline styles.** `hooks/useAppleHealth.ts` and `services/healthKit.ts` contain no JSX, so no style rules apply. If any JSX is accidentally added, it must use `StyleSheet.create` per CONVENTIONS.md Section 6.

3. **Store dispatch shape is immutable.** Do not rename or add new parameters to `connectSource`, `disconnectSource`, or `syncNow`. Only the `case 'appleHealth'` body changes. The function signatures are the same as after Task 60.

4. **No `new Date()` for timestamp writes.** `setAppleHealthConnected` writes `lastSync` using `serverTimestamp()` from `firebase/firestore` — never `new Date()`. The dynamic import pattern (`await import('firebase/firestore')`) matches the project's existing pattern in `healthKit.ts` if used; alternatively, import `serverTimestamp` at the top of the file as a named import. Choose whichever matches the existing pattern in `services/strava.ts` and `services/firebase/firestore.ts`.

5. **`sync()` is re-entrant safe.** The `syncInFlightRef` in `useAppleHealth` ensures only one sync runs at a time. Do not remove it.

6. **`useAppleHealth` is not called from screens.** Screens and the `ConnectedAppsScreen` (Task 64) read `fitnessStore` state. The hook is exposed for use in a root-level component if needed (Task 64 will determine placement). Do not add `useAppleHealth()` calls to any screen in this task.

7. **`TodayStats.updatedAt` is `null` on the value returned from `fetchAppleHealthTodayStats`.** The real timestamp is written server-side by `updateAppleHealthFirestore`. This matches the `TodayStats.updatedAt: Timestamp | null` type established in Task 59 and the pattern used by Strava in Task 60.

8. **`react-native-health` types.** The `HealthValue`, `HealthKitPermissions`, and `getSamples` callback shapes come from the `react-native-health` package types. Use `unknown` narrowed with `typeof` guards when the type is `Record<string, unknown>`, as shown in the `fetchWorkouts` implementation above. Do not use `any`.

9. **No `console.log` in any file.** The stub `console.warn` in the `appleHealth` branch of `fitnessStore` must be removed when the branch is replaced. Confirm no new `console.log` statements are added anywhere.

---

## Acceptance Criteria

- [ ] `services/healthKit.ts` created and exports `isAppleHealthAvailable`, `requestAppleHealthPermissions`, `fetchAppleHealthTodayStats`, `updateAppleHealthFirestore`, `setAppleHealthConnected` as named exports
- [ ] Every exported function in `services/healthKit.ts` returns a safe no-op value when `Platform.OS !== 'ios'`
- [ ] `hooks/useAppleHealth.ts` created and exports `useAppleHealth` as a named export
- [ ] `useAppleHealth` returns `{ isConnected: false, todayStats: null, sync: noop, disconnect: noop }` immediately when `Platform.OS !== 'ios'` — without calling any HealthKit APIs
- [ ] `store/fitnessStore.ts` `appleHealth` branches in `connectSource`, `disconnectSource`, `syncNow` are wired to real `services/healthKit.ts` functions — no more `console.warn` stubs
- [ ] `store/fitnessStore.ts` `strava` and `googleFit` branches are unchanged
- [ ] `AppState` listener in `useAppleHealth` fires `sync()` on foreground only when `isConnected === true`
- [ ] `syncInFlightRef` prevents concurrent HealthKit syncs
- [ ] `updateAppleHealthFirestore` writes `lastSync` using `serverTimestamp()` — no `new Date()` anywhere in the file
- [ ] `TodayStats.updatedAt` is `null` in the value returned from `fetchAppleHealthTodayStats` — Firestore serverTimestamp is written inside `updateAppleHealthFirestore`
- [ ] `fitness.appleHealth.*` keys added to `en.json` and mirrored (English placeholder values) to `my.json`, `zh.json`, `ta.json`
- [ ] Install comment block present at top of `services/healthKit.ts` with the exact `npx expo install react-native-health` command and `app.json` plugin config
- [ ] All imports use `@/` alias — zero relative paths
- [ ] Zero `any` in all touched files
- [ ] Zero inline styles in all touched files
- [ ] Zero `console.log` or `console.warn` in all touched files
- [ ] `npx tsc --noEmit` passes with zero errors at project root
- [ ] `npx tsc --noEmit` passes with zero errors in `functions/` (no functions/ changes expected)

---

## Do Not Touch

`App.tsx`, `services/strava.ts`, `store/authStore.ts`, `store/profileStore.ts`,
`store/discoveryStore.ts`, `store/subscriptionStore.ts`, `services/firebase/config.ts`,
`services/firebase/auth.ts`, `services/firebase/realtime.ts`, `types/user.ts`,
`types/match.ts`, `types/message.ts`, `functions/src/`, `firestore.rules`,
`firestore.indexes.json`, `constants/`, `components/`

---

## Commit

```
git commit -m "task-61: apple health integration (services/healthKit.ts, hooks/useAppleHealth.ts, fitnessStore wired)"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2D - Task 61] - YYYY-MM-DD

### Completed

- Task 61: Apple Health Integration (iOS only)
- services/healthKit.ts: created - isAppleHealthAvailable, requestAppleHealthPermissions, fetchAppleHealthTodayStats, updateAppleHealthFirestore, setAppleHealthConnected; all guarded with Platform.OS === 'ios'
- hooks/useAppleHealth.ts: created - isConnected, todayStats, sync(), disconnect(); AppState listener for foreground auto-sync; syncInFlightRef prevents concurrent syncs
- store/fitnessStore.ts: appleHealth branch wired in connectSource, disconnectSource, syncNow; console.warn stubs removed
- i18n: fitness.appleHealth.* namespace added to all 4 language files

### Files Created / Modified

- services/healthKit.ts: created - 5 named exports, full iOS guard pattern
- hooks/useAppleHealth.ts: created - useAppleHealth named export, AppState lifecycle, re-entrant sync guard
- store/fitnessStore.ts: appleHealth case bodies replaced in 3 actions; Platform import added
- i18n/en.json: fitness.appleHealth.* keys added
- i18n/my.json, zh.json, ta.json: fitness.appleHealth.* mirrored with English placeholders

### Architecture Decisions

- [Note any decisions made that differ from or extend the spec above]

### Known Issues / Deferred

- react-native-health requires a development build; cannot be tested in Expo Go
- [Any other deferred items]

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/
- Targeted checks confirm zero any, zero console.warn/log, zero new Date() in healthKit.ts, all Platform.OS guards present

### Next Up

- Task 62: Google Fit Integration (services/googleFit.ts, hooks/useGoogleFit.ts, Android only)
```

---

## Reasoning Level

High — involves native module type narrowing with `unknown` guards, cross-platform safety invariants, async concurrency protection, and store dispatch wiring that must not regress the existing Strava and googleFit stubs.
