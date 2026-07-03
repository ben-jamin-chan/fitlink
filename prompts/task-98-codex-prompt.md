# Codex Prompt — Task 98: `deleteAccount` Cloud Function

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**
- `functions/src/index.ts` must exist and contain exports for `restoreStripeSubscription` (Task 96) and `adminAction` (Task 95) — verify both are present before writing any code.
- `functions/src/restoreStripeSubscription.ts` must exist — confirms the CF export pattern to follow.

> If either dependency is absent: output a DEPENDENCY ERROR block at the top of your response, list what is missing, and do not proceed.

```
<!-- DEPENDENCY ERROR
  Missing: [describe what is absent]
  Cannot proceed. Resolve the missing dependency before this task.
-->
```

---

## Context

This task creates a single new Cloud Function file and appends one export line to `functions/src/index.ts`. No client files, no Firestore rules, no schema changes, no i18n. The function is consumed by Task 99 (Delete Account screen) — that screen does not exist yet; do not create it here.

Existing files Codex needs to be aware of:

- `functions/src/index.ts` — append-only; do not reorder or remove any existing export. Task 96 was the last task to modify it (appended `restoreStripeSubscription`).
- `functions/src/adminAction.ts` — reference for the established Admin SDK admin claim check pattern (Task 95). Do not modify.
- `functions/src/restoreStripeSubscription.ts` — reference for the established callable CF pattern used in Phase 4C. Do not modify.
- `functions/src/utils/crypto.ts` — exists (Task 85); not needed for this task. Do not import.
- `firestore.rules` — already covers `/users/{uid}/warnings` and `/admin_audit` (Task 95). **Do not touch `firestore.rules` in this task** — all deletions go through the Admin SDK which bypasses security rules by design.
- `types/user.ts` — do not touch. The schema fields referenced here (`stripeCustomerId`, `premium`, subcollections) are already defined.

**Architectural boundary:** This function performs all data deletion exclusively via the Firebase Admin SDK. It does not use the client Firebase SDK. The Admin SDK bypasses Firestore security rules — this is intentional and correct for a deletion flow. Do not mix client SDK calls into this function.

**`functions/src/index.ts` is append-only.** The last appended export was `restoreStripeSubscription` in Task 96. Append `deleteAccount` after it. Do not reorder, remove, or rewrite any existing export line.

---

## Task 98 — `deleteAccount` Cloud Function

**Files to create:**
- `functions/src/deleteAccount.ts`

**Files to modify:**
- `functions/src/index.ts` — append one export line

---

### `functions/src/deleteAccount.ts`

This is a 2nd gen Firebase callable Cloud Function that performs PDPA-compliant full account deletion. It is called by the Delete Account screen (Task 99). It must complete a strict 9-step deletion sequence — the order is non-negotiable. Auth deletion is always last.

The function accepts no input payload from the caller — the authenticated `uid` from `request.auth.uid` is the only identity source. Never trust a `uid` supplied in the call payload.

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

// Stripe is initialised once at module scope.
// Use the same pattern as createStripeCheckout.ts and restoreStripeSubscription.ts.
// Import stripe and initialise with the secret key from process.env.STRIPE_SECRET_KEY.
// Stripe API version must match the existing CFs: '2023-10-16'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2023-10-16',
})

const db = admin.firestore()
const auth = admin.auth()
const storage = admin.storage()
const rtdb = admin.database()

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------
// Callable: authenticated users only.
// Deletes all data for the calling user across Stripe, Firestore, Storage,
// RTDB, and Firebase Auth in the exact order below.
// Order is non-negotiable — Auth deletion must be the final step.
// ---------------------------------------------------------------------------

export const deleteAccount = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    // -----------------------------------------------------------------------
    // Step 0 — Auth check (always first line in every callable CF)
    // -----------------------------------------------------------------------
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in to delete account')
    }

    const uid = request.auth.uid

    // Collect match IDs during Firestore cleanup so we can delete RTDB chat
    // nodes in step 8. Initialise here so the array is in scope for step 8.
    const matchIds: string[] = []

    // -----------------------------------------------------------------------
    // Step 1 — Stripe: cancel active subscription at period end
    // Swallow all Stripe errors — a Stripe failure must never block deletion.
    // The user's account and data must still be removed even if Stripe is
    // unreachable or the customer record does not exist.
    // -----------------------------------------------------------------------
    try {
      const userSnap = await db.doc(`users/${uid}`).get()
      const stripeCustomerId = userSnap.data()?.stripeCustomerId as string | undefined

      if (stripeCustomerId) {
        const activeSubs = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: 'active',
          limit: 1,
        })

        if (activeSubs.data.length > 0) {
          // <!-- ARCHITECT NOTE: cancel_at_period_end = true per TASKS_PHASE4.md decision.
          //   User retains access until current_period_end. No immediate cancellation.
          //   No prorate refund is issued. -->
          await stripe.subscriptions.update(activeSubs.data[0].id, {
            cancel_at_period_end: true,
          })
        }
      }
    } catch (stripeErr) {
      // <!-- ARCHITECT NOTE: Stripe failure is intentionally swallowed.
      //   Log a warning for ops visibility but do not throw — deletion continues. -->
      console.warn(`deleteAccount: Stripe cleanup failed for uid=${uid}`, stripeErr)
    }

    // -----------------------------------------------------------------------
    // Step 2 — Firestore: delete user subcollections before the parent doc
    // Firestore does NOT cascade-delete subcollections when a parent doc is
    // deleted. Subcollections must be deleted explicitly and BEFORE the parent.
    // -----------------------------------------------------------------------

    // Helper: delete all documents in a subcollection
    const deleteSubcollection = async (path: string): Promise<void> => {
      const colRef = db.collection(path)
      const snap = await colRef.listDocuments()
      if (snap.length === 0) return
      // Delete in batches of 500 (Firestore batch limit)
      const chunks: admin.firestore.DocumentReference[][] = []
      for (let i = 0; i < snap.length; i += 500) {
        chunks.push(snap.slice(i, i + 500))
      }
      await Promise.allSettled(
        chunks.map((chunk) => {
          const batch = db.batch()
          chunk.forEach((ref) => batch.delete(ref))
          return batch.commit()
        })
      )
    }

    // Delete all known subcollections under users/{uid}
    await Promise.allSettled([
      deleteSubcollection(`users/${uid}/dailyLikes`),
      deleteSubcollection(`users/${uid}/notificationPreferences`),
      deleteSubcollection(`users/${uid}/warnings`),  // added by adminAction CF (Task 95)
    ])

    // -----------------------------------------------------------------------
    // Step 3 — Firestore: delete the parent user document
    // -----------------------------------------------------------------------
    await db.doc(`users/${uid}`).delete()

    // -----------------------------------------------------------------------
    // Step 4 — Firestore: delete swipe subcollections
    // Subcollection structure: /swipes/{uid}/likes/{targetId}
    //                          /swipes/{uid}/passes/{targetId}
    // This structure is immutable per ARCHITECT.md — do not flatten.
    // -----------------------------------------------------------------------
    await Promise.allSettled([
      deleteSubcollection(`swipes/${uid}/likes`),
      deleteSubcollection(`swipes/${uid}/passes`),
    ])

    // Delete the parent swipes/{uid} doc if it exists (may be absent)
    try {
      await db.doc(`swipes/${uid}`).delete()
    } catch {
      // Swallow — parent doc may not exist; subcollections are the real data
    }

    // -----------------------------------------------------------------------
    // Step 5 — Firestore: delete match documents
    // Query matches where the user is a member of the users[] array.
    // Collect matchIds here for RTDB chat deletion in step 8.
    // -----------------------------------------------------------------------
    const matchesSnap = await db
      .collection('matches')
      .where('users', 'array-contains', uid)
      .get()

    if (!matchesSnap.empty) {
      matchesSnap.docs.forEach((doc) => matchIds.push(doc.id))

      // Delete match docs in batches of 500
      const matchChunks: admin.firestore.DocumentSnapshot[][] = []
      for (let i = 0; i < matchesSnap.docs.length; i += 500) {
        matchChunks.push(matchesSnap.docs.slice(i, i + 500))
      }
      await Promise.allSettled(
        matchChunks.map((chunk) => {
          const batch = db.batch()
          chunk.forEach((doc) => batch.delete(doc.ref))
          return batch.commit()
        })
      )
    }

    // -----------------------------------------------------------------------
    // Step 6 — Firestore: delete gym check-ins
    // /gymCheckins/{checkinId} where userId == uid
    // These are ephemeral (2-hour TTL) but must still be removed for PDPA.
    // -----------------------------------------------------------------------
    try {
      const checkinsSnap = await db
        .collection('gymCheckins')
        .where('userId', '==', uid)
        .get()

      if (!checkinsSnap.empty) {
        await Promise.allSettled(checkinsSnap.docs.map((doc) => doc.ref.delete()))
      }
    } catch (checkinErr) {
      // Swallow — best-effort; expired check-ins may already be gone
      console.warn(`deleteAccount: gymCheckins cleanup failed for uid=${uid}`, checkinErr)
    }

    // -----------------------------------------------------------------------
    // Step 7 — Cloud Storage: delete all files under users/{uid}/
    // List and delete all objects under the user's storage prefix.
    // This is best-effort — individual file deletion failures are swallowed.
    // -----------------------------------------------------------------------
    try {
      const bucket = storage.bucket()
      const [files] = await bucket.getFiles({ prefix: `users/${uid}/` })
      if (files.length > 0) {
        await Promise.allSettled(files.map((file) => file.delete()))
      }
    } catch (storageErr) {
      // Swallow — Storage cleanup is best-effort per spec
      console.warn(`deleteAccount: Storage cleanup failed for uid=${uid}`, storageErr)
    }

    // -----------------------------------------------------------------------
    // Step 8 — Firebase Realtime Database: delete chat nodes for all matches
    // Match IDs collected in step 5. RTDB path: /chats/{matchId}
    // Best-effort — individual node deletion failures are swallowed.
    // -----------------------------------------------------------------------
    if (matchIds.length > 0) {
      await Promise.allSettled(
        matchIds.map((matchId) =>
          rtdb.ref(`chats/${matchId}`).remove().catch((rtdbErr) => {
            console.warn(
              `deleteAccount: RTDB chat deletion failed for matchId=${matchId}`,
              rtdbErr
            )
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Step 9 — Firebase Auth: delete the user record
    // <!-- ARCHITECT NOTE: THIS MUST BE THE FINAL STEP.
    //   Once the Auth record is deleted the caller can no longer make
    //   authenticated requests. The CF continues running to completion as a
    //   server process, but any subsequent callable from the client would be
    //   unauthenticated. Do not move this step earlier under any circumstances. -->
    // -----------------------------------------------------------------------
    await auth.deleteUser(uid)

    return { success: true }
  }
)
```

---

### `functions/src/index.ts` — Update

Append the `deleteAccount` export after the existing `restoreStripeSubscription` export. Do not touch any other line in this file.

```typescript
// Add this line immediately after the restoreStripeSubscription export:
export { deleteAccount } from './deleteAccount'
```

Do not reorder, remove, or rewrite any existing export line. The file is append-only.

---

## Important Architecture Notes for Codex

1. **Auth deletion is step 9 — never move it earlier.** The CF runs as a server process and completes after `auth.deleteUser(uid)` regardless of the client connection state. Moving this step earlier would leave orphaned Firestore documents, Storage files, and RTDB chat nodes behind, creating a PDPA violation. The comment `<!-- ARCHITECT NOTE: -->` above step 9 must be preserved in the output.

2. **Never trust a uid from the call payload.** The only valid identity source is `request.auth.uid`. If the call payload contains a `uid` field, ignore it. This prevents a caller from deleting another user's account.

3. **Stripe errors must be swallowed, not rethrown.** If `stripe.subscriptions.list()` or `stripe.subscriptions.update()` throws, catch it, emit a `console.warn`, and continue to step 2. A Stripe outage must never leave a user's account undeletable.

4. **Subcollections must be deleted before the parent document (step 2 before step 3).** Firestore does not cascade-delete subcollections. `users/{uid}/dailyLikes`, `users/{uid}/notificationPreferences`, and `users/{uid}/warnings` must all be emptied before `db.doc('users/${uid}').delete()` is called. The `deleteSubcollection` helper handles batching for collections that may have more than 500 documents.

5. **Storage and RTDB cleanup are best-effort.** Wrap both in try/catch and swallow errors. A missing Storage bucket or an RTDB node that was already cleaned up by another process must not abort the deletion flow.

6. **`functions/src/index.ts` is append-only.** The existing export order must not change. Append `export { deleteAccount } from './deleteAccount'` after the `restoreStripeSubscription` line. Verify the file compiles cleanly after the append.

7. **No Firestore rules change in this task.** All writes are via the Admin SDK, which bypasses security rules. `firestore.rules` must not be modified. If Codex finds itself about to edit `firestore.rules`, that is architectural drift — stop and report it.

8. **Stripe API version must match existing CFs: `'2023-10-16'`.** Do not use a different API version string. The Stripe SDK is already a dependency of `functions/` — do not add it again.

9. **`console.warn` is permitted inside Cloud Functions for operational logging.** The CONVENTIONS.md prohibition on `console.log`/`console.warn` applies to client files only. Server-side warning logs for swallowed errors are correct and must be preserved.

---

## Rollback Protocol

If `npm --prefix functions run build` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Making an assumption about a prior task's output that cannot be verified, OR
- Changing the deletion order described in the 9-step sequence

**Then:**
1. Do not commit any partial changes
2. Revert `functions/src/deleteAccount.ts` and `functions/src/index.ts` to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing:
   - Which file caused the conflict
   - What the error was
   - What information or decision is needed to proceed
4. Stop. Do not attempt a workaround. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npm --prefix functions run build` — zero errors
- [ ] `npx tsc --noEmit` — zero errors in root (root tsconfig must not be broken by functions changes)
- [ ] Zero `any` types introduced — search diff for `: any` and `as any`
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] No `console.log` in the new CF file — only `console.warn` for swallowed errors
- [ ] No relative imports in the new file — `import * as admin from 'firebase-admin'` etc. are correct (not `@/` aliases; CF files use Node module resolution, not the Expo path alias)

**Firebase / Security**
- [ ] `if (!request.auth)` is the first executable line in `deleteAccount`
- [ ] `{ region: 'asia-southeast1' }` is present in the `onCall` options
- [ ] `uid` is sourced exclusively from `request.auth.uid` — no payload uid accepted
- [ ] Stripe errors are caught and swallowed — not rethrown
- [ ] `auth.deleteUser(uid)` is the last await in the function body
- [ ] `firestore.rules` was not modified

**Architecture**
- [ ] `functions/src/index.ts` has one new line appended — no existing lines reordered or removed
- [ ] Subcollections deleted before parent user doc (step 2 before step 3)
- [ ] Match IDs collected before match docs deleted (needed for step 8 RTDB cleanup)
- [ ] Storage deletion wrapped in try/catch (best-effort)
- [ ] RTDB deletion wrapped in per-node `.catch()` (best-effort)
- [ ] `<!-- ARCHITECT NOTE: -->` comment above step 9 is present in the output

**Platform**
- [ ] No React Native or Expo imports in any CF file — this is a Node.js server function
- [ ] No `@/` path aliases in `functions/src/` — CF files use bare Node module imports

---

## Acceptance Criteria

- [ ] `functions/src/deleteAccount.ts` created and exports `deleteAccount` as a named export
- [ ] `deleteAccount` is a 2nd gen `onCall` CF with `{ region: 'asia-southeast1' }`
- [ ] First executable line is `if (!request.auth) throw new HttpsError('unauthenticated', ...)`
- [ ] `uid` is taken from `request.auth.uid` only — no payload field accepted
- [ ] Stripe block (step 1) is wrapped in try/catch; errors are `console.warn`-ed and swallowed
- [ ] `deleteSubcollection` helper handles collections larger than 500 documents via chunked batches
- [ ] Subcollections (`dailyLikes`, `notificationPreferences`, `warnings`) deleted before parent user doc
- [ ] Match IDs collected from the `matches` query and stored for RTDB cleanup in step 8
- [ ] Storage cleanup (`users/${uid}/`) wrapped in try/catch (best-effort)
- [ ] RTDB cleanup deletes `/chats/{matchId}` for every collected match ID (best-effort, per-node catch)
- [ ] `auth.deleteUser(uid)` is the final await in the function — step 9, nothing after it
- [ ] Function returns `{ success: true }` after Auth deletion
- [ ] `functions/src/index.ts` has exactly one new line appended: `export { deleteAccount } from './deleteAccount'`
- [ ] No other file in `functions/src/index.ts` was reordered or removed
- [ ] `npm --prefix functions run build` — zero errors
- [ ] `npx tsc --noEmit` — zero errors

---

## Do Not Touch

`firestore.rules` (Admin SDK bypasses rules — no rules change needed for this task), `firestore.indexes.json`, `functions/src/index.ts` existing exports (append only — do not reorder or remove), `types/user.ts`, `constants/`, `i18n/`, `store/`, `app/`, `services/firebase/config.ts`, `functions/src/utils/crypto.ts`, `functions/src/adminAction.ts`, `functions/src/restoreStripeSubscription.ts`

---

## Commit

```
git commit -m "task-98: deleteAccount callable CF — PDPA-compliant 9-step deletion across Stripe, Firestore, Storage, RTDB, Auth"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4D — Task 98] — YYYY-MM-DD

### Completed

- Task 98: deleteAccount Cloud Function
- [One line per major behaviour delivered — e.g. Stripe cancel-at-period-end, subcollection cleanup, Auth deletion last]

### Files Created

- functions/src/deleteAccount.ts: [brief description — callable CF, 9-step deletion sequence, returns { success: true }]

### Files Modified

- functions/src/index.ts: appended deleteAccount export

### Architecture Decisions

- [Note the cancel_at_period_end decision and why — deferred cancellation, no prorate refund]
- [Note the Auth-last order and why it is non-negotiable]
- [Note any deviation from the scaffold above and the reason]

### Conflict Risks Introduced

- functions/src/index.ts modified — Task 99 and all future CF tasks must append without reordering
- None beyond the above (no rules, no schema, no client files touched)

### Known Issues / Deferred

- [Anything intentionally left incomplete, e.g. gymCheckins or matches cleanup edge cases]

### Next Up

- Task 99: Delete Account screen (depends on this CF)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 99 prompt.
Attach specific modified files only if: the functions build failed, tsc failed, or Codex produced output that deviates from the scaffold above.

---

## Reasoning Level

Extra High

> At Extra High, Codex must:
> - Complete the Self-Check above in full before outputting "task complete"
> - Add `<!-- ARCHITECT NOTE: -->` comments on every non-obvious decision (the deletion order, Stripe swallow, Auth-last)
> - Flag any assumption made that was not explicitly stated in this prompt
