# CODEX PROMPT — Task 90: Onboarding & Discovery — Philippines, Indonesia, Vietnam

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from Task 89:**
- `constants/regions.ts` must export `SUPPORTED_COUNTRIES` containing `'Philippines'`, `'Indonesia'`, `'Vietnam'` — verify all three are present
- `constants/regions.ts` must export `COUNTRY_TIMEZONES` with entries for `'Philippines': 'Asia/Manila'`, `'Indonesia': 'Asia/Jakarta'`, `'Vietnam': 'Asia/Ho_Chi_Minh'` — verify all three are present
- `constants/regions.ts` must export `SEA_CITIES` with arrays for Philippines, Indonesia, and Vietnam — verify all three keys are present
- `constants/regions.ts` must export `COUNTRY_CURRENCIES` with `'Philippines': 'PHP'`, `'Indonesia': 'IDR'`, `'Vietnam': 'VND'` — verify all three are present
- `constants/regions.ts` must export `COUNTRY_CALLING_CODES` with `'Philippines': '+63'`, `'Indonesia': '+62'`, `'Vietnam': '+84'` — verify all three are present

> If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: constants/regions.ts does not contain Philippines/Indonesia/Vietnam entries.
  Cannot proceed. Re-run Task 89 before this task.
-->
```

---

## Context

The current codebase completed Task 81 (SEA Expansion — Singapore & Thailand), which:
- Created `constants/regions.ts` with `SUPPORTED_COUNTRIES`, `COUNTRY_TIMEZONES`, `SEA_CITIES` for MY/SG/TH
- Extended `store/onboardingStore.ts` with `country` (default `'Malaysia'`) and `timezone` (default `'Asia/Kuala_Lumpur'`) in the onboarding draft
- Extended `app/onboarding/Step1Screen.tsx` with a translated country `SingleSelect` reading from `SUPPORTED_COUNTRIES`, a city `SingleSelect` reading from `SEA_CITIES[selectedCountry]`, and timezone auto-detection on mount using `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Extended `app/onboarding/Step6Screen.tsx` to pass `draft.timezone` through to `createUserProfile`
- Extended `services/firebase/firestore.ts` `createUserProfile()` to write `timezone` as a top-level field and `country` nested inside `location.country`
- Added SGD/THB price ID entries to `services/stripe.ts`

Task 89 (just completed) extended `constants/regions.ts` with PH/ID/VN entries across all five exports and added corresponding i18n keys.

**Because Step1Screen already iterates `SUPPORTED_COUNTRIES` and `SEA_CITIES[selectedCountry]` dynamically, and because `COUNTRY_TIMEZONES` already maps all supported countries, the Step1Screen country selector, city selector, and timezone logic require no code changes.** The PH/ID/VN entries fall through automatically. The scope of this task is:
1. Verifying the auto-detect timezone reverse-lookup handles `Asia/Manila`, `Asia/Jakarta`, and `Asia/Ho_Chi_Minh` correctly
2. Verifying `onboardingStore.ts` and `createUserProfile()` require no changes
3. Extending `services/stripe.ts` to add PHP/IDR/VND price ID lookups

**`Step1Screen.tsx` and `onboardingStore.ts` are verify-and-confirm targets, not modification targets, unless a specific gap is found during inspection.** Do not add new UI logic to these files speculatively.

**`services/firebase/firestore.ts` is a verify-only target.** Confirm `timezone` and `country` are written in `createUserProfile()`. Do not modify unless they are genuinely absent.

**Do not touch `app/auth/PhoneLoginScreen.tsx` or `components/ui/PhoneInput.tsx`.** The calling code picker (if any) lives in those files, which are Phase 1 files outside this task's scope. `COUNTRY_CALLING_CODES` is available in `constants/regions.ts` for future use but is not wired into any UI in this task.

**`store/onboardingStore.ts` — the `country` default is `'Malaysia'`. Do not change this default.** Auto-detect on mount in Step1Screen handles users from other countries; the default is a safe fallback only.

**`services/stripe.ts` was last confirmed in Task 81** to contain MYR, SGD, and THB price ID entries. This task appends PHP, IDR, and VND — do not remove or rename any existing entries.

---

## Task 90 — Onboarding & Discovery: Add Philippines, Indonesia, Vietnam

**Files to verify (read + confirm, modify only if a gap is found):**
- `app/onboarding/Step1Screen.tsx`
- `store/onboardingStore.ts`
- `services/firebase/firestore.ts`

**Files to modify:**
- `services/stripe.ts` — add PHP/IDR/VND price ID lookup

**Files to create:**
- None

---

### `app/onboarding/Step1Screen.tsx` — Verify

Read the current file. Confirm the following. If any item is missing or incorrect, fix it. If all items are correct, do not touch the file.

**Checklist:**
- [ ] Country selector iterates `SUPPORTED_COUNTRIES` from `@/constants/regions.ts` — not a hardcoded list
- [ ] City selector iterates `SEA_CITIES[selectedCountry]` — not a hardcoded list
- [ ] On mount, timezone auto-detect uses `Intl.DateTimeFormat().resolvedOptions().timeZone` and looks up the matching country via a reverse scan of `COUNTRY_TIMEZONES`
- [ ] The reverse timezone lookup handles these three new timezones without special-casing:
  - `Asia/Manila` → `'Philippines'`
  - `Asia/Jakarta` → `'Indonesia'`
  - `Asia/Ho_Chi_Minh` → `'Vietnam'`
- [ ] When a country is selected, stale city values that do not belong to the new country are cleared
- [ ] Timezone is set from `COUNTRY_TIMEZONES[selectedCountry]` when the user explicitly changes country

If the reverse timezone lookup is a hardcoded map (e.g. `{ 'Asia/Kuala_Lumpur': 'Malaysia', ... }`) rather than a dynamic reverse scan of `COUNTRY_TIMEZONES`, extend the map to include the three new entries:

```typescript
// If a hardcoded reverse map exists, extend it — do not replace the dynamic scan if one is already present
'Asia/Manila':      'Philippines',
'Asia/Jakarta':     'Indonesia',
'Asia/Ho_Chi_Minh': 'Vietnam',
```

If the reverse lookup already scans `COUNTRY_TIMEZONES` dynamically (e.g. `Object.entries(COUNTRY_TIMEZONES).find(([, tz]) => tz === deviceTz)?.[0]`), no change is needed — the three new timezones are already covered by Task 89's additions.

---

### `store/onboardingStore.ts` — Verify

Read the current file. Confirm:
- [ ] `country` field is present in `OnboardingDraft` with default `'Malaysia'`
- [ ] `timezone` field is present in `OnboardingDraft` with default `'Asia/Kuala_Lumpur'`
- [ ] Both fields are included in the persisted draft (not excluded from `partialize`)

If all items are correct, do not touch this file. Do not change the defaults.

---

### `services/firebase/firestore.ts` — Verify

Read the current file. In `createUserProfile()`, confirm:
- [ ] `timezone` is written as a top-level field on the user document
- [ ] `country` is written nested inside `location.country` — not as a top-level `country` field
- [ ] `SupportedCountry` (or `string`) type is accepted for the `country` parameter

If all items are correct, do not touch this file.

---

### `services/stripe.ts` — Extend

Read the current file to understand the existing price ID structure (MYR/SGD/THB entries confirmed from Task 81). Then extend the price ID lookup to add PHP, IDR, and VND currencies using the same pattern.

The extended `PRICE_IDS` map must include:

```typescript
import type { SupportedCountry } from '@/constants/regions'
import { COUNTRY_CURRENCIES } from '@/constants/regions'

// Inside the existing PRICE_IDS constant — add after existing THB entries:
PHP: {
  plus: {
    monthly:    process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_MONTHLY ?? '',
    threeMonth: process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_3MONTH ?? '',
    sixMonth:   process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_6MONTH ?? '',
  },
  pro: {
    monthly:    process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_MONTHLY ?? '',
    threeMonth: process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_3MONTH ?? '',
    sixMonth:   process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_6MONTH ?? '',
  },
},
IDR: {
  plus: {
    monthly:    process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PLUS_MONTHLY ?? '',
    threeMonth: process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PLUS_3MONTH ?? '',
    sixMonth:   process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PLUS_6MONTH ?? '',
  },
  pro: {
    monthly:    process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PRO_MONTHLY ?? '',
    threeMonth: process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PRO_3MONTH ?? '',
    sixMonth:   process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PRO_6MONTH ?? '',
  },
},
VND: {
  plus: {
    monthly:    process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PLUS_MONTHLY ?? '',
    threeMonth: process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PLUS_3MONTH ?? '',
    sixMonth:   process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PLUS_6MONTH ?? '',
  },
  pro: {
    monthly:    process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PRO_MONTHLY ?? '',
    threeMonth: process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PRO_3MONTH ?? '',
    sixMonth:   process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PRO_6MONTH ?? '',
  },
},
```

The `getPricesForCountry` function (or equivalent) must use `COUNTRY_CURRENCIES[country]` to look up the currency key, then return the correct price ID set from `PRICE_IDS`:

```typescript
export const getPricesForCountry = (country: SupportedCountry) => {
  const currency = COUNTRY_CURRENCIES[country]
  return PRICE_IDS[currency] ?? PRICE_IDS['MYR']  // MYR fallback for safety
}
```

If the existing function already follows this pattern but only covers MYR/SGD/THB, extend `PRICE_IDS` and leave the function body unchanged.

**Do not remove or rename any existing MYR, SGD, or THB entries.**

---

### `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Verify

Task 89 already added PH/ID/VN country and city keys. Confirm the following keys are present in all 4 files (they should already exist from Task 89 — do not add duplicates):

- `regions.countries.philippines` (or `regions.country.philippines` — match the existing key pattern used by Task 81 for `regions.country.malaysia`)
- `regions.countries.indonesia`
- `regions.countries.vietnam`

If Task 89 used a slightly different key prefix than the existing Task 81 entries (e.g. `regions.countries.*` vs `regions.country.*`), document the discrepancy in the CHANGELOG but do not rename existing keys. Additions only.

Add the following new onboarding keys to all 4 files (use English values as placeholders in my/zh/ta):

```json
{
  "onboarding": {
    "step1": {
      "country": {
        "philippines": "Philippines",
        "indonesia": "Indonesia",
        "vietnam": "Vietnam"
      }
    }
  }
}
```

If these keys already exist (added speculatively by Task 89), skip this step.

---

### `.env.example` — Extend

Add the new Stripe price ID env var placeholders. Append after the existing SGD/THB entries:

```
# Philippines (PHP)
EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_MONTHLY=
EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_3MONTH=
EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_6MONTH=
EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_MONTHLY=
EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_3MONTH=
EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_6MONTH=

# Indonesia (IDR)
EXPO_PUBLIC_STRIPE_PRICE_IDR_PLUS_MONTHLY=
EXPO_PUBLIC_STRIPE_PRICE_IDR_PLUS_3MONTH=
EXPO_PUBLIC_STRIPE_PRICE_IDR_PLUS_6MONTH=
EXPO_PUBLIC_STRIPE_PRICE_IDR_PRO_MONTHLY=
EXPO_PUBLIC_STRIPE_PRICE_IDR_PRO_3MONTH=
EXPO_PUBLIC_STRIPE_PRICE_IDR_PRO_6MONTH=

# Vietnam (VND)
EXPO_PUBLIC_STRIPE_PRICE_VND_PLUS_MONTHLY=
EXPO_PUBLIC_STRIPE_PRICE_VND_PLUS_3MONTH=
EXPO_PUBLIC_STRIPE_PRICE_VND_PLUS_6MONTH=
EXPO_PUBLIC_STRIPE_PRICE_VND_PRO_MONTHLY=
EXPO_PUBLIC_STRIPE_PRICE_VND_PRO_3MONTH=
EXPO_PUBLIC_STRIPE_PRICE_VND_PRO_6MONTH=
```

---

## Important Architecture Notes for Codex

1. **Dynamic iteration over `SUPPORTED_COUNTRIES` and `SEA_CITIES` is the correct pattern.** If Step1Screen already iterates these constants at render time, PH/ID/VN appear automatically with no UI code changes. Do not add a hardcoded list alongside the dynamic one.

2. **Timezone reverse lookup must not hardcode country names as string literals in Step1Screen.** The correct pattern is `Object.entries(COUNTRY_TIMEZONES).find(([, tz]) => tz === deviceTz)?.[0] as SupportedCountry | undefined`. If a static lookup map exists, it must be derived from or identical to `COUNTRY_TIMEZONES` — not a separate, independently maintained list.

3. **`EXPO_PUBLIC_` prefix is correct for Stripe publishable price IDs.** These are not secret keys. The Stripe secret key lives in `functions/src/` env vars only. Price IDs are safe to bundle in the client.

4. **`PRICE_IDS` fallback to `'MYR'` is the correct safety net.** If a user's country maps to an unsupported currency (e.g. a country added in Phase 5), returning MYR pricing is a safe fallback. Do not throw or return `undefined`.

5. **No changes to the Stripe Cloud Function (`createStripeCheckout.ts`) in this task.** That is Task 91. This task only extends the client-side `services/stripe.ts` price ID lookup. Do not touch `functions/src/`.

6. **Do not modify `types/user.ts`.** Task 89 confirmed `timezone?: string` and `location.country` are already present. This task does not add new fields to the user schema.

7. **`COUNTRY_CALLING_CODES` is available but not wired to any UI in this task.** The phone login screen (`app/auth/PhoneLoginScreen.tsx`) is out of scope. Do not import or use `COUNTRY_CALLING_CODES` in this task — it is available for Task 91 or a future task.

---

## Rollback Protocol

If `npx tsc --noEmit` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Making an assumption about a prior task's output that cannot be verified, OR
- Changing a schema field in a way that contradicts ARCHITECT.md

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the file, the error, and the information needed to proceed
4. Stop. Do not attempt a workaround. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] Zero `any` types introduced
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in any client file
- [ ] Zero inline styles — `style={{ }}` does not appear in any JSX
- [ ] Zero relative imports — `../../` does not appear in any touched file
- [ ] All new user-facing strings added to all 4 i18n files (en, my, zh, ta)
- [ ] All new constants use values from `constants/theme` or `constants/regions` — no hardcoded values

**Firebase / Security**
- [ ] No server-only fields written from the client (`age`, `banned`, `premium`, `photoVerified`, `verifiedAt`, `boost`, `stripeCustomerId`)
- [ ] `functions/src/` was not touched in this task

**Architecture**
- [ ] `SUPPORTED_COUNTRIES`, `SEA_CITIES`, `COUNTRY_TIMEZONES`, `COUNTRY_CURRENCIES` imported from `@/constants/regions` — no duplication in component files
- [ ] `PRICE_IDS` map extended — existing MYR/SGD/THB entries preserved exactly
- [ ] `getPricesForCountry` uses `COUNTRY_CURRENCIES[country]` to derive the currency — no hardcoded currency strings
- [ ] `PhoneLoginScreen.tsx` and `PhoneInput.tsx` were not touched
- [ ] Files in the "Do Not Touch" list were not modified

**Platform**
- [ ] Ask: "Would this break on Android?" — answer must be No
- [ ] Ask: "Would this break on iOS?" — answer must be No

---

## Acceptance Criteria

- [ ] `constants/regions.ts` exports verified: `SUPPORTED_COUNTRIES` contains PH/ID/VN, `COUNTRY_TIMEZONES` maps `'Philippines'` → `'Asia/Manila'`, `'Indonesia'` → `'Asia/Jakarta'`, `'Vietnam'` → `'Asia/Ho_Chi_Minh'`, `COUNTRY_CURRENCIES` maps PH → PHP, ID → IDR, VN → VND
- [ ] `Step1Screen.tsx` country selector renders Philippines, Indonesia, Vietnam without any hardcoded additions
- [ ] `Step1Screen.tsx` timezone auto-detect correctly identifies `Asia/Manila`, `Asia/Jakarta`, `Asia/Ho_Chi_Minh` and maps each to the corresponding country
- [ ] `Step1Screen.tsx` city selector renders the correct city list for each new country
- [ ] `onboardingStore.ts` draft contains `country` and `timezone` fields — no changes made if already correct
- [ ] `createUserProfile()` writes `timezone` top-level and `country` inside `location.country` — no changes made if already correct
- [ ] `services/stripe.ts` `PRICE_IDS` contains PHP, IDR, VND entries reading from `process.env.EXPO_PUBLIC_STRIPE_PRICE_*` env vars
- [ ] `getPricesForCountry('Philippines')` returns PHP price IDs; `getPricesForCountry('Indonesia')` returns IDR; `getPricesForCountry('Vietnam')` returns VND
- [ ] `getPricesForCountry` with an unsupported country returns MYR fallback, not undefined or an error
- [ ] `.env.example` has all 18 new PHP/IDR/VND price ID placeholder entries
- [ ] All 4 i18n files have `onboarding.step1.country.philippines/indonesia/vietnam` keys (added in this task or confirmed present from Task 89)
- [ ] `npx tsc --noEmit` — zero errors

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `types/user.ts`, `types/match.ts`, `constants/colors.ts`, `constants/spacing.ts`, `constants/typography.ts`, `firestore.rules`, `firestore.indexes.json`, `functions/src/` (entire directory), `app/auth/PhoneLoginScreen.tsx`, `components/ui/PhoneInput.tsx`, `app/onboarding/Step6Screen.tsx` (unless a specific gap is found during verification of `createUserProfile` — if Step6Screen must be touched, document the reason in the CHANGELOG)

---

## Commit

```
git commit -m "task-90: extend onboarding and stripe for PH, ID, VN"
```

---

## After This Session

Update `CHANGELOG.md` using this template:

```
## [Phase 4A — Task 90] — YYYY-MM-DD

### Completed

- Task 90: Onboarding & Discovery — Philippines, Indonesia, Vietnam
- [List each verified file and what was confirmed or changed]
- services/stripe.ts: PHP/IDR/VND price ID lookup added
- .env.example: 18 new Stripe price ID placeholder entries added

### Files Created

- None

### Files Modified

- services/stripe.ts: PRICE_IDS extended with PHP/IDR/VND; getPricesForCountry covers all 6 countries
- .env.example: PHP/IDR/VND Stripe price ID vars added
- [Any i18n files if keys were added]
- [Step1Screen.tsx only if the timezone reverse lookup required patching — note what was changed and why]

### Architecture Decisions

- [Note whether Step1Screen required any changes or was confirm-only]
- [Note whether the timezone reverse lookup was a dynamic scan or a static map, and what was done]
- PRICE_IDS fallback currency is MYR; getPricesForCountry never returns undefined

### Conflict Risks Introduced

- Task 91 modifies createStripeCheckout.ts (Cloud Function) and PremiumScreen.tsx; it reads COUNTRY_CURRENCIES from a duplicated inline map in the CF (not from the client constants file) — verify the inline map in Task 91 matches COUNTRY_CURRENCIES from constants/regions.ts

### Known Issues / Deferred

- None — or list any deferred items

### Next Up

- Task 91: Stripe Tier 2 — PHP/IDR/VND Pricing & Local Payment Methods
```

Then return to claude.ai with the updated CHANGELOG.md to request the Task 91 prompt.

---

## Reasoning Level

Medium
