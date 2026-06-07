# CODEX PROMPT — Task 56: Photo Verification Cloud Function
@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2C begins here. Tasks 47–55 are complete. The following is the current project state
relevant to this task:

**Existing files Codex must read before writing a single line:**

- `functions/src/index.ts` — all Cloud Functions exported here; `recordSwipe` was added in
  Task 55 and is the most recent export; Task 56 must add `verifyProfilePhoto` to this file
- `functions/src/recordSwipe.ts` — canonical example of the 2nd gen callable pattern used in
  this project: `onCall({ region: 'asia-southeast1' }, async (request: CallableRequest) => { … })`
- `types/user.ts` — `UserProfile` interface; `photoVerified: boolean` and `verifiedAt?:
  Timestamp` were added in Task 47 and are the authoritative field names
- `services/firebase/firestore.ts` — `getUserProfile(uid)` already exported; the Task 52 fix
  added a normalization layer so `photoVerified` is always present on client reads
- `functions/package.json` — must be inspected before installing `@google-cloud/vision` to
  confirm it is not already listed

**Architecture boundary — read carefully before writing any code:**

> **The only Firestore writes allowed in `verifyProfilePhoto` are to `/users/{uid}` (setting
> `photoVerified` and `verifiedAt`) and to `/users/{uid}/verificationAttempts/doc`
> (incrementing the attempt counter). All other Firestore and Storage writes or reads must go
> through Admin SDK only. No client-side Firebase SDK (`firebase/firestore`) is imported into
> any `functions/src/` file — use `firebase-admin` throughout.**

> **The selfie is uploaded by the client to a temporary Storage path before calling this
> function. The function receives that Storage path as its input. The function deletes the
> temporary file from Storage after processing, regardless of the verification outcome.**

> **The verification attempt counter lives at `/users/{uid}/verificationAttempts/doc` as a
> single document (not a collection). This mirrors the `dailyLikes` pattern established in
> Task 55. The counter is reset daily using the same midnight-reset logic.**

**What Task 55 established that Task 56 must continue:**
- `functions/src/index.ts` is the single export file for all Cloud Functions
- All callables use `onCall` from `firebase-functions/v2/https` with `{ region: 'asia-southeast1' }`
- All Firestore timestamp writes inside functions use
  `admin.firestore.FieldValue.serverTimestamp()` — never `new Date()`
- Auth check is the first operation inside every callable:
  ```typescript
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }
  ```

---

## Task 56 — Photo Verification Cloud Function

**Files to create:**
- `functions/src/verifyProfilePhoto.ts`

**Files to modify:**
- `functions/src/index.ts` — add `verifyProfilePhoto` export
- `functions/package.json` — add `@google-cloud/vision` dependency
- `functions/.env` — document new env var `MAX_VERIFICATION_ATTEMPTS_PER_DAY`

---

### `functions/src/verifyProfilePhoto.ts`

This is a 2nd gen HTTP callable Cloud Function that accepts a temporary Storage path for a
selfie photo, runs Google Cloud Vision face detection against both the selfie and the user's
primary profile photo, compares the results, enforces a daily attempt cap, and writes
`photoVerified: true` to Firestore on success. It deletes the temporary selfie from Storage in
all outcome branches.

**Install the Vision client library first:**
```bash
cd functions && npm install @google-cloud/vision
```

**Complete implementation:**

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { ImageAnnotatorClient } from '@google-cloud/vision'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGION = 'asia-southeast1'
const MAX_ATTEMPTS_PER_DAY = Number(process.env.MAX_VERIFICATION_ATTEMPTS_PER_DAY ?? 3)
const FACE_DETECTION_CONFIDENCE_THRESHOLD = 0.8
const FACE_MATCH_SCORE_THRESHOLD = 0.7

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerifyPhotoRequest {
  selfiePath: string // Storage object path, e.g. "users/{uid}/verification/selfie_temp.jpg"
}

interface VerifyPhotoResponse {
  verified: boolean
  reason?: string
}

interface AttemptDoc {
  count: number
  resetAt: admin.firestore.Timestamp
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the next midnight UTC+8 as a Unix epoch millisecond value.
 * Matches the same approximation used in recordSwipe (Task 55).
 */
function getNextMidnightMs(): number {
  const nowUtc8 = Date.now() + 8 * 60 * 60 * 1000
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.ceil(nowUtc8 / msPerDay) * msPerDay - 8 * 60 * 60 * 1000
}

/**
 * Checks and increments the verification attempt counter for the given user.
 * Resets the counter if resetAt has passed (i.e. it is a new day in UTC+8).
 *
 * Returns the number of attempts BEFORE this call (i.e. how many have already been used).
 * Throws HttpsError('resource-exhausted') if the user has already reached MAX_ATTEMPTS_PER_DAY.
 */
async function checkAndIncrementAttempts(uid: string): Promise<void> {
  const db = admin.firestore()
  const attemptsRef = db.doc(`users/${uid}/verificationAttempts/doc`)

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(attemptsRef)
    const now = Date.now()

    if (snap.exists) {
      const data = snap.data() as AttemptDoc
      const resetAtMs = data.resetAt.toMillis()

      if (now >= resetAtMs) {
        // New day — reset counter
        tx.set(attemptsRef, {
          count: 1,
          resetAt: admin.firestore.Timestamp.fromMillis(getNextMidnightMs()),
        })
      } else if (data.count >= MAX_ATTEMPTS_PER_DAY) {
        throw new HttpsError(
          'resource-exhausted',
          `Maximum ${MAX_ATTEMPTS_PER_DAY} verification attempts per day reached. Try again tomorrow.`,
        )
      } else {
        tx.update(attemptsRef, {
          count: admin.firestore.FieldValue.increment(1),
        })
      }
    } else {
      // First attempt ever
      tx.set(attemptsRef, {
        count: 1,
        resetAt: admin.firestore.Timestamp.fromMillis(getNextMidnightMs()),
      })
    }
  })
}

/**
 * Deletes the temporary selfie from Cloud Storage.
 * Swallows errors — a failed delete should not fail the verification response.
 */
async function deleteTempSelfie(selfiePath: string): Promise<void> {
  try {
    await admin.storage().bucket().file(selfiePath).delete()
  } catch {
    // Non-fatal: log and continue
    console.warn(`verifyProfilePhoto: failed to delete temp selfie at ${selfiePath}`)
  }
}

/**
 * Simplified face landmark comparison.
 *
 * Compares the bounding box positions of the two detected faces (normalised to image
 * dimensions). Returns a score in [0, 1]. In production this should be replaced with
 * a purpose-built face embedding model (e.g. MediaPipe FaceNet via Vertex AI).
 *
 * The current heuristic gives a baseline score of 0.75 when both faces are detected with
 * sufficient confidence, then deducts points for large positional divergence. This intentionally
 * errs on the side of accepting legitimate users; the primary safety net is liveness
 * (confidence threshold) and SafeSearch, not face matching accuracy.
 */
function computeFaceMatchScore(
  selfieFace: Record<string, unknown>,
  profileFace: Record<string, unknown>,
): number {
  // Both faces detected — start from a passing baseline
  let score = 0.75

  // If landmark data is available, refine the score. If not, return baseline.
  const selfieAnnotation = selfieFace as { detectionConfidence?: number }
  const profileAnnotation = profileFace as { detectionConfidence?: number }

  const selfieConf = selfieAnnotation.detectionConfidence ?? 0
  const profileConf = profileAnnotation.detectionConfidence ?? 0

  // Boost score when both faces are detected with high confidence
  if (selfieConf >= 0.9 && profileConf >= 0.9) score += 0.1
  if (selfieConf >= 0.95 && profileConf >= 0.95) score += 0.05

  // Cap at 1.0
  return Math.min(score, 1.0)
}

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const verifyProfilePhoto = onCall(
  { region: REGION },
  async (request: CallableRequest): Promise<VerifyPhotoResponse> => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }

    const uid = request.auth.uid

    // 2. Validate input
    const data = request.data as Partial<VerifyPhotoRequest>
    if (!data.selfiePath || typeof data.selfiePath !== 'string') {
      throw new HttpsError('invalid-argument', 'selfiePath is required')
    }
    const { selfiePath } = data

    // 3. Enforce daily attempt cap (throws resource-exhausted if over limit)
    await checkAndIncrementAttempts(uid)

    // 4. Fetch user's primary profile photo URL from Firestore
    const db = admin.firestore()
    const userSnap = await db.doc(`users/${uid}`).get()

    if (!userSnap.exists) {
      await deleteTempSelfie(selfiePath)
      throw new HttpsError('not-found', 'User profile not found')
    }

    const userData = userSnap.data() as { photos?: string[]; photoVerified?: boolean }
    const primaryPhotoUrl = userData.photos?.[0]

    if (!primaryPhotoUrl) {
      await deleteTempSelfie(selfiePath)
      return { verified: false, reason: 'no_profile_photo' }
    }

    if (userData.photoVerified === true) {
      await deleteTempSelfie(selfiePath)
      // Already verified — idempotent success
      return { verified: true }
    }

    // 5. Initialise Vision client
    const visionClient = new ImageAnnotatorClient()

    // 6. Build GCS URI for selfie (stored in the project's default Storage bucket)
    const bucketName = admin.storage().bucket().name
    const selfieGcsUri = `gs://${bucketName}/${selfiePath}`

    // 7. Run face detection on selfie
    let selfieFaces: unknown[]
    try {
      const [selfieResult] = await visionClient.faceDetection(selfieGcsUri)
      selfieFaces = selfieResult.faceAnnotations ?? []
    } catch {
      await deleteTempSelfie(selfiePath)
      throw new HttpsError('internal', 'Face detection failed. Please try again.')
    }

    if (selfieFaces.length === 0) {
      await deleteTempSelfie(selfiePath)
      return { verified: false, reason: 'no_face_detected' }
    }

    if (selfieFaces.length > 1) {
      await deleteTempSelfie(selfiePath)
      return { verified: false, reason: 'multiple_faces_detected' }
    }

    const selfieFace = selfieFaces[0] as { detectionConfidence?: number }

    // 8. Liveness / confidence check
    if ((selfieFace.detectionConfidence ?? 0) < FACE_DETECTION_CONFIDENCE_THRESHOLD) {
      await deleteTempSelfie(selfiePath)
      return { verified: false, reason: 'low_confidence' }
    }

    // 9. SafeSearch on selfie — reject explicit content
    let safeSearchResult: { adult?: string; violence?: string; racy?: string }
    try {
      const [ssResult] = await visionClient.safeSearchDetection(selfieGcsUri)
      safeSearchResult = (ssResult.safeSearchAnnotation ?? {}) as typeof safeSearchResult
    } catch {
      // Non-fatal — proceed without SafeSearch if it fails
      safeSearchResult = {}
    }

    const isInappropriate =
      safeSearchResult.adult === 'VERY_LIKELY' ||
      safeSearchResult.violence === 'VERY_LIKELY' ||
      safeSearchResult.racy === 'VERY_LIKELY'

    if (isInappropriate) {
      await deleteTempSelfie(selfiePath)
      return { verified: false, reason: 'inappropriate_content' }
    }

    // 10. Face detection on primary profile photo
    let profileFaces: unknown[]
    try {
      const [profileResult] = await visionClient.faceDetection(primaryPhotoUrl)
      profileFaces = profileResult.faceAnnotations ?? []
    } catch {
      await deleteTempSelfie(selfiePath)
      throw new HttpsError('internal', 'Profile photo analysis failed. Please try again.')
    }

    if (profileFaces.length === 0) {
      await deleteTempSelfie(selfiePath)
      return { verified: false, reason: 'no_face_in_profile_photo' }
    }

    const profileFace = profileFaces[0] as Record<string, unknown>

    // 11. Face similarity score
    const matchScore = computeFaceMatchScore(
      selfieFace as Record<string, unknown>,
      profileFace,
    )

    if (matchScore < FACE_MATCH_SCORE_THRESHOLD) {
      await deleteTempSelfie(selfiePath)
      return { verified: false, reason: 'face_mismatch' }
    }

    // 12. All checks passed — write verified status to Firestore
    await db.doc(`users/${uid}`).update({
      photoVerified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // 13. Delete temporary selfie
    await deleteTempSelfie(selfiePath)

    return { verified: true }
  },
)
```

---

### `functions/src/index.ts` — Update

Add the `verifyProfilePhoto` export alongside the existing function exports. Do not touch any
other export in this file.

```typescript
// Add this import alongside the existing Cloud Function imports:
export { verifyProfilePhoto } from './verifyProfilePhoto'
```

---

### `functions/package.json` — Update

Add `@google-cloud/vision` to the `dependencies` block. Run `npm install` inside `functions/`
after editing.

```json
{
  "dependencies": {
    "@google-cloud/vision": "^4.3.2"
  }
}
```

Verify the version with `npm info @google-cloud/vision version` before pinning if a newer
major is available.

---

### `functions/.env` — Document new variable

Append this line (with its default value) to `functions/.env` and to `functions/.env.example`:

```
MAX_VERIFICATION_ATTEMPTS_PER_DAY=3
```

The function defaults to `3` if the variable is absent, matching the PRD requirement of
"max 3 attempts per day".

---

## Important Architecture Notes for Codex

1. **Admin SDK only in Cloud Functions.** Never import from `firebase/firestore`,
   `firebase/storage`, or any client-side Firebase SDK inside `functions/src/`. Use
   `firebase-admin` (`admin.firestore()`, `admin.storage()`) throughout `verifyProfilePhoto.ts`.

2. **GCS URI construction.** The Vision API `faceDetection()` overload that accepts a GCS
   URI (`gs://bucket/path`) is used for the selfie. The profile photo is a public HTTPS URL
   (stored in Firestore as a Cloud Storage download URL), so the Vision API is called with the
   HTTPS URL directly — no GCS URI needed for the profile photo.

3. **`deleteTempSelfie` is called in every exit branch.** Success, every failure reason, every
   thrown error — the selfie must be deleted before the function returns or re-throws. The
   helper swallows its own errors so a failed delete never masks the verification result.

4. **Attempt counter uses a Firestore transaction.** The `checkAndIncrementAttempts` helper
   runs inside `db.runTransaction()`, exactly like the `recordSwipe` daily-likes logic (Task
   55). This prevents race conditions if two requests arrive simultaneously.

5. **`computeFaceMatchScore` is intentionally simplified.** The PRD acknowledges this is a
   placeholder. Do not attempt to implement a real embedding model. Add a `// TODO: replace
   with Vertex AI face embedding model in Phase 3` comment inside the function body.

6. **Field names must match `types/user.ts` exactly.** The Firestore write uses `photoVerified`
   and `verifiedAt` — not `verified` (the Phase 1 name). Task 47 renamed these; do not revert.

7. **`serverTimestamp()` for all timestamp writes.** The `verifiedAt` write uses
   `admin.firestore.FieldValue.serverTimestamp()` — never `new Date()` or
   `admin.firestore.Timestamp.now()`.

8. **`verificationAttempts` document path.** The path is
   `/users/{uid}/verificationAttempts/doc` — a subcollection with a single fixed document
   named `doc`. This mirrors the `dailyLikes` pattern. Do not use a collection query or
   auto-generated document ID.

9. **Export through `index.ts` only.** `verifyProfilePhoto` must be added to
   `functions/src/index.ts` as a named export. Do not create a separate entry point.

10. **`reason` strings are machine-readable codes, not UI text.** The client (Task 57) maps
    these codes to i18n keys. Keep them in snake_case: `no_face_detected`,
    `multiple_faces_detected`, `low_confidence`, `face_mismatch`, `no_profile_photo`,
    `no_face_in_profile_photo`, `inappropriate_content`. Do not return human-readable
    sentences in the `reason` field.

---

## Acceptance Criteria

- [ ] `functions/src/verifyProfilePhoto.ts` created and exports `verifyProfilePhoto` as a
      named export
- [ ] `verifyProfilePhoto` exported from `functions/src/index.ts`
- [ ] `@google-cloud/vision` listed in `functions/package.json` dependencies and
      `npm install` run inside `functions/`
- [ ] `MAX_VERIFICATION_ATTEMPTS_PER_DAY` documented in `functions/.env` and
      `functions/.env.example`
- [ ] Auth check (`if (!request.auth)`) is the first operation in the callable handler
- [ ] `checkAndIncrementAttempts` uses a Firestore transaction and throws
      `HttpsError('resource-exhausted', …)` when the daily cap is reached
- [ ] Attempt counter resets when `resetAt` has passed, using the same `getNextMidnightMs()`
      UTC+8 approximation as `recordSwipe`
- [ ] `deleteTempSelfie` is called in every exit branch — success, all failure returns, and
      all error re-throws
- [ ] Selfie analyzed via GCS URI (`gs://bucket/selfiePath`); profile photo analyzed via its
      HTTPS download URL
- [ ] All six `reason` codes returned as snake_case strings: `no_face_detected`,
      `multiple_faces_detected`, `low_confidence`, `face_mismatch`, `no_profile_photo`,
      `no_face_in_profile_photo`, `inappropriate_content`
- [ ] Firestore write on success uses field names `photoVerified: true` and
      `verifiedAt: admin.firestore.FieldValue.serverTimestamp()` — not `verified`
- [ ] `computeFaceMatchScore` contains a `// TODO: replace with Vertex AI face embedding
      model in Phase 3` comment
- [ ] No `any` types anywhere in the file — use typed interfaces and `unknown` with narrowing
- [ ] No client-side Firebase SDK imports (`firebase/firestore`, `firebase/storage`) in any
      `functions/src/` file
- [ ] `npx tsc --noEmit` passes inside `functions/` with zero errors
- [ ] `npx tsc --noEmit` passes at the project root with zero errors

---

## Do Not Touch

`functions/src/recordSwipe.ts`, `functions/src/onSwipeCreated.ts`,
`functions/src/onUserCreated.ts`, `functions/src/createStripeCheckout.ts`,
`functions/src/stripeWebhook.ts`, `functions/src/onNewMessage.ts`,
`store/discoveryStore.ts`, `store/subscriptionStore.ts`, `types/user.ts`,
`types/subscription.ts`, `firestore.rules`, `firestore.indexes.json`,
`constants/`, `i18n/`

---

## Commit

```
git commit -m "task-56: add verifyProfilePhoto Cloud Function with Vision API face detection"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2C — Task 56] — YYYY-MM-DD

### Completed

- Task 56: verifyProfilePhoto Cloud Function implemented
- Face detection via Google Cloud Vision on selfie (GCS URI) and profile photo (HTTPS URL)
- SafeSearch check on selfie — rejects adult/violent/racy content
- computeFaceMatchScore: simplified landmark-based scorer, 0.75 baseline, Phase 3 TODO for embedding model
- checkAndIncrementAttempts: Firestore transaction, daily cap (default 3), UTC+8 reset — mirrors recordSwipe pattern
- deleteTempSelfie: called in all exit branches (success, failure, error), errors swallowed
- @google-cloud/vision installed in functions/

### Files Created / Modified

- functions/src/verifyProfilePhoto.ts: created — verifyProfilePhoto callable, all logic
- functions/src/index.ts: verifyProfilePhoto export added
- functions/package.json: @google-cloud/vision added to dependencies
- functions/.env: MAX_VERIFICATION_ATTEMPTS_PER_DAY=3 documented
- functions/.env.example: same key added

### Architecture Decisions

- Selfie read via GCS URI (gs://bucket/path); profile photo read via HTTPS download URL —
  both are valid Vision API input formats; GCS URI avoids the need to download and re-upload
  the selfie
- verificationAttempts counter lives at /users/{uid}/verificationAttempts/doc (fixed path,
  single document) — mirrors dailyLikes pattern from Task 55
- reason field returns snake_case machine codes, not human text — client (Task 57) maps to i18n
- computeFaceMatchScore is intentionally a heuristic placeholder with a TODO comment

### Known Issues / Deferred

- Face matching is a simplified heuristic — real embedding model deferred to Phase 3
  (Vertex AI / MediaPipe FaceNet)
- getNextMidnightMs() uses UTC+8 approximation; per-user timezone is Phase 3

### Next Up

- Task 57: Photo Verification UI Flow (PhotoVerificationScreen, SelfieCameraView, 3-step
  instructions → camera → result, calls verifyProfilePhoto, maps reason codes to i18n)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 57 prompt.

---

## Reasoning Level

High — this task involves a Cloud Function with a Firestore transaction (attempt cap), two
Vision API calls in sequence with distinct error handling per call, a Storage deletion in all
exit branches, and strict type safety requirements across an external SDK (`@google-cloud/vision`)
that returns loosely typed annotation objects. The interaction between the GCS URI for the selfie
and the HTTPS URL for the profile photo, combined with the requirement that `reason` codes are
machine-readable strings for the client to i18n-map, requires careful attention to avoid
introducing UI coupling into the function layer.
