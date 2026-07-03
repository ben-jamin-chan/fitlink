# CODEX PROMPT — Task 87: Phase 3 Firestore Security Rules Update

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks — verify each exists in the current `firestore.rules` before changing anything:**

- Task 79 must have written a `match /gymCheckins/{checkinId}` block with owner-only `read`/`delete`, `create: if false`, `update: if false` — verify present
- Task 80 must have written a `match /events/{eventId}` block with authenticated `read`, `create: if false`, creator-only scoped `update` via `diff().affectedKeys().hasOnly([...])`, `delete: if false` — verify present
- Task 84 must have written a `match /notificationPreferences/{docId}` block nested under `/users/{userId}` with owner-only `read, write` — verify present
- Task 86 must have written `match /admin_queue/{docId}` and `match /flags/{docId}` blocks, both `allow read, write: if false` — verify present

If any of these four blocks is missing or its logic differs materially from the description above:

```
<!-- DEPENDENCY ERROR
  Missing or altered: [name the block and what differs]
  Cannot proceed. Bring this back to the Architect before continuing.
-->
```

Do not attempt to "fix" or recreate a missing block from memory of the task spec — stop and report.

---

## Context

This task does **not** introduce any new collection. It is a consolidation and gap-closing
pass over the existing `firestore.rules` file, which by this point has had five independent
Cloud-Function-era tasks (74, 79, 80, 84, 86) each append their own rule block without
visibility into each other's changes. Your job is to verify what's there and fix exactly
one confirmed gap — nothing else should change.

**Current `firestore.rules` structure you need to know about** (read the actual file first —
do not assume; the below is a guide to what you should find, not a substitute for reading it):

- `doesNotSetServerOnlyFieldsOnCreate()` — blocks server-only fields from being present when
  a `/users/{userId}` document is first created. Currently includes `'boost'` (no `boostExpiresAt`).
- `doesNotModifyServerOnlyFields()` — blocks server-only fields from being changed on
  `/users/{userId}` update. Currently includes `'boost'` (no `boostExpiresAt`). **This is the
  function this task must fix.**
- `doesNotModifyGymCheckinExceptDelete()` — a dedicated guard already correctly handles
  `gymCheckin` separately (blocks all changes except deletion on checkout). This is correct
  as-is — **do not fold `gymCheckin` into `doesNotModifyServerOnlyFields()`, it already has
  its own purpose-built function.**
- `/users/{userId}` `allow update` rule chains all the `doesNotModify*` guards together with `&&`.

**The confirmed gap:** `functions/src/activateBoost.ts` (Task 74) writes a field named
`boostExpiresAt` to `users/{uid}.boostExpiresAt` — this is the actual schema field per
`ARCHITECT.md` and `types/user.ts`. The current `doesNotModifyServerOnlyFields()` list
contains a field named `'boost'`, which does not correspond to any field written by any
Cloud Function or declared in `types/user.ts`. **This means `boostExpiresAt` is currently
NOT blocked from client writes** — a client could set their own boost expiry directly.
This task adds `'boostExpiresAt'` to the server-only fields list in
`doesNotModifyServerOnlyFields()`. Leave `'boost'` in place unless you can confirm via
`grep -rn "'boost'" --include="*.ts"` across `functions/src` and `types/` that nothing
writes or reads a field literally named `boost` — if `'boost'` is confirmed dead, remove it
in this same edit and note the removal in the CHANGELOG; if you cannot confirm it's dead,
leave it in place (extra protection on an unused name is harmless) and only add
`boostExpiresAt` alongside it.

**Do NOT touch `doesNotSetServerOnlyFieldsOnCreate()`** (the create-time list) as part of
fixing the update-time gap unless you find through the same grep that `boostExpiresAt`
should also be blocked at creation time for consistency — if so, add it there too, using
the same reasoning. State explicitly in your output whether you made this same fix in both
functions or only one, and why.

**Everything else in `firestore.rules` is expected to already be correct** based on the
CHANGELOG entries for Tasks 79, 80, 84, and 86. Your job for those sections is **read and
confirm**, not edit. If you find any of those four blocks does not match what the
Pre-Task Dependency Check above describes, stop and output a DEPENDENCY ERROR rather than
silently correcting it — a mismatch there is a bigger finding than this task's scope covers
and needs Architect review.

---

## Task 87 — Phase 3 Firestore Security Rules Update

**Files to create:** none

**Files to modify:**
- `firestore.rules` — add `boostExpiresAt` to the server-only fields list in
  `doesNotModifyServerOnlyFields()` (and, conditionally, to
  `doesNotSetServerOnlyFieldsOnCreate()` per the grep check above)

---

### `firestore.rules` — Update

> Only show the specific change — not the full file.

```javascript
// In doesNotModifyServerOnlyFields(), update the serverOnlyFields array to add
// boostExpiresAt. Example of the resulting array (verify exact current array
// contents from the live file first — do not assume the order or comments below
// are exactly what's in the file):

function doesNotModifyServerOnlyFields() {
  let serverOnlyFields = [
    // Phase 1 server-only fields
    'age',
    'banned',
    'banReason',
    'bannedAt',
    // Phase 2 server-only fields
    'photoVerified',
    'verifiedAt',
    'stripeCustomerId',
    'premium',
    'boost',           // existing — leave unless confirmed dead via grep (see Context)
    'boostExpiresAt',  // NEW — Task 74's activateBoost CF field; closes Task 87 gap
    // Legacy Phase 1 field — client still sees it in normalised reads
    // but must not write it
    'subscription'
  ];
  return !request.resource.data.diff(existingData())
          .affectedKeys()
          .hasAny(serverOnlyFields);
}
```

> Make the equivalent addition to `doesNotSetServerOnlyFieldsOnCreate()` ONLY if your grep
> confirms it's appropriate for consistency (boostExpiresAt should never be settable at
> profile creation time either, since boosts are activated post-onboarding — this is very
> likely correct to add there too, but verify the function's current array first and follow
> the same array-edit pattern, in the same style as the existing entries).

> Do not modify: `doesNotModifyGymCheckinExceptDelete()`, `doesNotModifyStravaTokenFields()`,
> `doesNotModifyStravaMapExceptDisconnect()`, any `match` block under `/gymCheckins`,
> `/events`, `/admin_queue`, `/flags`, `/notificationPreferences`, `/matches`, `/swipes`,
> `/reports`, `/blocked`, or the default catch-all. These are all verified correct per the
> Pre-Task Dependency Check and are out of scope for this task.

---

## Important Architecture Notes for Codex

1. **This is a one-field fix, not a rewrite.** Resist any temptation to "clean up" or
   reformat the rest of `firestore.rules` while you're in the file. Touch only the
   `serverOnlyFields` array(s) identified above. A diff for this task should be a handful
   of added lines, not a restructured file.

2. **`boost` vs `boostExpiresAt` naming.** These are different field names. `'boost'` being
   in the existing list does NOT mean `boostExpiresAt` was already covered — Firestore rules
   match field names literally, with no aliasing. Confirm this distinction in your own
   reasoning before editing; do not assume `'boost'` was a typo for `boostExpiresAt` and
   simply rename it — check via grep whether `'boost'` (without "ExpiresAt") is referenced
   anywhere first, per the Context section.

3. **Read before you write.** Use `view`/`cat` on the actual current `firestore.rules` file
   in this repo before making any edit — do not reproduce the array contents shown in this
   prompt verbatim without first confirming they match what's actually in the file. The
   array shown above is illustrative of the *pattern*, not guaranteed to be byte-identical
   to the current file's comments or ordering.

4. **Verification, not implementation, for Tasks 79/80/84/86 blocks.** If you find all four
   are present and correctly scoped as described in the Pre-Task Dependency Check, do not
   re-write or "improve" them. Leave them exactly as they are.

5. **No Cloud Function changes in this task.** `activateBoost.ts` and `getDiscoveryStack.ts`
   are unaffected by this task — the field name and write logic there are already correct;
   only the rules file was missing the corresponding read-side guard.

---

## Rollback Protocol

If, while reading the live `firestore.rules` file, you discover that any of the four
verified-dependency blocks (Tasks 79, 80, 84, 86) is missing, materially different from
its CHANGELOG description, or that the emulator probe fails for a reason unrelated to the
`boostExpiresAt` addition itself:

1. Do not commit any partial changes
2. Revert `firestore.rules` to its state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the file, the discrepancy found, and
   what's needed to proceed
4. Stop. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] N/A — this task touches only `firestore.rules`, no `.ts` files

**Conventions**
- [ ] No other file was modified besides `firestore.rules`

**Firebase / Security**
- [ ] `boostExpiresAt` is now present in `doesNotModifyServerOnlyFields()`'s `serverOnlyFields` array
- [ ] A decision was made and documented (in your task-completion output) on whether
      `boostExpiresAt` was also added to `doesNotSetServerOnlyFieldsOnCreate()`, with the
      grep evidence cited
- [ ] A decision was made and documented on whether `'boost'` was left in place or removed,
      with the grep evidence cited
- [ ] `/gymCheckins`, `/events`, `/notificationPreferences`, `/admin_queue`, `/flags` blocks
      are confirmed present and byte-identical to their state before this task
- [ ] `/matches`, `/swipes`, `/reports`, `/blocked`, `/users/{userId}/dailyLikes`,
      `/users/{userId}/verificationAttempts` blocks are confirmed untouched
- [ ] The default catch-all (`match /{document=**} { allow read, write: if false; }`)
      remains the last rule in the file

**Architecture**
- [ ] No new Firestore collection introduced
- [ ] No new field introduced — this task only adds a *guard* for an existing field
      (`boostExpiresAt`) that already exists in `types/user.ts` and is already written by
      `activateBoost.ts`

**Validation**
- [ ] Run the emulator probe:
      `firebase emulators:exec --only firestore "node -e \"process.exit(0)\""`
- [ ] Confirm it exits 0 (rules parse without syntax errors)

---

## Acceptance Criteria

- [ ] `firestore.rules` modified — `boostExpiresAt` added to `doesNotModifyServerOnlyFields()`
- [ ] Decision on `doesNotSetServerOnlyFieldsOnCreate()` made and documented with grep evidence
- [ ] Decision on the legacy `'boost'` entry made and documented with grep evidence
- [ ] All four prior-task blocks (`/gymCheckins`, `/events`, `/notificationPreferences`,
      `/admin_queue` + `/flags`) confirmed present and unmodified
- [ ] No Phase 1/2 rule block (`/users` base rules apart from the one named addition,
      `/matches`, `/swipes`, `/reports`, `/blocked`, `/users/{userId}/dailyLikes`,
      `/users/{userId}/verificationAttempts`) was altered
- [ ] Emulator probe passes (rules parse cleanly)
- [ ] Diff is minimal — limited to the `serverOnlyFields` array edit(s) and nothing else

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `types/user.ts`,
`constants/`, `i18n/`, `functions/src/activateBoost.ts`, `functions/src/getDiscoveryStack.ts`,
and every `match` block in `firestore.rules` not named in this prompt's scope: `/users/{userId}`
sub-blocks `dailyLikes` and `verificationAttempts`, `/swipes/{userId}/likes/{targetId}`,
`/swipes/{userId}/passes/{targetId}`, `/matches/{matchId}` (including nested `messages`),
`/reports/{reportId}`, `/blocked/{userId}`, `/gymCheckins/{checkinId}`, `/events/{eventId}`,
`/notificationPreferences/{docId}`, `/admin_queue/{docId}`, `/flags/{docId}`, the default
catch-all, and every helper function not explicitly named for editing in this prompt
(`isSignedIn`, `isOwner`, `existingData`, `legacyServerOnlyFields`,
`doesNotSetLegacyServerOnlyFieldsOnCreate`, `doesNotModifyLegacyServerOnlyFields`,
`doesNotModifyGymCheckinExceptDelete`, all `fitnessTracking`/`strava`-related helper
functions, `isMatchParticipant`).

---

## Commit

```
git commit -m "task-87: add boostExpiresAt to firestore.rules server-only field guard"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 3D — Task 87] — YYYY-MM-DD

### Completed

- Task 87: Phase 3 Firestore Security Rules Update
- [State the boostExpiresAt fix and your grep-based decisions on 'boost' and the
  create-time list]

### Files Created

- None

### Files Modified

- firestore.rules: [exact description of the array edit(s) made]

### Architecture Decisions

- [State your grep evidence and conclusion on whether 'boost' is dead code]
- [State whether boostExpiresAt was added to doesNotSetServerOnlyFieldsOnCreate() and why]

### Conflict Risks Introduced

- None expected — Task 88 (indexes) has no dependency on this field-guard change.
- If you found and had to STOP on a DEPENDENCY ERROR for any of Tasks 79/80/84/86,
  document that here instead and flag it prominently.

### Known Issues / Deferred

- [Any]

### Next Up

- Task 88: Phase 3 Firestore Indexes
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.
**Also attach the updated `firestore.rules` file** — Task 88 does not need it, but if any
DEPENDENCY ERROR was hit, the Architect will need the live file to advise on next steps.

---

## Reasoning Level

Extra High

> Per `CODEX_PROMPT_FORMAT_REFERENCE.md`: this qualifies as Extra High because it modifies
> `firestore.rules`, which affects access control for existing Phase 1/2 collections, and a
> wrong edit here (e.g. accidentally loosening `doesNotModifyServerOnlyFields()` instead of
> tightening it, or a syntax error that fails open) is not something `tsc --noEmit` can catch
> — it would only surface as a live security gap or a broken deploy.
