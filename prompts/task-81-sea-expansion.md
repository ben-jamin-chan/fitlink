# CODEX PROMPT — Task 81: SEA Expansion — Singapore & Thailand Regions

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 80 is complete. The Events & Community epic is fully shipped: `createEvent` and
`rsvpEvent` Cloud Functions are live, `eventsStore` is wired, all four event screens
(`EventsScreen`, `CreateEventScreen`, `EventDetailScreen`, `EventCard`) exist, the Events tab
is the 5th tab in `MainTabNavigator`, and `firestore.rules` + `firestore.indexes.json` cover
`/events/{id}`.

**Existing files Codex must know about:**

- `types/user.ts` — already has `timezone?: string` (added in Task 70) and the existing
  `location: { city: string; country: string; coordinates: GeoPoint }` shape. There is **no**
  separate top-level `country` field — country lives inside the `location` object.
- `store/onboardingStore.ts` — holds `OnboardingDraft` with `city: string` written to
  `location.city`; `country` and `timezone` are **not yet** in the draft.
- `app/onboarding/Step1Screen.tsx` — currently renders a city-only text field or picker;
  no country selector exists yet.
- `services/firebase/firestore.ts` — `createUserProfile()` accepts onboarding draft fields
  and writes them to `/users/{uid}`; it does **not** yet write `timezone` or `location.country`
  from the draft.
- `services/stripe.ts` — `getStripePrices()` or equivalent pricing map already handles MYR,
  PHP, IDR, VND; SGD and THB may or may not be present — Codex must verify and add if missing.
- `constants/theme.ts` — re-exports `colors`, `spacing`, `typography`; `constants/regions.ts`
  does **not yet exist**.
- `i18n/en.json` (and `my.json`, `zh.json`, `ta.json`) — Task 80 added `events.*` and
  `navigation.tabs.*` keys; no `onboarding.step1.country.*` or Thailand city display keys exist yet.
- `components/ui/` — a `SingleSelect` (chip-style single-option selector) component already
  exists from the onboarding flow and is reused here. Do not recreate it.

**Pre-flight audit — files this task touches:**

| File | Last touched | Conflict risk |
|---|---|---|
| `constants/regions.ts` | Never (new) | None |
| `store/onboardingStore.ts` | Phase 1 onboarding | Low — additive only |
| `app/onboarding/Step1Screen.tsx` | Phase 1 onboarding | Medium — city field replaced |
| `services/firebase/firestore.ts` | Phase 2 (photo verify) | Low — `createUserProfile()` extension only |
| `services/stripe.ts` | Phase 2 (Stripe setup) | Low — pricing map addition only |
| `i18n/*.json` × 4 | Task 80 (events keys) | Low — different key namespace |

**Critical architectural boundary — schema collision guard:**

`country` in the onboarding draft maps to `location.country` inside the existing Firestore
user document `location` object. It does **not** create a new top-level `country` field.
`timezone` is a **top-level** field on `/users/{uid}` (already typed as `timezone?: string`
in `types/user.ts` from Task 70). Do not conflate the two. The call in `createUserProfile()`
must write:

```typescript
location: {
  city: draft.city,
  country: draft.country,   // ← into the location object
  coordinates: ...,
},
timezone: draft.timezone,   // ← top-level field
```

**Do not touch** `types/user.ts` — the `timezone?: string` field was already added in Task 70
and the `location.country` field has existed since Phase 1. Any edit to `types/user.ts` in
this task is architectural drift and must be corrected.

---

## Task 81 — SEA Expansion: Singapore & Thailand Regions

**Files to create:**
- `constants/regions.ts`

**Files to modify:**
- `store/onboardingStore.ts` — add `country: string` and `timezone: string` to `OnboardingDraft` with defaults
- `app/onboarding/Step1Screen.tsx` — replace city-only field with two-level country → city flow
- `services/firebase/firestore.ts` — extend `createUserProfile()` to write `timezone` and `location.country`
- `services/stripe.ts` — verify and add SGD + THB pricing if absent
- `i18n/en.json` — add `onboarding.step1.country.*` and Thailand city display keys
- `i18n/my.json` — same keys (English values as placeholders)
- `i18n/zh.json` — same keys (English values as placeholders)
- `i18n/ta.json` — same keys (English values as placeholders)

---

### `constants/regions.ts`

New constants-layer file. Exported values are the single source of truth for all supported
countries, their IANA timezone strings, and their available city lists. Consumed by
`Step1Screen.tsx` for the country/city picker and by `onboardingStore.ts` for the timezone
auto-set. No React imports — pure TypeScript constants.

```typescript
export const SUPPORTED_COUNTRIES = ['Malaysia', 'Singapore', 'Thailand'] as const
export type SupportedCountry = typeof SUPPORTED_COUNTRIES[number]

export const COUNTRY_TIMEZONES: Record<SupportedCountry, string> = {
  Malaysia:  'Asia/Kuala_Lumpur',
  Singapore: 'Asia/Singapore',
  Thailand:  'Asia/Bangkok',
}

export const SEA_CITIES: Record<SupportedCountry, string[]> = {
  Malaysia: [
    'Kuala Lumpur',
    'Selangor',
    'Penang',
    'Johor Bahru',
    'Ipoh',
    'Melaka',
    'Kota Kinabalu',
    'Kuching',
    'Kuantan',
    'Alor Setar',
  ],
  Singapore: ['Central', 'East', 'North', 'South', 'West'],
  Thailand:  ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Hat Yai'],
}
```

---

### `store/onboardingStore.ts` — Update

Add `country` and `timezone` to the `OnboardingDraft` interface and seed their defaults.
The existing `city` field stays exactly as-is. Do not touch any other field, action, or
persist configuration in this file.

```typescript
// In OnboardingDraft interface — add after city:
country: string
timezone: string

// In the initial draft object (the Zustand state initialiser) — add defaults:
country: 'Malaysia',
timezone: 'Asia/Kuala_Lumpur',
```

No other changes to this file. Do not alter the persist middleware configuration, the
`partialize` allowlist, or any existing actions.

---

### `app/onboarding/Step1Screen.tsx` — Update

Replace the existing city-only input/picker with a two-level country → city flow. The
screen must still satisfy any existing Step 1 fields (e.g. `firstName`) — do not remove
or reorder any fields that were already here. The change is additive: a new Country
selector appears above the City selector, and the City selector is now populated
dynamically from `SEA_CITIES[selectedCountry]`.

```typescript
// 1. React imports
import React, { useEffect, useState } from 'react'

// 2. React Native imports
import { ScrollView, Text, View, StyleSheet, ViewStyle, TextStyle } from 'react-native'

// 3. Third-party
import { useTranslation } from 'react-i18next'

// 4. Internal — stores
import { useOnboardingStore } from '@/store/onboardingStore'

// 5. Internal — components
import { SingleSelect } from '@/components/ui/SingleSelect'
// … any other existing UI components already used by Step1Screen

// 6. Internal — constants
import {
  SUPPORTED_COUNTRIES,
  COUNTRY_TIMEZONES,
  SEA_CITIES,
  SupportedCountry,
} from '@/constants/regions'
import { colors, spacing, typography } from '@/constants/theme'

// ── Timezone auto-detection helper ────────────────────────────────────────────
// Returns the matching SupportedCountry for the device IANA timezone, or null.
function detectCountryFromTimezone(): SupportedCountry | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const entry = (Object.entries(COUNTRY_TIMEZONES) as Array<[SupportedCountry, string]>).find(
      ([, v]) => v === tz,
    )
    return entry ? entry[0] : null
  } catch {
    return null
  }
}

// ── Screen component ──────────────────────────────────────────────────────────
// (keep the existing screen name, navigation prop type, and export form —
//  only the body changes as described below)

// Inside the component body, REPLACE the city-only picker block with:

const { draft, setDraft } = useOnboardingStore()
const { t } = useTranslation()

// Local UI state — purely presentational; not persisted
const [selectedCountry, setSelectedCountry] = useState<SupportedCountry>(
  (draft.country as SupportedCountry | undefined) ??
    detectCountryFromTimezone() ??
    'Malaysia',
)

// On mount: if the store draft already has a valid country, honour it;
// otherwise apply the auto-detected country and its timezone.
useEffect(() => {
  if (!draft.country) {
    const detected = detectCountryFromTimezone() ?? 'Malaysia'
    setDraft({ country: detected, timezone: COUNTRY_TIMEZONES[detected] })
    setSelectedCountry(detected)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

// Country change handler
const handleCountrySelect = (country: SupportedCountry): void => {
  setSelectedCountry(country)
  setDraft({
    country,
    timezone: COUNTRY_TIMEZONES[country],
    city: '',            // reset city when country changes
  })
}

// City change handler
const handleCitySelect = (city: string): void => {
  setDraft({ city })
}

// In JSX — add ABOVE the existing city picker, inside the scroll view:
// (preserve all existing fields — firstName etc. — exactly as they were)

// Country picker block
<Text style={styles.fieldLabel}>{t('onboarding.step1.country.label')}</Text>
<SingleSelect
  options={SUPPORTED_COUNTRIES.map((c) => ({ label: t(`regions.country.${c}`), value: c }))}
  selected={selectedCountry}
  onSelect={(value) => handleCountrySelect(value as SupportedCountry)}
/>

// City picker block — replace the old hardcoded city picker
<Text style={styles.fieldLabel}>{t('onboarding.step1.city.label')}</Text>
<SingleSelect
  options={SEA_CITIES[selectedCountry].map((city) => ({
    label: t(`regions.city.${selectedCountry}.${city.replace(/\s+/g, '_')}`),
    value: city,
  }))}
  selected={draft.city}
  onSelect={handleCitySelect}
/>

// StyleSheet additions (append to existing StyleSheet.create — do not replace it):
const styles = StyleSheet.create({
  // … all existing styles preserved …
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.gray[700],
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  } as TextStyle,
})
```

Do not touch the existing `handleSubmit` / "Next" button logic, the navigation prop, or
any other field already rendered on this screen.

---

### `services/firebase/firestore.ts` — Update

Extend `createUserProfile()` to write `timezone` (top-level) from the draft, and to use
`draft.country` for `location.country`. Only show the changed portions — do not rewrite
the whole file.

```typescript
// In createUserProfile() — update the Firestore write payload.
// The location object already exists; add country and city from draft:

await setDoc(doc(db, 'users', uid), {
  // … all existing fields …
  location: {
    city: draft.city,
    country: draft.country,        // ← newly written from draft
    coordinates: draft.coordinates ?? new GeoPoint(0, 0),
  },
  timezone: draft.timezone,        // ← top-level field, written for the first time here
  // … rest of payload …
})

// If createUserProfile() accepts a typed parameter object rather than reading from
// onboardingStore directly, update that parameter type to include:
//   country: string
//   timezone: string
// and pass them through from the call site (the final onboarding submit handler).
```

If `draft.country` and `draft.timezone` are not already part of the argument type accepted
by `createUserProfile()`, add them there. Do not change the function signature in any other
way. Do not touch other functions in this file.

---

### `services/stripe.ts` — Update

Verify that `getStripePrices()` (or equivalent pricing constant/map) includes SGD and THB
entries. If either is absent, add it using the same structure as MYR. SGD and THB monthly
price IDs must be read from `process.env` with the `EXPO_PUBLIC_` prefix, consistent with
all other Stripe config in this project.

```typescript
// Verify these entries are present in the pricing map / getStripePrices().
// Add any that are missing:

// Singapore — SGD
{
  currency: 'SGD',
  monthlyPriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_SGD_MONTHLY ?? '',
  yearlyPriceId:  process.env.EXPO_PUBLIC_STRIPE_PRICE_SGD_YEARLY  ?? '',
  symbol: 'S$',
  // Monthly amount per PRD Section 5.12 — use PRD value if available,
  // otherwise mirror the MYR amount converted at approximate parity.
}

// Thailand — THB
{
  currency: 'THB',
  monthlyPriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_THB_MONTHLY ?? '',
  yearlyPriceId:  process.env.EXPO_PUBLIC_STRIPE_PRICE_THB_YEARLY  ?? '',
  symbol: '฿',
}

// Also add matching keys to .env.example (no values — empty strings):
// EXPO_PUBLIC_STRIPE_PRICE_SGD_MONTHLY=
// EXPO_PUBLIC_STRIPE_PRICE_SGD_YEARLY=
// EXPO_PUBLIC_STRIPE_PRICE_THB_MONTHLY=
// EXPO_PUBLIC_STRIPE_PRICE_THB_YEARLY=
```

Do not touch any existing currency entry. Do not alter the function signature or any other
Stripe logic in this file.

---

### `i18n/en.json` — Update

Add the following keys. Append them to the appropriate namespace sections — do not
restructure any existing keys.

```json
{
  "onboarding": {
    "step1": {
      "country": {
        "label": "Country",
        "placeholder": "Select your country"
      }
    }
  },
  "regions": {
    "country": {
      "Malaysia":  "Malaysia",
      "Singapore": "Singapore",
      "Thailand":  "Thailand"
    },
    "city": {
      "Malaysia": {
        "Kuala_Lumpur":  "Kuala Lumpur",
        "Selangor":      "Selangor",
        "Penang":        "Penang",
        "Johor_Bahru":   "Johor Bahru",
        "Ipoh":          "Ipoh",
        "Melaka":        "Melaka",
        "Kota_Kinabalu": "Kota Kinabalu",
        "Kuching":       "Kuching",
        "Kuantan":       "Kuantan",
        "Alor_Setar":    "Alor Setar"
      },
      "Singapore": {
        "Central": "Central",
        "East":    "East",
        "North":   "North",
        "South":   "South",
        "West":    "West"
      },
      "Thailand": {
        "Bangkok":     "Bangkok",
        "Chiang_Mai":  "Chiang Mai",
        "Phuket":      "Phuket",
        "Pattaya":     "Pattaya",
        "Hat_Yai":     "Hat Yai"
      }
    }
  }
}
```

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Add the same keys from `en.json` above to all three files. Use the English values as
placeholders in each (i.e. copy verbatim). Do not translate — localisation is deferred.
Do not touch any existing key in any of these files.

---

## Important Architecture Notes for Codex

1. **`location.country` vs top-level `country` — no new field.** The Firestore user document
   has `location: { city, country, coordinates }` since Phase 1. `draft.country` in this task
   populates `location.country` inside that nested object. There is no new top-level `country`
   field on the user document. The only new top-level field written in this task is `timezone`.
   Introducing a top-level `country` alongside `location.country` is a schema violation.

2. **`types/user.ts` must not be modified.** `timezone?: string` was added in Task 70 and
   `location.country` has existed since Phase 1. Any edit to this file is drift — all required
   types already exist.

3. **Timezone auto-detection is best-effort and silent.** `Intl.DateTimeFormat().resolvedOptions().timeZone`
   can return values not in `COUNTRY_TIMEZONES` (e.g. `Asia/Colombo`). Wrap it in `try/catch`
   and fall back to `'Malaysia'` + `'Asia/Kuala_Lumpur'` with no error surface. Never throw or
   show an error to the user based on timezone detection failure.

4. **City reset on country change.** When the user selects a new country, `draft.city` must
   be reset to `''` (empty string) so the city picker shows no pre-selected value from the
   previous country. The Step 1 "Next" button's validation must already require a non-empty
   city — this ensures users always pick a valid city after switching country.

5. **`SingleSelect` options use i18n keys, not raw constant values.** The label rendered for
   each country chip comes from `t('regions.country.Malaysia')` etc., not the string `'Malaysia'`
   directly. This ensures all four languages resolve correctly when real translations land.
   City labels follow the same pattern: `t('regions.city.Malaysia.Kuala_Lumpur')`.

6. **Stripe `EXPO_PUBLIC_` env vars.** New SGD and THB price ID env vars must follow the
   existing naming convention and be added to `.env.example` with empty values. They must
   never be hardcoded. If the pricing map is a static object (not a function), the pattern
   still applies — read from `process.env` at module load.

7. **No Cloud Function changes in this task.** `timezone` write to Firestore happens via
   `createUserProfile()` on the client at the end of onboarding. The per-user timezone
   daily reset in Cloud Functions is Task 82. Do not touch any file under `functions/src/`
   in this task.

8. **No `firestore.rules` changes in this task.** `timezone` is a user-writable field (same
   as `paused`, `language`, etc.) — the existing rules already permit it via the allowlist.
   The rules consolidation for Phase 3 fields happens in Task 87.

9. **`onboardingStore` persist allowlist.** If `onboardingStore` uses `zustand/middleware/persist`
   with a `partialize` allowlist, add `country` and `timezone` to it so the draft survives
   app restarts mid-onboarding. If there is no allowlist (full object persisted), no change
   is needed.

10. **`selectedCountry` is local UI state, not Zustand state.** The component derives its
    initial value from `draft.country` (Zustand) and syncs back on every change via
    `setDraft()`. It must not be stored in `onboardingStore` as a separate field — the store
    already has `country: string` which is the source of truth.

---

## Acceptance Criteria

- [ ] `constants/regions.ts` created; exports `SUPPORTED_COUNTRIES`, `SupportedCountry`,
      `COUNTRY_TIMEZONES`, and `SEA_CITIES` as named exports; no default export; no React
      imports; no `any`
- [ ] `store/onboardingStore.ts` `OnboardingDraft` interface has `country: string` and
      `timezone: string`; defaults are `'Malaysia'` and `'Asia/Kuala_Lumpur'` respectively
- [ ] `app/onboarding/Step1Screen.tsx` renders a Country `SingleSelect` above the City
      `SingleSelect`; selecting a country resets `draft.city` to `''` and auto-sets
      `draft.timezone` from `COUNTRY_TIMEZONES`
- [ ] City options in the City `SingleSelect` are populated from `SEA_CITIES[selectedCountry]`
      — not a hardcoded list
- [ ] On screen mount, `Intl.DateTimeFormat().resolvedOptions().timeZone` is checked; if it
      matches a `COUNTRY_TIMEZONES` value, that country is pre-selected; mismatch silently
      defaults to `'Malaysia'`
- [ ] All country and city labels in `SingleSelect` go through `t()` — no raw English strings
      in JSX options
- [ ] Zero inline `style={{ }}` in `Step1Screen.tsx` — all styles in `StyleSheet.create({})`
- [ ] `services/firebase/firestore.ts` `createUserProfile()` writes `timezone` as a top-level
      Firestore field and `country` inside the `location` object
- [ ] `types/user.ts` is unchanged (no diff)
- [ ] `services/stripe.ts` pricing map includes SGD (`S$`) and THB (`฿`) entries; price IDs
      read from `EXPO_PUBLIC_` env vars
- [ ] `.env.example` has empty-value entries for all four new Stripe price ID keys
- [ ] All four i18n files (`en.json`, `my.json`, `zh.json`, `ta.json`) contain
      `onboarding.step1.country.label`, `onboarding.step1.country.placeholder`, all
      `regions.country.*` keys, and all `regions.city.*` keys for Malaysia, Singapore, and
      Thailand
- [ ] All new i18n keys parse as valid JSON in all four files
- [ ] No files under `functions/src/` are modified
- [ ] `firestore.rules` is unchanged (no diff)
- [ ] All imports in modified/created files use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Do Not Touch

`types/user.ts`, `types/event.ts`, `types/checkin.ts`, `types/match.ts`,
`types/message.ts`, `types/subscription.ts`,
`firestore.rules`, `firestore.indexes.json`,
`functions/src/` (all files),
`store/authStore.ts`, `store/checkinStore.ts`, `store/eventsStore.ts`,
`store/discoveryStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`,
`store/profileStore.ts`,
`services/firebase/config.ts`, `services/firebase/auth.ts`,
`services/firebase/realtime.ts`, `services/firebase/storage.ts`,
`services/places.ts`, `services/strava.ts`, `services/notifications.ts`,
`services/healthKit.ts`,
`constants/colors.ts`, `constants/spacing.ts`, `constants/typography.ts`,
`constants/theme.ts`,
`App.tsx`, `app/navigation/RootNavigator.tsx`, `app/navigation/AuthNavigator.tsx`,
`app/navigation/MainTabNavigator.tsx`,
`components/ui/` (all files — do not recreate `SingleSelect`),
`app/events/` (all files), `app/checkin/`, `app/chat/`, `app/matches/`

---

## Commit

```
git commit -m "task-81: SEA expansion — Singapore and Thailand regions, timezone onboarding"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3D - Task 81] — YYYY-MM-DD

### Completed

- Task 81: SEA Expansion — Singapore & Thailand Regions
- constants/regions.ts: SUPPORTED_COUNTRIES, COUNTRY_TIMEZONES, SEA_CITIES for MY / SG / TH
- store/onboardingStore.ts: country and timezone fields added to OnboardingDraft with defaults
- app/onboarding/Step1Screen.tsx: two-level country → city flow; timezone auto-detected from device locale
- services/firebase/firestore.ts: createUserProfile() writes timezone (top-level) and location.country
- services/stripe.ts: SGD and THB pricing entries verified / added; EXPO_PUBLIC_ env vars
- i18n: onboarding.step1.country.* and regions.country.*/regions.city.* keys added to all 4 files

### Files Created / Modified

- constants/regions.ts: created — SUPPORTED_COUNTRIES, SupportedCountry, COUNTRY_TIMEZONES, SEA_CITIES
- store/onboardingStore.ts: OnboardingDraft extended with country, timezone fields and defaults
- app/onboarding/Step1Screen.tsx: country SingleSelect added; city options dynamic from SEA_CITIES
- services/firebase/firestore.ts: createUserProfile() extended to write timezone and location.country
- services/stripe.ts: SGD and THB pricing entries added
- .env.example: EXPO_PUBLIC_STRIPE_PRICE_SGD_MONTHLY, _YEARLY, EXPO_PUBLIC_STRIPE_PRICE_THB_MONTHLY, _YEARLY added
- i18n/en.json, my.json, zh.json, ta.json: regions.* and onboarding.step1.country.* keys added

### Architecture Decisions

- country in OnboardingDraft maps to location.country in Firestore (nested) — no new top-level country field
- timezone is a separate top-level Firestore field — written once at profile creation
- City labels use i18n keys (regions.city.{Country}.{City_key}) so real translations can land later
- Timezone auto-detection is silent best-effort; mismatch defaults to Malaysia

### Known Issues / Deferred

- Real translations for Thailand and Singapore cities deferred (English placeholders in my/zh/ta)
- Per-user timezone daily reset in Cloud Functions (recordSwipe.ts, verifyProfilePhoto.ts) is Task 82
- Existing users who signed up before Task 81 have no timezone field; Task 82 falls back to Asia/Kuala_Lumpur

### Next Up

- Task 82: Per-User Timezone Daily Resets
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 82 prompt.

---

## Reasoning Level

High

> **Justification:** This task crosses six files in three distinct layers (constants, store,
> screen, service, payments, i18n), introduces a schema-critical `timezone` vs
> `location.country` split that is easy to get wrong, requires careful Zustand persist
> allowlist awareness, and touches the Stripe pricing map where a misconfiguration causes
> payment failures. The two-level country → city interaction also has a subtle reset
> dependency (city must clear on country change) that requires careful state coordination.
