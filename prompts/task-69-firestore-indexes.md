# CODEX PROMPT — Task 69: Phase 2 Firestore Indexes

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2 is complete in all areas except this final infrastructure task. The full Phase 2
feature set is now live: premium subscriptions (Tasks 50–54), server-side swipe enforcement
(Task 55), photo verification (Tasks 56–58), fitness integrations (Tasks 59–64), auth
production fixes (Tasks 65–67), and Firestore security hardening (Task 68).

**This task has one file and one purpose:** add Phase 2 composite indexes to
`firestore.indexes.json`. No TypeScript files, no component files, no Cloud Functions, and
no `firestore.rules` are touched.

Relevant existing files Codex must read before writing anything:

- `firestore.indexes.json` — currently contains the three Phase 1 composite indexes from
  Task 40; these must be preserved exactly as they are
- `functions/src/getDiscoveryStack.ts` — queries `/users` with Phase 2 scoring fields
  (`premium.active`, `photoVerified`); the first new index directly supports this query
- `store/fitnessStore.ts` — `fetchTodayStats()` reads `fitnessTracking.todayStats.updatedAt`
  to determine "Active today" badge eligibility; the second new index supports this query
- `firestore.rules` — **read only for reference**; Task 68 is complete and must not be
  reopened

**The Phase 1 indexes that must remain intact and unchanged:**

```json
[
  {
    "collectionGroup": "users",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "location.city",  "order": "ASCENDING"  },
      { "fieldPath": "banned",          "order": "ASCENDING"  },
      { "fieldPath": "paused",          "order": "ASCENDING"  },
      { "fieldPath": "lastActive",      "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "matches",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "users",           "arrayConfig": "CONTAINS" },
      { "fieldPath": "lastMessageAt",   "order": "DESCENDING"     }
    ]
  },
  {
    "collectionGroup": "likes",
    "queryScope": "COLLECTION_GROUP",
    "fields": [
      { "fieldPath": "swiperId",   "order": "ASCENDING"  },
      { "fieldPath": "createdAt",  "order": "DESCENDING" }
    ]
  }
]
```

**Phase 2 indexes to add (two new entries in the `indexes` array):**

1. **Priority profile boosting index** — used by `getDiscoveryStack` to sort the discovery
   candidate pool when boosting premium users (`premium.active ASC`) and scoring for
   `photoVerified`. Fields: `premium.active` ASC, `location.city` ASC, `banned` ASC,
   `paused` ASC, `lastActive` DESC. Collection: `users`, scope: `COLLECTION`.

2. **Active today badge index** — used by `fitnessStore.fetchTodayStats()` and display
   logic in `SwipeCard`, `FullProfileModal`, and `ProfileScreen` to identify users with a
   fresh fitness sync. Fields: `fitnessTracking.shareOnProfile` ASC,
   `fitnessTracking.todayStats.updatedAt` DESC. Collection: `users`, scope: `COLLECTION`.

**No `fieldOverrides` entries are required for this task.** The `fieldOverrides` array must
remain an empty array `[]` unless it already contains entries — do not remove any existing
overrides.

---

## Task 69 — Phase 2 Firestore Indexes

**Files to modify:**
- `firestore.indexes.json` — add two Phase 2 composite indexes while preserving all three
  Phase 1 indexes exactly

**Files to create:** none

---

### `firestore.indexes.json` — Update

> This file defines all Firestore composite indexes. Firebase CLI reads it on
> `firebase deploy --only firestore:indexes`. The complete final file is specified below.
> Replace the file contents in full — do not attempt a partial merge.

The complete, final `firestore.indexes.json` after this task:

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "location.city", "order": "ASCENDING"  },
        { "fieldPath": "banned",        "order": "ASCENDING"  },
        { "fieldPath": "paused",        "order": "ASCENDING"  },
        { "fieldPath": "lastActive",    "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "matches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "users",         "arrayConfig": "CONTAINS" },
        { "fieldPath": "lastMessageAt", "order": "DESCENDING"     }
      ]
    },
    {
      "collectionGroup": "likes",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "swiperId",  "order": "ASCENDING"  },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "premium.active", "order": "ASCENDING"  },
        { "fieldPath": "location.city",  "order": "ASCENDING"  },
        { "fieldPath": "banned",         "order": "ASCENDING"  },
        { "fieldPath": "paused",         "order": "ASCENDING"  },
        { "fieldPath": "lastActive",     "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "fitnessTracking.shareOnProfile",       "order": "ASCENDING"  },
        { "fieldPath": "fitnessTracking.todayStats.updatedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

> Do not touch `firestore.rules`. Do not touch any TypeScript file. Do not touch any
> Cloud Function. Do not touch any component file. The only file that changes in this task
> is `firestore.indexes.json`.

---

## Important Architecture Notes for Codex

1. **Preserve Phase 1 indexes verbatim.** The three indexes from Task 40 (`users` by
   `location.city`/`banned`/`paused`/`lastActive`, `matches` by `users`/`lastMessageAt`,
   and `likes` by `swiperId`/`createdAt`) must appear in the output `indexes` array
   unchanged. Removing or reordering their fields would break `getDiscoveryStack` and the
   Matches screen listener.

2. **Index field order within each entry is significant.** Firestore composite index field
   order determines which queries the index satisfies. The field order listed in each index
   object in the spec above is canonical — do not sort fields alphabetically or reorder them.

3. **`queryScope` must be exact.** The `likes` index uses `"COLLECTION_GROUP"` because
   `likes` is a subcollection (`/swipes/{userId}/likes/{targetId}`). All `users` and
   `matches` indexes use `"COLLECTION"`. Swapping these values causes deployment failure.

4. **Field path notation for nested fields.** Nested Firestore fields are expressed with
   dot notation in `fieldPath` strings: `"premium.active"`, `"location.city"`,
   `"fitnessTracking.shareOnProfile"`, `"fitnessTracking.todayStats.updatedAt"`. Do not use
   bracket notation or separate objects for nested paths.

5. **`arrayConfig` vs `order`.** Fields used with `array-contains` queries (the `users`
   array in the `matches` collection) use `"arrayConfig": "CONTAINS"` instead of an
   `"order"` property. Do not add an `"order"` key to those fields and do not add
   `"arrayConfig"` to non-array fields.

6. **`fieldOverrides` array must be present and empty.** The Firebase CLI requires the
   `fieldOverrides` key in the root object. It must be `[]` unless pre-existing overrides
   are already in the file. Do not omit it and do not populate it speculatively.

7. **No TypeScript, no source files, no rules.** This task touches exactly one file:
   `firestore.indexes.json`. If Codex finds itself editing any `.ts`, `.tsx`, `.rules`, or
   other file, that is scope drift and must stop immediately.

---

## Acceptance Criteria

- [ ] `firestore.indexes.json` is valid JSON — `JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'))` succeeds with no error
- [ ] The `indexes` array contains exactly **5** entries — 3 from Phase 1 and 2 new ones
- [ ] Phase 1 index 1 is present: `collectionGroup: "users"`, 4 fields — `location.city` ASC, `banned` ASC, `paused` ASC, `lastActive` DESC — `queryScope: "COLLECTION"`
- [ ] Phase 1 index 2 is present: `collectionGroup: "matches"`, 2 fields — `users` ARRAY_CONTAINS, `lastMessageAt` DESC — `queryScope: "COLLECTION"`
- [ ] Phase 1 index 3 is present: `collectionGroup: "likes"`, 2 fields — `swiperId` ASC, `createdAt` DESC — `queryScope: "COLLECTION_GROUP"`
- [ ] Phase 2 index 1 is present: `collectionGroup: "users"`, 5 fields — `premium.active` ASC, `location.city` ASC, `banned` ASC, `paused` ASC, `lastActive` DESC — `queryScope: "COLLECTION"`
- [ ] Phase 2 index 2 is present: `collectionGroup: "users"`, 2 fields — `fitnessTracking.shareOnProfile` ASC, `fitnessTracking.todayStats.updatedAt` DESC — `queryScope: "COLLECTION"`
- [ ] `fieldOverrides` key is present at the root level and its value is `[]`
- [ ] Running `firebase deploy --only firestore:indexes --dry-run` (or emulator equivalent) exits with code 0
- [ ] No `.ts`, `.tsx`, `.rules`, or other source file has been modified

---

## Do Not Touch

`firestore.rules`, `App.tsx`, `store/authStore.ts`, `store/discoveryStore.ts`,
`store/fitnessStore.ts`, `services/firebase/config.ts`, `services/firebase/firestore.ts`,
`functions/src/getDiscoveryStack.ts`, `types/user.ts`, `types/fitness.ts`,
`constants/`, `i18n/`, `components/`, `app/`, `hooks/`

---

## Commit

```
git commit -m "task-69: add phase 2 firestore composite indexes"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2F — Task 69] — YYYY-MM-DD

### Completed

- Task 69: Phase 2 Firestore composite indexes added to firestore.indexes.json
- Priority profile boosting index: users (premium.active ASC, location.city ASC, banned ASC, paused ASC, lastActive DESC) — supports getDiscoveryStack premium boosting
- Active today badge index: users (fitnessTracking.shareOnProfile ASC, fitnessTracking.todayStats.updatedAt DESC) — supports Active today badge in SwipeCard, FullProfileModal, and ProfileScreen
- All three Phase 1 indexes preserved unchanged

### Files Created / Modified

- firestore.indexes.json: 2 new composite indexes appended; Phase 1 indexes unchanged; fieldOverrides remains []

### Architecture Decisions

- Priority profile index leads with premium.active to allow getDiscoveryStack to efficiently filter and sort the premium-boosted candidate set before applying location and activity filters
- Active today badge index uses fitnessTracking.shareOnProfile as the leading field because the query always filters on shareOnProfile === true before ordering by updatedAt
- No fieldOverrides entries added; Firestore default indexing behaviour for individual fields is sufficient for all single-field queries in the codebase

### Known Issues / Deferred

- Index propagation to production takes up to 10 minutes after firebase deploy; the emulator reflects indexes immediately
- RTDB security rules remain out of scope (deferred to Phase 3)

### Next Up

- Phase 2 is now complete. Review the PHASE 2 DONE CHECKLIST in TASKS_PHASE2.md before
  declaring the build ready for App Store / Play Store submission.
- Begin TASKS_PHASE3.md planning session when ready.
```

Then come to claude.ai with the updated CHANGELOG.md to begin Phase 3 planning.

---

## Reasoning Level

Low — single JSON file, no logic branching, no async operations, no TypeScript.
The spec is fully deterministic: the output file is written in full above.
