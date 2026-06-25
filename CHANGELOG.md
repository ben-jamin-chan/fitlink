# CHANGELOG.md — [APP_NAME]

> Update this file at the end of every completed phase or significant implementation session. The Architect reads the latest entry to restore context at the start of each new session.

---

## [Phase 4A — Task 91] — 2026-06-25

### Completed

- Task 91: Stripe Tier 2 — PHP/IDR/VND Pricing & Local Payment Methods
- functions/src/createStripeCheckout.ts: reads `location.country` server-side, maps it
  through an inlined `COUNTRY_TO_CURRENCY` map, and passes the resolved currency into
  Stripe subscription creation with MYR fallback
- functions/src/createStripeCheckout.ts: accepts PHP/IDR/VND server-side Stripe price ID
  env vars and classifies country-specific Pro price IDs correctly in checkout metadata
- functions/src/stripeWebhook.ts: recognises PHP/IDR/VND Pro price IDs so Tier 2 Pro
  purchases are not downgraded to Plus during webhook processing
- services/stripe.ts: stores VND pricing amounts in Stripe zero-decimal minor units while
  leaving PHP/IDR as two-decimal minor-unit values per Stripe currency rules
- app/settings/PremiumScreen.tsx: formats PHP (`₱`, no decimal), IDR (`Rp`, Indonesian
  thousands separator), and VND (`₫`, Vietnamese thousands separator) from existing
  minor-unit pricing data

### Files Created

- None

### Files Modified

- functions/src/createStripeCheckout.ts: country-to-currency routing added; local
  `COUNTRY_TO_CURRENCY` map inlined; currency passed to Stripe subscription creation;
  PHP/IDR/VND server price IDs allowed
- functions/src/stripeWebhook.ts: Tier 2 Pro price IDs added to Pro tier detection
- services/stripe.ts: VND amount metadata corrected to zero-decimal units and VND display
  strings switched to Vietnamese thousands separators
- app/settings/PremiumScreen.tsx: PHP/IDR/VND price formatting added; Task 71 portal
  wiring preserved
- CHANGELOG.md: recorded Task 91 completion

### Architecture Decisions

- `COUNTRY_TO_CURRENCY` is inlined in the Cloud Function instead of imported from
  `constants/regions.ts` because Cloud Functions must not import client files.
- Country is read server-side from Firestore, not from `request.data`, so callers cannot
  spoof their country to choose a different currency.
- Local payment methods for PH/ID/VN remain Stripe Dashboard-level configuration; no
  per-session `payment_method_types` override was added.
- Stripe subscription creation uses configured Price IDs, not client amount values. Client
  amount metadata still tracks Stripe minor units: PHP/IDR are two-decimal currencies and
  VND is zero-decimal.
- PHP/IDR/VND display formatting is local to `PremiumScreen.tsx` and only overrides the
  three new currencies, preserving existing MYR/SGD/THB `amountDisplay` strings.
- `stripeWebhook.ts` was updated alongside checkout so country-specific Pro price IDs keep
  the correct `premium.tier` after Stripe webhook processing.

### Conflict Risks Introduced

- None expected — Task 92 (security rules audit) will verify no new client-writable fields
  or collections were introduced.

### Known Issues / Deferred

- None

### Verification

- Focused red/green source checks for checkout currency routing, PremiumScreen PHP/IDR/VND
  formatting, and webhook Tier 2 Pro recognition pass
- `npx tsc --noEmit` passes
- `npm --prefix functions run build` passes

### Next Up

- Task 92: Phase 4 Firestore Security Rules Update

---

## [Phase 4A — Task 90] — 2026-06-24

### Completed

- Task 90: Onboarding & Discovery — Philippines, Indonesia, Vietnam
- Verified constants/regions.ts has PH/ID/VN countries, timezones, city arrays,
  currencies, and calling codes from Task 89
- Verified app/onboarding/Step1Screen.tsx dynamically renders SUPPORTED_COUNTRIES,
  uses SEA_CITIES[selectedCountry], reverse-scans COUNTRY_TIMEZONES for device timezone
  detection, clears stale city values, and writes timezone on explicit country changes
- Verified store/onboardingStore.ts keeps country default Malaysia, timezone default
  Asia/Kuala_Lumpur, and persists both fields in the draft
- Verified services/firebase/firestore.ts createUserProfile() writes timezone as a
  top-level user field and country nested in location.country via input.location
- services/stripe.ts now derives currency from COUNTRY_CURRENCIES and returns PHP,
  IDR, and VND price IDs from country-specific EXPO_PUBLIC_STRIPE_PRICE_* env vars
- Added onboarding.step1.country.philippines/indonesia/vietnam keys to all 4 i18n files
- .env.example: 18 new Stripe price ID placeholder entries added for PHP/IDR/VND

### Files Created

- None

### Files Modified

- services/stripe.ts: removed duplicated country-currency map; added COUNTRY_CURRENCIES
  lookup and PHP/IDR/VND-specific price ID env vars
- .env.example: PHP/IDR/VND Stripe price ID vars added
- i18n/en.json: onboarding country keys for PH/ID/VN added
- i18n/my.json: same keys, English placeholders
- i18n/zh.json: same keys, English placeholders
- i18n/ta.json: same keys, English placeholders
- CHANGELOG.md: recorded Task 90 completion

### Architecture Decisions

- Step1Screen.tsx required no code changes. Its timezone auto-detection already uses a
  dynamic reverse scan over COUNTRY_TIMEZONES, so Asia/Manila, Asia/Jakarta, and
  Asia/Ho_Chi_Minh are covered by Task 89 constants.
- The existing regions key split was preserved additively: runtime country labels use
  regions.country.{CountryName}, and Task 89 aliases under regions.countries.* remain
  available. No existing i18n keys were renamed.
- getPricesForCountry/getStripePrices keep MYR as the fallback currency, so pricing
  lookup never returns undefined for an unsupported country string.

### Conflict Risks Introduced

- Task 91 modifies createStripeCheckout.ts and PremiumScreen.tsx; verify the Cloud
  Function country-currency mapping matches COUNTRY_CURRENCIES from constants/regions.ts.

### Known Issues / Deferred

- None

### Next Up

- Task 91: Stripe Tier 2 — PHP/IDR/VND Pricing & Local Payment Methods

---

## [Phase 4A — Task 89] — 2026-06-24

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
- i18n/en.json: added regions country/city keys for PH/ID/VN
- i18n/my.json: same keys, English placeholders
- i18n/zh.json: same keys, English placeholders
- i18n/ta.json: same keys, English placeholders
- CHANGELOG.md: recorded Task 89 completion

### Architecture Decisions

- COUNTRY_CURRENCIES and COUNTRY_CALLING_CODES are new exports not present in Task 81.
  They are added at the bottom of constants/regions.ts to avoid interleaving with
  existing exports.
- All Task 81 MY/SG/TH entries preserved exactly — no renames or reordering.
- The existing app consumes region translations through `regions.country.*` and
  `regions.city.*`, so PH/ID/VN keys were added to that runtime namespace.
- Prompt-requested `regions.countries.*` and `regions.cities.*` PH/ID/VN aliases were
  also added additively to all 4 locale files.
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

---

## [Phase 4 Pre-flight — Admin Custom Claim Setup] — 2026-06-22

### Completed

- Copied the Firebase service account key to a local private path outside the repository
- Restricted the local service account key permissions to owner read/write
- Set `admin: true` custom claim for the approved Firebase Auth admin UID
- Verified the custom claim through Firebase Admin SDK `getUser()`

### Files Created

- None

### Files Modified

- `CHANGELOG.md`: recorded Step C completion status

### Architecture Decisions

- No service account key or one-off claim script was committed to the repository.
- The admin dashboard will rely on the `admin: true` custom claim during Task 94 auth gating.

### Conflict Risks Introduced

- None. This was Firebase Auth metadata setup only.

### Known Issues / Deferred

- The admin user must sign out and sign back in before the dashboard sees the new claim in its ID token.

### Verification

- Firebase Admin SDK `setCustomUserClaims()` completed successfully
- Firebase Admin SDK `getUser()` returned `customClaims.admin === true`

### Next Up

- Task 94: Admin dashboard scaffold and auth

---

## [Phase 4 Pre-flight — Admin Hosting Setup] — 2026-06-22

### Completed

- Created the secondary Firebase Hosting site `fitlink-admin` for the admin dashboard
- Configured Firebase Hosting deploy targets:
  - `app` → `gym-dating-dev`
  - `admin` → `fitlink-admin`
- Added multi-site Hosting config to `firebase.json`, with the admin dashboard served from `admin/build`
- Added the admin SPA rewrite so refreshed admin sub-routes resolve to `/index.html`
- Added `admin/build/` to `.gitignore`

### Files Created

- None

### Files Modified

- `firebase.json`: added `hosting` array with `app` and `admin` targets
- `.firebaserc`: added Hosting target mappings for `gym-dating-dev`
- `.gitignore`: ignored `admin/build/`

### Architecture Decisions

- The `app` hosting target maps to the default Firebase Hosting site `gym-dating-dev`.
- The `admin` hosting target maps to the new user site `fitlink-admin`, available at `https://fitlink-admin.web.app`.
- The admin Hosting target includes an SPA rewrite because Task 94 uses React Router.

### Conflict Risks Introduced

- Task 94 should preserve the existing `firebase.json` Hosting targets and only add the admin app files under `/admin/`.

### Known Issues / Deferred

- Step C admin custom claim is not set yet. It requires a local Firebase service account JSON path and the Firebase Auth UID for each admin account.

### Verification

- `firebase hosting:sites:list --project gym-dating-dev` shows both `gym-dating-dev` and `fitlink-admin`
- `firebase target hosting --project gym-dating-dev` shows `app (gym-dating-dev)` and `admin (fitlink-admin)`
- `node -e` JSON/target validation passes
- `npx tsc --noEmit` passes
- `git diff --check -- firebase.json .firebaserc .gitignore` passes

### Next Up

- Set `admin: true` custom claims for approved admin Firebase Auth UIDs

---

## [Phase 3D — Task 88] — 2026-06-21

### Completed

- Task 88: Phase 3 Firestore Indexes
- Added gymCheckins (userId ASC, expiresAt DESC) composite index
- Added gymCheckins (city ASC, expiresAt DESC) composite index
- Confirmed all prior Phase 3 indexes (events x2, admin_queue, flags) present and unduplicated

### Files Created

- None

### Files Modified

- firestore.indexes.json: two gymCheckins composite indexes added

### Architecture Decisions

- Appended the two gymCheckins indexes after the existing Phase 3 admin/flags indexes without reordering or normalising prior entries, preserving all existing index definitions exactly.

### Conflict Risks Introduced

- None — this is the final Phase 3 index task; no further Phase 3 tasks touch firestore.indexes.json

### Known Issues / Deferred

- None

### Verification

- node -e JSON.parse validation passes
- gymCheckins, events, admin_queue, and flags composite index assertion passes with zero duplicates
- npx tsc --noEmit passes
- git diff --check passes

### Next Up

- Phase 3 complete — run the PHASE 3 DONE CHECKLIST in TASKS_PHASE3.md before declaring Phase 3 shipped

---

## [Phase 3D — Task 87] — 2026-06-21

### Completed

- Task 87: Phase 3 Firestore Security Rules Update
- Added `boostExpiresAt` to both `/users/{uid}` create-time and update-time server-only field guards in `firestore.rules`
- Left the existing `boost` guard in place because grep confirmed current runtime code still uses `users/{uid}.boost`

### Files Created

- None

### Files Modified

- firestore.rules: added `boostExpiresAt` to `doesNotSetServerOnlyFieldsOnCreate()` and `doesNotModifyServerOnlyFields()`
- CHANGELOG.md: Task 87 completion entry added

### Architecture Decisions

- Grep evidence: `rg -n "'boost'|\\bboost\\b|boostExpiresAt" functions/src types --glob '*.ts'` found active `boost` usage in `types/user.ts`, `functions/src/activateBoost.ts`, and `functions/src/getDiscoveryStack.ts`; no `boostExpiresAt` usage exists in `functions/src` or `types` today.
- `boost` was retained because `activateBoost` writes a `boost` map and `getDiscoveryStack` reads it for scoring. Removing the guard would reopen the active client-write path.
- `boostExpiresAt` was also added to `doesNotSetServerOnlyFieldsOnCreate()` because the Phase 3 docs mark it server-only and the pre-patch emulator probe confirmed owner creates could include it directly.

### Conflict Risks Introduced

- None expected — Task 88 (indexes) has no dependency on this field-guard change.

### Known Issues / Deferred

- Pre-existing docs/code drift remains: Phase 3 docs and Task 87 reference `boostExpiresAt`, while current implemented runtime code uses the `boost` map field. This task only hardens rules and does not rename boost data.
- Pre-existing dependency audit risk remains: root `npm audit --audit-level=high` reports 33 advisories, including one critical transitive `shell-quote` advisory; dependency remediation is out of scope for this rules-only task. `npm --prefix functions audit --audit-level=high` was not completed because external audit submission was rejected by the tool policy.

### Verification

- Red/green Firestore emulator probes confirmed owner create/update requests with `boostExpiresAt` were allowed before the rules edit and denied with 403 after the edit.
- `firebase emulators:exec --only firestore "node -e \"process.exit(0)\""` passes
- `npx tsc --noEmit` passes
- `git diff --check` passes
- Scoped rules scan confirms `boostExpiresAt` is present in both server-only arrays and the `/gymCheckins`, `/events`, `/notificationPreferences`, `/admin_queue`, `/flags`, and default catch-all blocks remain present.

### Next Up

- Task 88: Phase 3 Firestore Indexes

---

## [Phase 3D — Task 86] — 2026-06-20

### Completed

- Task 86: Admin Moderation Queue: Harden & Secure
- Added `checkReportThreshold` Firestore trigger for report-threshold auto-ban handling and `/admin_queue` entries with `status: 'pending'`
- Added `moderatePhoto` Storage trigger for Cloud Vision SafeSearch moderation and `/flags` entries with `status: 'pending'`
- Added explicit deny-all Firestore rules for `/admin_queue/{docId}` and `/flags/{docId}`
- Added composite indexes for pending admin queue and flag review queries

### Files Created

- functions/src/checkReportThreshold.ts: report threshold trigger, inline `AdminQueueEntry`, auto-ban write, refresh-token revocation, and pending admin queue write
- functions/src/moderatePhoto.ts: profile photo SafeSearch trigger, inline `FlagEntry`, pending flag write, and inappropriate upload deletion

### Files Modified

- functions/src/index.ts: exported `moderatePhoto` and `checkReportThreshold`
- firestore.rules: added explicit deny-all `/admin_queue/{docId}` and `/flags/{docId}` blocks before the default catch-all
- firestore.indexes.json: added `admin_queue(status ASC, createdAt DESC)` and `flags(status ASC, createdAt DESC)` composite indexes
- CHANGELOG.md: Task 86 completion entry added

### Architecture Decisions

- The Task 86 prompt assumed `functions/src/checkReportThreshold.ts` and `functions/src/moderatePhoto.ts` already existed, but the current repository had neither source file nor export. The functions were added from the project architecture and PRD moderation behavior so the queue hardening has actual writer functions to harden.
- `checkReportThreshold` counts reports using either current `createdAt` or legacy `reportedAt` timestamps after filtering by `reportedUserId`, avoiding an unauthorized new reports index while supporting the schema drift documented across existing docs.
- `moderatePhoto` scopes moderation to `users/{uid}/photos/{file}` uploads, matching the profile-photo storage path used by the app. No moderator role, claims, client reads, or admin UI were added.

### Conflict Risks Introduced

- Task 87 consolidates Firestore security rules and depends on preserving this task's `/admin_queue` and `/flags` deny blocks.
- Task 88 depends on this task's `admin_queue` and `flags` composite indexes being present.
- `functions/src/index.ts` now exports two previously absent Phase 1 moderation functions; future function export audits should preserve them.

### Known Issues / Deferred

- No deployed Firebase trigger or live Cloud Vision execution was exercised locally; verification was limited to TypeScript builds, JSON/rules validation, and static acceptance checks.

### Next Up

- Task 87: Phase 3 Firestore Security Rules Update

---

## [Phase 3D - Task 85] - 2026-06-20

### Completed

- Task 85: Strava Disconnect Cleanup Cloud Function
- Added `onStravaDisconnected` Firestore trigger for guarded Strava disconnect cleanup
- Added shared Strava token crypto utility used by token exchange, activity sync, and disconnect cleanup
- Disconnect cleanup now best-effort revokes the Strava access token and always deletes stored credential fields afterward
- `StravaConnection` credential fields are now optional in the client-facing type schema, matching the Firestore schema and `FieldValue.delete()` requirement

### Files Created

- functions/src/utils/crypto.ts: shared AES-256-CBC Strava token encryption, decryption, key validation, encrypted-token detection, and legacy-token fallback helpers
- functions/src/onStravaDisconnected.ts: guarded `onDocumentUpdated` trigger for Strava access-token revocation and credential field deletion

### Files Modified

- functions/src/exchangeStravaToken.ts: removed local crypto import/helper and switched to shared token encryption/key validation helpers
- functions/src/syncStravaActivity.ts: removed local crypto helpers and switched to shared encryption, decryption, encrypted-token detection, and legacy-token fallback helpers
- functions/src/index.ts: exported `onStravaDisconnected`
- types/subscription.ts: marked `StravaConnection.accessToken`, `refreshToken`, and `expiresAt` optional so server cleanup can safely delete them
- CHANGELOG.md: Task 85 completion entry added

### Architecture Decisions

- The actual crypto implementation differed from the prompt placeholder: `exchangeStravaToken.ts` only had `encryptToken`, while `syncStravaActivity.ts` also had encrypted-token detection, `decryptToken`, and `decryptTokenOrLegacy`. The shared utility preserves the current AES-256-CBC algorithm, hex key derivation, IV/ciphertext format, and legacy-token migration behavior rather than forcing the stale prompt shape.
- `onStravaDisconnected` uses `decryptTokenOrLegacy` before Strava deauthorization so users with legacy plaintext tokens can still be revoked before cleanup.
- The Firestore trigger includes the `STRAVA_TOKEN_ENCRYPTION_KEY` secret binding because 2nd gen deployed functions only receive referenced secrets when they are declared on the function.
- Credential cleanup uses the triggering document reference and Admin SDK `FieldValue.delete()`; no Firestore rules change is required because Admin SDK writes bypass client rules.

### Conflict Risks Introduced

- `types/subscription.ts` now reflects Strava credentials as optional. This aligns with `ARCHITECT.md` and `CONVENTIONS.md`, but any future code that tries to read client-side Strava credential fields must handle absence explicitly.

### Known Issues / Deferred

- No physical Strava OAuth disconnect flow was exercised in this session; revocation remains best-effort and production verification requires deployed Cloud Functions plus a real Strava connection.

### Verification

- `npm --prefix functions run build` passes
- `npm --prefix functions run lint` passes
- `npx tsc --noEmit` passes
- `git diff --check` passes
- Scoped scans confirm no `any`, no type assertions, no `console.*`, no `new Date()`, no `../../` imports, and no `request.auth` in `onStravaDisconnected`
- Scoped scans confirm `FieldValue.delete()` is only used for `fitnessTracking.strava.accessToken`, `refreshToken`, and `expiresAt` in the new disconnect trigger
- Scoped scans confirm `encryptToken` and `decryptToken` definitions now exist only in `functions/src/utils/crypto.ts`
- Manual Cloud Functions / Strava security review completed; the repository's referenced `SECURITY_REVIEW_CHECKLIST.md` and `CODE_REVIEW_CHECKLIST.md` files are not present in the working tree

### Next Up

- Task 86: Admin Moderation Queue: Harden & Secure

---

## [Phase 3D - Task 84] - 2026-06-20

### Completed

- Task 84: Notification Badge Count & Granular Preferences
- useNotifications now syncs the app icon badge from matchStore unread counters on active AppState transitions and after the initial matches load completes
- authStore logout now clears the OS badge count while preserving the Task 83 AsyncStorage uid cleanup
- Settings notification rows now read and write `/users/{uid}/notificationPreferences/prefs`, with absent docs and fields defaulting to enabled
- onNewMessage now skips message pushes only when `newMessages === false`, while still incrementing unread counts
- recordSwipe now sends a generic "liked me" Expo push after successful like/superlike transactions only for premium recipients with push tokens and `likedMe !== false`
- Expo push sending and notification preference defaulting were extracted into shared Cloud Function utilities
- firestore.rules now allows owner-only read/write for `/users/{uid}/notificationPreferences/{docId}`
- settings notification and liked-me push i18n keys added to all 4 language files

### Files Created / Modified

- functions/src/utils/expoPush.ts: created shared Expo Push API sender and token validator
- functions/src/utils/notificationPreferences.ts: created absent-doc-default preference helper
- hooks/useNotifications.ts: badge sync added; liked-me foreground toast fallback added; console warnings replaced with Crashlytics logging
- store/authStore.ts: logout badge reset added
- app/settings/SettingsScreen.tsx: Firestore-backed notification preferences added; AsyncStorage retained only for local push permission UI state
- functions/src/onNewMessage.ts: shared Expo push utility adopted; newMessages preference guard added
- functions/src/recordSwipe.ts: post-transaction liked-me push added for like/superlike
- firestore.rules: notificationPreferences owner-only subcollection rule added
- i18n/en.json, my.json, zh.json, ta.json: settings.notifications.* and notifications.likedMe.* keys added
- CHANGELOG.md: Task 84 completion entry added

### Architecture Decisions

- Notification preference reads use `!== false`, so absent preference docs remain opt-in by default
- Settings writes only the toggled Firestore preference key with `{ merge: true }`; the legacy AsyncStorage value is now used only for device-local push permission UI state
- The existing root `useNotifications(navigationRef)` mount in App.tsx was reused; no second lifecycle hook mount was added
- TASKS_PHASE3.md's original Task 84 spec assumed recordSwipe.ts had a 'rewind' direction (from Task 72). Task 72 was actually implemented as a separate rewindSwipe.ts callable that never calls recordSwipe.ts. The "liked me" push guard was written as the positive condition (direction === 'like' || direction === 'superlike') instead of the originally specified negative guard (direction !== 'rewind'), since the negative guard would have been dead code. ARCHITECT.md's Cloud Functions table still describes recordSwipe as supporting a 'rewind' direction and does not list rewindSwipe — this is a pre-existing documentation drift, not something this task introduced, and should be corrected in a future ARCHITECT.md revision pass.

### Conflict Risks Introduced

- Modified recordSwipe.ts — Task 87 (Firestore security rules) and Task 88 (indexes) do not depend on this change, but any future task touching recordSwipe.ts should be aware the "liked me" push logic now runs after every successful like/superlike transaction.
- Added firestore.rules block for notificationPreferences — Task 87 consolidates all Phase 3 rules; confirm this block is preserved (not duplicated or overwritten) when generating that task's prompt.

### Verification

- npx tsc --noEmit passes
- npm --prefix functions run build passes
- i18n JSON parse check passes for en/my/zh/ta
- git diff --check passes
- Firebase emulator rules parse check passes for firestore
- Scoped scans confirm no any, inline style={{ }}, console.*, TaskManager, expo-video, FieldValue.delete(), or relative `../../` imports in touched task files
- Diff scan confirms recordSwipe.ts has no rewind guard and introduces no new Date() timestamp writes

### Next Up

- Task 85: Strava Disconnect Cleanup Cloud Function

---

## [Phase 3D - Task 83] - 2026-06-14

### Completed

- Task 83: Background lastActive Updates (iOS)
- expo-background-fetch and expo-task-manager installed
- updateLastActive(uid): extracted as named export from services/firebase/firestore.ts; used by both foreground heartbeat and background task
- useLastActive.ts: TaskManager.defineTask registered at module scope with 'fitlink-lastactive-fetch' task name; BackgroundFetch.registerTaskAsync called in a useEffect(() => {}, []) with silent catch; foreground heartbeat refactored to call updateLastActive() from the service layer
- authStore: AsyncStorage.setItem('fitlink-uid', uid) on login; AsyncStorage.removeItem('fitlink-uid') in logout() provides uid to isolated background task JS context without Zustand
- app.json: UIBackgroundModes ['fetch', 'remote-notification'] added to ios.infoPlist
- BUILD.md: background fetch development-build requirement documented with task name string and minimumInterval behaviour note

### Files Created / Modified

- package.json, package-lock.json: expo-background-fetch and expo-task-manager dependencies added
- services/firebase/firestore.ts: updateLastActive(uid) named export added
- store/authStore.ts: AsyncStorage uid persistence on login/logout added
- hooks/useLastActive.ts: rewritten with module-scope task definition, background fetch registration useEffect, and foreground heartbeat using service layer
- app.json: UIBackgroundModes added to ios.infoPlist
- BUILD.md: background fetch section added

### Architecture Decisions

- TaskManager.defineTask placed at module scope to satisfy Expo's requirement that tasks are registered before any component mounts
- Background task body uses only AsyncStorage and updateLastActive, with no Zustand or store access, because it runs in an isolated JS context
- AsyncStorage.setItem('fitlink-uid') duplicates Zustand persist intentionally; Zustand rehydration is not available in the isolated background task context
- catch handlers on registerTaskAsync and unregisterTaskAsync are intentionally silent; Expo Go and simulators legitimately reject background fetch
- This repo's auth store exposes user?.uid rather than a top-level uid, so useLastActive selects the foreground uid from state.user?.uid

### Known Issues / Deferred

- Background fetch requires a development build; cannot be verified in Expo Go
- iOS calls the handler as infrequently as every 15-60 minutes regardless of minimumInterval: 300; this is expected OS behaviour
- Android background fetch support is not expanded in this task; implementation remains iOS-primary per the task spec

### Verification

- npx tsc --noEmit passes
- git diff --check passes
- Scoped scans confirm no any, no console.*, no inline style={{ }}, no direct updateDoc calls remaining in useLastActive.ts, and no Zustand imports inside the TaskManager.defineTask callback

### Next Up

- Task 84: Notification Badge Count & Granular Preferences

---

## [Phase 3D - Task 82] - 2026-06-14

### Completed

- Task 82: Per-User Timezone Daily Resets
- recordSwipe: hardcoded UTC+8 getNextMidnightMs() replaced with async per-user version that reads users/{uid}.timezone from Firestore and computes next local midnight via Intl.DateTimeFormat formatToParts; falls back to Asia/Kuala_Lumpur for pre-Task-81 users
- verifyProfilePhoto: identical replacement applied; verification attempt resetAt now respects Singapore (Asia/Singapore) and Thailand (Asia/Bangkok) timezones

### Files Created / Modified

- functions/src/recordSwipe.ts: getNextMidnightMs replaced with async uid-param version; dailyLikes resetAt call site now awaits the helper
- functions/src/verifyProfilePhoto.ts: same helper replacement applied; verificationAttempts resetAt call site now awaits the helper

### Architecture Decisions

- getNextMidnightMs is duplicated in both files rather than extracted to a shared utility; shared extraction remains deferred to a later cleanup task
- Timezone offset is computed from Intl.DateTimeFormat formatToParts, including local date fields, so calculations remain correct across UTC date boundaries and non-integer UTC offsets
- Safety guard retained: if computed next-midnight is already in the past, an additional 86400s is added to guarantee resetAt is always future

### Known Issues / Deferred

- Pre-Task-81 users without a timezone field continue to receive Asia/Kuala_Lumpur resets via the fallback; a data migration to back-fill timezone is deferred to Phase 4

### Verification

- npm --prefix functions run build passes
- npx tsc --noEmit passes
- git diff --check passes
- Scoped scans confirm no any, inline style={{ }}, console.*, or client-side imports in touched function files

### Next Up

- Task 83: Background lastActive Updates (iOS)

---

## [Phase 3D - Task 81] - 2026-06-14

### Completed

- Task 81: SEA Expansion - Singapore & Thailand Regions
- constants/regions.ts added SUPPORTED_COUNTRIES, COUNTRY_TIMEZONES, and SEA_CITIES for Malaysia, Singapore, and Thailand
- onboardingStore now persists country and timezone in the onboarding draft with Malaysia / Asia/Kuala_Lumpur defaults
- Step1Screen now renders a translated country selector and a translated city selector populated from SEA_CITIES
- Step1Screen silently detects supported device timezones on mount, honours explicit stored countries on remount, and clears stale city values that do not belong to the selected country
- Step6Screen passes draft timezone through final onboarding submission
- createUserProfile writes timezone as a top-level user field while preserving country inside location.country
- services/stripe.ts SGD and THB pricing entries were verified against PRD Section 5.12; requested SGD/THB env placeholders were added to .env.example
- regions.* and onboarding.step1.country.* i18n keys added to all 4 language files

### Files Created / Modified

- constants/regions.ts: created
- store/onboardingStore.ts: OnboardingDraft extended with country and timezone defaults
- app/onboarding/Step1Screen.tsx: country/city SingleSelect flow added with timezone auto-detection
- app/onboarding/Step6Screen.tsx: timezone passed to createUserProfile
- services/firebase/firestore.ts: createUserProfile input and payload extended with timezone
- .env.example: SGD/THB Stripe price placeholders added
- i18n/en.json, my.json, zh.json, ta.json: country and region city keys added

### Architecture Decisions

- draft.country maps only to location.country in Firestore; no top-level country field was added
- timezone is a top-level user field written at profile creation and available for Task 82 daily reset logic
- City and country chip labels are translated through regions.* keys while canonical values stay stable in the draft
- Existing Plus/Pro SGD and THB pricing amounts were left unchanged because they already match PRD Section 5.12

### Known Issues / Deferred

- Real region translations for MY/ZH/TA remain deferred; English placeholders were added for now
- Per-user timezone daily resets in recordSwipe and verifyProfilePhoto remain Task 82
- Existing users created before Task 81 may not have timezone until future migration or fallback logic

### Verification

- npx tsc --noEmit passes

### Next Up

- Task 82: Per-User Timezone Daily Resets

---

## [Phase 3C - Task 80] - 2026-06-13

### Completed

- Task 80: Workout Events — Create & Discover
- createEvent callable validates event input, writes /events/{id} with server-owned creatorId, attendees, cancelled, and createdAt fields, and returns eventId
- rsvpEvent callable mutates attendees via Admin SDK arrayUnion / arrayRemove inside a transaction with capacity enforcement
- eventsStore added as a non-persisted Zustand store for upcoming events, my events, single-event fallback loading, createEvent, and RSVP callable actions
- EventCard added with activity icon mapping, translated controlled activity labels, attendee count, and RSVP status pill
- EventsScreen added with Discover / My Events tabs, pull-to-refresh, empty states, and Create Event FAB
- CreateEventScreen added with React Hook Form + Zod validation, 16 translated activity chips, start/end DateTimePicker controls, optional maxAttendees, and Cloud Function submission
- EventDetailScreen added with first-five attendee profile avatars, RSVP, creator-only cancellation, cancelled state, and native Share
- MainTabNavigator exports EventsStackParamList, registers EventsStackNavigator, and inserts Events between Matches and Profile
- firestore.rules adds /events/{id} rules: authenticated reads, denied creates/deletes, creator-only limited updates
- firestore.indexes.json adds /events indexes for city/cancelled/startAt and attendees/startAt queries
- events.* and navigation.tabs.* i18n keys added to all 4 language files

### Files Created / Modified

- functions/src/createEvent.ts: created
- functions/src/rsvpEvent.ts: created
- functions/src/index.ts: createEvent and rsvpEvent exports appended
- store/eventsStore.ts: created
- components/events/EventCard.tsx: created
- app/events/EventsScreen.tsx: created
- app/events/CreateEventScreen.tsx: created
- app/events/EventDetailScreen.tsx: created
- app/navigation/MainTabNavigator.tsx: Events stack and tab added
- firestore.rules: /events/{id} block inserted before default deny
- firestore.indexes.json: two /events composite indexes appended
- i18n/en.json, my.json, zh.json, ta.json: events and navigation tab keys added

### Architecture Decisions

- DateTimePicker was already installed in package.json, so no dependency install was needed
- RSVP capacity enforcement is transactional; the function still writes attendees using arrayUnion / arrayRemove
- CreateEventScreen keeps Google Places autocomplete deferred and uses profile city/country plus profile coordinates for the free-text event location payload
- The existing app has a Settings bottom tab, so Events is inserted as Discover, Matches, Events, Profile, Settings
- The Firestore update rule uses changed-field diff validation so creator cancellation can pass without exposing attendees writes

### Known Issues / Deferred

- /gymCheckins compound indexes remain deferred to Task 88
- Google Places autocomplete UI for event locations remains deferred to Phase 4
- Expired /events documents are not physically cleaned up; scheduled cleanup remains deferred

### Verification

- npm --prefix functions run build passes
- npx tsc --noEmit passes
- firestore.indexes.json and i18n JSON parse validation passes
- git diff --check passes
- Scoped scans confirm no any, inline style={{ }}, console.*, or relative imports in new and touched task files
- Scoped scan confirms no client addDoc to /events and no client arrayUnion / arrayRemove for event attendees

### Next Up

- Task 81: SEA Expansion — Singapore & Thailand Regions

---

## [Phase 3C - Task 79] - 2026-06-10

### Completed

- Task 79: Gym Check-In Feature
- createCheckin callable writes /gymCheckins/{id} and users/{uid}.gymCheckin in one batch with GeoPoint conversion and one-active-check-in enforcement
- checkinStore manages a session-only active check-in listener, checkIn(gym, city), and checkOut(uid)
- GymCheckinScreen requests foreground location, searches nearby gyms through services/places.ts, filters locally by name, confirms check-ins, and handles checkout state
- GymSearchList and ActiveCheckinBanner added for reusable check-in UI
- ProfileScreen subscribes to active check-ins, renders the active banner, and adds a Profile-stack check-in CTA row
- SwipeCard shows the translated "At gym" badge when user.gymCheckin has not expired
- GymCheckin added to ProfileStackParamList and registered inside the Profile stack only
- firestore.rules adds owner read/delete rules for /gymCheckins with client create/update denied
- checkin.* i18n keys added to all 4 language files
- expo-location installed and location permission strings added to app.json

### Files Created / Modified

- functions/src/createCheckin.ts: created
- functions/src/index.ts: createCheckin export added
- store/checkinStore.ts: created
- components/checkin/GymSearchList.tsx: created
- components/checkin/ActiveCheckinBanner.tsx: created
- app/checkin/GymCheckinScreen.tsx: created
- app/profile/ProfileScreen.tsx: active check-in subscription, banner, loading overlay, and CTA row added
- components/discovery/SwipeCard.tsx: active gym badge added without changing the video badge
- app/navigation/MainTabNavigator.tsx: GymCheckin screen registered in the Profile stack
- firestore.rules: /gymCheckins/{id} block appended before the default deny rule
- i18n/en.json, my.json, zh.json, ta.json: checkin.* keys added
- app.json, package.json, package-lock.json: expo-location install and permission configuration

### Architecture Decisions

- city is sourced from profile.location.city in GymCheckinScreen, not from Places API, because Places does not return a structured city field
- GymPlace.coordinates remains a plain latitude/longitude object client-side; createCheckin is the only place that converts it to an Admin SDK GeoPoint
- checkinStore is not persisted; the Firestore listener rehydrates state when ProfileScreen mounts
- users/{uid}.gymCheckin is server-owned for create/update and client-deletable only during check-out cleanup

### Known Issues / Deferred

- /gymCheckins compound indexes (userId + expiresAt, city + expiresAt) are deferred to Task 88, the Phase 3 index consolidation task
- Expired check-in documents are logically expired by expiresAt but are not physically cleaned up yet

### Verification

- npm --prefix functions run build passes
- npx tsc --noEmit passes
- i18n JSON parse check passes for en/my/zh/ta
- git diff --check passes
- Firebase emulator rules parse check passes for firestore/storage
- Scoped scans confirm no any, inline style={{ }}, console.*, or relative imports in touched code files

### Next Up

- Task 80: Workout Events

---

## [Phase 3C - Task 78] - 2026-06-10

### Completed

- Task 78: Google Places Gym Search Service
- services/places.ts: searchNearbyGyms() calls Places API (New) POST /v1/places:searchNearby with includedTypes gym/fitness_center/sports_complex, maxResultCount 10, and maps validated results to GymPlace[]
- getPlacePhotoUrl(): pure string builder for Places photo media URLs; no network call
- types/checkin.ts: GymPlace.coordinates aligned to plain latitude/longitude coordinates for Places results
- .env.example: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY placeholder added

### Files Created / Modified

- services/places.ts: created - exports searchNearbyGyms() and getPlacePhotoUrl()
- types/checkin.ts: GymPlace.coordinates now uses GymPlaceCoordinates instead of GeoPoint
- .env.example: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY placeholder added
- CHANGELOG.md: Task 78 completion entry added

### Architecture Decisions

- API key is read at call-time inside getApiKey() rather than at module load, so a missing key surfaces with a meaningful error at the call site
- All Google Places API response interfaces are file-local and not exported, keeping third-party contract shapes out of types/
- Places response JSON is parsed from unknown through local guards before mapping
- The service stays Firebase-free and returns a typed plain latitude/longitude object; conversion to GeoPoint remains server-owned by the Task 79 createCheckin Cloud Function

### Known Issues / Deferred

- searchNearbyGyms() is not yet called from a screen or store; Task 79 wires it to GymCheckinScreen and checkinStore

### Verification

- npx tsc --noEmit passes
- git diff --check passes
- Scoped scan confirms no any, inline style={{ }}, or console.* in services/places.ts
- Export scan confirms services/places.ts exports only searchNearbyGyms() and getPlacePhotoUrl()

### Next Up

- Task 79: Gym Check-In Feature

---

## [Phase 3B - Task 77] - 2026-06-09

### Completed

- Task 77: Video Profile Loop
- expo-video and expo-file-system installed for development-build video playback and local file size checks
- uploadVideoProfile: Firebase Storage upload to users/{uid}/video/profile.mp4 with fixed-path overwrite and download URL return
- updateVideoProfile / removeVideoProfile: profileStore actions added; both delegate profile persistence through updateProfile(); Storage blob deletion remains deferred
- VideoProfilePicker: pick, size-check, optimistic preview, upload, change, and remove lifecycle with LoadingOverlay and translated error alerts
- EditProfileScreen: Profile Video section added below the photo grid without changing form submit or dirty-state logic
- SwipeCard: translated video badge chip appended to existing badge row; expo-video is not imported in the discovery stack
- FullProfileModal: Photo/Video tab selector added; useVideoPlayer is called unconditionally; VideoView plays only on video-tab activation and pauses on photo-tab switch, close, and unmount
- profile.video.* i18n keys added to all 4 language files
- BUILD.md documents the expo-video development-build requirement

### Files Created / Modified

- components/profile/VideoProfilePicker.tsx: created video picker with permission, size validation, upload, and removal lifecycle
- services/firebase/storage.ts: uploadVideoProfile() added
- store/profileStore.ts: updateVideoProfile() and removeVideoProfile() actions added
- app/profile/EditProfileScreen.tsx: VideoProfilePicker section added below photos
- components/discovery/SwipeCard.tsx: video badge chip added without video playback imports
- components/discovery/FullProfileModal.tsx: Photo/Video tabs and VideoView playback lifecycle added
- i18n/en.json, my.json, zh.json, ta.json: profile.video.* keys added
- BUILD.md: expo-video development-build note added
- app.json, package.json, package-lock.json: expo-video and expo-file-system install metadata added

### Architecture Decisions

- Storage path users/{uid}/video/profile.mp4 intentionally overwrites prior uploads; removeVideoProfile() clears only the Firestore URL and leaves blob cleanup for Phase 4
- expo-video is imported only in FullProfileModal, never in SwipeCard, preserving the discovery stack's lightweight render path
- VideoProfilePicker imports getInfoAsync from expo-file-system/legacy because the SDK 54 root getInfoAsync shim is typed as runtime-throwing
- Video badge and picker icon are translated through profile.video.badge rather than hardcoded in JSX

### Known Issues / Deferred

- Video profile playback requires a development build and cannot be tested in Expo Go
- Storage blob cleanup for users/{uid}/video/profile.mp4 on removal remains deferred to Phase 4

### Verification

- npx tsc --noEmit passes
- i18n JSON parse check passes for en/my/zh/ta
- git diff --check passes
- Scoped scans confirm no any, inline style={{ }}, console.*, or expo-video import in SwipeCard

### Next Up

- Task 78: Google Places Gym Search Service

---

## [Phase 3B - Task 76] - 2026-06-08

### Completed

- Task 76: Voice Message Recording & Playback
- expo-av installed for recording and playback support
- VoiceMessageRecorder: hold-to-record overlay using Gesture.Simultaneous(LongPress, Pan), slide-left cancellation, 60-second auto-stop, preview send/cancel controls, and audio session teardown
- VoiceMessageBubble: play/pause playback, static waveform bars, Animated.timing progress width, and heard-state colour update after full playback
- uploadVoiceMessage: Firebase Storage upload to chats/{matchId}/audio/{uuid}.{ext} with m4a/3gp extension detection
- sendVoiceMessage: RTDB voice message write with type, audioUrl, durationSeconds, and Firestore lastMessage/lastMessageAt update
- chatStore.sendVoiceMessage: uploads the local recording then sends the RTDB message, with translated voice upload failure handling
- ChatInput: mic button added and text/image controls disabled while the recorder overlay is active
- ChatScreen: recorder overlay rendered above ChatInput and VoiceMessageBubble rendered for voice messages
- chat.voice.* i18n keys added to all 4 language files

### Files Created / Modified

- package.json, package-lock.json: expo-av added
- components/chat/VoiceMessageRecorder.tsx: created voice recording overlay with RNGH gestures and expo-av recording lifecycle
- components/chat/VoiceMessageBubble.tsx: created voice playback bubble with expo-av sound lifecycle and static waveform
- services/firebase/storage.ts: uploadVoiceMessage() added
- services/firebase/realtime.ts: RTDBMessage extended for voice; sendVoiceMessage() added; outgoing text/image messages now include type metadata
- store/chatStore.ts: sendVoiceMessage() action added
- components/chat/ChatInput.tsx: mic control and recording disabled state added
- app/chat/ChatScreen.tsx: recorder overlay and voice bubble branch wired
- types/message.ts: optional audioUrl and durationSeconds fields added
- i18n/en.json, my.json, zh.json, ta.json: chat.voice.* and voice upload error keys added
- BUILD.md: voice message development-build requirement documented
- CHANGELOG.md: Task 76 completion entry added

### Architecture Decisions

- Recipient unread increments remain owned by the existing onNewMessage Cloud Function, so the client updates only lastMessage and lastMessageAt to avoid double-counting unread messages
- ChatInput did not have the mic stub described by the prompt, so this task added the mic button directly while preserving the existing send and image controls
- RTDB subscribe normalization infers type for older text/image messages that predate the new type field
- VoiceMessageBubble uses static waveform heights only; actual audio sample waveform generation remains deferred

### Known Issues / Deferred

- Voice messages require a development build and cannot be fully tested in Expo Go
- Push notification copy for voice messages still follows the existing onNewMessage fallback because functions/src was intentionally not touched for this task

### Verification

- npx tsc --noEmit passes
- i18n JSON parse check passes for en/my/zh/ta
- git diff --check passes
- Scoped scans confirm no any, inline style={{ }}, or console.* in touched code files

### Next Up

- Task 77: Video Profile Loop

---

## [Phase 3A - Task 75] - 2026-06-08

### Completed

- Task 75: Matches Advanced Search & Filter
- useMatchFilter: custom hook encapsulating name search, activity overlap filtering, and recently-active filtering over in-memory matchStore.matches; no Firestore reads
- MatchFilterSheet: bottom-sheet Modal with 16 canonical activity chips, recently-active Switch, reset, and done controls
- MatchesScreen: premium-paywall stub replaced with real search and filter UI for premium users; non-premium users see locked row navigating to PremiumScreen; matches and messages tabs render filtered match data; filter-with-no-results empty state added
- matches.search.* and matches.filter.* i18n keys added to all 4 language files

### Files Created / Modified

- hooks/useMatchFilter.ts: created — MatchFilterState, UseMatchFilterReturn, and useMatchFilter hook
- components/matches/MatchFilterSheet.tsx: created — bottom-sheet modal for activity and recently-active filter controls
- app/matches/MatchesScreen.tsx: search bar and filter sheet wired; filteredMatches used as the source for both sorted FlatLists; filter empty-state added
- i18n/en.json, my.json, zh.json, ta.json: matches.search.* and matches.filter.* keys added
- CHANGELOG.md: Task 75 completion entry added

### Architecture Decisions

- Filtering remains entirely client-side over the already hydrated matchStore.matches array; matchStore actions and Firestore subscriptions were left unchanged
- The activity filter stores canonical onboarding activity values for overlap checks while rendering chip labels through existing onboarding activity i18n keys
- Existing Matches and Messages sort order was preserved by sorting derived slices from filteredMatches

### Known Issues / Deferred

- None

### Verification

- npx tsc --noEmit passes
- i18n JSON parse check passes for en/my/zh/ta
- Scoped scans confirm no any, inline style={{ }}, or console.* in touched code files
- git diff --check passes

### Next Up

- Task 76: Voice Message Recording & Playback

---

## [Phase 3A - Task 74] - 2026-06-07

### Completed

- Task 74: Profile Boost for Pro-tier users
- activateBoost: 2nd-gen callable enforcing active Pro gate, one boost per calendar month, and 30-minute expiry; writes boost.activatedAt and boost.expiresAt server-side
- getDiscoveryStack: +20 score uplift applied for candidates with an active boost
- BoostCard: self-contained Pro-gated card with available, active, used-this-month, and non-Pro states
- SettingsScreen: new Premium section added with BoostCard below Privacy
- ProfileScreen: BoostCard rendered in the action area for active Pro users
- firestore.rules: boost added to server-only create and update deny-lists
- UserProfile boost type aligned to boost.activatedAt / boost.expiresAt and client profile update input types exclude boost
- profile.boost.* and settings.boost.* i18n keys added to all 4 language files

### Files Created / Modified

- types/user.ts: boost field aligned to server-owned boost object
- store/profileStore.ts, services/firebase/firestore.ts: profile update input types now omit boost
- functions/src/activateBoost.ts: created Pro-only callable with calendar-month cap and Admin SDK timestamp writes
- functions/src/getDiscoveryStack.ts: active boost scoring uplift added to candidate scoring
- functions/src/index.ts: activateBoost export appended
- components/profile/BoostCard.tsx: created shared boost card with callable activation and toast feedback
- app/settings/SettingsScreen.tsx: Premium section and BoostCard added
- app/profile/ProfileScreen.tsx: BoostCard rendered for Pro users
- firestore.rules: boost added to server-only field deny-lists
- i18n/en.json, my.json, zh.json, ta.json: boost and Premium-section keys added
- CHANGELOG.md: Task 74 completion entry added

### Architecture Decisions

- Boost state is read from the typed Firestore-backed profile boost object; normal client profile update helpers explicitly omit boost
- BoostCard stores the returned expiresAt milliseconds locally only for immediate UI feedback while the profile listener catches up
- The monthly cap follows the task prompt's calendar-month check based on boost.activatedAt

### Known Issues / Deferred

- None

### Verification

- npx tsc --noEmit passes
- npm --prefix functions run build passes
- i18n JSON parse and boost key sync check passes for en/my/zh/ta
- git diff --check passes
- Scoped scan confirms no TypeScript any, inline styles, or console.log in touched code files

### Next Up

- Task 75: Matches Advanced Search & Filter

---

## [Phase 3A - Task 73] - 2026-06-07

### Completed

- Task 73: Incognito Mode for Pro-tier users
- IncognitoToggleCard: self-contained settings row with Pro gate, Switch, PremiumBadge, and success/error toast wiring
- getDiscoveryStack: incognito filtering added after both premium-leading and baseline candidate queries so legacy users without the field remain eligible
- SettingsScreen: IncognitoToggleCard added to Privacy section below the Show Me toggle
- settings.incognito.* i18n keys added to all 4 language files

### Files Created / Modified

- components/settings/IncognitoToggleCard.tsx: created Pro-gated incognito toggle card with store integration and typed navigation prop
- functions/src/getDiscoveryStack.ts: incognito exclusion filter added to both candidate query paths
- app/settings/SettingsScreen.tsx: IncognitoToggleCard import and render added to Privacy section
- i18n/en.json, my.json, zh.json, ta.json: settings.incognito.* keys added
- CHANGELOG.md: Task 73 completion entry added

### Architecture Decisions

- incognito is written directly from profileStore.updateProfile() because it is a user-controlled preference, not a server-enforced security boundary
- Non-Pro users, including Plus-tier users, are redirected to PremiumScreen on toggle tap; no new UpsellModal reason was introduced
- incognito is filtered after candidate parsing instead of with a Firestore `in` query because `whereIn` requires the field to exist; missing legacy values default to false

### Known Issues / Deferred

- None

### Verification

- npx tsc --noEmit passes
- npm --prefix functions run build passes
- i18n JSON parse and settings.incognito key sync check passes for en/my/zh/ta
- git diff --check passes
- Scoped scan confirms no any, inline styles, or console.log in touched code files

### Next Up

- Task 74: Profile Boost (Pro tier - 1x per month visibility multiplier)

---

## [Phase 3A - Task 72] - 2026-06-07

### Completed

- Task 72: Rewind / Undo Last Swipe for premium users
- rewindSwipe 2nd-gen callable added in asia-southeast1; verifies auth and premium status server-side, finds the latest like/pass swipe, deletes exactly one swipe document, and returns the target profile
- discoveryStore.rewind() now calls the rewindSwipe callable for premium users, preserves the existing non-premium upsell path, tracks isRewinding, and restores the rewound profile to the active discovery stack
- ActionButtons now owns the client-side premium UX gate, surfaces translated rewind error toasts, and disables rewind while the async operation is running
- DiscoveryScreen now keeps rewind usable when the visible card stack is empty by passing a rewind-specific disabled state
- discovery.rewind.* i18n keys added to all 4 language files

### Files Created / Modified

- functions/src/rewindSwipe.ts: created callable with server-owned swipe deletion and premium validation
- functions/src/index.ts: rewindSwipe export appended
- store/discoveryStore.ts: isRewinding state and rewind action implemented
- app/discovery/DiscoveryScreen.tsx: disabled-state wiring added for rewind
- components/discovery/ActionButtons.tsx: premium/non-premium rewind branch, error toast handling, and per-button disabled handling added
- i18n/en.json, my.json, zh.json, ta.json: discovery.rewind.* keys added
- CHANGELOG.md: Task 72 completion entry added

### Architecture Decisions

- Rewind uses the existing regional callable setup in discoveryStore because services/firebase/config.ts does not currently export a Functions instance and was marked read-only for this task
- The restored card is prepended to the active stack slice and currentIndex is reset to 0 so previously swiped cards do not reappear
- The discovery screen remains responsible for swipe-stack orchestration, while ActionButtons owns the client-side rewind tap branch required by the task prompt
- The Cloud Function attaches structured details to the no-swipes not-found error so the client can distinguish it from other not-found failures

### Verification

- npx tsc --noEmit passes
- npm --prefix functions run build passes
- i18n JSON parse check passes for en/my/zh/ta
- git diff --check passes
- Scoped scans confirm no any, inline styles, or console.log in touched code files

### Next Up

- Continue Phase 3A with the next assigned task.

---

## [Phase 3A - Task 71] - 2026-06-07

### Completed

- Task 71: Stripe Customer Portal Cloud Function
- createCustomerPortalSession 2nd-gen callable added in asia-southeast1; reads stripeCustomerId server-side from the authenticated user's Firestore document and returns a one-time Stripe Billing Portal session URL
- openCustomerPortal() added in services/stripe.ts; calls the callable and opens the returned URL via Linking
- PremiumScreen "Manage Subscription" now uses the Cloud Function flow with loading state and translated error handling
- EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL removed from the PremiumScreen portal flow
- Stale EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL placeholders removed from .env.example and BUILD.md
- i18n portal loading and error keys added to all 4 language files

### Files Created / Modified

- .env.example, BUILD.md: obsolete static billing portal env var references removed
- functions/src/createCustomerPortalSession.ts: created callable, Firestore stripeCustomerId lookup, Stripe portal session creation, returns { url }
- functions/src/index.ts: createCustomerPortalSession export appended
- services/stripe.ts: openCustomerPortal() named export added
- app/settings/PremiumScreen.tsx: handleManageSubscription wired to openCustomerPortal(), isPortalLoading state added, static portal URL reference removed
- i18n/en.json, my.json, zh.json, ta.json: subscription.portal.* and premium.portal.* keys added
- CHANGELOG.md: Task 71 completion entry added

### Architecture Decisions

- stripeCustomerId is always read from Firestore server-side using request.auth.uid to prevent customer ID impersonation
- Stripe portal return URL uses the registered fitlink://premium deep-link scheme
- Stripe SDK failures are converted to HttpsError('internal') so raw Stripe details are not exposed to clients
- The portal callable uses the existing functions Stripe SDK API version because the task explicitly avoided reinstalling Stripe

### Known Issues / Deferred

- Stripe Billing Portal must be enabled and configured in the Stripe Dashboard before live portal sessions can be created successfully

### Verification

- npx tsc --noEmit passes
- npm --prefix functions run build passes
- i18n JSON parse check passes for en/my/zh/ta
- git diff --check passes
- Scoped scan confirms PremiumScreen no longer references EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL or BILLING_PORTAL_URL

### Next Up

- Task 72: Rewind (Undo Last Swipe) for Premium Users

---

## [Phase 3A Types - Task 70] - 2026-06-07

### Completed

- Task 70: Phase 3 type scaffolding added before feature implementation
- UserProfile now exposes optional Phase 3 fields for timezone-aware resets, incognito mode, profile boosts, video profiles, and denormalised gym check-ins
- Event and gym check-in TypeScript interfaces added for future Phase 3 stores, screens, services, and components
- Git commit numbering uses task-75 because task-70 through task-74 were already consumed by Phase 2 remediation commits

### Files Created / Modified

- types/user.ts: Phase 3 optional UserProfile fields appended after language without changing existing Phase 2 fields
- types/event.ts: EventLocation, FitlinkEvent, EventRSVPStatus, and EventWithAttendeeProfiles added
- types/checkin.ts: GymCheckin and GymPlace added
- CHANGELOG.md: Task 70 completion entry added

### Architecture Decisions

- Phase 3 fields are optional so existing user documents continue to type-check while server code can apply fallback behavior
- Event and check-in IDs are represented in client-side interfaces as fetched document IDs, not Firestore-stored fields
- GeoPoint and Timestamp types use the Firebase JS SDK import path for client-side type files

### Verification

- npx tsc --noEmit passes
- git diff --check HEAD~1..HEAD passes
- Scoped scan confirms no any, inline styles, or console.log in touched type files

### Next Up

- Continue with Phase 3 Task 71: Stripe Customer Portal Cloud Function.

---

## [Expo Go Auth Runtime Fix] - 2026-06-05

### Completed

- Firebase Auth now initializes with React Native AsyncStorage persistence when the app is first initialized
- Google Sign-In no longer constructs the Expo Google OAuth request unless the current platform has a configured client ID
- Missing Google OAuth config now sets a translated auth error instead of crashing the landing screen render
- Crashlytics wrapper now skips RNFirebase loading when RNFBAppModule is unavailable, such as in Expo Go

### Files Created / Modified

- services/firebase/config.ts: Auth initialization updated for AsyncStorage persistence
- app/auth/LandingScreen.tsx: Google auth hook moved behind a configured-platform guard
- services/crashlytics.ts: RNFirebase native module availability guard added
- i18n/en.json, my.json, zh.json, ta.json: missing Google client ID error key added
- CHANGELOG.md: Expo Go auth runtime fix entry added

### Verification

- npx tsc --noEmit passes
- git diff --check passes for touched files
- npx expo export --platform ios --output-dir /private/tmp/fit-link-export-ios-auth-fix passes

---

## [iOS Bundle Dependency Fix] - 2026-06-05

### Completed

- Added prop-types as a runtime dependency because @invertase/react-native-apple-authentication imports it from AppleButton.ios.js during iOS bundling
- Confirmed the iOS Metro export bundles successfully after the dependency update

### Files Created / Modified

- package.json: prop-types dependency added
- package-lock.json: prop-types dependency locked
- CHANGELOG.md: dependency fix entry added

### Verification

- npx tsc --noEmit passes
- npm ls prop-types @invertase/react-native-apple-authentication --depth=1 shows prop-types@15.8.1 installed
- npx expo export --platform ios --output-dir /private/tmp/fit-link-export-ios passes

---

## [Phase 2 External Gate Deferrals - Task 74] - 2026-06-05

### Completed

- Task 74: Phase 2 checklist updated for owner-approved external gate deferrals
- Stripe account/payment/webhook gates remain deferred until Stripe setup exists
- App Store / Play Store account, submit credential, and physical-device validation gates remain deferred
- Production Firebase promotion remains deferred because `.firebaserc` currently targets only `gym-dating-dev`
- Locally evidenced checklist items were marked complete for differentiated upsell reasons, Premium navigation CTA, and i18n key coverage

### Files Created / Modified

- docs/TASKS_PHASE2.md: local evidence items checked and external launch gate deferral note added
- CHANGELOG.md: Task 74 external gate deferral entry added

### Verification

- npx tsc --noEmit passes
- Scoped git diff --check passes for docs/TASKS_PHASE2.md and CHANGELOG.md

### Next Up

- Continue dev-only Firebase/backend validation against `gym-dating-dev`; do not mark account/device gates complete until direct evidence exists.

---

## [Phase 2 EAS Project Link - Task 72] - 2026-06-05

### Completed

- Task 72: EAS project created and linked for dev launch-gate execution
- EAS project created at @benjaminchan/fit-link with project ID 3af7713a-67de-4659-a324-b742aacdc95f
- app.json now includes owner and extra.eas.projectId required by EAS env/build commands
- Expo-resolved Android permissions are now materialized in app.json for biometric and camera/native module requirements

### Files Created / Modified

- app.json: EAS owner/project ID added; Android permissions materialized by EAS init
- CHANGELOG.md: Task 72 EAS project-link entry added

### Verification

- npx expo config --json passes after EAS project linking

### Next Up

- Configure EAS env values and continue Firebase/Stripe/development-build launch gates.

## [Phase 2 Launch Gate Prep - Task 71] - 2026-06-05

### Completed

- Task 71: EAS app-config blocker fixed before external launch-gate execution
- Removed @invertase/react-native-apple-authentication from app.json plugins because the package does not ship an Expo config plugin and caused Expo/EAS config evaluation to fail
- Apple Sign-In entitlement remains configured through ios.entitlements.com.apple.developer.applesignin

### Files Created / Modified

- app.json: invalid @invertase/react-native-apple-authentication plugin entry removed; Apple entitlement preserved
- CHANGELOG.md: Task 71 launch-gate prep entry added

### Architecture Decisions

- Apple Sign-In remains a native development-build feature through @invertase/react-native-apple-authentication at runtime, but Expo config evaluation must not load the package as a config plugin

### Verification

- Pending rerun as part of launch-gate execution: npx expo config --json, npx tsc --noEmit, npm --prefix functions run build, and EAS env/build checks

### Next Up

- Continue Phase 2 external launch-gate execution against gym-dating-dev.

## [Phase 2 Launch Readiness Remediation - Task 70] - 2026-06-05

### Completed

- Task 70: Phase 2 launch-readiness blockers remediated after checklist review
- eas.json development iOS builds now target physical devices, production submit no longer contains placeholder iOS credentials, and Android submit targets the production track
- Profile "Get Premium" CTA now navigates to PremiumScreen
- PremiumScreen billing portal URL now comes from EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL with translated fallback when missing
- recordSwipe now rejects non-premium superlike callable attempts server-side
- onPrimaryPhotoChanged Cloud Function added to clear photoVerified / verifiedAt when a verified user's primary photo changes
- profileStore now immediately prompts local re-verification after primary photo replacement or deletion while the server trigger enforces the persisted reset
- Strava OAuth now encrypts access tokens as well as refresh tokens, and syncStravaActivity migrates legacy plaintext tokens during sync
- Remaining client console error paths in discoveryStore and matchStore now route to Crashlytics

### Files Created / Modified

- functions/src/onPrimaryPhotoChanged.ts: created server-owned primary photo re-verification trigger
- functions/src/recordSwipe.ts, exchangeStravaToken.ts, syncStravaActivity.ts, onUserCreated.ts, index.ts: callable hardening, token encryption, export, and release logging cleanup
- app/profile/ProfileScreen.tsx, app/settings/PremiumScreen.tsx, store/profileStore.ts, store/discoveryStore.ts, store/matchStore.ts: premium navigation, billing portal handling, re-verification prompt, and Crashlytics logging
- eas.json, BUILD.md, .env.example, i18n/en.json, my.json, zh.json, ta.json, types/subscription.ts: release config, env docs, translations, and token typing comments

### Architecture Decisions

- EAS submit credentials remain external to the repository; eas.json no longer stores placeholder Apple IDs or credential paths
- Primary photo verification reset is server-owned because photoVerified and verifiedAt remain blocked from client writes by Firestore rules
- Strava token migration treats non-encrypted legacy token strings as plaintext only long enough to sync and rewrite encrypted values
- Billing portal configuration is public Expo env because it is a customer portal URL, not a secret

### Known Issues / Deferred

- Physical-device verification is still required for iOS and Android development builds, Stripe Payment Sheet, Apple Sign-In, Google Sign-In, Crashlytics dashboard delivery, Apple Health, Google Fit, Strava OAuth, and Cloud Vision photo verification
- Production deploy verification is still required for Cloud Functions, Firestore rules, Firestore indexes, Stripe webhook endpoint configuration, and webhook premium updates within 30 seconds
- docs/TASKS_PHASE2.md checklist remains unchecked until direct device/deployment evidence exists

### Verification

- npx tsc --noEmit passes
- npm --prefix functions run build passes
- eas.json, app.json, firestore.indexes.json, and all four i18n JSON files parse successfully
- Firestore emulator rules load via firebase emulators:exec --only firestore "node -e \"process.exit(0)\""
- Static checks confirm zero inline style={{ }}, zero console.log, zero client console.error, and no real any usage; only the word "Always" in a comment matches the any text scan
- i18n key parity remains intact for en/my/zh/ta, with only the pre-existing _note extras in non-English files

### Next Up

- Configure external release credentials and run the remaining Phase 2 done checklist on physical devices and deployed Firebase/Stripe infrastructure before App Store / Play Store submission.

## [Phase 2F - Task 69] - 2026-06-05

### Completed

- Task 69: Phase 2 Firestore composite indexes added to firestore.indexes.json
- Priority profile boosting index added for users: premium.active ASC, location.city ASC, banned ASC, paused ASC, lastActive DESC
- Active today badge index added for users: fitnessTracking.shareOnProfile ASC, fitnessTracking.todayStats.updatedAt DESC
- getDiscoveryStack now runs a premium.active == true candidate query before the baseline location query, then de-dupes and scores the combined pool
- getDiscoveryStack scoring now uses Phase 2 premium.active with a legacy subscription fallback for older user documents
- Existing Phase 1 index baseline preserved: users discovery, matches listener, reports threshold, and likes createdAt collection-group field override

### Files Created / Modified

- firestore.indexes.json: 2 new users composite indexes appended; existing Task 40 indexes and fieldOverrides preserved
- functions/src/getDiscoveryStack.ts: discovery query aligned to the new premium-leading composite index
- CHANGELOG.md: Task 69 implementation summary added

### Architecture Decisions

- Priority profile index leads with premium.active because getDiscoveryStack now fetches the premium-active candidate pool first, then falls back to the Phase 1 location/activity query for the broader candidate pool
- Active today badge index uses fitnessTracking.shareOnProfile as the leading field so future collection queries can filter shared profiles before ordering by todayStats.updatedAt; current profile surfaces still evaluate known user documents locally
- Existing likes createdAt field override was preserved because it is committed Task 40 infrastructure and the task prompt explicitly says not to remove pre-existing overrides

### Known Issues / Deferred

- Index propagation to production can take several minutes after deploy; emulator validation reflects index config immediately
- RTDB security rules remain out of scope
- No current client collection query uses the active-today composite index directly; the index is deploy-ready for the specified Phase 2 query pattern

### Verification

- firestore.indexes.json parses as valid JSON
- firestore.indexes.json contains 5 composite indexes and preserves the existing fieldOverrides entry
- npx tsc --noEmit passes
- npm --prefix functions run build passes
- firebase emulators:exec --only firestore "node -e \"process.exit(0)\"" passes

### Next Up

- Phase 2 is now complete. Review the Phase 2 done checklist in docs/TASKS_PHASE2.md before declaring the build ready for App Store / Play Store submission.

## [Phase 2F - Task 68] - 2026-06-04

### Completed

- Task 68: Firestore security rules updated for Phase 2
- firestore.rules: consolidated Phase 1 base rules with Phase 2 patches for premium, photo verification, swipes, daily likes, Strava token ownership, verification attempts, reports, blocked users, matches, and messages
- doesNotModifyServerOnlyFields(): root-level deny-list now matches the Phase 2 spec exactly: age, banned, banReason, bannedAt, photoVerified, verifiedAt, stripeCustomerId, premium, and legacy subscription
- Legacy server-managed fields stats and verified remain blocked through separate legacy helper checks so the Phase 2 helper stays clean while existing protection is preserved
- /users/{userId} update rule now calls a separate Strava token-field check for fitnessTracking.strava.accessToken, refreshToken, and expiresAt, plus a stricter Strava map guard that only allows client disconnect semantics
- Client-writable fitnessTracking fields remain available for shareOnProfile, appleHealth, and googleFit updates
- /users/{userId}/dailyLikes: owner reads allowed for UI remaining-like display; all client writes denied
- /users/{userId}/verificationAttempts: all client access denied
- /swipes/ likes and passes: all client writes denied; reads remain scoped to owner/target per path
- /blocked: all client access denied

### Files Created / Modified

- firestore.rules: full Phase 2 rules hardening and follow-up review cleanup
- CHANGELOG.md: Task 68 implementation summary added

### Architecture Decisions

- Strava token dot-path fields are checked separately from doesNotModifyServerOnlyFields() because they are nested inside fitnessTracking
- Whole-map Strava updates are still constrained to disconnect-only writes so clients cannot bypass token protection by replacing fitnessTracking.strava
- doesNotSetServerOnlyFieldsOnCreate() is separate from doesNotModifyServerOnlyFields() to avoid create-time resource.data null evaluation while preserving the same root server-only field intent
- stats and legacy verified remain server-managed in this codebase, but are documented as legacy helper checks rather than part of the Task 68 Phase 2 helper list

### Known Issues / Deferred

- RTDB security rules for chat remain out of scope for Task 68
- Admin moderation queues and Phase 3 collections are not yet defined

### Verification

- git diff --check -- firestore.rules passes
- npx tsc --noEmit passes
- firebase emulators:exec --only firestore "node -e \"process.exit(0)\"" passes
- Targeted emulator allow/deny probe passes for user create, dailyLikes owner read, dailyLikes write denial, shareOnProfile update, appleHealth update, googleFit update, Strava token denial, Strava reconnect denial, Strava disconnect allow, premium denial, legacy stats denial, swipe write denial, and server-only field create denial

### Next Up

- Task 69: Phase 2 Firestore Indexes

## [Phase 2E - Task 67] - 2026-06-03

### Completed

- Task 67: Firebase Crashlytics integration
- services/crashlytics.ts: logError, setUser, and log named exports added; native module loading and calls are wrapped in try/catch so Crashlytics cannot interrupt app flows
- ErrorBoundary.tsx: console.error calls replaced with logError(error, { componentStack })
- authStore.ts: setCrashlyticsUser called on setUser (uid) and logout ('')
- app.json: @react-native-firebase/app and @react-native-firebase/crashlytics plugins appended
- BUILD.md: native module table and Crashlytics verification steps documented; Google Sign-In row names the actual expo-auth-session dependency

### Files Created / Modified

- services/crashlytics.ts: created - sole client boundary for @react-native-firebase/crashlytics with lazy native module resolution
- components/ui/ErrorBoundary.tsx: componentDidCatch now records errors through the Crashlytics wrapper
- store/authStore.ts: setCrashlyticsUser added to setUser and logout actions
- app.json: two @react-native-firebase plugin entries appended to plugins array
- package.json, package-lock.json: @react-native-firebase/app and @react-native-firebase/crashlytics installed via npx expo install
- BUILD.md: "Native Modules - Development Build Required" section appended

### Architecture Decisions

- Crashlytics native imports are isolated to services/crashlytics.ts; app code imports only the local wrapper
- Every Crashlytics wrapper swallows SDK errors to keep auth and error-boundary flows non-blocking
- setCrashlyticsUser import alias avoids shadowing the existing authStore setUser action

### Known Issues / Deferred

- Crashlytics requires a development build and cannot be verified in Expo Go
- Live crash dashboard verification is deferred to development-build testing
- npx expo install completed but repeated the existing Apple authentication config-plugin warning

### Verification

- npx tsc --noEmit passes
- Targeted checks confirm no console calls, no any, no inline style={{ }}, and no direct @react-native-firebase/crashlytics imports outside services/crashlytics.ts in touched client paths
- app.json, package.json, and package-lock.json parse successfully

### Next Up

- Task 68: Update Firestore Security Rules for Phase 2

## [Phase 2E - Task 66] - 2026-06-03

### Completed

- Task 66: Apple Sign-In production flow - signInWithApple stub replaced with @invertase/react-native-apple-authentication
- services/firebase/auth.ts: signInWithApple stub deleted; signInWithAppleCredential(identityToken, nonce) added as named export
- LandingScreen.tsx: appleAuth.performRequest wired in handleApplePress; appleAuth.isSupported guard added; user-cancel suppressed; button wired to handleApplePress
- i18n: auth.apple.missingToken, cancelledByUser, failed added to all 4 language files
- app.json: @invertase/react-native-apple-authentication config plugin restored as a single plugins entry

### Files Created / Modified

- services/firebase/auth.ts: signInWithApple removed, signInWithAppleCredential(identityToken, nonce) added
- app/auth/LandingScreen.tsx: handleApplePress added; Apple button wired; appleAuth default import added
- i18n/en.json: auth.apple.* keys added
- i18n/my.json, zh.json, ta.json: auth.apple.* mirrored with English placeholders
- app.json: Apple authentication config plugin added once

### Architecture Decisions

- LandingScreen owns appleAuth.performRequest; auth.ts receives only resolved identityToken and nonce strings - mirrors Task 65 Google split
- appleAuth.Error.CANCELED used for user-cancel suppression
- No manual nonce hashing - @invertase library handles nonce lifecycle internally
- OAuthProvider from firebase/auth; no new package dependency
- BUILD.md already documents that Apple Sign-In requires a development build and cannot be tested in Expo Go

### Known Issues / Deferred

- Apple Sign-In requires a development build; cannot be verified in Expo Go
- Task 67 (Crashlytics) will replace console.error in remaining auth error paths

### Verification

- npx tsc --noEmit passes
- Targeted checks: signInWithApple absent from client source, zero any, zero inline style={{ }}, zero console.log in touched files, valid i18n JSON

### Next Up

- Task 67: Firebase Crashlytics Integration (services/crashlytics.ts, ErrorBoundary, authStore setUser)

## [Phase 2E - Task 65] - 2026-06-03

### Completed

- Task 65: Google Sign-In production flow - signInWithPopup replaced with expo-auth-session OAuth
- services/firebase/auth.ts: signInWithGoogle removed; signInWithGoogleCredential(idToken) added as named export
- LandingScreen.tsx: Google.useAuthRequest hook wired; WebBrowser.maybeCompleteAuthSession() at module level; promptAsync() triggers OAuth browser flow; response handled in useEffect; signInWithGoogleCredential called on success; disabled guard includes !request
- .env.example: EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO/IOS/ANDROID keys appended
- i18n: auth.google.missingToken added to all 4 language files

### Files Created / Modified

- services/firebase/auth.ts: signInWithGoogle removed, signInWithGoogleCredential(idToken) added
- app/auth/LandingScreen.tsx: Google.useAuthRequest hook, WebBrowser.maybeCompleteAuthSession(), handleGooglePress, handleGoogleToken, !request disabled guard on Google button
- .env.example: three EXPO_PUBLIC_GOOGLE_CLIENT_ID_* placeholder keys appended
- i18n/en.json: auth.google.missingToken added
- i18n/my.json, zh.json, ta.json: auth.google.missingToken mirrored with English placeholder

### Architecture Decisions

- LandingScreen owns the Google OAuth hook and browser prompt, while services/firebase/auth.ts stays a plain Firebase credential helper with no hook or WebBrowser imports
- The Google response handler reads response.authentication?.idToken first and falls back to response.params.id_token, matching expo-auth-session's local Google provider behavior after code exchange
- authStore's existing setIsLoading action is used for global auth loading because this repo does not expose a setLoading action

### Known Issues / Deferred

- Google Sign-In requires a development build; cannot be verified in Expo Go
- Apple Sign-In stub unchanged - addressed in Task 66

### Verification

- npx tsc --noEmit passes
- Targeted checks confirm signInWithPopup is absent from client .ts/.tsx files, no inline style={{ }} in touched files, zero any in touched TypeScript files, zero console.log in touched TypeScript files, valid i18n JSON, and clean scoped git diff --check

### Next Up

- Task 66: Apple Sign-In Production Flow (replace signInWithApple stub with @invertase/react-native-apple-authentication)

## [Phase 2D - Task 64] - 2026-06-02

### Completed

- Task 64: Connected Apps Settings Screen
- ConnectedAppsScreen: new settings screen with platform-gated Apple Health and Google Fit sections, cross-platform Strava connect/sync/disconnect controls, per-source sync spinners, last-synced labels, and activity sharing toggle
- MainTabNavigator: ConnectedApps added to SettingsStackParamList and registered in the Settings stack with navigator-owned title
- SettingsScreen: Connected Apps row added to Account settings and wired to navigation.navigate('ConnectedApps')
- i18n: settings.connectedApps.*, fitness.connectedApps sync/status keys, and fitness.strava.* keys added to all 4 language files

### Files Created / Modified

- app/settings/ConnectedAppsScreen.tsx: created - default-export screen, no inline styles, no direct healthKit/googleFit service imports, platform guards for native integrations
- app/navigation/MainTabNavigator.tsx: ConnectedApps screen import, param list entry, and Settings stack registration added
- app/settings/SettingsScreen.tsx: Connected Apps navigation row added
- store/fitnessStore.ts: Strava disconnectSource branch now updates local connection state only, avoiding a duplicate disconnectStrava Firestore call from ConnectedAppsScreen
- i18n/en.json: settings.connectedApps.*, fitness.connectedApps.*, and fitness.strava.* keys added
- i18n/my.json, zh.json, ta.json: same keys mirrored with English placeholders

### Architecture Decisions

- Apple Health and Google Fit enable flows use fitnessStore connectSource before hook sync, while manual sync/disconnect uses useAppleHealth/useGoogleFit so hook-owned sync guards remain in control
- Strava connect/sync/disconnect stays in services/strava.ts, with disconnect confirmation before Firestore cleanup and local store update
- Strava disconnect order is disconnectStrava(userId) for Firestore cleanup, then disconnectSource(userId, 'strava') for Zustand state, both inside the Alert destructive confirm handler try/catch
- ConnectedAppsScreen uses local useState only for transient button spinners; source connection and share state remain in fitnessStore
- Last-synced formatting is display-only and uses Date.now() without creating client-side Firestore timestamps

### Known Issues / Deferred

- Native Apple Health and Google Fit flows require development builds and cannot be verified in Expo Go

### Verification

- npx tsc --noEmit passes
- i18n JSON parses for en, my, zh, ta
- Targeted checks confirm zero any, zero inline style={{ }}, zero console.*, and clean scoped git diff --check for Task 64 paths

### Next Up

- Continue Phase 2D follow-up testing in development builds for native fitness integrations

## [Phase 2D - Task 63] - 2026-06-02

### Completed

- Task 63: Fitness activity display on profiles
- TodayActivityCard: new named-export presentational component - steps, calories, distance row, latest workout row, source label, last-updated relative timestamp, own-profile detail stub
- FullProfileModal: "Today's Activity" section added after "What You Have in Common"; gated on shareOnProfile === true and updatedAt within 24 hours
- ProfileScreen: "Today's Activity" card visible for own user when stats and a connected source exist; "Connected Apps" section with share toggle and per-source Sync Now links
- SwipeCard: "Active today" chip badge derived inline from UserProfile.fitnessTracking; shown when shareOnProfile === true and updatedAt is within 24 hours
- i18n: fitness.activity.* and fitness.connectedApps.* keys added to all 4 language files

### Files Created / Modified

- components/profile/TodayActivityCard.tsx: created - named export, no store imports, no platform-specific imports, typed styles
- components/discovery/FullProfileModal.tsx: Today's Activity section added with share and freshness guard logic
- app/profile/ProfileScreen.tsx: TodayActivityCard + Connected Apps section with share toggle, green connected-source dots, and Sync Now handlers
- components/discovery/SwipeCard.tsx: isActiveTodayVisible flag + Active today badge
- i18n/en.json: fitness.activity.* and fitness.connectedApps.* added
- i18n/my.json, zh.json, ta.json: same keys mirrored with English placeholders

### Architecture Decisions

- TodayActivityCard stays presentational and receives stats/source through props; ProfileScreen reads own data from fitnessStore and FullProfileModal/SwipeCard read candidate data from UserProfile.fitnessTracking
- ProfileScreen triggers fetchTodayStats(userId) when a logged-in uid is available so the own-profile surface can display fresh Firestore-backed stats
- Active source priority follows the task order: appleHealth, then googleFit, then strava
- The own-profile tap interaction is an i18n-backed Alert stub until Task 64 builds the full connected-apps settings surface

### Known Issues / Deferred

- Connected Apps management remains a compact profile row in this task; the full connect/disconnect/settings screen is Task 64

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/
- Targeted checks confirm valid i18n JSON, zero any, zero inline style={{ }}, zero console.* in touched UI files, and clean scoped git diff --check for Task 63 paths

### Next Up

- Task 64: Connected Apps Settings Screen (app/settings/ConnectedAppsScreen.tsx - full connect/disconnect/sync UI per platform, share toggle, navigation from SettingsScreen)

## [Phase 2D - Task 62] - 2026-06-01

### Completed

- Task 62: Google Fit Integration (Android only)
- services/googleFit.ts: created - isGoogleFitAvailable, requestGoogleFitPermissions, fetchGoogleFitTodayStats, updateGoogleFitFirestore, setGoogleFitConnected; all exported functions guard Platform.OS !== 'android'
- hooks/useGoogleFit.ts: created - isConnected, todayStats, sync(), disconnect(); AppState listener for foreground auto-sync; syncInFlightRef prevents concurrent syncs
- store/fitnessStore.ts: googleFit branch wired in connectSource, disconnectSource, syncNow; googleFit console.warn stubs removed
- i18n: fitness.googleFit.* namespace added to all 4 language files
- react-native-google-fit installed

### Files Created / Modified

- services/googleFit.ts: created - 5 named exports, full Android guard pattern
- hooks/useGoogleFit.ts: created - useGoogleFit named export, AppState lifecycle, re-entrant sync guard
- store/fitnessStore.ts: googleFit case bodies replaced in 3 actions; Apple Health and Strava branches left unchanged
- services/firebase/firestore.ts: updateUserProfile input type extended for typed Google Fit dot-path writes
- i18n/en.json: fitness.googleFit.* keys added
- i18n/my.json, zh.json, ta.json: fitness.googleFit.* mirrored with English placeholders
- package.json, package-lock.json: react-native-google-fit added
- app.json: react-native-google-fit config plugin added by npx expo install

### Architecture Decisions

- Google Fit imports and API calls are isolated to services/googleFit.ts; all public service functions return before calling the library on non-Android platforms
- setGoogleFitConnected writes connected=false with lastSync=null to match existing Apple Health and Strava disconnect semantics
- useGoogleFit accepts an optional uid for Task 64 compatibility, while falling back to authStore.uid to mirror useAppleHealth
- Expo install added the react-native-google-fit config plugin; local package docs require it for Expo apps to add Android 11+ Google Fit package queries

### Known Issues / Deferred

- react-native-google-fit requires a development build; cannot be tested in Expo Go
- npm install reported existing dependency audit findings: 17 moderate and 4 high vulnerabilities

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/
- Targeted checks confirm Android guards, zero any, zero inline styles, zero console.log/console.warn, zero new Date() calls in touched task files, no relative imports, valid i18n JSON, and no functions/ diff

### Next Up

- Task 63: Fitness Activity Display on Profiles (TodayActivityCard, FullProfileModal, ProfileScreen, SwipeCard "Active today" badge)

## [Phase 2D - Task 61] - 2026-06-01

### Completed

- Task 61: Apple Health Integration (iOS only)
- services/healthKit.ts: created - isAppleHealthAvailable, requestAppleHealthPermissions, fetchAppleHealthTodayStats, updateAppleHealthFirestore, setAppleHealthConnected; all exported functions guard Platform.OS !== 'ios'
- hooks/useAppleHealth.ts: created - isConnected, todayStats, sync(), disconnect(); AppState listener for foreground auto-sync; syncInFlightRef prevents concurrent syncs
- store/fitnessStore.ts: appleHealth branch wired in connectSource, disconnectSource, syncNow; appleHealth console.warn stubs removed
- i18n: fitness.appleHealth.* namespace added to all 4 language files
- react-native-health installed and app.json plugin configured with HealthKit usage descriptions

### Files Created / Modified

- services/healthKit.ts: created - 5 named exports, full iOS guard pattern
- hooks/useAppleHealth.ts: created - useAppleHealth named export, AppState lifecycle, re-entrant sync guard
- store/fitnessStore.ts: appleHealth case bodies replaced in 3 actions; Platform import added
- services/firebase/firestore.ts: updateUserProfile input type extended for typed fitnessTracking dot-path writes
- i18n/en.json: fitness.appleHealth.* keys added
- i18n/my.json, zh.json, ta.json: fitness.appleHealth.* mirrored with English placeholders
- package.json, package-lock.json: react-native-health added
- app.json: react-native-health config plugin added with HealthKit permission strings

### Architecture Decisions

- HealthKit imports are isolated to services/healthKit.ts; hooks and store call only plain service functions
- updateAppleHealthFirestore owns the Apple Health source marker and Firestore serverTimestamp write
- HealthKit date windows are only used for read queries; Firestore timestamp writes use serverTimestamp()
- Google Fit Task 62 console.warn stubs remain untouched by design

### Known Issues / Deferred

- react-native-health requires a development build; cannot be tested in Expo Go
- npm install reported existing dependency audit findings: 17 moderate and 4 high vulnerabilities

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/
- Targeted checks confirm Apple Health stubs removed, all HealthKit call sites guarded with Platform.OS === 'ios', TodayStats.updatedAt returns null from fetchAppleHealthTodayStats, and Firestore timestamp writes use serverTimestamp()

### Next Up

- Task 62: Google Fit Integration (services/googleFit.ts, hooks/useGoogleFit.ts, Android only)

## [Phase 2D - Task 60] - 2026-06-01

### Completed

- Task 60: Strava OAuth Integration
- services/strava.ts: created - connectStrava OAuth browser flow, syncStrava callable wrapper, disconnectStrava Firestore status clear
- functions/src/exchangeStravaToken.ts: created - 2nd gen callable, token exchange, AES-256-CBC refresh token encryption, Firestore write
- functions/src/syncStravaActivity.ts: created - 2nd gen callable, token refresh, Strava activities fetch, today stats calculation, Firestore persist
- store/fitnessStore.ts: setConnectionStatus action added; connectSource/disconnectSource/syncNow wired for 'strava'; appleHealth/googleFit stubs preserved
- functions/src/index.ts: exchangeStravaToken and syncStravaActivity exports added
- functions/.env.example: Strava client id, client secret, and STRAVA_TOKEN_ENCRYPTION_KEY placeholders added
- types/subscription.ts: TodayStats.updatedAt now allows null for the local post-sync placeholder before Firestore serverTimestamp is fetched
- firestore.rules: users/{uid} update rule hardened so clients cannot write Strava accessToken/refreshToken/expiresAt

### Files Created / Modified

- services/strava.ts: created - connectStrava, syncStrava, disconnectStrava named exports
- functions/src/exchangeStravaToken.ts: created - onCall, auth guard, token exchange, refresh token encryption
- functions/src/syncStravaActivity.ts: created - onCall, auth guard, token refresh, activities API fetch, stats write
- store/fitnessStore.ts: setConnectionStatus added; strava dispatch wired in 3 actions
- functions/src/index.ts: exchangeStravaToken and syncStravaActivity exports added
- functions/.env.example: Strava env placeholders added
- types/subscription.ts: TodayStats.updatedAt widened to Timestamp | null
- firestore.rules: Strava token fields blocked from client writes while disconnect-only connected/lastSync clears remain allowed

### Architecture Decisions

- encryptToken/decryptToken are defined locally in each Cloud Function file - each function is self-contained and deployable independently
- Strava refresh tokens are encrypted before every Firestore write and decrypted only inside Cloud Functions
- disconnectStrava only updates connected/lastSync fields on the client path; raw token fields remain server-managed
- TodayStats.updatedAt is null in the syncStrava() return value - the real timestamp is written server-side and loaded by fetchTodayStats()
- Strava token exchange and refresh use form-encoded POST bodies with Node 18 native fetch; no node-fetch dependency added
- Firestore rules allow client Strava writes only for disconnect semantics: connected=false and lastSync=null

### Known Issues / Deferred

- Strava token cleanup on disconnect deferred to Phase 3 Cloud Function trigger or explicit revocation function
- Strava steps are always 0 because Strava activities do not provide step counts

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/
- npm run lint passes in functions/
- firebase emulators:exec --only firestore "node -e \"process.exit(0)\"" passes
- Targeted checks confirm zero any in touched files, zero inline styles, zero console.log, no new Date() calls, and no Strava secret env references in client source

### Next Up

- Task 61: Apple Health Integration (services/healthKit.ts, hooks/useAppleHealth.ts, iOS only)

## [Phase 2D - Task 59] - 2026-05-31

### Completed

- Task 59: Fitness tracking types and store
- types/fitness.ts: created - re-exports 6 fitness types from subscription.ts; adds FitnessConnectionStatus and StravaActivity
- store/fitnessStore.ts: created - useFitnessStore with fetchTodayStats, setShareOnProfile, stub connectSource/disconnectSource/syncNow, persist for shareOnProfile and connections
- i18n: fitness.* namespace added to all 4 language files

### Files Created / Modified

- types/fitness.ts: created - canonical fitness type import point; re-exports from types/subscription.ts plus FitnessSource alias and new Task 59 types
- store/fitnessStore.ts: created - useFitnessStore named export, Zustand + AsyncStorage persist, all 6 actions
- i18n/en.json: fitness.* keys added (source, connection, stats, share, actions, errors)
- i18n/my.json, zh.json, ta.json: fitness.* mirrored with English placeholders

### Architecture Decisions

- types/fitness.ts re-exports from types/subscription.ts rather than redefining - single source of truth, no duplication
- FitnessSource is a re-exported alias for FitnessTrackingSource - convenience name for Tasks 60-64
- connectSource/disconnectSource/syncNow are stubs with console.warn - wired to real services in Tasks 60-62
- todayStats excluded from persist partialize - always fetched fresh to avoid stale-day data
- Store actions take uid as first argument - decoupled from authStore for testability

### Known Issues / Deferred

- connectSource/disconnectSource/syncNow are stubs - wired in Tasks 60 (Strava), 61 (Apple Health), 62 (Google Fit)

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/ (no changes to functions)
- Targeted checks confirm zero any, zero inline styles, zero console.log, valid i18n JSON, and expected fitness type exports

### Next Up

- Task 60: Strava OAuth Integration (services/strava.ts, functions/src/exchangeStravaToken.ts, functions/src/syncStravaActivity.ts)

## [Phase 2C - Task 58] - 2026-05-30

### Completed

- Task 58: Verified badge integration complete - consistent rendering across all five surfaces
- VerifiedBadge: new named-export primitive, sm (16px) / md (20px) sizes, long-press Alert tooltip
- SwipeCard: VerifiedBadge sm in name row, reads user.photoVerified
- FullProfileModal: VerifiedBadge md in Basic Info name row, reads profile.photoVerified
- MatchCard: VerifiedBadge sm in each match card overlay, reads match.otherUser.photoVerified
- ChatScreen: VerifiedBadge md inline in header name row, reads otherUser.photoVerified
- ProfileScreen: VerifiedBadge md in header name row, reads profile.photoVerified
- i18n: profile.verifiedBadge.tooltip added to all 4 language files

### Files Created / Modified

- components/ui/VerifiedBadge.tsx: created - named export, sm/md sizes, long-press tooltip Alert
- components/discovery/SwipeCard.tsx: VerifiedBadge sm added to name row
- components/discovery/FullProfileModal.tsx: VerifiedBadge md added to Basic Info name row
- components/chat/MatchCard.tsx: VerifiedBadge sm added to match card overlay
- app/chat/ChatScreen.tsx: VerifiedBadge md added to header name row, headerNameRow style added
- app/profile/ProfileScreen.tsx: VerifiedBadge md confirmed in header name row
- app/settings/SettingsScreen.tsx: verification status label moved off profile.verified translation key
- app/profile/PhotoVerificationScreen.tsx: callable response handling no longer uses dot-access .verified
- services/firebase/firestore.ts: removed legacy verified fallback from photoVerified normalization
- functions/src/getDiscoveryStack.ts: discovery scoring now reads only photoVerified
- i18n/en.json, my.json, zh.json, ta.json: profile.verifiedBadge.tooltip and profile.verifiedStatus added

### Architecture Decisions

- VerifiedBadge has zero store/service dependencies - visibility driven entirely by props
- Long-press tooltip uses Alert.alert with i18n text and no third-party tooltip library
- size prop defaults to 'md'; callers only pass size="sm" for compact card surfaces
- Legacy user/profile verified field fallbacks were removed so photoVerified remains the only canonical profile verification field

### Known Issues / Deferred

- None

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/
- grep confirms zero local-source .verified references when excluding node_modules; unexcluded grep only reports Stripe dependency type definitions under functions/node_modules

### Next Up

- Task 59: Fitness Tracking Types and Store (types/fitness.ts, store/fitnessStore.ts)

## [Phase 2C - Task 57] - 2026-05-30

### Completed

- Task 57: Photo Verification UI Flow implemented
- SelfieCameraView: front-facing camera with face oval guide, permission handling, capture-only
- PhotoVerificationScreen: 3-step state machine (instructions -> camera -> result), upload and Cloud Function lifecycle, attempt counter, localized reason-code mapping
- uploadVerificationSelfie: added to services/firebase/storage.ts - returns GCS storage path, not download URL
- PhotoVerification registered in RootNavigator; navigate-to wired in ProfileScreen and SettingsScreen
- All verification.* i18n keys added to all 4 language files

### Files Created / Modified

- components/profile/SelfieCameraView.tsx: created - CameraView, oval overlay, capture/retake controls, permission denied state
- app/profile/PhotoVerificationScreen.tsx: created - instructions/camera/result state machine, upload lifecycle, reasonToI18nKey mapper
- services/firebase/storage.ts: uploadVerificationSelfie added
- storage.rules: verification temp selfie upload path allowed for owner create/update only; client read/delete denied
- store/profileStore.ts: server-confirmed photoVerified local refresh supported without client Firestore writes
- app/navigation/RootNavigator.tsx: PhotoVerification added to RootStackParamList and stack
- app/profile/ProfileScreen.tsx: "Verify Now" wired to navigation.navigate('PhotoVerification')
- app/settings/SettingsScreen.tsx: verification row wired to navigation.navigate('PhotoVerification')
- i18n/en.json: verification.* namespace added; common.ok added
- i18n/my.json, zh.json, ta.json: verification.* mirrored with English placeholders; common.ok added

### Architecture Decisions

- uploadVerificationSelfie returns the GCS storage path, not a download URL; verifyProfilePhoto reads via gs:// URI internally
- Temp selfie deletion remains the Cloud Function's responsibility only; no client-side delete was added
- Attempt counter is client-side display state; server enforces the cap and daily_limit_reached is handled from both response reason and callable resource-exhausted errors
- reasonToI18nKey maps requested Task 57 reason codes plus existing Task 56 aliases to i18n keys before t() call
- SelfieCameraView is capture-only; all upload and Cloud Function logic is in PhotoVerificationScreen

### Known Issues / Deferred

- None

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/ (no changes to functions)

### Next Up

- Task 58: Verified Badge Integration (ensure photoVerified badge renders consistently across SwipeCard, FullProfileModal, MatchesScreen, ChatScreen header, and ProfileScreen using the photoVerified field)

## [Phase 2C - Task 56] - 2026-05-29

### Completed

- Task 56: verifyProfilePhoto Cloud Function implemented
- Face detection via Google Cloud Vision on selfie (GCS URI) and profile photo (HTTPS URL)
- SafeSearch check on selfie rejects adult, violent, or racy content
- computeFaceMatchScore: simplified confidence-based scorer, 0.75 baseline, Phase 3 TODO for embedding model
- checkAndIncrementAttempts: Firestore transaction, daily cap (default 3), UTC+8 reset mirrors recordSwipe pattern
- deleteTempSelfie: called through finally for success, failure, and error paths; errors swallowed
- @google-cloud/vision installed in functions/

### Files Created / Modified

- functions/src/verifyProfilePhoto.ts: created - verifyProfilePhoto callable, all logic
- functions/src/index.ts: verifyProfilePhoto export added
- functions/package.json: @google-cloud/vision added to dependencies
- functions/package-lock.json: dependency lockfile updated
- functions/.env: MAX_VERIFICATION_ATTEMPTS_PER_DAY=3 documented locally
- functions/.env.example: same key added

### Architecture Decisions

- Selfie read via GCS URI (gs://bucket/path); profile photo read via HTTPS download URL
- selfiePath is constrained to users/{uid}/verification/ before the function will process or delete the object
- verificationAttempts counter lives at /users/{uid}/verificationAttempts/doc, matching the dailyLikes fixed-document pattern
- reason field returns snake_case machine codes, not human text, for Task 57 i18n mapping
- computeFaceMatchScore is intentionally a heuristic placeholder with a TODO comment
- @google-cloud/vision latest version was checked with npm view and installed as ^5.3.6

### Known Issues / Deferred

- Face matching is a simplified heuristic; real embedding model deferred to Phase 3
- getNextMidnightMs() uses UTC+8 approximation; per-user timezone is Phase 3

### Verification

- npx tsc --noEmit passes in functions/
- npx tsc --noEmit passes at project root

### Next Up

- Task 57: Photo Verification UI Flow (PhotoVerificationScreen, SelfieCameraView, 3-step instructions to camera to result, calls verifyProfilePhoto, maps reason codes to i18n)

## [Phase 2B - Task 55] - 2026-05-28

### Completed

- Task 55: Server-side daily likes enforcement via recordSwipe Cloud Function
- recordSwipe: 2nd gen callable (asia-southeast1), Firestore transaction, daily cap, reset logic
- discoveryStore: swipeRight(), swipeLeft(), swipeSuperLike() now call recordSwipe - no client writes to /swipes/
- firestore.rules: /swipes/ client writes denied, /users/{userId}/dailyLikes client writes denied
- i18n: errors.dailyLimit key added to all 4 language files

### Files Created / Modified

- functions/src/recordSwipe.ts: created - recordSwipe callable, transaction, cap enforcement
- functions/src/index.ts: recordSwipe export added
- store/discoveryStore.ts: swipe actions replaced with httpsCallable, resource-exhausted error handling
- services/firebase/firestore.ts: daily like helper changed to read-only display helper
- firestore.rules: /swipes/ and /dailyLikes write rules denied
- i18n/en.json, my.json, zh.json, ta.json: errors.dailyLimit added

### Architecture Decisions

- recordSwipe writes like and superlike documents to swipes/{userId}/likes/{targetId}; superlike remains a like with isSuperLike: true
- recordSwipe writes the like/superlike document inside the same Firestore transaction as the dailyLikes increment, so quota consumption and swipe creation commit together
- dailyLikes remains the fixed single-doc subcollection path users/{userId}/dailyLikes/doc, matching the existing Phase 1 path and rules shape
- discoveryStore keeps the existing swipeLeft caller contract; left swipes still advance through DiscoveryScreen after the callable succeeds, avoiding a card skip

### Known Issues / Deferred

- console.error in discoveryStore swipe actions will be replaced by Crashlytics in Task 67
- getNextMidnightMs() uses UTC+8 approximation; per-user timezone is Phase 3

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/
- rg confirms no direct client setDoc/addDoc writes to /swipes/ remain

### Next Up

- Task 56: Photo Verification Cloud Function (verifyProfilePhoto - Cloud Vision face detection)

## [Phase 2B — Task 54] — 2026-05-28

### Completed

- Task 54: Premium feature gates wired across all surfaces
- UpsellReason type ('likes' | 'superLike' | 'rewind') added to types/subscription.ts
- subscriptionStore: upsellVisible, upsellReason, showUpsell(), hideUpsell() added
- discoveryStore: showUpsellModal-style flag removed; premium gates use subscriptionStore.showUpsell(); unlimited likes bypass for premium users; rewind() scaffold added
- UpsellModal: 'rewind' reason variant added with i18n keys in all 4 language files
- DiscoveryScreen: upsell state sourced from subscriptionStore
- ActionButtons: onRewind stays callback-only; premium-status logic removed from the button row
- MatchesScreen: search row shows PremiumBadge and gates on isPremium()
- MessageBubble: isPremium prop added; blue double-tick gated; gray double-tick always shown
- ChatScreen: isPremium passed to MessageBubble from subscriptionStore

### Files Created / Modified

- types/subscription.ts: UpsellReason type added
- store/subscriptionStore.ts: upsell state and actions added
- store/discoveryStore.ts: premium gates updated, rewind() added, discovery-owned upsell flag removed
- components/discovery/UpsellModal.tsx: rewind reason variant, reason-aware content map
- app/discovery/DiscoveryScreen.tsx: upsell wired to subscriptionStore, onRewind wired to discoveryStore.rewind()
- components/discovery/ActionButtons.tsx: premium-status logic removed; callbacks remain dumb
- components/discovery/FullProfileModal.tsx: post-action close check moved to subscriptionStore upsell state
- app/matches/MatchesScreen.tsx: search row premium gate and PremiumBadge
- components/chat/MessageBubble.tsx: isPremium prop, read receipt color logic
- app/chat/ChatScreen.tsx: isPremium from subscriptionStore passed to MessageBubble
- i18n/en.json: upsell.*, matches.searchPlaceholder added
- i18n/my.json, zh.json, ta.json: same keys mirrored

### Architecture Decisions

- UpsellModal's existing Upgrade Now navigation to PremiumScreen was preserved; only the hide action now reads from subscriptionStore because discoveryStore no longer owns upsell UI state
- FullProfileModal was updated even though it was not listed as a primary Task 54 file because it referenced the removed discovery upsell flag
- MatchesScreen and ChatScreen subscribe to profile premium status for re-rendering, but still compute the gate through subscriptionStore.isPremium()

### Known Issues / Deferred

- rewind() is a no-op for premium users — actual card restoration is Phase 3
- Matches search/filter modal is Phase 3 — only the gate UI is implemented here
- Stripe Customer Portal URL remains a placeholder (Task 52 deferred item)

### Verification

- npx tsc --noEmit passes

### Next Up

- Task 55: Server-Side Daily Likes Enforcement (recordSwipe Cloud Function, Firestore transaction, block client writes to /swipes/)

## [Phase 2B — Task 53] — 2026-05-27

### Completed

- Task 53: Stripe payment sheet fully integrated into PremiumScreen
- useEffect watches pendingClientSecret from subscriptionStore; triggers initPaymentSheet → presentPaymentSheet lifecycle
- Canceled sheet handled silently; non-canceled errors show Alert with retry
- initPaymentSheet failure shows Alert and exits early
- Success modal shown on sheet resolution (slides up from bottom, checkmark icon, feature list, Start Exploring CTA)
- Deep link handler for fitlink://payment-complete covers 3D Secure redirect flows
- LoadingOverlay shown during sheet initialisation phase
- subscription.sheet.*, subscription.success.*, subscription.error.* i18n keys added to all 4 language files

### Files Created / Modified

- app/settings/PremiumScreen.tsx: useStripe hook, two useEffects (pendingClientSecret + deep link), success modal JSX + styles, LoadingOverlay wired
- i18n/en.json: subscription.sheet.loading, subscription.success.*, subscription.error.* added
- i18n/my.json, zh.json, ta.json: same keys mirrored with English placeholders

### Architecture Decisions

- Sheet lifecycle driven by pendingClientSecret state (not beginSubscription return value) — required because useStripe() is a hook and must be called at component top level
- clearPendingClientSecret() called after presentPaymentSheet resolves in all branches — prevents useEffect re-trigger
- profileStore Firestore listener handles premium state propagation — no manual Firestore read after payment
- Success modal appears immediately on sheet resolution; premium feature unlock follows asynchronously via webhook

### Known Issues / Deferred

- Stripe Customer Portal URL remains a placeholder — production portal session requires a Cloud Function (deferred Phase 3)
- Lottie animation in success modal is a static icon placeholder

### Verification

- npx tsc --noEmit passes

### Next Up

- Task 54: Premium Feature Gates (replace all subscription.tier checks with isPremium(), wire upsell reasons, read receipts, unlimited likes)

## [Phase 2B — Post-Task 52 Fix] — 2026-05-27

### Completed

- Fixed Profile tab crash when older or partial user profile documents did not include the Phase 2 `premium` object
- User profile Firestore reads now normalize server-managed fields at the service boundary before screens and stores consume them
- Legacy Phase 1 `subscription` and `verified` fields are mapped to Phase 2 `premium` and `photoVerified` client shapes

### Files Created / Modified

- services/firebase/firestore.ts: added user profile normalization for `premium`, legacy `subscription`, `stats`, `photoVerified`, legacy `verified`, `paused`, and `banned`

### Architecture Decisions

- No client-side Firestore backfill was added because premium, stats, verification, and ban fields are server-managed
- Normalization happens only on read, preserving security rules that block client writes to server-controlled fields

### Verification

- npx tsc --noEmit passes

### Next Up

- Task 53: Stripe Payment Sheet Integration (add useEffect to PremiumScreen watching pendingClientSecret, initPaymentSheet, presentPaymentSheet, success modal, deep link return)

## [Phase 2B — Task 52] — 2026-05-27

### Completed

- Task 52: Premium Screen UI and PremiumBadge component implemented
- PremiumBadge: named export, plus (blue) and pro (gold) variants, sm/md sizes
- PremiumScreen: free-user plan selector (tier + interval), plan cards with feature lists, subscribe button, existing-premium status view, manage subscription link
- RootNavigator: Premium screen registered in stack and RootStackParamList
- UpsellModal: "Upgrade Now" CTA wired to navigate to Premium (Phase 1 deferred resolved)

### Files Created / Modified

- components/ui/PremiumBadge.tsx: created — PremiumBadge named export, plus/pro/sm/md variants
- app/settings/PremiumScreen.tsx: created — full premium upsell UI, free and premium-user views
- app/navigation/RootNavigator.tsx: Premium added to RootStackParamList and stack
- components/discovery/UpsellModal.tsx: Upgrade Now handler wired to navigation
- i18n/en.json: subscription.* keys expanded (hero, interval, tier, features, legal, activePlan, error)
- i18n/my.json, zh.json, ta.json: new keys mirrored with English placeholders

### Architecture Decisions

- No Stripe sheet code in PremiumScreen — Task 53 adds useEffect watching pendingClientSecret
- PremiumScreen calls beginSubscription() only; sheet lifecycle deferred to Task 53
- expo-linear-gradient not used — solid colors from constants/colors.ts approximate gradients
- useNavigation() hook used in UpsellModal to avoid prop drilling

### Known Issues / Deferred

- Stripe payment sheet not yet wired — PremiumScreen subscribe button calls beginSubscription() but sheet presentation is Task 53
- Stripe Customer Portal URL is a placeholder — production URL requires a Cloud Function that returns a portal session URL (deferred to Phase 3)
- Lottie animation in hero section is a placeholder (static icon) — upgrade to Lottie in Phase 3

### Next Up

- Task 53: Stripe Payment Sheet Integration (add useEffect to PremiumScreen watching pendingClientSecret, initPaymentSheet, presentPaymentSheet, success modal, deep link return)

## [Phase 2B — Task 51] — 2026-05-27

### Completed

- Task 51: Subscription store and Stripe service layer implemented
- services/stripe.ts: getCurrency, getStripePrices, createSubscription, getPrice — all 6 SEA currencies, prices from env vars
- store/subscriptionStore.ts: selectedTier/interval UI state, beginSubscription() stores clientSecret in state, isPremium() derives from profileStore
- profileStore/authStore: live user profile listener wired so stripeWebhook premium updates reach client state

### Files Created / Modified

- services/stripe.ts: created — hardcoded pricing table for MYR/SGD/THB/PHP/IDR/VND, Cloud Function caller
- store/subscriptionStore.ts: created — purchase flow state machine, isPremium() gate
- types/subscription.ts: StripePrice.amountDisplay field added
- i18n/en.json: subscription.* keys added
- i18n/my.json, zh.json, ta.json: subscription.* keys mirrored with English placeholders
- .env.example: 6 EXPO_PUBLIC_STRIPE_PRICE_* keys appended
- services/firebase/firestore.ts, store/profileStore.ts, store/authStore.ts: profile subscription support added

### Architecture Decisions

- clientSecret surfaced via pendingClientSecret state (not function return) — required because useStripe() hook must be called from PremiumScreen component, not from the store
- isPremium() reads profileStore.profile.premium directly — no duplication of premium state in subscriptionStore, with profileStore listening to users/{uid} for webhook updates
- PRICING_TABLE hardcoded per PRD 5.12 — no Stripe API call to fetch prices
- Price IDs in EXPO_PUBLIC_ env vars — public Stripe identifiers, not secrets
- No persist on subscriptionStore — selectedTier/selectedInterval are ephemeral UI state

### Known Issues / Deferred

- restorePurchases() is a stub with TODO Phase 3 comment
- EXPO_PUBLIC_STRIPE_PRICE_* in .env.example are empty placeholders — developer populates from Stripe Dashboard before testing PremiumScreen (Tasks 52/53)

### Next Up

- Task 52: Premium Screen UI (app/settings/PremiumScreen.tsx, components/ui/PremiumBadge.tsx)

## [Phase 2B — Task 50] — 2026-05-26

### Completed

- Task 50: Stripe Cloud Functions implemented
- createStripeCheckout: 2nd gen callable function, creates Stripe subscription, returns clientSecret
- stripeWebhook: 2nd gen HTTP function, verifies Stripe signature, handles subscription lifecycle events
- stripe npm package installed in functions/
- functions/.env.example updated with all 8 Stripe env var keys

### Files Created / Modified

- functions/src/createStripeCheckout.ts: created — onCall function, price allowlist validation, get/create Stripe customer, create subscription, return clientSecret
- functions/src/stripeWebhook.ts: created — onRequest function, signature verification via req.rawBody, handles created/updated/deleted subscription events
- functions/src/onUserCreated.ts: server-managed default premium/status fields added for new users
- functions/src/index.ts: two new exports added
- functions/package.json: stripe added to dependencies
- functions/.env.example: 8 Stripe env var key placeholders added
- services/firebase/firestore.ts: removed client-side initialization of server-managed premium/status fields
- firestore.rules: user create/update rules now block premium, stripeCustomerId, photo verification, and legacy subscription fields from client writes
- BUILD.md: emulator command for Functions + Firestore documented

### Architecture Decisions

- getTierFromPriceId compares against env var values, not string patterns — price IDs are opaque
- findUserByCustomerId uses a Firestore query (not a cache) — ensures correctness over performance for low-frequency webhook events
- Both files guard admin.initializeApp() with apps.length check — safe for multi-function bundle
- Stripe Secret Manager values are declared in each v2 function's `secrets` option so production secrets are available only to the functions that need them
- New user premium defaults are initialized server-side in onUserCreated; clients cannot create or mutate premium status fields
- stripeWebhook acknowledges unknown event types with HTTP 200 to prevent Stripe retry storms

### Known Issues / Deferred

- Stripe webhook URL must be registered in Stripe Dashboard after first Functions deployment (documented in BUILD.md)
- functions/.env must be populated with real Stripe test keys before emulator testing

### Next Up

- Task 51: Subscription Store (store/subscriptionStore.ts, services/stripe.ts)

## [Phase 2A — Task 49] — 2026-05-25

### Completed

- Task 49: EAS build configuration complete
- eas.json: development, preview, production build profiles created
- app.json: bundle identifiers set (com.fitlink.app iOS + Android), version 1.0.0, buildNumber 1, versionCode 1
- BUILD.md: full replacement — prerequisites, env vars table, build/submit commands, Stripe webhook setup, Strava OAuth docs, emulator commands, version bump checklist
- .gitignore: google-play-key.json and .eas/ added

### Files Created / Modified

- eas.json: created — three build profiles, submit configuration with placeholder Apple credentials
- app.json: ios.bundleIdentifier, ios.buildNumber, android.package, android.versionCode, expo.version added
- BUILD.md: full replacement with comprehensive build reference
- .gitignore: two new entries

### Architecture Decisions

- eas.json committed to git — contains no secrets; all secret values use eas secret:create
- autoIncrement only on production profile — development and preview builds don't consume build numbers
- google-play-key.json gitignored — service account private key, never committed
- Bundle ID com.fitlink.app used in both platforms for consistency

### Known Issues / Deferred

- eas.json submit block has placeholder Apple credentials — developer fills in before first production submission
- google-play-key.json not yet created — developer downloads from Google Play Console before first Android submission

### Next Up

- Task 50: Stripe Cloud Functions (createStripeCheckout, stripeWebhook)

## [Phase 2A — Task 48] — 2026-05-25

### Completed

- Task 48: Phase 2 dependencies installed, StripeProvider wired in App.tsx
- Installed: @stripe/stripe-react-native, expo-camera, expo-linking, expo-web-browser,
  expo-auth-session, expo-crypto, @invertase/react-native-apple-authentication
- app.json: Stripe and camera plugins added, Apple Sign-In entitlement configured, scheme "fitlink" confirmed
- App.tsx: StripeProvider wraps NavigationContainer with publishable key from env
- BUILD.md: created with build commands, feature requirements, Stripe webhook setup

### Files Created / Modified

- package.json: seven new Phase 2 dependencies added
- app.json: @stripe/stripe-react-native and expo-camera plugins added; Apple Sign-In entitlement configured for @invertase/react-native-apple-authentication; scheme: "fitlink" confirmed
- App.tsx: StripeProvider imported and added to provider tree
- .env.example: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY placeholder added
- BUILD.md: created — build commands, development-build-only feature list, Stripe webhook and Strava redirect URI docs

### Architecture Decisions

- StripeProvider placed inside SafeAreaProvider but outside NavigationContainer — available
  to all screens without needing navigation context
- publishableKey falls back to empty string if env not populated — logs a Stripe warning
  but does not crash; acceptable for development before .env is configured
- @invertase/react-native-apple-authentication does not ship an Expo config plugin; iOS
  capability is configured through `ios.entitlements` instead so Expo config evaluation
  remains valid

### Known Issues / Deferred

- None — this is a pure installation task, no runtime behaviour changes

### Next Up

- Task 49: EAS Build configuration (eas.json, app.json bundle identifiers, BUILD.md commands)

## [Phase 2A — Task 47] — 2026-05-25

### Completed

- Task 47: TypeScript types updated for Phase 2 schema
- types/user.ts: `verified` → `photoVerified`, `subscription` → `premium: PremiumStatus`, added `verifiedAt?`, `stripeCustomerId?`, `fitnessTracking?: FitnessTracking`
- types/subscription.ts: full rewrite — added PremiumTier, PremiumStatus, StripePrice, FitnessTrackingSource, WorkoutSession, TodayStats, FitnessSourceConnection, StravaConnection, FitnessTracking
- All references to `user.verified` / `profile.verified` migrated to `photoVerified`
- All references to `subscription.tier === 'premium'` migrated to `premium.active === true`
- createUserProfile() updated to write `premium` and `photoVerified` fields
- Step6Screen and EditProfileScreen updated to include `preferences.lookingFor` required by the Phase 2 user preferences type

### Files Created / Modified

- types/user.ts: schema updated per Phase 2 spec
- types/subscription.ts: full rewrite with Phase 2 premium + fitness types
- store/discoveryStore.ts: premium gate migrated
- store/profileStore.ts: server-controlled premium and verification fields excluded from profile edits
- services/firebase/firestore.ts: createUserProfile() initial write updated
- components/discovery/SwipeCard.tsx: verified → photoVerified
- components/discovery/FullProfileModal.tsx: verified → photoVerified
- components/chat/MatchCard.tsx: verified → photoVerified
- app/discovery/DiscoveryScreen.tsx: premium gate migrated
- app/profile/ProfileScreen.tsx: verified + subscription migrated
- app/profile/EditProfileScreen.tsx: preferences payload updated for Phase 2 type shape
- app/settings/SettingsScreen.tsx: subscription display migrated
- app/onboarding/Step6Screen.tsx: createUserProfile() preferences payload updated for Phase 2 type shape

### Architecture Decisions

- PremiumStatus is the single source of truth for all premium gates — tier is display-only
- FitnessTracking is optional on UserProfile — Phase 1 users have no fitness data
- StravaConnection.refreshToken is a server-only encrypted field — client never reads it

### Known Issues / Deferred

- None — this task is purely types and migration, no new runtime behaviour
- functions/src/getDiscoveryStack.ts still reads candidate.subscription.tier and candidate.verified — not migrated here per task scope; will be resolved when Cloud Functions are rewritten in Tasks 50 and 55.

### Next Up

- Task 48: Install Phase 2 dependencies (Stripe, expo-camera, expo-auth-session, etc.)

## [Phase 1F — Task 46] — 2026-05-24

### Completed

- Task 46: Final app wiring audit — Phase 1 MVP complete
- App.tsx provider order confirmed and fixed where needed
- SplashScreen.hideAsync() wired correctly to onAuthStateChanged first fire
- i18n and Firebase config import order verified
- GestureHandlerRootView confirmed to appear only once (App.tsx)
- useNotifications and useLastActive confirmed inside AppRoot only
- ErrorBoundary confirmed as class component wrapping NavigationContainer
- npx tsc --noEmit passes with zero errors
- Zero `any` usage across all client-side files
- Zero console.log in app/, components/, store/, hooks/, services/, utils/
- Zero relative imports — all use @/ alias
- Zero inline styles in JSX (except GestureHandlerRootView in App.tsx)
- Zero hardcoded user-visible strings — all through t()
- Toast singleton confirmed rendering in AppRoot
- Navigation types confirmed across all screens
- firestore.rules and firestore.indexes.json confirmed complete

### Files Created / Modified

- App.tsx: fixed provider order, moved navigationRef to module scope, added Firebase/i18n side-effect imports, added splash preventAutoHideAsync, rendered Toast from AppRoot
- store/authStore.ts: added SplashScreen.hideAsync after first auth state resolution and profile fetch completion
- i18n/index.ts: forced synchronous i18next initialisation and disabled React suspense
- components/ui/ErrorBoundary.tsx: kept class boundary, moved fallback text to i18n, reset button labelled Restart App
- components/discovery/PhotoViewer.tsx: removed extra GestureHandlerRootView
- hooks/useLastActive.ts: removed console.log from heartbeat error path
- app/profile/ProfileScreen.tsx: removed Phase 2 stub console.log calls
- i18n/en.json, i18n/my.json, i18n/zh.json, i18n/ta.json: added ui.restartApp key
- package.json, package-lock.json: added Expo-compatible expo-splash-screen dependency

### Architecture Decisions

- SplashScreen hides inside onAuthStateChanged callback — guarantees no flash of wrong screen
- ErrorBoundary outside NavigationContainer — catches navigation-level errors
- Toast singleton uses Zustand module-level helper pattern — avoids context threading through navigator

### Known Issues / Deferred

- Background silent push for lastActive update — deferred to Phase 2
- Crashlytics integration (replace console.error in ErrorBoundary) — deferred to Phase 2
- "Upgrade Now" CTA in UpsellModal — stub, wired to Stripe in Phase 2

### Phase 1 MVP Status

✅ COMPLETE — All 46 tasks done. Ready for TestFlight + Android internal testing beta.

### Next Up

- Generate TASKS_PHASE2.md (premium/subscriptions, photo verification, fitness integrations)
- EAS Build configuration for TestFlight submission

## [Phase 1F — Task 45] — 2026-05-24

### Completed

- Task 45: lastActive heartbeat — useLastActive hook wired into AppRoot
- Writes serverTimestamp() to /users/{uid}.lastActive on app foreground and every 5 minutes
- Final write on background/inactive, interval restarted on return to foreground
- Auth guard prevents writes for unauthenticated sessions
- AppState subscription and interval ref cleaned up on unmount / auth change

### Files Created / Modified

- hooks/useLastActive.ts: AppState listener, setInterval heartbeat, updateDoc serverTimestamp, silent error handling
- App.tsx: useLastActive() called inside AppRoot alongside useNotifications()

### Architecture Decisions

- Direct updateDoc to Firestore — bypasses profileStore.updateProfile() to avoid loading state pollution
- serverTimestamp() enforced — no client Date objects
- Interval restarts with immediate write on foreground — prevents stale lastActive after long backgrounds
- AppState.addEventListener subscription object stored in ref, .remove() called on cleanup

### Known Issues / Deferred

- Background fetch / silent push to trigger lastActive update when app is fully quit — deferred to Phase 2
- lastActive write on app quit (not just background) not guaranteed on iOS — OS may kill app before write completes; acceptable for Phase 1

### Next Up

- Task 46: Final app wiring audit (App.tsx provider order, tsc --noEmit, hardcoded string grep, splash screen)

## [Phase 1F — Post-Task 44 Fixes] — 2026-05-23

### Completed

- Fixed Expo Go / iOS Code Scanner biometric loop by treating Expo Go as unsupported for biometric auth
- Added expo-local-authentication config plugin with Face ID permission for dev builds and standalone builds
- BiometricPromptScreen now disables local biometric preference and proceeds when biometrics are unavailable in the current runtime
- Fixed existing email-account login routing to wait for Firestore profile lookup before deciding onboarding vs main app
- profileStore.fetchProfile() now returns UserProfile | null so authStore can set hasCompletedOnboarding from profile doc existence

### Files Created / Modified

- app.json: expo-local-authentication plugin and faceIDPermission added
- hooks/useBiometric.ts: Expo Go runtime detection, unavailable-error helper, support check guard
- app/auth/BiometricPromptScreen.tsx: unsupported-runtime and unavailable-auth skip handling
- store/authStore.ts: auth listener waits for fetchProfile() and sets hasCompletedOnboarding from profile existence
- store/profileStore.ts: fetchProfile() returns loaded profile or null

### Verification

- npx tsc --noEmit passes
- app.json parses successfully

## [Phase 1F — Task 44] — 2026-05-23

### Completed

- Task 44: Daily like limit enforcement — free users capped at 50 likes/day
- getDailyLikesDoc() reads, resets, and creates the dailyLikes subcollection doc
- incrementDailyLikes() increments count after a successful swipeRight
- swipeRight() checks cap before writing like; blocks and shows upsell if at limit
- swipeSuperLike() gates non-premium users behind upsell modal
- UpsellModal component created — informational Phase 1 stub, "Upgrade Now" shows toast
- DiscoveryScreen mounts UpsellModal driven by discoveryStore.isUpsellVisible

### Files Created / Modified

- services/firebase/firestore.ts: getDailyLikesDoc, incrementDailyLikes added
- store/discoveryStore.ts: isUpsellVisible state, showUpsell/hideUpsell actions, swipeRight and swipeSuperLike rewritten with limit enforcement
- components/discovery/UpsellModal.tsx: modal with reason prop, benefits list, stub upgrade CTA
- app/discovery/DiscoveryScreen.tsx: UpsellModal mounted, wired to store
- i18n/en.json, my.json, zh.json, ta.json: discovery.limit.* keys added

### Architecture Decisions

- Daily likes doc stored at users/{userId}/dailyLikes/doc (single-doc subcollection pattern)
- Reset logic uses local midnight comparison — resets at local midnight as spec'd
- No FieldValue.increment client-side — read-then-write pattern; race condition safe for Phase 1
- Premium check reads from profileStore.profile.subscription.tier
- Upsell reason fixed to 'likes' in DiscoveryScreen for Phase 1 simplicity

### Known Issues / Deferred

- Server-side cap enforcement (Cloud Function transaction) deferred to Phase 2
- Upsell reason differentiation (likes vs superLike headline) deferred to Phase 2
- "Upgrade Now" CTA is a stub — Stripe PremiumScreen navigation deferred to Phase 2

### Next Up

- Task 45: lastActive heartbeat (useLastActive hook, AppState listener, 5-min interval)

## [Phase 1F — Task 43] — 2026-05-23

### Completed

- Task 43: Biometric authentication — useBiometric hook, BiometricPromptScreen, RootNavigator gate
- One-time enable/skip Alert shown after first successful login (AsyncStorage flag)
- Cold-start gate: BiometricPromptScreen shown when isAuthenticated + biometricEnabled + !biometricVerified
- biometricVerified excluded from Zustand persist — resets on every cold start by design
- Device without biometric support (simulator, unenrolled) skips silently via setBiometricVerified(true)
- "Use Password" fallback calls logout() and routes user back to AuthNavigator

### Files Created / Modified

- hooks/useBiometric.ts: checkBiometricSupport, getBiometricEnabled, setBiometricEnabled, getBiometricPromptShown, markBiometricPromptShown, authenticateWithBiometric, useBiometric hook
- app/auth/BiometricPromptScreen.tsx: full-screen gate, auto-triggers on mount, fail state with retry + fallback
- app/navigation/RootNavigator.tsx: BiometricPrompt added to stack, biometricReady guard, one-time Alert, routing logic updated
- store/authStore.ts: biometricVerified state + setBiometricVerified action added, excluded from persist
- i18n/en.json, my.json, zh.json, ta.json: biometric.* keys added

### Architecture Decisions

- biometricVerified not persisted — intentional cold-start re-verification gate
- disableDeviceFallback: true — full control over "Use Password" UX, no OS PIN fallback
- gestureEnabled: false on BiometricPrompt screen — prevents swipe-back bypass
- Alert.alert for enable/skip prompt — custom modal deferred to Phase 2
- No Firestore writes — biometric preference is device-local only (AsyncStorage)

### Known Issues / Deferred

- Custom enable/skip modal UI (replace Alert) deferred to Phase 2
- Biometric lockout state (too many failures, hardware disabled) not specially handled — falls through to hasFailed state
- Android-specific biometric type display (fingerprint vs face) not differentiated in UI — generic icon used

### Next Up

- Task 44: Daily like limit enforcement (discoveryStore + firestore dailyLikes doc)

## [Phase 1F — Task 42] — 2026-05-23

### Completed

- Task 42: Push notification registration and deep link handling
- registerForPushNotifications() saves expoPushToken to Firestore on first auth + onboarding completion
- unregisterPushNotifications() nulls token on logout (prevents post-logout push delivery)
- useNotifications() hook wires foreground toast display and tap-to-navigate deep links
- App.tsx refactored with AppRoot inner component to satisfy hook-above-navigator constraint
- NavigationContainerRef passed into useNotifications for imperative navigation on notification tap
- Cold-start (quit state) notification response handled via getLastNotificationResponseAsync

### Files Created / Modified

- services/notifications.ts: extended with registerForPushNotifications, unregisterPushNotifications, setNotificationHandler at module scope
- hooks/useNotifications.ts: registration effect, foreground listener, response listener, cold-start handler
- App.tsx: AppRoot inner component, navigationRef, useNotifications() call
- app/navigation/RootNavigator.tsx: root main route renamed to MainTabs for notification deep links
- store/authStore.ts: unregisterPushNotifications() call added to logout()
- i18n/en.json, my.json, zh.json, ta.json: notifications.* keys added

### Architecture Decisions

- useNotifications receives navigationRef param (not useNavigation hook) — hook called above navigator provider scope
- setNotificationHandler at module scope in notifications.ts — registered before any notification arrives
- Physical device check via expo-constants Constants.isDevice — simulator runs skip silently
- setTimeout delays (100ms/500ms) for deep link navigation timing — pragmatic for Phase 1
- expoPushToken nulled on logout before Firebase sign-out via client Firestore update — prevents ghost notifications post sign-out
- Existing Settings notification toggle kept compatible with registerForPushNotifications() no-argument permission helper overload

### Known Issues / Deferred

- Granular notification preference toggles (matches vs messages) stored in AsyncStorage (Task 38) are not yet wired to suppress specific notification types client-side — Cloud Function sends all; client-side filtering deferred to Phase 2
- Notification badge count reset on app open deferred to Phase 2
- Background fetch / background notification handling (iOS background modes) deferred to Phase 2

### Next Up

- Task 43: Biometric authentication (useBiometric hook, BiometricPrompt screen)

## [Phase 1F — Task 41] — 2026-05-23

### Completed

- Task 41: LoadingOverlay, ErrorBoundary, and Toast global UI utilities built
- toastStore singleton — showToast() callable from stores and services without prop-drilling
- Toast auto-dismisses after 3s, slide-in from top, success/error/info variants
- LoadingOverlay uses Modal for reliable cross-navigator overlay on iOS + Android
- ErrorBoundary class component wraps entire app in App.tsx — catches all render errors
- App.tsx updated with correct nesting: ErrorBoundary > GestureHandlerRootView > SafeAreaProvider > Toast + NavigationContainer

### Files Created / Modified

- store/toastStore.ts: Zustand toast state + showToast() imperative singleton export
- components/ui/Toast.tsx: animated toast renderer, Animated.timing slide-in, 3s auto-dismiss, timer reset on rapid calls
- components/ui/LoadingOverlay.tsx: Modal-based full-screen overlay, ActivityIndicator, optional message
- components/ui/ErrorBoundary.tsx: class component, getDerivedStateFromError + componentDidCatch, __DEV__ error detail guard
- App.tsx: ErrorBoundary outermost, Toast inside SafeAreaProvider above NavigationContainer
- i18n/en.json, my.json, zh.json, ta.json: ui.* keys added

### Architecture Decisions

- showToast() is a plain function (useToastStore.getState().showToast) — not a hook — so services and catch blocks can call it without React context
- Toast uses React Native Animated (not Reanimated) — no gesture involvement, worklet overhead unwarranted
- LoadingOverlay uses Modal not absolute position — reliable above all nested navigators
- ErrorBoundary hardcodes English — class component cannot use useTranslation(); acceptable for last-resort fallback
- __DEV__ guard prevents raw error messages leaking to production users

### Known Issues / Deferred

- ErrorBoundary does not call Crashlytics yet — console.error placeholder, Crashlytics integration deferred to Phase 2
- Toast does not support action buttons (e.g., "Retry") — deferred to Phase 2 if needed
- LoadingOverlay progress percentage prop not added — binary visible/hidden for Phase 1

### Next Up

- Task 42: Push notification registration (services/notifications.ts, hooks/useNotifications.ts, deep link handling)

## [Phase 1F — Task 40] — 2026-05-22

### Completed

- Task 40: Firestore composite indexes defined for all Phase 1 collection queries
- Users discovery index: location.city + banned + paused + lastActive DESC (critical for getDiscoveryStack performance)
- Matches index: users ARRAY_CONTAINS + lastMessageAt DESC (powers matchStore real-time listener)
- Reports index: reportedUserId + reportedAt ASC (powers checkReportThreshold range query)
- Likes subcollection field override: createdAt ASC + DESC, COLLECTION_GROUP scope

### Files Created / Modified

- firestore.indexes.json: replaced stub with 3 composite indexes + 1 field override

### Architecture Decisions

- Nested field path `location.city` confirmed valid in Firestore index fieldPath — no flattening needed
- Boolean equality filters (banned, paused) placed before orderBy field (lastActive) per Firestore composite index ordering requirements
- COLLECTION_GROUP scope on likes/createdAt future-proofs cross-user swipe queries
- Reports range filter on reportedAt placed last in index per Firestore range-field rule

### Known Issues / Deferred

- Index build time in production (with real user data) may be 10–30+ minutes — monitor in Firebase Console before going live
- RTDB indexes (chat message ordering) are not Firestore indexes and are not in scope here

### Next Up

- Task 41: LoadingOverlay, ErrorBoundary, Toast components (UI polish)

## [Phase 1F — Task 39B] — 2026-05-22

### Completed

- Task 39B: Remediated all client writes to /matches/{matchId} exposed by Task 39 rules
- unmatchUser Cloud Function created — bilateral unmatch, RTDB cleanup, blocked entries, stats decrement
- matchStore.unmatch() now calls httpsCallable('unmatchUser') — no direct deleteDoc
- deleteMatch() removed from services/firebase/firestore.ts
- firestore.rules /matches update rule relaxed to allow participant chat metadata writes only (lastMessage, lastMessageAt, {uid}_unread)
- firestore.rules /blocked collection added (deny all client access)

### Files Created / Modified

- functions/src/unmatchUser.ts: new callable Cloud Function
- functions/src/index.ts: unmatchUser export added
- store/matchStore.ts: unmatch() rewritten to use httpsCallable
- services/firebase/firestore.ts: deleteMatch() removed
- firestore.rules: /matches update rule scoped to hasOnly([...]), /blocked rule added

### Architecture Decisions

- Chat metadata updates (lastMessage, lastMessageAt, own unread) kept as client writes to avoid Cloud Function latency on every message send
- Dynamic key (request.auth.uid + '_unread') used in hasOnly — prevents cross-user unread tampering
- RTDB cleanup in unmatchUser is best-effort (catch+log) — Firestore match doc is source of truth
- /blocked written exclusively by Admin SDK; client read/write denied at rules level

### Known Issues / Deferred

- Orphaned RTDB chat data if unmatchUser RTDB delete fails — scheduled cleanup Cloud Function deferred to Phase 2
- Match message subcollection cleanup on unmatch deferred to Phase 2 onUserDeleted / scheduled function
- RTDB rules hardening beyond current chat coverage deferred to Phase 2

### Next Up

- Task 40: Firestore indexes (firestore.indexes.json)

## [Phase 1F — Task 39] — 2026-05-22

### Completed

- Task 39: Firestore security rules written for all Phase 1 collections
- Server-only fields (banned, verified, age, stats, verifiedAt, bannedAt, banReason) blocked from client writes via doesNotModifyServerOnlyFields() helper
- paused remains client-writable (Settings toggle)
- /matches/{matchId} fully locked — client create/update/delete denied, Cloud Function Admin SDK bypasses rules
- Daily likes subcollection scoped to document owner only
- Swipes immutable — update and delete permanently blocked
- Reports write-once, read-never for clients
- Default catch-all denies all unmatched collections

### Files Created / Modified

- firestore.rules: full production security rules for all Phase 1 collections
- firebase.json: verified/patched to reference firestore.rules and firestore.indexes.json

### Architecture Decisions

- Deny-list approach for server-only fields (affectedKeys().hasAny([...])) preferred over allow-list to avoid breaking on new field additions
- isMatchParticipant() uses cross-document get() — acceptable for low-frequency match reads, not used in discovery hot path
- RTDB security rules deferred to Phase 2 (chat delivery via RTDB is separate from Firestore rules)
- /matches delete blocked at rules level even though unmatch flow exists — unmatch calls a Cloud Function

### Known Issues / Deferred

- RTDB rules (/chats/{matchId}) not covered by this task — Phase 2
- Admin moderation collections (flags, admin_queue) not yet defined — Phase 2

### Next Up

- Task 40: Firestore indexes (firestore.indexes.json)

## [Phase 1E — Task 38] — 2026-05-22

### Completed

- Task 38: SettingsScreen — 7 sections: account, discovery, notifications, privacy, subscription, support, danger zone
- DeleteAccountScreen — typed DELETE gate, storage + Firestore + Auth deletion chain
- SettingsSection + SettingsRow shared components (navigate / toggle / destructive / info variants)
- Language picker modal — i18n.changeLanguage + profileStore.updateProfile
- Discovery preference modals (age range, distance, gender pref, looking for)
- Notification prefs in AsyncStorage (pushEnabled, newMatches, newMessages)
- deleteAccount() added to services/firebase/auth.ts

### Files Created / Modified

- app/settings/SettingsScreen.tsx: full 7-section settings screen
- app/settings/DeleteAccountScreen.tsx: DELETE confirmation gate, deletion chain
- components/settings/SettingsSection.tsx: section wrapper with optional danger styling
- components/settings/SettingsRow.tsx: navigate / toggle / destructive / info variants
- app/navigation/MainTabNavigator.tsx: Settings tab replaced with SettingsStackNavigator (Settings → DeleteAccount)
- services/firebase/auth.ts: deleteAccount() added (Storage + Firestore + Auth)
- services/notifications.ts: notification permission helper added for Settings toggle
- i18n/en.json, my.json, zh.json, ta.json: settings.* keys added
- i18n/index.ts: `ms` resource alias added for Bahasa Melayu language selection

### Architecture Decisions

- Single `activeModal` string state manages all discovery preference modals — no nested discovery Modals
- Notification prefs stored in AsyncStorage only (device-local, not Firestore)
- deleteAccount() order: Storage (best-effort) → Firestore → Firebase Auth — Auth last to preserve uid access
- Language change applies immediately via i18n.changeLanguage before modal close
- SettingsStack wraps Settings tab so DeleteAccount pushes without dismissing tab bar

### Known Issues / Deferred

- Match/swipe/chat cleanup on account deletion deferred to Phase 2 onUserDeleted Cloud Function
- Photo drag-to-reorder not in scope (Phase 2)
- Subscription management (Stripe portal) is a stub — Phase 2
- Blocked users management is a Phase 1 stub

### Next Up

- Task 39: Firestore security rules

## [Phase 1E — Task 37] — 2026-05-21

### Completed

- Task 37: EditProfileScreen — pre-filled React Hook Form + Zod, photo management, 6 sections, unsaved changes guard, save to profileStore

### Files Created / Modified

- app/profile/EditProfileScreen.tsx: full edit screen with all 6 sections, Zod schema, syncPhotos helper, beforeRemove guard
- i18n/en.json, my.json, zh.json, ta.json: editProfile.* keys added
- app/navigation/MainTabNavigator.tsx: EditProfile route now uses the real EditProfileScreen
- app/onboarding/Step3Screen.tsx: MultiSelect and SingleSelect exported as named exports

### Architecture Decisions

- syncPhotos() uses useProfileStore.getState() outside React render, consistent with authStore/profileStore patterns
- photosDirty local state tracks photo changes separately from React Hook Form isDirty
- DOB and Gender are read-only display rows, not form fields
- Age range sliders use watch() to constrain each other dynamically
- Existing shared Input already supported multiline and numberOfLines, so no Input changes were needed

### Known Issues / Deferred

- Photo upload progress percentage not surfaced — binary isLoading from profileStore
- Drag-to-reorder photos deferred to Phase 2
- Location (city/state) editing not included in Task 37 — requires Google Places autocomplete, deferred to Phase 2

### Next Up

- Task 38: SettingsScreen — account, discovery preferences, notifications, privacy, subscription, danger zone

## [Phase 1E — Task 36] — 2026-05-21

### Completed

- Task 36: ProfileScreen built — hero photo, stats row, read-only photo grid, verification card, bio with read-more, Basic Info / Fitness / Lifestyle InfoCards, action buttons
- ProfileStackNavigator added inside MainTabNavigator Profile tab; EditProfile and Settings stubs ready for Tasks 37 and 38

### Files Created / Modified

- app/profile/ProfileScreen.tsx: full own-profile view (read-only)
- components/profile/StatsBadge.tsx: value + label stat display
- components/profile/InfoCard.tsx: bordered card + InfoRow helper
- components/profile/ActivityChip.tsx: pill chip for activity display
- components/profile/PhotoGrid.tsx: added readOnly prop — empty slots and controls hidden in read-only mode
- app/navigation/MainTabNavigator.tsx: Profile tab replaced with ProfileStackNavigator (Profile → EditProfile stub → Settings stub)
- i18n/en.json, my.json, zh.json, ta.json: profile.* keys completed

### Packages Added

- None — expo-linear-gradient was already installed

### Architecture Decisions

- ProfileScreen is strictly read-only; no form state, no writes
- ProfileStackNavigator wraps Profile tab so edit/settings nav doesn't dismiss tab bar
- Days Active calculated from createdAt.toDate() diff — returns '—' if field missing
- Bio read-more toggle uses local useState<boolean> — explicitly permitted per CONVENTIONS.md §7
- PhotoGrid readOnly prop: hides empty slots and remove controls, preserves Primary badge
- profile.about.title added instead of replacing existing profile.about.* nested keys used by FullProfileModal

### Known Issues / Deferred

- "Verify Now" button is a stub (console.log + TODO) — full verification flow is Phase 2
- "Get Premium" button is a stub — PremiumScreen is Phase 2
- Photo drag-to-reorder deferred to Phase 2
- Profile view count (profile.stats.views) not tracked yet; stats row shows matches + likes + days active only

### Next Up

- Task 37: EditProfileScreen — pre-filled React Hook Form + Zod, photo management, save to profileStore

## [Phase 1E — Task 35] — 2026-05-20

### Completed

- Task 35: profileStore fully implemented — fetchProfile, updateProfile, uploadPhoto, deletePhoto
- Optimistic updates with rollback for updateProfile and deletePhoto
- uploadPhoto: compress → upload → Firestore array write → local state sync
- deletePhoto: Firestore arrayRemove + Storage deleteObject + rollback
- authStore.initialise() now calls profileStore.fetchProfile on login
- authStore.logout() now calls profileStore.reset()
- profile.errors.* i18n keys added to all 4 locale files

### Files Created / Modified

- store/profileStore.ts: full implementation replacing Task 34 stub
- store/authStore.ts: fetchProfile on login, reset on logout wired
- services/firebase/firestore.ts: updateUserProfile typed write helper tightened, removePhotoFromProfile added
- services/firebase/storage.ts: uploadProfilePhoto confirmed, uploadAllProfilePhotos keeps compression, deleteProfilePhoto handles missing objects
- i18n/en.json, my.json, zh.json, ta.json: profile.errors.* keys added

### Architecture Decisions

- profileStore is intentionally non-persisted — always fetched fresh from Firestore on auth
- Circular import handled by calling useProfileStore.getState() lazily inside auth callbacks and actions
- Minimum photo enforcement at store level is 1; form-level EditProfileScreen can enforce 2 separately
- serverTimestamp() included in profileStore writes that update profile documents
- deleteProfilePhoto handles storage/object-not-found silently because an already-deleted file is not fatal
- uploadProfilePhoto now assumes a compressed URI; uploadAllProfilePhotos compresses before calling it to preserve onboarding behavior

### Known Issues / Deferred

- Profile photo reorder (drag-to-reorder) deferred to Phase 2
- Upload progress percentage not surfaced to profileStore UI — isLoading is binary for now; progress bar deferred to Task 37 (EditProfileScreen)

### Next Up

- Task 36: ProfileScreen — own profile view, stats row, verified badge, photo grid, edit/settings navigation

## [Phase 1D — Task 34] — 2026-05-20

### Completed

- Task 34: MatchCelebrationModal — confetti, animated photo pop-in, shared activities badge, Send Message → ChatScreen navigation, Keep Swiping dismiss

### Files Created / Modified

- components/discovery/MatchCelebrationModal.tsx: full celebration modal with Reanimated animation sequence, ConfettiCannon, icebreaker suggestion, queue-draining dismiss pattern
- app/discovery/DiscoveryScreen.tsx: modal wired to matchStore.newMatchIds, pendingMatch resolved, current user profile data passed into modal
- store/matchStore.ts: clearNewMatch(matchId) action added
- store/profileStore.ts: minimal read-only profile hydration added so DiscoveryScreen can pass current user photos and activities; Task 35 still owns full profile store actions
- services/firebase/realtime.ts: duplicate _unread increment removed from client message sends (now Cloud Function only)
- app/navigation/MainTabNavigator.tsx: Matches nested chat params accept optional icebreakerSuggestion
- i18n/*.json: discovery.matchCelebration.* keys added to all four locale files

### Packages Added

- react-native-confetti-cannon

### Architecture Decisions

- One modal at a time: newMatchIds[0] drives render; clearNewMatch shifts queue
- Dismiss animation gate: runOnJS(clearNewMatch) fires only after withTiming completes
- Confetti imperative ref + setTimeout: avoids firing before modal is visible
- currentUserActivities is passed from profileStore.profile.activities; no hardcoded empty activity list remains

### Known Issues / Deferred

- Icebreaker pre-fill in ChatScreen input not yet implemented; the navigation param is passed for future ChatScreen wiring
- Task 35 remains responsible for full profileStore capabilities: updateProfile, uploadPhoto, deletePhoto, and richer loading/error UX

### Next Up

- Task 35: ProfileStore — fetchProfile, updateProfile, uploadPhoto, deletePhoto

## [Phase 1D — Task 33] — 2026-05-19

### Completed

- Task 33: onNewMessage Cloud Function — push notification on new RTDB message

### Files Created / Modified

- functions/src/onNewMessage.ts: RTDB onValueCreated trigger (2nd gen), increments unread count, sends Expo push notification via fetch, validates token format, handles missing tokens gracefully
- functions/src/index.ts: export { onNewMessage } added
- firebase.json: Realtime Database rules configuration added
- database.rules.json: RTDB chat, metadata, and presence rules added for emulator/deploy config

### Architecture Decisions

- Unread increment separated from push send — always runs, push is best-effort
- Expo Push API used (not FCM direct) — correct for Expo-managed workflow
- DeviceNotRegistered cleanup deferred to Phase 2 maintenance function
- fetch used natively (Node 18) — no node-fetch dependency added

### Known Issues / Deferred

- DeviceNotRegistered token cleanup deferred (Phase 2)
- Notification badge count (iOS) not yet set — requires separate unread query
- Push notification delivery for matches (as opposed to messages) handled in Task 34 (match celebration)
- RTDB_INSTANCE must be set in each deployed functions environment
- Client RTDB send helpers currently also increment unread counts; remove that client-side increment when client files are in scope to avoid double counts

### Next Up

- Task 34: MatchCelebrationModal — confetti animation, both user photos, "Send Message" + "Keep Swiping" CTAs

## [Phase 4.4] — 2026-05-19

### Completed

- Task 32: ChatScreen built — real-time messages, MessageBubble, ChatInput, typing indicator, image send
- MessageBubble: sent/received variants, image support, timestamp, read receipts
- ChatInput: multiline auto-grow, image picker delegation to chatStore.sendImage, send button state
- ChatScreen: custom header, inverted FlatList, date separators, icebreaker chips, fullscreen image viewer, unmatch flow
- chat.uploading and other missing chat.* i18n keys added to all 4 language files
- AppState listener for flushOfflineQueue wired in ChatScreen
- Image upload driven by chatStore.sendImage internally — no storage changes in this task

### Files Created / Modified

- components/chat/MessageBubble.tsx: bubble variants, image thumbnail, timestamp, read receipts
- components/chat/ChatInput.tsx: multiline input, image button, send button
- app/chat/ChatScreen.tsx: full conversation screen with all Task 32 features
- app/navigation/MainTabNavigator.tsx: Chat placeholder replaced with ChatScreen
- i18n/en.json, my.json, zh.json, ta.json: chat.* keys completed

### Known Issues / Deferred

- "View Profile" from chat header menu is a stub — deferred to FullProfileModal Phase 2 integration
- "Report User" from chat header is a stub — wired in Task 38
- "Delete Message" from long press is a stub — RTDB delete deferred to Phase 2
- Pinch-to-zoom in fullscreen image viewer deferred to Phase 2
- Proper clipboard library (@react-native-clipboard/clipboard) deferred to Phase 2

### Next Up

- Task 33: Cloud Function onNewMessage (RTDB trigger → Expo push notification on new chat message)

## [Phase 4.3] — 2026-05-18

### Completed

- Task 31: Chat store and Firebase Realtime Database service layer built
- services/firebase/realtime.ts: subscribeToMessages, sendTextMessage, sendImageMessage, markMessagesAsRead, setTypingStatus, subscribeToTyping, registerPresence, setOffline, subscribeToPresence
- store/chatStore.ts: openChat, closeChat, sendMessage, sendImage, onTypingStart, markAsRead, flushOfflineQueue
- RTDBMessage, RTDBPresence, QueuedMessage types defined and exported
- Offline message queue via AsyncStorage (flush on foreground)
- Typing debounce (1 second)
- i18n chat.* namespace added to all 4 language files

### Files Created / Modified

- services/firebase/realtime.ts: full RTDB service layer
- store/chatStore.ts: chat session store with subscriptions, send, upload, queue
- i18n/en.json, my.json, zh.json, ta.json: chat.* keys added

### Known Issues / Deferred

- AppState listener for flushOfflineQueue not yet wired — Task 32 (ChatScreen) calls flushOfflineQueue on foreground
- ChatScreen, MessageBubble, ChatInput not yet built — Task 32
- RTDB security rules not yet set — Phase 2

### Next Up

- Task 32: ChatScreen + MessageBubble + ChatInput (UI layer consuming chatStore)

## [Phase 4.2] — 2026-05-17

### Completed

- Task 30: MatchesScreen built — 2-tab (Matches grid + Messages list), real-time from matchStore
- MatchCard component: photo, name, NEW badge, unread badge, online dot, verified badge, long-press action sheet
- MessageListItem component: avatar with online dot, name, message preview, relative timestamp, unread badge, swipe-to-unmatch
- MatchesNavigator (Stack) created to wrap MatchesScreen + Chat placeholder
- MainTabNavigator Matches tab wired to MatchesNavigator
- i18n matches.* keys confirmed / extended in all 4 language files

### Files Created / Modified

- components/chat/MatchCard.tsx: grid card component with badges and long-press actions
- components/chat/MessageListItem.tsx: list row with swipe-to-unmatch via PanResponder + Animated
- app/matches/MatchesScreen.tsx: tab switcher, grid, list, empty states, matchStore subscription
- app/navigation/MainTabNavigator.tsx: MatchesNavigator (stack) added, Chat placeholder registered
- i18n/en.json, my.json, zh.json, ta.json: matches.* keys confirmed / added

### Known Issues / Deferred

- Navigation to Chat uses placeholder screen — real ChatScreen built in Task 32
- "View Profile" in long-press action sheet is a no-op stub — wired when FullProfileModal accepts external trigger
- "Report" in long-press action sheet is a no-op stub — reporting service wired in Task 38

### Next Up

- Task 31: Chat Store (chatStore.ts, services/firebase/realtime.ts — RTDB subscription, send message, offline queue)

## [Phase 4.1] — 2026-05-17

### Completed

- Task 29: matchStore built — real-time Firestore listener, MatchWithProfile resolution, unmatch, markAsRead
- subscribeToMatches, deleteMatch, resetUnreadCount added to services/firebase/firestore.ts
- getUserProfile added to firestore.ts
- newMatchIds first-load suppression implemented
- i18n matches.* keys added to all 4 language files

### Files Created / Modified

- store/matchStore.ts: full match store, listener management, optimistic unmatch, unread reset
- services/firebase/firestore.ts: subscribeToMatches, deleteMatch, resetUnreadCount, getUserProfile added
- types/match.ts: id field and MatchWithProfile confirmed present; nullable lastMessage fields aligned with Cloud Function output
- i18n/en.json, my.json, zh.json, ta.json: matches.* namespace added

### Known Issues / Deferred

- subscribeToMatches not yet called from RootNavigator or hook — wired in Task 30 (MatchesScreen)
- unsubscribeFromMatches not yet called on sign-out — wired in Task 38 (SettingsScreen logout flow)
- MatchCelebrationModal (Task 34) reads newMatchIds — not yet built

### Next Up

- Task 30: MatchesScreen (grid + messages tabs, MatchCard, MessageListItem, real-time from matchStore)

## [Phase 3.7] — 2026-05-17

### Completed

- Task 28: FullProfileModal built — scrollable profile, photo carousel, shared interest highlights, action bar
- PhotoViewer component created — pinch-to-zoom, swipe-down to dismiss
- ProfileSection reusable section wrapper created
- ActivityBadge extended with 'shared' variant (highlighted shared activities)
- DiscoveryScreen handleInfo stub replaced with real modal wiring
- Report category sheet implemented (Firestore write stubbed, TODO Task 38)
- i18n profile.* keys added to all 4 language files

### Files Created / Modified

- components/discovery/FullProfileModal.tsx: full scrollable modal, photo carousel, sections, action bar, report sheet
- components/discovery/PhotoViewer.tsx: fullscreen viewer, pinch-to-zoom, swipe-down dismiss
- components/profile/ProfileSection.tsx: reusable titled section wrapper
- components/discovery/ActivityBadge.tsx: 'shared' variant added
- app/discovery/DiscoveryScreen.tsx: handleInfo stub replaced, FullProfileModal wired with modalProfile state
- i18n/en.json, my.json, zh.json, ta.json: profile.* namespace added

### Known Issues / Deferred

- Report Firestore write (addDoc to /reports) deferred to Task 38 (SettingsScreen reporting service)
- Distance display (X km away) shows city name only — geo-distance calculation deferred to Phase 2
- Pinch-to-zoom on card photos inside SwipeCard still not implemented — interaction model differs from modal
- Discovery currently passes `viewerProfile={null}` because `store/profileStore.ts` is not present in this repo state; shared-interest rendering is ready for callers that provide the viewer profile.

### Next Up

- Task 29: Match Store (Firestore real-time listener on /matches, MatchWithProfile type resolution, unmatch action)

## [Phase 3.6] — 2026-05-17

### Completed

- Task 27: DiscoveryScreen built — card stack orchestration, z-ordered rendering, gesture isolation
- ActionButtons component: 5 buttons, haptics, premium lock badge, disabled state
- EmptyState component: icon, copy, Refresh and Edit Preferences CTAs
- UpsellModal stub: trigger-aware headline, benefits list, Coming Soon alert on upgrade tap
- dailyLimitReached flag added to discoveryStore
- i18n keys added: discovery.empty.* and discovery.upsell.*
- MainTabNavigator Discover tab wired to real DiscoveryScreen

### Files Created / Modified

- components/discovery/ActionButtons.tsx: 5 action buttons, haptics, premium gate lock badge
- components/discovery/EmptyState.tsx: empty stack view with refresh CTA
- components/discovery/UpsellModal.tsx: presentational paywall stub, 3 trigger types
- app/discovery/DiscoveryScreen.tsx: card stack, swipe handlers, auto-refetch, upsell integration
- store/discoveryStore.ts: dailyLimitReached boolean added and swipe advancement ownership moved to DiscoveryScreen
- i18n/en.json, my.json, zh.json, ta.json: discovery.empty.* and discovery.upsell.* keys added
- app/navigation/MainTabNavigator.tsx: Discover tab placeholder replaced with DiscoveryScreen

### Known Issues / Deferred

- FullProfileModal (Task 28) not yet built — onTapInfo shows Alert stub with TODO comment
- Rewind action is no-op even for premium users — full undo stack deferred to Phase 2
- Edit Preferences button in EmptyState calls no-op stub — wired in Task 38 (SettingsScreen)
- UpsellModal onUpgrade shows Coming Soon alert only — Phase 2 wires to PremiumScreen
- Premium subscription state is not yet exposed by authStore/profileStore in this repo state, so DiscoveryScreen currently treats users as free tier until that store source exists

### Next Up

- Task 28: FullProfileModal (scrollable profile view, shared-interest highlights, photo fullscreen, like/pass/super like from modal)

## [Phase 3.5] — 2026-05-16

### Completed

- Task 26: SwipeCard component built (Reanimated 3, Gesture.Pan(), 60fps)
- ActivityBadge chip component created
- SwipeLabel overlay component created (LIKE/NOPE/SUPER, SharedValue-driven opacity)
- expo-linear-gradient installed and gradient overlay implemented
- Photo carousel with left/centre/right tap zones
- Haptics wired per swipe direction

### Files Created / Modified

- components/discovery/SwipeCard.tsx: full swipe card with gesture, animation, exit, layout
- components/discovery/SwipeLabel.tsx: LIKE/NOPE/SUPER labels driven by SharedValue opacity
- components/discovery/ActivityBadge.tsx: pill chip for activity and fitness level display
- package.json, package-lock.json: expo-linear-gradient installed
- i18n/en.json, my.json, zh.json, ta.json: discovery.swipe.* and activeNow/activeHoursAgo/activeDaysAgo keys added

### Known Issues / Deferred

- Actual GPS distance from viewer not shown — deferred to Phase 2; city name and lastActive shown instead
- Pinch-to-zoom on card photo deferred to FullProfileModal (Task 28)
- "Active today" badge from fitness tracker data deferred to Phase 2 (Strava/Health integration)

### Next Up

- Task 27: DiscoveryScreen (renders card stack, wires ActionButtons to discoveryStore, empty state, upsell modal stub)

## [Phase 3.4] — 2026-05-16

### Completed

- Task 25: Discovery Zustand store implemented (discoveryStore.ts)
- fetchStack calls getDiscoveryStack callable, resolves IDs to UserProfile objects
- swipeRight/swipeLeft/swipeSuperLike write to Firestore swipe subcollections
- Daily like limit enforced for free users (50 likes/day, reset at midnight)
- Auto-refetch signal (isRefetching) fires when stack drops to <= 3 cards
- getDailyLikesDoc and incrementDailyLikes added to services/firebase/firestore.ts

### Files Created / Modified

- store/discoveryStore.ts: full discovery store with all swipe actions and limit logic
- services/firebase/firestore.ts: getDailyLikesDoc, incrementDailyLikes added
- i18n/en.json, my.json, zh.json, ta.json: discovery.* keys added/confirmed

### Known Issues / Deferred

- advanceStack sets isRefetching:true as a signal; DiscoveryScreen (Task 27) must observe this flag and call fetchStack(userId) itself; the store does not auto-call fetchStack to avoid auth coupling
- Distance-based filtering still deferred (same as Task 23 note); city-level only in Phase 1
- score field still present in getDiscoveryStack response; strip before production

### Next Up

- Task 26: SwipeCard component (Reanimated 3, Gesture.Pan(), 60fps, LIKE/NOPE/SUPER labels, photo pagination dots)

## Format

```
## [Phase X.Y] — YYYY-MM-DD
### Completed
- List of what was built

### Files Created / Modified
- path/to/file.ts: description

### Schema Changes
- Any Firestore collection or field additions/changes

### Known Issues / Deferred
- Anything skipped or flagged for later

### Next Up
- What Phase X.Y+1 should tackle
```

## [Phase 3.3] — 2026-05-15

### Completed

- Task 24: Cloud Function onSwipeCreated implemented (2nd gen Firestore trigger, asia-southeast1)
- Mutual like detection: reads reverse swipe doc, creates match only if both sides exist
- matchId = [userId, targetId].sort().join('_') — canonical, consistent with future matchStore usage
- Idempotency guard prevents duplicate match creation on at-least-once redelivery
- Batch write atomically creates match doc + increments stats.matches on both user docs
- sendMatchNotifications stubbed with logger.info — full push implementation deferred to Task 33

### Files Created / Modified

- functions/src/onSwipeCreated.ts: onDocumentCreated trigger, mutual like check, idempotency guard, batch write, notification stub
- functions/src/index.ts: onSwipeCreated export added

### Known Issues / Deferred

- Push notifications to both matched users not yet sent — stub only; Task 33 (onNewMessage) will add Expo Push API calls
- No Firestore transaction used (batch is sufficient here because the idempotency guard handles the race condition window; a full transaction would be more robust for very high concurrency — revisit in Phase 2 if needed)

### Next Up

- Task 25: Discovery Zustand store (discoveryStore.ts — fetchStack callable, swipeRight, swipeLeft, swipeSuperLike, daily limit check, auto-refetch when stack < 3)

## [Phase 3.2] — 2026-05-15

### Completed

- Task 23: Cloud Function getDiscoveryStack implemented (2nd gen callable, asia-southeast1)
- Scoring algorithm from PRD.md Section 5.3 implemented: activities, fitness level, frequency, recency, premium, verified, diet, and lookingFor overlap
- Bidirectional age and gender filtering applied
- Exclusion set covers liked, passed, matched, and blocked users
- Composite Firestore index (location.city, banned, paused, lastActive DESC) confirmed in firestore.indexes.json

### Files Created / Modified

- functions/src/getDiscoveryStack.ts: callable function with local types, scoreCandidate, fetchExcludedIds, bidirectional age/gender checks
- functions/src/index.ts: added getDiscoveryStack export
- firestore.indexes.json: composite index for discovery query added

### Known Issues / Deferred

- score field included in response for debugging — strip before production launch
- lookingFor overlap scoring uses loaded caller and candidate arrays; this remains an unindexed field
- Distance-based filtering is not yet applied — city-level filtering is used in Phase 1; geo-distance filtering is deferred to Phase 2 using Geohash or a geo library
- If city population is small, QUERY_LIMIT=100 may exhaust available candidates quickly; expanding to country-level fallback is a Phase 2 enhancement

### Next Up

- Task 24: Cloud Function onSwipeCreated (Firestore trigger, mutual like detection, match document creation, stats increment)

## [Phase 3.1] — 2026-05-14

### Completed

- Task 22: Cloud Function onUserCreated implemented (2nd gen, asia-southeast1)
- functions/ package bootstrapped (Node.js 18, TypeScript strict, firebase-admin, firebase-functions v4)
- Age calculated server-side from dateOfBirth Timestamp — client never writes age
- Underage accounts (age < 18) auto-banned: banned=true, banReason="UNDERAGE", tokens revoked
- firebase.json updated with functions source configuration
- firestore.rules verified and tightened: age, banned, banReason, bannedAt, verified are server-only fields

### Files Created / Modified

- functions/package.json: Node.js 18, firebase-admin ^12, firebase-functions ^4, TypeScript dev deps
- functions/tsconfig.json: strict mode, commonjs, output to lib/
- functions/.eslintrc.js: TypeScript ESLint rules, no-explicit-any as error
- functions/src/index.ts: admin SDK init guard, exports onUserCreated
- functions/src/onUserCreated.ts: onDocumentCreated trigger, calculateAgeInYears, underage ban + token revoke
- firebase.json: functions block added
- firestore.rules: server-only field guards include age, banned, banReason, bannedAt, verified

### Schema Changes

- /users/{uid}.age: now populated by onUserCreated Cloud Function on document creation
- /users/{uid}.banReason: "UNDERAGE" set for auto-banned accounts
- /users/{uid}.bannedAt: Timestamp set on auto-ban

### Known Issues / Deferred

- onUserCreated fires on Firestore document create, not Firebase Auth onCreate — this means if Step 6 fails mid-write and no document is created, the function never fires; the client already guards this with LoadingOverlay + retry
- Token revocation is best-effort (wrapped in try/catch); the Firestore ban is the authoritative gate

### Next Up

- Task 23: Cloud Function getDiscoveryStack (HTTP callable, scoring algorithm, candidate filtering)

## [Phase 2.6] — 2026-05-14

### Completed

- Task 21: Onboarding Step 6 built (preferences, photo upload, Firestore profile write)
- services/firebase/storage.ts created (uploadProfilePhoto, uploadAllProfilePhotos, deleteProfilePhoto)
- services/firebase/firestore.ts created (createUserProfile, updateUserProfile)
- LoadingOverlay fully implemented
- OnboardingNavigator updated to use real Step6Screen
- Full onboarding flow is now end-to-end: Steps 1–6 complete, profile lands in Firestore

### Files Created / Modified

- services/firebase/storage.ts: sequential photo upload with per-photo and overall progress callbacks, deleteProfilePhoto
- services/firebase/firestore.ts: createUserProfile (safe defaults, age omitted), updateUserProfile
- app/onboarding/Step6Screen.tsx: lookingFor MultiSelect, genderPreference MultiSelect, age range dual sliders (min < max enforced), distance slider, submit with LoadingOverlay and sequential photo upload
- components/ui/LoadingOverlay.tsx: Modal-based overlay with ActivityIndicator and optional message text
- app/onboarding/OnboardingNavigator.tsx: Step6Screen placeholder replaced with real screen
- i18n/en.json, my.json, zh.json, ta.json: step6 and submit keys added
- firestore.rules, storage.rules: scoped user profile and photo upload rules added

### Schema Changes

- /users/{userId} document now being written by client at onboarding completion
- age field intentionally omitted from client write — awaiting onUserCreated Cloud Function (Task 22)
- religion field written conditionally (omitted when undefined/empty string)
- Firebase Storage writes now allowed only for the authenticated user's own profile photo path

### Known Issues / Deferred

- age field will be absent/0 on user documents until Task 22 (onUserCreated Cloud Function) is deployed
- Looking For / Gender Preference label↔value mapping is English-only; translation of chip labels deferred to native speaker review
- Location coordinates currently use a neutral GeoPoint placeholder because Step 1 only captures city/country; precise location capture remains deferred
- Drag-to-reorder photos deferred to Phase 2

### Next Up

- Task 22: Cloud Function onUserCreated (calculates age server-side from dateOfBirth, auto-bans under-18 accounts)

## [Phase 2.5] — 2026-05-13

### Completed

- Task 20: Onboarding Step 5 built (bio textarea, height slider, religion modal picker)
- Slider component created in components/ui/
- @react-native-community/slider installed
- OnboardingNavigator updated to use real Step5Screen

### Files Created / Modified

- components/ui/Slider.tsx: labelled RNSlider wrapper, primary tint, formatted value display
- app/onboarding/Step5Screen.tsx: bio (50-500 chars, live counter), height slider (140-220 cm, default 170), religion modal picker (optional, 7 options)
- app/onboarding/OnboardingNavigator.tsx: Step5Screen placeholder replaced with real screen
- store/onboardingStore.ts: confirmed bio, height, religion fields on OnboardingDraft
- i18n/en.json, my.json, zh.json, ta.json: step5 keys added

### Known Issues / Deferred

- Religion display strings are English placeholders in my/zh/ta - deferred to native speaker review
- Height field does not expose an imperial (ft/in) toggle - deferred to Phase 2 polish

### Next Up

- Task 21: Onboarding Step 6 - Preferences + Profile Submit (lookingFor, age range, distance, gender preference, Firebase photo upload, createUserProfile)

## [Phase 2.4] — 2026-05-13

### Completed

- Task 19: Onboarding Step 4 built (dietary preference, fitness goals, smoking, drinking)
- SingleSelect and MultiSelect reused from Task 18 without modification
- OnboardingNavigator updated to use real Step4Screen

### Files Created / Modified

- app/onboarding/Step4Screen.tsx: four lifestyle fields, enum mapping for smoking/drinking, pre-fill from draft, fixed button row
- app/onboarding/OnboardingNavigator.tsx: Step4Screen placeholder replaced with real screen
- store/onboardingStore.ts: OnboardingDraft already had dietaryPreference, fitnessGoals, smoking, drinking fields with correct types
- i18n/en.json, my.json, zh.json, ta.json: step4 keys added

### Known Issues / Deferred

- Display strings for smoking/drinking options ('No', 'Occasionally', 'Socially') are UI-only — mapped to enum values on save; translations deferred until native speaker review

### Next Up

- Task 20: Onboarding Step 5 — About You (bio textarea, height slider, religion dropdown, Slider component)

## [Phase 2.3] — 2026-05-12

### Completed

- Task 18: Onboarding Step 3 built (activities MultiSelect, fitness level, workout frequency)
- MultiSelect component created in components/ui/
- SingleSelect component created in components/ui/
- OnboardingNavigator updated to use real Step3Screen

### Files Created / Modified

- components/ui/MultiSelect.tsx: chip multi-select, min/max enforcement, primary colour selected state
- components/ui/SingleSelect.tsx: chip single-select, cannot deselect, same chip styles as MultiSelect
- app/onboarding/Step3Screen.tsx: activities (16 options, max 10), fitness level, frequency; Next disabled until all valid
- app/onboarding/OnboardingNavigator.tsx: Step3Screen placeholder replaced with real screen
- i18n/en.json, my.json, zh.json, ta.json: step3 keys added

### Known Issues / Deferred

- Display strings for fitness level ('Beginner' etc.) are mapped to FitnessLevel enum values on save — display translations deferred until native speaker review

### Next Up

- Task 19: Onboarding Step 4 — Lifestyle (diet, fitness goals, smoking, drinking)

## [Phase 2.2] — 2026-05-11

### Completed

- Task 17: Onboarding Step 2 built (photo selection, compression, grid)
- utils/imageUtils.ts created (compressImage, pickAndCompressImage)
- PhotoGrid component created in components/profile/
- OnboardingNavigator updated to use real Step2Screen

### Files Created / Modified

- utils/imageUtils.ts: compressImage (1080px, 80% quality), pickAndCompressImage (picker + compress)
- components/profile/PhotoGrid.tsx: 3-column grid, 6 slots, 3:4 ratio, Primary badge, remove button
- app/onboarding/Step2Screen.tsx: photo grid, min 2 photos required, saves local URIs to draft
- app/onboarding/OnboardingNavigator.tsx: Step2Screen placeholder replaced with real screen

### Known Issues / Deferred

- Photo upload to Firebase Storage deferred to Step 6 completion (Task 21)
- Drag-to-reorder photos deferred to Phase 2

### Next Up

- Task 18: Onboarding Step 3 — Fitness Profile (activities MultiSelect, fitness level, frequency)

## [Phase 2.1] — 2026-05-10

### Completed

- Task 16: Onboarding Step 1 built (firstName, dateOfBirth, gender, city)
- Installed @react-native-community/datetimepicker
- OnboardingNavigator updated to use real Step1Screen

### Files Created / Modified

- app/onboarding/Step1Screen.tsx: first name, DOB picker (iOS inline/Android dialog), gender chips, city input
- app/onboarding/OnboardingNavigator.tsx: Step1Screen placeholder replaced with real screen
- package.json: added @react-native-community/datetimepicker
- app.json: added datetimepicker Expo config plugin

### Next Up

- Task 17: Onboarding Step 2 — Photos (PhotoGrid, expo-image-picker, compression)

## [Phase 2.0] — 2026-05-10

### Completed

- Task 15: Onboarding shell built — OnboardingNavigator, ProgressDots, onboardingStore
- RootNavigator updated to use real OnboardingNavigator
- New users now land on Step 1 placeholder after authentication

### Files Created / Modified

- store/onboardingStore.ts: OnboardingDraft interface, draft + currentStep state, persisted
- components/ui/ProgressDots.tsx: 6 dots, active/completed/inactive states
- app/onboarding/OnboardingNavigator.tsx: stack with Step1–6 placeholders, shared OnboardingHeader
- app/navigation/RootNavigator.tsx: OnboardingPlaceholder replaced with OnboardingNavigator

### Next Up

- Task 16: Onboarding Step 1 — Basic Info (firstName, dateOfBirth, gender, city)

## [Phase 1.9] — 2026-05-10

### Completed

- Task 14: Email login and sign up screens built, Input component created
- All 5 auth screens are now real — AuthNavigator has zero placeholder components
- Authentication phase (Tasks 08–14) complete

### Files Created / Modified

- components/ui/Input.tsx: label, error, secureTextEntry with eye toggle, multiline support
- app/auth/EmailLoginScreen.tsx: RHF+Zod, signInWithEmail, inline errors, link to SignUp
- app/auth/SignUpScreen.tsx: RHF+Zod, signUpWithEmail, password strength, confirm match
- app/navigation/AuthNavigator.tsx: EmailLoginPlaceholder and SignUpPlaceholder removed

### Next Up

- Task 15: Onboarding shell — OnboardingNavigator, ProgressDots, onboardingStore

## [Phase 1.8] — 2026-05-10

### Completed

- Task 13: OTP verify screen built, OTPInput component created
- Full phone auth flow end-to-end: Phone → OTP → main app (Discover tab)
- AuthNavigator updated to use real OTPVerifyScreen

### Files Created / Modified

- components/ui/OTPInput.tsx: 6-box input, auto-advance, backspace, paste support, auto-submit
- app/auth/OTPVerifyScreen.tsx: auto-verify on completion, resend with countdown, error clears boxes
- app/navigation/AuthNavigator.tsx: OTPVerifyPlaceholder replaced with OTPVerifyScreen

### Next Up

- Task 14: Email login + sign up screens + Input component

## [Phase 1.7] — 2026-05-09

### Completed

- Task 12: Phone login screen built, PhoneInput component created
- services/firebase/auth.ts: added setPendingConfirmation/getPendingConfirmation for ConfirmationResult handoff
- AuthNavigator updated to use real PhoneLoginScreen

### Files Created / Modified

- components/ui/PhoneInput.tsx: country code picker (9 SEA+global codes), phone field, error state
- app/auth/PhoneLoginScreen.tsx: RHF+Zod, sendOTP, 5-attempt lockout with countdown
- services/firebase/auth.ts: module-level ConfirmationResult store (3 new exports)
- app/navigation/AuthNavigator.tsx: PhoneLoginPlaceholder replaced with PhoneLoginScreen

### Known Issues / Deferred

- sendOTP in Expo Go requires test phone numbers in Firebase Console (no reCAPTCHA yet)
- Add test number: Firebase Console → Authentication → Sign-in method → Phone → Test numbers

### Next Up

- Task 13: OTP verify screen + OTPInput component

## [Phase 1.6] — 2026-05-08

### Completed

- Task 11: Landing screen built, Button component created
- AuthNavigator updated to use real LandingScreen

### Files Created / Modified

- components/ui/Button.tsx: primary/outline/ghost variants, loading and disabled states
- app/auth/LandingScreen.tsx: logo, tagline, auth buttons (Apple iOS-only), terms
- app/navigation/AuthNavigator.tsx: LandingPlaceholder replaced with LandingScreen

### Next Up

- Task 12: Phone login screen + PhoneInput component

## [Phase 1.5] — 2026-05-07

### Completed

- Task 10: authStore fully implemented — replaces stub
- Firebase onAuthStateChanged wired via initialise() called in App.tsx
- AsyncStorage persistence for isAuthenticated and hasCompletedOnboarding
- Navigation now reacts automatically to auth state changes

### Files Created / Modified

- store/authStore.ts: full rewrite with persist middleware, initialise(), logout()
- App.tsx: added useEffect to call initialise() and wire cleanup

### Next Up

- Task 11: Landing screen + Button component

## [Phase 1.4] — 2026-05-06

### Completed

- Task 09: Auth service layer created (sendOTP, verifyOTP, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple stub, signOut, subscribeToAuthState)
- utils/errorUtils.ts created (mapFirebaseError returns i18n keys)

### Files Created / Modified

- services/firebase/auth.ts: all auth functions, AppError type
- utils/errorUtils.ts: mapFirebaseError, isFirebaseError, FIREBASE_ERROR_MAP

### Known Issues / Deferred

- signInWithGoogle uses signInWithPopup — works in Expo Go dev only, needs expo-auth-session for production (TODO comment added)
- signInWithApple is a stub — needs @invertase/react-native-apple-authentication and a development build
- Phone auth reCAPTCHA: use Firebase Console test phone numbers for now — production reCAPTCHA wired in Task 12

### Next Up

- Task 10: Auth Zustand store (full implementation — replaces stub, wires subscribeToAuthState, persists with AsyncStorage)

## [Phase 1.3] — 2026-05-05

### Completed

- Task 08: Navigation shell complete — RootNavigator, AuthNavigator, MainTabNavigator
- App.tsx rewritten with correct provider order (GestureHandlerRootView → SafeAreaProvider → NavigationContainer)
- authStore stub created for navigation gating
- All 5 auth screens and 4 main tab screens have placeholder components

### Files Created / Modified

- App.tsx: full rewrite with correct provider stack
- app/navigation/RootNavigator.tsx: root stack, auth gating logic
- app/navigation/AuthNavigator.tsx: stack navigator for auth screens
- app/navigation/MainTabNavigator.tsx: bottom tab navigator with Ionicons
- store/authStore.ts: stub store (isAuthenticated, isLoading, hasCompletedOnboarding)

### Known Issues / Deferred

- `npx expo start --offline` still fails before Metro boots because `/opt/homebrew/bin/node` is Node.js v23.11.0 and Expo CLI hits `ERR_SOCKET_BAD_PORT`; `npx tsc --noEmit` passes.

### Next Up

- Task 09: Auth service layer (signInWithPhone, verifyOTP, signInWithEmail, signOut)
- Prerequisite for Task 09: populate .env with Firebase values, add GoogleService-Info.plist and google-services.json

---

## [Phase 1.2] — 2026-05-03

### Completed

- Task 06: Firebase config initialised, .env.example created, secrets gitignored
- Task 07: i18n initialised with expo-localization, 4 language files seeded (EN, MY, ZH, TA)

### Files Created / Modified

- `services/firebase/config.ts`: Firebase app init with auth, db, storage, rtdb exports
- `.env.example`: 7 Firebase env var keys, all empty
- `.gitignore`: added .env, GoogleService-Info.plist, google-services.json
- `i18n/index.ts`: i18next init with device locale detection
- `i18n/en.json`: full English translation file for all Phase 1 screens
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json`: placeholder translations (same as EN)
- `package.json`, `package-lock.json`, `app.json`: added expo-localization dependency/config plugin

### Known Issues / Deferred

- .env not yet populated — developer must copy .env.example → .env and fill in Firebase values before Task 09 (auth screens need live Firebase connection)
- GoogleService-Info.plist and google-services.json not yet added to project — needed for Task 09
- `npx expo start` still fails in this shell before Metro boots because `/opt/homebrew/bin/node` is Node.js v23.11.0 and Expo CLI hits `ERR_SOCKET_BAD_PORT`; `npx tsc --noEmit` passes.

### Next Up

- Task 08: Navigation shell (RootNavigator, AuthNavigator, MainTabNavigator, GestureHandlerRootView)

## [Phase 1.1] — 2026-05-03

### Completed

- Path alias configured (`@/` → project root)
- Task 04: TypeScript types created (user, match, message, subscription)
- Task 05: Theme system created (colors, spacing, typography, theme re-export)

### Files Created / Modified

- `tsconfig.json`: added baseUrl and paths for `@/` alias
- `babel.config.js`: added module-resolver plugin and reanimated plugin
- `types/user.ts`, `types/match.ts`, `types/message.ts`, `types/subscription.ts`
- `constants/colors.ts`, `constants/spacing.ts`, `constants/typography.ts`, `constants/theme.ts`

### Schema Changes

- No Firestore schema changes; TypeScript interfaces now mirror the existing ARCHITECT.md schema.

### Known Issues / Deferred

- `npx expo start` currently fails before Metro boots with Expo CLI `ERR_SOCKET_BAD_PORT` under Node.js v23.11.0; `npx tsc --noEmit` passes.
- Pre-existing scaffold hardcoded color values remain in `App.tsx` and `app.json`; they were not changed because Tasks 04–05 explicitly scoped edits away from earlier files.

### Next Up

- Task 06: Firebase config setup
- Task 07: i18n setup

## [Phase 0.1] — April 2026

### Completed

- Full document audit and revision session (claude.ai)
- ARCHITECT.md revised: fixed swipe schema conflict (subcollection structure), added missing user fields (`paused`, `banned`, `expoPushToken`, `reportedBy`), updated workflow section for Codex-specific flow, added `AGENTS.md` to file structure
- TASKS.md revised: fixed Expo init command, added Firebase manual pre-flight section, added AGENTS.md creation to Task 03, added `app/navigation/` to folder structure, fixed Task 08 to require `GestureHandlerRootView` at root from the start, corrected task count to 46
- CHANGELOG.md revised: updated format
- PRD.md: pending surgical fixes (see Known Issues below) — not regenerated due to length

### Files Created / Modified

- `ARCHITECT.md`: Schema fix, missing fields, workflow update, AGENTS.md reference
- `TASKS.md`: Pre-flight section, Task 01 command fix, Task 03 AGENTS.md creation, Task 08 provider order fix, task numbering corrected to 46
- `CHANGELOG.md`: This entry

### Schema Changes

- Swipe schema clarified: subcollection structure `/swipes/{userId}/likes/{targetId}` is canonical (not flat `/swipes/{swipeId}`)
- Added to `/users/{userId}` schema: `paused: boolean`, `banned: boolean`, `expoPushToken?: string`
- Added `/reports/{reportId}` collection to schema



### Next Up

- Pre-flight: Firebase project setup (manual — browser steps in TASKS.md)
- Task 01: Initialize Expo project
- Task 02: Install Phase 1 dependencies
- Task 03: Create folder structure + AGENTS.md
