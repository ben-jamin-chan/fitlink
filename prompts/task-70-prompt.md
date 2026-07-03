# CODEX PROMPT — Task 70
# Phase 3A: Update TypeScript Types for Phase 3

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2 is complete (Tasks 47–69) plus unplanned bug-fix commits (Tasks 70–74 in git log).
Phase 3 now begins. This is the first Phase 3 task and it is a pure types task — no UI,
no services, no Cloud Functions. Its only job is to extend the existing type files so that
every subsequent Phase 3 task has the correct interfaces available before writing a single
line of feature code.

**Current type file state (confirmed from CHANGELOG):**

- `types/user.ts` — `UserProfile` interface with Phase 2 fields: `photoVerified`, `verifiedAt?`,
  `stripeCustomerId?`, `premium: PremiumStatus`, `fitnessTracking?: FitnessTracking`.
  Does NOT yet have: `timezone`, `incognito`, `boostExpiresAt`, `videoProfileUrl`, `gymCheckin`.
- `types/subscription.ts` — `PremiumTier`, `PremiumStatus`, `StripePrice`, `TodayStats`,
  `WorkoutSession`, `FitnessTracking`, `FitnessTrackingSource`, `UpsellReason`. All Phase 2 types.
- `types/fitness.ts` — re-exports from `types/subscription.ts`; adds `FitnessConnectionStatus`,
  `StravaActivity`, and `FitnessSource` alias. Created in Phase 2 Task 59.
- `types/match.ts` — `Match`, `MatchWithProfile` interfaces. Phase 1.
- `types/message.ts` — `Message`, `MessageType`. Phase 1.
- `types/event.ts` — **does not exist yet**.
- `types/checkin.ts` — **does not exist yet**.

**Files that import from `types/user.ts` and will automatically benefit from the new fields:**
`store/profileStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`,
`components/discovery/SwipeCard.tsx`, `components/discovery/FullProfileModal.tsx`,
`app/profile/ProfileScreen.tsx` — all of these already import `UserProfile`. No changes
needed in those files; TypeScript will expose the new optional fields automatically.

**Key architecture note from Phase 2 remediation (unplanned Task 70 in git):**
`functions/src/onPrimaryPhotoChanged.ts` was created to clear `photoVerified`/`verifiedAt`
when a user's primary photo changes. This is already in the codebase — do not recreate it.
`recordSwipe.ts` already rejects non-premium superlike attempts server-side.
Both of these are existing state; Task 70 (Phase 3) is types only.

**`GeoPoint` import pattern in this codebase:** `import { GeoPoint, Timestamp } from 'firebase/firestore'`
for client-side types. Cloud Functions use `admin.firestore.GeoPoint` — but in `types/` files
(client-side), use the Firebase JS SDK import.

**Do not touch any existing fields in `types/user.ts`.** Only append the five new optional
fields. Do not rename, remove, or reorder existing fields.

**Do not touch `types/subscription.ts`, `types/fitness.ts`, `types/match.ts`,
`types/message.ts`.** Those files are out of scope for this task.

---

## Task 70 — Update TypeScript Types for Phase 3

**Files to create:**
- `types/event.ts`
- `types/checkin.ts`

**Files to modify:**
- `types/user.ts` — append five new optional fields to `UserProfile`

---

### `types/user.ts` — Update

Append these five optional fields to the existing `UserProfile` interface.
Add them after the last existing field (`language: string`).
Do not touch any other part of the file.

```typescript
// Add these five fields to UserProfile, after `language: string`:

timezone?: string
// IANA timezone string, e.g. 'Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Bangkok'
// Written at onboarding Step 1 (Task 81). Used by recordSwipe and verifyProfilePhoto
// Cloud Functions (Task 82) for per-user midnight reset. Optional so existing users
// without the field fall back to 'Asia/Kuala_Lumpur' on the server side.

incognito?: boolean
// Pro tier feature. When true, this user is excluded from all other users'
// discovery stacks by getDiscoveryStack (Task 73). The user themselves can still
// swipe normally. Client-writable (same as `paused`). Defaults to false if absent.

boostExpiresAt?: Timestamp
// Pro tier feature. Set server-side by the activateBoost Cloud Function (Task 74).
// When present and in the future, getDiscoveryStack adds a scoring bonus.
// Blocked from client writes by firestore.rules (Task 87).

videoProfileUrl?: string
// Cloud Storage download URL for the user's short video loop (max 15s).
// Uploaded via storage.uploadVideoProfile (Task 77).
// Empty string means no video — treat '' and undefined identically.

gymCheckin?: {
  gymName: string
  expiresAt: Timestamp
}
// Denormalised snapshot written by the createCheckin Cloud Function (Task 79)
// alongside the /gymCheckins/{id} document. Allows SwipeCard to show the
// "At gym" badge without an extra collection query. Cleared on check-out.
```

---

### `types/event.ts`

New file. All exports are named exports. No default export.
Used by `store/eventsStore.ts` (Task 80), `app/events/EventsScreen.tsx` (Task 80),
`app/events/CreateEventScreen.tsx` (Task 80), `app/events/EventDetailScreen.tsx` (Task 80),
and `components/events/EventCard.tsx` (Task 80).

```typescript
import { GeoPoint, Timestamp } from 'firebase/firestore'

import type { UserProfile } from '@/types/user'

// Location shape used inside FitlinkEvent.
// placeId is the Google Places ID — required for check-in and share deep-link.
export interface EventLocation {
  name: string
  address: string
  coordinates: GeoPoint
  placeId: string
}

// Mirrors the /events/{eventId} Firestore document schema exactly.
// matchId convention: auto-generated by Firestore (addDoc).
export interface FitlinkEvent {
  id: string                     // document ID, not stored in document — populated client-side after fetch
  creatorId: string
  title: string
  description: string
  activityType: string           // maps to values in the activities list (e.g. 'Gym', 'Running')
  location: EventLocation
  startAt: Timestamp
  endAt: Timestamp
  maxAttendees: number | null    // null means unlimited
  attendees: string[]            // array of userIds; creator is always first entry
  city: string
  country: string
  createdAt: Timestamp
  cancelled: boolean
}

// RSVP state for the current user relative to a specific event.
export type EventRSVPStatus = 'attending' | 'notAttending' | 'none'

// Enriched version with resolved attendee profiles for EventDetailScreen.
// attendeeProfiles contains only the first 5 profiles (display cap).
export interface EventWithAttendeeProfiles extends FitlinkEvent {
  attendeeProfiles: UserProfile[]
}
```

---

### `types/checkin.ts`

New file. All exports are named exports. No default export.
Used by `services/places.ts` (Task 78), `store/checkinStore.ts` (Task 79),
`app/checkin/GymCheckinScreen.tsx` (Task 79), `components/checkin/GymSearchList.tsx` (Task 79),
`components/checkin/ActiveCheckinBanner.tsx` (Task 79), and
`components/discovery/SwipeCard.tsx` (Task 79).

```typescript
import { GeoPoint, Timestamp } from 'firebase/firestore'

// Mirrors the /gymCheckins/{checkinId} Firestore document schema exactly.
// id is the document ID, populated client-side after fetch — not stored in the document.
export interface GymCheckin {
  id: string
  userId: string
  placeId: string
  gymName: string
  coordinates: GeoPoint
  city: string
  checkedInAt: Timestamp
  expiresAt: Timestamp           // 2 hours after checkedInAt
}

// Shape returned by services/places.ts from the Google Places API (New).
// Used in GymSearchList, GymCheckinScreen, and the createCheckin Cloud Function call.
export interface GymPlace {
  placeId: string
  name: string
  address: string
  coordinates: GeoPoint
  rating?: number                // 0.0–5.0 from Google Places
  photoUrl?: string              // constructed from places.getPlacePhotoUrl()
}
```

---

## Important Architecture Notes for Codex

1. **Append only to `UserProfile` — no other changes to `types/user.ts`.** The file
   already has all Phase 2 fields. Add the five new fields exactly as scaffolded above,
   after `language: string`, and stop. Do not reformat, re-order, or touch anything else
   in the file.

2. **`id` field in `FitlinkEvent` and `GymCheckin` is client-populated, not Firestore-stored.**
   Firestore documents do not contain their own ID. The `id` field is set by the client
   after `addDoc` / `onSnapshot` returns. Do not include `id` in any Firestore write — only
   in the TypeScript interface for use after the document is fetched.

3. **`GeoPoint` import comes from `firebase/firestore` in type files.** This is the client
   SDK. Cloud Functions use `admin.firestore.GeoPoint` — but `types/` files are client-only.
   Do not import from `firebase-admin` in any `types/` file.

4. **No barrel re-exports required.** Do not create or modify an `index.ts` in `types/`.
   Each file is imported directly by the modules that need it, using `@/types/event` and
   `@/types/checkin`. This matches the existing pattern in the codebase.

5. **`gymCheckin` in `UserProfile` is a denormalised snapshot, not a reference.**
   It is written by a Cloud Function alongside the `/gymCheckins/{id}` document. It should
   never be written directly by the client. Document this with a comment in `types/user.ts`
   exactly as shown in the scaffold above.

---

## Acceptance Criteria

- [ ] `types/event.ts` created with `EventLocation`, `FitlinkEvent`, `EventRSVPStatus`,
      and `EventWithAttendeeProfiles` as named exports
- [ ] `types/checkin.ts` created with `GymCheckin` and `GymPlace` as named exports
- [ ] `types/user.ts` `UserProfile` interface has five new optional fields appended:
      `timezone?`, `incognito?`, `boostExpiresAt?`, `videoProfileUrl?`, `gymCheckin?`
- [ ] `gymCheckin` field in `UserProfile` is typed as `{ gymName: string; expiresAt: Timestamp }`
- [ ] `GeoPoint` and `Timestamp` imported from `'firebase/firestore'` in both new files
- [ ] `FitlinkEvent` contains `id: string` field (client-populated, not stored in Firestore)
- [ ] `GymCheckin` contains `id: string` field (client-populated, not stored in Firestore)
- [ ] No existing fields removed or renamed in `types/user.ts`
- [ ] No changes made to `types/subscription.ts`, `types/fitness.ts`, `types/match.ts`,
      `types/message.ts`
- [ ] All exports in new files are named exports — no default exports
- [ ] Zero relative imports — all imports use `@/` alias or package names
- [ ] Zero `any` types
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`types/subscription.ts`, `types/fitness.ts`, `types/match.ts`, `types/message.ts`,
`App.tsx`, `store/authStore.ts`, `store/profileStore.ts`, `store/discoveryStore.ts`,
`services/firebase/config.ts`, `services/firebase/firestore.ts`,
`functions/src/recordSwipe.ts`, `functions/src/getDiscoveryStack.ts`,
`functions/src/onPrimaryPhotoChanged.ts`, `firestore.rules`, `firestore.indexes.json`,
`constants/`, `i18n/`, `components/`, `app/`

---

## Commit

```
git commit -m "task-70: add Phase 3 TypeScript types — event, checkin, UserProfile fields"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3A — Task 70] — YYYY-MM-DD

### Completed

- Task 70: Phase 3 TypeScript type foundation added
- types/event.ts: new file — EventLocation, FitlinkEvent, EventRSVPStatus,
  EventWithAttendeeProfiles named exports
- types/checkin.ts: new file — GymCheckin, GymPlace named exports
- types/user.ts: UserProfile extended with timezone?, incognito?, boostExpiresAt?,
  videoProfileUrl?, gymCheckin? fields

### Files Created / Modified

- types/event.ts: created — 4 named exports for workout events feature (Task 80)
- types/checkin.ts: created — 2 named exports for gym check-in feature (Task 79)
- types/user.ts: 5 new optional fields appended to UserProfile interface

### Architecture Decisions

- id field present in FitlinkEvent and GymCheckin interfaces but not stored in
  Firestore documents — populated client-side after fetch, matching codebase convention
- GeoPoint imported from firebase/firestore (client SDK) in type files; Cloud Functions
  use admin.firestore.GeoPoint separately
- gymCheckin in UserProfile is a denormalised snapshot written by createCheckin Cloud
  Function — never written directly by the client

### Known Issues / Deferred

- None — pure type additions, no runtime behaviour

### Next Up

- Task 71: Stripe Customer Portal Cloud Function — replace EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL
  env-var approach in PremiumScreen with a real createStripePortalSession callable function
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 71 prompt.

---

## Reasoning Level

Low
