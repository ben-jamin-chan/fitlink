# CODEX PROMPT — Task 82: Per-User Timezone Daily Resets

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 81 (SEA Expansion) is complete. `timezone` is now written as a top-level field on every
new user document at profile creation (`services/firebase/firestore.ts` `createUserProfile()`).
The IANA timezone string (e.g. `'Asia/Kuala_Lumpur'`, `'Asia/Singapore'`, `'Asia/Bangkok'`)
is stored in `users/{uid}.timezone`.

This task targets two Cloud Functions that currently contain a hardcoded `getNextMidnightMs()`
helper that always assumes UTC+8. The hardcode must be removed and replaced with a
per-user-timezone-aware implementation that reads the user's `timezone` field from Firestore.

Existing files Codex needs to know about:

- `functions/src/recordSwipe.ts` — callable Cloud Function that enforces the daily like
  limit (`dailyLikes.count`). It calls `getNextMidnightMs()` to compute `resetAt` when
  resetting or initialising the daily counter. Task 72 (Rewind) added a `'rewind'` branch
  to this function — do not disturb that branch or any of the swipe/match logic.
- `functions/src/verifyProfilePhoto.ts` — callable Cloud Function that tracks per-day
  verification attempt counts. It calls `getNextMidnightMs()` for the same purpose —
  computing `resetAt` for the attempt counter. Do not touch any Cloud Vision or
  verification-outcome logic.
- `constants/regions.ts` — exports `COUNTRY_TIMEZONES` mapping `SupportedCountry` →
  IANA string. This file is client-side only and must **not** be imported inside
  `functions/`. The Cloud Function reads the timezone directly from the Firestore user doc.
- `types/user.ts` — `UserProfile` interface has `timezone?: string` (added Task 70).
  No changes required to this file.

**This task modifies only two Cloud Function files. No client-side files, no Firestore rules,
no i18n files, no type files, and no new files are created. Any change outside
`functions/src/recordSwipe.ts` and `functions/src/verifyProfilePhoto.ts` is scope creep
and must be reverted.**

---

## Task 82 — Per-User Timezone Daily Resets

**Files to create:**
_(none)_

**Files to modify:**
- `functions/src/recordSwipe.ts` — replace hardcoded `getNextMidnightMs()` with an
  async, per-user-timezone-aware version; update all call sites to `await` it
- `functions/src/verifyProfilePhoto.ts` — same replacement; update all call sites to
  `await` it

---

### `functions/src/recordSwipe.ts` — Update

> Replace only the `getNextMidnightMs` helper function and its call sites. Do not modify
> the swipe-writing logic, the mutual-match detection, the `'rewind'` branch added in Task 72,
> or any other part of this function.

**Locate and remove the existing `getNextMidnightMs` helper** (it will look similar to):
```typescript
// REMOVE — hardcoded UTC+8 version (exact implementation may differ):
function getNextMidnightMs(): number {
  const now = new Date()
  const myt = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }))
  myt.setDate(myt.getDate() + 1)
  myt.setHours(0, 0, 0, 0)
  const offsetMs = myt.getTime() - now.getTime()  // approximate
  return Date.now() + offsetMs
}
```

**Replace with the following async implementation:**
```typescript
// ADD — async, per-user-timezone-aware version
async function getNextMidnightMs(uid: string): Promise<number> {
  const userDoc = await admin.firestore().doc(`users/${uid}`).get()
  const timezone: string = userDoc.data()?.timezone ?? 'Asia/Kuala_Lumpur'

  const now = new Date()

  // Step 1: Determine today's date in the user's local timezone using Intl.DateTimeFormat.
  // 'en-CA' locale produces ISO-like "YYYY-MM-DD" output which is safe to split on '-'.
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const localDateStr = dateFormatter.format(now) // e.g. "2026-06-14"
  const [year, month, day] = localDateStr.split('-').map(Number)

  // Step 2: Determine the UTC offset for this timezone at this moment.
  // We compute offset by formatting the same moment as both UTC and local, then diffing.
  // Using Intl.DateTimeFormat with numeric fields gives us the local clock values directly.
  const localPartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })
  const localTimeParts = localPartsFormatter.formatToParts(now)
  const localHour = Number(localTimeParts.find((p) => p.type === 'hour')?.value ?? 0)
  const localMinute = Number(localTimeParts.find((p) => p.type === 'minute')?.value ?? 0)
  const localSecond = Number(localTimeParts.find((p) => p.type === 'second')?.value ?? 0)

  // Step 3: Build the epoch ms for tomorrow midnight in UTC terms.
  // "Tomorrow midnight local" = the UTC instant when the user's clock first shows 00:00:00
  // on (day + 1). We reconstruct it from today's local date components.
  const utcHour = now.getUTCHours()
  const utcMinute = now.getUTCMinutes()
  const utcSecond = now.getUTCSeconds()

  // Seconds elapsed since local midnight vs UTC midnight — their difference is the offset.
  const localElapsedSeconds = localHour * 3600 + localMinute * 60 + localSecond
  const utcElapsedSeconds = utcHour * 3600 + utcMinute * 60 + utcSecond
  const offsetSeconds = localElapsedSeconds - utcElapsedSeconds

  // UTC epoch ms for the start of today in the user's timezone (local midnight today = UTC midnight - offset).
  // Then add 86400 seconds (one day) to get next local midnight.
  const todayLocalMidnightUtcMs =
    Date.UTC(year, month - 1, day) - offsetSeconds * 1000
  const nextMidnightUtcMs = todayLocalMidnightUtcMs + 86400 * 1000

  // Safety guard: if the computed value is already in the past (clock skew or DST edge),
  // add another 24 hours so resetAt is always strictly in the future.
  return nextMidnightUtcMs > now.getTime()
    ? nextMidnightUtcMs
    : nextMidnightUtcMs + 86400 * 1000
}
```

**Update every call site** inside `recordSwipe.ts` that previously called
`getNextMidnightMs()` (no arguments, synchronous) to instead call
`await getNextMidnightMs(uid)` where `uid` is the authenticated user's UID
(`request.auth.uid`).

The surrounding function that contains the call site is already `async`, so no additional
`async` keyword is needed at the caller level. Only the call itself changes:

```typescript
// BEFORE (remove):
resetAt: Timestamp.fromMillis(getNextMidnightMs()),

// AFTER (add):
resetAt: Timestamp.fromMillis(await getNextMidnightMs(uid)),
```

Do not touch any other line in this file. The Rewind branch (`direction === 'rewind'`),
the mutual-match transaction, the swipe-doc write, and the `dailyLikes.count` decrement
logic must remain exactly as they were after Task 72.

---

### `functions/src/verifyProfilePhoto.ts` — Update

> Replace only the `getNextMidnightMs` helper function and its call sites. Do not modify
> the Cloud Vision API call, the face-detection scoring logic, the `verifiedAt` / `verified`
> field writes, or the attempt-count enforcement logic.

**Locate and remove the existing `getNextMidnightMs` helper** (same hardcoded UTC+8 pattern
as in `recordSwipe.ts` — the exact implementation may vary slightly).

**Replace with the identical async implementation** shown above in the `recordSwipe.ts`
section. Both files carry their own private copy of the helper — do not create a shared
utility module for it (that is out of scope for this task; shared extraction may be
considered in Task 88 cleanup).

**Update every call site** inside `verifyProfilePhoto.ts` the same way:

```typescript
// BEFORE (remove):
resetAt: Timestamp.fromMillis(getNextMidnightMs()),

// AFTER (add):
resetAt: Timestamp.fromMillis(await getNextMidnightMs(uid)),
```

`uid` in `verifyProfilePhoto.ts` is also `request.auth.uid`. The surrounding function is
already `async`.

---

## Important Architecture Notes for Codex

1. **Do not import `constants/regions.ts` into any Cloud Function.** `constants/` is part
   of the Expo/React Native client package. Cloud Functions run in a separate Node.js
   environment inside `functions/`. The timezone is read directly from the Firestore user
   document using the Admin SDK — that is the only source of truth on the server side.

2. **`getNextMidnightMs` is private to each file — do not create a shared module.**
   Extracting shared utility logic from Cloud Functions into a `functions/src/utils/`
   module is reserved for Task 85 (which already extracts `crypto.ts`). Adding a new
   shared module here would create an unreviewed dependency and is out of scope. Duplicate
   the helper verbatim in both files.

3. **The function signature change is `() → async (uid: string): Promise<number>`.**
   This is the only required signature change. The surrounding callable function body
   was already `async` in both files, so `await` at the call site requires no
   additional `async` wrapping. Failing to add `await` will silently cause
   `Timestamp.fromMillis(Promise<number>)` which TypeScript strict mode will catch —
   run `npm --prefix functions run build` to confirm.

4. **Fallback to `'Asia/Kuala_Lumpur'` is mandatory.** Users who created accounts before
   Task 81 will have no `timezone` field on their user document. The `?? 'Asia/Kuala_Lumpur'`
   fallback in the Firestore read must not be removed. Do not use a non-null assertion (`!`)
   on the `data()` result.

5. **Do not use `new Date()` arithmetic to approximate the UTC offset.** The spec's original
   approach of subtracting `now.getTime() - Date.UTC(now.getUTCFullYear(), ...)` always
   produces zero because both expressions evaluate the same epoch millisecond. The
   implementation provided in this prompt uses `formatToParts` to extract the local clock
   values and computes the offset correctly. Use the implementation provided here exactly.

6. **No other files may be modified.** This task is scoped exclusively to
   `functions/src/recordSwipe.ts` and `functions/src/verifyProfilePhoto.ts`. If Codex
   proposes changes to `services/firebase/firestore.ts`, `types/user.ts`, or any client
   file, that is drift and must be reverted before committing.

7. **`admin.firestore()` is already imported via the Admin SDK initialisation** present in
   both files from Phase 2. Do not add a second `admin` import or re-initialise the app.

8. **TypeScript strict mode will flag `localTimeParts.find(...)?.value` as `string | undefined`.**
   The `?? 0` fallback in the `Number(...)` call handles this and satisfies the compiler.
   Do not use a type assertion (`as`) here — the nullish coalescing fallback is the correct
   approach per CONVENTIONS.md Section 1.

---

## Acceptance Criteria

- [ ] `functions/src/recordSwipe.ts`: the hardcoded `getNextMidnightMs()` helper (zero
  arguments, synchronous, UTC+8) is fully removed and replaced with
  `async function getNextMidnightMs(uid: string): Promise<number>` using `Intl.DateTimeFormat`
- [ ] `functions/src/recordSwipe.ts`: every call site updated to `await getNextMidnightMs(uid)`
- [ ] `functions/src/verifyProfilePhoto.ts`: same replacement applied — hardcoded helper
  removed, async version present, all call sites updated to `await getNextMidnightMs(uid)`
- [ ] Both implementations fall back to `'Asia/Kuala_Lumpur'` when `userDoc.data()?.timezone`
  is `undefined` (covers pre-Task-81 users)
- [ ] No import of `constants/regions.ts` or any client-side module exists inside either
  Cloud Function file
- [ ] No shared `functions/src/utils/timezoneUtils.ts` (or similar) created — helper is
  duplicated in each file
- [ ] `npm --prefix functions run build` passes with zero TypeScript errors
- [ ] `npx tsc --noEmit` (client-side) passes with zero errors — confirming no accidental
  client-side changes were made
- [ ] Zero `any` in the new helper implementations
- [ ] Zero `console.log` / `console.error` / `console.warn` remaining in either file
  (use structured Cloud Functions logger if logging is needed — but no new logging is
  required by this task)
- [ ] The Rewind branch (`direction === 'rewind'`) in `recordSwipe.ts` is byte-for-byte
  identical to its state after Task 72
- [ ] The Cloud Vision / verification-outcome logic in `verifyProfilePhoto.ts` is
  byte-for-byte identical to its state after Phase 2

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/discoveryStore.ts`, `store/profileStore.ts`,
`services/firebase/config.ts`, `services/firebase/firestore.ts`, `services/firebase/auth.ts`,
`services/places.ts`, `types/user.ts`, `types/checkin.ts`, `types/event.ts`,
`constants/regions.ts`, `constants/theme.ts`, `constants/colors.ts`, `constants/spacing.ts`,
`constants/typography.ts`, `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json`,
`firestore.rules`, `firestore.indexes.json`, `functions/src/index.ts`,
`functions/src/createCheckin.ts`, `functions/src/createEvent.ts`, `functions/src/rsvpEvent.ts`,
`functions/src/onSwipeCreated.ts`, `functions/src/getDiscoveryStack.ts`,
`functions/src/onUserCreated.ts`, `functions/src/exchangeStravaToken.ts`,
`functions/src/syncStravaActivity.ts`, `functions/src/moderatePhoto.ts`,
`functions/src/moderateBio.ts`, `functions/src/checkReportThreshold.ts`,
`functions/src/onNewMessage.ts`, `functions/src/createStripeCheckout.ts`,
`functions/src/stripeWebhook.ts`

---

## Commit

```
git commit -m "task-82: per-user timezone daily resets in recordSwipe and verifyProfilePhoto"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3D — Task 82] — YYYY-MM-DD

### Completed

- Task 82: Per-User Timezone Daily Resets
- recordSwipe: hardcoded UTC+8 getNextMidnightMs() replaced with async per-user version
  that reads users/{uid}.timezone from Firestore and computes next local midnight via
  Intl.DateTimeFormat formatToParts; falls back to Asia/Kuala_Lumpur for pre-Task-81 users
- verifyProfilePhoto: identical replacement applied; verification attempt resetAt now
  respects Singapore (Asia/Singapore) and Thailand (Asia/Bangkok) timezones

### Files Created / Modified

- functions/src/recordSwipe.ts: getNextMidnightMs replaced (async, uid param, Intl-based);
  all call sites updated to await
- functions/src/verifyProfilePhoto.ts: same replacement applied

### Architecture Decisions

- getNextMidnightMs is duplicated in both files rather than extracted to a shared utility;
  shared extraction is deferred to Task 85 (crypto utils) or Task 88 (consolidation)
- Timezone offset computed via Intl.DateTimeFormat formatToParts rather than Date arithmetic
  to correctly handle DST and non-integer UTC offsets (e.g. Asia/Kolkata at UTC+5:30)
- Safety guard added: if computed next-midnight is already in the past (DST fall-back edge),
  an additional 86400s is added to guarantee resetAt is always strictly future

### Known Issues / Deferred

- Pre-Task-81 users without a timezone field continue to receive Asia/Kuala_Lumpur resets
  via the fallback; a data migration to back-fill timezone is deferred to Phase 4

### Next Up

- Task 83: Background lastActive Updates (iOS)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 83 prompt.

---

## Reasoning Level

High

> **Rationale:** This task modifies two production Cloud Functions that gate core monetisation
> logic (daily like enforcement) and trust logic (photo verification attempt limits). A subtle
> error in the midnight calculation — such as the zero-producing UTC offset subtraction in the
> original spec — would silently reset all users' daily limits at UTC midnight instead of local
> midnight, breaking the fairness of the free-tier limit for SG and TH users. The correct
> `Intl.DateTimeFormat formatToParts` approach requires careful numeric extraction. The async
> signature change at every call site must be verified by the TypeScript compiler. High
> reasoning is warranted.
