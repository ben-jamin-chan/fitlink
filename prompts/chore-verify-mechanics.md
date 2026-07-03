# Chore — Swipe/Match Mechanics Verification Script

@CONVENTIONS.md @ARCHITECT.md

---

## Context

This is a scripted, automated check that swipe → mutual like → match → chat mechanics
work end-to-end, using two seed accounts against each other. **It must never run against
a real tester's account.** It exists so you get a pass/fail confirmation before beta
testers start swiping, without needing a human to manually perform a mutual like and
visually confirm a match appeared.

**Dependency: the Beta Seed Profile Generator script must have already run.** This
script needs at least 2 existing seed accounts (tagged `isSeedAccount: true`) to operate
against — it does not create its own accounts.

This script drives the REAL `recordSwipe` Cloud Function (not a direct Firestore write),
because the goal is confirming the actual production code path — `recordSwipe` →
`onSwipeCreated` trigger → `/matches` document creation — works, not confirming that a
manually-constructed Firestore document looks right.

---

## Pre-Task Dependency Check

**Required outputs from prior work — verify present before writing any code:**

- At least 2 documents in `/users` with `isSeedAccount: true` must exist — verify by
  querying, not by assuming the seed script ran successfully
- `recordSwipe` Cloud Function must be deployed and callable — verify it's exported from
  `functions/src/index.ts`
- Firebase Admin SDK must support generating a custom auth token for a given uid
  (`admin.auth().createCustomToken()`) so the script can invoke `recordSwipe` as if it
  were an authenticated seed user, since `recordSwipe` requires `request.auth`

> If fewer than 2 seed accounts exist: STOP and output a DEPENDENCY ERROR block
> instructing the user to run `scripts/seedBetaProfiles.ts` first.

---

## Task — Mechanics Verification Script

**Files to create:**
- `scripts/verifySwipeMechanics.ts` (new — operational script, not deployed)

**Files to modify:** None.

---

### `scripts/verifySwipeMechanics.ts`

> Picks 2 seed accounts, has each swipe-like the other via the real `recordSwipe`
> callable, confirms a `/matches` document was created by `onSwipeCreated`, confirms a
> test message can be sent and read back, then cleans up the match and swipe docs it
> created so it doesn't leave clutter behind. Does NOT delete the seed profiles
> themselves — only the match/swipe artifacts this specific run produced.

```typescript
// scripts/verifySwipeMechanics.ts
//
// One-off operational script — NOT a Cloud Function, NOT deployed.
// Run locally with: npx ts-node scripts/verifySwipeMechanics.ts
//
// Verifies swipe -> match -> chat mechanics using two seed accounts (isSeedAccount:
// true) against each other. Never touches a real tester's account. Cleans up after
// itself — deletes the swipe docs and match doc it creates, but leaves the seed
// profiles themselves untouched.

import * as admin from 'firebase-admin'
import { getFunctions, httpsCallable } from 'firebase-admin/functions'

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const auth = admin.auth()
const rtdb = admin.database()

interface RecordSwipeResult {
  remainingLikes: number
}

async function getTwoSeedAccountUids(): Promise<[string, string]> {
  const snapshot = await db
    .collection('users')
    .where('isSeedAccount', '==', true)
    .limit(2)
    .get()

  if (snapshot.size < 2) {
    throw new Error(
      `Only found ${snapshot.size} seed account(s). Need at least 2. ` +
      `Run scripts/seedBetaProfiles.ts first.`
    )
  }

  const [a, b] = snapshot.docs
  return [a.id, b.id]
}

async function callRecordSwipeAs(
  callerUid: string,
  targetUid: string,
  direction: 'like'
): Promise<RecordSwipeResult> {
  // recordSwipe is an onCall function requiring request.auth. Scripts running with
  // Admin SDK privileges don't have a "logged in as" concept the way a client does, so
  // we invoke the function's underlying logic via a direct import rather than an HTTP
  // call with a custom token — this avoids standing up a full client SDK auth flow for
  // a one-off verification script.
  //
  // ARCHITECT NOTE: if recordSwipe.ts is refactored to be difficult to invoke outside
  // the onCall wrapper (e.g. business logic is not separable from the auth/HttpsError
  // wrapper), this script may need to instead mint a custom token and call through the
  // client SDK. Flag that back to the Architect rather than restructuring recordSwipe.ts
  // itself to accommodate this script — the CF should not be shaped around a test
  // script's convenience.
  const { recordSwipeHandler } = await import('../functions/src/recordSwipe')
  return recordSwipeHandler({
    auth: { uid: callerUid },
    data: { targetId: targetUid, direction },
  } as any) as Promise<RecordSwipeResult>
}

async function waitForMatchDoc(uidA: string, uidB: string, timeoutMs = 10000): Promise<string> {
  const matchId = [uidA, uidB].sort().join('_')
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const doc = await db.doc(`matches/${matchId}`).get()
    if (doc.exists) return matchId
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(
    `No /matches/${matchId} document appeared within ${timeoutMs}ms after mutual like. ` +
    `onSwipeCreated trigger may not have fired, or there is a bug in match creation.`
  )
}

async function verifyChat(matchId: string, senderUid: string): Promise<void> {
  const messageRef = db.collection(`matches/${matchId}/messages`).doc()
  await messageRef.set({
    senderId: senderUid,
    text: '[verification] mechanics check message',
    type: 'text',
    readBy: [senderUid],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  const written = await messageRef.get()
  if (!written.exists) {
    throw new Error('Test message write to /matches/{matchId}/messages did not persist.')
  }
  await messageRef.delete()
}

async function cleanup(uidA: string, uidB: string, matchId: string): Promise<void> {
  await db.doc(`swipes/${uidA}/likes/${uidB}`).delete().catch(() => {})
  await db.doc(`swipes/${uidB}/likes/${uidA}`).delete().catch(() => {})
  await db.doc(`matches/${matchId}`).delete().catch(() => {})
  // Reset stats.matches on both seed docs to avoid inflating their match count across
  // repeated verification runs.
  await db.doc(`users/${uidA}`).update({ 'stats.matches': admin.firestore.FieldValue.increment(-1) }).catch(() => {})
  await db.doc(`users/${uidB}`).update({ 'stats.matches': admin.firestore.FieldValue.increment(-1) }).catch(() => {})
}

async function main(): Promise<void> {
  console.log('Fetching 2 seed accounts...')
  const [uidA, uidB] = await getTwoSeedAccountUids()
  console.log(`Using seed accounts: ${uidA}, ${uidB}`)

  console.log('Account A liking Account B via recordSwipe...')
  const resultA = await callRecordSwipeAs(uidA, uidB, 'like')
  console.log(`  -> remainingLikes: ${resultA.remainingLikes}`)

  console.log('Account B liking Account A via recordSwipe (should trigger mutual match)...')
  const resultB = await callRecordSwipeAs(uidB, uidA, 'like')
  console.log(`  -> remainingLikes: ${resultB.remainingLikes}`)

  console.log('Waiting for onSwipeCreated to produce a /matches document...')
  const matchId = await waitForMatchDoc(uidA, uidB)
  console.log(`  -> Match created: matches/${matchId}`)

  console.log('Verifying chat message write/read...')
  await verifyChat(matchId, uidA)
  console.log('  -> Chat write/read OK')

  console.log('Cleaning up verification artifacts...')
  await cleanup(uidA, uidB, matchId)
  console.log('  -> Cleanup complete (seed profiles themselves were not touched)')

  console.log('\nAll mechanics checks passed: swipe -> match -> chat working correctly.')
}

main().catch((error) => {
  console.error('\nMechanics verification FAILED:', error)
  process.exit(1)
})
```

---

## Important Architecture Notes for Codex

1. **This script only ever operates on 2 accounts, both fetched by
   `isSeedAccount: true`.** There is no code path in this script that accepts a
   real/arbitrary uid as input. Do not add a CLI argument or config option that would
   let this script target an arbitrary pair of uids — that would turn a safe,
   scope-limited verification tool into something that could be misused against real
   tester accounts.

2. **`recordSwipeHandler` import assumption.** This script assumes `recordSwipe.ts`
   exports its core logic separately from the `onCall` wrapper (a common pattern:
   `export const recordSwipeHandler = async (request) => {...}; export const
   recordSwipe = onCall({region: 'asia-southeast1'}, recordSwipeHandler)`). **Verify
   this export exists before writing the import.** If `recordSwipe.ts` only exports the
   wrapped `onCall` function with no separable handler, do not refactor `recordSwipe.ts`
   to add one as part of this task — that's a production file change riding along on a
   test script's needs, which needs its own review. Instead, output a note in your
   response explaining the gap and ask whether the Architect wants a separate task to
   extract the handler, or wants this script to use the custom-token + client-SDK-call
   approach instead (slower to write, but touches zero production files).

3. **Cleanup is best-effort and logged, not blocking.** Every cleanup step uses
   `.catch(() => {})` deliberately — if cleanup partially fails (e.g. the match doc was
   already deleted by some other process), the script should still report overall
   success for the mechanics check itself, since that's what it's actually verifying.
   Print a warning if any cleanup step's catch fires, but don't fail the whole run over
   it.

4. **Do not use this script's existence as justification for skipping Task 103's
   `recordSwipe` unit tests or treating them as redundant.** Task 103's Jest suite tests
   `recordSwipe`'s internal logic (limit enforcement, direction validation, superlike
   gating) in isolation with mocks. This script tests the real end-to-end trigger chain
   against a live Firestore/Functions environment. They check different things and both
   remain valuable.

---

## Rollback Protocol

If the script fails at any step (e.g. no match doc appears within the timeout):

1. Do not attempt to manually patch around the failure by writing a `/matches` document
   directly — that would make the script report success on a code path that doesn't
   actually work, defeating its purpose.
2. Run the cleanup logic anyway if any swipe docs were partially created, to avoid
   leaving orphaned `/swipes` entries under the seed accounts.
3. Output the actual error and stop. A failure here is signal — it likely means
   something in the `recordSwipe` → `onSwipeCreated` → `/matches` chain is broken, which
   is exactly what you want to know before beta testers start swiping for real.

---

## Codex Self-Check (Run Before Declaring Done)

- [ ] Script only queries for accounts via `isSeedAccount == true` — no path accepts an
      arbitrary/real uid as input
- [ ] `recordSwipeHandler` export verified to exist in `recordSwipe.ts` before the
      import was written (or the gap was reported per Note 2 above, with no production
      file modified to work around it)
- [ ] Cleanup logic runs regardless of whether verification steps succeeded, using
      `.catch(() => {})` per step
- [ ] Script does not delete or modify the seed profile documents themselves — only
      swipe docs, the match doc, and the `stats.matches` counter it incremented
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Acceptance Criteria

- [ ] Running `npx ts-node scripts/verifySwipeMechanics.ts` against a database with 2+
      seed accounts completes with "All mechanics checks passed"
- [ ] A `/matches` document is confirmed to exist mid-run (proving `onSwipeCreated`
      fired correctly) before cleanup removes it
- [ ] A chat message write/read is confirmed mid-run before cleanup removes it
- [ ] After the script completes, `/swipes/{uidA}/likes/{uidB}`,
      `/swipes/{uidB}/likes/{uidA}`, and `/matches/{matchId}` no longer exist
- [ ] Seed profile documents themselves are unchanged except for the `stats.matches`
      increment/decrement round-trip

---

## Do Not Touch

Every existing production file. This script must not require modifying
`recordSwipe.ts`, `onSwipeCreated.ts`, `firestore.rules`, or any client code to
function. If it turns out a modification is genuinely required (per Note 2), stop and
report rather than making the change as part of this task.

---

## Commit

```
git commit -m "chore: add scripted swipe/match/chat mechanics verification (seed-only)"
```

---

## After This Session

Append a short note to `CHANGELOG.md` under a `## [Chore — Mechanics verification
script]` heading: confirm the script ran successfully end-to-end at least once, note the
seed account uids used (for your own reference, not required long-term), and flag
explicitly whether Note 2's `recordSwipeHandler` export already existed or needed to be
raised as a separate follow-up.

---

## Reasoning Level

Medium — invokes a real production Cloud Function and depends on a live trigger chain
firing correctly, which is more than a Low config change, but it's fully scoped to seed
accounts, self-cleans, and touches zero production files under normal conditions.
