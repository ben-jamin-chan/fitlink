# TASKS_PHASE4.md — [APP_NAME]
# Phase 4: Consolidation (Months 13–18)
# Created: June 2026

> **How to use this file:**
> - One task at a time in Codex. Never batch multiple tasks in one prompt.
> - Check off each task after Codex completes and you have reviewed the diff.
> - Git commit after every task: `git commit -m "task-XX: <description>"`
> - **Always check CHANGELOG.md before generating a prompt** — it is the authoritative
>   source of what is actually in the codebase. The checkboxes below are the spec baseline,
>   not live completion status.
> - If Codex drifts or produces unexpected output, bring the diff back to claude.ai Architect
>   for review before proceeding.
> - Tasks are ordered by dependency — do not skip ahead. See the Dependency Map below.

---

## Task Number Continuity

Phase 3 ended at Task 88. Phase 4 begins at Task 89.
Tasks 89–112 are reserved for Phase 4 (24 tasks across 5 epics).

---

## Inter-Task Dependency Map

```
Task 89 (SEA Tier 2 Types & Regions)
  └─► Task 90 (Onboarding & Discovery)   — needs updated constants/regions.ts
  └─► Task 91 (Stripe Tier 2 Pricing)    — needs country list from Task 89
  └─► Task 101 (Safety Center)           — needs PH/ID/VN emergency numbers from Task 89

Task 90 (Onboarding & Discovery)
  └─► Task 91 (Stripe Tier 2 Pricing)    — needs country field written to Firestore

Task 91 (Stripe Tier 2 Pricing)
  └─► Task 92 (Phase 4 Security Rules)   — new country field needs rules review

Task 89 + 90 + 91
  └─► Task 92 (Security Rules)           — consolidates any new fields/collections

Task 92 (Security Rules)
  └─► Task 93 (Phase 4 Indexes)          — rules before indexes

Task 94 (Admin Dashboard scaffold)
  └─► Task 95 (Admin Actions)            — needs auth + layout from Task 94

Task 96 (restoreStripeSubscription CF)
  └─► Task 97 (Restore Purchases UI)     — needs the CF from Task 96

Task 98 (deleteAccount CF)
  └─► Task 99 (Delete Account screen)    — needs the CF from Task 98

Task 98 (deleteAccount CF)
  └─► Task 100 (Blocked Users screen)    — independent, can run after Task 92
  └─► Task 101 (Safety Center screen)    — independent after Task 89

Task 102 (Jest CF setup)
  └─► Tasks 103–105 (CF test suites)     — need the Jest harness from Task 102
```

**Critical chains:**
- `Task 89 → Task 90 → Task 91 → Task 92 → Task 93` (SEA Tier 2 + rules + indexes)
- `Task 94 → Task 95` (admin dashboard scaffold before actions)
- `Task 96 → Task 97` (restore CF before restore UI)
- `Task 98 → Task 99` (delete CF before delete screen)
- `Task 102 → Tasks 103–105` (Jest harness before test suites)

---

## Phase 4 Scope

Phase 4 ships five epics targeting 100,000 users across all six original PRD markets by Month 18:

1. **SEA Tier 2 Expansion** — Philippines, Indonesia, Vietnam city/timezone data, Stripe pricing (PHP/IDR/VND), and local payment method surface
2. **Admin Moderation Dashboard** — Web app for reviewing `/admin_queue` and `/flags`; ban/warn/dismiss actions; hosted on Firebase Hosting under `/admin` subfolder
3. **Subscription Lifecycle Completion** — `restorePurchases()` for reinstall scenario; `deleteAccount` with cancel-at-period-end Stripe handling
4. **PRD Compliance Gaps** — Safety Center screen (PRD FR-6.3.1), Blocked Users screen (PRD FR-4.3.1), Account Deletion screen (PRD FR-4.3.1 Danger Zone)
5. **Testing Infrastructure Foundation** — Jest unit test harness for Cloud Functions; Detox E2E skeleton for critical user journey

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Admin dashboard location | `/admin` subfolder in monorepo | Shares Firebase config and CF types; no separate repo overhead |
| Bahasa Indonesia (id.json) | Not added in Phase 4 | EN/MY/ZH/TA covers PH/ID/VN for now; `id.json` deferred to Phase 5 |
| Stripe cancellation on delete | Cancel at period end | Avoid prorate refund complexity; user retains access until expiry |
| Testing scope | Cloud Functions (Jest) only | Highest financial/data-integrity risk; client stores deferred to Phase 5 |
| Voice transcription | Deferred beyond Phase 4 | Not in original PRD; needs product scoping first |
| In-app video calling | Deferred beyond Phase 4 | Not in original PRD; needs product scoping first |
| Live GPS tracking | Deferred beyond Phase 4 | Not in original PRD; needs product scoping first |
| Improved face-matching ML | Deferred to later phase | Current Cloud Vision implementation ships; ML upgrade is a separate initiative |
| Gym/workout discovery mode | Deferred to later phase | Natural follow-on from Phase 3 check-ins; needs product scoping |
| SEO / web landing pages | Deferred to later phase | Separate initiative from mobile app |

---

## New Firestore Schema (Phase 4 Additions)

No new top-level collections in Phase 4. Additions are field extensions and admin-only reads:

`/users/{userId}` — no new fields (country and timezone already added in Phase 3 Task 81/82)

`/blocked/{userId}/{blockedUserId}` — already written by unmatch flow (Phase 1/2); no schema change, just UI added in Task 100

Admin dashboard reads from (no schema changes, read-only from web):
- `/admin_queue/{docId}` — already has `status`, `createdAt` (Phase 3 Task 86)
- `/flags/{docId}` — already has `status`, `createdAt` (Phase 3 Task 86)
- `/reports/{reportId}` — already has `reason`, `details`, `status`, `createdAt`
- `/users/{uid}` — admin reads full profile for context

`/users/{uid}` — admin dashboard writes only:
- `banned: true` (via Admin SDK, same as `checkReportThreshold` CF pattern)

---

## Pre-Flight: Manual Setup (Before Task 89)

**Step A — Stripe Tier 2 Price IDs**
1. In Stripe Dashboard, create price objects for PHP, IDR, VND currencies using the PRD Section 5.12 pricing table
2. Create for both Plus and Pro tiers, all three billing periods (monthly / 3-month / 6-month)
3. Add to `.env`:
   ```
   STRIPE_PRICE_PHP_PLUS_MONTHLY=price_...
   STRIPE_PRICE_PHP_PLUS_3MONTH=price_...
   STRIPE_PRICE_PHP_PLUS_6MONTH=price_...
   STRIPE_PRICE_PHP_PRO_MONTHLY=price_...
   STRIPE_PRICE_PHP_PRO_3MONTH=price_...
   STRIPE_PRICE_PHP_PRO_6MONTH=price_...
   STRIPE_PRICE_IDR_PLUS_MONTHLY=price_...
   # ... (same pattern for IDR and VND)
   STRIPE_PRICE_VND_PLUS_MONTHLY=price_...
   # ...
   ```
4. Enable GCash, PayMaya (PH), OVO, GoPay, DANA (ID), MoMo, ZaloPay (VN) in your Stripe Dashboard payment methods settings

**Step B — Firebase Hosting Admin Config**
1. In `firebase.json`, add a hosting target for the admin app:
   ```json
   "hosting": [
     { "target": "app", "public": "web-build" },
     { "target": "admin", "public": "admin/build", "rewrites": [{ "source": "**", "destination": "/index.html" }] }
   ]
   ```
2. Run `firebase target:apply hosting admin <your-project-id>-admin`

**Step C — Firebase Admin Custom Claims**
1. In Firebase Console → Authentication, identify the UID(s) that should have admin access
2. Set custom claims via Firebase Admin SDK in a one-off script:
   ```typescript
   admin.auth().setCustomUserClaims(uid, { admin: true })
   ```
3. Admin dashboard reads this claim to gate access

✅ Pre-flight complete when: Stripe Tier 2 price IDs in `.env`; Firebase Hosting admin target configured; at least one admin UID has `admin: true` custom claim.

---

## 🌏 PHASE 4A: SEA Tier 2 Expansion
### Tasks 89–93

---

### Task 89 — SEA Tier 2 Types, Regions & Timezone Constants
- **File(s):** `constants/regions.ts`, `types/user.ts` (read-only verify), `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json`
- **Dependencies:** None — first task of Phase 4
- **Action:**
  - `constants/regions.ts` — extend all three exports:
    ```typescript
    export const SUPPORTED_COUNTRIES = [
      'Malaysia', 'Singapore', 'Thailand',
      'Philippines', 'Indonesia', 'Vietnam'
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
      Malaysia:    ['Kuala Lumpur', 'Selangor', 'Penang', 'Johor Bahru', 'Ipoh',
                    'Melaka', 'Kota Kinabalu', 'Kuching', 'Kuantan', 'Alor Setar'],
      Singapore:   ['Central', 'East', 'North', 'South', 'West'],
      Thailand:    ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Hat Yai'],
      Philippines: ['Manila', 'Cebu', 'Davao', 'Quezon City', 'Makati',
                    'Taguig', 'Pasig', 'Antipolo', 'Iloilo', 'Zamboanga'],
      Indonesia:   ['Jakarta', 'Bali', 'Surabaya', 'Bandung', 'Medan',
                    'Semarang', 'Makassar', 'Palembang', 'Tangerang', 'Depok'],
      Vietnam:     ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hai Phong',
                    'Can Tho', 'Bien Hoa', 'Hue', 'Nha Trang', 'Vung Tau', 'Quy Nhon'],
    }

    export const COUNTRY_CURRENCIES: Record<SupportedCountry, string> = {
      Malaysia:    'MYR',
      Singapore:   'SGD',
      Thailand:    'THB',
      Philippines: 'PHP',
      Indonesia:   'IDR',
      Vietnam:     'VND',
    }

    export const COUNTRY_CALLING_CODES: Record<SupportedCountry, string> = {
      Malaysia:    '+60',
      Singapore:   '+65',
      Thailand:    '+66',
      Philippines: '+63',
      Indonesia:   '+62',
      Vietnam:     '+84',
    }
    ```
  - `types/user.ts` — verify only; no changes expected. Confirm `timezone?: string` and `location.country` are present (added Phase 3). Do not modify.
  - i18n files — add city/country display keys for PH/ID/VN cities under `regions.*`:
    - `regions.countries.philippines`, `regions.countries.indonesia`, `regions.countries.vietnam`
    - City keys under `regions.cities.*` using English values as placeholders in my/zh/ta
  - Run `npx tsc --noEmit` — zero errors
- **Output:** All 6 countries and their cities/timezones/currencies available as typed constants; tsc clean
- **Reasoning Level:** Low

---

### Task 90 — Onboarding & Discovery: Add Philippines, Indonesia, Vietnam
- **File(s):** `app/onboarding/Step1Screen.tsx`, `store/onboardingStore.ts`, `services/firebase/firestore.ts`, `services/stripe.ts`
- **Dependencies:** Task 89 (`SUPPORTED_COUNTRIES`, `SEA_CITIES`, `COUNTRY_TIMEZONES`, `COUNTRY_CURRENCIES` must be extended)
- **Conflict risk:** `Step1Screen.tsx` and `store/onboardingStore.ts` were also modified in Task 81 (MY/SG/TH addition) — verify Task 81's changes are present before modifying.
- **Action:**
  - `app/onboarding/Step1Screen.tsx`:
    - Country `SingleSelect` already reads from `SUPPORTED_COUNTRIES` — no UI change needed if it iterates the constant
    - City `SingleSelect` already reads from `SEA_CITIES[selectedCountry]` — no UI change needed
    - Timezone auto-set already reads from `COUNTRY_TIMEZONES` — no change needed
    - **Verify** the auto-detect logic `Intl.DateTimeFormat().resolvedOptions().timeZone` correctly maps to the new Philippines/Indonesia/Vietnam timezones via `COUNTRY_TIMEZONES` — if the mapping is a reverse lookup, ensure `Asia/Manila`, `Asia/Jakarta`, `Asia/Ho_Chi_Minh` are handled
    - Phone number OTP: `COUNTRY_CALLING_CODES` is now available — if Step 1 has a country-code dropdown for phone entry, extend it to include +63, +62, +84
  - `store/onboardingStore.ts`:
    - If `country` default is hardcoded to `'Malaysia'` — leave it; auto-detect handles the rest
    - No other changes expected; verify `country` and `timezone` are in the draft
  - `services/firebase/firestore.ts` `createUserProfile()`:
    - Verify `timezone` and `country` are written — added in Task 81. No change expected unless they were missed
  - `services/stripe.ts` `getStripePrices()`:
    - Extend the currency lookup to return PHP/IDR/VND price IDs from `process.env`:
      ```typescript
      const PRICE_IDS: Record<string, Record<string, Record<string, string>>> = {
        MYR: { plus: { monthly: process.env.EXPO_PUBLIC_STRIPE_PRICE_MYR_PLUS_MONTHLY ?? '', ... }, ... },
        SGD: { ... },
        THB: { ... },
        PHP: {
          plus: {
            monthly:  process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_MONTHLY ?? '',
            threeMonth: process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_3MONTH ?? '',
            sixMonth:   process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_6MONTH ?? '',
          },
          pro: {
            monthly:  process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_MONTHLY ?? '',
            threeMonth: process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_3MONTH ?? '',
            sixMonth:   process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_6MONTH ?? '',
          },
        },
        IDR: { /* same pattern */ },
        VND: { /* same pattern */ },
      }
      ```
    - `getPricesForCountry(country: SupportedCountry)` — use `COUNTRY_CURRENCIES[country]` to look up the currency, then return the correct price ID set
  - Add i18n keys: `onboarding.step1.country.philippines`, `.indonesia`, `.vietnam` to all 4 files
  - Run `npx tsc --noEmit` — zero errors
- **Output:** New users in PH/ID/VN can complete onboarding; correct currency selected for their country; timezone written correctly; tsc clean
- **Reasoning Level:** Medium

---

### Task 91 — Stripe Tier 2: PHP/IDR/VND Pricing & Local Payment Methods
- **File(s):** `app/settings/PremiumScreen.tsx`, `functions/src/createStripeCheckout.ts`, `services/stripe.ts`
- **Dependencies:** Task 90 (`getStripePrices()` must return PHP/IDR/VND price sets; `country` written to Firestore for new users)
- **Action:**
  - `functions/src/createStripeCheckout.ts`:
    - Read `users/{uid}.location.country` from Firestore
    - Map country → currency using `COUNTRY_CURRENCIES` (import from a shared constants file, or inline the mapping — do not import from client `constants/regions.ts` in a CF; duplicate the map inline)
    - Pass the correct `currency` to `stripe.checkout.sessions.create` or `stripe.paymentIntents.create`
    - For PH: ensure `payment_method_types` includes `'card'` (GCash/PayMaya are enabled at the Stripe Dashboard level, not per-session in the current Stripe SDK version — add a comment noting this)
    - For ID: same note for OVO/GoPay/DANA
    - For VN: same note for MoMo/ZaloPay
    - Return the correct localised price display string alongside the session URL
  - `app/settings/PremiumScreen.tsx`:
    - `PriceDisplay` component — add PHP/IDR/VND formatting:
      - PHP: `₱{amount}` — no decimal
      - IDR: `Rp {amount}` — thousands separator, no decimal
      - VND: `₫{amount}` — thousands separator, no decimal
    - Billing period savings labels — verify they calculate correctly for all currencies
    - "Subscribe" button label uses the localised price from `getStripePrices()`
  - Add `.env.example` entries for all new Stripe price ID env vars (PHP/IDR/VND, Plus/Pro, all billing periods)
  - Run `npm --prefix functions run build` — zero errors
- **Output:** PH/ID/VN users see correct local currency pricing; Stripe checkout creates sessions with correct currency; tsc and functions build clean
- **Reasoning Level:** High
- **🔒 Security review required** (touches Cloud Function + Stripe)

---

### Task 92 — Phase 4 Firestore Security Rules Update
- **File(s):** `firestore.rules`
- **Dependencies:** Tasks 89–91 complete — verify no new collections or server-only fields were introduced that need coverage. Phase 3 rules are the baseline; this task extends them, never replaces them.
- **Action:**
  - Audit: do Tasks 89–91 introduce any new Firestore writes not yet covered by existing rules?
    - `country` and `timezone` are client-writable user fields — already permitted by existing rules
    - No new collections introduced in Phase 4A
  - Confirm existing `doesNotModifyServerOnlyFields()` guard still covers `boost`, `banned`, `premium`, `age`, `photoVerified`, `verifiedAt`, `stripeCustomerId`
  - Add explicit comment block at the top of the rules file documenting Phase 4 review date and confirming no new rules were needed for Phase 4A
  - If any gap is found during audit: add the rule; document in CHANGELOG
  - Run emulator probe: `firebase emulators:exec --only firestore "node -e \"process.exit(0)\""`
- **Output:** Rules file confirmed current; no Phase 4A gaps; emulator probe passes
- **Reasoning Level:** Medium
- **🔒 Security review required** (touches firestore.rules)

---

### Task 93 — Phase 4 Firestore Indexes
- **File(s):** `firestore.indexes.json`
- **Dependencies:** Task 92 (rules reviewed before indexes)
- **Action:**
  - Audit: do Phase 4A queries require any new composite indexes?
    - `getDiscoveryStack` queries by `location.city` — already indexed (Phase 1)
    - No new collection queries introduced in Phase 4A
  - Validate the existing JSON is still valid after any Phase 3 additions:
    ```bash
    node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"
    ```
  - If any Phase 4A query pattern requires a new index, add it; otherwise confirm no changes needed and document in CHANGELOG
  - Add comment in CHANGELOG noting Phase 4A introduces no new indexes
- **Output:** `firestore.indexes.json` valid; Phase 4A confirmed index-complete
- **Reasoning Level:** Low

---

## 🖥️ PHASE 4B: Admin Moderation Dashboard
### Tasks 94–95

> **Architecture note:** The admin dashboard is a separate React web app living in
> `/admin/` within the monorepo. It has its own `package.json`, `tsconfig.json`, and
> build output. It is NOT a React Native app and does NOT use Expo. It shares only:
> - Firebase project config (reads from the same Firestore)
> - TypeScript type definitions (copy/import from `../types/` as needed)
> - No Zustand, no React Navigation, no Reanimated, no Expo SDK
>
> Codex must never import from `@/` aliases or Expo packages inside `/admin/`.

---

### Task 94 — Admin Dashboard: Project Scaffold & Auth
- **File(s):** `admin/package.json` (new), `admin/tsconfig.json` (new), `admin/src/main.tsx` (new), `admin/src/App.tsx` (new), `admin/src/firebase.ts` (new), `admin/src/pages/LoginPage.tsx` (new), `admin/src/pages/DashboardPage.tsx` (new — stub), `admin/src/components/AdminRoute.tsx` (new), `admin/index.html` (new), `admin/vite.config.ts` (new)
- **Dependencies:** Pre-flight Step B (Firebase Hosting admin target configured); Pre-flight Step C (at least one UID has `admin: true` custom claim)
- **Action:**
  - Scaffold a minimal React + TypeScript + Vite app in `/admin/`:
    ```
    admin/
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── package.json          # React, react-dom, firebase, typescript, vite
    └── src/
        ├── main.tsx
        ├── App.tsx           # Router: / → LoginPage, /dashboard → DashboardPage (guarded)
        ├── firebase.ts       # initializeApp with same project config as mobile app
        ├── pages/
        │   ├── LoginPage.tsx     # Firebase Auth sign-in with Google only (admin accounts)
        │   └── DashboardPage.tsx # Stub — three tabs: Reports, Flags, Users
        └── components/
            └── AdminRoute.tsx    # Reads custom claim; redirects to / if not admin
    ```
  - `admin/src/firebase.ts`:
    - `initializeApp` with the same Firebase config (read from Vite env vars `VITE_FIREBASE_*`)
    - Export `auth`, `db` (Firestore), `functions` instances
    - **No Admin SDK** — the dashboard uses the client SDK with Firestore rules + custom claim checks. Admin actions (ban) go through a new Cloud Function (`adminAction`) that verifies the `admin: true` custom claim server-side (Task 95)
  - `admin/src/components/AdminRoute.tsx`:
    - On mount: `auth.currentUser.getIdTokenResult()` → check `claims.admin === true`
    - If not admin: redirect to `/`
    - If admin: render children
    - Loading state while claim is being fetched
  - `admin/src/pages/LoginPage.tsx`:
    - Google Sign-In only (admin accounts are Google-authenticated)
    - On sign-in: verify `admin` claim; if absent, sign out and show "Unauthorised" error
    - No phone/email/Apple sign-in for admin
  - `admin/src/pages/DashboardPage.tsx` — stub only in this task:
    - Three tab buttons: "Reports" | "Flags" | "Users"
    - Empty panels for each tab (filled in Task 95)
    - Header: "fitlink Admin" + signed-in email + "Sign Out" button
  - `admin/package.json` — dependencies:
    - `react`, `react-dom`, `react-router-dom`, `firebase`, `typescript`
    - devDeps: `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`
    - No Expo, no React Native, no Zustand, no i18next
  - `admin/.env.example` — add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc.
  - Add `admin/` to root `.gitignore` `node_modules` exclusion; add `admin/build/` to `.gitignore`
  - Run `npm --prefix admin install && npm --prefix admin run build` — zero errors
- **Constraints:** The admin app uses only Firebase client SDK. No direct Firestore writes for destructive actions (ban) — those go through a Cloud Function in Task 95 that verifies the custom claim server-side. This is the correct security pattern: custom claims in ID tokens can be verified by Cloud Functions; Firestore rules can also check `request.auth.token.admin == true`.
- **Output:** Admin app scaffolded; Google Sign-In works; `AdminRoute` guards correctly; build passes; unauthenticated access redirected
- **Reasoning Level:** High

---

### Task 95 — Admin Dashboard: Moderation Queue & Actions
- **File(s):** `admin/src/pages/DashboardPage.tsx`, `admin/src/components/ReportsPanel.tsx` (new), `admin/src/components/FlagsPanel.tsx` (new), `admin/src/components/UsersPanel.tsx` (new), `admin/src/components/UserProfileModal.tsx` (new), `functions/src/adminAction.ts` (new), `functions/src/index.ts`
- **Dependencies:** Task 94 (admin scaffold, auth, and stub dashboard must exist)
- **Action:**
  - `functions/src/adminAction.ts` — 2nd gen callable (`asia-southeast1`):
    - Auth check: `if (!request.auth) throw HttpsError('unauthenticated', ...)`
    - **Admin claim check** (in addition to auth): `const token = await admin.auth().getUser(request.auth.uid); if (!token.customClaims?.admin) throw HttpsError('permission-denied', 'admin-only')`
    - Accept `{ action: 'ban' | 'warn' | 'dismiss'; targetId: string; reason: string; sourceCollection: 'admin_queue' | 'flags' | 'reports'; sourceDocId: string }`
    - For `'ban'`: `admin.firestore().doc('users/${targetId}').update({ banned: true })` + update source doc `status: 'actioned'`
    - For `'warn'`: update source doc `status: 'actioned'`; write to `/users/${targetId}/warnings/{auto-id}` `{ reason, createdAt, adminUid: request.auth.uid }`
    - For `'dismiss'`: update source doc `status: 'actioned'`
    - All actions write an audit log entry to `/admin_audit/{auto-id}`: `{ action, targetId, sourceDocId, reason, adminUid: request.auth.uid, createdAt: FieldValue.serverTimestamp() }`
    - Return `{ success: true }`
    - Export from `functions/src/index.ts`
  - **Firestore rules update** (`firestore.rules`):
    - `/admin_audit/{docId}`: `allow read, write: if false;` — CF only
    - `/users/{uid}/warnings/{docId}`: `allow read: if request.auth.uid == uid; allow write: if false;` — user can read own warnings; CF writes
  - `admin/src/components/ReportsPanel.tsx`:
    - Query `/reports` where `status == 'pending'`, order `createdAt DESC`, limit 50
    - Table rows: reported user name (link to `UserProfileModal`), reporter, reason, date
    - Row actions: "Ban", "Warn", "Dismiss" buttons — each calls `adminAction` CF
    - On action: optimistic status update in UI; show success toast or error
    - Pagination: "Load more" button
  - `admin/src/components/FlagsPanel.tsx`:
    - Same pattern as `ReportsPanel` but queries `/flags` where `status == 'pending'`
    - Additional column: flagged photo URL (thumbnail, click to view full size)
  - `admin/src/components/UsersPanel.tsx`:
    - Search bar: query `/users` by `firstName` prefix (simple client-side filter on fetched results — no full-text search)
    - Fetch 20 users at a time ordered by `createdAt DESC`
    - Table: name, email (if present), banned status, premium tier, createdAt
    - Row: "View Profile" → `UserProfileModal`, "Ban" button (if not already banned)
  - `admin/src/components/UserProfileModal.tsx`:
    - Modal overlay showing full user document: photos (grid), bio, activities, premium status, ban status
    - "Ban User" / "Unban User" button (unban sets `banned: false` via `adminAction` — add `'unban'` action to the CF)
    - "Close" button
  - `admin/src/pages/DashboardPage.tsx`:
    - Wire the three tab panels to `ReportsPanel`, `FlagsPanel`, `UsersPanel`
    - Show badge count on each tab (pending items count)
  - Run `npm --prefix admin run build` and `npm --prefix functions run build` — both zero errors
- **Output:** Admin can sign in, view pending reports/flags, ban/warn/dismiss from the dashboard; all actions audit-logged; unauthenticated or non-admin calls to `adminAction` rejected server-side
- **Reasoning Level:** Extra High
- **🔒 Security review required** (new CF with custom claim check + Firestore rules)

---

## 💳 PHASE 4C: Subscription Lifecycle Completion
### Tasks 96–97

---

### Task 96 — restoreStripeSubscription Cloud Function
- **File(s):** `functions/src/restoreStripeSubscription.ts` (new), `functions/src/index.ts`
- **Dependencies:** None — independent of Phase 4A/B
- **Context:** When a user reinstalls the app or logs in on a new device, their `premium` field in Firestore may show inactive even though an active Stripe subscription exists. This CF re-syncs the subscription status.
- **Action:**
  - `functions/src/restoreStripeSubscription.ts` — 2nd gen callable (`asia-southeast1`):
    - Auth check
    - Read `users/{uid}.stripeCustomerId` — if absent, return `{ restored: false, reason: 'no-customer' }`
    - Call `stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 })`
    - If no active subscription found: return `{ restored: false, reason: 'no-active-subscription' }`
    - If active subscription found:
      - Extract `tier` from subscription metadata or price ID lookup (match against known price IDs from env vars)
      - Write `users/{uid}.premium: { tier, active: true, expiresAt: Timestamp.fromMillis(subscription.current_period_end * 1000) }` using Admin SDK
      - Return `{ restored: true, tier, expiresAt }`
    - Export from `functions/src/index.ts`
  - Run `npm --prefix functions run build` — zero errors
- **Output:** `restoreStripeSubscription` callable correctly re-syncs premium status from Stripe; unauthenticated calls rejected; tsc and functions build clean
- **Reasoning Level:** Medium
- **🔒 Security review required** (touches Cloud Function + Stripe)

---

### Task 97 — Restore Purchases UI
- **File(s):** `app/settings/PremiumScreen.tsx`, `store/subscriptionStore.ts` (or equivalent subscription store)
- **Dependencies:** Task 96 (`restoreStripeSubscription` CF must exist)
- **Action:**
  - `app/settings/PremiumScreen.tsx`:
    - For free users only: add a "Restore Purchases" text button below the pricing cards (small, gray, centered)
    - On press: call `restoreStripeSubscription` CF via `httpsCallable`; show `LoadingOverlay` during call
    - On `restored: true`: update local `profileStore.profile.premium` from the return value; show success toast `t('premium.restore.success')`; navigate back (premium UI should now render)
    - On `restored: false, reason: 'no-active-subscription'`: show `Alert` `t('premium.restore.notFound')`
    - On `restored: false, reason: 'no-customer'`: show `Alert` `t('premium.restore.notFound')` (same message — don't expose internal reason)
    - On error: show `Alert` `t('premium.restore.error')`
  - Add i18n keys: `premium.restore.button`, `premium.restore.success`, `premium.restore.notFound`, `premium.restore.error` to all 4 files
  - Run `npx tsc --noEmit` — zero errors
- **Output:** "Restore Purchases" visible to free users on PremiumScreen; successful restore unlocks premium immediately; error states handled gracefully; tsc clean
- **Reasoning Level:** Low

---

## 🗑️ PHASE 4D: PRD Compliance Gaps
### Tasks 98–101

---

### Task 98 — deleteAccount Cloud Function
- **File(s):** `functions/src/deleteAccount.ts` (new), `functions/src/index.ts`
- **Dependencies:** None
- **Context:** PDPA requires full account deletion on user request. Deletion order matters: Stripe → Firestore → Storage → RTDB → Firebase Auth. If Auth is deleted first, the CF loses the ability to clean up other data. Stripe subscription is cancelled at period end (no immediate cancellation — user retains access until `current_period_end`).
- **Action:**
  - `functions/src/deleteAccount.ts` — 2nd gen callable (`asia-southeast1`):
    - Auth check
    - Deletion sequence (in order — do not change order):
      1. **Stripe** (if `stripeCustomerId` exists):
         - `stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 })`
         - If active: `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })`
         - Swallow errors (Stripe failure should not block deletion)
      2. **Firestore user subcollections** (must delete before parent doc):
         - Delete all docs in `users/{uid}/dailyLikes/`
         - Delete all docs in `users/{uid}/notificationPreferences/`
         - Delete all docs in `users/{uid}/warnings/` (if any from admin actions)
      3. **Firestore user doc**: `admin.firestore().doc('users/${uid}').delete()`
      4. **Firestore swipe subcollections**:
         - Delete all docs in `swipes/{uid}/likes/` and `swipes/{uid}/passes/`
         - Delete parent `swipes/{uid}` doc if it exists
      5. **Firestore matches**: query `matches` where `users array-contains uid`; for each:
         - Delete the match doc (do not delete RTDB chat here — handled in step 6)
         - Note: we do not delete the other user's match — the match doc deletion removes it from both
      6. **Firestore gym check-ins**: query `gymCheckins` where `userId == uid`; delete each
      7. **Cloud Storage photos**: list and delete all files under `users/{uid}/`
      8. **Firebase Realtime Database**: delete `/chats/{matchId}` for all match IDs collected in step 5
      9. **Firebase Auth**: `admin.auth().deleteUser(uid)` — this must be last
    - Return `{ success: true }` (or throw if Auth deletion fails — that is the only unrecoverable step)
    - Export from `functions/src/index.ts`
  - Run `npm --prefix functions run build` — zero errors
- **Constraints:** The order above is non-negotiable. Auth deletion (step 9) must be last — after Auth is deleted the CF still runs to completion (it's a server process), but any subsequent CF call from the client would be unauthenticated. Storage and RTDB deletions are best-effort; swallow errors and continue if individual file deletions fail.
- **Output:** `deleteAccount` CF fully removes all user data across all services; Stripe subscription cancelled at period end (not immediately); Auth record deleted last; tsc and functions build clean
- **Reasoning Level:** Extra High
- **🔒 Security review required** (CF touches Stripe, Auth, Storage, RTDB, Firestore)

---

### Task 99 — Delete Account Screen
- **File(s):** `app/settings/DeleteAccountScreen.tsx` (new), `app/navigation/RootNavigator.tsx` (or equivalent settings navigator), `app/settings/SettingsScreen.tsx`
- **Dependencies:** Task 98 (`deleteAccount` CF must exist)
- **Action:**
  - `app/settings/DeleteAccountScreen.tsx` — default export screen:
    - **Section 1 — What will be deleted** (static list, shown before confirmation):
      - Your profile and photos
      - All your matches and conversations
      - Your subscription (cancels at end of current billing period if active)
      - All your activity data
      - Your account cannot be recovered
    - **Section 2 — Re-authentication** (required before deletion):
      - If user signed in with phone: show OTP re-verification flow (`auth.signInWithPhoneNumber`)
      - If user signed in with Google: show "Re-authenticate with Google" button (`GoogleSignin.signIn()` → `signInWithCredential`)
      - If user signed in with email: show password input field
      - Re-auth must succeed before the delete button becomes enabled
    - **Section 3 — Final confirmation**:
      - Input field: "Type DELETE to confirm"
      - Delete button: disabled until re-auth complete AND input text === 'DELETE'
      - On tap: `Alert.alert` final confirm (`t('deleteAccount.finalConfirm.title')`, `t('deleteAccount.finalConfirm.message')`, Cancel / Delete destructive)
      - On confirm: show `LoadingOverlay`; call `deleteAccount` CF
      - On CF success: clear all Zustand stores; `await auth.signOut()`; `await AsyncStorage.clear()`; navigate to `WelcomeScreen` (replace stack)
      - On CF error: show `Alert` with error message; do not navigate away
  - `app/settings/SettingsScreen.tsx`:
    - "Danger Zone" section already has a "Delete Account" row (per PRD) — wire it to navigate to `DeleteAccountScreen`
    - If the row does not exist yet: add it at the bottom of the settings list, red text
  - Add `DeleteAccountScreen` to the settings stack navigator
  - Add i18n keys: `deleteAccount.*` — all confirmation text, list items, button labels — to all 4 files
  - Run `npx tsc --noEmit` — zero errors
- **Constraints:** Re-authentication is mandatory — do not allow the delete button to be enabled without it. The "DELETE" text confirmation is a secondary guard. Navigation after successful deletion must replace the entire navigation stack (not push) so the user cannot navigate back.
- **Output:** Full PDPA-compliant account deletion flow; re-auth required; Stripe cancelled at period end; all data removed; user returned to WelcomeScreen; tsc clean
- **Reasoning Level:** High

---

### Task 100 — Blocked Users Screen
- **File(s):** `app/settings/BlockedUsersScreen.tsx` (new), `app/navigation/` (settings stack), `app/settings/SettingsScreen.tsx`
- **Dependencies:** None — `/blocked/{uid}/{targetId}` collection written by unmatch flow since Phase 1
- **Action:**
  - `app/settings/BlockedUsersScreen.tsx` — default export screen:
    - On mount: query `/blocked/{uid}` (all docs under the current user's blocked subcollection)
    - For each blocked document: fetch the blocked user's `firstName` and primary `photos[0]` from `/users/{blockedId}` (batch fetch with `Promise.allSettled` — handle case where blocked user has deleted their account)
    - FlatList of blocked users:
      - Each row: circular photo (60x60, default avatar if deleted), name (or "Deleted User"), "Unblock" button
      - "Unblock" → `Alert` confirm → `deleteDoc` on `/blocked/{uid}/{blockedId}` → remove from local list
    - Empty state: "You haven't blocked anyone" with shield icon
    - Pull-to-refresh
  - `app/settings/SettingsScreen.tsx` — Privacy section:
    - "Blocked Users" row already in the PRD spec — if not yet wired, wire it to navigate to `BlockedUsersScreen`
  - Add `BlockedUsersScreen` to settings stack navigator
  - Add i18n keys: `settings.blocked.title`, `settings.blocked.empty`, `settings.blocked.unblock`, `settings.blocked.confirmUnblock`, `settings.blocked.deletedUser` to all 4 files
  - Run `npx tsc --noEmit` — zero errors
- **Output:** Users can view and unblock blocked users from Settings; deleted-account gracefully handled; tsc clean
- **Reasoning Level:** Medium

---

### Task 101 — Safety Center Screen
- **File(s):** `app/settings/SafetyCenterScreen.tsx` (new), `app/navigation/` (settings stack), `app/settings/SettingsScreen.tsx`, `store/matchStore.ts` (read only — for first-match prompt), `app/matches/MatchesScreen.tsx`
- **Dependencies:** Task 89 (PH/ID/VN emergency numbers require the country data from regions.ts)
- **Action:**
  - `constants/safetyResources.ts` (new):
    ```typescript
    export const EMERGENCY_NUMBERS: Record<string, {
      police: string
      crisis?: string
      crisisName?: string
    }> = {
      Malaysia: {
        police: '999',
        crisis: '15999',
        crisisName: 'Talian Kasih (Women & Children)',
      },
      Singapore: {
        police: '999',
        crisis: '6779 0282',
        crisisName: 'AWARE Sexual Assault Care Centre',
      },
      Thailand: {
        police: '1155',
        crisis: '02-513-1001',
        crisisName: 'Women and Men Progressive Movement',
      },
      Philippines: {
        police: '911',
        crisis: '1343',
        crisisName: 'DSWD Action Center',
      },
      Indonesia: {
        police: '110',
        crisis: '119',
        crisisName: 'Emergency Hotline',
      },
      Vietnam: {
        police: '113',
        crisis: '18001567',
        crisisName: 'National Domestic Violence Hotline',
      },
    }
    ```
  - `app/settings/SafetyCenterScreen.tsx` — default export screen (ScrollView):
    - **Section 1 — Safety Tips** (expandable `Pressable` cards, `LayoutAnimation` for smooth expand):
      - "Meet in Public Places" — body text per PRD FR-6.3.1
      - "Protect Your Personal Information"
      - "Trust Your Instincts"
      - "Watch for Red Flags"
      - "Stay Sober and Alert"
    - **Section 2 — Community Guidelines** (static text + "Read Full Guidelines" link → `Linking.openURL('https://fitlink.app/guidelines')`)
    - **Section 3 — Quick Actions**:
      - "Report a User" → `navigation.navigate('Matches')` (user selects match to report from there) with a note that report is available from any profile
      - "Contact Support" → `Linking.openURL('mailto:support@fitlink.app')`
    - **Section 4 — Emergency Resources** (localised by `profileStore.profile.location.country`):
      - Read `EMERGENCY_NUMBERS[country]`; fall back to Malaysia if country not in map
      - Display police number with phone icon → `Linking.openURL('tel:{number}')`
      - Display crisis line (if present) with same pattern
    - All tip body text through `t()` — add all keys to i18n files
  - **First-match safety prompt** (PRD FR-6.3.2):
    - `app/matches/MatchesScreen.tsx`: when a new match arrives (real-time listener fires with a match the user has never seen before), check `AsyncStorage.getItem('fitlink-safety-prompt-shown')`:
      - If `null`: show a `Modal` with condensed safety tips + "I Understand" button → `AsyncStorage.setItem('fitlink-safety-prompt-shown', 'true')` → dismiss
      - If `'true'`: skip — never show again
    - The prompt is a one-time gate, not tied to specific match IDs
  - `app/settings/SettingsScreen.tsx` — Support section:
    - Add "Safety Center" row above "Help Center"; navigates to `SafetyCenterScreen`
  - Add `SafetyCenterScreen` to settings stack
  - Add i18n keys: `safety.*` to all 4 files — all tips text, section titles, button labels
  - Run `npx tsc --noEmit` — zero errors
- **Output:** Safety Center displays tips, community guidelines, localised emergency numbers; first-match prompt shows once; tsc clean
- **Reasoning Level:** Medium

---

## 🧪 PHASE 4E: Testing Infrastructure Foundation
### Tasks 102–106

> **Note:** Task numbering in this epic was adjusted in June 2026. The dependency map
> reflects the corrected numbers. Task 102 = Jest harness, 103 = recordSwipe tests,
> 104 = activateBoost/createCheckin tests, 105 = deleteAccount/restore tests,
> 106 = Phase 4 security rules (admin_audit + warnings).

> **Architecture note:** This epic installs Jest in `functions/` only. The mobile app
> (root package) does not get a test runner in Phase 4. Test files live at
> `functions/src/__tests__/`. Each test file is named `{functionName}.test.ts`.
> No E2E (Detox) in Phase 4 — that is deferred to Phase 5.

---

### Task 102 — Jest Harness for Cloud Functions
<!-- NOTE: This is the first task of Phase 4E. Tasks 103–105 are the test suites. Task 106 is the final rules task. -->
- **File(s):** `functions/package.json`, `functions/jest.config.ts` (new), `functions/src/__tests__/helpers/firebaseAdminMock.ts` (new), `functions/src/__tests__/helpers/stripeMock.ts` (new)
- **Dependencies:** None — first testing task
- **Action:**
  - Install in `functions/`:
    ```bash
    npm --prefix functions install --save-dev jest ts-jest @types/jest firebase-functions-test
    ```
  - `functions/jest.config.ts`:
    ```typescript
    export default {
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.test.ts'],
      setupFilesAfterEnv: [],
      globals: {
        'ts-jest': { tsconfig: 'tsconfig.json' }
      }
    }
    ```
  - `functions/src/__tests__/helpers/firebaseAdminMock.ts`:
    - Mock `firebase-admin` using `jest.mock()`:
      - `admin.firestore()` returns a mock Firestore with chainable `doc()`, `get()`, `set()`, `update()`, `delete()`, `collection()`, `where()`, `get()`, `runTransaction()`
      - `admin.auth()` returns mock with `getUser()`, `deleteUser()`
      - `admin.storage()` returns mock with `bucket()` → `file()` → `delete()`
    - Export `mockFirestore`, `mockAuth`, `mockStorage` for use in test files
  - `functions/src/__tests__/helpers/stripeMock.ts`:
    - Mock `stripe` constructor: returns object with `subscriptions.list()`, `subscriptions.update()`, `billingPortal.sessions.create()`, `customers.create()`
    - All methods return `jest.fn()` defaults that can be overridden per test
  - Add `npm --prefix functions test` script to `functions/package.json`
  - Add `npm --prefix functions run test` to the Codex Self-Check — zero test failures required from this task onwards
  - Run `npm --prefix functions test` — zero test files yet; harness must initialise without error
  - Run `npm --prefix functions run build` — build still passes after devDep additions
- **Output:** Jest harness installed; mock helpers available; `npm --prefix functions test` runs without error; build unaffected
- **Reasoning Level:** Medium

---

### Task 103 — Unit Tests: recordSwipe
- **File(s):** `functions/src/__tests__/recordSwipe.test.ts` (new)
- **Dependencies:** Task 102 (Jest harness must exist; this is the first test suite)
- **Action:**
  - Write Jest unit tests for `functions/src/recordSwipe.ts`. Cover:
    - **Auth rejection**: unauthenticated call throws `HttpsError('unauthenticated')`
    - **Invalid direction**: direction not in `'like' | 'pass' | 'superlike'` throws `HttpsError('invalid-argument')`
    - **Pass direction**: writes to `swipes/{uid}/passes/{targetId}`; does not touch `dailyLikes`; returns `remainingLikes: FREE_DAILY_LIMIT`
    - **Like — free user under limit**: increments `dailyLikes.count`; writes swipe doc; returns correct `remainingLikes`
    - **Like — free user at limit**: `dailyLikes.count === 50`; throws `HttpsError('resource-exhausted', 'daily_limit')`
    - **Like — premium user**: no daily limit check; writes swipe doc; returns `remainingLikes: MAX_SAFE_INTEGER`
    - **Superlike — free user**: throws `HttpsError('permission-denied', 'premium_required')`
    - **Superlike — premium user**: writes swipe doc with `isSuperLike: true`
    - **Timezone reset**: if `dailyLikes.resetAt` is in the past, treats count as 0 (resets)
  - Use `firebaseAdminMock` from Task 102; stub `getNextMidnightMs` to return a fixed future timestamp
  - Run `npm --prefix functions test` — all tests pass; zero failures
- **Reasoning Level:** Medium

---

### Task 104 — Unit Tests: activateBoost & createCheckin
- **File(s):** `functions/src/__tests__/activateBoost.test.ts` (new), `functions/src/__tests__/createCheckin.test.ts` (new)
- **Dependencies:** Task 102 (Jest harness), Task 103 (recordSwipe pattern established)
- **Action:**
  - `activateBoost.test.ts`:
    - Auth rejection
    - Non-Pro user → `HttpsError('permission-denied', 'pro-required')`
    - Active boost already exists (future `expiresAt`) → `HttpsError('already-exists', 'boost-active')`
    - Pro user, no active boost → writes `boost: { activatedAt, expiresAt }` to user doc; returns `{ boost: { activatedAt, expiresAt } }`
    - Expired boost → treated as no boost; allows activation
  - `createCheckin.test.ts`:
    - Auth rejection
    - Existing active check-in → `HttpsError('already-exists', 'already-checked-in')`
    - Valid check-in → writes `/gymCheckins/{id}` + `users/{uid}.gymCheckin` in batch; returns `{ checkinId, expiresAt }`
    - Invalid payload (missing `placeId`) → `HttpsError('invalid-argument')`
  - Run `npm --prefix functions test` — all tests pass
- **Reasoning Level:** Medium

---

### Task 105 — Unit Tests: deleteAccount & restoreStripeSubscription
- **File(s):** `functions/src/__tests__/deleteAccount.test.ts` (new), `functions/src/__tests__/restoreStripeSubscription.test.ts` (new)
- **Dependencies:** Task 102 (Jest harness), Task 96 (`restoreStripeSubscription` CF must exist), Task 98 (`deleteAccount` CF must exist)
- **Action:**
  - `deleteAccount.test.ts`:
    - Auth rejection
    - No `stripeCustomerId` → skips Stripe step; proceeds with Firestore/Storage/Auth deletion
    - Active Stripe subscription → calls `stripe.subscriptions.update` with `cancel_at_period_end: true`; does not cancel immediately
    - Stripe failure → swallowed (deletion continues); Auth still deleted
    - Full happy path → all deletion steps called in correct order; Auth deleted last
    - Verify Auth deletion is step 9 (last) — mock call order tracking with `jest.fn()` + `mockReturnValue`
  - `restoreStripeSubscription.test.ts`:
    - Auth rejection
    - No `stripeCustomerId` → returns `{ restored: false, reason: 'no-customer' }`
    - No active Stripe subscription → returns `{ restored: false, reason: 'no-active-subscription' }`
    - Active subscription found → writes correct `premium` fields to Firestore; returns `{ restored: true, tier, expiresAt }`
  - Run `npm --prefix functions test` — all tests pass; zero failures across all test files
- **Reasoning Level:** Medium

---

### Task 106 — Phase 4 Firestore Security Rules: Admin Audit & Warnings
- **File(s):** `firestore.rules`, `firestore.indexes.json`
- **Dependencies:** Task 95 (`adminAction` CF adds `/admin_audit` and `/users/{uid}/warnings` — rules must cover these); Task 100 (Blocked Users rules in firestore.rules must be preserved)
- **Action:**
  - `firestore.rules` — add:
    ```
    match /admin_audit/{docId} {
      allow read, write: if false;  // Admin SDK only — no client access
    }
    match /users/{uid}/warnings/{warningId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;  // Admin SDK only
    }
    ```
  - Confirm `/admin_queue` and `/flags` deny rules from Task 86 are still present
  - `firestore.indexes.json` — add if not present:
    - `/admin_audit`: `(adminUid ASC, createdAt DESC)` — for audit trail queries per admin
    - `/users/{uid}/warnings` is a subcollection; no composite index needed (low cardinality)
  - Validate JSON:
    ```bash
    node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"
    ```
  - Run emulator probe
- **Output:** Admin audit log and user warnings secured; indexes valid
- **Reasoning Level:** Medium
- **🔒 Security review required** (touches firestore.rules)

---

## ✅ PHASE 4 DONE CHECKLIST

Before declaring Phase 4 ready and moving to Phase 5:

**SEA Tier 2**
- [ ] Philippines, Indonesia, Vietnam available in onboarding country + city selection
- [ ] Correct IANA timezones written for PH/ID/VN users at onboarding
- [ ] PH (PHP), ID (IDR), VN (VND) pricing displayed correctly on PremiumScreen
- [ ] Stripe checkout creates sessions with correct currency per country
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm --prefix functions run build` — zero errors

**Admin Dashboard**
- [ ] Admin app builds (`npm --prefix admin run build` — zero errors)
- [ ] Non-admin Google accounts are rejected at login
- [ ] Reports, Flags, Users panels all load data correctly
- [ ] Ban action sets `users/{uid}.banned = true` and updates source doc `status: 'actioned'`
- [ ] Warn and Dismiss actions update source doc `status: 'actioned'`
- [ ] All actions write to `/admin_audit`
- [ ] `adminAction` CF rejects unauthenticated calls
- [ ] `adminAction` CF rejects authenticated calls without `admin: true` custom claim

**Subscription Lifecycle**
- [ ] "Restore Purchases" button visible on PremiumScreen for free users
- [ ] Successful restore unlocks premium in the same session without app restart
- [ ] `restoreStripeSubscription` CF rejects unauthenticated calls
- [ ] `restoreStripeSubscription` handles no-customer and no-subscription cases gracefully

**Account Deletion**
- [ ] Delete Account screen accessible from Settings → Danger Zone
- [ ] Re-authentication required before delete button is enabled
- [ ] "DELETE" text confirmation required
- [ ] Stripe subscription cancelled at period end (not immediately)
- [ ] All Firestore subcollections deleted before parent doc
- [ ] Firebase Auth record deleted last
- [ ] User navigated to WelcomeScreen with stack replaced after deletion
- [ ] `deleteAccount` CF rejects unauthenticated calls

**Blocked Users**
- [ ] Blocked Users screen accessible from Settings → Privacy
- [ ] Blocked users list loads correctly, including graceful "Deleted User" fallback
- [ ] Unblock removes the `/blocked/{uid}/{blockedId}` document and updates local list

**Safety Center**
- [ ] Safety Center screen accessible from Settings → Support
- [ ] All 5 safety tip cards expand/collapse correctly
- [ ] Emergency numbers display correct values for user's registered country
- [ ] Phone links (`tel:`) work on device
- [ ] First-match safety prompt appears exactly once per device install

**Testing Infrastructure**
- [ ] `npm --prefix functions test` runs without error
- [ ] `recordSwipe` tests: all 9 cases pass
- [ ] `activateBoost` tests: all 5 cases pass
- [ ] `createCheckin` tests: all 4 cases pass
- [ ] `deleteAccount` tests: all 5 cases pass (including order-of-deletion verification)
- [ ] `restoreStripeSubscription` tests: all 4 cases pass
- [ ] Zero test failures across all test files

**Code Quality**
- [ ] Zero `any` usage in all new files
- [ ] Zero `console.log` in client files
- [ ] All new strings through `t()` with entries in all 4 language files (en, my, zh, ta)
- [ ] All new Cloud Functions: auth check first, `asia-southeast1` region
- [ ] Firestore rules updated for `/admin_audit` and `/users/{uid}/warnings`
- [ ] `firestore.indexes.json` valid JSON

---

## Deferred to Phase 5

- Bahasa Indonesia (`id.json`) language file
- Detox E2E test skeleton (critical user journey: signup → swipe → match → message)
- Client-side Zustand store unit tests
- Improved face-matching ML model for `verifyProfilePhoto`
- Gym/workout-only partner discovery mode
- Voice message transcription
- In-app video calling
- Live GPS workout tracking
- SEO / web landing pages
- RTL layout support (Arabic/Urdu)
- Philippines, Indonesia, Vietnam local language support beyond English fallback
- Admin dashboard: full-text user search, chat history review, bulk moderation actions

---

*TASKS_PHASE4.md — [APP_NAME] | June 2026*
*Phase 3 ended at Task 88. Phase 4: Tasks 89–106 (18 tasks across 5 epics).*
*Dependency map corrected June 2026 — see Inter-Task Dependency Map for authoritative task numbers.*
*Generate TASKS_PHASE5.md after Phase 4 ships.*
