# CODEX PROMPT — Task 24
# Cloud Function: onSwipeCreated — Mutual Like Detection & Match Creation

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3.2 complete. Task 23 (getDiscoveryStack) is done. Relevant existing files:

- `functions/src/index.ts` — admin SDK init guard, exports `onUserCreated` and `getDiscoveryStack`; add `onSwipeCreated` export here
- `functions/src/onUserCreated.ts` — 2nd gen Firestore trigger pattern (`onDocumentCreated`) — follow the same style
- `functions/src/getDiscoveryStack.ts` — 2nd gen callable, region `asia-southeast1`, TypeScript strict, full example to mirror
- `functions/package.json` — Node.js 18, `firebase-admin ^12`, `firebase-functions ^4`, TypeScript strict — do not modify
- `firestore.rules` — `/matches/{matchId}` write is deny for client; Cloud Function uses admin SDK which bypasses rules — this is correct and intentional
- `types/match.ts` — `Match` interface exists in client types but is **not imported into functions** — define local types in the function file as done in Task 23

**Swipe schema (canonical — do not change):**
```
/swipes/{userId}/likes/{targetId}     ← onSwipeCreated triggers here
/swipes/{userId}/passes/{targetId}
```

**Match document path:**
```
/matches/{matchId}    where matchId = [userId, targetId].sort().join('_')
```

**CRITICAL — Firestore trigger API (2nd gen):** The project uses `firebase-functions/v2`. The correct import and event type is:

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
// event.params.userId, event.params.targetId  (from wildcards)
// event.data  → DocumentSnapshot (the newly created swipe doc)
```

**Do NOT use v1 API:**
```typescript
// ❌ WRONG — v1, not used in this project
import * as functions from 'firebase-functions'
functions.firestore.document(...).onCreate((snap, context) => { ... })
```

---

## Task 24 — Cloud Function: onSwipeCreated

**Files to create:**
- `functions/src/onSwipeCreated.ts`

**Files to modify:**
- `functions/src/index.ts` — add export for `onSwipeCreated`

---

### `functions/src/onSwipeCreated.ts`

Full implementation below. Read every comment — they explain invariants that must not be violated.

```typescript
import * as admin from 'firebase-admin'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v2'

// ---------------------------------------------------------------------------
// Local types — do NOT import from client types/
// ---------------------------------------------------------------------------

interface SwipeDoc {
  swiperId: string
  targetId: string
  isSuperLike: boolean
  createdAt: admin.firestore.Timestamp
}

interface MatchDoc {
  users: [string, string]
  createdAt: admin.firestore.FieldValue
  lastMessage: null
  lastMessageAt: null
  [key: string]: unknown   // dynamic unread count keys — e.g. uid1_unread, uid2_unread
}

// ---------------------------------------------------------------------------
// Helper — build the canonical matchId
// Always sort the two user IDs alphabetically before joining.
// This ensures the same matchId is produced regardless of who swiped first.
// ---------------------------------------------------------------------------

const buildMatchId = (uidA: string, uidB: string): string =>
  [uidA, uidB].sort().join('_')

// ---------------------------------------------------------------------------
// Helper — send push notifications to both users
// Stubbed in Task 24; full implementation comes in Task 33 (onNewMessage).
// Add a TODO comment so the stub is easy to find and replace.
// ---------------------------------------------------------------------------

const sendMatchNotifications = async (
  userId: string,
  targetId: string,
  isSuperLike: boolean
): Promise<void> => {
  // TODO Task 33: fetch expoPushToken for both users and call Expo Push API
  // For now, log intent only — no crash risk if tokens are missing
  logger.info('sendMatchNotifications stub', { userId, targetId, isSuperLike })
}

// ---------------------------------------------------------------------------
// Main trigger
//
// Path:  /swipes/{userId}/likes/{targetId}
// Fires: on document CREATE only (a like was just written)
//
// Logic:
//   1. Parse userId and targetId from path wildcards
//   2. Read the new swipe doc to get isSuperLike
//   3. Check if the reverse like already exists (/swipes/{targetId}/likes/{userId})
//   4. If mutual like detected:
//      a. Build matchId = sort([userId, targetId]).join('_')
//      b. Check the match doc doesn't already exist (idempotency guard)
//      c. Write /matches/{matchId} atomically via batch
//      d. Increment stats.matches on both user docs (batch)
//      e. Call sendMatchNotifications (stub)
//   5. If NOT mutual: do nothing, return early
// ---------------------------------------------------------------------------

export const onSwipeCreated = onDocumentCreated(
  {
    document: 'swipes/{userId}/likes/{targetId}',
    region: 'asia-southeast1',
  },
  async (event) => {
    const { userId, targetId } = event.params as { userId: string; targetId: string }

    // Defensive: snapshot should always exist on onCreate, but guard anyway
    if (event.data === undefined) {
      logger.error('onSwipeCreated: event.data is undefined', { userId, targetId })
      return
    }

    const swipeData = event.data.data() as SwipeDoc | undefined
    if (swipeData === undefined) {
      logger.error('onSwipeCreated: swipe doc data is undefined', { userId, targetId })
      return
    }

    const { isSuperLike } = swipeData

    const db = admin.firestore()

    // -----------------------------------------------------------------------
    // Step 3 — Check for mutual like
    // The reverse path is /swipes/{targetId}/likes/{userId}
    // -----------------------------------------------------------------------

    const reverseLikeRef = db.doc(`swipes/${targetId}/likes/${userId}`)
    const reverseLikeSnap = await reverseLikeRef.get()

    if (!reverseLikeSnap.exists) {
      // No mutual like — nothing to do
      logger.info('onSwipeCreated: no mutual like, no match created', { userId, targetId })
      return
    }

    // -----------------------------------------------------------------------
    // Step 4a — Mutual like confirmed: build matchId
    // -----------------------------------------------------------------------

    const matchId = buildMatchId(userId, targetId)
    const matchRef = db.doc(`matches/${matchId}`)

    // -----------------------------------------------------------------------
    // Step 4b — Idempotency guard
    // If this function fires twice (Cloud Functions at-least-once delivery),
    // the match doc may already exist. Skip creation silently.
    // -----------------------------------------------------------------------

    const existingMatch = await matchRef.get()
    if (existingMatch.exists) {
      logger.warn('onSwipeCreated: match doc already exists, skipping', { matchId })
      return
    }

    // -----------------------------------------------------------------------
    // Step 4c–4d — Write match doc + increment stats atomically via batch
    //
    // Match doc shape (from ARCHITECT.md):
    //   users: [uid1, uid2]  (sorted alphabetically — same order as matchId)
    //   createdAt: serverTimestamp()
    //   lastMessage: null
    //   lastMessageAt: null
    //   {userId}_unread: 0
    //   {targetId}_unread: 0
    // -----------------------------------------------------------------------

    const [sortedUidA, sortedUidB] = [userId, targetId].sort() as [string, string]

    const matchDoc: MatchDoc = {
      users: [sortedUidA, sortedUidB],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessage: null,
      lastMessageAt: null,
      [`${userId}_unread`]: 0,
      [`${targetId}_unread`]: 0,
    }

    const batch = db.batch()

    // Write match document
    batch.set(matchRef, matchDoc)

    // Increment stats.matches for the swiper (userId)
    const swiperRef = db.doc(`users/${userId}`)
    batch.update(swiperRef, {
      'stats.matches': admin.firestore.FieldValue.increment(1),
    })

    // Increment stats.matches for the target (targetId)
    const targetRef = db.doc(`users/${targetId}`)
    batch.update(targetRef, {
      'stats.matches': admin.firestore.FieldValue.increment(1),
    })

    await batch.commit()

    logger.info('onSwipeCreated: match created', { matchId, userId, targetId, isSuperLike })

    // -----------------------------------------------------------------------
    // Step 4e — Push notifications (stub — Task 33 completes this)
    // -----------------------------------------------------------------------

    await sendMatchNotifications(userId, targetId, isSuperLike)
  }
)
```

---

### `functions/src/index.ts` — Update

Add the export alongside the existing ones. Do not touch any other line.

```typescript
// Add this import:
export { onSwipeCreated } from './onSwipeCreated'

// Existing exports remain unchanged:
// export { onUserCreated } from './onUserCreated'
// export { getDiscoveryStack } from './getDiscoveryStack'
```

The full file after update should look like:

```typescript
import * as admin from 'firebase-admin'

// Guard against duplicate admin initialisation in emulator hot-reload
if (admin.apps.length === 0) {
  admin.initializeApp()
}

export { onUserCreated } from './onUserCreated'
export { getDiscoveryStack } from './getDiscoveryStack'
export { onSwipeCreated } from './onSwipeCreated'
```

---

## Architecture Notes for Codex

### 1. Subcollection path is immutable
The trigger path `swipes/{userId}/likes/{targetId}` is load-bearing for the security model and the `getDiscoveryStack` exclusion logic. Do **not** change it, flatten it, or add an alias.

### 2. Batch write is required — no individual `set()` + `update()` calls
All three writes (match doc, swiper stats, target stats) must go into a single `batch.commit()`. This guarantees atomicity: a partial failure cannot leave a match document without stat increments.

### 3. Idempotency guard is non-negotiable
Cloud Functions guarantee at-least-once delivery. Without the `existingMatch.exists` guard, a duplicate trigger would create duplicate stat increments. The guard is a correctness requirement, not an optimisation.

### 4. matchId construction is canonical
`[userId, targetId].sort().join('_')` must be used consistently here, in `discoveryStore.ts` (Task 25), and in `matchStore.ts` (Task 29). If Codex finds any other matchId construction in those files, flag it as a bug.

### 5. serverTimestamp() only
`createdAt` on the match doc must use `admin.firestore.FieldValue.serverTimestamp()` — never `new Date()` or `Timestamp.now()`. CONVENTIONS.md §10 is explicit about this.

### 6. sendMatchNotifications is a stub — do not expand it
Task 33 (`onNewMessage`) implements the full push notification flow using Expo Push API. The stub here intentionally does nothing except log. Do not try to fetch `expoPushToken` or call any external service in this task.

### 7. TypeScript strict — local types only in functions/
The `functions/` package has its own `tsconfig.json` with `strict: true`. Do not import from `@/types/` — those paths resolve against the client `tsconfig.json` and will cause build failures in the functions package. Define all interfaces locally in the function file (same pattern as Tasks 22 and 23).

### 8. The v1 API (`context.params`) must not appear anywhere
2nd gen functions expose params via `event.params`. Any usage of `context.params`, `context.auth`, or `functions.https.onCall((data, context) => ...)` is the v1 API and will break the build. CONVENTIONS.md §10 has this exact warning.

---

## Acceptance Criteria

- [ ] `functions/src/onSwipeCreated.ts` created with the trigger on `swipes/{userId}/likes/{targetId}`
- [ ] Function uses `onDocumentCreated` from `firebase-functions/v2/firestore` (NOT v1)
- [ ] Function is exported from `functions/src/index.ts`
- [ ] Region is `asia-southeast1`
- [ ] Mutual like check reads `/swipes/{targetId}/likes/{userId}` from admin Firestore
- [ ] If no mutual like: returns early, no writes
- [ ] `matchId` built as `[userId, targetId].sort().join('_')`
- [ ] Idempotency guard: if match doc already exists, logs warning and returns without writing
- [ ] Match document written with correct shape: `users`, `createdAt` (serverTimestamp), `lastMessage: null`, `lastMessageAt: null`, `{userId}_unread: 0`, `{targetId}_unread: 0`
- [ ] `stats.matches` incremented on both user docs in the same batch as match creation
- [ ] All three writes (match + 2 stat increments) committed in a single `batch.commit()`
- [ ] `sendMatchNotifications` called after batch commit but is a stub — logs only, no external calls
- [ ] No `new Date()` or `Timestamp.now()` — only `admin.firestore.FieldValue.serverTimestamp()`
- [ ] No imports from `@/types/` — all types defined locally
- [ ] `tsc --noEmit` inside `functions/` passes with zero errors
- [ ] Zero `any` types
- [ ] Emulator test: create `/swipes/userA/likes/userB` and `/swipes/userB/likes/userA` → `/matches/userA_userB` document appears

## Do Not Touch
`functions/src/onUserCreated.ts`, `functions/src/getDiscoveryStack.ts`, `functions/package.json`, `functions/tsconfig.json`, `firestore.rules`, `firestore.indexes.json`, any client-side file under `app/`, `store/`, `services/`, `components/`, `types/`, `constants/`, `hooks/`, `utils/`

## Commit
`git commit -m "task-24: onSwipeCreated cloud function, mutual like detection, match creation"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3.3] — YYYY-MM-DD
### Completed
- Task 24: Cloud Function onSwipeCreated implemented (2nd gen Firestore trigger, asia-southeast1)
- Mutual like detection: reads reverse swipe doc, creates match only if both sides exist
- matchId = [userId, targetId].sort().join('_') — canonical, consistent with future matchStore usage
- Idempotency guard prevents duplicate match creation on at-least-once redelivery
- Batch write atomically creates match doc + increments stats.matches on both user docs
- sendMatchNotifications stubbed with logger.info — full push implementation deferred to Task 33

### Files Created / Modified
- functions/src/onSwipeCreated.ts: onDocumentCreated trigger, mutual like check, idempotency guard, batch write, notification stub
- functions/src/index.ts: onSwipeCreated export added

### Known Issues / Deferred
- Push notifications to both matched users not yet sent — stub only; Task 33 (onNewMessage) will add Expo Push API calls
- No Firestore transaction used (batch is sufficient here because the idempotency guard handles the race condition window; a full transaction would be more robust for very high concurrency — revisit in Phase 2 if needed)

### Next Up
- Task 25: Discovery Zustand store (discoveryStore.ts — fetchStack callable, swipeRight, swipeLeft, swipeSuperLike, daily limit check, auto-refetch when stack < 3)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 25 prompt.

---

## Reasoning Level
Medium
