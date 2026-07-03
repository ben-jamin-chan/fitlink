@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**
- None. Task 86 has no declared dependencies — `checkReportThreshold.ts` and `moderatePhoto.ts`
  are both stable Phase 1 Cloud Functions, untouched since their original implementation.

> No dependency verification needed before starting. Proceed directly.

---

## Context

- `functions/src/checkReportThreshold.ts` — Phase 1 Firestore trigger on `/reports`; auto-bans
  users once report count crosses a threshold; currently writes to `/admin_queue` without a
  `status` field
- `functions/src/moderatePhoto.ts` — Phase 1 Storage trigger; scans new photo uploads for
  explicit content via Cloud Vision; currently writes to `/flags` without a `status` field
- `firestore.rules` — currently has explicit rule blocks for `/events`, `/gymCheckins`,
  `/users/{uid}/notificationPreferences`, server-only field guards on `/users/{uid}`, and a
  default catch-all deny. **No existing block for `/admin_queue` or `/flags`** — these
  collections currently fall through to the default deny, which is safe but not explicit.
- `firestore.indexes.json` — currently has composite indexes for `/users` (discovery query),
  `/matches`, `/reports`, `/swipes` collection group, and `/events` (added in Task 80).
  **No existing indexes for `/admin_queue` or `/flags`.**

**Architectural boundary:** This task does not touch the admin moderation web dashboard (that
is Phase 4, out of scope). This task only hardens the two Cloud Functions that *write* to
these collections and secures the collections themselves at the rules/index level. Do not
build any read-side UI or admin screen.

**No recent Phase 3 task has modified `checkReportThreshold.ts`, `moderatePhoto.ts`,
`/admin_queue` rules, or `/flags` rules.** `firestore.rules` and `firestore.indexes.json`
have both been modified by recent tasks (84, 80, 79, 74) for unrelated collections — **do not
remove or alter any existing rule blocks or indexes**, including the `/events`,
`/gymCheckins`, and `notificationPreferences` blocks added in Tasks 80, 79, and 84. Append
only.

---

## Task 86 — Admin Moderation Queue: Harden & Secure

**Files to create:**
- None

**Files to modify:**
- `functions/src/checkReportThreshold.ts` — add `status: 'pending'` to every `/admin_queue` write; add an inline type interface for the queue document shape
- `functions/src/moderatePhoto.ts` — add `status: 'pending'` to every `/flags` write; add an inline type interface for the flag document shape
- `firestore.rules` — add explicit deny-all blocks for `/admin_queue/{docId}` and `/flags/{docId}`
- `firestore.indexes.json` — add composite indexes for `/admin_queue` and `/flags`

---

### `functions/src/checkReportThreshold.ts` — Update

> Locate the existing write(s) to the `/admin_queue` collection inside this trigger. Add
> `status: 'pending'` to the written object. Add an inline interface directly above the
> function describing the admin queue document shape — do not import this type from `types/`,
> per the task spec (inline only, scoped to this file).

```typescript
// Add directly above the function, or near the top of the file after imports:
interface AdminQueueEntry {
  reportedUserId: string
  reportCount: number
  status: 'pending' | 'reviewed' | 'actioned'
  createdAt: admin.firestore.FieldValue
  // Preserve any other fields already present in the existing write — this interface
  // documents the shape, it does not replace fields that already exist in the function.
}

// In the existing write to /admin_queue, add the status field:
await admin.firestore().collection('admin_queue').add({
  // ...existing fields already present in this write — do not remove any,
  status: 'pending',
} satisfies AdminQueueEntry)
```

> Do not change the trigger's threshold logic, the ban-write logic, or any other behavior.
> This task only adds the `status` field to the existing `/admin_queue` write(s) and documents
> the shape with an inline interface. If the function writes to `/admin_queue` in more than
> one place, add `status: 'pending'` to every write site.

---

### `functions/src/moderatePhoto.ts` — Update

> Same pattern as above, applied to the existing write(s) to the `/flags` collection.

```typescript
// Add directly above the function, or near the top of the file after imports:
interface FlagEntry {
  userId: string
  photoUrl: string
  reason: string
  status: 'pending' | 'reviewed' | 'actioned'
  createdAt: admin.firestore.FieldValue
  // Preserve any other fields already present in the existing write.
}

// In the existing write to /flags, add the status field:
await admin.firestore().collection('flags').add({
  // ...existing fields already present in this write — do not remove any,
  status: 'pending',
} satisfies FlagEntry)
```

> Do not change the Cloud Vision moderation logic, the photo scanning trigger condition, or
> any other behavior. This task only adds the `status` field and documents the shape with an
> inline interface. If the function writes to `/flags` in more than one place, add
> `status: 'pending'` to every write site.

---

### `firestore.rules` — Update

> Insert these two blocks. Place them near the other Phase 3 collection blocks (alongside
> `/events`, `/gymCheckins`, `notificationPreferences`), before the final default catch-all
> deny rule. Do not touch the default catch-all itself, and do not touch any existing block.

```
match /admin_queue/{docId} {
  allow read, write: if false;
}

match /flags/{docId} {
  allow read, write: if false;
}
```

> These collections are Admin SDK only — Cloud Functions write to them using the Admin SDK,
> which bypasses Firestore security rules entirely. The explicit `if false` here is not what
> permits the Cloud Function writes; it exists to make the deny posture explicit and
> self-documenting rather than relying on the implicit fallthrough to the default deny rule.
> Do not add any `read` exception for authenticated users, even moderators — there is no
> moderator role in this schema. The Phase 4 admin dashboard will use a separate
> Admin-SDK-backed API, not direct client Firestore reads.

---

### `firestore.indexes.json` — Update

> Add these two composite indexes to the existing `indexes` array. Do not remove or reorder
> any existing index, and do not touch the existing `fieldOverrides` array.

```json
{
  "collectionGroup": "admin_queue",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "flags",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

> These indexes are forward-looking — they support the Phase 4 admin dashboard's eventual
> "pending items, most recent first" query. No code in this task queries `/admin_queue` or
> `/flags` directly; the indexes are added now so they are available without a rebuild delay
> when Phase 4 starts.

---

## Important Architecture Notes for Codex

1. **Admin SDK bypasses rules — the `if false` blocks are a documentation/defense-in-depth
   measure, not the actual write mechanism.** `checkReportThreshold` and `moderatePhoto` both
   run as Cloud Functions using the Admin SDK, which is not subject to `firestore.rules` at
   all. Do not be confused into thinking the rule change enables or blocks the Cloud Function
   writes — it only governs client SDK access, which should remain fully denied.

2. **Do not introduce a moderator role or claim-based access.** There is no admin/moderator
   user role anywhere in this schema (see `types/user.ts` — no `role` or `isAdmin` field
   exists). Do not invent one to "allow moderators to read" — that is out of scope and would
   require a schema change this task does not authorize.

3. **Inline interfaces only — do not create or modify any file under `types/`.** The task
   spec is explicit that these interfaces live inline in each Cloud Function file, not in
   `types/`. This mirrors the existing pattern in this codebase where Cloud-Function-internal
   shapes are not always promoted to shared types.

4. **Preserve every existing field in both write calls.** This task adds exactly one field
   (`status: 'pending'`) to each existing write. Do not refactor, rename, or restructure any
   other field already being written by `checkReportThreshold.ts` or `moderatePhoto.ts`.

5. **`firestore.rules` block placement.** Insert the two new blocks before the final default
   deny-all rule (typically `match /{document=**} { allow read, write: if false; }` at the
   bottom of the file). Rules are evaluated by first match per path segment — placement
   relative to unrelated collection blocks (`/events`, `/gymCheckins`, etc.) does not matter,
   but the new blocks must come before the generic catch-all for clarity, even though Firestore
   rules don't require ordering for non-overlapping path matchers.

6. **`firestore.indexes.json` — do not break the existing `fieldOverrides` array or any
   existing composite index.** Use `node -e "JSON.parse(...)"` to validate the file parses
   after your edit, per the Acceptance Criteria below.

---

## Rollback Protocol

If `npx tsc --noEmit` or `npm --prefix functions run build` produces errors that cannot be
resolved without modifying a file in the "Do Not Touch" list, or making an unverifiable
assumption about the existing write structure in either Cloud Function:

1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the conflicting file, the exact error,
   and what information is needed to proceed
4. Stop. Do not attempt a workaround. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] `npm --prefix functions run build` — zero errors
- [ ] Zero `any` types introduced
- [ ] Zero type assertions (`as X`) without an explanatory comment (note: `satisfies` is not
      a type assertion and does not require a comment)

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` introduced
- [ ] Zero relative imports (`../../`) introduced
- [ ] No i18n changes required for this task (no user-facing strings touched) — confirm none
      were accidentally added

**Firebase / Security**
- [ ] Every `/admin_queue` write in `checkReportThreshold.ts` includes `status: 'pending'`
- [ ] Every `/flags` write in `moderatePhoto.ts` includes `status: 'pending'`
- [ ] `firestore.rules` denies all client read/write on `/admin_queue/{docId}` and
      `/flags/{docId}` — no exceptions, no moderator role added
- [ ] No existing `firestore.rules` block was altered, removed, or reordered in a way that
      changes its meaning — diff the file and confirm `/events`, `/gymCheckins`,
      `notificationPreferences`, and the server-only field guards are untouched
- [ ] `firestore.indexes.json` is valid JSON after the edit
- [ ] No existing index or `fieldOverrides` entry was removed

**Architecture**
- [ ] No new file created under `types/`
- [ ] No `role` or `isAdmin` field added anywhere
- [ ] Files in the "Do Not Touch" list were not modified

---

## Acceptance Criteria

- [ ] `checkReportThreshold.ts` writes `status: 'pending'` on every `/admin_queue` document
      creation; all pre-existing fields in that write are preserved unchanged
- [ ] `moderatePhoto.ts` writes `status: 'pending'` on every `/flags` document creation; all
      pre-existing fields in that write are preserved unchanged
- [ ] Both functions have an inline interface (not imported from `types/`) documenting the
      written document shape
- [ ] `firestore.rules` contains explicit `match /admin_queue/{docId} { allow read, write: if
      false; }` and `match /flags/{docId} { allow read, write: if false; }` blocks
- [ ] `firestore.indexes.json` contains a composite index for `admin_queue` on
      `(status ASC, createdAt DESC)` and for `flags` on `(status ASC, createdAt DESC)`
- [ ] `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"` prints `valid`
- [ ] `npm --prefix functions run build` passes with zero errors
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `types/user.ts`, `types/`
(no new files added here for this task), `constants/`, `i18n/` (no new keys needed for this
task), any existing rule block in `firestore.rules` other than the two new additions
(`/events`, `/gymCheckins`, `/users/{uid}/notificationPreferences`, server-only field guards,
the default catch-all), any existing index or `fieldOverrides` entry in
`firestore.indexes.json`, the Cloud Vision moderation logic in `moderatePhoto.ts`, the
auto-ban threshold logic in `checkReportThreshold.ts`.

---

## Commit

```
git commit -m "task-86: harden and secure admin moderation queue"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 3D — Task 86] — YYYY-MM-DD

### Completed

- Task 86: Admin Moderation Queue: Harden & Secure
- [What was built — one line per major deliverable]

### Files Created

- None

### Files Modified

- functions/src/checkReportThreshold.ts: [what changed]
- functions/src/moderatePhoto.ts: [what changed]
- firestore.rules: [what changed]
- firestore.indexes.json: [what changed]

### Architecture Decisions

- [Any non-obvious choice made and why]

### Conflict Risks Introduced

- [Any file this task modified that an upcoming task also touches — Task 87 consolidates
  rules and depends on this task's /admin_queue and /flags blocks being present; Task 88
  depends on this task's indexes being present]

### Known Issues / Deferred

- [Anything intentionally left incomplete]

### Next Up

- Task 87: Phase 3 Firestore Security Rules Update
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

Medium
