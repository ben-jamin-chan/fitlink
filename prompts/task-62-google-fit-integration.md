# CODEX PROMPT — Task 62: Google Fit Integration (Android)

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 61 (Apple Health) is complete. The following files exist and must be read before making
any changes:

- `services/healthKit.ts` — **the exact structural model to mirror for Google Fit**; exports `isAppleHealthAvailable`, `requestAppleHealthPermissions`, `fetchAppleHealthTodayStats`, `updateAppleHealthFirestore`, `setAppleHealthConnected`; every public function is guarded with `Platform.OS !== 'ios'` early-return pattern
- `hooks/useAppleHealth.ts` — **the exact hook pattern to mirror**; exports `useAppleHealth`; AppState foreground listener; `syncInFlightRef` re-entrant guard; early-return on `Platform.OS !== 'ios'`
- `store/fitnessStore.ts` — `useFitnessStore`; `connectSource`, `disconnectSource`, `syncNow` already have **stub `case 'googleFit':` branches with `console.warn`** — these stubs are the only things to replace; the `appleHealth` case bodies and Strava case bodies must not be touched
- `services/strava.ts` — Strava pattern reference: `connectStrava`, `syncStrava`, `disconnectStrava`
- `types/fitness.ts` — `FitnessSource`, re-exports `TodayStats`, `WorkoutSession` from `types/subscription.ts`
- `types/subscription.ts` — canonical `TodayStats` interface (steps, distance, calories, workouts, updatedAt: `Timestamp | null`, source?: `FitnessTrackingSource`), `WorkoutSession`, `FitnessTrackingSource`
- `services/firebase/firestore.ts` — `updateUserProfile` already accepts typed dot-path writes for `fitnessTracking.*` fields; use it for Firestore writes (same as Task 61)
- `i18n/en.json` — `fitness.appleHealth.*` keys already present under the `fitness` namespace; add parallel `fitness.googleFit.*` keys to all 4 language files

**Task 62 is Android-only.** Every Google Fit API call, every import from `react-native-google-fit`, and both the service and hook must be completely unreachable on iOS — guarded with `Platform.OS !== 'android'` early returns. If any Google Fit import or call can run on iOS, that is architectural drift.

**No Cloud Functions in this task.** Google Fit stats are read on-device via the `react-native-google-fit` library, then written to Firestore by the client service. No server-side function is created or modified.

**No changes to `functions/` in this task.** The `functions/src/` directory is entirely out of scope.

---

## Task 62 — Google Fit Integration (Android)

**Files to create:**
- `services/googleFit.ts`
- `hooks/useGoogleFit.ts`

**Files to modify:**
- `store/fitnessStore.ts` — replace the three `case 'googleFit':` stubs with real dispatch calls
- `i18n/en.json` — add `fitness.googleFit.*` keys
- `i18n/my.json` — mirror `fitness.googleFit.*` with English placeholders
- `i18n/zh.json` — mirror `fitness.googleFit.*` with English placeholders
- `i18n/ta.json` — mirror `fitness.googleFit.*` with English placeholders

**Install step (run before any code changes):**
```bash
npx expo install react-native-google-fit
```
No `app.json` plugin entry is needed — `react-native-google-fit` uses auto-linking. Confirm with `npx expo install` output; do not add a plugin entry unless the library's own install guide explicitly requires one for Expo SDK 52.

---

### `services/googleFit.ts`

Service layer for Google Fit. **Android-only.** Every exported function returns early if
`Platform.OS !== 'android'`. This file is the direct Android counterpart of `services/healthKit.ts`.
It is consumed by `hooks/useGoogleFit.ts` and `store/fitnessStore.ts`.

```typescript
// 1. React / React Native
import { Platform } from 'react-native'

// 2. Third-party
import GoogleFit, { BucketUnit, Scopes } from 'react-native-google-fit'
import { serverTimestamp } from 'firebase/firestore'

// 3. Internal — services
import { updateUserProfile } from '@/services/firebase/firestore'

// 4. Internal — types
import type { TodayStats, WorkoutSession } from '@/types/fitness'

// ---------------------------------------------------------------------------
// Availability guard
// ---------------------------------------------------------------------------

/**
 * Returns true only on Android. Google Fit is not available on iOS.
 * Always call this before any other function in this module.
 */
export const isGoogleFitAvailable = (): boolean => Platform.OS === 'android'

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Requests Google Fit OAuth authorization.
 * Returns true if the user granted all required scopes.
 * Returns false immediately on iOS.
 */
export const requestGoogleFitPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false

  const options = {
    scopes: [
      Scopes.FITNESS_ACTIVITY_READ,
      Scopes.FITNESS_LOCATION_READ,
      Scopes.FITNESS_BODY_READ,
    ],
  }

  try {
    const authorized = await GoogleFit.authorize(options)
    return authorized.success
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Today stats fetch
// ---------------------------------------------------------------------------

/**
 * Reads today's activity stats from Google Fit.
 * Returns a TodayStats object with source set to 'googleFit'.
 * Returns a zero-value TodayStats immediately on iOS.
 */
export const fetchGoogleFitTodayStats = async (): Promise<TodayStats> => {
  const zero: TodayStats = {
    steps: 0,
    distance: 0,
    calories: 0,
    workouts: [],
    updatedAt: null,
    source: 'googleFit',
  }

  if (Platform.OS !== 'android') return zero

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const now = new Date()

  const dateRange = {
    startDate: today.toISOString(),
    endDate: now.toISOString(),
  }

  try {
    // Steps — use com.google.android.gms source for accuracy
    let totalSteps = 0
    try {
      const stepData = await GoogleFit.getDailyStepCountSamples(dateRange)
      // Prefer the merged estimate source from Google Fit
      const estimatedSteps = stepData.find(
        (s) => s.source === 'com.google.android.gms:estimated_steps',
      )
      const rawSteps = stepData.find(
        (s) => s.source === 'com.google.android.gms',
      )
      const source = estimatedSteps ?? rawSteps
      if (source?.steps && source.steps.length > 0) {
        totalSteps = source.steps.reduce((sum, entry) => sum + (entry.value ?? 0), 0)
      }
    } catch {
      // non-fatal — leave totalSteps at 0
    }

    // Distance (Google Fit returns metres — convert to km)
    let totalDistanceKm = 0
    try {
      const distanceData = await GoogleFit.getDailyDistanceSamples(dateRange)
      totalDistanceKm =
        distanceData.reduce((sum, d) => sum + (d.distance ?? 0), 0) / 1000
    } catch {
      // non-fatal
    }

    // Active calories
    let totalCalories = 0
    try {
      const calorieData = await GoogleFit.getDailyCalorieSamples({
        ...dateRange,
        basalCalculation: false,
      })
      totalCalories = Math.round(
        calorieData.reduce((sum, c) => sum + (c.calorie ?? 0), 0),
      )
    } catch {
      // non-fatal
    }

    // Activity sessions (workouts)
    const workouts: WorkoutSession[] = []
    try {
      const sessions = await GoogleFit.getActivitySamples(dateRange)
      for (const session of sessions) {
        const durationMin = Math.round(
          ((session.end ?? 0) - (session.start ?? 0)) / 60000,
        )
        if (durationMin > 0) {
          workouts.push({
            type: session.activityName ?? 'Unknown',
            duration: durationMin,
            calories: session.calories ?? 0,
          })
        }
      }
    } catch {
      // non-fatal
    }

    return {
      steps: totalSteps,
      distance: Math.round(totalDistanceKm * 100) / 100, // 2 decimal places
      calories: totalCalories,
      workouts,
      updatedAt: null, // written as serverTimestamp() in updateGoogleFitFirestore
      source: 'googleFit',
    }
  } catch {
    return zero
  }
}

// ---------------------------------------------------------------------------
// Firestore writes
// ---------------------------------------------------------------------------

/**
 * Persists today's Google Fit stats to Firestore.
 * Writes to users/{uid}.fitnessTracking.todayStats with serverTimestamp().
 * No-op on iOS.
 */
export const updateGoogleFitFirestore = async (
  uid: string,
  stats: TodayStats,
): Promise<void> => {
  if (Platform.OS !== 'android') return

  await updateUserProfile(uid, {
    'fitnessTracking.todayStats': {
      steps: stats.steps,
      distance: stats.distance,
      calories: stats.calories,
      workouts: stats.workouts,
      updatedAt: serverTimestamp(),
      source: 'googleFit',
    },
  })
}

/**
 * Updates the Google Fit connected flag and lastSync timestamp in Firestore.
 * No-op on iOS.
 */
export const setGoogleFitConnected = async (
  uid: string,
  connected: boolean,
): Promise<void> => {
  if (Platform.OS !== 'android') return

  await updateUserProfile(uid, {
    'fitnessTracking.googleFit.connected': connected,
    'fitnessTracking.googleFit.lastSync': serverTimestamp(),
  })
}
```

---

### `hooks/useGoogleFit.ts`

React hook that manages the Google Fit lifecycle for a component tree.
**Android-only** — returns a no-op shape immediately on iOS.
Mirrors `hooks/useAppleHealth.ts` exactly: AppState foreground listener, `syncInFlightRef`
re-entrant guard.

Consumed by `app/settings/ConnectedAppsScreen.tsx` in Task 64.

```typescript
// 1. React
import { useEffect, useRef, useCallback } from 'react'

// 2. React Native
import { AppState, Platform } from 'react-native'
import type { AppStateStatus } from 'react-native'

// 3. Internal — store
import { useFitnessStore } from '@/store/fitnessStore'

// 4. Internal — services
import {
  isGoogleFitAvailable,
  requestGoogleFitPermissions,
  fetchGoogleFitTodayStats,
  updateGoogleFitFirestore,
  setGoogleFitConnected,
} from '@/services/googleFit'

// 5. Internal — types
import type { TodayStats } from '@/types/fitness'

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

interface UseGoogleFitReturn {
  isConnected: boolean
  todayStats: TodayStats | null
  sync: (uid: string) => Promise<void>
  disconnect: (uid: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the Google Fit connection and foreground sync lifecycle.
 * Returns a stable no-op shape on iOS — callers do not need to guard.
 */
export const useGoogleFit = (): UseGoogleFitReturn => {
  const connections = useFitnessStore((s) => s.connections)
  const todayStats = useFitnessStore((s) => s.todayStats)
  const setConnectionStatus = useFitnessStore((s) => s.setConnectionStatus)
  const setTodayStats = useFitnessStore((s) => s.setTodayStats)

  const isConnected = connections.googleFit?.connected ?? false
  const syncInFlightRef = useRef(false)

  // -------------------------------------------------------------------------
  // Sync helper
  // -------------------------------------------------------------------------

  const sync = useCallback(
    async (uid: string): Promise<void> => {
      if (Platform.OS !== 'android') return
      if (!isGoogleFitAvailable()) return
      if (syncInFlightRef.current) return

      syncInFlightRef.current = true
      try {
        const stats = await fetchGoogleFitTodayStats()
        setTodayStats(stats)
        await updateGoogleFitFirestore(uid, stats)
      } finally {
        syncInFlightRef.current = false
      }
    },
    [setTodayStats],
  )

  // -------------------------------------------------------------------------
  // Disconnect helper
  // -------------------------------------------------------------------------

  const disconnect = useCallback(
    async (uid: string): Promise<void> => {
      if (Platform.OS !== 'android') return
      await setGoogleFitConnected(uid, false)
      setConnectionStatus('googleFit', { connected: false, lastSync: null })
    },
    [setConnectionStatus],
  )

  // -------------------------------------------------------------------------
  // Permission request on mount (Android only)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== 'android') return
    // Do not auto-request permissions on mount; permissions are requested
    // explicitly via fitnessStore.connectSource('googleFit') from the
    // Connected Apps screen (Task 64). This hook only manages sync lifecycle.
  }, [])

  // -------------------------------------------------------------------------
  // AppState foreground listener
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== 'android') return
    if (!isConnected) return

    const handleAppStateChange = (nextState: AppStateStatus): void => {
      if (nextState === 'active') {
        // uid is not available in this hook directly — sync is driven by callers
        // who pass uid explicitly. The AppState listener triggers a stat refresh
        // without writing to Firestore (write happens via explicit sync calls).
        fetchGoogleFitTodayStats()
          .then((stats) => setTodayStats(stats))
          .catch(() => {
            // non-fatal; silently swallow background refresh errors
          })
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)
    return () => subscription.remove()
  }, [isConnected, setTodayStats])

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    isConnected,
    todayStats: todayStats ?? null,
    sync,
    disconnect,
  }
}
```

---

### `store/fitnessStore.ts` — Update

Read the current file first. The only changes are replacing the three `console.warn` stub
bodies inside `case 'googleFit':` in `connectSource`, `disconnectSource`, and `syncNow`.

**Do not touch** the `appleHealth` case bodies, the `strava` case bodies, the
`setConnectionStatus`, `setTodayStats`, `fetchTodayStats`, or `setShareOnProfile` actions,
or the `persist` config.

```typescript
// Add these imports at the top of the existing import block:
import {
  isGoogleFitAvailable,
  requestGoogleFitPermissions,
  fetchGoogleFitTodayStats,
  updateGoogleFitFirestore,
  setGoogleFitConnected,
} from '@/services/googleFit'

// ---------------------------------------------------------------------------
// connectSource — replace case 'googleFit': stub body only
// ---------------------------------------------------------------------------
// Remove:
//   case 'googleFit':
//     console.warn('fitnessStore: googleFit connectSource not yet implemented')
//     break

// Replace with:
case 'googleFit': {
  if (Platform.OS !== 'android') break
  if (!isGoogleFitAvailable()) break
  const granted = await requestGoogleFitPermissions()
  if (granted) {
    await setGoogleFitConnected(uid, true)
    set((s) => ({
      connections: {
        ...s.connections,
        googleFit: { connected: true, lastSync: null },
      },
    }))
    // Immediately fetch and cache today's stats after connect
    const stats = await fetchGoogleFitTodayStats()
    set({ todayStats: stats })
    await updateGoogleFitFirestore(uid, stats)
  }
  break
}

// ---------------------------------------------------------------------------
// disconnectSource — replace case 'googleFit': stub body only
// ---------------------------------------------------------------------------
// Remove:
//   case 'googleFit':
//     console.warn('fitnessStore: googleFit disconnectSource not yet implemented')
//     break

// Replace with:
case 'googleFit': {
  if (Platform.OS !== 'android') break
  await setGoogleFitConnected(uid, false)
  set((s) => ({
    connections: {
      ...s.connections,
      googleFit: { connected: false, lastSync: null },
    },
  }))
  break
}

// ---------------------------------------------------------------------------
// syncNow — replace case 'googleFit': stub body only
// ---------------------------------------------------------------------------
// Remove:
//   case 'googleFit':
//     console.warn('fitnessStore: googleFit syncNow not yet implemented')
//     break

// Replace with:
case 'googleFit': {
  if (Platform.OS !== 'android') break
  set({ isLoading: true })
  try {
    const stats = await fetchGoogleFitTodayStats()
    set({ todayStats: stats })
    await updateGoogleFitFirestore(uid, stats)
  } finally {
    set({ isLoading: false })
  }
  break
}
```

---

### `i18n/en.json` — Update

Add the `fitness.googleFit` namespace under the existing `fitness` key. Do not modify any
existing keys.

```json
"fitness": {
  "googleFit": {
    "title": "Google Fit",
    "connect": "Connect Google Fit",
    "disconnect": "Disconnect Google Fit",
    "connected": "Google Fit Connected",
    "lastSync": "Last synced {{time}}",
    "syncNow": "Sync Now",
    "permissionDenied": "Google Fit permission denied",
    "notAvailable": "Google Fit is not available on this device",
    "connectError": "Failed to connect Google Fit"
  }
}
```

Apply the same keys (English values as placeholders) to `i18n/my.json`, `i18n/zh.json`,
and `i18n/ta.json`.

---

## Important Architecture Notes for Codex

1. **Android-only guard — use early return, not conditional imports.** Every exported function in `services/googleFit.ts` and `hooks/useGoogleFit.ts` must begin with `if (Platform.OS !== 'android') return <zero value>`. Never attempt to import or call `react-native-google-fit` APIs on iOS — the library is not linked on iOS and will throw at runtime.

2. **Mirror `services/healthKit.ts` — same function name shape, different API.** The exported function signatures are: `isGoogleFitAvailable`, `requestGoogleFitPermissions`, `fetchGoogleFitTodayStats`, `updateGoogleFitFirestore`, `setGoogleFitConnected`. Match these names exactly — Task 64 and Task 63 reference both services by name.

3. **`updateUserProfile` owns all Firestore writes.** Use `updateUserProfile(uid, { 'fitnessTracking.todayStats': ... })` and `updateUserProfile(uid, { 'fitnessTracking.googleFit.connected': ... })` from `services/firebase/firestore.ts`. Never call `setDoc` or `updateDoc` directly in the service layer — the `updateUserProfile` wrapper already handles the `serverTimestamp()` context correctly.

4. **`updatedAt` is always `null` in the local `TodayStats` object.** The `serverTimestamp()` is written inside `updateGoogleFitFirestore` when the object is persisted to Firestore. The in-memory `TodayStats` returned by `fetchGoogleFitTodayStats` must have `updatedAt: null` — this matches the `TodayStats` type in `types/subscription.ts` and the established pattern from Task 61.

5. **Only replace `case 'googleFit':` stub bodies in `fitnessStore.ts`.** The `appleHealth` and `strava` case bodies are complete and correct. Any change outside the three `case 'googleFit':` blocks is out of scope and must not happen.

6. **No Cloud Functions in this task.** The `functions/` directory is entirely out of scope. Google Fit stats are read on-device and written to Firestore directly by the client.

7. **`react-native-google-fit` requires a development build.** Document this constraint in the CHANGELOG Known Issues. Do not attempt to add a runtime Expo Go check — the library simply will not be available in Expo Go.

8. **Non-fatal error swallowing in `fetchGoogleFitTodayStats`.** Each data type (steps, distance, calories, sessions) is wrapped in its own `try/catch`. A failure fetching one metric must not prevent the others from returning. The outer try/catch returns a zero-value `TodayStats` only if the entire function body fails catastrophically.

---

## Acceptance Criteria

- [ ] `services/googleFit.ts` created and exports exactly five named functions: `isGoogleFitAvailable`, `requestGoogleFitPermissions`, `fetchGoogleFitTodayStats`, `updateGoogleFitFirestore`, `setGoogleFitConnected`
- [ ] Every exported function in `services/googleFit.ts` has `if (Platform.OS !== 'android') return <zero>` as its first statement
- [ ] `hooks/useGoogleFit.ts` created and exports `useGoogleFit` as a named export
- [ ] `useGoogleFit` returns immediately with no-op values when `Platform.OS !== 'android'`
- [ ] `useGoogleFit` includes AppState foreground listener that is registered only when `isConnected === true` and only on Android
- [ ] `syncInFlightRef` re-entrant guard is present in `hooks/useGoogleFit.ts`
- [ ] `store/fitnessStore.ts` — all three `case 'googleFit':` stub `console.warn` bodies replaced with real dispatch calls
- [ ] `store/fitnessStore.ts` — `appleHealth` and `strava` case bodies are unchanged (verify with diff)
- [ ] `fitness.googleFit.*` keys added to all 4 language files (`en.json`, `my.json`, `zh.json`, `ta.json`)
- [ ] All imports use `@/` alias — no relative paths anywhere in the two new files
- [ ] No `any` in `services/googleFit.ts` or `hooks/useGoogleFit.ts`
- [ ] No `console.log` in any modified file; no `console.warn` remaining in `case 'googleFit':` blocks
- [ ] All Firestore timestamp writes use `serverTimestamp()` — no `new Date()` calls
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx tsc --noEmit` passes in `functions/` with zero errors (no functions were changed — confirm clean)

---

## Do Not Touch

`App.tsx`, `app.json`, `functions/src/`, `services/healthKit.ts`, `hooks/useAppleHealth.ts`,
`services/strava.ts`, `services/firebase/config.ts`, `services/firebase/auth.ts`,
`store/authStore.ts`, `store/profileStore.ts`, `store/subscriptionStore.ts`,
`store/discoveryStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`,
`types/user.ts`, `types/match.ts`, `types/message.ts`, `types/subscription.ts`,
`types/fitness.ts`, `constants/`, `firestore.rules`, `firestore.indexes.json`

---

## Commit

```
git commit -m "task-62: google fit integration (android only)"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2D - Task 62] - YYYY-MM-DD

### Completed

- Task 62: Google Fit Integration (Android only)
- services/googleFit.ts: created - isGoogleFitAvailable, requestGoogleFitPermissions, fetchGoogleFitTodayStats, updateGoogleFitFirestore, setGoogleFitConnected; all exported functions guard Platform.OS !== 'android'
- hooks/useGoogleFit.ts: created - isConnected, todayStats, sync(), disconnect(); AppState listener for foreground auto-sync; syncInFlightRef prevents concurrent syncs
- store/fitnessStore.ts: googleFit branch wired in connectSource, disconnectSource, syncNow; googleFit console.warn stubs removed
- i18n: fitness.googleFit.* namespace added to all 4 language files
- react-native-google-fit installed

### Files Created / Modified

- services/googleFit.ts: created - 5 named exports, full Android guard pattern
- hooks/useGoogleFit.ts: created - useGoogleFit named export, AppState lifecycle, re-entrant sync guard
- store/fitnessStore.ts: googleFit case bodies replaced in 3 actions; no other changes
- i18n/en.json: fitness.googleFit.* keys added
- i18n/my.json, zh.json, ta.json: fitness.googleFit.* mirrored with English placeholders
- package.json, package-lock.json: react-native-google-fit added

### Architecture Decisions

- [Note any decisions made during implementation that differ from the spec above]

### Known Issues / Deferred

- react-native-google-fit requires a development build; cannot be tested in Expo Go

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/
- [Add targeted checks confirming Android guards, zero any, zero console.warn in googleFit cases]

### Next Up

- Task 63: Fitness Activity Display on Profiles (TodayActivityCard, FullProfileModal, ProfileScreen, SwipeCard "Active today" badge)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 63 prompt.

---

## Reasoning Level

Low
