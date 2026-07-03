# CODEX PROMPT — TASK 72
# Rewind (Undo Last Swipe) for Premium Users

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3A is in progress. Tasks 70 (Phase 3 TypeScript types) and 71 (Stripe Customer Portal
Cloud Function) are complete. This task implements the Rewind / Undo Last Swipe premium feature,
which was deferred from Phase 2 (Task 54).

Existing files Codex must read before writing anything:

- `store/discoveryStore.ts` — manages the swipe stack; already has `showUpsell('rewind')` called
  from the Rewind button handler for non-premium users; has `stack: UserProfile[]` and
  `currentIndex` state; `swipeRight`, `swipeLeft`, `swipeSuperLike` call `recordSwipe` Cloud
  Function
- `functions/src/recordSwipe.ts` — the authoritative server-side swipe writer; owns all writes
  to `/swipes/{uid}/likes/{targetId}` and `/swipes/{uid}/passes/{targetId}`; Codex must not
  duplicate this pattern
- `functions/src/index.ts` — exports all Cloud Functions; `rewindSwipe` must be appended here
- `components/discovery/ActionButtons.tsx` — renders the 5 swipe action buttons; the Rewind
  button currently calls `discoveryStore.showUpsell('rewind')` unconditionally; the premium path
  must be wired here
- `components/ui/UpsellModal.tsx` — already handles `reason: 'rewind'` with the correct headline
  and copy (Task 54); do not modify this file
- `store/subscriptionStore.ts` — exposes `isPremium(): boolean`; use this to gate the rewind
  action client-side before calling the Cloud Function
- `types/user.ts` — `UserProfile` interface; Phase 3 optional fields already added (Task 70);
  do not add new fields in this task
- `services/firebase/config.ts` — exports `functions` (Firebase Functions instance); use
  `httpsCallable(functions, 'rewindSwipe')` for the client call
- `i18n/en.json` — all user-facing strings must be added here and mirrored to `my.json`,
  `zh.json`, `ta.json`
- `firestore.rules` — `/swipes/` client writes are already denied; the Cloud Function uses the
  Admin SDK so it bypasses rules; do not touch `firestore.rules` in this task

**All swipe writes are server-owned. The `rewindSwipe` Cloud Function must use the Firebase
Admin SDK to read and delete from `/swipes/{uid}/likes/` and `/swipes/{uid}/passes/`. The client
must never write directly to any `/swipes/` path. This is enforced by Firestore security rules.**

**The rewind feature is for premium users only. The non-premium path (showing the UpsellModal
with `reason: 'rewind'`) is already implemented in `discoveryStore` and `ActionButtons`. This
task wires the premium execution path only — do not change the non-premium path.**

**`rewindSwipe` deletes the most recent entry from `/swipes/{uid}/likes/` ordered by
`createdAt` descending. If the user's last swipe was a pass (`/swipes/{uid}/passes/`), that is
also a valid rewind target. The function checks likes first, then passes, and deletes whichever
is more recent. It returns the deleted target's `UserProfile` so the client can prepend it back
onto the discovery stack.**

---

## Task 72 — Rewind (Undo Last Swipe) for Premium Users

**Files to create:**
- `functions/src/rewindSwipe.ts`

**Files to modify:**
- `functions/src/index.ts` — append `rewindSwipe` export
- `store/discoveryStore.ts` — add `rewind()` action
- `components/discovery/ActionButtons.tsx` — wire premium rewind path
- `i18n/en.json` — add `discovery.rewind.*` keys
- `i18n/my.json` — mirror new keys with English placeholders
- `i18n/zh.json` — mirror new keys with English placeholders
- `i18n/ta.json` — mirror new keys with English placeholders

---

### `functions/src/rewindSwipe.ts`

> New 2nd gen callable Cloud Function. Called by the client when a premium user taps Rewind.
> Finds the most recently created swipe record (like or pass) for the authenticated user,
> deletes it from Firestore, then fetches and returns the target user's `UserProfile` document
> so the client can restore the card to the front of the discovery stack.

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RewindResult {
  targetProfile: Record<string, unknown>
  targetId: string
  deletedCollection: 'likes' | 'passes'
}

// ---------------------------------------------------------------------------
// Helper — find the most recent swipe across likes and passes
// ---------------------------------------------------------------------------

interface SwipeCandidate {
  targetId: string
  createdAt: admin.firestore.Timestamp
  collection: 'likes' | 'passes'
}

async function getMostRecentSwipe(
  uid: string,
  db: admin.firestore.Firestore,
): Promise<SwipeCandidate | null> {
  const [likesSnap, passesSnap] = await Promise.all([
    db
      .collection('swipes')
      .doc(uid)
      .collection('likes')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get(),
    db
      .collection('swipes')
      .doc(uid)
      .collection('passes')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get(),
  ])

  const likeDoc = likesSnap.empty ? null : likesSnap.docs[0]
  const passDoc = passesSnap.empty ? null : passesSnap.docs[0]

  if (likeDoc === null && passDoc === null) {
    return null
  }

  if (likeDoc !== null && passDoc === null) {
    const data = likeDoc.data()
    return {
      targetId: likeDoc.id,
      createdAt: data.createdAt as admin.firestore.Timestamp,
      collection: 'likes',
    }
  }

  if (likeDoc === null && passDoc !== null) {
    const data = passDoc.data()
    return {
      targetId: passDoc.id,
      createdAt: data.createdAt as admin.firestore.Timestamp,
      collection: 'passes',
    }
  }

  // Both exist — return whichever is more recent
  const likeData = likeDoc!.data()
  const passData = passDoc!.data()
  const likeTime = (likeData.createdAt as admin.firestore.Timestamp).toMillis()
  const passTime = (passData.createdAt as admin.firestore.Timestamp).toMillis()

  if (likeTime >= passTime) {
    return {
      targetId: likeDoc!.id,
      createdAt: likeData.createdAt as admin.firestore.Timestamp,
      collection: 'likes',
    }
  }

  return {
    targetId: passDoc!.id,
    createdAt: passData.createdAt as admin.firestore.Timestamp,
    collection: 'passes',
  }
}

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const rewindSwipe = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest): Promise<RewindResult> => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in to rewind')
    }
    const uid = request.auth.uid
    const db = admin.firestore()

    // 2. Verify premium status server-side — read from Firestore, not from client claim
    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User document not found')
    }
    const userData = userDoc.data()!
    const premiumActive: boolean =
      (userData['premium'] as { active?: boolean } | undefined)?.active === true

    if (!premiumActive) {
      throw new HttpsError('permission-denied', 'Rewind is a premium feature')
    }

    // 3. Find the most recent swipe (like or pass)
    const mostRecent = await getMostRecentSwipe(uid, db)

    if (mostRecent === null) {
      throw new HttpsError('not-found', 'No swipes to undo')
    }

    const { targetId, collection: deletedCollection } = mostRecent

    // 4. Delete the swipe record
    await db
      .collection('swipes')
      .doc(uid)
      .collection(deletedCollection)
      .doc(targetId)
      .delete()

    // 5. Fetch the target user's profile to return to the client
    const targetDoc = await db.collection('users').doc(targetId).get()
    if (!targetDoc.exists) {
      // Target user deleted their account — rewind succeeded but no profile to show
      throw new HttpsError(
        'not-found',
        'The user you swiped on no longer exists',
      )
    }

    const targetProfile = targetDoc.data()!

    return {
      targetProfile,
      targetId,
      deletedCollection,
    }
  },
)
```

---

### `functions/src/index.ts` — Update

> Append the `rewindSwipe` export. Do not touch any existing exports.

```typescript
// Add this line alongside the other named exports:
export { rewindSwipe } from './rewindSwipe'
```

---

### `store/discoveryStore.ts` — Update

> Add the `rewind()` action. The existing non-premium `showUpsell('rewind')` path in
> `ActionButtons` stays unchanged — `rewind()` is only called when the user is already
> confirmed premium. Do not modify any existing actions (`swipeRight`, `swipeLeft`,
> `swipeSuperLike`, `fetchStack`, `showUpsell`).

```typescript
// Add to imports at the top of the file (alongside existing firebase/functions import):
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/services/firebase/config'
import type { UserProfile } from '@/types/user'

// ---------------------------------------------------------------------------
// Type for the Cloud Function response
// ---------------------------------------------------------------------------

interface RewindResult {
  targetProfile: UserProfile
  targetId: string
  deletedCollection: 'likes' | 'passes'
}

// ---------------------------------------------------------------------------
// Add to the store state interface — insert after existing state fields:
// ---------------------------------------------------------------------------

// isRewinding: boolean   ← add this field to the state interface

// ---------------------------------------------------------------------------
// Add to the store initial state — insert after existing initial values:
// ---------------------------------------------------------------------------

// isRewinding: false

// ---------------------------------------------------------------------------
// Add the rewind() action inside the store definition:
// ---------------------------------------------------------------------------

rewind: async (): Promise<void> => {
  set({ isRewinding: true })
  try {
    const rewindFn = httpsCallable<Record<string, never>, RewindResult>(
      functions,
      'rewindSwipe',
    )
    const result = await rewindFn({})
    const { targetProfile, targetId } = result.data

    // Prepend the restored profile back to the front of the discovery stack
    set((state) => ({
      stack: [{ ...targetProfile, uid: targetId } as UserProfile, ...state.stack],
      isRewinding: false,
    }))
  } catch (error: unknown) {
    set({ isRewinding: false })
    // Re-throw so ActionButtons can surface the error via Toast
    throw error
  }
},
```

> Also add `isRewinding: boolean` to the store's exported state type / interface and include
> `rewind: () => Promise<void>` in the action type definitions. The exact location depends on
> how the existing store interface is structured — match the existing pattern exactly.

---

### `components/discovery/ActionButtons.tsx` — Update

> Wire the premium rewind execution path. The non-premium path (`showUpsell('rewind')`) already
> exists. Add the premium branch so that premium users call `discoveryStore.rewind()` instead of
> seeing the upsell. Import `useTranslation` for the error toast if not already imported.

```typescript
// Add or confirm these imports are present:
import { useTranslation } from 'react-i18next'
import { useDiscoveryStore } from '@/store/discoveryStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
// showToast utility — use whatever toast mechanism already exists in the codebase
// (e.g. the global showToast from components/ui/Toast.tsx)

// Inside the component, locate the existing Rewind button handler.
// It currently looks like this (or equivalent):
//
//   const handleRewind = () => {
//     discoveryStore.showUpsell('rewind')
//   }
//
// Replace it with the following:

const { t } = useTranslation()
const { rewind, isRewinding } = useDiscoveryStore()
const { isPremium } = useSubscriptionStore()

const handleRewind = async (): Promise<void> => {
  if (!isPremium()) {
    useDiscoveryStore.getState().showUpsell('rewind')
    return
  }
  try {
    await rewind()
  } catch {
    showToast(t('discovery.rewind.error'), 'error')
  }
}

// Update the Rewind button JSX to disable it while rewinding:
// Pass `disabled={isRewinding}` to the Rewind button so it cannot be tapped
// multiple times during the async operation.
//
// The button already has yellow color and curved-arrow icon — do not change its appearance.
// Do not touch any of the other four button handlers (Pass, Super Like, Like, Info).
```

---

### `i18n/en.json` — Update

> Add the following keys under the `discovery` namespace. Merge into the existing
> `"discovery": { ... }` object — do not replace existing keys.

```json
"rewind": {
  "noSwipes": "Nothing to undo yet",
  "error": "Couldn't undo last swipe. Please try again.",
  "notAvailable": "Rewind is not available"
}
```

---

### `i18n/my.json` — Update

> Mirror the same keys with the English values as placeholders.

```json
"rewind": {
  "noSwipes": "Nothing to undo yet",
  "error": "Couldn't undo last swipe. Please try again.",
  "notAvailable": "Rewind is not available"
}
```

---

### `i18n/zh.json` — Update

> Mirror the same keys with the English values as placeholders.

```json
"rewind": {
  "noSwipes": "Nothing to undo yet",
  "error": "Couldn't undo last swipe. Please try again.",
  "notAvailable": "Rewind is not available"
}
```

---

### `i18n/ta.json` — Update

> Mirror the same keys with the English values as placeholders.

```json
"rewind": {
  "noSwipes": "Nothing to undo yet",
  "error": "Couldn't undo last swipe. Please try again.",
  "notAvailable": "Rewind is not available"
}
```

---

## Important Architecture Notes for Codex

1. **Premium check is always server-side.** The `rewindSwipe` Cloud Function reads
   `users/{uid}.premium.active` from Firestore using the Admin SDK. The client-side
   `isPremium()` check in `ActionButtons` is a UX gate only — it prevents unnecessary
   network calls for non-premium users but is not the security enforcement point. Never
   remove the server-side premium check from the Cloud Function.

2. **The Cloud Function uses Admin SDK for all Firestore access.** `admin.firestore()` bypasses
   Firestore security rules. This is correct and expected — `/swipes/` client writes are denied
   by rules (Task 68), but the Cloud Function is server-authoritative. Do not add any Firebase
   client SDK imports to `functions/src/rewindSwipe.ts`.

3. **Only the most recent swipe is deleted — never a batch.** Rewind undoes exactly one swipe
   per call. The function queries `/swipes/{uid}/likes/` and `/swipes/{uid}/passes/` each with
   `.limit(1)` and compares timestamps to find the single most recent entry. If both collections
   are empty, throw `HttpsError('not-found')` and surface `t('discovery.rewind.noSwipes')` via
   Toast on the client.

4. **The deleted swipe is not re-added to any exclusion list.** When a like is rewound, the
   target user's doc ID is simply removed from `/swipes/{uid}/likes/`. On the next
   `getDiscoveryStack` call, that user will re-appear in the scored candidate pool naturally,
   because the exclusion query checks for the presence of a likes/passes document. No additional
   cleanup is needed.

5. **`isRewinding` prevents double-tap.** The Rewind button must be disabled (`disabled` prop
   set to `true`) while `isRewinding === true` in the discovery store. This prevents multiple
   concurrent calls to `rewindSwipe` before the first resolves.

6. **The restored profile is prepended to the front of the stack, not appended.** After a
   successful rewind, `set((state) => ({ stack: [restoredProfile, ...state.stack] }))` puts
   the returned profile at index 0 so it becomes the top card immediately. Do not push to the
   end of the stack.

7. **`rewind()` throws on all error conditions.** The action does not catch internally beyond
   resetting `isRewinding: false`. The caller (`ActionButtons.handleRewind`) wraps it in
   `try/catch` and surfaces the error toast. This keeps error-handling responsibility at the
   component layer, consistent with the pattern used by `subscribe()` in
   `store/subscriptionStore.ts`.

8. **Do not modify `functions/src/recordSwipe.ts`.** Rewind is a separate, independent Cloud
   Function. The two functions have no shared state and no call relationship.

9. **`httpsCallable` generic types.** The callable is typed as
   `httpsCallable<Record<string, never>, RewindResult>` because `rewindSwipe` accepts no input
   arguments. `Record<string, never>` is the correct strict-mode substitute for an empty input
   type — never use `{}` or `any`.

10. **2nd gen function region.** `rewindSwipe` must export with `{ region: 'asia-southeast1' }`
    matching every other Cloud Function in this project. Do not omit the region option.

---

## Acceptance Criteria

- [ ] `functions/src/rewindSwipe.ts` created; exports `rewindSwipe` as a named export
- [ ] `rewindSwipe` is a 2nd gen `onCall` function with `region: 'asia-southeast1'`
- [ ] `rewindSwipe` performs an auth check and throws `HttpsError('unauthenticated')` if
      `request.auth` is null
- [ ] `rewindSwipe` reads `users/{uid}.premium.active` from Firestore server-side and throws
      `HttpsError('permission-denied')` for non-premium users
- [ ] `rewindSwipe` queries both `/swipes/{uid}/likes` and `/swipes/{uid}/passes` with
      `.limit(1).orderBy('createdAt', 'desc')` and deletes the more recent document
- [ ] `rewindSwipe` throws `HttpsError('not-found')` when both swipe subcollections are empty
- [ ] `rewindSwipe` returns `{ targetProfile, targetId, deletedCollection }` on success
- [ ] `functions/src/index.ts` exports `rewindSwipe` alongside existing exports — no existing
      exports removed
- [ ] `discoveryStore` has a new `isRewinding: boolean` state field initialised to `false`
- [ ] `discoveryStore.rewind()` calls `httpsCallable(functions, 'rewindSwipe')` with correct
      generic types `<Record<string, never>, RewindResult>`
- [ ] `discoveryStore.rewind()` prepends the returned profile to the front of `stack` on success
- [ ] `discoveryStore.rewind()` resets `isRewinding: false` in both success and error paths
- [ ] `ActionButtons.handleRewind` calls `rewind()` for premium users and `showUpsell('rewind')`
      for non-premium users — the non-premium path is unchanged
- [ ] The Rewind button in `ActionButtons` is disabled while `isRewinding === true`
- [ ] `discovery.rewind.*` keys added to all four i18n files (`en`, `my`, `zh`, `ta`)
- [ ] No `any` anywhere in new or modified files
- [ ] No inline `style={{ }}` in any modified component
- [ ] No `console.*` calls in any new or modified file
- [ ] All imports in new/modified client files use the `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task
- [ ] `npm --prefix functions run build` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `services/firebase/config.ts`, `firestore.rules`, `firestore.indexes.json`,
`functions/src/recordSwipe.ts`, `components/ui/UpsellModal.tsx`, `store/authStore.ts`,
`store/subscriptionStore.ts` (read-only for `isPremium()`), `types/user.ts`, `types/event.ts`,
`types/checkin.ts`, `types/subscription.ts`, `constants/`, `functions/src/createCustomerPortalSession.ts`

---

## Commit

```
git commit -m "task-72: rewind undo last swipe for premium users"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3A - Task 72] - YYYY-MM-DD

### Completed

- Task 72: Rewind (Undo Last Swipe) for Premium Users
- rewindSwipe: 2nd gen callable Cloud Function; server-side premium check; queries likes and
  passes subcollections; deletes most recent; returns target UserProfile
- discoveryStore: rewind() action added; isRewinding state; restored profile prepended to stack
- ActionButtons: premium users routed to rewind(), non-premium path unchanged (showUpsell)
- i18n: discovery.rewind.* keys added to all 4 language files

### Files Created / Modified

- functions/src/rewindSwipe.ts: created — onCall callable, Admin SDK, getMostRecentSwipe helper
- functions/src/index.ts: rewindSwipe export appended
- store/discoveryStore.ts: rewind() action and isRewinding state added
- components/discovery/ActionButtons.tsx: handleRewind wired for premium/non-premium paths
- i18n/en.json, my.json, zh.json, ta.json: discovery.rewind.* keys added

### Architecture Decisions

- [Document any non-obvious decisions made during implementation]

### Known Issues / Deferred

- [List anything intentionally incomplete]

### Next Up

- Task 73: Incognito Mode — browse profiles without appearing in others' discovery stacks
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 73 prompt.

---

## Reasoning Level

High — Cloud Function touches Firestore swipe subcollections via Admin SDK with a
cross-collection most-recent query; store integration with async error propagation; interaction
with existing `recordSwipe` architecture and premium gating system.
