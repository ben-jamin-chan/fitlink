# CODEX PROMPT — Task 78: Google Places Gym Search Service

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3C (Events & Community) begins here. Tasks 70–77 are complete. The relevant existing
state for this task:

- `types/checkin.ts` — `GymCheckin` and `GymPlace` interfaces already defined (Task 70);
  `GymPlace` is the return type that `searchNearbyGyms()` must produce. **Read this file
  before writing any code.**
- `types/event.ts` — `EventLocation`, `FitlinkEvent`, `EventRSVPStatus`,
  `EventWithAttendeeProfiles` defined (Task 70); not used in this task.
- `types/user.ts` — `UserProfile` now contains optional `gymCheckin` field (Task 70).
- `services/firebase/storage.ts` — `uploadProfilePhoto`, `uploadAllProfilePhotos`,
  `deleteProfilePhoto`, `uploadVerificationSelfie`, `uploadVoiceMessage`,
  `uploadVideoProfile` already exported; **do not touch this file**.
- `services/strava.ts` — third-party API client pattern to follow for structure reference.
- `.env.example` — existing placeholder keys for Firebase, Stripe, Google OAuth, Strava;
  `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is **not yet present** and must be added.
- `constants/theme.ts` — re-exports `colors`, `spacing`, `typography`; use exclusively
  for all style values.
- `i18n/en.json`, `my.json`, `zh.json`, `ta.json` — this task adds no user-facing strings
  (the service has no UI), so no i18n additions are required.

**This task creates exactly one new file: `services/places.ts`. No other file is created or
modified except `.env.example`. No screens, stores, components, or Cloud Functions are
touched. Task 79 consumes this service — do not pre-build any of Task 79's work here.**

**The Google Places API key lives in `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` and is a
client-restricted key. It must never be passed to Cloud Functions or any server-side code —
a separate unrestricted server key would be required for that, which is out of scope.**

---

## Task 78 — Google Places Gym Search Service

**Files to create:**
- `services/places.ts`

**Files to modify:**
- `.env.example` — add `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` placeholder

---

### `services/places.ts`

This is the typed HTTP client for the Google Places API (New) v1. It is consumed by
`store/checkinStore.ts` (Task 79) and `app/checkin/GymCheckinScreen.tsx` (Task 79) to
search for nearby gyms. It is a pure service module with no React, no hooks, and no side
effects beyond the `fetch` calls.

All API response shapes are defined as **file-local interfaces** (not exported) to avoid
polluting the `types/` namespace with third-party contract types. The public surface is only
`searchNearbyGyms` and `getPlacePhotoUrl`.

The function `searchNearbyGyms` calls the Places API (New) `POST /v1/places:searchNearby`
endpoint with `includedTypes` of `["gym", "fitness_center", "sports_complex"]` and maps the
results to the `GymPlace` type defined in `types/checkin.ts`.

The function `getPlacePhotoUrl` is a pure string builder — no network call — that constructs
the Places media URL from a photo resource name returned in search results.

```typescript
// 1. React imports — none (pure service module)

// 2. React Native imports — none

// 3. Third-party libraries — none

// 4. Internal — types
import type { GymPlace } from '@/types/checkin'

// ---------------------------------------------------------------------------
// File-local API response shape interfaces (not exported)
// These mirror the Google Places API (New) v1 JSON contract exactly.
// ---------------------------------------------------------------------------

interface PlaceDisplayName {
  text: string
  languageCode: string
}

interface PlaceLocation {
  latitude: number
  longitude: number
}

interface PlacePhoto {
  name: string
}

interface PlaceResult {
  id: string
  displayName: PlaceDisplayName
  formattedAddress: string
  location: PlaceLocation
  rating?: number
  photos?: PlacePhoto[]
}

interface NearbySearchResponse {
  places: PlaceResult[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACES_BASE_URL = 'https://places.googleapis.com/v1'

const PLACES_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.photos'

const INCLUDED_GYM_TYPES: string[] = ['gym', 'fitness_center', 'sports_complex']

const MAX_RESULT_COUNT = 10

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns EXPO_PUBLIC_GOOGLE_PLACES_API_KEY from the environment.
 *
 * IMPORTANT: This is a client-restricted key scoped to the app's bundle identifier.
 * It must never be forwarded to Cloud Functions or any server-side code.
 * A separate unrestricted server key would be required for server-side Places lookups
 * (out of scope for Phase 3).
 *
 * The key is resolved at call-time (not at module load) so that a missing key
 * surfaces with a meaningful error at the call site rather than silently on import.
 */
function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
  if (!key) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set. Add it to your .env file.'
    )
  }
  return key
}

/**
 * Maps a raw PlaceResult from the Places API to the GymPlace domain type.
 * photoUrl is populated from the first photo resource name if available.
 */
function mapPlaceResult(raw: PlaceResult): GymPlace {
  const photoUrl: string | undefined =
    raw.photos !== undefined && raw.photos.length > 0
      ? getPlacePhotoUrl(raw.photos[0].name, 400)
      : undefined

  return {
    placeId: raw.id,
    name: raw.displayName.text,
    address: raw.formattedAddress,
    coordinates: {
      latitude: raw.location.latitude,
      longitude: raw.location.longitude,
    },
    rating: raw.rating,
    photoUrl,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Searches for gyms, fitness centres, and sports complexes within `radiusMeters`
 * of `coords` using the Google Places API (New) Nearby Search endpoint.
 *
 * Returns up to 10 results mapped to the GymPlace domain type.
 *
 * @throws Error if the API key is missing or the HTTP response is not OK.
 */
export async function searchNearbyGyms(
  coords: { latitude: number; longitude: number },
  radiusMeters: number
): Promise<GymPlace[]> {
  const apiKey = getApiKey()

  const requestBody = {
    includedTypes: INCLUDED_GYM_TYPES,
    maxResultCount: MAX_RESULT_COUNT,
    locationRestriction: {
      circle: {
        center: {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        radius: radiusMeters,
      },
    },
  }

  const response = await fetch(`${PLACES_BASE_URL}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(
      `Google Places API error: ${response.status} ${response.statusText}`
    )
  }

  // Type the raw JSON as unknown and narrow before use — no direct cast on the
  // fetch response body.
  const json: unknown = await response.json()

  if (typeof json !== 'object' || json === null) {
    throw new Error('Unexpected response shape from Google Places API')
  }

  // The Places API returns { places: [...] } on success, or { places: [] } or
  // omits the key entirely when there are no results nearby. Normalise both cases.
  const data = json as Record<string, unknown>
  const rawPlaces: PlaceResult[] = Array.isArray(data['places'])
    ? (data['places'] as PlaceResult[]) // safe cast: matches Google API contract
    : []

  return rawPlaces.map(mapPlaceResult)
}

/**
 * Constructs the URL for a Google Places photo resource.
 *
 * `photoName` is the `name` field returned in a PlaceResult's `photos` array,
 * e.g. `"places/ChIJ.../photos/AX..."`.
 *
 * This is a pure string builder — no network request is made.
 */
export function getPlacePhotoUrl(photoName: string, maxWidth: number): string {
  const apiKey = getApiKey()
  return `${PLACES_BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`
}
```

---

### `.env.example` — Update

Add one line to the existing file, grouped with the other `EXPO_PUBLIC_*` client keys
(after the Google OAuth client ID keys, before any `STRIPE_*` server keys):

```bash
# Google Places API (New) — client-restricted key for gym search (Task 78)
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=
```

> Do not touch any other key, value, or comment in `.env.example`. The file already contains
> Stripe, Firebase, Strava, and Google OAuth keys from prior tasks — leave them unchanged.

---

## Important Architecture Notes for Codex

1. **`services/places.ts` is the only file to create.** No store, no screen, no component,
   no Cloud Function. All of that is Task 79. If any file other than `services/places.ts`
   and `.env.example` is created or modified, that is scope creep and must be reverted.

2. **The API key is read at call-time, not at module load.** `getApiKey()` is called
   inside `searchNearbyGyms` and `getPlacePhotoUrl`, not at the top of the module. This
   ensures a missing key surfaces with a meaningful error at the moment the function is
   called, rather than silently on module import.

3. **No `any` anywhere.** `response.json()` is typed as `unknown` and narrowed with a
   type guard before any cast. The `as PlaceResult[]` cast inside `Array.isArray()` is
   acceptable because element types cannot be narrowed further without a full runtime
   validator — the `// safe cast: matches Google API contract` comment is required.

4. **`GymPlace` is imported from `@/types/checkin`, not redefined here.** Confirm the
   exact shape of `GymPlace` before writing `mapPlaceResult`. The expected fields are:
   - `placeId: string`
   - `name: string`
   - `address: string`
   - `coordinates: { latitude: number; longitude: number }` — plain object, **not** a
     Firebase `GeoPoint`. The conversion to `GeoPoint` happens inside the `createCheckin`
     Cloud Function in Task 79.
   - `rating?: number`
   - `photoUrl?: string`

5. **`getPlacePhotoUrl` is a pure function — no `await`, no `fetch`.** It constructs a
   URL string only. It still calls `getApiKey()` so the key is embedded at call time.
   Do not add any async logic, caching, or network call to this function.

6. **No `console.*` calls anywhere in this file.** Errors propagate via `throw` and will
   be caught by callers in Task 79. CONVENTIONS.md Section 16 forbids `console.*` in
   committed files.

7. **No Firebase imports in `places.ts`.** The service is intentionally decoupled from
   Firebase. `GymPlace.coordinates` uses a plain `{ latitude, longitude }` object —
   the conversion to `admin.firestore.GeoPoint` occurs in the server-side Cloud Function.

8. **`NearbySearchResponse` is declared but may trigger `noUnusedLocals` if not referenced.**
   Reference it explicitly in the narrowing logic (e.g. as a type annotation on a parsed
   intermediate variable), or remove it and inline the shape — whichever keeps `tsc` clean.
   Zero TypeScript errors is the acceptance gate.

---

## Acceptance Criteria

- [ ] `services/places.ts` created and exports exactly two named functions:
      `searchNearbyGyms` and `getPlacePhotoUrl`
- [ ] No default export in `services/places.ts`
- [ ] `GymPlace` imported from `@/types/checkin` — not redefined in this file
- [ ] All API response shape interfaces (`PlaceResult`, `NearbySearchResponse`, etc.)
      are file-local and not exported
- [ ] `searchNearbyGyms` sends `POST` to
      `https://places.googleapis.com/v1/places:searchNearby`
- [ ] Request headers include `X-Goog-Api-Key` and `X-Goog-FieldMask`
- [ ] Request body includes `includedTypes: ["gym", "fitness_center", "sports_complex"]`
      and `maxResultCount: 10`
- [ ] `getPlacePhotoUrl` contains no `await` and no `fetch` — pure string construction
- [ ] `response.ok` is checked; a non-OK HTTP status throws a typed `Error`
- [ ] `response.json()` is typed as `unknown` and narrowed before use — no bare `as` cast
      directly on `await response.json()`
- [ ] Zero `any` in the file
- [ ] Zero `console.*` calls
- [ ] Zero Firebase imports in `services/places.ts`
- [ ] All imports use `@/` alias — no relative paths
- [ ] `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=` placeholder added to `.env.example` with a comment
- [ ] No other files created or modified beyond `services/places.ts` and `.env.example`
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/profileStore.ts`, `store/chatStore.ts`,
`store/matchStore.ts`, `store/discoveryStore.ts`, `services/firebase/config.ts`,
`services/firebase/auth.ts`, `services/firebase/firestore.ts`,
`services/firebase/storage.ts`, `services/firebase/realtime.ts`,
`services/strava.ts`, `services/stripe.ts`, `services/notifications.ts`,
`services/healthKit.ts`, `services/googleFit.ts`,
`types/user.ts`, `types/checkin.ts`, `types/event.ts`, `types/match.ts`,
`types/message.ts`, `types/subscription.ts`, `types/fitness.ts`,
`constants/`, `components/`, `app/`, `hooks/`,
`functions/src/`, `firestore.rules`, `firestore.indexes.json`,
`i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json`

---

## Commit

```
git commit -m "task-78: add Google Places gym search service"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3C — Task 78] — YYYY-MM-DD

### Completed

- Task 78: Google Places Gym Search Service
- services/places.ts: searchNearbyGyms() calls Places API (New) POST /v1/places:searchNearby
  with includedTypes gym/fitness_center/sports_complex, maps results to GymPlace[]
- getPlacePhotoUrl(): pure string builder for Places photo media URLs; no network call
- .env.example: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY placeholder added

### Files Created / Modified

- services/places.ts: created — exports searchNearbyGyms() and getPlacePhotoUrl()
- .env.example: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY placeholder added

### Architecture Decisions

- API key is read at call-time inside getApiKey() rather than at module load, so a
  missing key surfaces with a meaningful error at the call site rather than silently
  on module import
- All Google Places API response interfaces are file-local (not exported) to avoid
  polluting types/ with third-party contract shapes
- GymPlace.coordinates uses a plain { latitude, longitude } object — not a Firebase
  GeoPoint; the conversion to GeoPoint happens inside the createCheckin Cloud Function
  (Task 79)
- No Firebase imports in places.ts — the service is intentionally decoupled from Firebase
- NearbySearchResponse is referenced explicitly in the narrowing logic to satisfy
  noUnusedLocals

### Known Issues / Deferred

- searchNearbyGyms() is not yet called from any screen or store; Task 79 wires it to
  GymCheckinScreen and checkinStore

### Next Up

- Task 79: Gym Check-In Feature
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 79 prompt.

---

## Reasoning Level

Medium
