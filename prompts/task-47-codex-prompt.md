@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1 is complete (Tasks 01–46). Phase 2 begins here. This is the first task of Phase 2 and
must be completed before any other Phase 2 task runs — every subsequent task depends on the
updated type definitions produced here.

**Existing files Codex needs to read before touching anything:**

- `types/user.ts` — `UserProfile` interface with `verified: boolean` and
  `subscription: { tier: 'free' | 'premium'; expiresAt?: Timestamp }`. These fields are being
  replaced or extended in this task.
- `types/subscription.ts` — `SubscriptionTier` and `SubscriptionStatus` types. New types are
  being added here.
- `types/match.ts` — unchanged; confirm no references to `subscription.tier` or `verified`.
- `types/message.ts` — unchanged; no edits needed.
- `store/profileStore.ts` — reads `profile.subscription.tier`. All such reads must be migrated.
- `store/discoveryStore.ts` — reads `subscription.tier === 'premium'` in daily-likes gate and
  upsell logic. All such reads must be migrated.
- `components/discovery/UpsellModal.tsx` — reads premium status. Must be migrated.
- `app/profile/ProfileScreen.tsx` — renders subscription/premium state. Must be migrated.
- `app/settings/SettingsScreen.tsx` — renders subscription status and "Upgrade" banner.
  Must be migrated.
- `app/onboarding/Step6Screen.tsx` — calls `createUserProfile()`; confirm `subscription` field
  shape is updated in the write payload.
- `services/firebase/firestore.ts` — `createUserProfile()` sets initial subscription data.
  Must be updated to write `premium` instead of `subscription`.

**Critical boundary:** This task is types and reference-migration only. No UI changes, no new
screens, no Stripe code, no Cloud Function code. The goal is a codebase that compiles cleanly
with the new schema before any Phase 2 feature is layered on top.

---

## Task 47 — Update TypeScript Types for Phase 2

**Files to create:**
- _(none — no new files)_

**Files to modify:**
- `types/user.ts` — rename `verified` → `photoVerified`, add `verifiedAt?`, replace
  `subscription` block with `premium` block, add `stripeCustomerId?`, add `fitnessTracking`
- `types/subscription.ts` — add `PremiumTier`, `PremiumStatus`, `StripePrice`,
  `FitnessTrackingSource`, `TodayStats`, `WorkoutSession`
- Every file that references `user.verified`, `subscription.tier`, or `subscription.expiresAt`
  — see migration map below

---

### `types/user.ts` — Full Rewrite

Replace the entire file. Preserve all fields that are not changing. Apply every schema change
listed below exactly as specified.

**Fields being removed / replaced:**

| Old field | Replacement |
|---|---|
| `verified: boolean` | `photoVerified: boolean` |
| `subscription: { tier: 'free' \| 'premium'; expiresAt?: Timestamp }` | `premium: PremiumStatus` (imported from `types/subscription.ts`) |

**New fields to add (add after `expoPushToken?`):**

```typescript
stripeCustomerId?: string
fitnessTracking?: FitnessTracking
```

**Complete updated `types/user.ts`:**

```typescript
import type { Timestamp, GeoPoint } from 'firebase/firestore'
import type { PremiumStatus, FitnessTracking } from '@/types/subscription'

export type Gender = 'male' | 'female' | 'non-binary'

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'athlete'

export type LookingFor = 'friends' | 'workout_partners' | 'dating'

export type SmokingStatus = 'yes' | 'no' | 'occasionally'

export type DrinkingStatus = 'yes' | 'no' | 'socially'

export interface UserPreferences {
  ageRange: { min: number; max: number }
  distanceKm: number
  genders: string[]
  lookingFor: LookingFor[]
}

export interface UserStats {
  likes: number
  passes: number
  matches: number
}

export interface UserProfile {
  uid: string
  firstName: string
  dateOfBirth: Timestamp
  age: number                          // calculated server-side — never trust client
  gender: Gender
  location: {
    city: string
    country: string
    coordinates: GeoPoint
  }
  photos: string[]                     // Cloud Storage URLs; index 0 = primary photo
  bio: string                          // 50–500 chars
  height: number                       // cm
  religion?: string
  activities: string[]
  fitnessLevel: FitnessLevel
  workoutFrequency: string
  dietaryPreference: string
  fitnessGoals: string[]
  smoking: SmokingStatus
  drinking: DrinkingStatus
  lookingFor: LookingFor[]
  preferences: UserPreferences
  stats: UserStats
  premium: PremiumStatus               // replaces subscription — Phase 2
  photoVerified: boolean               // replaces verified — Phase 2
  verifiedAt?: Timestamp
  stripeCustomerId?: string
  fitnessTracking?: FitnessTracking
  paused: boolean
  banned: boolean
  expoPushToken?: string
  language: string
  createdAt: Timestamp
  lastActive: Timestamp
}
```

---

### `types/subscription.ts` — Full Rewrite

Replace the entire file with the following:

```typescript
import type { Timestamp } from 'firebase/firestore'

// ─── Subscription / Premium ──────────────────────────────────────────────────

export type PremiumTier = 'plus' | 'pro'

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'

export interface PremiumStatus {
  active: boolean
  tier: PremiumTier | null
  subscriptionId: string | null
  expiresAt: Timestamp | null
}

export interface StripePrice {
  priceId: string
  amount: number                       // in smallest currency unit (e.g. cents for MYR)
  currency: string                     // ISO 4217 (e.g. 'MYR', 'SGD')
  interval: 'month' | '3month' | '6month'
}

// ─── Fitness Tracking ─────────────────────────────────────────────────────────

export type FitnessTrackingSource = 'appleHealth' | 'googleFit' | 'strava'

export interface WorkoutSession {
  type: string
  duration: number                     // minutes
  distance?: number                    // km
  calories?: number
  elevation?: number                   // metres (Strava)
}

export interface TodayStats {
  steps: number
  distance: number                     // km
  calories: number
  workouts: WorkoutSession[]
  updatedAt: Timestamp
  source?: FitnessTrackingSource
}

export interface FitnessSourceConnection {
  connected: boolean
  lastSync: Timestamp | null
}

export interface StravaConnection extends FitnessSourceConnection {
  accessToken: string
  refreshToken: string                 // stored encrypted — never expose client-side
  expiresAt: number                    // Unix timestamp (seconds)
}

export interface FitnessTracking {
  appleHealth?: FitnessSourceConnection
  googleFit?: FitnessSourceConnection
  strava?: StravaConnection
  todayStats?: TodayStats
  shareOnProfile: boolean
}
```

---

### Reference Migration — All Files Touching Old Fields

Codex must search every file under `app/`, `components/`, `store/`, `services/`, `hooks/`,
and `utils/` for the patterns listed below and apply the corresponding replacement.

**Do not change function signatures, logic, or component layout — change field access only.**

#### Pattern 1 — `user.verified` or `profile.verified`

| Find | Replace with |
|---|---|
| `user.verified` | `user.photoVerified` |
| `profile.verified` | `profile.photoVerified` |
| `candidate.verified` | `candidate.photoVerified` |

Affected files are likely: `components/discovery/SwipeCard.tsx`,
`components/discovery/FullProfileModal.tsx`, `app/profile/ProfileScreen.tsx`,
`app/matches/MatchesScreen.tsx`, `app/chat/ChatScreen.tsx`.

#### Pattern 2 — `subscription.tier`

| Find | Replace with |
|---|---|
| `subscription.tier === 'premium'` | `premium.active === true` |
| `subscription.tier === 'free'` | `premium.active === false` |
| `profile.subscription?.tier` | `profile.premium?.active` |
| `user.subscription.tier` | `user.premium.active` |

Affected files are likely: `store/discoveryStore.ts`, `store/profileStore.ts`,
`components/discovery/UpsellModal.tsx`, `app/settings/SettingsScreen.tsx`,
`app/profile/ProfileScreen.tsx`.

#### Pattern 3 — `subscription.expiresAt`

| Find | Replace with |
|---|---|
| `subscription.expiresAt` | `premium.expiresAt` |
| `subscription?.expiresAt` | `premium?.expiresAt` |

#### Pattern 4 — Firestore write in `createUserProfile()`

In `services/firebase/firestore.ts`, the `createUserProfile()` function writes the initial
document. Update the initial value of the subscription/premium field:

```typescript
// Remove:
subscription: { tier: 'free' }

// Replace with:
premium: {
  active: false,
  tier: null,
  subscriptionId: null,
  expiresAt: null,
} satisfies PremiumStatus,
photoVerified: false,
```

Import `PremiumStatus` from `@/types/subscription` at the top of `firestore.ts`.

#### Pattern 5 — `verified` in `onboardingStore.ts` initial state

If `onboardingStore.ts` sets any initial field named `verified`, update it to `photoVerified`.

---

## Important Architecture Notes for Codex

1. **Do not import `PremiumStatus` or `FitnessTracking` inline in component files.** They
   must be imported from `@/types/subscription`. The rule in CONVENTIONS.md Section 1 says
   export all types from `types/` — never define them inline.

2. **`photoVerified` is server-set only.** The `createUserProfile()` Firestore write must
   set `photoVerified: false` as the initial value. Client code never sets this to `true` —
   that is done by the `verifyProfilePhoto` Cloud Function in Task 56.

3. **`premium.active` is the canonical gate for all premium checks.** Never check
   `premium.tier === 'plus'` or `premium.tier === 'pro'` as a substitute for `premium.active`.
   Tier is used only to display which plan the user is on, not to gate features.

4. **`fitnessTracking` is optional on `UserProfile`.** Phase 1 users have no fitness tracking
   data. Any code reading `fitnessTracking.*` must use optional chaining (`?.`).

5. **`StravaConnection.refreshToken` is a string.** It is stored encrypted in Firestore by
   the Cloud Function. Client code never reads or writes this field directly. Do not add any
   client-side decryption logic here.

6. **After completing all replacements, run `npx tsc --noEmit`.** Zero errors are required
   before this task is considered done. If errors remain in files not listed in this prompt,
   track them down and fix them — they are caused by the same migration patterns.

---

## Acceptance Criteria

- [ ] `types/user.ts` contains `photoVerified: boolean`, `verifiedAt?: Timestamp`,
  `premium: PremiumStatus`, `stripeCustomerId?: string`, `fitnessTracking?: FitnessTracking`
- [ ] `types/user.ts` does NOT contain `verified: boolean` or `subscription: { tier: ... }`
- [ ] `types/subscription.ts` exports: `PremiumTier`, `SubscriptionStatus`, `PremiumStatus`,
  `StripePrice`, `FitnessTrackingSource`, `WorkoutSession`, `TodayStats`,
  `FitnessSourceConnection`, `StravaConnection`, `FitnessTracking`
- [ ] Zero occurrences of `user.verified`, `profile.verified`, `candidate.verified` remaining
  in `app/`, `components/`, `store/`, `hooks/`, `services/`
- [ ] Zero occurrences of `subscription.tier`, `subscription?.tier`, `subscription.expiresAt`
  remaining anywhere in client code
- [ ] `services/firebase/firestore.ts` `createUserProfile()` writes `premium` (not
  `subscription`) and `photoVerified: false` (not `verified`)
- [ ] All imports use `@/types/subscription` — no inline interface definitions in component
  or store files
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Zero `any` introduced

---

## Do Not Touch

`App.tsx`, `app/navigation/`, `constants/`, `i18n/`, `firestore.rules`,
`firestore.indexes.json`, `firebase.json`, `functions/`, `AGENTS.md`

---

## Commit

```
git commit -m "task-47: update typescript types for phase 2 premium and fitness schema"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2A — Task 47] — YYYY-MM-DD

### Completed

- Task 47: TypeScript types updated for Phase 2 schema
- types/user.ts: `verified` → `photoVerified`, `subscription` → `premium: PremiumStatus`,
  added `verifiedAt?`, `stripeCustomerId?`, `fitnessTracking?: FitnessTracking`
- types/subscription.ts: full rewrite — added PremiumTier, PremiumStatus, StripePrice,
  FitnessTrackingSource, WorkoutSession, TodayStats, FitnessSourceConnection,
  StravaConnection, FitnessTracking
- All references to `user.verified` migrated to `user.photoVerified`
- All references to `subscription.tier === 'premium'` migrated to `premium.active === true`
- createUserProfile() updated to write `premium` and `photoVerified` fields

### Files Created / Modified

- types/user.ts: schema updated per Phase 2 spec
- types/subscription.ts: full rewrite with Phase 2 premium + fitness types
- store/discoveryStore.ts: premium gate migrated
- store/profileStore.ts: subscription field access migrated
- services/firebase/firestore.ts: createUserProfile() initial write updated
- components/discovery/UpsellModal.tsx: premium check migrated
- components/discovery/SwipeCard.tsx: verified → photoVerified
- components/discovery/FullProfileModal.tsx: verified → photoVerified
- app/profile/ProfileScreen.tsx: verified + subscription migrated
- app/settings/SettingsScreen.tsx: subscription display migrated
- [any other files found during search]

### Architecture Decisions

- PremiumStatus is the single source of truth for all premium gates — tier is display-only
- FitnessTracking is optional on UserProfile — Phase 1 users have no fitness data
- StravaConnection.refreshToken is a server-only encrypted field — client never reads it

### Known Issues / Deferred

- None — this task is purely types and migration, no new runtime behaviour

### Next Up

- Task 48: Install Phase 2 dependencies (Stripe, expo-camera, expo-auth-session, etc.)
```

---

## Reasoning Level

High — schema migration touching many files; tsc must be clean before Phase 2 can proceed.
