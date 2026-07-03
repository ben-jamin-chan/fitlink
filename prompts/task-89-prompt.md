@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**
- Task 81 must have written `SUPPORTED_COUNTRIES`, `SEA_CITIES`, and `COUNTRY_TIMEZONES`
  to `constants/regions.ts` covering Malaysia, Singapore, Thailand — verify all three
  exports are present and typed before modifying.
- Task 81 must have written `timezone?: string` as a top-level optional field on
  `UserProfile` in `types/user.ts` — verify present. Do not modify.
- Task 81 must have written `location.country` as a nested field under `location` on
  `UserProfile` in `types/user.ts` — verify present. Do not modify.

> If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your
> response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: constants/regions.ts does not export COUNTRY_TIMEZONES from Task 81.
  Cannot proceed. Re-run Task 81 before this task.
-->
```

---

## Context

Phase 4 begins here. The goal of this task is to extend the existing SEA region constants
(Malaysia, Singapore, Thailand — added in Task 81) with the three Tier 2 markets:
Philippines, Indonesia, and Vietnam. This task is purely additive — no existing constant
value, type, or key is removed or renamed.

- `constants/regions.ts` — currently exports `SUPPORTED_COUNTRIES`, `SEA_CITIES`,
  `COUNTRY_TIMEZONES` for MY/SG/TH. This task extends all three and adds two new exports:
  `COUNTRY_CURRENCIES` and `COUNTRY_CALLING_CODES`.
- `types/user.ts` — read-only verification only. Confirm `timezone?: string` (top-level)
  and `location.country` (nested) are present. Do not touch.
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add country and city
  display keys for PH/ID/VN under the `regions.*` namespace.

**This task does not touch any Cloud Function, Firestore rules, Zustand store, or screen
component. If any file outside the list above appears in the diff, that is architectural
drift and must be corrected.**

**`constants/regions.ts` was last modified in Task 81. Verify the MY/SG/TH entries are
present and intact before extending the arrays and records. Do not rewrite or reorder
existing entries — append only.**

---

## Task 89 — SEA Tier 2 Types, Regions & Timezone Constants

**Files to create:**
- None

**Files to modify:**
- `constants/regions.ts` — extend all existing exports; add two new exports
- `i18n/en.json` — add `regions.countries.*` and `regions.cities.*` keys for PH/ID/VN
- `i18n/my.json` — same keys, English values as placeholders
- `i18n/zh.json` — same keys, English values as placeholders
- `i18n/ta.json` — same keys, English values as placeholders

---

### `constants/regions.ts` — Update

> Extend all five exports. The existing MY/SG/TH entries must remain exactly as Task 81
> left them — do not reorder, rename, or remove any existing entry. Append PH/ID/VN.

```typescript
export const SUPPORTED_COUNTRIES = [
  'Malaysia',
  'Singapore',
  'Thailand',
  'Philippines',
  'Indonesia',
  'Vietnam',
] as const

export type SupportedCountry = typeof SUPPORTED_COUNTRIES[number]

export const COUNTRY_TIMEZONES: Record<SupportedCountry, string> = {
  Malaysia:    'Asia/Kuala_Lumpur',
  Singapore:   'Asia/Singapore',
  Thailand:    'Asia/Bangkok',
  Philippines: 'Asia/Manila',
  Indonesia:   'Asia/Jakarta',
  Vietnam:     'Asia/Ho_Chi_Minh',
}

export const SEA_CITIES: Record<SupportedCountry, string[]> = {
  Malaysia: [
    'Kuala Lumpur', 'Selangor', 'Penang', 'Johor Bahru', 'Ipoh',
    'Melaka', 'Kota Kinabalu', 'Kuching', 'Kuantan', 'Alor Setar',
  ],
  Singapore: ['Central', 'East', 'North', 'South', 'West'],
  Thailand:  ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Hat Yai'],
  Philippines: [
    'Manila', 'Cebu', 'Davao', 'Quezon City', 'Makati',
    'Taguig', 'Pasig', 'Antipolo', 'Iloilo', 'Zamboanga',
  ],
  Indonesia: [
    'Jakarta', 'Bali', 'Surabaya', 'Bandung', 'Medan',
    'Semarang', 'Makassar', 'Palembang', 'Tangerang', 'Depok',
  ],
  Vietnam: [
    'Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hai Phong',
    'Can Tho', 'Bien Hoa', 'Hue', 'Nha Trang', 'Vung Tau', 'Quy Nhon',
  ],
}

// New export — not present in Task 81
export const COUNTRY_CURRENCIES: Record<SupportedCountry, string> = {
  Malaysia:    'MYR',
  Singapore:   'SGD',
  Thailand:    'THB',
  Philippines: 'PHP',
  Indonesia:   'IDR',
  Vietnam:     'VND',
}

// New export — not present in Task 81
export const COUNTRY_CALLING_CODES: Record<SupportedCountry, string> = {
  Malaysia:    '+60',
  Singapore:   '+65',
  Thailand:    '+66',
  Philippines: '+63',
  Indonesia:   '+62',
  Vietnam:     '+84',
}
```

> If Task 81's implementation of `SUPPORTED_COUNTRIES` used a different array shape or
> `SupportedCountry` was typed differently (e.g. as an explicit union rather than
> `typeof SUPPORTED_COUNTRIES[number]`), preserve that existing type shape and extend
> it consistently — do not change the type pattern Task 81 established.

---

### `i18n/en.json` — Update

> Add under the existing `regions` namespace. If `regions` does not yet exist as a
> key, create it. If it already exists with MY/SG/TH keys from Task 81, append — do
> not replace or reorder existing keys.

```json
{
  "regions": {
    "countries": {
      "malaysia":     "Malaysia",
      "singapore":    "Singapore",
      "thailand":     "Thailand",
      "philippines":  "Philippines",
      "indonesia":    "Indonesia",
      "vietnam":      "Vietnam"
    },
    "cities": {
      "kualaLumpur":    "Kuala Lumpur",
      "selangor":       "Selangor",
      "penang":         "Penang",
      "johorBahru":     "Johor Bahru",
      "ipoh":           "Ipoh",
      "melaka":         "Melaka",
      "kotaKinabalu":   "Kota Kinabalu",
      "kuching":        "Kuching",
      "kuantan":        "Kuantan",
      "alorSetar":      "Alor Setar",
      "central":        "Central",
      "east":           "East",
      "north":          "North",
      "south":          "South",
      "west":           "West",
      "bangkok":        "Bangkok",
      "chiangMai":      "Chiang Mai",
      "phuket":         "Phuket",
      "pattaya":        "Pattaya",
      "hatYai":         "Hat Yai",
      "manila":         "Manila",
      "cebu":           "Cebu",
      "davao":          "Davao",
      "quezonCity":     "Quezon City",
      "makati":         "Makati",
      "taguig":         "Taguig",
      "pasig":          "Pasig",
      "antipolo":       "Antipolo",
      "iloilo":         "Iloilo",
      "zamboanga":      "Zamboanga",
      "jakarta":        "Jakarta",
      "bali":           "Bali",
      "surabaya":       "Surabaya",
      "bandung":        "Bandung",
      "medan":          "Medan",
      "semarang":       "Semarang",
      "makassar":       "Makassar",
      "palembang":      "Palembang",
      "tangerang":      "Tangerang",
      "depok":          "Depok",
      "hoChiMinhCity":  "Ho Chi Minh City",
      "hanoi":          "Hanoi",
      "daNang":         "Da Nang",
      "haiPhong":       "Hai Phong",
      "canTho":         "Can Tho",
      "bienHoa":        "Bien Hoa",
      "hue":            "Hue",
      "nhaTrang":       "Nha Trang",
      "vungTau":        "Vung Tau",
      "quyNhon":        "Quy Nhon"
    }
  }
}
```

> If MY/SG/TH city keys already exist under `regions.cities` from Task 81, do not
> duplicate them — only add the missing PH/ID/VN keys. If the `regions` namespace
> does not exist at all, add the full block above.

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

> Add the identical key structure as `en.json` above, using the English string as the
> placeholder value for every new key. This is the documented CONVENTIONS.md pattern
> for translations not yet localised. Do not remove or rename any existing key.

```json
{
  "regions": {
    "countries": {
      "philippines": "Philippines",
      "indonesia":   "Indonesia",
      "vietnam":     "Vietnam"
    },
    "cities": {
      "manila":        "Manila",
      "cebu":          "Cebu",
      "davao":         "Davao",
      "quezonCity":    "Quezon City",
      "makati":        "Makati",
      "taguig":        "Taguig",
      "pasig":         "Pasig",
      "antipolo":      "Antipolo",
      "iloilo":        "Iloilo",
      "zamboanga":     "Zamboanga",
      "jakarta":       "Jakarta",
      "bali":          "Bali",
      "surabaya":      "Surabaya",
      "bandung":       "Bandung",
      "medan":         "Medan",
      "semarang":      "Semarang",
      "makassar":      "Makassar",
      "palembang":     "Palembang",
      "tangerang":     "Tangerang",
      "depok":         "Depok",
      "hoChiMinhCity": "Ho Chi Minh City",
      "hanoi":         "Hanoi",
      "daNang":        "Da Nang",
      "haiPhong":      "Hai Phong",
      "canTho":        "Can Tho",
      "bienHoa":       "Bien Hoa",
      "hue":           "Hue",
      "nhaTrang":      "Nha Trang",
      "vungTau":       "Vung Tau",
      "quyNhon":       "Quy Nhon"
    }
  }
}
```

> Only add the keys that do not already exist. If MY/SG/TH keys were added to these
> files in Task 81, append the new PH/ID/VN keys alongside them.

---

## Important Architecture Notes for Codex

1. **Additive only.** Every edit to `constants/regions.ts` and the four i18n files is
   append-only. Do not remove, rename, or reorder any entry that Task 81 established.
   A renamed constant here would silently break every consumer (onboarding screens,
   `recordSwipe` timezone lookup, `createUserProfile` service) without a TypeScript error.

2. **`types/user.ts` is read-only in this task.** Confirm `timezone?: string` and
   `location.country` are present, then do not touch the file. Any type change here
   requires a separate Architect decision.

3. **`COUNTRY_CURRENCIES` and `COUNTRY_CALLING_CODES` are new exports.** They do not
   exist in Task 81's implementation. Add them at the bottom of `constants/regions.ts`
   after the existing exports — do not interleave with existing code.

4. **No consumer updates in this task.** `Step1Screen.tsx`, `onboardingStore.ts`,
   `services/stripe.ts`, and all Cloud Functions are updated in Task 90 and Task 91.
   This task only defines the constants — do not import them into any consumer file yet.

5. **i18n key casing convention.** Keys use camelCase (e.g. `hoChiMinhCity`, `daNang`)
   to match the existing `regions.*` pattern established in prior tasks. Do not use
   snake_case or kebab-case for new keys.

6. **`SupportedCountry` type integrity.** After extending `SUPPORTED_COUNTRIES`,
   TypeScript's `Record<SupportedCountry, ...>` will require all six countries to be
   present in `COUNTRY_TIMEZONES`, `SEA_CITIES`, `COUNTRY_CURRENCIES`, and
   `COUNTRY_CALLING_CODES`. If any entry is missing, `tsc --noEmit` will catch it —
   this is the expected guard. Do not suppress the error with a cast.

---

## Rollback Protocol

If `npx tsc --noEmit` produces errors that cannot be resolved without:
- Modifying `types/user.ts`, OR
- Removing or renaming a Task 81 constant entry, OR
- Changing the `SupportedCountry` type shape in a way that breaks existing consumers

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing:
   - Which file caused the conflict
   - What the error was
   - What information or decision is needed to proceed
4. Stop. Do not attempt a workaround.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] Zero `any` types introduced
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in any touched file
- [ ] Zero inline styles — not applicable to this task (no components)
- [ ] Zero relative imports — not applicable (no new imports added)
- [ ] All new user-facing strings added to all 4 i18n files (en, my, zh, ta)
- [ ] All new constants use values from `constants/` — no hardcoded values elsewhere

**Firebase / Security**
- [ ] No Cloud Function files were touched
- [ ] No `firestore.rules` changes
- [ ] No server-only fields written from the client

**Architecture**
- [ ] `constants/regions.ts` MY/SG/TH entries are identical to Task 81's output
  (no renames, no reordering)
- [ ] `types/user.ts` was not modified
- [ ] `COUNTRY_CURRENCIES` and `COUNTRY_CALLING_CODES` are exported from
  `constants/regions.ts`
- [ ] No consumer files (screens, stores, services, CFs) were modified
- [ ] Files in the "Do Not Touch" list were not modified

**Platform**
- [ ] No platform-specific code introduced — not applicable to this task

---

## Acceptance Criteria

- [ ] `SUPPORTED_COUNTRIES` array contains all 6 countries: Malaysia, Singapore,
      Thailand, Philippines, Indonesia, Vietnam — in that order
- [ ] `SupportedCountry` type correctly derived from the array
- [ ] `COUNTRY_TIMEZONES` has all 6 entries with correct IANA timezone strings:
      `Asia/Manila`, `Asia/Jakarta`, `Asia/Ho_Chi_Minh`
- [ ] `SEA_CITIES` has all 6 country entries with the correct city lists
- [ ] `COUNTRY_CURRENCIES` exported with all 6 entries: MYR/SGD/THB/PHP/IDR/VND
- [ ] `COUNTRY_CALLING_CODES` exported with all 6 entries: +60/+65/+66/+63/+62/+84
- [ ] `i18n/en.json` contains `regions.countries.philippines`,
      `regions.countries.indonesia`, `regions.countries.vietnam` and all PH/ID/VN
      city keys under `regions.cities.*`
- [ ] `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` contain the same new keys with
      English placeholder values
- [ ] No existing key in any i18n file was removed or renamed
- [ ] `types/user.ts` is byte-for-byte identical to its pre-task state
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/onboardingStore.ts`,
`services/firebase/config.ts`, `services/firebase/firestore.ts`,
`services/stripe.ts`, `types/user.ts` (read-only verification only — zero edits),
`functions/src/` (entire directory), `firestore.rules`, `firestore.indexes.json`,
`app/onboarding/Step1Screen.tsx`, `constants/theme.ts`, `constants/colors.ts`,
`constants/spacing.ts`, `constants/typography.ts`

---

## Commit

```
git commit -m "task-89: add Philippines, Indonesia, Vietnam region constants and i18n keys"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4A — Task 89] — YYYY-MM-DD

### Completed

- Task 89: SEA Tier 2 Types, Regions & Timezone Constants
- Extended SUPPORTED_COUNTRIES to include Philippines, Indonesia, Vietnam
- Extended COUNTRY_TIMEZONES with Asia/Manila, Asia/Jakarta, Asia/Ho_Chi_Minh
- Extended SEA_CITIES with 10 cities each for PH, ID, VN
- Added COUNTRY_CURRENCIES export: MYR/SGD/THB/PHP/IDR/VND
- Added COUNTRY_CALLING_CODES export: +60/+65/+66/+63/+62/+84
- Added PH/ID/VN country and city keys to all 4 i18n files

### Files Created

- None

### Files Modified

- constants/regions.ts: extended all exports; added COUNTRY_CURRENCIES, COUNTRY_CALLING_CODES
- i18n/en.json: added regions.countries.* and regions.cities.* keys for PH/ID/VN
- i18n/my.json: same keys, English placeholders
- i18n/zh.json: same keys, English placeholders
- i18n/ta.json: same keys, English placeholders

### Architecture Decisions

- COUNTRY_CURRENCIES and COUNTRY_CALLING_CODES are new exports not present in Task 81.
  They are added at the bottom of constants/regions.ts to avoid interleaving with
  existing exports.
- All Task 81 MY/SG/TH entries preserved exactly — no renames or reordering.
- types/user.ts was verified (timezone?: string and location.country present) and
  not modified.

### Conflict Risks Introduced

- Task 90 modifies Step1Screen.tsx and onboardingStore.ts which consume
  constants/regions.ts — verify Task 89 constants are present before generating
  Task 90 prompt.

### Known Issues / Deferred

- None

### Next Up

- Task 90: Onboarding & Discovery — Philippines, Indonesia, Vietnam
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 90 prompt.
No additional files needed for Task 90 unless tsc failed or Step1Screen.tsx produced
unexpected output.

---

## Reasoning Level

Low
