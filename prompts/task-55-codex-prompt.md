@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2 is active. Tasks 47–54 are complete. The project is a React Native + Expo fitness dating app targeting Malaysia and SEA.

**What exists that this task depends on:**

- `store/discoveryStore.ts` — `swipeRight()`, `swipeLeft()`, `swipeSuperLike()` currently write directly to Firestore subcollections `/swipes/{userId}/likes/{targetId}` and `/swipes/{userId}/passes/{targetId}` from the client. `subscriptionStore.isPremium()` is used to bypass the client-side daily limit for premium users. `showUpsell('likes')` is dispatched when the daily cap is hit.
- `store/subscriptionStore.ts` — `isPremium(): boolean` derives from `profileStore.profile.premium.active`. `showUpsell(reason)` is available.
- `functions/src/` — `onSwipeCreated.ts` triggers on `/swipes/{userId}/likes/{targetId}`.onCreate. This trigger path **must not change**. Tasks 50 and 51 added `createStripeCheckout.ts` and Stripe plumbing. All functions are 2nd gen (`asia-southeast1`).
- `functions/src/index.ts` — exports all deployed Cloud Functions. New functions must be added here.
- `firestore.rules` — currently allows authenticated client writes to `/swipes/{userId}/likes/{targetId}` and `/swipes/{userId}/passes/{targetId}`. This task changes those rules to deny all client writes.
- `types/subscription.ts` — `UpsellReason` type exists: `'likes' | 'superLike' | 'rewind'`.
- `types/user.ts` — `UserProfile` has `premium.active`, `subscription.tier` normalised at the service boundary.
- `i18n/en.json` — `errors.dailyLimit` key may not yet exist; add if absent.

**Critical architectural boundary for this task:**

> **After Task 55, no client code may write directly to `/swipes/{userId}/likes/{targetId}` or `/swipes/{userId}/passes/{targetId}`. All swipe writes go through the `recordSwipe` Cloud Function. The `onSwipeCreated` Firestore trigger in `functions/src/onSwipeCreated.ts` already listens on this path — that trigger must continue to fire correctly after the server-side write, so the path structure does not change.**

> **The daily likes document lives at `users/{userId}/dailyLikes` as a single document (not a collection). The structure is `{ count: number; resetAt: Timestamp }`. Firestore rules already block client writes to this document (Task 68 in the plan). However, this task must also deny client writes to `/swipes/` subcollections now that `recordSwipe` handles all writes.**

---

## Task 55 — Server-Side Daily Likes Enforcement (recordSwipe Cloud Function)

**Files to create:**
- `functions/src/recordSwipe.ts`

**Files to modify:**
- `functions/src/index.ts` — export `recordSwipe`
- `store/discoveryStore.ts` — replace direct Firestore swipe writes with `recordSwipe` Cloud Function calls
- `firestore.rules` — deny all client writes to `/swipes/{userId}/likes/{targetId}` and `/swipes/{userId}/passes/{targetId}`
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `errors.dailyLimit` key if absent

---

### `functions/src/recordSwipe.ts`

This is a 2nd gen HTTP callable Cloud Function (`asia-southeast1`) that handles all swipe writes transactionally. It enforces the daily like cap for free users, writes to the correct Firestore subcollection path so `onSwipeCreated` continues to trigger, and returns the remaining like count to the client.

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

// Direction type — must match client-side SwipeDirection in discoveryStore
type SwipeDirection = 'like' | 'pass' | 'superlike'

interface RecordSwipeData {
  targetId: string
  direction: SwipeDirection
}

interface RecordSwipeResult {
  success: boolean
  remainingLikes: number
}

const FREE_DAILY_LIMIT = 50

export const recordSwipe = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<RecordSwipeData>): Promise<RecordSwipeResult> => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }

    const userId = request.auth.uid
    const { targetId, direction } = request.data

    // 2. Validate input
    if (!targetId || typeof targetId !== 'string') {
      throw new HttpsError('invalid-argument', 'targetId is required')
    }
    if (!['like', 'pass', 'superlike'].includes(direction)) {
      throw new HttpsError('invalid-argument', 'direction must be like, pass, or superlike')
    }

    const db = admin.firestore()

    // 3. For likes and superlikes: enforce daily cap via transaction
    if (direction === 'like' || direction === 'superlike') {
      // Read user's premium status to determine cap
      const userDoc = await db.doc(`users/${userId}`).get()
      const userData = userDoc.data()

      if (!userData) {
        throw new HttpsError('not-found', 'User not found')
      }

      const isPremium: boolean = userData?.premium?.active === true
      const dailyLikesRef = db.doc(`users/${userId}/dailyLikes/doc`)

      let remainingLikes = 0

      // Run transaction to atomically check and increment daily count
      await db.runTransaction(async (transaction) => {
        const dailyLikesSnap = await transaction.get(dailyLikesRef)

        const now = admin.firestore.Timestamp.now()
        const nowMs = now.toMillis()

        let count = 0
        let resetAt: admin.firestore.Timestamp = admin.firestore.Timestamp.fromMillis(
          getNextMidnightMs()
        )

        if (dailyLikesSnap.exists) {
          const data = dailyLikesSnap.data()!
          const existingResetAt: admin.firestore.Timestamp = data.resetAt

          // If resetAt has passed, the count resets
          if (existingResetAt.toMillis() <= nowMs) {
            count = 0
            resetAt = admin.firestore.Timestamp.fromMillis(getNextMidnightMs())
          } else {
            count = data.count ?? 0
            resetAt = existingResetAt
          }
        }

        // Enforce cap for free users only
        if (!isPremium && count >= FREE_DAILY_LIMIT) {
          throw new HttpsError('resource-exhausted', 'daily_limit')
        }

        // Increment
        const newCount = count + 1
        transaction.set(dailyLikesRef, { count: newCount, resetAt }, { merge: true })

        remainingLikes = isPremium
          ? Number.MAX_SAFE_INTEGER
          : Math.max(0, FREE_DAILY_LIMIT - newCount)
      })

      // 4. Write swipe to the correct subcollection path so onSwipeCreated fires
      const swipePath =
        direction === 'like'
          ? `swipes/${userId}/likes/${targetId}`
          : `swipes/${userId}/likes/${targetId}` // superlike also writes to likes subcollection with flag

      const swipePayload: Record<string, unknown> = {
        swiperId: userId,
        targetId,
        isSuperLike: direction === 'superlike',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }

      await db.doc(swipePath).set(swipePayload)

      return { success: true, remainingLikes }
    }

    // 5. Passes: write directly, no limit check
    await db.doc(`swipes/${userId}/passes/${targetId}`).set({
      swiperId: userId,
      targetId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { success: true, remainingLikes: FREE_DAILY_LIMIT } // passes don't consume likes
  }
)

/**
 * Returns the Unix timestamp (ms) of the next midnight in UTC+8 (Malaysia/SEA time).
 * This approximates local midnight. A production app should derive the user's
 * actual timezone from their profile; UTC+8 covers MY, SG, PH and most of SEA.
 */
function getNextMidnightMs(): number {
  const MYT_OFFSET_MS = 8 * 60 * 60 * 1000 // UTC+8
  const nowUtc = Date.now()
  const nowMyt = nowUtc + MYT_OFFSET_MS

  // Truncate to start of current MYT day, then add 24h
  const startOfTodayMyt = Math.floor(nowMyt / 86_400_000) * 86_400_000
  const nextMidnightMyt = startOfTodayMyt + 86_400_000

  // Convert back to UTC ms
  return nextMidnightMyt - MYT_OFFSET_MS
}
```

---

### `functions/src/index.ts` — Update

Add the `recordSwipe` export alongside existing function exports.

```typescript
// Add this import alongside existing ones:
export { recordSwipe } from './recordSwipe'

// All existing exports remain untouched:
// export { onUserCreated } from './onUserCreated'
// export { onSwipeCreated } from './onSwipeCreated'
// export { getDiscoveryStack } from './getDiscoveryStack'
// export { createStripeCheckout } from './createStripeCheckout'
// export { stripeWebhook } from './stripeWebhook'
// export { onNewMessage } from './onNewMessage'
// ... etc.
```

Do not touch any other export or logic in `index.ts`.

---

### `store/discoveryStore.ts` — Update

Replace direct Firestore writes in `swipeRight()`, `swipeLeft()`, and `swipeSuperLike()` with calls to the `recordSwipe` Cloud Function via `httpsCallable`. The `onSwipeCreated` trigger is server-side and will continue to fire correctly because `recordSwipe` writes to the same path.

**Imports to add:**
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions'
```

**Remove from imports (if present and now unused after this refactor):**
```typescript
// Remove direct Firestore write imports only if they are solely used for swipe writes.
// Do NOT remove imports used by other discoveryStore actions (e.g. fetchStack, checkDailyLimit reads).
```

**Replace the three swipe action implementations:**

```typescript
// Internal helper — call once at store init or lazily
const getRecordSwipeFn = () => {
  const functions = getFunctions(undefined, 'asia-southeast1')
  return httpsCallable<
    { targetId: string; direction: 'like' | 'pass' | 'superlike' },
    { success: boolean; remainingLikes: number }
  >(functions, 'recordSwipe')
}

// swipeRight — replaces direct Firestore write
swipeRight: async (targetId: string): Promise<void> => {
  const { profile } = useProfileStore.getState()
  const { isPremium } = useSubscriptionStore.getState()

  // Client-side optimistic guard (server enforces too)
  if (!isPremium() && get().dailyLikesCount >= 50) {
    useSubscriptionStore.getState().showUpsell('likes')
    return
  }

  set({ isLoading: true })
  try {
    const recordSwipe = getRecordSwipeFn()
    const result = await recordSwipe({ targetId, direction: 'like' })

    set((state) => ({
      stack: state.stack.filter((u) => u.uid !== targetId),
      dailyLikesCount: 50 - (result.data.remainingLikes ?? 0),
      isLoading: false,
    }))
  } catch (error: unknown) {
    set({ isLoading: false })
    // 'resource-exhausted' code means daily limit hit server-side
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'functions/resource-exhausted'
    ) {
      useSubscriptionStore.getState().showUpsell('likes')
    } else {
      // Surface other errors via toast (import showToast from utils or a toast ref)
      console.error('[discoveryStore] swipeRight error:', error)
    }
  }
},

// swipeLeft — replaces direct Firestore write
swipeLeft: async (targetId: string): Promise<void> => {
  set({ isLoading: true })
  try {
    const recordSwipe = getRecordSwipeFn()
    await recordSwipe({ targetId, direction: 'pass' })
    set((state) => ({
      stack: state.stack.filter((u) => u.uid !== targetId),
      isLoading: false,
    }))
  } catch (error: unknown) {
    set({ isLoading: false })
    console.error('[discoveryStore] swipeLeft error:', error)
  }
},

// swipeSuperLike — replaces direct Firestore write
swipeSuperLike: async (targetId: string): Promise<void> => {
  const { isPremium } = useSubscriptionStore.getState()

  if (!isPremium()) {
    useSubscriptionStore.getState().showUpsell('superLike')
    return
  }

  set({ isLoading: true })
  try {
    const recordSwipe = getRecordSwipeFn()
    await recordSwipe({ targetId, direction: 'superlike' })
    set((state) => ({
      stack: state.stack.filter((u) => u.uid !== targetId),
      isLoading: false,
    }))
  } catch (error: unknown) {
    set({ isLoading: false })
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'functions/resource-exhausted'
    ) {
      useSubscriptionStore.getState().showUpsell('likes')
    } else {
      console.error('[discoveryStore] swipeSuperLike error:', error)
    }
  }
},
```

> **Note on `dailyLikesCount` derivation:** The store currently tracks `dailyLikesCount` locally. After this refactor, it is derived as `FREE_DAILY_LIMIT - remainingLikes` from the Cloud Function response. Update the `checkDailyLimit()` action to remain a read-only helper for display purposes (reading `users/{userId}/dailyLikes/doc` via Firestore directly is still permitted by security rules). Do not remove `checkDailyLimit()`.

---

### `firestore.rules` — Update

Locate the existing `/swipes` rules and replace them with client-write-deny rules. The `onSwipeCreated` Cloud Function and `recordSwipe` use the Admin SDK and bypass security rules, so these denials only affect client SDKs.

```javascript
// REPLACE existing swipes rules with:

match /swipes/{userId}/likes/{targetId} {
  // All client writes denied — recordSwipe Cloud Function handles all writes via Admin SDK
  allow read: if request.auth != null
    && (request.auth.uid == userId || request.auth.uid == targetId);
  allow write: if false;
}

match /swipes/{userId}/passes/{targetId} {
  // All client writes denied — recordSwipe Cloud Function handles all writes via Admin SDK
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false;
}

// Also deny client writes to dailyLikes — server-managed by recordSwipe transaction
match /users/{userId}/dailyLikes/{doc} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false;
}
```

Do not touch any other rules in `firestore.rules`.

---

### `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Add the following key under `errors` if it does not already exist:

```json
{
  "errors": {
    "dailyLimit": "You've reached your daily like limit. Upgrade to Premium for unlimited likes."
  }
}
```

Add to all four files. Use the English value as a placeholder in `my.json`, `zh.json`, and `ta.json` until real translations are provided.

---

## Important Architecture Notes for Codex

1. **`onSwipeCreated` trigger path must remain unchanged.** The existing Cloud Function `onSwipeCreated` listens on `swipes/{userId}/likes/{targetId}`. The `recordSwipe` function writes to this exact path using the Admin SDK. Do not change the collection name, the subcollection name, or the document ID format. If the path changes, mutual like detection breaks silently.

2. **Superlike writes to the `likes` subcollection, not a separate `superlikes` subcollection.** A super like is a like with `isSuperLike: true`. The `onSwipeCreated` trigger reads `isSuperLike` from the document. This is the existing Phase 1 schema. Do not introduce a new subcollection.

3. **Daily limit enforcement uses a Firestore transaction, not `FieldValue.increment`.** The transaction reads the current count and `resetAt`, resets if expired, checks the cap, and increments atomically. A plain increment would allow race conditions to exceed the cap.

4. **`getNextMidnightMs()` uses UTC+8 (MYT).** This covers Malaysia, Singapore, and the Philippines. It is a pragmatic approximation. Do not replace it with `new Date()` local time — Cloud Functions run in a server timezone that may differ from the user's device.

5. **Client-side `dailyLikesCount` remains as an optimistic guard only.** The server is the source of truth. If the client guard passes but the server rejects with `resource-exhausted`, the client must handle that error by showing the upsell modal. Both guards must exist — removing the client guard would cause every swipe to make a network round-trip before showing the upsell.

6. **`getFunctions` must reference `asia-southeast1` region.** All callable functions in this project deploy to `asia-southeast1`. Calling `getFunctions()` without a region will target `us-central1` and return a `not-found` error.

7. **No direct Firestore writes to `/swipes/` remain in any client file after this task.** Search for all occurrences of `swipes/` in `store/`, `services/`, `app/`, and `components/` and confirm they are removed or replaced. The only remaining references to `swipes/` in client code should be read-only (e.g. `checkDailyLimit` reading `users/{userId}/dailyLikes/doc`).

8. **`httpsCallable` error codes are namespaced.** Firebase wraps `HttpsError` codes as `functions/{code}`, so `resource-exhausted` from the server becomes `functions/resource-exhausted` on the client. Check for this exact string when branching on the error.

9. **Do not install new npm packages in the main `package.json`.** `firebase/functions` (`httpsCallable`, `getFunctions`) is already part of the `firebase` SDK installed in Phase 1. Only `functions/package.json` may need updates if `@google-cloud/vision` or similar is not already installed — but Task 55 does not require Vision.

10. **`console.error` in client store actions is temporary.** Per CONVENTIONS.md Section 16, `console.log` must not be committed. `console.error` is used here for surfacing unexpected errors during development; it will be replaced with Crashlytics in Task 67. Add a `// TODO Task 67: replace with crashlytics.logError` comment.

---

## Acceptance Criteria

- [ ] `functions/src/recordSwipe.ts` created and exports `recordSwipe` as a named export
- [ ] `recordSwipe` is a 2nd gen callable function deploying to `asia-southeast1`
- [ ] Auth check at the top of `recordSwipe` throws `HttpsError('unauthenticated')` if `request.auth` is null
- [ ] Firestore transaction in `recordSwipe` correctly resets count when `resetAt` has passed
- [ ] Free user hitting 50 likes receives `HttpsError('resource-exhausted', 'daily_limit')` from the server
- [ ] Premium user (`premium.active === true`) bypasses the daily cap and can swipe without limit
- [ ] Both `like` and `superlike` directions write to `swipes/{userId}/likes/{targetId}` — `isSuperLike` field distinguishes them
- [ ] `pass` direction writes to `swipes/{userId}/passes/{targetId}` without any daily cap check
- [ ] `recordSwipe` exported from `functions/src/index.ts`
- [ ] `store/discoveryStore.ts`: `swipeRight()` calls `recordSwipe` Cloud Function — no direct Firestore write to `/swipes/`
- [ ] `store/discoveryStore.ts`: `swipeLeft()` calls `recordSwipe` Cloud Function — no direct Firestore write to `/swipes/`
- [ ] `store/discoveryStore.ts`: `swipeSuperLike()` calls `recordSwipe` Cloud Function — no direct Firestore write to `/swipes/`
- [ ] Client receives `functions/resource-exhausted` → `showUpsell('likes')` is dispatched
- [ ] `getFunctions` call in `discoveryStore` specifies `asia-southeast1` region
- [ ] `firestore.rules` denies all client writes to `/swipes/{userId}/likes/{targetId}`
- [ ] `firestore.rules` denies all client writes to `/swipes/{userId}/passes/{targetId}`
- [ ] `firestore.rules` denies all client writes to `/users/{userId}/dailyLikes/{doc}`
- [ ] `firestore.rules` read rules for swipes remain unchanged (auth check preserved)
- [ ] `errors.dailyLimit` i18n key added to all 4 language files
- [ ] No occurrences of direct `setDoc` or `addDoc` to a `/swipes/` path remain in any client-side file
- [ ] `npx tsc --noEmit` passes with zero errors in both the root project and `functions/`
- [ ] Zero `any` usage introduced in new or modified files
- [ ] All imports in modified files use `@/` alias — no relative paths

---

## Do Not Touch

`functions/src/onSwipeCreated.ts`, `functions/src/getDiscoveryStack.ts`, `functions/src/createStripeCheckout.ts`, `functions/src/stripeWebhook.ts`, `functions/src/onNewMessage.ts`, `store/subscriptionStore.ts`, `store/authStore.ts`, `store/profileStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`, `services/firebase/config.ts`, `services/stripe.ts`, `types/user.ts`, `types/match.ts`, `types/message.ts`, `types/subscription.ts`, `constants/`, `app/navigation/`

---

## Commit

```
git commit -m "task-55: server-side daily likes enforcement via recordSwipe Cloud Function"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2B — Task 55] — YYYY-MM-DD

### Completed

- Task 55: Server-side daily likes enforcement via recordSwipe Cloud Function
- recordSwipe: 2nd gen callable (asia-southeast1), Firestore transaction, daily cap, reset logic
- discoveryStore: swipeRight(), swipeLeft(), swipeSuperLike() now call recordSwipe — no client writes to /swipes/
- firestore.rules: /swipes/ client writes denied, /users/{userId}/dailyLikes client writes denied
- i18n: errors.dailyLimit key added to all 4 language files

### Files Created / Modified

- functions/src/recordSwipe.ts: created — recordSwipe callable, transaction, cap enforcement
- functions/src/index.ts: recordSwipe export added
- store/discoveryStore.ts: swipe actions replaced with httpsCallable, resource-exhausted error handling
- firestore.rules: /swipes/ and /dailyLikes write rules denied
- i18n/en.json, my.json, zh.json, ta.json: errors.dailyLimit added

### Architecture Decisions

- [Add any non-obvious decisions made during implementation]

### Known Issues / Deferred

- console.error in discoveryStore swipe actions will be replaced by Crashlytics in Task 67
- getNextMidnightMs() uses UTC+8 approximation; per-user timezone is Phase 3

### Verification

- npx tsc --noEmit passes (root and functions/)

### Next Up

- Task 56: Photo Verification Cloud Function (verifyProfilePhoto — Cloud Vision face detection)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 56 prompt.

---

## Reasoning Level

High — this task involves a Firestore transaction, a security rules change that blocks existing client write paths, and a cross-boundary refactor (client store → Cloud Function) where a silent bug (wrong region, wrong path, wrong error code) would cause all swipes to fail silently in production.
