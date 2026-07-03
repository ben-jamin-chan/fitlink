# CODEX PROMPT — Task 85: Strava Disconnect Cleanup Cloud Function

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**
- Task 60 must have created `functions/src/exchangeStravaToken.ts` with a local
  `encryptToken`/`decryptToken` pair (AES-256-CBC) keyed by `process.env.STRAVA_TOKEN_ENCRYPTION_KEY` — verify
- Task 60 must have created `functions/src/syncStravaActivity.ts` with the same local
  `encryptToken`/`decryptToken` pair — verify
- Task 60 must have added `STRAVA_TOKEN_ENCRYPTION_KEY` to `functions/.env.example` — verify
- Task 70 (Phase 2 remediation) must have extended both `exchangeStravaToken.ts` and
  `syncStravaActivity.ts` so that **both `accessToken` and `refreshToken`** are encrypted before
  Firestore writes (not refresh token only) — verify before extracting

If any of these are absent: output a `<!-- DEPENDENCY ERROR -->` block at the top of your
response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: functions/src/exchangeStravaToken.ts does not contain a local decryptToken function.
  Cannot proceed. Confirm Task 60 output before this task.
-->
```

---

## Context

- `functions/src/exchangeStravaToken.ts` — 2nd gen callable; exchanges the Strava OAuth code,
  encrypts both `accessToken` and `refreshToken` locally via its own `encryptToken`/`decryptToken`
  functions, writes `fitnessTracking.strava.{connected, athleteId, accessToken, refreshToken,
  expiresAt}` to `users/{uid}`.
- `functions/src/syncStravaActivity.ts` — 2nd gen callable; reads and decrypts the stored
  refresh/access tokens via its own local copy of the same `encryptToken`/`decryptToken`
  functions, refreshes the Strava token if expired, re-encrypts and re-writes.
- `functions/src/index.ts` — all Cloud Function exports. Currently exports (among others)
  `exchangeStravaToken`, `syncStravaActivity`, `recordSwipe`, `onNewMessage`. This task adds
  `onStravaDisconnected` to it.
- `services/strava.ts` — client service; `disconnectStrava(userId)` already performs a client
  Firestore write setting `fitnessTracking.strava.connected = false` and
  `fitnessTracking.strava.lastSync = null`. **This task does not modify this file.** The new
  Cloud Function is a trigger that reacts to the write this function already makes — it does
  not change client-side disconnect behavior.
- `types/subscription.ts` — `StravaConnection` interface defines `accessToken`, `refreshToken`,
  `expiresAt` as optional fields (`?`) — confirms `FieldValue.delete()` is safe to use on them.
- `functions/.env.example` — already contains `STRAVA_TOKEN_ENCRYPTION_KEY`. **Reuse this exact
  env var name. Do not introduce a new key name.**

**`encryptToken`/`decryptToken` currently exist as two separate, identical local copies — one in
`exchangeStravaToken.ts`, one in `syncStravaActivity.ts`.** This was an intentional Task 60
decision ("each function is self-contained and deployable independently"), but this task needs a
third caller (`onStravaDisconnected.ts`, to decrypt the access token before revocation), so a third
duplication is the wrong move. Extract both functions verbatim into a new shared
`functions/src/utils/crypto.ts` and update both existing files to import from it. **Do not change
the encryption algorithm, key derivation, or IV handling during this extraction — this is a pure
move, not a rewrite.**

**`recordSwipe.ts`, `onNewMessage.ts`, and `useNotifications.ts` were modified in Task 84 (liked-me
push, badge sync) — none of those files are touched by this task. No conflict.**

---

## Task 85 — Strava Disconnect Cleanup Cloud Function

**Files to create:**
- `functions/src/utils/crypto.ts`
- `functions/src/onStravaDisconnected.ts`

**Files to modify:**
- `functions/src/exchangeStravaToken.ts` — remove local `encryptToken`/`decryptToken`, import from `@/functions/src/utils/crypto` (use the project's existing relative import convention inside `functions/` — see Architecture Note 1 below)
- `functions/src/syncStravaActivity.ts` — same removal and import swap
- `functions/src/index.ts` — add `onStravaDisconnected` export

---

### `functions/src/utils/crypto.ts`

> Shared Strava token encryption utility. Lifted verbatim from the existing local copies in
> `exchangeStravaToken.ts` and `syncStravaActivity.ts` — same algorithm (AES-256-CBC), same key
> source (`process.env.STRAVA_TOKEN_ENCRYPTION_KEY`), same IV handling. Reusable by
> `onStravaDisconnected.ts` (this task) and by both existing callers after their local copies are
> removed.
>
> Find the exact current implementation in `exchangeStravaToken.ts` (or `syncStravaActivity.ts` —
> they are identical) and move it here without altering behavior. The shape below is the expected
> export surface; match it to whatever the existing local functions actually do internally.

```typescript
// Move the existing encryptToken/decryptToken implementation here unchanged.
// Do not introduce a new IV strategy, key derivation, or encoding — copy exactly.

import * as crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'

function getEncryptionKey(): Buffer {
  const key = process.env.STRAVA_TOKEN_ENCRYPTION_KEY
  if (!key) {
    throw new Error('STRAVA_TOKEN_ENCRYPTION_KEY is not set')
  }
  // Match the existing key-buffer derivation exactly as found in exchangeStravaToken.ts —
  // do not change this if the existing implementation uses a different derivation method.
  return Buffer.from(key, 'hex')
}

export function encryptToken(plainText: string): string {
  // Lift the exact existing implementation here.
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

export function decryptToken(encryptedText: string): string {
  // Lift the exact existing implementation here.
  const key = getEncryptionKey()
  const [ivHex, encryptedHex] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

> **Important:** the IV format (`iv:ciphertext`), the key derivation (`Buffer.from(key, 'hex')` vs.
> some other encoding), and the algorithm string must match what is **actually** in
> `exchangeStravaToken.ts` today — the snippet above is a structural placeholder, not a
> verbatim source. If the real implementation differs from this shape, use the real one and
> note the difference in the CHANGELOG "Architecture Decisions" section.

---

### `functions/src/onStravaDisconnected.ts`

> 2nd gen `onDocumentUpdated` trigger on `/users/{userId}`. Fires only when
> `fitnessTracking.strava.connected` transitions from `true` to `false` — the exact write
> `disconnectStrava()` in `services/strava.ts` already performs. Best-effort revokes the Strava
> access token, then unconditionally hard-deletes the three encrypted credential fields.

```typescript
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'
import { decryptToken } from './utils/crypto'

export const onStravaDisconnected = onDocumentUpdated(
  { document: 'users/{userId}', region: 'asia-southeast1' },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()

    // Guard: only proceed on the exact connected: true -> false transition.
    // Every other user-document write (profile edits, lastActive heartbeat, badge writes
    // from Task 84) must exit here without touching tokens.
    if (
      before?.fitnessTracking?.strava?.connected !== true ||
      after?.fitnessTracking?.strava?.connected !== false
    ) {
      return
    }

    const userId = event.params.userId
    const encryptedAccessToken: string | undefined =
      before?.fitnessTracking?.strava?.accessToken

    // Best-effort revocation — swallow all errors. A failed revocation must never block
    // the credential cleanup below, and must never mark this trigger execution as failed
    // (which would cause Cloud Functions to retry against a document that will never
    // change again).
    if (encryptedAccessToken) {
      try {
        const accessToken = decryptToken(encryptedAccessToken)
        await fetch('https://www.strava.com/oauth/deauthorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `access_token=${accessToken}`,
        })
      } catch {
        // Swallow — revocation is best-effort. Credential deletion below still proceeds.
      }
    }

    // Hard-delete credential fields unconditionally, regardless of revocation outcome.
    // All three are optional fields on StravaConnection (types/subscription.ts) — safe
    // to delete per CONVENTIONS.md FieldValue.delete() rules.
    await admin.firestore().doc(`users/${userId}`).update({
      'fitnessTracking.strava.accessToken': admin.firestore.FieldValue.delete(),
      'fitnessTracking.strava.refreshToken': admin.firestore.FieldValue.delete(),
      'fitnessTracking.strava.expiresAt': admin.firestore.FieldValue.delete(),
    })
  }
)
```

---

### `functions/src/exchangeStravaToken.ts` — Update

> Remove the local `encryptToken`/`decryptToken` definitions and import from the new shared
> utility instead. No other logic in this file changes.

```typescript
// Remove the local encryptToken and decryptToken function definitions entirely
// (including any local ALGORITHM constant or key-derivation helper used only by them).

// Add import at the top of the file, grouped with other internal imports:
import { encryptToken, decryptToken } from './utils/crypto'

// All existing call sites (token exchange, Firestore write) stay exactly the same —
// only the source of encryptToken/decryptToken changes from "defined in this file"
// to "imported from ./utils/crypto".
```

> Do not touch the OAuth exchange logic, the auth check, the region config, or the Firestore
> write shape in this file. Only the encrypt/decrypt source changes.

---

### `functions/src/syncStravaActivity.ts` — Update

> Identical change to `exchangeStravaToken.ts` — remove the local `encryptToken`/`decryptToken`
> definitions, import from the shared utility.

```typescript
// Remove the local encryptToken and decryptToken function definitions entirely.

// Add import at the top of the file, grouped with other internal imports:
import { encryptToken, decryptToken } from './utils/crypto'

// All existing call sites (token refresh check, activity fetch, stats write) stay exactly
// the same — only the source of encryptToken/decryptToken changes.
```

> Do not touch the token-refresh logic, the activity-fetch logic, the stats calculation, or the
> Firestore write shape in this file. Only the encrypt/decrypt source changes.

---

### `functions/src/index.ts` — Update

```typescript
// Add export alongside the existing Strava exports:
export { onStravaDisconnected } from './onStravaDisconnected'

// Existing exports (exchangeStravaToken, syncStravaActivity, recordSwipe, onNewMessage, etc.)
// stay exactly as they are — only this one new line is added.
```

---

## Important Architecture Notes for Codex

1. **Use the same internal import style already present in `functions/src/`.** Cloud Function
   files import sibling modules with relative paths (e.g. `./utils/crypto`, `./onStravaDisconnected`)
   — this is the one place in the codebase where `@/` is **not** used, per
   CODEX_PROMPT_FORMAT_REFERENCE.md and CONVENTIONS.md Section 2 ("except inside `functions/`").
   Match whatever relative-import depth the existing `functions/src/index.ts` already uses for its
   other exports.

2. **`onDocumentUpdated` guard is the entire safety mechanism here.** This file has no
   `request.auth` check (it is not a callable — it is a background trigger with no caller to
   authenticate) and no region-via-`onCall` pattern. Its only protection against running on every
   user-document write is the explicit `before`/`after` field-delta check at the top. Get this
   guard exactly right — see Architecture Note 7 in CODEX_PROMPT_FORMAT_REFERENCE.md.

3. **Revocation is best-effort; deletion is not.** The `try/catch` around the Strava API call
   must swallow all errors silently (matching the existing pattern for `registerTaskAsync` /
   `unregisterTaskAsync` elsewhere in the codebase). The `FieldValue.delete()` block must run
   unconditionally after the try/catch, not inside an `if (revocationSucceeded)` branch.

4. **`FieldValue.delete()` safety.** `accessToken`, `refreshToken`, and `expiresAt` are all
   optional fields on `StravaConnection` (`types/subscription.ts`). Confirmed safe to delete —
   no reader in the codebase treats their absence as an error; `disconnectStrava()` on the client
   already treats a disconnected state as the normal "no token" condition.

5. **Do not modify `services/strava.ts`.** The client-side disconnect flow (confirm dialog →
   `disconnectStrava()` → `disconnectSource('strava')`) already exists and already performs the
   exact write this trigger listens for. This task adds a server-side reaction to that write — it
   does not change what the client does.

6. **Extraction must be behavior-preserving.** When moving `encryptToken`/`decryptToken` into
   `functions/src/utils/crypto.ts`, copy the actual current algorithm, key derivation, and IV
   handling from the existing files — do not redesign the encryption scheme. If you find the two
   existing local copies have drifted from each other (e.g. one has a bug fix the other doesn't),
   stop and flag it in the CHANGELOG rather than silently picking one.

7. **`onStravaDisconnected` has no `request.auth` check.** Do not add one — `onDocumentUpdated`
   triggers are not callable functions and have no `request.auth` to check. Do not copy the
   callable-function auth pattern from `exchangeStravaToken.ts` into this file.

---

## Rollback Protocol

If `npm --prefix functions run build` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Discovering the actual `encryptToken`/`decryptToken` implementation differs structurally from
  the placeholder shown above in a way that changes the extraction approach, OR
- Finding the two existing local copies of `encryptToken`/`decryptToken` have already drifted
  from each other

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the conflicting file, the error, and what
   decision is needed
4. Stop. Do not attempt a workaround. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npm --prefix functions run build` — zero errors
- [ ] Zero `any` types introduced
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in any function file
- [ ] Zero relative imports of the form `../../` (sibling-level `./` imports inside `functions/src/` are correct and expected)

**Firebase / Security**
- [ ] `onStravaDisconnected` has **no** `request.auth` check (not a callable — see Architecture Note 7)
- [ ] `onStravaDisconnected` specifies `{ region: 'asia-southeast1' }`
- [ ] No `new Date()` used anywhere in touched files
- [ ] `FieldValue.delete()` used only on `accessToken`, `refreshToken`, `expiresAt` — confirmed optional fields
- [ ] Strava access token is never logged, never included in any return value or thrown error

**Architecture**
- [ ] `before`/`after` guard checks the exact `connected: true → false` transition before any token logic runs
- [ ] Revocation call is wrapped in try/catch that swallows all errors
- [ ] `FieldValue.delete()` block runs unconditionally, not gated on revocation success
- [ ] `encryptToken`/`decryptToken` removed from both `exchangeStravaToken.ts` and `syncStravaActivity.ts` — zero duplicate definitions remain anywhere in `functions/src/`
- [ ] `services/strava.ts` was not modified
- [ ] Files in the "Do Not Touch" list were not modified

**Platform**
- [ ] N/A — this task has no client-side or platform-specific code

---

## Acceptance Criteria

- [ ] `functions/src/utils/crypto.ts` created; exports `encryptToken` and `decryptToken` as named exports
- [ ] `functions/src/onStravaDisconnected.ts` created; exports `onStravaDisconnected` as a named export; `onDocumentUpdated` trigger on `users/{userId}`, region `asia-southeast1`
- [ ] Trigger guard exits immediately unless `fitnessTracking.strava.connected` transitions `true → false`
- [ ] Strava `/oauth/deauthorize` call wrapped in try/catch with all errors swallowed
- [ ] `accessToken`, `refreshToken`, `expiresAt` deleted via `FieldValue.delete()` unconditionally after the revocation attempt
- [ ] `exchangeStravaToken.ts` no longer defines `encryptToken`/`decryptToken` locally; imports both from `./utils/crypto`
- [ ] `syncStravaActivity.ts` no longer defines `encryptToken`/`decryptToken` locally; imports both from `./utils/crypto`
- [ ] Both files' existing OAuth/sync logic is otherwise unchanged
- [ ] `onStravaDisconnected` exported from `functions/src/index.ts`
- [ ] `npm --prefix functions run build` passes with zero errors after this task

---

## Do Not Touch

`services/strava.ts` (client disconnect flow is correct as-is — this task only adds a server
trigger reacting to its existing write), `store/fitnessStore.ts`, `app/settings/ConnectedAppsScreen.tsx`,
`functions/src/recordSwipe.ts` (Task 84's liked-me push logic — out of scope here),
`functions/src/onNewMessage.ts`, `hooks/useNotifications.ts`, `store/authStore.ts`,
`App.tsx`, `constants/`, `i18n/` (no user-facing strings in this task — no new keys needed),
`firestore.rules` (Task 68's existing Strava token-field denial already covers this; no rule
change needed since this CF uses the Admin SDK), `types/subscription.ts`

---

## Commit

```
git commit -m "task-85: add Strava disconnect cleanup Cloud Function and extract shared token crypto utility"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 3D — Task 85] — YYYY-MM-DD

### Completed

- Task 85: Strava Disconnect Cleanup Cloud Function
- [What was built — one line per major deliverable]

### Files Created

- functions/src/utils/crypto.ts: [brief description]
- functions/src/onStravaDisconnected.ts: [brief description]

### Files Modified

- functions/src/exchangeStravaToken.ts: [what changed]
- functions/src/syncStravaActivity.ts: [what changed]
- functions/src/index.ts: [what changed]

### Architecture Decisions

- [Note whether the actual encryptToken/decryptToken implementation matched the prompt's
  placeholder shape, or differed — and how]
- [Any other non-obvious choice made and why]

### Conflict Risks Introduced

- None anticipated — Task 87 (security rules) does not need changes from this task, since
  Admin SDK writes bypass Firestore rules entirely.

### Known Issues / Deferred

- [Anything intentionally left incomplete]

### Next Up

- Task 86: Admin Moderation Queue: Harden & Secure
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

High
