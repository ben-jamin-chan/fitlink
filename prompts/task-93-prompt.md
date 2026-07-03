# CODEX PROMPT — Task 93: Phase 4 Firestore Indexes Audit & Validation

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 92 must have completed the Phase 4A Firestore security rules audit and added
  the Phase 4A audit comment block to `firestore.rules` — verify the comment block is
  present at the top of `firestore.rules` before proceeding.
- Tasks 89–91 must be complete (SEA Tier 2 constants, onboarding, Stripe pricing) —
  verify `constants/regions.ts` exports `Philippines`, `Indonesia`, `Vietnam` entries
  and that `functions/src/createStripeCheckout.ts` contains the inlined
  `COUNTRY_TO_CURRENCY` map.

If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your
response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: [describe what is absent]
  Cannot proceed. Re-run the relevant prior task before this task.
-->
```

---

## Context

- `firestore.indexes.json` — the composite index definitions for all Firestore queries
  requiring multi-field ordering. Phase 1 added indexes covering discovery stack queries
  (e.g. `location.city`, `banned`, `paused`, `lastActive`). Phase 3 added indexes for
  events and admin queue queries.
- `firestore.rules` — already audited and confirmed clean in Task 92. Do not touch it
  in this task.
- Phase 4A (Tasks 89–91) added no new Firestore collections and no new query patterns.
  `getDiscoveryStack` continues to query by `location.city` — already indexed.
  The new `location.country`, `timezone`, and currency fields written in Tasks 89–91
  are written at onboarding time and are not used in multi-field composite queries.

**This task is a validation and documentation task, not a schema addition task.**
If the indexes file is already valid and complete, the correct output is a zero-change
validation with a CHANGELOG entry confirming that — do not add indexes that do not
correspond to actual query patterns in the codebase.

---

## Task 93 — Phase 4 Firestore Indexes Audit & Validation

**Files to create:**
- None

**Files to modify:**
- `firestore.indexes.json` — only if a genuine gap is found during the audit below;
  otherwise confirm no change needed and document in CHANGELOG

---

### Step 1 — Validate JSON Syntax

Run the following command and confirm it outputs `valid`:

```bash
node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"
```

If this fails, fix the JSON syntax error. Report the fix in the CHANGELOG.

---

### Step 2 — Phase 4A Query Audit

For each new query pattern introduced in Tasks 89–91, confirm whether a composite index
is required. A composite index is required only when a query combines:
- A `where` clause on field A **and**
- An `orderBy` on field B (where A ≠ B), or
- Multiple `where` clauses on different fields.

**Phase 4A new queries to audit:**

| Source | Query pattern | Index required? |
|--------|--------------|-----------------|
| `getDiscoveryStack` | Filters by `location.city` + other fields | Pre-existing (Phase 1) — confirm still present |
| `createStripeCheckout.ts` | Reads `users/{uid}` single doc by path | No composite index — single doc read |
| `stripeWebhook.ts` | Reads `users/{uid}` single doc by path | No composite index — single doc read |
| `Step1Screen.tsx` (onboarding) | Writes `location.country`, `timezone` | No query — write only |
| `services/stripe.ts` | No Firestore queries | No index needed |

**Expected outcome:** No new indexes required for Phase 4A. If you find a query pattern
that does require a new composite index, add it and document it clearly in the CHANGELOG.

---

### Step 3 — Confirm Existing Phase 1/2/3 Indexes Still Valid

Scan the existing index entries in `firestore.indexes.json` and confirm:

1. No index references a collection or field that was renamed or removed in Phase 3 or 4A
2. The JSON structure conforms to the Firebase index schema:
   - Each entry has `collectionGroup`, `queryScope`, and `fields`
   - `fields` is an array with each element having `fieldPath` and `order` (`ASCENDING` or `DESCENDING`),
     or `arrayConfig: CONTAINS` for `array-contains` queries

If any stale or malformed entry is found, fix it and document in CHANGELOG.

---

### Step 4 — Add Phase 4A Audit Comment

Firestore index files do not support inline comments (JSON). Instead, add a top-level
`"// phase4A_audit"` note in the CHANGELOG entry only — do not attempt to add comments
to the JSON file itself.

---

## Important Architecture Notes for Codex

1. **Do not add speculative indexes.** Only add an index if you can point to a specific
   query in the codebase that requires it. Adding unused indexes wastes Firestore write
   quota and storage.

2. **`firestore.rules` is out of scope.** Task 92 already audited and closed it.
   Do not open, read, or modify `firestore.rules` in this task.

3. **Single-document reads never require composite indexes.** `admin.firestore().doc('users/${uid}').get()`
   is a direct path read — not a collection query — and needs no index entry.

4. **JSON must remain valid after any change.** Run the node validation command from
   Step 1 after any modification before declaring the task done.

5. **Zero-change is a valid and expected outcome.** If the audit confirms no gaps, the
   task is complete with no file modifications. Document this clearly in the CHANGELOG.

---

## Rollback Protocol

If `firestore.indexes.json` cannot be made valid JSON without:
- Removing an index that an existing query in the codebase depends on, OR
- Making an assumption about a prior task's query patterns that cannot be verified

**Then:**
1. Do not commit any partial changes
2. Revert `firestore.indexes.json` to its state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the conflict
4. Stop. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**Validation**
- [ ] `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"` — outputs `valid`
- [ ] `npx tsc --noEmit` — zero errors (no TypeScript files were touched, but confirm)
- [ ] Every index entry has `collectionGroup`, `queryScope`, and `fields` — no malformed entries

**Audit completeness**
- [ ] Phase 4A query patterns checked (Tasks 89, 90, 91) — no new composite indexes required confirmed or new indexes added with justification
- [ ] Existing Phase 1/2/3 indexes verified — no stale collection/field references
- [ ] `firestore.rules` was not opened or modified in this session

**Files**
- [ ] Files in the "Do Not Touch" list were not modified

---

## Acceptance Criteria

- [ ] `firestore.indexes.json` passes JSON syntax validation via the node command
- [ ] Phase 4A audit complete — CHANGELOG documents either "no new indexes required" or lists each new index added with its query justification
- [ ] All existing index entries confirmed valid — no stale or malformed entries
- [ ] `firestore.rules` unchanged from Task 92 output
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Do Not Touch

`firestore.rules` (Task 92 already closed this — do not reopen),
`constants/regions.ts`, `types/user.ts`, `functions/src/createStripeCheckout.ts`,
`functions/src/stripeWebhook.ts`, `services/stripe.ts`,
`app/settings/PremiumScreen.tsx`, `app/onboarding/Step1Screen.tsx`,
`store/onboardingStore.ts`, `App.tsx`, `store/authStore.ts`,
`services/firebase/config.ts`, `constants/`, `i18n/`

---

## Commit

```
git commit -m "task-93: phase 4A firestore indexes audit and validation"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4A — Task 93] — YYYY-MM-DD

### Completed

- Task 93: Phase 4 Firestore Indexes Audit & Validation
- [e.g. "No new composite indexes required for Phase 4A — confirmed" OR list indexes added]

### Files Created

- None

### Files Modified

- firestore.indexes.json: [e.g. "No changes — JSON validated clean" OR describe what changed]
- CHANGELOG.md: recorded Task 93 completion

### Architecture Decisions

- Phase 4A introduced no new collection-level queries requiring composite indexes.
  getDiscoveryStack location.city index remains the primary discovery filter, unchanged
  from Phase 1.
- [Add any additional decision if an index was actually added]

### Conflict Risks Introduced

- None — Task 94 (admin dashboard scaffold) creates new files in /admin/ and does not
  touch firestore.indexes.json.

### Known Issues / Deferred

- None

### Next Up

- Task 94: Admin Dashboard — Project Scaffold & Auth
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 94 prompt.

---

## Reasoning Level

Low
