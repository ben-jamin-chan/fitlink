# CODEX PROMPT — Task 23
# Cloud Function: getDiscoveryStack

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3.1 complete. Relevant existing files:
- `functions/src/index.ts` — admin SDK init guard exists; currently exports only `onUserCreated`; Task 23 adds `getDiscoveryStack` to this export list
- `functions/src/onUserCreated.ts` — reference implementation for 2nd gen callable/trigger pattern and TypeScript strict style inside the functions package
- `functions/package.json` — Node.js 18, `firebase-admin ^12`, `firebase-functions ^4`, TypeScript strict, compiled to `functions/lib/`
- `functions/tsconfig.json` — strict mode, commonjs output, `noImplicitAny: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- `types/user.ts` — `UserProfile`, `FitnessLevel`, `Gender` types; Codex must NOT import from `@/types/` inside the functions package — duplicate the minimal types needed locally or use plain string comparisons
- `firestore.indexes.json` — composite index `(location.city, banned, paused, lastActive DESC)` must already exist here (if absent, Codex adds it)
- `services/firebase/firestore.ts` — client-side only; Cloud Functions use `admin.firestore()` exclusively
- PRD.md Section 5.3 — canonical scoring algorithm; Codex implements it exactly as specified

This function is the core of the discovery engine. It runs entirely server-side. The client calls it via `httpsCallable` from `discoveryStore` (Task 25). The function must not trust any data from the client request beyond the caller's authenticated UID.

---

## Task 23 — Cloud Function: getDiscoveryStack

**Files to create:**
- `functions/src/getDiscoveryStack.ts`

**Files to modify:**
- `functions/src/index.ts` — add `getDiscoveryStack` export
- `firestore.indexes.json` — ensure required composite index is present

---

### Architecture Overview

```
Client (discoveryStore)
  └─ httpsCallable('getDiscoveryStack')
       └─ functions/src/getDiscoveryStack.ts
            ├─ Authenticate caller
            ├─ Read caller's UserProfile from Firestore
            ├─ Query /users (city + banned + paused filters)
            ├─ Fetch already-liked, already-passed, matched, blocked IDs
            ├─ Filter candidates
            ├─ Score each remaining candidate
            └─ Return top 20 userIds sorted by score DESC
```

**Critical constraints:**
- This is a 2nd gen HTTP callable function — import from `firebase-functions/v2/https`, not `firebase-functions`
- Region: `asia-southeast1`
- Max candidates queried from Firestore before scoring: 100
- Max candidates returned to client: 20
- Never return the caller's own UID in results
- Age and gender filtering must be bidirectional (both users must meet each other's criteria)

---

### `functions/src/getDiscoveryStack.ts`

```typescript
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

// ---------------------------------------------------------------------------
// Local types (mirrors types/user.ts — do not import from @/ inside functions)
// ---------------------------------------------------------------------------

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'athlete'

interface UserLocation {
  city: string
  country: string
  coordinates: admin.firestore.GeoPoint
}

interface UserPreferences {
  ageRange: { min: number; max: number }
  distanceKm: number
  genders: string[]
}

interface UserStats {
  likes: number
  passes: number
  matches: number
}

interface UserSubscription {
  tier: 'free' | 'premium'
  expiresAt?: admin.firestore.Timestamp
}

interface FirestoreUser {
  uid: string
  firstName: string
  age: number
  gender: string
  location: UserLocation
  photos: string[]
  activities: string[]
  fitnessLevel: FitnessLevel
  workoutFrequency: string
  dietaryPreference: string
  fitnessGoals: string[]
  preferences: UserPreferences
  stats: UserStats
  subscription: UserSubscription
  verified: boolean
  paused: boolean
  banned: boolean
  lastActive: admin.firestore.Timestamp
  photoVerified?: boolean
}

// ---------------------------------------------------------------------------
// Response shape returned to the client
// ---------------------------------------------------------------------------

interface DiscoveryCandidate {
  userId: string
  score: number   // stripped before production — useful for debugging now
}

interface DiscoveryStackResponse {
  candidates: DiscoveryCandidate[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUERY_LIMIT = 100     // max candidates fetched from Firestore before scoring
const RETURN_LIMIT = 20     // max candidates returned to client
const FITNESS_LEVELS: FitnessLevel[] = ['beginner', 'intermediate', 'advanced', 'athlete']

// ---------------------------------------------------------------------------
// Scoring algorithm (PRD.md Section 5.3)
// ---------------------------------------------------------------------------

function scoreCandidate(caller: FirestoreUser, candidate: FirestoreUser): number {
  let score = 0

  // Shared fitness activities — highest weight (10 pts each)
  const sharedActivities = caller.activities.filter(a =>
    candidate.activities.includes(a)
  )
  score += sharedActivities.length * 10

  // Compatible fitness level (±1 level = 5 pts)
  const callerLevel = FITNESS_LEVELS.indexOf(caller.fitnessLevel)
  const candidateLevel = FITNESS_LEVELS.indexOf(candidate.fitnessLevel)
  if (callerLevel !== -1 && candidateLevel !== -1) {
    if (Math.abs(callerLevel - candidateLevel) <= 1) {
      score += 5
    }
  }

  // Similar workout frequency (3 pts)
  if (caller.workoutFrequency === candidate.workoutFrequency) {
    score += 3
  }

  // Recently active boost
  const nowMs = Date.now()
  const lastActiveMs = candidate.lastActive.toMillis()
  const hoursSinceActive = (nowMs - lastActiveMs) / 3_600_000
  if (hoursSinceActive < 24) {
    score += 5
  } else if (hoursSinceActive < 168) {
    score += 2
  }

  // Premium user boost (monetisation incentive — 3 pts)
  if (candidate.subscription?.tier === 'premium') {
    score += 3
  }

  // Verified profile trust signal (2 pts)
  if (candidate.photoVerified === true) {
    score += 2
  }

  // Shared dietary preference (2 pts — skip 'No preference')
  if (
    caller.dietaryPreference === candidate.dietaryPreference &&
    caller.dietaryPreference !== 'No preference' &&
    caller.dietaryPreference !== ''
  ) {
    score += 2
  }

  // Looking-for overlap (3 pts) — accessed via preferences on the caller doc
  // candidate.preferences.lookingFor not in schema; this field is `lookingFor` at top level
  // (See ARCHITECT.md — lookingFor: Array<'friends' | 'workout_partners' | 'dating'>)
  // We skip this sub-score here since lookingFor is on the user root, not preferences.
  // The field is filtered separately in the filtering step below.

  return score
}

// ---------------------------------------------------------------------------
// Bidirectional age check
// ---------------------------------------------------------------------------

function meetsAgeRequirements(
  caller: FirestoreUser,
  candidate: FirestoreUser,
): boolean {
  const callerAge = caller.age
  const candidateAge = candidate.age

  // Candidate must be within caller's age preference
  const callerWantsCandidate =
    candidateAge >= caller.preferences.ageRange.min &&
    candidateAge <= caller.preferences.ageRange.max

  // Caller must be within candidate's age preference
  const candidateWantsCaller =
    callerAge >= candidate.preferences.ageRange.min &&
    callerAge <= candidate.preferences.ageRange.max

  return callerWantsCandidate && candidateWantsCaller
}

// ---------------------------------------------------------------------------
// Bidirectional gender check
// ---------------------------------------------------------------------------

function meetsGenderRequirements(
  caller: FirestoreUser,
  candidate: FirestoreUser,
): boolean {
  // Caller's gender must be in candidate's preference list
  const candidateWantsCaller = candidate.preferences.genders.some(g =>
    g === 'Everyone' || g.toLowerCase() === caller.gender.toLowerCase()
  )

  // Candidate's gender must be in caller's preference list
  const callerWantsCandidate = caller.preferences.genders.some(g =>
    g === 'Everyone' || g.toLowerCase() === candidate.gender.toLowerCase()
  )

  return callerWantsCandidate && candidateWantsCaller
}

// ---------------------------------------------------------------------------
// Fetch IDs to exclude: liked, passed, matched, blocked
// ---------------------------------------------------------------------------

async function fetchExcludedIds(
  db: admin.firestore.Firestore,
  callerId: string,
): Promise<Set<string>> {
  const excluded = new Set<string>()

  const [likedSnap, passedSnap, matchesSnap] = await Promise.all([
    db.collection('swipes').doc(callerId).collection('likes').select().get(),
    db.collection('swipes').doc(callerId).collection('passes').select().get(),
    db
      .collection('matches')
      .where('users', 'array-contains', callerId)
      .select('users')
      .get(),
  ])

  likedSnap.docs.forEach(d => excluded.add(d.id))
  passedSnap.docs.forEach(d => excluded.add(d.id))

  matchesSnap.docs.forEach(d => {
    const users = d.data().users as string[]
    users.forEach(uid => {
      if (uid !== callerId) excluded.add(uid)
    })
  })

  // Blocked users — stored as /blocked/{callerId}/{blockedUserId}
  // Only attempt if the collection exists; fail gracefully
  try {
    const blockedSnap = await db
      .collection('blocked')
      .doc(callerId)
      .collection('users')
      .select()
      .get()
    blockedSnap.docs.forEach(d => excluded.add(d.id))
  } catch {
    // blocked subcollection may not exist yet — safe to ignore
  }

  return excluded
}

// ---------------------------------------------------------------------------
// Main callable function
// ---------------------------------------------------------------------------

export const getDiscoveryStack = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest): Promise<DiscoveryStackResponse> => {
    // 1. Auth guard
    if (request.auth === undefined || request.auth === null) {
      throw new HttpsError('unauthenticated', 'Must be logged in to fetch discovery stack.')
    }

    const callerId = request.auth.uid
    const db = admin.firestore()

    // 2. Load caller's own profile
    const callerDoc = await db.collection('users').doc(callerId).get()
    if (!callerDoc.exists) {
      throw new HttpsError('not-found', 'Caller profile not found.')
    }

    const caller = callerDoc.data() as FirestoreUser

    // Guard: banned callers cannot fetch a stack
    if (caller.banned === true) {
      throw new HttpsError('permission-denied', 'Account is suspended.')
    }

    // 3. Fetch IDs to exclude
    const excludedIds = await fetchExcludedIds(db, callerId)
    excludedIds.add(callerId) // always exclude self

    // 4. Query candidates — filter by city, not banned, not paused
    //    Composite index: (location.city ASC, banned ASC, paused ASC, lastActive DESC)
    const candidatesSnap = await db
      .collection('users')
      .where('location.city', '==', caller.location.city)
      .where('banned', '==', false)
      .where('paused', '==', false)
      .orderBy('lastActive', 'desc')
      .limit(QUERY_LIMIT)
      .get()

    // 5. Filter and score
    const scored: DiscoveryCandidate[] = []

    for (const doc of candidatesSnap.docs) {
      const candidateId = doc.id

      // Skip excluded
      if (excludedIds.has(candidateId)) continue

      const candidate = doc.data() as FirestoreUser

      // Bidirectional age check
      if (!meetsAgeRequirements(caller, candidate)) continue

      // Bidirectional gender check
      if (!meetsGenderRequirements(caller, candidate)) continue

      // Score the candidate
      const score = scoreCandidate(caller, candidate)
      scored.push({ userId: candidateId, score })
    }

    // 6. Sort by score DESC, return top RETURN_LIMIT
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, RETURN_LIMIT)

    return { candidates: top }
  },
)
```

---

### `functions/src/index.ts` — Update

Add the `getDiscoveryStack` export alongside the existing `onUserCreated`:

```typescript
// Existing line:
export { onUserCreated } from './onUserCreated'

// Add:
export { getDiscoveryStack } from './getDiscoveryStack'
```

Do not modify anything else in `index.ts`.

---

### `firestore.indexes.json` — Verify / Add

Ensure the following composite index exists. If the file already has it, do not duplicate it. If it is absent, add it to the `indexes` array:

```json
{
  "collectionGroup": "users",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "location.city", "order": "ASCENDING" },
    { "fieldPath": "banned",        "order": "ASCENDING" },
    { "fieldPath": "paused",        "order": "ASCENDING" },
    { "fieldPath": "lastActive",    "order": "DESCENDING" }
  ]
}
```

Also ensure the single-collection-group exemptions for `swipes` subcollections exist (added later in Task 40, but note the dependency here). Do not add Task 40 indexes now — only the index above.

---

## Architecture Notes for Codex

1. **2nd gen callable signature.** Auth is accessed via `request.auth`, not `context.auth`. The function is imported from `firebase-functions/v2/https`. The v1 API (`functions.https.onCall(async (data, context) => …)`) must NOT be used.

2. **No `@/` imports inside `functions/`.** The functions package has its own `tsconfig.json` and compiles independently. Importing from the client-side `@/types/` path will break compilation. All types needed in this file are declared locally at the top of the file.

3. **`select()` on exclusion queries.** When fetching liked/passed/matched IDs, use `.select()` with no arguments to retrieve only document IDs and no field data. This minimises Firestore read costs significantly.

4. **lookingFor score not applied here.** The PRD scoring mentions `lookingFor` overlap (+3 pts). However, `lookingFor` is a top-level array on the user document, not under `preferences`. The Firestore query filters by city/banned/paused but not `lookingFor` (no index). The score for `lookingFor` overlap requires loading both docs — this is computationally safe since we load all candidate docs anyway. Codex should add this bonus to `scoreCandidate()` by accessing `caller.lookingFor` and `candidate.lookingFor` directly. The local `FirestoreUser` interface must include `lookingFor: string[]`.

5. **Blocked users path.** The Firestore schema for blocked users is `/blocked/{userId}/users/{blockedUserId}` (subcollection). This matches the unmatch logic in PRD.md Section 5.15. The fetch is wrapped in `try/catch` because this subcollection may not exist for most users early in Phase 1.

6. **Score returned for debugging.** The `score` field is included in the response during development. A TODO comment is acceptable noting it should be stripped before production launch. Do not build that stripping logic now.

7. **Emulator compatibility.** The function must compile and run in the Firebase Local Emulator Suite. Codex should not add any production-only config (e.g. secrets manager calls) that blocks emulator execution.

---

## Acceptance Criteria

- [ ] `functions/src/getDiscoveryStack.ts` created — compiles with `tsc --noEmit` inside `functions/`
- [ ] `functions/src/index.ts` exports `getDiscoveryStack` alongside `onUserCreated`
- [ ] `firestore.indexes.json` contains the `(location.city, banned, paused, lastActive DESC)` composite index
- [ ] Function throws `HttpsError('unauthenticated')` when called without auth
- [ ] Function throws `HttpsError('not-found')` if caller profile does not exist in Firestore
- [ ] Function throws `HttpsError('permission-denied')` if caller is banned
- [ ] Own UID is always excluded from results
- [ ] Already-liked, already-passed, and matched users are excluded from results
- [ ] Bidirectional age filtering applied (both users must be within each other's range)
- [ ] Bidirectional gender filtering applied
- [ ] Scoring matches PRD.md Section 5.3 — shared activities (×10), fitness level (5), frequency (3), recency (5/2), premium (3), verified (2), diet (2)
- [ ] Results sorted by score descending, max 20 returned
- [ ] No `any` types — zero TypeScript errors inside `functions/`
- [ ] No `@/` path alias used inside `functions/src/`
- [ ] Region is `asia-southeast1`
- [ ] Function is deployable to Firebase emulator (`firebase emulators:start`)

## Do Not Touch
`functions/src/onUserCreated.ts`, `functions/package.json`, `functions/tsconfig.json`, `services/`, `store/`, `app/`, `components/`, `types/`, `constants/`, `i18n/`, `App.tsx`, `firestore.rules`

## Commit
`git commit -m "task-23: cloud function getDiscoveryStack with scoring algorithm and candidate filtering"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 3.2] — YYYY-MM-DD
### Completed
- Task 23: Cloud Function getDiscoveryStack implemented (2nd gen callable, asia-southeast1)
- Scoring algorithm from PRD.md Section 5.3 fully implemented (activities, fitness level, frequency, recency, premium, verified, diet)
- Bidirectional age and gender filtering applied
- Exclusion set: liked, passed, matched, blocked users all excluded
- Composite Firestore index (location.city, banned, paused, lastActive DESC) confirmed in firestore.indexes.json

### Files Created / Modified
- functions/src/getDiscoveryStack.ts: full callable function, local types, scoreCandidate, fetchExcludedIds, bidirectional age/gender checks
- functions/src/index.ts: added getDiscoveryStack export
- firestore.indexes.json: composite index for discovery query confirmed/added

### Known Issues / Deferred
- score field included in response for debugging — strip before production launch
- lookingFor overlap scoring requires caller and candidate lookingFor arrays to be loaded; implemented but note this is an unindexed field
- Distance-based filtering (distanceKm) not yet applied — city-level filtering used in Phase 1; geo-distance filtering deferred to Phase 2 using Geohash or a geo library
- If city population is small, QUERY_LIMIT=100 may exhaust available candidates quickly; expanding to country-level fallback is a Phase 2 enhancement

### Next Up
- Task 24: Cloud Function onSwipeCreated (Firestore trigger, mutual like detection, match document creation, stats increment)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 24 prompt.

---

## Reasoning Level
High
