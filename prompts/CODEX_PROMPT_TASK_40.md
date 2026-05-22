# CODEX PROMPT — Task 40
# Firestore Indexes

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1F in progress. Task 39 (Firestore security rules) and Task 39B (unmatch Cloud Function remediation) are complete. Relevant existing files:

- `firestore.rules` — production security rules for all Phase 1 collections, fully deployed
- `firebase.json` — already references `firestore.rules` and `firestore.indexes.json`; the indexes file itself currently only has the scaffold stub Expo/Firebase CLI generated (empty or near-empty rules array)
- `functions/src/getDiscoveryStack.ts` — queries `/users` using a composite filter on `location.city`, `banned`, `paused`, `lastActive`; this query **requires** the composite index defined in this task or it will fail at runtime with a Firestore index error
- `functions/src/onSwipeCreated.ts` — reads `/swipes/{targetId}/likes/{userId}` (single-document get, no composite index needed)
- `store/matchStore.ts` — Firestore listener queries `/matches` with `array-contains` on `users` field, ordered by `lastMessageAt` DESC
- `store/discoveryStore.ts` — calls `getDiscoveryStack` Cloud Function; does not query Firestore directly
- `services/firebase/firestore.ts` — `getDailyLikesCount` reads the `users/{userId}/dailyLikes` document (no composite index needed — single-document get)

Task 40 writes the production `firestore.indexes.json` covering all queries that require composite indexes across the Phase 1 feature set.

---

## Task 40 — Firestore Indexes

**Files to create or replace:**
- `firestore.indexes.json`

No other files should be created or modified in this task.

---

### Index Requirements Analysis

Walk through every Firestore query in the Phase 1 codebase and identify which require composite indexes:

#### 1. Discovery Stack — `/users` collection
**Query (in `getDiscoveryStack` Cloud Function):**
```typescript
query(
  collection(db, 'users'),
  where('location.city', '==', city),
  where('banned', '==', false),
  where('paused', '==', false),
  orderBy('lastActive', 'desc'),
  limit(100)
)
```
**Index required:** Yes — composite index on `location.city` (ASC), `banned` (ASC), `paused` (ASC), `lastActive` (DESC).

This is the most performance-critical index in the app. Discovery stack fetch speed depends on it. Without it, Firestore throws a `requires an index` error at runtime and returns no results.

#### 2. Matches List — `/matches` collection
**Query (in `matchStore.subscribeToMatches`):**
```typescript
query(
  collection(db, 'matches'),
  where('users', 'array-contains', userId),
  orderBy('lastMessageAt', 'desc')
)
```
**Index required:** Yes — composite index on `users` (ARRAY_CONTAINS) and `lastMessageAt` (DESC).

#### 3. Swipes — `/swipes/{userId}/likes` subcollection
**Query (if querying swipes for seen-users exclusion in `getDiscoveryStack`):**
```typescript
query(
  collection(db, `swipes/${userId}/likes`),
  orderBy('createdAt', 'desc')
)
```
**Index required:** Single-field index only — Firestore auto-indexes `createdAt` on single-field orderBy. No composite index needed unless a `where` clause is added alongside `orderBy`. Define a single-field override here to ensure it is explicitly managed and not accidentally dropped by Firestore auto-index changes.

#### 4. Reports — `/reports` collection
**Query (in `checkReportThreshold` Cloud Function):**
```typescript
query(
  collection(db, 'reports'),
  where('reportedUserId', '==', reportedUserId),
  where('reportedAt', '>=', oneDayAgo)
)
```
**Index required:** Yes — composite index on `reportedUserId` (ASC) and `reportedAt` (ASC).

#### 5. No additional indexes needed for:
- `/users/{userId}/dailyLikes` — single-document get, no index needed
- `/swipes/{userId}/passes/{targetId}` — single-document get
- `/matches/{matchId}/messages/{messageId}` — RTDB, not Firestore
- `/blocked` — collection is Admin SDK only, no client queries in Phase 1

---

### `firestore.indexes.json`

Replace the file entirely with the following:

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "location.city", "order": "ASCENDING" },
        { "fieldPath": "banned",        "order": "ASCENDING" },
        { "fieldPath": "paused",        "order": "ASCENDING" },
        { "fieldPath": "lastActive",    "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "matches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "users",          "arrayConfig": "CONTAINS" },
        { "fieldPath": "lastMessageAt",  "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "reportedUserId", "order": "ASCENDING" },
        { "fieldPath": "reportedAt",     "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": [
    {
      "collectionGroup": "likes",
      "queryScope": "COLLECTION_GROUP",
      "fieldPath": "createdAt",
      "indexes": [
        { "order": "ASCENDING",  "queryScope": "COLLECTION" },
        { "order": "DESCENDING", "queryScope": "COLLECTION" }
      ]
    }
  ]
}
```

#### Notes on each entry

**`users` composite index**
- `location.city` is a nested field path — Firestore supports dotted paths in `fieldPath`, no special escaping needed
- `banned` and `paused` are both boolean equality filters; they must appear in the index before the `orderBy` field
- `lastActive` is DESCENDING so the most recently active users appear first in the discovery stack — this is the correct sort order per the scoring algorithm in `getDiscoveryStack`
- All four fields are needed together because the query uses `where` on three fields AND `orderBy` on a fourth

**`matches` composite index**
- `arrayConfig: "CONTAINS"` corresponds to the `array-contains` operator used by `matchStore.subscribeToMatches`
- `lastMessageAt` DESCENDING puts conversations with the most recent message first in the Messages tab list
- This index also serves the Matches tab grid query (same listener, same collection query)

**`reports` composite index**
- `reportedAt` uses ASCENDING because the `checkReportThreshold` Cloud Function uses a `>=` range filter (range queries require the range field to be last in the index)
- Both fields ASCENDING matches Firestore's requirement: equality fields first, then the range field

**`likes` field override (subcollection)**
- `queryScope: "COLLECTION_GROUP"` lets Firestore queries span all `likes` subcollections under any `swipes/{userId}` parent — useful if the discovery exclusion logic ever queries across users
- Both ASCENDING and DESCENDING overrides are listed so the index covers `orderBy('createdAt', 'asc')` and `orderBy('createdAt', 'desc')` without needing a separate composite entry

---

### Deployment

After Codex writes this file, run from the project root:

```bash
firebase deploy --only firestore:indexes
```

Expected output:
```
✔  firestore: deployed indexes in firestore.indexes.json
```

If the index on `/users` is new (hasn't been built before), Firebase will show status `BUILDING` in the console. The index becomes usable once it reaches `READY` — this typically takes 1–5 minutes for an empty dev database, longer in production with existing data.

To monitor index build status:
```bash
firebase firestore:indexes
```

Or in the Firebase Console: Firestore → Indexes tab → Composite.

> **Do not deploy security rules in this task.** `firebase deploy --only firestore:indexes` deploys indexes only. `firestore.rules` was deployed in Task 39 and must not be overwritten by running `firebase deploy --only firestore` (which deploys both).

---

## Acceptance Criteria

- [ ] `firestore.indexes.json` contains exactly 3 composite indexes and 1 field override
- [ ] `users` index covers `location.city` ASC + `banned` ASC + `paused` ASC + `lastActive` DESC
- [ ] `matches` index covers `users` ARRAY_CONTAINS + `lastMessageAt` DESC
- [ ] `reports` index covers `reportedUserId` ASC + `reportedAt` ASC
- [ ] `likes` field override covers `createdAt` in both ASCENDING and DESCENDING for COLLECTION_GROUP scope
- [ ] JSON is valid — `npx firebase deploy --only firestore:indexes --dry-run` (or equivalent) shows no parse errors
- [ ] No other files have been created or modified
- [ ] `tsc --noEmit` still passes (this task has no TypeScript changes, but confirm no regressions)

## Do Not Touch

`firestore.rules`, `functions/src/`, `store/`, `services/`, `components/`, `app/`, `types/`, `constants/`, `i18n/`, `App.tsx`, `firebase.json`, `package.json`, `tsconfig.json`, `babel.config.js`

## Commit

```
git commit -m "task-40: firestore composite indexes for discovery, matches, and reports"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1F — Task 40] — YYYY-MM-DD

### Completed

- Task 40: Firestore composite indexes defined for all Phase 1 collection queries
- Users discovery index: location.city + banned + paused + lastActive DESC (critical for getDiscoveryStack performance)
- Matches index: users ARRAY_CONTAINS + lastMessageAt DESC (powers matchStore real-time listener)
- Reports index: reportedUserId + reportedAt ASC (powers checkReportThreshold range query)
- Likes subcollection field override: createdAt ASC + DESC, COLLECTION_GROUP scope

### Files Created / Modified

- firestore.indexes.json: replaced stub with 3 composite indexes + 1 field override

### Architecture Decisions

- Nested field path `location.city` confirmed valid in Firestore index fieldPath — no flattening needed
- Boolean equality filters (banned, paused) placed before orderBy field (lastActive) per Firestore composite index ordering requirements
- COLLECTION_GROUP scope on likes/createdAt future-proofs cross-user swipe queries
- Reports range filter on reportedAt placed last in index per Firestore range-field rule

### Known Issues / Deferred

- Index build time in production (with real user data) may be 10–30+ minutes — monitor in Firebase Console before going live
- RTDB indexes (chat message ordering) are not Firestore indexes and are not in scope here

### Next Up

- Task 41: LoadingOverlay, ErrorBoundary, Toast components (UI polish)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 41 prompt.

---

## Reasoning Level
Low
