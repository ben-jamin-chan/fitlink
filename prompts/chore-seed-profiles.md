# Chore — Beta Seed Profile Generator

@CONVENTIONS.md @ARCHITECT.md

---

## Context

This is a one-off operational script for populating the discovery deck ahead of beta
testing. It is **not** a Phase 4 or Phase 5 spec task — there is no corresponding entry
in `TASKS_PHASE4.md`. It creates 12 synthetic profiles, tagged so they can be found and
removed after the beta concludes.

**This script writes directly via the Firebase Admin SDK. It does not go through the
mobile app's onboarding flow, phone/Google/Apple auth, or the `onUserCreated` Cloud
Function.** Because it bypasses `onUserCreated`, the script itself must compute and
write the `age` field to match what that CF would have produced — see Step 3 below.

**Scope:** Malaysia only, all 12 profiles. This matches the primary beta cohort (Kuala
Lumpur-based testers) without needing per-tester geo overrides.

**Photos:** 12 stylized SVG avatar illustrations have already been generated
(non-photorealistic, clearly illustrated art — not AI-photoreal, not real photos of real
people) and will be supplied separately as files named `seed-avatar-01.svg` through
`seed-avatar-12.svg`. This script does NOT generate or source images — it uploads the
already-provided files to Cloud Storage and writes their download URLs to `photos[0]`.

---

## Pre-Task Dependency Check

**Required outputs from prior tasks — verify present before writing any code:**

- `types/user.ts` must have the full `/users/{userId}` interface as documented in
  ARCHITECT.md (Phase 1–3 fields) — verify it is present and importable
- Firebase Admin SDK must already be initialized in `functions/src/` with credentials
  available in the target environment — verify `functions/src/index.ts` or an
  equivalent admin-init module exists
- The 12 seed avatar SVG files must be supplied at a known local path before running —
  the script should read from a configurable input directory, not assume a hardcoded
  path

> If Firebase Admin SDK initialization pattern cannot be found in `functions/src/`,
> STOP and output a DEPENDENCY ERROR block rather than writing a fresh admin-init
> pattern that might diverge from the existing one.

---

## Task — Seed Profile Generator Script

**Files to create:**
- `scripts/seedBetaProfiles.ts` (new — lives outside `functions/src/` since this is an
  operational script, not a deployed Cloud Function; run via `ts-node` or compiled
  separately, NOT deployed with `firebase deploy --only functions`)
- `scripts/seedBetaProfiles.config.ts` (new — the 12 profile definitions, kept separate
  from execution logic so profile data can be edited without touching script logic)

**Files to modify:** None. This script does not touch any existing app file.

---

### `scripts/seedBetaProfiles.config.ts`

> Defines the 12 seed profile records as plain data. No execution logic here.

```typescript
export interface SeedProfileDefinition {
  avatarFile: string          // e.g. 'seed-avatar-01.svg' — must match a file in the input directory
  firstName: string
  dateOfBirth: string          // ISO date string, e.g. '1996-03-14' — used to compute age
  gender: 'male' | 'female' | 'non-binary'
  bio: string
  height: number                // cm
  activities: string[]
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | 'athlete'
  workoutFrequency: string
  dietaryPreference: string
  fitnessGoals: string[]
  smoking: 'yes' | 'no' | 'occasionally'
  drinking: 'yes' | 'no' | 'socially'
  lookingFor: Array<'friends' | 'workout_partners' | 'dating'>
  city: string                  // must be a value from SEA_CITIES.Malaysia
}

// All 12 profiles use city values from constants/regions.ts SEA_CITIES.Malaysia.
// Bios are short, generic, and non-identifying — these are not meant to resemble
// any real person. Vary activities/fitnessLevel/lookingFor across the set so the
// deck has some texture for mechanics testing, not 12 identical records.

export const SEED_PROFILES: SeedProfileDefinition[] = [
  {
    avatarFile: 'seed-avatar-01.svg',
    firstName: 'Aiman',
    dateOfBirth: '1997-05-12',
    gender: 'male',
    bio: 'Morning runs and iced kopi. Looking for someone to keep pace with.',
    height: 175,
    activities: ['Running', 'Cycling'],
    fitnessLevel: 'intermediate',
    workoutFrequency: '4-5 times a week',
    dietaryPreference: 'No restrictions',
    fitnessGoals: ['Endurance', 'General fitness'],
    smoking: 'no',
    drinking: 'socially',
    lookingFor: ['dating', 'workout_partners'],
    city: 'Kuala Lumpur',
  },
  {
    avatarFile: 'seed-avatar-02.svg',
    firstName: 'Farid',
    dateOfBirth: '1994-11-03',
    gender: 'male',
    bio: 'Gym before work, always. Open to new lifting partners.',
    height: 180,
    activities: ['Weightlifting', 'CrossFit'],
    fitnessLevel: 'advanced',
    workoutFrequency: '6+ times a week',
    dietaryPreference: 'High protein',
    fitnessGoals: ['Strength', 'Muscle gain'],
    smoking: 'no',
    drinking: 'no',
    lookingFor: ['workout_partners', 'friends'],
    city: 'Petaling Jaya',
  },
  {
    avatarFile: 'seed-avatar-03.svg',
    firstName: 'Mei Ling',
    dateOfBirth: '1998-02-20',
    gender: 'female',
    bio: 'Yoga instructor on weekends. Balance in everything.',
    height: 162,
    activities: ['Yoga', 'Pilates'],
    fitnessLevel: 'advanced',
    workoutFrequency: '4-5 times a week',
    dietaryPreference: 'Vegetarian',
    fitnessGoals: ['Flexibility', 'Mindfulness'],
    smoking: 'no',
    drinking: 'socially',
    lookingFor: ['dating'],
    city: 'Kuala Lumpur',
  },
  {
    avatarFile: 'seed-avatar-04.svg',
    firstName: 'Ravi',
    dateOfBirth: '1995-08-17',
    gender: 'male',
    bio: 'Weekend cyclist, weekday desk job. Trying to even that out.',
    height: 172,
    activities: ['Cycling', 'Swimming'],
    fitnessLevel: 'intermediate',
    workoutFrequency: '2-3 times a week',
    dietaryPreference: 'No restrictions',
    fitnessGoals: ['General fitness', 'Weight loss'],
    smoking: 'no',
    drinking: 'socially',
    lookingFor: ['friends', 'workout_partners'],
    city: 'Subang Jaya',
  },
  {
    avatarFile: 'seed-avatar-05.svg',
    firstName: 'Danish',
    dateOfBirth: '1993-01-29',
    gender: 'male',
    bio: 'Boxing three times a week keeps me sane.',
    height: 178,
    activities: ['Boxing', 'HIIT'],
    fitnessLevel: 'advanced',
    workoutFrequency: '4-5 times a week',
    dietaryPreference: 'High protein',
    fitnessGoals: ['Strength', 'Endurance'],
    smoking: 'no',
    drinking: 'no',
    lookingFor: ['dating', 'workout_partners'],
    city: 'Kuala Lumpur',
  },
  {
    avatarFile: 'seed-avatar-06.svg',
    firstName: 'Siti',
    dateOfBirth: '1999-06-08',
    gender: 'female',
    bio: 'Pool laps before the sun gets too much.',
    height: 165,
    activities: ['Swimming', 'Running'],
    fitnessLevel: 'intermediate',
    workoutFrequency: '2-3 times a week',
    dietaryPreference: 'No restrictions',
    fitnessGoals: ['Endurance', 'General fitness'],
    smoking: 'no',
    drinking: 'socially',
    lookingFor: ['dating', 'friends'],
    city: 'Shah Alam',
  },
  {
    avatarFile: 'seed-avatar-07.svg',
    firstName: 'Hafiz',
    dateOfBirth: '1996-09-22',
    gender: 'male',
    bio: 'Best conversations happen on a trail, not a couch.',
    height: 176,
    activities: ['Hiking', 'Running'],
    fitnessLevel: 'intermediate',
    workoutFrequency: '2-3 times a week',
    dietaryPreference: 'No restrictions',
    fitnessGoals: ['General fitness', 'Endurance'],
    smoking: 'no',
    drinking: 'socially',
    lookingFor: ['dating', 'friends'],
    city: 'Kuala Lumpur',
  },
  {
    avatarFile: 'seed-avatar-08.svg',
    firstName: 'Nadia',
    dateOfBirth: '1997-12-05',
    gender: 'female',
    bio: 'Dance cardio over the treadmill, every time.',
    height: 160,
    activities: ['Dance', 'Pilates'],
    fitnessLevel: 'intermediate',
    workoutFrequency: '2-3 times a week',
    dietaryPreference: 'No restrictions',
    fitnessGoals: ['General fitness', 'Flexibility'],
    smoking: 'no',
    drinking: 'socially',
    lookingFor: ['dating'],
    city: 'Petaling Jaya',
  },
  {
    avatarFile: 'seed-avatar-09.svg',
    firstName: 'Kevin',
    dateOfBirth: '1992-04-14',
    gender: 'male',
    bio: 'Weekends mean climbing gyms, not malls.',
    height: 174,
    activities: ['Rock climbing', 'Weightlifting'],
    fitnessLevel: 'advanced',
    workoutFrequency: '4-5 times a week',
    dietaryPreference: 'No restrictions',
    fitnessGoals: ['Strength', 'General fitness'],
    smoking: 'no',
    drinking: 'socially',
    lookingFor: ['workout_partners', 'friends'],
    city: 'Kuala Lumpur',
  },
  {
    avatarFile: 'seed-avatar-10.svg',
    firstName: 'Aisyah',
    dateOfBirth: '2000-07-19',
    gender: 'female',
    bio: 'Pilates reformer classes, three times a week, non-negotiable.',
    height: 158,
    activities: ['Pilates', 'Yoga'],
    fitnessLevel: 'intermediate',
    workoutFrequency: '2-3 times a week',
    dietaryPreference: 'Vegetarian',
    fitnessGoals: ['Flexibility', 'General fitness'],
    smoking: 'no',
    drinking: 'no',
    lookingFor: ['dating', 'friends'],
    city: 'Cyberjaya',
  },
  {
    avatarFile: 'seed-avatar-11.svg',
    firstName: 'Zack',
    dateOfBirth: '1995-03-27',
    gender: 'male',
    bio: 'Pickup basketball on Sundays. Come find me at the court.',
    height: 182,
    activities: ['Basketball', 'Running'],
    fitnessLevel: 'intermediate',
    workoutFrequency: '2-3 times a week',
    dietaryPreference: 'No restrictions',
    fitnessGoals: ['General fitness', 'Endurance'],
    smoking: 'no',
    drinking: 'socially',
    lookingFor: ['friends', 'workout_partners'],
    city: 'Kuala Lumpur',
  },
  {
    avatarFile: 'seed-avatar-12.svg',
    firstName: 'Iman',
    dateOfBirth: '1994-10-11',
    gender: 'female',
    bio: 'Muay Thai twice a week. Not here to talk about the weather.',
    height: 163,
    activities: ['Martial arts', 'HIIT'],
    fitnessLevel: 'advanced',
    workoutFrequency: '4-5 times a week',
    dietaryPreference: 'High protein',
    fitnessGoals: ['Strength', 'Endurance'],
    smoking: 'no',
    drinking: 'no',
    lookingFor: ['dating', 'workout_partners'],
    city: 'Petaling Jaya',
  },
]
```

---

### `scripts/seedBetaProfiles.ts`

> Execution logic. Reads `SEED_PROFILES`, creates Auth users, uploads avatars, writes
> Firestore docs. Idempotent-ish: checks for an existing seed account with the same
> `firstName` + `isSeedAccount: true` before creating a duplicate, so the script can be
> safely re-run if it fails partway through.

```typescript
// scripts/seedBetaProfiles.ts
//
// One-off operational script — NOT a Cloud Function, NOT deployed.
// Run locally with: npx ts-node scripts/seedBetaProfiles.ts <path-to-avatar-directory>
//
// Creates 12 tagged seed profiles for beta testing. Every created document carries
// isSeedAccount: true so it can be found and bulk-deleted after the beta concludes.

import * as admin from 'firebase-admin'
import * as fs from 'fs'
import * as path from 'path'
import { SEED_PROFILES, SeedProfileDefinition } from './seedBetaProfiles.config'

// Use the same Admin SDK initialization pattern already established in functions/src/.
// Do not write a new/divergent init pattern here — import or replicate exactly.
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const auth = admin.auth()
const storage = admin.storage()

const KL_COORDINATES = { lat: 3.139, lng: 101.6869 } // Kuala Lumpur city-center default

function computeAge(dateOfBirthISO: string): number {
  // Mirrors the age computation performed server-side in onUserCreated — this script
  // bypasses that CF, so age must be computed identically here rather than left absent
  // or hardcoded, to avoid a seed doc silently violating the age-is-always-present
  // invariant that the rest of the app assumes.
  const dob = new Date(dateOfBirthISO)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }
  return age
}

async function findExistingSeedUid(firstName: string): Promise<string | null> {
  const snapshot = await db
    .collection('users')
    .where('isSeedAccount', '==', true)
    .where('firstName', '==', firstName)
    .limit(1)
    .get()
  if (snapshot.empty) return null
  return snapshot.docs[0].id
}

async function uploadAvatar(uid: string, avatarLocalPath: string): Promise<string> {
  const bucket = storage.bucket()
  const destination = `users/${uid}/photos/0.jpg`
  await bucket.upload(avatarLocalPath, {
    destination,
    metadata: { contentType: 'image/svg+xml' },
  })
  const file = bucket.file(destination)
  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${destination}`
}

async function createSeedProfile(
  def: SeedProfileDefinition,
  avatarDir: string
): Promise<void> {
  const existingUid = await findExistingSeedUid(def.firstName)
  if (existingUid) {
    console.log(`Skipping ${def.firstName} — seed account already exists (${existingUid})`)
    return
  }

  const avatarLocalPath = path.join(avatarDir, def.avatarFile)
  if (!fs.existsSync(avatarLocalPath)) {
    throw new Error(
      `Avatar file not found: ${avatarLocalPath}. Ensure all 12 seed-avatar-*.svg ` +
      `files are present in the supplied directory before running this script.`
    )
  }

  // Create the Auth user directly — no phone/Google/Apple sign-in flow is exercised.
  const userRecord = await auth.createUser({
    email: `seed-${def.firstName.toLowerCase().replace(/\s+/g, '')}@fitlink-seed.internal`,
    emailVerified: true,
    disabled: false,
  })
  const uid = userRecord.uid

  const photoUrl = await uploadAvatar(uid, avatarLocalPath)
  const age = computeAge(def.dateOfBirth)

  await db.doc(`users/${uid}`).set({
    uid,
    firstName: def.firstName,
    dateOfBirth: admin.firestore.Timestamp.fromDate(new Date(def.dateOfBirth)),
    age, // computed above — mirrors onUserCreated CF output since that CF is bypassed
    gender: def.gender,
    location: {
      city: def.city,
      country: 'Malaysia',
      coordinates: new admin.firestore.GeoPoint(KL_COORDINATES.lat, KL_COORDINATES.lng),
    },
    photos: [photoUrl],
    bio: def.bio,
    height: def.height,
    activities: def.activities,
    fitnessLevel: def.fitnessLevel,
    workoutFrequency: def.workoutFrequency,
    dietaryPreference: def.dietaryPreference,
    fitnessGoals: def.fitnessGoals,
    smoking: def.smoking,
    drinking: def.drinking,
    lookingFor: def.lookingFor,
    preferences: {
      ageRange: { min: 21, max: 45 },
      distanceKm: 50,
      genders: ['male', 'female', 'non-binary'],
    },
    stats: { likes: 0, passes: 0, matches: 0 },
    subscription: { tier: 'free' },
    verified: false,
    paused: false,
    banned: false,
    language: 'en',
    timezone: 'Asia/Kuala_Lumpur',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastActive: admin.firestore.FieldValue.serverTimestamp(),
    isSeedAccount: true, // NOT rendered anywhere in client UI — internal query/cleanup flag only
  })

  console.log(`Created seed profile: ${def.firstName} (${uid})`)
}

async function main(): Promise<void> {
  const avatarDir = process.argv[2]
  if (!avatarDir) {
    console.error('Usage: npx ts-node scripts/seedBetaProfiles.ts <path-to-avatar-directory>')
    process.exit(1)
  }
  if (!fs.existsSync(avatarDir)) {
    console.error(`Avatar directory not found: ${avatarDir}`)
    process.exit(1)
  }

  console.log(`Seeding ${SEED_PROFILES.length} beta profiles (Malaysia only)...`)
  for (const def of SEED_PROFILES) {
    await createSeedProfile(def, avatarDir)
  }
  console.log('Done.')
}

main().catch((error) => {
  console.error('Seed script failed:', error)
  process.exit(1)
})
```

---

## Important Architecture Notes for Codex

1. **`isSeedAccount` is a schema addition to `/users/{userId}` — but not a `types/user.ts`
   change.** Add it as an optional field (`isSeedAccount?: boolean`) to the `UserProfile`
   interface in `types/user.ts` so it's typed, but this is the only client-facing file
   this script's schema choice touches. No UI component should ever read or branch on
   this field — it exists solely for Admin SDK / script-level querying.

2. **This script does not respect `firestore.rules`.** It uses the Admin SDK, which
   bypasses security rules by design (same pattern as any other Cloud Function). This is
   intentional and matches how `checkReportThreshold` and other server-only writes
   already work — not a gap to flag.

3. **Do not add these profiles to any Cloud Function's discovery scoring or matching
   logic as a special case.** They should be indistinguishable from real profiles to
   `getDiscoveryStack` and `onSwipeCreated` — that's the entire point, since the goal is
   testing real mechanics. The only place `isSeedAccount` should ever be read is a
   future cleanup script, not `getDiscoveryStack`, `recordSwipe`, or any client code.

4. **Photo upload uses `contentType: 'image/svg+xml'`, not `image/jpeg`**, since the
   supplied avatars are SVG illustrations, not compressed JPEGs. This deliberately
   deviates from CONVENTIONS.md Section 12's normal photo pipeline (max 1080px,
   80% quality JPEG via `expo-image-manipulator`) because these are pre-made vector
   illustrations, not user-uploaded camera/gallery photos — the compression pipeline
   doesn't apply and shouldn't be run against them.

---

## Rollback Protocol

If the script fails partway through (e.g. avatar upload fails for profile 7 of 12):

1. The script is safe to re-run — `findExistingSeedUid` skips already-created profiles
   by `firstName` + `isSeedAccount` match, so re-running after a partial failure will
   only create the remaining profiles, not duplicate the successful ones.
2. If a specific profile fails repeatedly, do not modify the retry logic to swallow the
   error — surface it. A partial seed set (e.g. 9 of 12) is fine to proceed with for
   beta purposes; report which profiles succeeded and which didn't rather than blocking
   on 100% completion.

---

## Codex Self-Check (Run Before Declaring Done)

- [ ] Script does NOT deploy as a Cloud Function — confirm it lives in `scripts/`, not
      `functions/src/`, and is not exported from `functions/src/index.ts`
- [ ] Every created `/users/{uid}` doc has `isSeedAccount: true`
- [ ] `age` is computed in-script (not left absent, not hardcoded) via `computeAge()`
- [ ] All 12 profiles use `location.country: 'Malaysia'` and a city from
      `SEA_CITIES.Malaysia`
- [ ] Script is idempotent on re-run (checks for existing seed account by `firstName`
      before creating a duplicate)
- [ ] `types/user.ts` — `isSeedAccount?: boolean` added as optional, not required
- [ ] No client-side file (`app/`, `components/`, `store/`) reads or branches on
      `isSeedAccount` anywhere
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Acceptance Criteria

- [ ] Running `npx ts-node scripts/seedBetaProfiles.ts <avatar-dir>` creates 12 Auth
      users and 12 corresponding `/users/{uid}` Firestore documents
- [ ] Each document is tagged `isSeedAccount: true`
- [ ] Each document's `photos[0]` points to a valid Cloud Storage URL for the
      corresponding avatar
- [ ] Seed profiles appear in `getDiscoveryStack` results for a real account located in
      a Malaysian city, using standard discovery scoring (no special-casing)
- [ ] Re-running the script after a partial run does not create duplicate profiles for
      already-seeded names

---

## Do Not Touch

Every file except `scripts/seedBetaProfiles.ts`, `scripts/seedBetaProfiles.config.ts`,
and the single optional-field addition to `types/user.ts`. In particular: no changes to
`getDiscoveryStack.ts`, `onSwipeCreated.ts`, `recordSwipe.ts`, `firestore.rules`, or any
client-side discovery/swipe component.

---

## Commit

```
git commit -m "chore: add beta seed profile generator script (12 tagged Malaysia profiles)"
```

---

## After This Session

Append a short note to `CHANGELOG.md` under a `## [Chore — Beta seed profiles]` heading
with today's date: how many profiles were successfully created, confirmation
`isSeedAccount: true` is present on all of them, and confirmation `types/user.ts` now
has the optional field. No "Next Up" needed — this isn't part of the Phase 4/5 task
chain. Note in the entry that these profiles should be bulk-deleted after the beta
concludes (a separate cleanup script, not covered by this task).

---

## Reasoning Level

Medium — not Low, despite being a script rather than an app feature, because it writes
directly to Auth and Firestore outside the normal signup path and needs the age-mirror
logic to be correct. Not High/Extra High — it touches no existing production code path,
no security rules, and is fully reversible (delete-by-flag).
