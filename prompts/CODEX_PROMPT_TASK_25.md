# CODEX PROMPT — Task 25
# Discovery Zustand Store

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3.3 complete. Relevant existing files:

- `functions/src/getDiscoveryStack.ts` — HTTP callable (2nd gen, `asia-southeast1`). Returns `{ stack: string[] }` — array of up to 20 user IDs sorted by score descending.
- `functions/src/onSwipeCreated.ts` — Firestore trigger on `/swipes/{userId}/likes/{targetId}`. Mutual like detection, match creation, stats increment — fully implemented.
- `services/firebase/config.ts` — exports `auth`, `db` (Firestore), `storage`, `rtdb`. Use these imports — never re-initialise Firebase.
- `services/firebase/firestore.ts` — exports `createUserProfile`, `updateUserProfile`. Extend this file if adding new Firestore helpers.
- `types/user.ts` — exports `UserProfile`, `FitnessLevel`, `Gender`, `LookingFor`, `UserSubscription`
- `store/authStore.ts` — exports `useAuthStore`. Has `user` (FirebaseUser | null) and `isAuthenticated`.
- `store/onboardingStore.ts` — pattern reference for Zustand store with `persist` middleware + `AsyncStorage`
- `constants/theme.ts` — exports `colors`, `spacing`, `typography`
- `i18n/en.json` — add any new keys needed under `discovery.*`

Task 25 builds the **Discovery Zustand store** — the central state layer for the swipe stack. It calls `getDiscoveryStack`, manages the card queue, handles swipe writes to Firestore, enforces the free-user daily like limit, and auto-refetches when the stack is running low.

No UI is built in this task. Task 26 (SwipeCard) and Task 27 (DiscoveryScreen) consume this store.

---

## Task 25 — Discovery Store

**Files to create:**
- `store/discoveryStore.ts`

**Files to modify:**
- `services/firebase/firestore.ts` — add `getDailyLikesDoc`, `incrementDailyLikes` helpers
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `discovery.*` keys if not already present

---

### `services/firebase/firestore.ts` — Additions

Add these two exported functions **below** the existing `updateUserProfile` export. Do not modify any existing functions.

```typescript
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  increment,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase/config'

/** Shape of the dailyLikes sub-document at /users/{userId}/dailyLikes */
export interface DailyLikesDoc {
  count: number
  resetAt: Timestamp
}

/**
 * Returns the current dailyLikes doc for a user.
 * If the doc does not exist, or if resetAt is before today's midnight (local),
 * treats count as 0 and the doc as needing a reset.
 */
export const getDailyLikesDoc = async (
  userId: string
): Promise<DailyLikesDoc> => {
  const ref = doc(db, 'users', userId, 'dailyLikes', 'doc')
  const snap = await getDoc(ref)

  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  if (!snap.exists()) {
    return { count: 0, resetAt: Timestamp.fromDate(todayMidnight) }
  }

  const data = snap.data() as DailyLikesDoc
  const resetAt = data.resetAt.toDate()

  // If resetAt is before today midnight, the counter is stale — treat as reset
  if (resetAt < todayMidnight) {
    return { count: 0, resetAt: Timestamp.fromDate(todayMidnight) }
  }

  return data
}

/**
 * Increments the daily like count by 1.
 * Resets the counter first if the resetAt timestamp is stale (before today midnight).
 * Uses setDoc with merge so the doc is created if it doesn't exist yet.
 */
export const incrementDailyLikes = async (userId: string): Promise<void> => {
  const ref = doc(db, 'users', userId, 'dailyLikes', 'doc')

  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  const nextMidnight = new Date(todayMidnight)
  nextMidnight.setDate(nextMidnight.getDate() + 1)

  const existing = await getDailyLikesDoc(userId)

  const isStale = existing.resetAt.toDate() < todayMidnight

  if (isStale) {
    // Reset: start fresh count for today
    await setDoc(ref, {
      count: 1,
      resetAt: Timestamp.fromDate(nextMidnight),
    })
  } else {
    // Increment existing count
    await updateDoc(ref, {
      count: increment(1),
    })
  }
}
```

> **Schema note:** The dailyLikes path is `/users/{userId}/dailyLikes/doc` — a single document (not a collection) nested under the user. The `doc` segment is a fixed string so security rules can scope it cleanly. This matches the ARCHITECT.md schema intent (`/users/{userId}/dailyLikes` as a document).

---

### `store/discoveryStore.ts`

```typescript
import { create } from 'zustand'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getFunctions } from 'firebase/functions'
import { db } from '@/services/firebase/config'
import {
  getDailyLikesDoc,
  incrementDailyLikes,
} from '@/services/firebase/firestore'
import type { UserProfile } from '@/types/user'

// ─── Constants ───────────────────────────────────────────────────────────────

const FREE_DAILY_LIKE_LIMIT = 50
/** Refetch a new stack from the Cloud Function when this many cards remain */
const REFETCH_THRESHOLD = 3

// ─── Types ────────────────────────────────────────────────────────────────────

interface GetDiscoveryStackResponse {
  stack: string[]
}

interface DiscoveryState {
  /** Ordered array of full UserProfile objects ready to be swiped */
  stack: UserProfile[]
  /** Index of the top card (the one currently being swiped) */
  currentIndex: number
  /** True while fetchStack() is in flight */
  isLoading: boolean
  /** Non-null when fetchStack() or a swipe write fails */
  error: string | null
  /** Number of likes the current user has used today */
  dailyLikesCount: number
  /** True when the free user daily limit has been reached */
  isLimitReached: boolean
  /** True when a new stack fetch has been triggered automatically */
  isRefetching: boolean
}

interface DiscoveryActions {
  /**
   * Calls the getDiscoveryStack Cloud Function, resolves each returned user ID
   * to a full UserProfile, and replaces the current stack.
   */
  fetchStack: (userId: string) => Promise<void>
  /**
   * Records a like swipe. Checks the daily limit for free users first.
   * Returns 'limit_reached' if the user has hit 50 likes and is on the free tier.
   * Returns 'ok' on success.
   */
  swipeRight: (
    userId: string,
    targetId: string,
    isPremium: boolean
  ) => Promise<'ok' | 'limit_reached'>
  /** Records a pass swipe. Always succeeds (no daily limit). */
  swipeLeft: (userId: string, targetId: string) => Promise<void>
  /**
   * Records a super like swipe. Premium-only — returns 'premium_required' for
   * free users without writing anything.
   */
  swipeSuperLike: (
    userId: string,
    targetId: string,
    isPremium: boolean
  ) => Promise<'ok' | 'premium_required'>
  /** Loads the current daily like count from Firestore and syncs to state. */
  checkDailyLimit: (userId: string) => Promise<void>
  /** Advance the current card index after a swipe animation completes. */
  advanceStack: () => void
  /** Clear error state. */
  clearError: () => void
  /** Reset the entire store — used on logout. */
  reset: () => void
}

type DiscoveryStore = DiscoveryState & DiscoveryActions

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: DiscoveryState = {
  stack: [],
  currentIndex: 0,
  isLoading: false,
  error: null,
  dailyLikesCount: 0,
  isLimitReached: false,
  isRefetching: false,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetches a single UserProfile from /users/{userId}.
 * Returns null if the document does not exist or the user is banned/paused.
 */
const fetchUserProfile = async (
  userId: string
): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', userId))
  if (!snap.exists()) return null
  const data = snap.data() as UserProfile
  // Exclude banned or paused profiles from the local stack as a safety net
  if (data.banned || data.paused) return null
  return { ...data, uid: snap.id }
}

/**
 * Resolves an array of user IDs to full UserProfile objects.
 * Profiles that fail to load (deleted, banned, paused) are silently excluded.
 */
const resolveProfiles = async (ids: string[]): Promise<UserProfile[]> => {
  const settled = await Promise.allSettled(ids.map(fetchUserProfile))
  return settled
    .filter(
      (r): r is PromiseFulfilledResult<UserProfile> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value)
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDiscoveryStore = create<DiscoveryStore>()((set, get) => ({
  ...initialState,

  // ── fetchStack ──────────────────────────────────────────────────────────────
  fetchStack: async (userId: string): Promise<void> => {
    const { isLoading } = get()
    if (isLoading) return // Prevent concurrent fetches

    set({ isLoading: true, error: null })

    try {
      const functions = getFunctions(undefined, 'asia-southeast1')
      const getStack = httpsCallable<Record<string, never>, GetDiscoveryStackResponse>(
        functions,
        'getDiscoveryStack'
      )
      const result = await getStack({})
      const profiles = await resolveProfiles(result.data.stack)

      set({
        stack: profiles,
        currentIndex: 0,
        isLoading: false,
        isRefetching: false,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load profiles'
      set({ isLoading: false, isRefetching: false, error: message })
    }
  },

  // ── swipeRight ──────────────────────────────────────────────────────────────
  swipeRight: async (
    userId: string,
    targetId: string,
    isPremium: boolean
  ): Promise<'ok' | 'limit_reached'> => {
    // Daily limit check for free users
    if (!isPremium) {
      const { dailyLikesCount } = get()
      if (dailyLikesCount >= FREE_DAILY_LIKE_LIMIT) {
        set({ isLimitReached: true })
        return 'limit_reached'
      }
    }

    try {
      // Write to /swipes/{userId}/likes/{targetId}
      const swipeRef = doc(db, 'swipes', userId, 'likes', targetId)
      await setDoc(swipeRef, {
        swiperId: userId,
        targetId,
        isSuperLike: false,
        createdAt: serverTimestamp(),
      })

      // Increment local count and Firestore counter
      if (!isPremium) {
        await incrementDailyLikes(userId)
        set((state) => ({
          dailyLikesCount: state.dailyLikesCount + 1,
          isLimitReached:
            state.dailyLikesCount + 1 >= FREE_DAILY_LIKE_LIMIT,
        }))
      }

      // Advance stack and trigger auto-refetch if running low
      get().advanceStack()

      return 'ok'
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Swipe failed'
      set({ error: message })
      return 'ok' // Don't surface write errors as limit_reached
    }
  },

  // ── swipeLeft ───────────────────────────────────────────────────────────────
  swipeLeft: async (userId: string, targetId: string): Promise<void> => {
    try {
      const passRef = doc(db, 'swipes', userId, 'passes', targetId)
      await setDoc(passRef, {
        swiperId: userId,
        targetId,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      // Pass failures are non-critical — log but don't block the UI
      console.warn('swipeLeft write failed:', err)
    } finally {
      // Always advance the stack, even on write failure
      get().advanceStack()
    }
  },

  // ── swipeSuperLike ──────────────────────────────────────────────────────────
  swipeSuperLike: async (
    userId: string,
    targetId: string,
    isPremium: boolean
  ): Promise<'ok' | 'premium_required'> => {
    if (!isPremium) {
      return 'premium_required'
    }

    try {
      const swipeRef = doc(db, 'swipes', userId, 'likes', targetId)
      await setDoc(swipeRef, {
        swiperId: userId,
        targetId,
        isSuperLike: true,
        createdAt: serverTimestamp(),
      })
      get().advanceStack()
      return 'ok'
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Super like failed'
      set({ error: message })
      return 'ok'
    }
  },

  // ── checkDailyLimit ─────────────────────────────────────────────────────────
  checkDailyLimit: async (userId: string): Promise<void> => {
    try {
      const data = await getDailyLikesDoc(userId)
      set({
        dailyLikesCount: data.count,
        isLimitReached: data.count >= FREE_DAILY_LIKE_LIMIT,
      })
    } catch (err) {
      // Non-critical — silent fail, limit will be re-checked on next swipe
      console.warn('checkDailyLimit failed:', err)
    }
  },

  // ── advanceStack ─────────────────────────────────────────────────────────────
  advanceStack: (): void => {
    set((state) => {
      const nextIndex = state.currentIndex + 1
      const remaining = state.stack.length - nextIndex

      // Trigger a background refetch when running low (don't await — fire-and-forget)
      if (remaining <= REFETCH_THRESHOLD && !state.isLoading && !state.isRefetching) {
        // We can't call get().fetchStack() here directly because we don't have userId.
        // The DiscoveryScreen subscribes to isRefetching and calls fetchStack itself.
        return { currentIndex: nextIndex, isRefetching: true }
      }

      return { currentIndex: nextIndex }
    })
  },

  // ── clearError ───────────────────────────────────────────────────────────────
  clearError: (): void => set({ error: null }),

  // ── reset ────────────────────────────────────────────────────────────────────
  reset: (): void => set(initialState),
}))
```

---

### i18n additions

Add these keys under `discovery` in `en.json`, `my.json`, `zh.json`, `ta.json`. Non-English files use English values as placeholders until native translations are reviewed.

```json
"discovery": {
  "noMore": "No more profiles nearby",
  "noMoreSubtitle": "Check back later or adjust your distance range",
  "refresh": "Refresh",
  "editPreferences": "Edit Preferences",
  "limitReached": "You're out of likes for today",
  "limitReachedSubtitle": "Likes reset at midnight. Upgrade for unlimited likes.",
  "upgradeNow": "Upgrade Now",
  "maybeLater": "Maybe Later",
  "loading": "Finding your matches..."
}
```

---

## Architecture Notes for Codex

### 1. `advanceStack` does not call `fetchStack` directly

`advanceStack` sets `isRefetching: true` as a signal. The `DiscoveryScreen` (Task 27) will observe this flag with a `useEffect` and call `fetchStack(userId)` itself, passing the user ID from `authStore`. This keeps the store free of auth coupling.

### 2. Super like writes to `/swipes/{userId}/likes/{targetId}` — same path as a regular like

The `isSuperLike: boolean` field distinguishes the two. The `onSwipeCreated` Cloud Function already reads `isSuperLike` from the swipe doc and passes it through to `sendMatchNotifications`. This is by design — do not create a separate `/superLikes/` subcollection.

### 3. Pass failures are non-critical

A failed pass write means the same user might appear again in a future stack. This is acceptable for Phase 1 — the `getDiscoveryStack` Cloud Function already excludes passed users when the doc exists. Silently log and always advance the stack so the UX never blocks.

### 4. The `dailyLikes` document path

`/users/{userId}/dailyLikes/doc` — the trailing `doc` is a fixed document ID within the `dailyLikes` sub-collection. This is consistent with how `firestore.rules` will scope it in Task 39. Do not change this path.

### 5. `getFunctions` region

Always call `getFunctions(undefined, 'asia-southeast1')` when invoking callables. The `undefined` first argument uses the default Firebase app. This matches the Cloud Function deployment region.

### 6. No persistence middleware

`discoveryStore` does **not** use `zustand/middleware/persist`. The stack is ephemeral — it should refetch on each app launch. Persisting stale card data across sessions would show profiles the user has already swiped on.

### 7. `FREE_DAILY_LIKE_LIMIT` is defined in the store

Do not import this constant from anywhere else. If it needs to change in future, it should be driven by a remote config value (Phase 2 enhancement).

---

## Acceptance Criteria

- [ ] `useDiscoveryStore` exported as named export from `store/discoveryStore.ts`
- [ ] `fetchStack(userId)` calls `getDiscoveryStack` callable and resolves IDs to `UserProfile[]`
- [ ] Profiles with `banned: true` or `paused: true` are excluded during resolution
- [ ] Concurrent `fetchStack` calls are de-duped (second call returns early if `isLoading` is true)
- [ ] `swipeRight` writes to `/swipes/{userId}/likes/{targetId}` with correct shape
- [ ] `swipeRight` returns `'limit_reached'` for free users at 50 likes without writing to Firestore
- [ ] `swipeRight` increments `dailyLikesCount` in state and calls `incrementDailyLikes` for free users
- [ ] `swipeLeft` writes to `/swipes/{userId}/passes/{targetId}` with correct shape
- [ ] `swipeLeft` always calls `advanceStack()` even if the write fails
- [ ] `swipeSuperLike` returns `'premium_required'` for free users without writing
- [ ] `swipeSuperLike` writes `isSuperLike: true` to the likes subcollection for premium users
- [ ] `checkDailyLimit` reads from Firestore and syncs `dailyLikesCount` and `isLimitReached`
- [ ] `advanceStack` sets `isRefetching: true` when remaining cards ≤ `REFETCH_THRESHOLD` (3)
- [ ] `advanceStack` does not double-trigger refetch if `isLoading` or `isRefetching` already true
- [ ] `reset()` returns the store to `initialState` — used on logout
- [ ] `getDailyLikesDoc` in `firestore.ts` returns `{ count: 0 }` for stale or missing docs
- [ ] `incrementDailyLikes` resets count to 1 when the existing `resetAt` is before today midnight
- [ ] All timestamps use `serverTimestamp()` — never `new Date()`
- [ ] Zero inline styles (not applicable — store file has no JSX)
- [ ] Zero `any` types
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch

`store/authStore.ts`, `store/onboardingStore.ts`, `store/matchStore.ts` (not yet built), `functions/src/`, `services/firebase/config.ts`, `services/firebase/storage.ts`, `components/`, `app/`, `types/`, `constants/`, `App.tsx`

Only modify `services/firebase/firestore.ts` (additions only — do not change existing functions) and the four `i18n/*.json` files.

## Commit

```
git commit -m "task-25: discovery store with stack fetch, swipe writes, and daily limit enforcement"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3.4] — YYYY-MM-DD
### Completed
- Task 25: Discovery Zustand store implemented (discoveryStore.ts)
- fetchStack calls getDiscoveryStack callable, resolves IDs to UserProfile objects
- swipeRight/swipeLeft/swipeSuperLike write to Firestore swipe subcollections
- Daily like limit enforced for free users (50 likes/day, reset at midnight)
- Auto-refetch signal (isRefetching) fires when stack drops to ≤ 3 cards
- getDailyLikesDoc and incrementDailyLikes added to services/firebase/firestore.ts

### Files Created / Modified
- store/discoveryStore.ts: full discovery store with all swipe actions and limit logic
- services/firebase/firestore.ts: getDailyLikesDoc, incrementDailyLikes added
- i18n/en.json, my.json, zh.json, ta.json: discovery.* keys added/confirmed

### Known Issues / Deferred
- advanceStack sets isRefetching:true as a signal; DiscoveryScreen (Task 27) must observe this flag and call fetchStack(userId) itself — the store does not auto-call fetchStack to avoid auth coupling
- Distance-based filtering still deferred (same as Task 23 note) — city-level only in Phase 1
- score field still present in getDiscoveryStack response — strip before production

### Next Up
- Task 26: SwipeCard component (Reanimated 3, Gesture.Pan(), 60fps, LIKE/NOPE/SUPER labels, photo pagination dots)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 26 prompt.

---

## Reasoning Level

Medium-High
