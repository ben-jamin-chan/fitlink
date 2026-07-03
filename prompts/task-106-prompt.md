# Task 106 — Phase 4 Firestore Security Rules: Admin Audit & Warnings (Verify + Index)

@CONVENTIONS.md @ARCHITECT.md

---

## ⚠️ Architect Note — Read Before Starting

Per the CHANGELOG, the `/admin_audit` and `/users/{uid}/warnings` rules this task's
original spec describes as "add" were **already written during Task 95**:

> Task 95 CHANGELOG: "firestore.rules: appended Task 95 admin read-only queue rules,
> /admin_audit deny block, /users/{uid}/warnings owner-read block"

**Do not blindly insert new `match` blocks for these paths.** If they already exist in
`firestore.rules`, inserting duplicates is a silent rules-file corruption that
`tsc --noEmit` cannot catch (Firestore rules are not type-checked). This task is
**verification + index addition**, not rule addition. Follow the steps in order below.

---

## Pre-Task Dependency Check

**Required outputs from prior tasks — verify each is actually present in the live file
before doing anything else:**

- Task 95 must have appended a `/admin_audit/{docId}` rule block with `allow read, write: if false;`
- Task 95 must have appended a `/users/{uid}/warnings/{warningId}` rule block with
  `allow read: if request.auth != null && request.auth.uid == uid; allow write: if false;`
- Task 100 must have appended a scoped `/blocked/{userId}/users/{blockedId}` owner
  read/delete rule (CHANGELOG: "replaced the deny-all blocked wildcard with an outer
  parent deny and scoped owner read/delete on `/blocked/{userId}/users/{blockedId}`")
- Task 86 (Phase 3, not in this CHANGELOG but referenced by spec) must have deny rules
  for `/admin_queue` and `/flags`

> If any of these four are absent from the live `firestore.rules`, STOP and output a
> DEPENDENCY ERROR block listing exactly what's missing. Do not attempt to write the
> missing rule yourself as a substitute — that decision belongs to a separate,
> Architect-reviewed task.

```
<!-- DEPENDENCY ERROR
  Missing: [describe exactly what is absent from firestore.rules]
  Cannot proceed. Bring this back to the Architect before continuing.
-->
```

---

## Context

- `firestore.rules` — has accumulated rules across Tasks 92, 95, and 100 in Phase 4
  alone, on top of the full Phase 1–3 baseline. Task 95 also added a duplicate
  read-only `/reports` and `/flags` match block scoped to
  `request.auth.token.admin == true`, intentionally layered alongside the existing
  Task 86 deny blocks — this is correct and must not be collapsed or "simplified" away.
- `firestore.indexes.json` — last touched in Task 93 (Phase 4A indexes audit), which
  confirmed no new composite indexes were needed at that point. This task is the first
  to actually add one.

**No client-side or Cloud Function code is touched in this task.** This is a rules +
indexes file task only.

---

## Task 106 — Verify Admin/Warnings Rules, Add Missing Audit Index

**Files to create:** None

**Files to modify:**
- `firestore.rules` — verify only (see Step 1); do not add rules unless Step 1 finds a
  genuine gap
- `firestore.indexes.json` — add one composite index for `/admin_audit`

---

### Step 1 — Verify `firestore.rules` (read-only pass first)

Open `firestore.rules` and confirm, by reading the actual file content, that each of the
following exists **exactly as described** (wording may differ slightly in whitespace/
comments, but the access logic must match):

**1a. `/admin_audit/{docId}`**
Expected: `allow read, write: if false;` — fully closed, Admin SDK only.

**1b. `/users/{uid}/warnings/{warningId}`**
Expected: owner can read their own warnings; nobody can write from the client.
```
allow read: if request.auth != null && request.auth.uid == uid;
allow write: if false;
```

**1c. `/blocked/{userId}/users/{blockedId}`** (from Task 100 — must survive untouched)
Expected: scoped owner read/delete, with a deny-all on the outer `/blocked/{userId}`
parent path. Do not modify this block. Confirm only.

**1d. `/admin_queue/{docId}` and `/flags/{docId}`** (from Task 86 baseline)
Expected: deny-all or admin-claim-gated read rules are present — confirm they were not
accidentally weakened or removed by any later task.

**If all four are present and correctly scoped:** add a single comment line directly
above the `/admin_audit` block (or at the top of the relevant section) noting the
verification:
```
// Task 106: verified — admin_audit, warnings, blocked, admin_queue/flags rules confirmed intact (no changes needed)
```

**If any of 1a–1d is missing, incorrectly scoped, or was weakened:** STOP. Do not patch
it yourself. Output a `<!-- RULES GAP FOUND -->` block describing exactly what's wrong
and what the correct rule should be, and bring it back to the Architect rather than
deciding the fix unilaterally — this is a security-relevant file and the fix needs a
second review pass regardless of how small it looks.

```
<!-- RULES GAP FOUND
  Path: [exact match path]
  Expected: [what the rule should say]
  Found: [what's actually there, or "absent"]
  Recommendation: [your suggested fix, for the Architect to review — do not apply it yet]
-->
```

---

### Step 2 — `firestore.indexes.json`

This is the part of Task 106 that is genuinely new work — no prior task added this index.

Add a composite index for `/admin_audit` to support per-admin audit trail queries
(filtering by `adminUid`, ordered by `createdAt` descending):

```json
{
  "collectionGroup": "admin_audit",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "adminUid", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

Insert this into the `indexes` array of `firestore.indexes.json`, preserving every
existing entry — append, do not replace or reorder the array.

`/users/{uid}/warnings` is a subcollection with low cardinality per user — no composite
index is needed for it. Do not add one.

After editing, validate the JSON is syntactically correct:
```bash
node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"
```

---

### Step 3 — Emulator probe

Run the emulator probe to confirm the rules file (whether modified or confirmed
unchanged) still loads without syntax errors:
```bash
firebase emulators:exec --only firestore "node -e \"process.exit(0)\""
```

---

## Important Architecture Notes for Codex

1. **Verify before writing.** This task's entire premise is that some of its nominal
   scope was already completed by an earlier task. Always read the live file first. A
   `str_replace`-style insertion against text that's already present either fails loudly
   (good) or succeeds and creates a duplicate `match` block (bad, and `tsc` will not
   catch it). Treat "already present and correct" as a valid, complete outcome for Step 1
   — it is not a sign you've done something wrong.

2. **Do not touch the Task 95 admin-claim-gated `/reports` / `/flags` duplicate block.**
   It looks redundant next to the Task 86 deny rules but is intentional layering for the
   admin dashboard's client SDK reads. Collapsing it would break the admin dashboard.

3. **Rules gaps are not yours to fix solo.** If Step 1 finds an actual discrepancy,
   report it precisely and stop. `firestore.rules` is the single highest-blast-radius
   file in this codebase — a wrong fix here is worse than a missing one, because a
   missing rule fails closed (implicit deny) while a wrong rule can fail open.

4. **Index addition is append-only.** `firestore.indexes.json`'s `indexes` array must
   gain exactly one new object. Do not reformat, reorder, or "clean up" existing entries
   while you're in the file.

---

## Rollback Protocol

If the emulator probe fails after your index addition, or if Step 1 surfaces a rules
gap you're not instructed to fix:

1. Do not commit any partial changes.
2. Revert `firestore.indexes.json` to its state at session start if your edit caused the
   probe to fail.
3. Output the appropriate block (`DEPENDENCY ERROR`, `RULES GAP FOUND`, or a generic
   `<!-- ROLLBACK REPORT -->` for an emulator/JSON failure) and stop.
4. Bring the report back to the Architect. Do not attempt a workaround.

---

## Codex Self-Check (Run Before Declaring Done)

**Verification**
- [ ] `/admin_audit/{docId}` rule confirmed present and correctly scoped (or gap reported)
- [ ] `/users/{uid}/warnings/{warningId}` rule confirmed present and correctly scoped (or gap reported)
- [ ] `/blocked/{userId}/users/{blockedId}` rule from Task 100 confirmed untouched
- [ ] `/admin_queue` and `/flags` deny/admin-gated rules confirmed present
- [ ] Task 95's admin-claim-gated `/reports` / `/flags` duplicate block confirmed untouched

**Indexes**
- [ ] Exactly one new composite index added for `/admin_audit` (`adminUid ASC, createdAt DESC`)
- [ ] No composite index added for `/users/{uid}/warnings`
- [ ] All pre-existing entries in `firestore.indexes.json` preserved, unreordered
- [ ] `node -e "JSON.parse(...)"` validation passes

**Infrastructure**
- [ ] `firebase emulators:exec --only firestore "node -e \"process.exit(0)\""` passes

**Architecture**
- [ ] No `match` block was duplicated anywhere in `firestore.rules`
- [ ] If a gap was found, it was reported (not silently fixed)
- [ ] No client or Cloud Function files were touched

---

## Acceptance Criteria

- [ ] `firestore.rules` content is either (a) confirmed already correct with a one-line
      verification comment added, or (b) a `RULES GAP FOUND` block was output and no
      uninstructed fix was applied
- [ ] `firestore.indexes.json` contains exactly one new composite index for `admin_audit`
- [ ] `firestore.indexes.json` remains valid JSON
- [ ] Emulator probe passes
- [ ] No duplicate rule blocks introduced anywhere in `firestore.rules`

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `types/user.ts`,
`constants/`, `i18n/`, any file under `functions/src/` (this task is rules/indexes
only — no Cloud Function logic changes), any file under `admin/src/`, the Task 95
admin-claim-gated `/reports`/`/flags` rule block, the Task 100 `/blocked/{userId}/users/{blockedId}`
rule block.

---

## Commit

```
git commit -m "task-106: verify admin audit/warnings rules, add admin_audit composite index"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4E — Task 106] — YYYY-MM-DD

### Completed

- Task 106: Phase 4 Firestore Security Rules — admin audit & warnings (verify + index)
- Verified /admin_audit, /users/{uid}/warnings, /blocked/{userId}/users/{blockedId},
  /admin_queue, /flags rules all present and correctly scoped (originally added in
  Tasks 95/100/86 — no new rule additions required)
- Added missing /admin_audit composite index: (adminUid ASC, createdAt DESC)

### Files Created

- None

### Files Modified

- firestore.rules: [either "verification comment only — no rule changes" or describe
  the actual gap fix if one was needed, per Architect review]
- firestore.indexes.json: added admin_audit composite index

### Architecture Decisions

- Task 106 scope was verify-and-index, not add-rules, because Task 95's CHANGENLOG
  entry confirmed the admin_audit and warnings rules were already written. This avoided
  a duplicate-block risk from following the original spec literally.

### Conflict Risks Introduced

- None — rules content unchanged (assuming Step 1 found no gap); indexes append-only

### Known Issues / Deferred

- None

### Next Up

- Phase 4 is now feature-complete pending the PHASE 4 DONE CHECKLIST review in
  TASKS_PHASE4.md. No Task 107 exists in this spec — confirm with the Architect whether
  Phase 4 close-out or Phase 5 planning is next.
```

Then come to claude.ai with the updated CHANGELOG.md.

---

## Reasoning Level

Medium

*(Per spec. Rescoped from "add rules" to "verify rules + add index" based on the
pre-generation conflict audit, but the actual blast radius — a few lines in one
already-stable rules file, plus one index entry — remains Medium, not High. If Step 1's
verification surfaces a genuine gap, treat that discovery as a stop condition requiring
Architect review before any fix, regardless of how small the gap appears.)*
