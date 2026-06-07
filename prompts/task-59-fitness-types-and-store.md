# CODEX PROMPT — Task 59: Fitness Tracking Types and Store

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2D begins here. Tasks 47–58 are complete. The project has a working premium subscription
system, photo verification flow, and all verified-badge surfaces. TypeScript is clean (`tsc
--noEmit` passes on both the client root and `functions/`). Zero `any` usage, zero hardcoded
strings, zero relative imports.

### Existing files Codex must read before writing anything

- `types/subscription.ts` — **CRITICAL**: Task 47 already defined `FitnessTrackingSource`,
  `WorkoutSession`, `TodayStats`, `FitnessSourceConnection`, `StravaConnection`, and
  `FitnessTracking` in this file. Read it before writing `types/fitness.ts` — do not
  duplicate any of these interfaces.
- `types/user.ts` — `UserProfile.fitnessTracking` is typed as `FitnessTracking | undefined`;
  `FitnessTracking` is imported from `types/subscription.ts`.
- `store/authStore.ts` — exposes `user: FirebaseUser | null`; call
  `useAuthStore.getState().user?.uid` inside store actions to get the current user ID.
- `store/profileStore.ts` — exposes `profile: UserProfile | null`. The fitness store must
  **not** duplicate profile state — it reads `fitnessTracking.*` fields from Firestore
  independently.
- `services/firebase/firestore.ts` — `updateDoc` and `doc` are already imported from
  `firebase/firestore`; the `db` instance is exported from `services/firebase/config.ts`.
- `services/firebase/config.ts` — exports `db` (Firestore instance).
- `@react-native-async-storage/async-storage` — already installed (Task 02); used for
  Zustand persist middleware in `authStore`, `onboardingStore`.
- `i18n/en.json` — already has `errors.*` and `common.*` keys. New fitness keys go under
  `fitness.*`.

**Architectural boundary for this task:**

The platform-specific service modules (`services/healthKit.ts`, `services/googleFit.ts`,
`services/strava.ts`) do not exist yet — they are built in Tasks 60–62. `connectSource()`,
`disconnectSource()`, and `syncNow()` in `fitnessStore.ts` must therefore be **stubs** that
`console.warn` and resolve without crashing. The real dispatch logic is wired in Tasks 60–62
when the services exist. **Do not import from services that don't exist yet.**

---

## Task 59 — Fitness Tracking Types and Store

**Files to create:**
- `types/fitness.ts`
- `store/fitnessStore.ts`

**Files to modify:**
- `i18n/en.json` — add `fitness.*` translation keys
- `i18n/my.json` — mirror with English placeholders
- `i18n/zh.json` — mirror with English placeholders
- `i18n/ta.json` — mirror with English placeholders

---

### `types/fitness.ts`

This file is the **single canonical import point** for all fitness-related types used by the
client. It re-exports every fitness type that Task 47 already placed in `types/subscription.ts`
so that Tasks 60–64 only need to import from `@/types/fitness`. It also adds the two types that
are new in Task 59: `StravaActivity` and `FitnessConnectionStatus`.

`FitnessConnectionStatus` is a client-side display alias for the per-source connection state
held in the store. It is intentionally distinct from `FitnessSourceConnection` in
`types/subscription.ts` — that one represents the Firestore schema shape; this one represents
the store state shape (where `lastSync` may be `null` before the first sync, but the
Firestore schema uses `Timestamp` only when a sync has occurred).

```typescript
// 1. Third-party
import type { Timestamp } from 'firebase/firestore'

// 2. Internal — re-export everything fitness-related from the Task 47 subscription types
//    so all downstream tasks import from @/types/fitness only, not from @/types/subscription
export type {
  FitnessTrackingSource,
  WorkoutSession,
  TodayStats,
  FitnessSourceConnection,
  StravaConnection,
  FitnessTracking,
} from '@/types/subscription'

// ---------------------------------------------------------------------------
// New types added in Task 59
// ---------------------------------------------------------------------------

/**
 * Per-source connection status held in fitnessStore.connections.
 * lastSync is null before the first successful sync.
 * This is the store-layer shape; the Firestore schema uses FitnessSourceConnection
 * (from types/subscription.ts) where lastSync is always a Timestamp.
 */
export interface FitnessConnectionStatus {
  connected: boolean
  lastSync: Timestamp | null
}

/**
 * Strava API activity object (subset of the full Strava API response).
 * Used by syncStravaActivity Cloud Function and services/strava.ts (Task 60).
 * Fields match the Strava v3 activities endpoint response shape.
 */
export interface StravaActivity {
  id: number
  name: string
  type: string                  // e.g. "Run", "Ride", "WeightTraining"
  start_date: string            // ISO 8601 UTC — e.g. "2026-05-31T07:30:00Z"
  moving_time: number           // seconds
  distance: number              // metres
  total_elevation_gain: number  // metres
  calories: number              // kcal (may be 0 if not available)
  average_heartrate?: number
  max_heartrate?: number
}

// FitnessSource is re-exported via FitnessTrackingSource above.
// Provide a convenience alias so Tasks 60-64 can write FitnessSource instead of
// FitnessTrackingSource — both refer to the same underlying type.
export type { FitnessTrackingSource as FitnessSource } from '@/types/subscription'
```

---

### `store/fitnessStore.ts`

Global Zustand store for all fitness tracking state. Persists `shareOnProfile` and
`connections` to AsyncStorage so the user does not have to reconnect apps on every launch.
`todayStats` is intentionally **not** persisted — it is always fetched fresh from Firestore
so stale cached stats never appear on screen.

Tasks 60–62 will call `fitnessStore.connectSource()`, `disconnectSource()`, and `syncNow()`
once the platform services exist. Until then those actions are stubs.

```typescript
// 1. Third-party
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// 2. Internal — services
import { db } from '@/services/firebase/config'

// 3. Internal — types
import type {
  FitnessSource,
  FitnessConnectionStatus,
  TodayStats,
} from '@/types/fitness'

// 4. Firebase imports (not from internal services — direct SDK imports)
import { doc, getDoc, updateDoc } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// State and action types
// ---------------------------------------------------------------------------

interface FitnessState {
  /** Today's aggregated activity stats fetched from Firestore. Null before first fetch. */
  todayStats: TodayStats | null
  /** Per-source connection status. Persisted to AsyncStorage. */
  connections: Record<FitnessSource, FitnessConnectionStatus>
  /** Whether today's activity stats are visible to matches on the user's profile. */
  shareOnProfile: boolean
  isLoading: boolean
  error: string | null
}

interface FitnessActions {
  /**
   * Fetch today's stats from Firestore users/{uid}.fitnessTracking.todayStats.
   * Call this on app foreground and after syncNow() resolves.
   */
  fetchTodayStats: (uid: string) => Promise<void>

  /**
   * Toggle whether today's stats are visible to matches.
   * Writes fitnessTracking.shareOnProfile to Firestore and updates local state.
   */
  setShareOnProfile: (uid: string, enabled: boolean) => Promise<void>

  /**
   * Stub dispatcher — wired to platform services in Tasks 60–62.
   * Until then: updates local connection status optimistically and warns.
   */
  connectSource: (uid: string, source: FitnessSource) => Promise<void>

  /**
   * Stub dispatcher — wired to platform services in Tasks 60–62.
   * Until then: clears local connection status and warns.
   */
  disconnectSource: (uid: string, source: FitnessSource) => Promise<void>

  /**
   * Stub dispatcher — wired to platform services in Tasks 60–62.
   * Until then: calls fetchTodayStats as a no-op sync.
   */
  syncNow: (uid: string, source: FitnessSource) => Promise<void>

  /** Reset error state. */
  clearError: () => void
}

type FitnessStore = FitnessState & FitnessActions

// ---------------------------------------------------------------------------
// Default connection status for a source that has never been connected
// ---------------------------------------------------------------------------

const disconnectedStatus: FitnessConnectionStatus = {
  connected: false,
  lastSync: null,
}

const defaultConnections: Record<FitnessSource, FitnessConnectionStatus> = {
  appleHealth: disconnectedStatus,
  googleFit: disconnectedStatus,
  strava: disconnectedStatus,
}

// ---------------------------------------------------------------------------
// Store definition
// ---------------------------------------------------------------------------

export const useFitnessStore = create<FitnessStore>()(
  persist(
    (set, get) => ({
      // ----- Initial state -----
      todayStats: null,
      connections: defaultConnections,
      shareOnProfile: false,
      isLoading: false,
      error: null,

      // ----- Actions -----

      fetchTodayStats: async (uid: string): Promise<void> => {
        set({ isLoading: true, error: null })
        try {
          const userDocRef = doc(db, 'users', uid)
          const snapshot = await getDoc(userDocRef)
          if (!snapshot.exists()) {
            set({ isLoading: false })
            return
          }
          const data = snapshot.data()
          // fitnessTracking.todayStats may not exist on older documents
          const todayStats = (data?.fitnessTracking?.todayStats as TodayStats) ?? null
          set({ todayStats, isLoading: false })
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Failed to fetch today stats'
          set({ isLoading: false, error: message })
        }
      },

      setShareOnProfile: async (uid: string, enabled: boolean): Promise<void> => {
        // Optimistic update — revert on failure
        const previous = get().shareOnProfile
        set({ shareOnProfile: enabled })
        try {
          await updateDoc(doc(db, 'users', uid), {
            'fitnessTracking.shareOnProfile': enabled,
          })
        } catch (err: unknown) {
          // Revert
          set({ shareOnProfile: previous })
          const message =
            err instanceof Error ? err.message : 'Failed to update share setting'
          set({ error: message })
        }
      },

      connectSource: async (uid: string, source: FitnessSource): Promise<void> => {
        // Stub — real dispatch wired in Tasks 60 (Strava), 61 (Apple Health), 62 (Google Fit)
        // When the service modules exist, this will call the appropriate service function
        // and update connections[source] with { connected: true, lastSync }
        console.warn(
          `[fitnessStore] connectSource('${source}') called but service not yet wired. Implement in Task 60/61/62.`
        )
        // No-op: do not update state until real service confirms connection
      },

      disconnectSource: async (uid: string, source: FitnessSource): Promise<void> => {
        // Stub — real dispatch wired in Tasks 60 (Strava), 61 (Apple Health), 62 (Google Fit)
        console.warn(
          `[fitnessStore] disconnectSource('${source}') called but service not yet wired. Implement in Task 60/61/62.`
        )
        // Optimistically clear local connection status so UI reflects disconnected state
        set((state) => ({
          connections: {
            ...state.connections,
            [source]: disconnectedStatus,
          },
        }))
      },

      syncNow: async (uid: string, source: FitnessSource): Promise<void> => {
        // Stub — real dispatch wired in Tasks 60 (Strava), 61 (Apple Health), 62 (Google Fit)
        // Falls back to re-fetching Firestore stats so the UI still refreshes
        console.warn(
          `[fitnessStore] syncNow('${source}') called but service not yet wired. Fetching Firestore stats as fallback.`
        )
        await get().fetchTodayStats(uid)
      },

      clearError: (): void => {
        set({ error: null })
      },
    }),
    {
      name: 'fitness-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user preferences and connection state.
      // todayStats, isLoading, and error are always derived fresh.
      partialize: (state) => ({
        shareOnProfile: state.shareOnProfile,
        connections: state.connections,
      }),
    }
  )
)
```

---

### `i18n/en.json` — Update

Add the following keys under the `"fitness"` namespace. Insert them as a new top-level key
alongside the existing namespaces (`"auth"`, `"common"`, `"errors"`, `"discovery"`, etc.).

Do not touch any existing keys.

```json
"fitness": {
  "source": {
    "appleHealth": "Apple Health",
    "googleFit": "Google Fit",
    "strava": "Strava"
  },
  "connection": {
    "connected": "Connected",
    "notConnected": "Not connected",
    "lastSync": "Last synced {{time}}",
    "neverSynced": "Never synced"
  },
  "stats": {
    "steps": "Steps",
    "distance": "Distance",
    "calories": "Calories",
    "activeToday": "Active today",
    "noData": "No activity data today"
  },
  "share": {
    "label": "Show activity on profile",
    "helper": "Your today's activity stats will be visible to your matches"
  },
  "actions": {
    "connect": "Connect",
    "disconnect": "Disconnect",
    "syncNow": "Sync Now",
    "syncing": "Syncing..."
  },
  "errors": {
    "fetchFailed": "Could not load activity data",
    "shareFailed": "Could not update sharing settings",
    "syncFailed": "Sync failed. Please try again."
  }
}
```

---

### `i18n/my.json` — Update

Mirror the same `"fitness"` block with English placeholder values (same text as `en.json`).
Do not touch any existing keys.

---

### `i18n/zh.json` — Update

Mirror the same `"fitness"` block with English placeholder values.
Do not touch any existing keys.

---

### `i18n/ta.json` — Update

Mirror the same `"fitness"` block with English placeholder values.
Do not touch any existing keys.

---

## Important Architecture Notes for Codex

1. **Do not duplicate types from `types/subscription.ts`.** Task 47 already defined
   `FitnessTrackingSource`, `WorkoutSession`, `TodayStats`, `FitnessSourceConnection`,
   `StravaConnection`, and `FitnessTracking`. Read that file first. `types/fitness.ts` must
   re-export those via named `export type { ... } from '@/types/subscription'` and only add
   the two truly new types: `FitnessConnectionStatus` and `StravaActivity`.

2. **Do not import from services that don't exist yet.** `services/strava.ts`,
   `services/healthKit.ts`, and `services/googleFit.ts` are built in Tasks 60–62. Any import
   of these in Task 59 will cause a TypeScript error. `connectSource`, `disconnectSource`, and
   `syncNow` must be stubs with `console.warn` only.

3. **`todayStats` must not be persisted.** The Zustand persist `partialize` must only include
   `shareOnProfile` and `connections`. Stale stats from a previous day must never appear on
   screen — always fetch from Firestore on app foreground.

4. **Use `FitnessSource` (the re-exported alias), not `FitnessTrackingSource`, in all store
   and action signatures.** `types/fitness.ts` exports `FitnessSource` as the canonical
   convenience alias. All Tasks 60–64 will import `FitnessSource` from `@/types/fitness`.

5. **`updateDoc` writes use dot-notation keys for nested Firestore fields.** The write in
   `setShareOnProfile` must use `'fitnessTracking.shareOnProfile'` as the key — not a nested
   object — to avoid overwriting the rest of the `fitnessTracking` map. This is the same
   pattern already used in `profileStore.ts`.

6. **The `connections` initial state must declare all three sources.** The persisted
   `connections` object is typed as `Record<FitnessSource, FitnessConnectionStatus>`. All three
   keys (`appleHealth`, `googleFit`, `strava`) must be present in `defaultConnections` so the
   type is satisfied even on first launch before any source is connected.

7. **Store actions accept `uid: string` as the first argument** (not derived internally from
   `authStore`). This makes the store actions testable and avoids coupling the fitness store to
   the auth store. Callers — screens and hooks — pass the uid from `useAuthStore().user?.uid`.

8. **Zero `any`.** The `getDoc` snapshot data field is typed as `DocumentData` (which is
   `Record<string, unknown>` under the hood). Access nested paths with optional chaining and
   cast explicitly with a comment explaining why:
   ```typescript
   const todayStats = (data?.fitnessTracking?.todayStats as TodayStats) ?? null
   // Safe cast: Firestore schema guarantees this shape when the field exists;
   // the ?? null fallback handles the absent field case.
   ```

---

## Acceptance Criteria

- [ ] `types/fitness.ts` created and exports: `FitnessConnectionStatus`, `StravaActivity`,
      `FitnessSource`, and all six re-exports from `@/types/subscription`
      (`FitnessTrackingSource`, `WorkoutSession`, `TodayStats`, `FitnessSourceConnection`,
      `StravaConnection`, `FitnessTracking`) — verified with `grep`
- [ ] `types/fitness.ts` contains **zero interface or type definitions** for
      `FitnessTrackingSource`, `WorkoutSession`, `TodayStats`, `FitnessSourceConnection`,
      `StravaConnection`, or `FitnessTracking` — all are re-exports only
- [ ] `store/fitnessStore.ts` created and exports `useFitnessStore` as a named export
- [ ] `useFitnessStore` state shape matches: `todayStats`, `connections`, `shareOnProfile`,
      `isLoading`, `error`
- [ ] `useFitnessStore` actions present: `fetchTodayStats`, `setShareOnProfile`,
      `connectSource`, `disconnectSource`, `syncNow`, `clearError`
- [ ] Persist middleware includes only `shareOnProfile` and `connections` via `partialize`
- [ ] `defaultConnections` declares all three sources (`appleHealth`, `googleFit`, `strava`)
      with `connected: false` and `lastSync: null`
- [ ] `connectSource`, `disconnectSource`, `syncNow` are stubs — each calls `console.warn`
      and does not import from any service file that does not yet exist
- [ ] `setShareOnProfile` writes `'fitnessTracking.shareOnProfile'` using dot-notation key
      (not nested object) via `updateDoc`
- [ ] `fetchTodayStats` reads `users/{uid}.fitnessTracking.todayStats` via `getDoc` with
      safe optional-chain access and null fallback
- [ ] `fitness.*` keys added to all four i18n files (`en.json`, `my.json`, `zh.json`,
      `ta.json`) with correct nesting and no existing keys touched
- [ ] All imports in `store/fitnessStore.ts` use `@/` alias — no relative paths
- [ ] Zero `any` in both new files
- [ ] Zero inline styles (not applicable for `.ts` files — confirm no JSX)
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`types/user.ts`, `types/subscription.ts`, `types/match.ts`, `types/message.ts`,
`store/authStore.ts`, `store/profileStore.ts`, `store/discoveryStore.ts`,
`store/subscriptionStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`,
`services/firebase/config.ts`, `services/firebase/auth.ts`, `services/firebase/firestore.ts`,
`services/firebase/storage.ts`, `services/firebase/realtime.ts`,
`App.tsx`, `constants/`, `components/`, `app/`, `functions/`, `firestore.rules`,
`firestore.indexes.json`

---

## Commit

```
git commit -m "task-59: fitness tracking types and store"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2D — Task 59] — YYYY-MM-DD

### Completed

- Task 59: Fitness tracking types and store
- types/fitness.ts: created — re-exports 6 types from subscription.ts; adds FitnessConnectionStatus and StravaActivity
- store/fitnessStore.ts: created — useFitnessStore with fetchTodayStats, setShareOnProfile, stub connectSource/disconnectSource/syncNow, persist for shareOnProfile and connections
- i18n: fitness.* namespace added to all 4 language files

### Files Created / Modified

- types/fitness.ts: created — canonical fitness type import point; re-exports from types/subscription.ts + adds FitnessConnectionStatus, StravaActivity, FitnessSource alias
- store/fitnessStore.ts: created — useFitnessStore named export, Zustand + AsyncStorage persist, all 6 actions
- i18n/en.json: fitness.* keys added (source, connection, stats, share, actions, errors)
- i18n/my.json, zh.json, ta.json: fitness.* mirrored with English placeholders

### Architecture Decisions

- types/fitness.ts re-exports from types/subscription.ts rather than redefining — single source of truth, no duplication
- FitnessSource is a re-exported alias for FitnessTrackingSource — convenience name for Tasks 60-64
- connectSource/disconnectSource/syncNow are stubs (console.warn) — wired to real services in Tasks 60-62
- todayStats excluded from persist partialize — always fetched fresh to avoid stale-day data
- Store actions take uid as first argument — decoupled from authStore for testability

### Known Issues / Deferred

- connectSource/disconnectSource/syncNow are stubs — wired in Tasks 60 (Strava), 61 (Apple Health), 62 (Google Fit)

### Next Up

- Task 60: Strava OAuth Integration (services/strava.ts, functions/src/exchangeStravaToken.ts, functions/src/syncStravaActivity.ts)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 60 prompt.

---

## Reasoning Level

High — requires cross-file type deduplication audit before writing, stub action pattern to
avoid missing-module errors, and careful Zustand persist partialize to prevent stale stats.
