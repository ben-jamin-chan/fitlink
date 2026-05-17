# CODEX PROMPT — Task 29
# Match Store

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3.7 complete. Task 28 (FullProfileModal) is done. The discovery flow is fully wired — swipe cards, action buttons, the full profile modal with photo viewer, and the Cloud Function that creates match documents on mutual likes.

Relevant existing files:
- `functions/src/onSwipeCreated.ts` — creates `/matches/{matchId}` with `users`, `createdAt`, `lastMessage: null`, `lastMessageAt: null`, `{userId}_unread: 0`, `{targetId}_unread: 0` on mutual like. matchId = `[userId, targetId].sort().join('_')`.
- `types/match.ts` — `Match` and `MatchWithProfile` interfaces already defined; `MatchWithProfile` extends `Match` and adds `otherUser: UserProfile`
- `types/user.ts` — `UserProfile` interface fully defined
- `services/firebase/firestore.ts` — Firestore `db` instance exported; utility functions exist for user reads (`getUserProfile` or equivalent — check what's present and reuse)
- `store/authStore.ts` — `user.uid` available via `useAuthStore.getState().user?.uid`
- `store/discoveryStore.ts` — pattern reference for Zustand store with Firestore integration

Task 29 builds the **matchStore** — a Zustand store that maintains a real-time Firestore listener on the `/matches` collection, resolves each match to a `MatchWithProfile` (fetching the other user's profile), and exposes unmatch and read-receipt actions. This store powers the Matches screen (Task 30) and the Chat screen (Task 32).

---

## Task 29 — Match Store

**Files to create:**
- `store/matchStore.ts`

**Files to modify:**
- `services/firebase/firestore.ts` — add `getUserProfile` if not already present; add `deleteMatch` and `resetUnreadCount` helpers

---

### `services/firebase/firestore.ts` — additions only

Add the following exports if they do not already exist. Do **not** remove or rewrite any existing functions.

```typescript
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import type { UserProfile } from '@/types/user'
import type { Match } from '@/types/match'

/**
 * Fetch a single user profile by UID.
 * Returns null if the document does not exist.
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

/**
 * Subscribe to all matches for a given userId.
 * Calls `onUpdate` every time the collection changes.
 * Returns an Unsubscribe function — call it on cleanup.
 *
 * Results are ordered by lastMessageAt descending (matches with no
 * messages yet sort to the top because null < any Timestamp in
 * Firestore descending order — this matches the PRD spec for the
 * Matches tab showing "NEW" matches first).
 *
 * Firestore composite index required:
 *   Collection: matches
 *   Fields: users (Array) ASC, lastMessageAt DESC
 * This must match firestore.indexes.json (Task 40).
 */
export const subscribeToMatches = (
  userId: string,
  onUpdate: (matches: Match[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'matches'),
    where('users', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const matches: Match[] = snapshot.docs.map((d) => ({
        ...(d.data() as Match),
        id: d.id,
      }))
      onUpdate(matches)
    },
    onError
  )
}

/**
 * Delete a match document from Firestore.
 * The Cloud Function or security rules handle cascading cleanup (RTDB chat, blocked list).
 * The matchStore calls this on unmatch confirmation.
 */
export const deleteMatch = async (matchId: string): Promise<void> => {
  await deleteDoc(doc(db, 'matches', matchId))
}

/**
 * Reset the unread message count for a user on a given match to zero.
 * Called when the chat screen becomes active.
 */
export const resetUnreadCount = async (
  matchId: string,
  userId: string
): Promise<void> => {
  await updateDoc(doc(db, 'matches', matchId), {
    [`${userId}_unread`]: 0,
  })
}
```

---

### `store/matchStore.ts`

```typescript
import { create } from 'zustand'
import type { Unsubscribe } from 'firebase/firestore'
import {
  subscribeToMatches,
  deleteMatch,
  resetUnreadCount,
  getUserProfile,
} from '@/services/firebase/firestore'
import { useAuthStore } from '@/store/authStore'
import type { Match, MatchWithProfile } from '@/types/match'

// ---------------------------------------------------------------------------
// State & Action interfaces
// ---------------------------------------------------------------------------

interface MatchState {
  /** Resolved matches — each includes the other user's full profile */
  matches: MatchWithProfile[]
  /** True while the initial snapshot is still loading */
  isLoading: boolean
  /** Error string from Firestore listener — null when healthy */
  error: string | null
  /**
   * IDs of matches that arrived since the last time the Matches screen was
   * viewed. Used by MatchCelebrationModal (Task 34) and the NEW badge on
   * match cards. Cleared when the user taps the match or dismisses the modal.
   */
  newMatchIds: string[]
}

interface MatchActions {
  /**
   * Attach the Firestore real-time listener for the given userId.
   * Safe to call multiple times — will no-op if already subscribed.
   * Call this in RootNavigator (or a hook) after successful auth.
   */
  subscribeToMatches: (userId: string) => void
  /** Detach the Firestore listener and reset state. Call on sign-out. */
  unsubscribeFromMatches: () => void
  /**
   * Delete the match document from Firestore and remove from local state.
   * Does NOT navigate — the caller (MatchesScreen or ChatScreen) handles navigation.
   */
  unmatch: (matchId: string) => Promise<void>
  /**
   * Reset the unread counter for this match (called when ChatScreen opens).
   * Also removes the matchId from newMatchIds if present.
   */
  markAsRead: (matchId: string) => Promise<void>
  /** Remove a matchId from newMatchIds (called after modal is dismissed). */
  clearNewMatchId: (matchId: string) => void
}

type MatchStore = MatchState & MatchActions

// ---------------------------------------------------------------------------
// Internal helpers (module-level, not in store)
// ---------------------------------------------------------------------------

/** Unsubscribe fn held outside Zustand to avoid serialisation issues */
let _unsubscribe: Unsubscribe | null = null

/**
 * Resolve a raw Match to MatchWithProfile by fetching the other user's profile.
 * Returns null if the profile fetch fails (e.g. user deleted their account).
 * Callers must filter out nulls.
 */
const resolveMatch = async (
  match: Match,
  currentUserId: string
): Promise<MatchWithProfile | null> => {
  const otherUserId = match.users.find((id) => id !== currentUserId)
  if (otherUserId === undefined) return null

  const otherUser = await getUserProfile(otherUserId)
  if (otherUser === null) return null

  return { ...match, otherUser }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMatchStore = create<MatchStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  matches: [],
  isLoading: true,
  error: null,
  newMatchIds: [],

  // ── Actions ────────────────────────────────────────────────────────────────

  subscribeToMatches: (userId: string): void => {
    // Guard: don't create a second listener if one is already active
    if (_unsubscribe !== null) return

    set({ isLoading: true, error: null })

    _unsubscribe = subscribeToMatches(
      userId,
      async (rawMatches: Match[]) => {
        // Resolve profiles in parallel
        const settled = await Promise.allSettled(
          rawMatches.map((m) => resolveMatch(m, userId))
        )

        const resolved: MatchWithProfile[] = settled
          .filter(
            (r): r is PromiseFulfilledResult<MatchWithProfile> =>
              r.status === 'fulfilled' && r.value !== null
          )
          .map((r) => r.value)

        // Detect genuinely new match IDs (not previously in state)
        const previousIds = new Set(get().matches.map((m) => m.id))
        const arrivedIds = resolved
          .filter((m) => !previousIds.has(m.id))
          .map((m) => m.id)

        set((state) => ({
          matches: resolved,
          isLoading: false,
          error: null,
          // Only add new IDs if we've already had at least one snapshot
          // (first load should not trigger celebration modals)
          newMatchIds:
            state.isLoading
              ? state.newMatchIds
              : [...state.newMatchIds, ...arrivedIds],
        }))
      },
      (error: Error) => {
        set({ isLoading: false, error: error.message })
      }
    )
  },

  unsubscribeFromMatches: (): void => {
    if (_unsubscribe !== null) {
      _unsubscribe()
      _unsubscribe = null
    }
    set({
      matches: [],
      isLoading: true,
      error: null,
      newMatchIds: [],
    })
  },

  unmatch: async (matchId: string): Promise<void> => {
    // Optimistically remove from local state first
    set((state) => ({
      matches: state.matches.filter((m) => m.id !== matchId),
      newMatchIds: state.newMatchIds.filter((id) => id !== matchId),
    }))

    try {
      await deleteMatch(matchId)
    } catch (err) {
      // Rollback is handled by the Firestore listener — the document
      // will reappear in the next snapshot if deletion failed.
      // Log the error but don't re-throw; UX stays clean.
      console.error('[matchStore] unmatch failed:', err)
    }
  },

  markAsRead: async (matchId: string): Promise<void> => {
    const userId = useAuthStore.getState().user?.uid
    if (userId === undefined) return

    // Clear newMatchIds entry immediately
    set((state) => ({
      newMatchIds: state.newMatchIds.filter((id) => id !== matchId),
    }))

    try {
      await resetUnreadCount(matchId, userId)
    } catch (err) {
      console.error('[matchStore] markAsRead failed:', err)
    }
  },

  clearNewMatchId: (matchId: string): void => {
    set((state) => ({
      newMatchIds: state.newMatchIds.filter((id) => id !== matchId),
    }))
  },
}))
```

---

### i18n additions

Add the following keys to `i18n/en.json` under the `matches` namespace. Copy the same English values as placeholders into `my.json`, `zh.json`, and `ta.json`.

```json
"matches": {
  "tabMatches": "Matches",
  "tabMessages": "Messages",
  "noMatches": "No Matches Yet",
  "noMatchesSubtitle": "Start swiping to find your fitness match!",
  "noMessages": "No Messages Yet",
  "noMessagesSubtitle": "Say hi to your matches and break the ice!",
  "newBadge": "NEW",
  "activeNow": "Active now",
  "unmatch": "Unmatch",
  "unmatchConfirmTitle": "Unmatch {{name}}?",
  "unmatchConfirmMessage": "This will remove the match and delete all messages.",
  "unmatchConfirm": "Unmatch",
  "viewProfile": "View Profile",
  "report": "Report",
  "error": {
    "loadFailed": "Could not load matches. Please try again."
  }
}
```

---

## Important Architecture Notes for Codex

1. **`_unsubscribe` is module-level, not in Zustand state.** Storing Firestore `Unsubscribe` functions in Zustand state causes serialisation errors with the persist middleware and is unnecessary — the listener reference only needs to survive the app session, not persist across restarts. The module-level variable achieves this cleanly.

2. **First-load suppression for `newMatchIds`.** When the subscriber first attaches, all documents in the snapshot are "new" from Firestore's perspective but are not actually new matches — the user saw them before. The guard `state.isLoading ? state.newMatchIds : [...]` prevents a flood of celebration modals on every app open. Only matches that arrive on subsequent snapshots (after `isLoading` has been set to `false`) get added to `newMatchIds`.

3. **`MatchWithProfile` must already exist in `types/match.ts`.** The Task 04 type definition includes this. If it is missing or incomplete, add:
   ```typescript
   export interface MatchWithProfile extends Match {
     otherUser: UserProfile
   }
   ```
   Do not change any other existing type definitions.

4. **`Match` needs an `id` field.** The Firestore schema for `/matches/{matchId}` does not store `id` in the document itself (it's the document ID). The `subscribeToMatches` service function injects `id: d.id` when mapping snapshot docs. Ensure `Match` in `types/match.ts` has `id: string`. If missing, add it. Do not change any other fields.

5. **Profile fetch is parallel, not sequential.** `Promise.allSettled` is intentional — if one user profile fails to load (deleted account, network blip), it should not crash the entire matches list. Failed resolutions are filtered out silently.

6. **`unmatch` uses optimistic removal.** The item disappears from UI instantly. If the Firestore deletion fails, the real-time listener will restore the match on its next snapshot. This is acceptable UX; the match will reappear without a flash. Do not reverse the optimistic removal on error — it causes a worse visual glitch than the rare restoration.

7. **Do not call `subscribeToMatches` inside the store itself.** The store does not know when the user becomes authenticated. The caller — either `RootNavigator.tsx` or a dedicated `useMatchSubscription` hook (deferred to Task 30) — is responsible for calling `useMatchStore.getState().subscribeToMatches(userId)` after auth resolves, and `unsubscribeFromMatches()` on sign-out.

8. **No Zustand `persist` middleware on this store.** Match data is always fetched live. Persisting it would cause stale cache issues on login with a different account. Auth state persistence (authStore) is sufficient to restore session; matchStore hydrates from Firestore on each app open.

---

## Acceptance Criteria

- [ ] `store/matchStore.ts` created with correct TypeScript types — zero `any`, zero errors
- [ ] `subscribeToMatches(userId)` attaches a Firestore listener and populates `matches` in real time
- [ ] Each `MatchWithProfile` in `matches` array includes the `otherUser: UserProfile` resolved from `/users/{otherUserId}`
- [ ] Matches are ordered by `lastMessageAt` descending (newest message / no-message matches first)
- [ ] `unsubscribeFromMatches()` calls the Firestore unsub fn and resets state
- [ ] `unmatch(matchId)` removes from local state immediately and calls `deleteMatch`
- [ ] `markAsRead(matchId)` resets the Firestore unread counter and removes from `newMatchIds`
- [ ] `clearNewMatchId(matchId)` removes from `newMatchIds` without a Firestore write
- [ ] `newMatchIds` does NOT populate on first load (the initial snapshot does not trigger celebration modals)
- [ ] Failed profile fetches (`getUserProfile` returns null) are filtered out — store remains stable
- [ ] All service functions added to `services/firebase/firestore.ts` without removing existing code
- [ ] `Match` type has `id: string` field; `MatchWithProfile` extends `Match` with `otherUser: UserProfile`
- [ ] i18n `matches.*` keys added to all 4 language files
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`store/authStore.ts`, `store/discoveryStore.ts`, `store/onboardingStore.ts`, `types/user.ts` (except adding `id` to Match if missing), `components/`, `app/`, `services/firebase/config.ts`, `services/firebase/auth.ts`, `services/firebase/storage.ts`, `services/firebase/realtime.ts`, `functions/`, `firestore.rules`, `App.tsx`

## Commit
`git commit -m "task-29: match store with real-time firestore listener and profile resolution"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 4.1] — YYYY-MM-DD
### Completed
- Task 29: matchStore built — real-time Firestore listener, MatchWithProfile resolution, unmatch, markAsRead
- subscribeToMatches, deleteMatch, resetUnreadCount added to services/firebase/firestore.ts
- getUserProfile added to firestore.ts (or confirmed already present)
- newMatchIds first-load suppression implemented
- i18n matches.* keys added to all 4 language files

### Files Created / Modified
- store/matchStore.ts: full match store, listener management, optimistic unmatch, unread reset
- services/firebase/firestore.ts: subscribeToMatches, deleteMatch, resetUnreadCount, getUserProfile added
- types/match.ts: id field confirmed/added on Match; MatchWithProfile confirmed present
- i18n/en.json, my.json, zh.json, ta.json: matches.* namespace added

### Known Issues / Deferred
- subscribeToMatches not yet called from RootNavigator or hook — wired in Task 30 (MatchesScreen)
- unsubscribeFromMatches not yet called on sign-out — wired in Task 38 (SettingsScreen logout flow)
- MatchCelebrationModal (Task 34) reads newMatchIds — not yet built

### Next Up
- Task 30: MatchesScreen (grid + messages tabs, MatchCard, MessageListItem, real-time from matchStore)
```

---

## Reasoning Level
Medium
