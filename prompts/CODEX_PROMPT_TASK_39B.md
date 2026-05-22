# CODEX PROMPT — Task 39B
# Firestore Rules Remediation — Fix Client Writes Blocked by Task 39

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 39 deployed production Firestore security rules that correctly block all client-side writes to `/matches/{matchId}`. This exposed three client code paths that directly write to that collection and will now throw `FirebaseError: Missing or insufficient permissions` at runtime:

| File | Line(s) | Violation |
|---|---|---|
| `store/matchStore.ts` | ~120 | `deleteMatch(matchId)` calls `deleteDoc(doc(db, 'matches', matchId))` |
| `services/firebase/firestore.ts` | ~237 | `deleteMatch()` — the underlying `deleteDoc` helper |
| `services/firebase/realtime.ts` | ~119, ~148, ~171 | `sendMessage()` / `markAsRead()` update `/matches/{matchId}` directly via `updateDoc` |

This is an **architectural invariant violation**, not a rules bug. The rules are correct. The client code must be updated to respect them.

### Decision framework — fix locally vs Cloud Function

There are two possible approaches. The correct one for each path is:

| Path | Correct fix |
|---|---|
| **Unmatch** (`deleteDoc` on `/matches`) | Cloud Function callable (`unmatchUser`). Unmatch is a destructive, bilateral action that also needs to: add to blocked list, clean up RTDB chat, decrement `stats.matches` on both users. Client should never own this. |
| **Chat metadata updates** (`lastMessage`, `lastMessageAt`, `{userId}_unread`) on `/matches` | Relax the rules **intentionally** for these specific fields only — these are not security-sensitive. A participant updating last-message preview and their own unread counter is legitimate client behaviour. Adding a Cloud Function call on every message send would add unacceptable latency to a real-time chat feature. |

This task implements **both fixes**.

---

## Task 39B — Two-Part Remediation

### Part A — Cloud Function: `unmatchUser` (callable)

**File to create:** `functions/src/unmatchUser.ts`

**File to modify:** `functions/src/index.ts` (add export)

```typescript
// functions/src/unmatchUser.ts
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'

/**
 * unmatchUser — callable Cloud Function
 *
 * Performs a safe, bilateral unmatch:
 *   1. Validates caller is a participant in the match
 *   2. Deletes the Firestore match document
 *   3. Deletes the RTDB chat data
 *   4. Adds each user to the other's blocked subcollection
 *   5. Decrements stats.matches on both user documents
 *
 * Called from matchStore.unmatch(matchId).
 */
export const unmatchUser = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<{ matchId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }

    const callerId = request.auth.uid
    const { matchId } = request.data

    if (!matchId || typeof matchId !== 'string') {
      throw new HttpsError('invalid-argument', 'matchId is required')
    }

    const db = getFirestore()
    const rtdb = getDatabase()

    // 1. Fetch and validate the match document
    const matchRef = db.doc(`matches/${matchId}`)
    const matchSnap = await matchRef.get()

    if (!matchSnap.exists) {
      throw new HttpsError('not-found', 'Match not found')
    }

    const matchData = matchSnap.data() as { users: string[] }

    if (!matchData.users.includes(callerId)) {
      throw new HttpsError('permission-denied', 'You are not a participant in this match')
    }

    const otherUserId = matchData.users.find((uid) => uid !== callerId)

    if (!otherUserId) {
      throw new HttpsError('internal', 'Could not determine other participant')
    }

    // 2–5. Run all cleanup operations in parallel (best-effort — do not fail if RTDB delete lags)
    await Promise.all([
      // 2. Delete Firestore match document
      matchRef.delete(),

      // 3. Delete RTDB chat data
      rtdb.ref(`chats/${matchId}`).remove().catch((err: unknown) => {
        // Log but do not throw — RTDB cleanup failure is not fatal
        console.error(`unmatchUser: RTDB cleanup failed for ${matchId}`, err)
      }),

      // 4. Add to blocked subcollections (bilateral)
      db.doc(`blocked/${callerId}/users/${otherUserId}`).set({
        blockedAt: FieldValue.serverTimestamp(),
      }),
      db.doc(`blocked/${otherUserId}/users/${callerId}`).set({
        blockedAt: FieldValue.serverTimestamp(),
      }),

      // 5. Decrement stats.matches on both users
      db.doc(`users/${callerId}`).update({
        'stats.matches': FieldValue.increment(-1),
      }),
      db.doc(`users/${otherUserId}`).update({
        'stats.matches': FieldValue.increment(-1),
      }),
    ])

    return { success: true }
  }
)
```

**`functions/src/index.ts`** — add export:
```typescript
export { unmatchUser } from './unmatchUser'
```

Do not touch any other existing export in `index.ts`.

---

### Part B — Relax `/matches` rules for participant chat metadata updates

**File to modify:** `firestore.rules`

The current `/matches/{matchId}` block reads:
```
allow create, update: if false; // Cloud Function only
allow delete:         if false; // Cloud Function only
```

Replace **only the `update` rule** with a participant-scoped rule that allows writing the specific chat metadata fields (`lastMessage`, `lastMessageAt`, `{uid}_unread`) — and nothing else:

```javascript
// ─── /matches/{matchId} ──────────────────────────────────────────────────────
match /matches/{matchId} {
  allow read:   if isAuthenticated() && isMatchParticipant(matchId);
  allow create: if false; // Cloud Function only (onSwipeCreated)
  allow delete: if false; // Cloud Function only (unmatchUser)

  // Participants may update only chat metadata fields.
  // Structural fields (users, createdAt) and the other user's unread count
  // cannot be modified from the client — only the requester's own unread counter
  // and the shared lastMessage fields are permitted.
  allow update: if isAuthenticated()
                && isMatchParticipant(matchId)
                && request.resource.data.diff(resource.data).affectedKeys()
                     .hasOnly([
                       'lastMessage',
                       'lastMessageAt',
                       (request.auth.uid + '_unread'),
                     ]);

  match /messages/{messageId} {
    allow read:   if isAuthenticated() && isMatchParticipant(matchId);
    allow create: if isAuthenticated()
                  && isMatchParticipant(matchId)
                  && request.auth.uid == request.resource.data.senderId;
    allow update: if false;
    allow delete: if false;
  }
}
```

**Important:** The `(request.auth.uid + '_unread')` expression is a dynamic key computed from the authenticated user's UID. This correctly restricts each user to only zeroing their own unread counter — they cannot modify the other participant's unread field.

---

### Part C — Update `matchStore.unmatch()` to call the Cloud Function

**File to modify:** `store/matchStore.ts`

Remove the direct `deleteMatch(matchId)` call. Replace with a Firebase callable function call:

```typescript
// Remove this import (if no longer used elsewhere in the store):
// import { deleteMatch } from '@/services/firebase/firestore'

// Add this import:
import { getFunctions, httpsCallable } from 'firebase/functions'

// Replace unmatch action:
unmatch: async (matchId: string): Promise<void> => {
  set({ isLoading: true })
  try {
    const functions = getFunctions()
    const unmatchUser = httpsCallable<{ matchId: string }, { success: boolean }>(
      functions,
      'unmatchUser'
    )
    await unmatchUser({ matchId })

    // Remove from local state immediately (optimistic — Cloud Function already deleted)
    set((state) => ({
      matches: state.matches.filter((m) => m.id !== matchId),
      isLoading: false,
    }))
  } catch (error) {
    set({ isLoading: false, error: mapFirebaseError(error) })
  }
},
```

---

### Part D — Remove `deleteMatch` from `services/firebase/firestore.ts`

**File to modify:** `services/firebase/firestore.ts`

Remove the `deleteMatch(matchId: string)` function entirely (~line 237). It is no longer used — the Cloud Function owns this operation.

If any other caller in the codebase imports `deleteMatch`, update those callers to use the `unmatchUser` callable instead. Grep for all usages before deleting.

---

### Part E — Verify `realtime.ts` chat metadata writes are now rule-compliant

**File to verify (read only — do not change unless broken):** `services/firebase/realtime.ts`

Open `services/firebase/realtime.ts` and confirm that the `updateDoc` calls on `/matches/{matchId}` only ever write the fields: `lastMessage`, `lastMessageAt`, and `{userId}_unread`. 

If any call writes additional fields (e.g. `users`, `createdAt`), narrow those writes to the allowed fields only.

If the calls already write only those fields, no change is needed — the relaxed `update` rule in Part B now permits them.

---

## Architecture Notes for Codex

### Why not a Cloud Function for every match metadata update?

Routing `lastMessage` and unread-count updates through a Cloud Function on every message send would add a cold-start latency hit to real-time chat — unacceptable for a feature where sub-second delivery is a requirement (NFR-7). These fields are low-sensitivity metadata (a message preview string and a counter). The risk of a client setting a wrong value is minor compared to the UX cost of the indirection. The `hasOnly([...])` rule prevents any structural damage.

### Why `(request.auth.uid + '_unread')` instead of a wildcard

A wildcard like `{uid}_unread` is not valid in Firebase Security Rules `hasOnly`. The dynamic key `(request.auth.uid + '_unread')` is a supported string concatenation in rules v2 — it produces e.g. `"abc123_unread"` and ensures each user can only reset their own counter, not the other participant's.

### `markAsRead` in `matchStore.ts`

`markAsRead(matchId)` currently calls `updateDoc` on `/matches/{matchId}` with `{ [userId + '_unread']: 0 }`. With the Part B rule in place, this is now allowed because `{currentUserId}_unread` is in the `hasOnly` list. No change needed to `markAsRead`.

### RTDB cleanup in `unmatchUser`

RTDB deletion is wrapped in a `.catch()` inside `Promise.all` so that a transient RTDB failure doesn't roll back the Firestore delete. The match is gone from Firestore either way — the RTDB chat data will be orphaned at worst and can be cleaned up by a scheduled function in Phase 2. Firestore is the source of truth for whether a match exists.

### `blocked` subcollection

The `unmatchUser` function writes to `/blocked/{userId}/users/{blockedUserId}`. This collection is not yet defined in `firestore.rules` — add a rule for it now:

```javascript
// ─── /blocked/{userId}/users/{blockedUserId} ─────────────────────────────────
// Written exclusively by the unmatchUser Cloud Function (Admin SDK bypasses rules).
// No client reads or writes permitted.
match /blocked/{userId}/users/{blockedUserId} {
  allow read, write: if false;
}
```

Add this block to `firestore.rules` inside the top-level `match /databases/{database}/documents` block, alongside the other collection rules.

---

## Acceptance Criteria

- [ ] `functions/src/unmatchUser.ts` created and exported from `functions/src/index.ts`
- [ ] `unmatchUser` validates caller is a match participant before deleting
- [ ] `unmatchUser` deletes: match doc, RTDB chat, adds bilateral blocked entries, decrements stats on both users
- [ ] RTDB delete failure is caught and logged but does not throw — function still returns success
- [ ] `store/matchStore.ts` `unmatch()` calls `httpsCallable('unmatchUser')` — no `deleteDoc` anywhere in the store
- [ ] `deleteMatch` function removed from `services/firebase/firestore.ts`
- [ ] `firestore.rules` `/matches/{matchId}` `update` rule relaxed to `hasOnly(['lastMessage', 'lastMessageAt', (request.auth.uid + '_unread')])`
- [ ] `firestore.rules` `/matches/{matchId}` `delete` still blocked for clients (`if false`)
- [ ] `firestore.rules` `/blocked/{userId}/users/{blockedUserId}` rule added (deny all client reads/writes)
- [ ] `realtime.ts` `updateDoc` calls on `/matches/{matchId}` confirmed to write only permitted fields
- [ ] `firebase deploy --only firestore:rules` passes without syntax errors
- [ ] `tsc --noEmit` passes with zero errors across both `functions/` and the app root

## Do Not Touch

`app/`, `components/`, `store/` (except `matchStore.ts`), `services/` (except `firestore.ts` and verifying `realtime.ts`), `types/`, `constants/`, `hooks/`, `i18n/`, `App.tsx`, `babel.config.js`, `tsconfig.json`, `package.json`

Only touch: `functions/src/unmatchUser.ts` (create), `functions/src/index.ts` (add export), `store/matchStore.ts` (unmatch action), `services/firebase/firestore.ts` (remove deleteMatch), `firestore.rules` (two rule changes: update relaxation + blocked collection)

## Commit

```
git commit -m "task-39b: fix client writes blocked by rules — unmatchUser cloud fn, relax match update rule"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1F — Task 39B] — YYYY-MM-DD

### Completed

- Task 39B: Remediated all client writes to /matches/{matchId} exposed by Task 39 rules
- unmatchUser Cloud Function created — bilateral unmatch, RTDB cleanup, blocked entries, stats decrement
- matchStore.unmatch() now calls httpsCallable('unmatchUser') — no direct deleteDoc
- deleteMatch() removed from services/firebase/firestore.ts
- firestore.rules /matches update rule relaxed to allow participant chat metadata writes only (lastMessage, lastMessageAt, {uid}_unread)
- firestore.rules /blocked collection added (deny all client access)

### Files Created / Modified

- functions/src/unmatchUser.ts: new callable Cloud Function
- functions/src/index.ts: unmatchUser export added
- store/matchStore.ts: unmatch() rewritten to use httpsCallable
- services/firebase/firestore.ts: deleteMatch() removed
- firestore.rules: /matches update rule scoped to hasOnly([...]), /blocked rule added

### Architecture Decisions

- Chat metadata updates (lastMessage, lastMessageAt, own unread) kept as client writes to avoid Cloud Function latency on every message send
- Dynamic key (request.auth.uid + '_unread') used in hasOnly — prevents cross-user unread tampering
- RTDB cleanup in unmatchUser is best-effort (catch+log) — Firestore match doc is source of truth
- /blocked written exclusively by Admin SDK; client read/write denied at rules level

### Known Issues / Deferred

- Orphaned RTDB chat data if unmatchUser RTDB delete fails — scheduled cleanup Cloud Function deferred to Phase 2
- Match message subcollection cleanup on unmatch deferred to Phase 2 onUserDeleted / scheduled function
- RTDB rules still open from prior work — Phase 2

### Next Up

- Task 40: Firestore indexes (firestore.indexes.json)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 40 prompt.

---

## Reasoning Level
Medium — two files of moderate complexity (Cloud Function + rules edit). The hardest part is the dynamic key in `hasOnly` — Codex must not substitute a wildcard or a hardcoded string.