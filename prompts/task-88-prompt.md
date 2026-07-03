@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**
- Task 87 must have completed the Phase 3 Firestore Security Rules Update — verify `firestore.rules` already contains explicit blocks for `/events/{id}`, `/gymCheckins/{id}`, `/users/{uid}/notificationPreferences/{docId}`, `/admin_queue/{docId}`, and `/flags/{docId}`, and that `boostExpiresAt` is present in the server-only field guards.
- Task 80 must have written two composite indexes for `/events` to `firestore.indexes.json`: `(city ASC, cancelled ASC, startAt ASC)` and `(attendees ARRAY_CONTAINS, startAt ASC)` — verify present.
- Task 86 must have written two composite indexes to `firestore.indexes.json`: `admin_queue (status ASC, createdAt DESC)` and `flags (status ASC, createdAt DESC)` — verify present.

> If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your
> response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: firestore.indexes.json does not contain the /events composite indexes from Task 80.
  Cannot proceed. Re-run Task 80 before this task.
-->
```

---

## Context

This is the final task of Phase 3 — index consolidation. No application code is touched.
`firestore.indexes.json` currently contains composite indexes from Phase 1, Phase 2, and
the Phase 3 tasks completed so far (Tasks 80 and 86). This task adds the two remaining
`/gymCheckins` composite indexes that Task 79's implementation explicitly deferred to this
task, and confirms nothing else is missing or duplicated.

- `firestore.indexes.json` — existing file; contains Phase 1/2 indexes plus Task 80's two
  `/events` indexes and Task 86's `admin_queue` / `flags` indexes. **Do not remove or modify
  any existing index entries** — this task is additive only.
- `/gymCheckins/{id}` — collection created in Task 79 (`functions/src/createCheckin.ts`).
  Task 79's CHANGELOG entry states: "`/gymCheckins` compound indexes (userId + expiresAt,
  city + expiresAt) are deferred to Task 88" — this task resolves that deferral.

**This task does not touch `firestore.rules`, any Cloud Function, or any client file. If
any code file appears changed, that is architectural drift and must be corrected.**

---

## Task 88 — Phase 3 Firestore Indexes

**Files to create:**
- None

**Files to modify:**
- `firestore.indexes.json` — add two new composite indexes for `/gymCheckins`; verify all other Phase 3 indexes are present and no duplicates exist

---

### `firestore.indexes.json` — Update

> Add the following two index definitions to the existing `indexes` array. Do not remove,
> reorder, or modify any existing entries — Phase 1, Phase 2, Task 80's `/events` indexes,
> and Task 86's `admin_queue` / `flags` indexes must all remain exactly as they are.

```json
{
  "collectionGroup": "gymCheckins",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "expiresAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "gymCheckins",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "city", "order": "ASCENDING" },
    { "fieldPath": "expiresAt", "order": "DESCENDING" }
  ]
}
```

> Before adding, open the file and confirm these two `gymCheckins` entries do not already
> exist under a different field order — if an equivalent index is already present, do not
> add a duplicate.

> While editing, also confirm (read-only check, do not modify if present and correct):
> - `/events`: `(city ASC, cancelled ASC, startAt ASC)` — from Task 80
> - `/events`: `(attendees ARRAY_CONTAINS, startAt ASC)` — from Task 80
> - `/admin_queue`: `(status ASC, createdAt DESC)` — from Task 86
> - `/flags`: `(status ASC, createdAt DESC)` — from Task 86
>
> If any of these four are missing, output a DEPENDENCY ERROR block (see top of this
> prompt) rather than attempting to reconstruct them from memory — re-confirm against the
> actual prior task's CHANGELOG entry first.

---

## Important Architecture Notes for Codex

1. **Additive only.** This task only adds index definitions. Never delete or modify an
   existing index entry in `firestore.indexes.json`, even if it looks redundant — a prior
   task may rely on it for a query not visible in this prompt.

2. **No code changes.** This task does not touch `firestore.rules`, any file under
   `functions/src/`, any file under `store/`, or any client screen/component. If your diff
   shows changes outside `firestore.indexes.json`, revert them.

3. **JSON validity over formatting.** Preserve the existing file's formatting style
   (indentation, key ordering within each index object) rather than reformatting the whole
   file. A minimal diff is preferred over a full-file rewrite.

4. **No duplicate indexes.** Firestore will reject or silently ignore a duplicate composite
   index. Check the existing `gymCheckins` collection group (if any partial/legacy entry
   exists) before appending.

---

## Rollback Protocol

If the existing `firestore.indexes.json` cannot be parsed as valid JSON before your edit,
or if any of the four "read-only check" indexes listed above are missing:

1. Do not modify the file
2. Output a `<!-- ROLLBACK REPORT -->` block listing:
   - What was found vs. what was expected
   - What information or decision is needed to proceed
3. Stop. Do not attempt to reconstruct missing indexes from memory. Bring the report back
   to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

- [ ] `firestore.indexes.json` is valid JSON — run:
      `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"`
- [ ] Two new `gymCheckins` composite indexes present: `(userId ASC, expiresAt DESC)` and
      `(city ASC, expiresAt DESC)`
- [ ] No existing index entries were removed, reordered in a way that changes meaning, or
      modified
- [ ] No duplicate `gymCheckins` index was created
- [ ] `/events` indexes from Task 80 confirmed present (2 entries)
- [ ] `admin_queue` and `flags` indexes from Task 86 confirmed present (2 entries)
- [ ] Zero files changed other than `firestore.indexes.json`
- [ ] `npx tsc --noEmit` — zero errors (sanity check only; this task shouldn't affect TS output)

---

## Acceptance Criteria

- [ ] `firestore.indexes.json` parses as valid JSON
- [ ] `gymCheckins (userId ASC, expiresAt DESC)` index present
- [ ] `gymCheckins (city ASC, expiresAt DESC)` index present
- [ ] All pre-existing indexes (Phase 1, Phase 2, Task 80 `/events` x2, Task 86
      `admin_queue` + `flags`) remain present and unchanged
- [ ] No duplicate index definitions
- [ ] Only `firestore.indexes.json` was modified

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `types/user.ts`,
`constants/`, `i18n/`, `firestore.rules` (Task 87 already finalized this — do not reopen),
any file under `functions/src/`, any file under `app/`, `components/`, or `store/`.

---

## Commit

```
git commit -m "task-88: add gymCheckins composite indexes, complete Phase 3 index consolidation"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 3D — Task 88] — YYYY-MM-DD

### Completed

- Task 88: Phase 3 Firestore Indexes
- Added gymCheckins (userId ASC, expiresAt DESC) composite index
- Added gymCheckins (city ASC, expiresAt DESC) composite index
- Confirmed all prior Phase 3 indexes (events x2, admin_queue, flags) present and unduplicated

### Files Created

- None

### Files Modified

- firestore.indexes.json: two gymCheckins composite indexes added

### Architecture Decisions

- [Any non-obvious choice made and why]

### Conflict Risks Introduced

- None — this is the final Phase 3 index task; no further Phase 3 tasks touch firestore.indexes.json

### Known Issues / Deferred

- [Anything intentionally left incomplete]

### Verification

- node -e JSON.parse validation passes
- npx tsc --noEmit passes
- git diff --check passes

### Next Up

- Phase 3 complete — run the PHASE 3 DONE CHECKLIST in TASKS_PHASE3.md before declaring Phase 3 shipped
```

Then come to claude.ai with the updated CHANGELOG.md. This is the last task in TASKS_PHASE3.md —
no further task prompt will be generated until Phase 4 planning begins.

---

## Reasoning Level

Low
