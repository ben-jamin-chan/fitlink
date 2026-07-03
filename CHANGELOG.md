# CHANGELOG.md — [APP_NAME]

> **Active file.** Contains Phase 4 entries only (Tasks 89–current).
> Attach this file at the start of every Architect session.
> Full Phase 0/1/2/3 history is in `CHANGELOG_ARCHIVE.md` — never attach that file.

---

## Completed Phase Summaries

### Phase 0 — Document Audit (April 2026) — COMPLETE
Initial document revision session: ARCHITECT.md schema fixes (swipe subcollection structure,
missing user fields), TASKS.md corrections, CHANGELOG format established.
Full history in CHANGELOG_ARCHIVE.md.

### Phase 1 — MVP (Tasks 01–46) — COMPLETE (2026-05-24)
Final task: Task 46 (app wiring audit). Delivered: navigation shell, auth (Phone/Email/Google/Apple),
6-step onboarding, discovery/swipe stack (Reanimated 3), matching (onSwipeCreated CF), matches +
chat (RTDB), profile + settings, Firestore rules + indexes. Shipped to TestFlight + Android internal
beta. Full history in CHANGELOG_ARCHIVE.md.

### Phase 2 — Growth (Tasks 47–69 + remediation 70–74) — COMPLETE (2026-06-07)
Final task: Task 74 (incognito mode). Delivered: Stripe subscriptions, photo verification (Cloud
Vision), Strava/Apple Health/Google Fit integrations, premium feature gates, EAS build config,
Crashlytics. Stripe portal CF deferred → became Phase 3 Task 71.
Key decisions still active: `rewindSwipe` is a separate callable (not a `recordSwipe` direction).
Full history in CHANGELOG_ARCHIVE.md.

### Phase 3 — Expansion (Tasks 75–88) — COMPLETE (2026-06-21)
Final task: Task 88 (indexes). Delivered: rewind, incognito, boost, Stripe portal, match filters,
voice messages, video profile loop, Google Places gym search, gym check-ins, workout events, SEA
expansion (MY/SG/TH), per-user timezone resets, background lastActive (iOS), notification
preferences, Strava disconnect cleanup, admin queue hardening.
Key decisions still active:
- `boostExpiresAt` in firestore.rules is legacy — actual field is `boost` map (activateBoost CF).
  Both guards kept; harmless to leave in place.
- `recordSwipe` does NOT have a `'rewind'` direction. `rewindSwipe.ts` is the separate callable.
- Blocked path is `/blocked/{uid}/users/{blockedId}` (confirmed from `unmatchUser.ts`).
- `functions/src/index.ts` is append-only — never rewrite, always append.
Full history in CHANGELOG_ARCHIVE.md.

---

## [Chore — Beta seed profiles] — 2026-07-02

- Added `scripts/seedBetaProfiles.ts`, a one-off Firebase Admin SDK seed script for 12 tagged Malaysia beta profiles.
- Added `scripts/seedBetaProfiles.config.ts` with the 12 synthetic profile definitions, all using `location.country: 'Malaysia'` and cities from `SEA_CITIES.Malaysia`.
- Added optional `isSeedAccount?: boolean` to `types/user.ts` for script-level query and cleanup support; no client UI reads or branches on the flag.
- The script writes `isSeedAccount: true` on every created `/users/{uid}` document and computes `age` in-script to mirror `onUserCreated`, because this operational path bypasses the normal onboarding trigger.
- v2 follow-up: run instructions now use the repo's actual tooling location: `cd functions && npx ts-node ../scripts/seedBetaProfiles.ts <avatar-dir>`.
- v3 follow-up: added 12 synthetic photorealistic adult JPEG seed portraits under `assets/seed-profiles/` and updated the script to upload JPEG/PNG/SVG avatars with the correct content type.
- v3 follow-up: script now validates all local avatar files before Firebase access and fails once with explicit Admin SDK credential instructions if project/ADC context is missing.
- Execution status: successful manual run against `../assets/seed-profiles` with Firebase Admin credentials; 12 profiles created, 0 skipped, 0 failed.
- Cleanup note: these seed profiles should be bulk-deleted after beta concludes via a separate cleanup script keyed by `isSeedAccount: true`.

---

## [Chore — ts-jest config] — 2026-06-30

- Migrated `functions/jest.config.ts` from deprecated `globals['ts-jest']` options to the `transform` tuple configuration.
- Verification: `npm --prefix functions test` passes with all 27 tests and no `ts-jest[ts-jest-transformer] (WARN)` deprecation warning.
- Verification: `npm --prefix functions run build` passes.

---

## [Phase 4E — Task 106] — 2026-06-30

### Completed

- Task 106: Phase 4 Firestore Security Rules — admin audit & warnings
- Verified live `firestore.rules` already contains the required `/admin_audit/{docId}`, `/users/{uid}/warnings/{warningId}`, `/blocked/{userId}/users/{blockedId}`, `/admin_queue/{docId}`, and `/flags/{docId}` access controls
- Added the Task 106 verification comment above the existing `/admin_audit/{docId}` block without duplicating any `match` blocks
- Added the missing `/admin_audit` composite index for per-admin audit trail queries (`adminUid` ascending, `createdAt` descending)

### Files Created

- None

### Files Modified

- firestore.rules: added Task 106 verification comment only; existing Task 95 and Task 100 rules left intact
- firestore.indexes.json: appended one `admin_audit` composite index
- CHANGELOG.md: added Task 106 completion entry

### Architecture Decisions

- Treated the existing Task 95 `/admin_audit` and `/users/{uid}/warnings` rules as authoritative and verified them in place rather than reinserting duplicate rule blocks.
- Preserved the intentional Task 95 admin-claim-gated `/reports` and `/flags` read layering beside the baseline Task 86 deny blocks.
- Did not add a warnings subcollection composite index because `/users/{uid}/warnings` remains a low-cardinality per-user subcollection.

### Verification

- `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"` — passed
- `firebase emulators:exec --only firestore "node -e \"process.exit(0)\""` — passed
- `npm audit --audit-level=high` — passed
- `npm --prefix functions audit --audit-level=high` — passed for high severity

### Conflict Risks Introduced

- None — `firestore.rules` logic was not changed; the only rule-file edit is a verification comment

### Known Issues / Deferred

- `npm --prefix functions audit --audit-level=high` still prints existing moderate `firebase-functions-test` / `ts-deepmerge` advisories; fixing requires `npm audit fix --force` and a breaking dependency change, so it is deferred outside Task 106.

### Next Up

- Phase 4 completion checklist / Phase 5 planning

## [Phase 4E — Task 105] — 2026-06-29

### Completed

- Task 105: Unit tests — deleteAccount & restoreStripeSubscription
- deleteAccount: 5 test cases — auth rejection, no-stripe-customer deletion flow, active Stripe subscription cancel-at-period-end, swallowed Stripe failure with deletion continuing, and full happy path with Auth deletion verified last
- restoreStripeSubscription: 4 test cases — auth rejection, no customer, no active subscription, and active subscription restore with Firestore premium write

### Files Created

- functions/src/__tests__/deleteAccount.test.ts: path-aware Firestore, Storage, RTDB, Auth, and Stripe mocks for deleteAccount cleanup behavior and ordering
- functions/src/__tests__/restoreStripeSubscription.test.ts: path-aware user document mock and Stripe subscription restore tests with deterministic env-backed price tier mapping

### Files Modified

- None

### Architecture Decisions

- deleteAccount tests follow source behavior: Stripe cleanup uses `cancel_at_period_end: true`, Stripe failures are swallowed, and Firebase Auth deletion is the final cleanup step.
- restoreStripeSubscription tests import the function after seeding `STRIPE_PRICE_MYR_PRO_MONTHLY` because the source builds `PRICE_TIER_MAP` at module scope.
- Auth-last verification uses Jest `invocationCallOrder` across Stripe update, Firestore batch/doc deletes, Storage file delete, and RTDB chat cleanup mocks.

### Conflict Risks Introduced

- None — test files only; no CF source or shared mock helpers modified

### Known Issues / Deferred

- None

### Next Up

- Task 106: Phase 4 Firestore Security Rules — admin audit & warnings

---

## [Phase 4E — Task 104] — 2026-06-29

### Completed

- Task 104: Unit tests — activateBoost & createCheckin
- activateBoost: 5 test cases — auth rejection, non-Pro rejection, current-month boost quota rejection, Pro success with no boost, and prior-month boost success
- createCheckin: 4 test cases — auth rejection, existing active check-in rejection, invalid payload rejection, and valid batch write success

### Files Created

- functions/src/__tests__/activateBoost.test.ts: 5 test cases
- functions/src/__tests__/createCheckin.test.ts: 4 test cases

### Files Modified

- None

### Architecture Decisions

- activateBoost source enforces one boost per calendar month from `boost.activatedAt` and throws `resource-exhausted`; tests follow source rather than the prompt's future-`expiresAt` / `already-exists` assumption.
- activateBoost success writes `boost.activatedAt` with `FieldValue.serverTimestamp()` and returns `{ success: true, expiresAt }`; tests follow source rather than expecting a returned nested `boost` object.
- createCheckin active-check reads from a `/gymCheckins` query where `userId == uid` and `expiresAt > now`, not from `users/{uid}.gymCheckin`.
- Local path/query-aware mocks were added inside the two test files; shared helper mocks were not modified.

### Conflict Risks Introduced

- None — test files only; no CF source or shared mock helper modified

### Known Issues / Deferred

- None

### Next Up

- Task 105: Unit tests — deleteAccount & restoreStripeSubscription

---

## [Phase 4E — Task 103] — 2026-06-29

### Completed

- Task 103: Unit tests — recordSwipe
- All 9 required recordSwipe test cases implemented and passing

### Files Created

- functions/src/__tests__/recordSwipe.test.ts: full Jest suite for recordSwipe CF covering auth, invalid direction, pass, like limits, premium bypass, superlike gating, and timezone reset behavior

### Files Modified

- None

### Architecture Decisions

- Premium check is performed from `/users/{uid}.premium.active`, not auth token claims; tests seed the user document accordingly.
- `recordSwipe` uses `runTransaction` for daily like counter and swipe writes; tests mock the transaction callback with path-aware document refs local to the test file.
- `recordSwipe` still reads and writes the dailyLikes doc for premium likes, but bypasses the free-user limit and returns `Number.MAX_SAFE_INTEGER`.

### Conflict Risks Introduced

- None — test file only; no CF source or shared mocks modified

### Known Issues / Deferred

- None

### Next Up

- Task 104: Unit tests — activateBoost & createCheckin

---

## [Phase 4E — Task 102] — 2026-06-28

### Completed

- Task 102: Jest harness for Cloud Functions
- Installed jest, ts-jest, @types/jest, firebase-functions-test, and ts-node in functions/devDependencies
- Created jest.config.ts with node environment, ts-jest preset, no-tests pass-through, and Watchman disabled for CI/sandbox stability
- Created firebaseAdminMock.ts: Firestore, Auth, Storage, RTDB, FieldValue, Timestamp, and GeoPoint mocks + resetAllMocks() helper
- Created stripeMock.ts: Stripe subscriptions, customers, billingPortal, checkout.sessions mocks + resetStripeMocks() helper

### Files Created

- functions/jest.config.ts: Jest configuration for functions package
- functions/src/__tests__/helpers/firebaseAdminMock.ts: shared Admin SDK mock with reset helper
- functions/src/__tests__/helpers/stripeMock.ts: shared Stripe mock with reset helper

### Files Modified

- functions/package.json: added Jest-related devDependencies and test script
- functions/package-lock.json: locked functions test harness dev dependencies
- functions/.gitignore: ignored .jest-cache/

### Architecture Decisions

- Used Jest's documented `setupFilesAfterEnv` key instead of the prompt typo `setupFilesAfterFramework`.
- Added `ts-node` because Jest 29 requires it to load `jest.config.ts`.
- Added `watchman: false` so `npm --prefix functions test` does not depend on a local Watchman socket.
- `--passWithNoTests` added to test script so the harness validates before any .test.ts files exist.
- Admin mock covers `admin.database()` and `admin.firestore.Timestamp/FieldValue/GeoPoint` because current Phase 4 Cloud Functions use those namespace APIs.

### Conflict Risks Introduced

- None — no Cloud Function source files touched; index.ts unchanged

### Known Issues / Deferred

- None — test suites to be written in Tasks 103–105

### Next Up

- Task 103: Unit tests — recordSwipe

---

## [Phase 4D — Task 101] — 2026-06-28

### Completed

- Task 101: Safety Center screen
- Added SafetyCenterScreen with 5 expandable safety tips, community guidelines link, report/support quick actions, and localised emergency numbers for all 6 supported countries
- Added one-time first-match safety prompt to MatchesScreen, gated by AsyncStorage key `'fitlink-safety-prompt-shown'`
- Wired Settings → Support → Safety Center navigation row
- Added `safety.*` translations to all four i18n files

### Files Created

- constants/safetyResources.ts: EMERGENCY_NUMBERS map and FALLBACK_COUNTRY for all 6 SEA countries
- app/settings/SafetyCenterScreen.tsx: scrollable safety center with expandable tip cards, guidelines, quick actions, and tel:-linked emergency numbers

### Files Modified

- app/settings/SettingsScreen.tsx: added Safety Center row to Support section above Help Center
- app/navigation/MainTabNavigator.tsx: appended SafetyCenterScreen to Settings stack as 'SafetyCenter'
- app/matches/MatchesScreen.tsx: added first-match safety prompt modal with AsyncStorage one-time gate
- i18n/en.json: appended safety.* keys
- i18n/my.json: appended safety.* keys (English placeholders)
- i18n/zh.json: appended safety.* keys (English placeholders)
- i18n/ta.json: appended safety.* keys (English placeholders)

### Architecture Decisions

- safetyPromptVisible is useState local state in MatchesScreen — not a Zustand store field. Transient UI gate with no cross-screen sharing requirement.
- AsyncStorage key 'fitlink-safety-prompt-shown' is checked on first non-empty match snapshot per session, guarded by a useRef to prevent double-check within the same session.
- EMERGENCY_NUMBERS keyed by plain string (not SupportedCountry type) to allow future country additions without a type change in safetyResources.ts.
- Country fallback to 'Malaysia' handles null profile and countries not yet in the map.

### Conflict Risks Introduced

- app/settings/SettingsScreen.tsx modified — any future task touching this file must preserve the Safety Center row in the Support section
- app/navigation/MainTabNavigator.tsx modified — any future task touching this file must preserve the SafetyCenter stack entry
- app/matches/MatchesScreen.tsx modified — Task 103+ unit tests should be aware of the AsyncStorage dependency in the listener callback if MatchesScreen is ever covered

### Known Issues / Deferred

- None

### Next Up

- Task 102: Jest Harness for Cloud Functions

---

## [Phase 4D — Task 100] — 2026-06-27

### Completed

- Task 100: Blocked Users screen
- Added blocked-users list UI with deleted-account fallback, pull-to-refresh, and unblock confirmation
- Opened `/blocked/{userId}/users/{blockedId}` in Firestore rules for owner read/delete only
- Wired Settings → Privacy → Blocked Users to the new screen
- Added `settings.blocked.*` translations to all four i18n files

### Files Created

- app/settings/BlockedUsersScreen.tsx: blocked list UI that reads `/blocked/{uid}/users`, resolves user display info, and deletes blocked entries after confirmation

### Files Modified

- firestore.rules: replaced the deny-all blocked wildcard with an outer parent deny and scoped owner read/delete on `/blocked/{userId}/users/{blockedId}`
- app/settings/SettingsScreen.tsx: wired the existing Privacy blocked-users row to navigate to `BlockedUsers`
- app/navigation/MainTabNavigator.tsx: appended `BlockedUsersScreen` to the Settings stack
- i18n/en.json: added `settings.blocked.*` keys
- i18n/my.json: mirrored `settings.blocked.*` keys (English placeholders)
- i18n/zh.json: mirrored `settings.blocked.*` keys (English placeholders)
- i18n/ta.json: mirrored `settings.blocked.*` keys (English placeholders)

### Architecture Decisions

- Confirmed blocked path is `/blocked/{uid}/users/{blockedId}` from `functions/src/unmatchUser.ts` and `functions/src/getDiscoveryStack.ts`.
- Firestore rules change preserves a deny-all parent `/blocked/{userId}` rule and explicitly opens only the `users` subcollection for authenticated owner reads and deletes; create/update remain denied because `unmatchUser` is the only writer.
- `BlockedUsersScreen` uses `Promise.allSettled` so one inaccessible or deleted blocked profile cannot abort the entire list.
- Unblock uses direct client `deleteDoc` on the blocked document and filters local state after success; no Cloud Function or full re-fetch is introduced.

### Conflict Risks Introduced

- firestore.rules modified — Task 106 also touches rules; review this scoped blocked-users rule before generating that prompt.
- app/settings/SettingsScreen.tsx modified — Task 101 also touches Settings for Safety Center; preserve both the Privacy blocked-users row and Task 99 Danger Zone row.
- app/navigation/MainTabNavigator.tsx modified — Task 101 also registers a Settings stack screen; append without reordering existing entries.

### Known Issues / Deferred

- None

### Next Up

- Task 101: Safety Center screen

---

## [Phase 4D — Task 99] — 2026-06-27

### Completed

- Task 99: Delete Account screen
- Replaced existing direct-delete confirmation screen with the required three-section PDPA deletion flow
- Added mandatory re-authentication gates for phone OTP, Google, Apple, and email/password providers
- Wired screen to call the shared region-pinned `deleteAccount` callable with an empty payload
- Added typed confirmation requiring `DELETE` before the destructive final alert can be opened
- Clears local Zustand/auth/storage state after callable success, then resets the root stack to the unauthenticated `Auth` route
- Added `deleteAccount.*` translations to all four i18n files

### Files Created

- None — `app/settings/DeleteAccountScreen.tsx` already existed before Task 99 and was replaced/upgraded in place

### Files Modified

- app/settings/DeleteAccountScreen.tsx: full re-authenticated delete-account flow using the Task 98 Cloud Function
- app/settings/SettingsScreen.tsx: wired the Danger Zone row directly to the dedicated delete-account flow
- app/navigation/MainTabNavigator.tsx: added the delete-account screen title option to the existing Settings stack route
- i18n/en.json: added deleteAccount.* keys
- i18n/my.json: mirrored deleteAccount.* keys (English placeholders)
- i18n/zh.json: mirrored deleteAccount.* keys (English placeholders)
- i18n/ta.json: mirrored deleteAccount.* keys (English placeholders)

### Architecture Decisions

- Phone re-auth uses the existing `sendOTP()` service pattern, then builds a `PhoneAuthProvider` credential from the returned `verificationId`; no null verifier is passed.
- Google re-auth uses the app's existing Expo AuthSession pattern from `LandingScreen.tsx` because `@react-native-google-signin/google-signin` is not installed in this project.
- Apple re-auth included because the app already supports Apple Sign-In; guarded to iOS and uses `OAuthProvider('apple.com')`.
- Store cleanup uses existing store APIs: `profileStore.reset()`, `discoveryStore.reset()`, `matchStore.unsubscribeFromMatches()`, and `chatStore.closeChat(uid)`.
- Navigation reset targets the root `Auth` route.

### Conflict Risks Introduced

- app/settings/SettingsScreen.tsx modified — Task 100 (Blocked Users) also touches this file
- app/navigation/MainTabNavigator.tsx modified — Task 100 also registers a Settings stack screen

### Known Issues / Deferred

- Unit coverage for `deleteAccount` CF scheduled for Task 105.

### Next Up

- Task 100: Blocked Users screen

---

## [Phase 4D — Task 98] — 2026-06-27

### Completed

- Task 98: deleteAccount Cloud Function
- Added authenticated `deleteAccount` callable in `asia-southeast1`
- Cancels active Stripe subscriptions at period end when a `stripeCustomerId` exists
- Deletes user subcollections before deleting the parent `/users/{uid}` document
- Deletes swipe subcollections, match documents, gym check-ins, Cloud Storage files, and RTDB chat nodes before deleting the Firebase Auth user last

### Files Created

- functions/src/deleteAccount.ts: callable CF with the PDPA deletion sequence across Stripe, Firestore, Storage, RTDB, and Firebase Auth; returns `{ success: true }`

### Files Modified

- functions/src/index.ts: appended deleteAccount export

### Architecture Decisions

- Stripe cleanup uses `cancel_at_period_end: true` — no immediate cancellation or prorated refund.
- Stripe cleanup is best-effort and swallowed on failure so a Stripe outage cannot block PDPA deletion.
- Firebase Auth deletion is the final step — deleting Auth first risks orphaned data if earlier cleanup fails.
- Stripe instantiated inside the callable after reading the secret, matching `createStripeCheckout` pattern.

### Conflict Risks Introduced

- functions/src/index.ts modified — all future CF tasks must append without reordering.

### Known Issues / Deferred

- Unit coverage for `deleteAccount` scheduled for Task 105.
- Delete Account screen wiring deferred to Task 99.

### Next Up

- Task 99: Delete Account screen (depends on this CF)

---

## [Phase 4C — Task 97] — 2026-06-26

### Completed

- Task 97: Restore Purchases UI
- Added free-tier "Restore Purchases" action to PremiumScreen
- Calls the existing `restoreStripeSubscription` callable via Firebase Functions in `asia-southeast1`
- Shows loading state during restore, success toast on restored subscription, translated alerts for not-found/error states
- Added local-only `profileStore.restorePremium()` to update `profile.premium` immediately after successful restore without writing Firestore from the client

### Files Modified

- app/settings/PremiumScreen.tsx: added restore callable handler, restore button, loading state, success/error UI
- store/profileStore.ts: added local-only restorePremium action with returned timestamp normalization
- services/firebase/config.ts: exported shared region-pinned Firebase Functions instance
- i18n/en.json, my.json, zh.json, ta.json: added premium.restore keys

### Architecture Decisions

- Restore UI updates only local Zustand state after CF writes server-owned `premium.*` fields; client does not write `premium` to Firestore.
- `services/firebase/config.ts` now exports `functions`; future callable code may reuse it instead of creating ad hoc `getFunctions(undefined, 'asia-southeast1')` instances.

### Conflict Risks Introduced

- services/firebase/config.ts now exports `functions` — future callable code should import from here.

### Next Up

- Task 98: deleteAccount Cloud Function

---

## [Phase 4C — Task 96] — 2026-06-26

### Completed

- Task 96: restoreStripeSubscription Cloud Function
- Reads `stripeCustomerId` from `/users/{uid}` via Admin SDK only; client payload customer IDs are ignored
- Queries Stripe for active subscription; returns discriminated no-customer, no-active-subscription, or restored results
- Writes server-owned `premium.active`, `premium.tier`, `premium.subscriptionId`, and `premium.expiresAt` via Admin SDK

### Files Created

- functions/src/restoreStripeSubscription.ts: callable CF; reads stripeCustomerId server-side; returns discriminated RestoreResult union

### Files Modified

- functions/src/index.ts: appended restoreStripeSubscription export

### Architecture Decisions

- PRICE_TIER_MAP built at module scope includes 36 country-scoped price keys plus existing unprefixed Phase 2 price keys.
- Unrecognised price IDs fall back to Plus tier.

### Next Up

- Task 97: Restore Purchases UI (depends on this CF)

---

## [Phase 4B — Task 95] — 2026-06-25

### Completed

- Task 95: Admin moderation queue & actions
- `adminAction` CF: ban, unban, warn, dismiss with auth + admin-claim checks
- ReportsPanel, FlagsPanel, UsersPanel, UserProfileModal components built
- DashboardPage: wired all panels with Reports/Flags badge counts
- firestore.rules: appended /admin_audit and /users/{uid}/warnings blocks

### Files Created

- functions/src/adminAction.ts: callable CF with auth + admin-claim check, four action types, warnings, source actioning, audit log
- admin/src/components/ReportsPanel.tsx
- admin/src/components/FlagsPanel.tsx
- admin/src/components/UsersPanel.tsx
- admin/src/components/UserProfileModal.tsx

### Files Modified

- functions/src/index.ts: added adminAction export
- firestore.rules: appended Task 95 admin read-only queue rules, /admin_audit deny block, /users/{uid}/warnings owner-read block
- admin/src/pages/DashboardPage.tsx: wired panels and badge counts

### Architecture Decisions

- Admin claim verified via `request.auth.token['admin']` — avoids extra Admin SDK round-trip.
- `'unban'` included in adminAction union for reversible ban toggle.
- Direct bans/unbans from UsersPanel use `sourceDocId: 'direct'`; adminAction skips source doc updates for that sentinel.
- firestore.rules includes duplicate read-only /reports and /flags matches for `request.auth.token.admin == true` to allow admin dashboard client SDK reads alongside existing deny blocks.
- Badge counts use `getCountFromServer()` aggregation queries.

### Conflict Risks Introduced

- firestore.rules modified — Task 106 also touches rules; review Task 95 appended blocks before generating that prompt.

### Known Issues / Deferred

- UsersPanel first-name filter is client-side only; full-text search deferred to Phase 5.
- Flag thumbnails depend on stored photoUrl being browser-readable; gs:// paths from storage trigger may not render.

### Next Up

- Task 96: restoreStripeSubscription Cloud Function

---

## [Phase 4B — Task 94] — 2026-06-25

### Completed

- Task 94: Admin Dashboard — Project Scaffold & Auth
- Separate React + TypeScript + Vite admin web app under `/admin/`
- Google-only Firebase Auth sign-in with immediate `admin` custom claim verification
- `AdminRoute` route guard checks `admin` custom claim asynchronously

### Files Created

- admin/index.html, admin/vite.config.ts, admin/tsconfig.json, admin/tsconfig.node.json
- admin/package.json, admin/package-lock.json, admin/.env.example
- admin/src/main.tsx, admin/src/App.tsx, admin/src/firebase.ts, admin/src/vite-env.d.ts
- admin/src/components/AdminRoute.tsx
- admin/src/pages/LoginPage.tsx, admin/src/pages/DashboardPage.tsx

### Files Modified

- .gitignore: added `admin/node_modules/`
- tsconfig.json: excluded admin build folders from root TypeScript compilation

### Architecture Decisions

- `/admin/` is a standalone Vite web app — does NOT import Expo, React Native, Zustand, React Navigation, i18next, or the mobile app `@/` alias tree.
- Firebase init uses `VITE_FIREBASE_*` env vars (not `EXPO_PUBLIC_*`).
- Admin access enforced from Firebase Auth custom claims in both login flow and guarded dashboard route.

### Conflict Risks Introduced

- Task 95 depends on `auth`, `db`, and `functions` named exports in `admin/src/firebase.ts` and existing dashboard tab shell.

### Next Up

- Task 95: Admin moderation queue & actions

---

## [Phase 4A — Task 93] — 2026-06-25

### Completed

- Task 93: Phase 4 Firestore Indexes Audit & Validation
- No new composite indexes required for Phase 4A — confirmed
- Existing Phase 1/2/3 composite indexes validated clean

### Architecture Decisions

- Phase 4A introduced no new collection-level queries requiring composite indexes.

### Next Up

- Task 94: Admin Dashboard — Project Scaffold & Auth

---

## [Phase 4A — Task 92] — 2026-06-25

### Completed

- Task 92: Phase 4 Firestore Security Rules Update
- Audited firestore.rules against Phase 4A changes (Tasks 89–91) — no new rules required
- Added Phase 4A audit comment block at top of firestore.rules

### Architecture Decisions

- Phase 4A introduced no new Firestore collections or server-only fields.
- `doesNotModifyServerOnlyFields()` still guards: `age`, `banned`, `premium`, `photoVerified`, `verifiedAt`, `boost`, `stripeCustomerId`.

### Next Up

- Task 93: Phase 4 Firestore Indexes

---

## [Phase 4A — Task 91] — 2026-06-25

### Completed

- Task 91: Stripe Tier 2 — PHP/IDR/VND Pricing & Local Payment Methods
- `createStripeCheckout.ts`: reads `location.country` server-side, maps through inlined `COUNTRY_TO_CURRENCY` map, passes resolved currency into Stripe subscription creation with MYR fallback
- `stripeWebhook.ts`: recognises PHP/IDR/VND Pro price IDs so Tier 2 Pro purchases are not downgraded to Plus
- `PremiumScreen.tsx`: formats PHP (`₱`, no decimal), IDR (`Rp`, Indonesian thousands separator), VND (`₫`, Vietnamese thousands separator)

### Files Modified

- functions/src/createStripeCheckout.ts: country-to-currency routing; `COUNTRY_TO_CURRENCY` inlined (not imported from client constants)
- functions/src/stripeWebhook.ts: Tier 2 Pro price IDs added
- services/stripe.ts: VND zero-decimal units corrected
- app/settings/PremiumScreen.tsx: PHP/IDR/VND price formatting added

### Architecture Decisions

- `COUNTRY_TO_CURRENCY` is inlined in the CF — Cloud Functions must not import from client `constants/` directory.
- Country read server-side from Firestore, not from `request.data` — prevents currency spoofing.

### Next Up

- Task 92: Phase 4 Firestore Security Rules Update

---

## [Phase 4A — Task 90] — 2026-06-24

### Completed

- Task 90: Onboarding & Discovery — Philippines, Indonesia, Vietnam
- Verified Step1Screen.tsx dynamically renders SUPPORTED_COUNTRIES, uses SEA_CITIES[selectedCountry], reverse-scans COUNTRY_TIMEZONES for device timezone detection
- services/stripe.ts now derives currency from COUNTRY_CURRENCIES and returns PHP, IDR, VND price IDs from country-specific EXPO_PUBLIC_STRIPE_PRICE_* env vars

### Files Modified

- services/stripe.ts: removed duplicated country-currency map; added COUNTRY_CURRENCIES lookup and PHP/IDR/VND-specific price ID env vars
- .env.example: PHP/IDR/VND Stripe price ID vars added
- i18n/en.json, my.json, zh.json, ta.json: onboarding country keys for PH/ID/VN added

### Architecture Decisions

- Step1Screen.tsx required no code changes — its timezone auto-detection already uses a dynamic reverse scan over COUNTRY_TIMEZONES.

### Next Up

- Task 91: Stripe Tier 2 — PHP/IDR/VND Pricing & Local Payment Methods

---

## [Phase 4A — Task 89] — 2026-06-24

### Completed

- Task 89: SEA Tier 2 Types, Regions & Timezone Constants
- Extended SUPPORTED_COUNTRIES: Philippines, Indonesia, Vietnam
- Extended COUNTRY_TIMEZONES: Asia/Manila, Asia/Jakarta, Asia/Ho_Chi_Minh
- Extended SEA_CITIES: 10 cities each for PH, ID, VN
- Added COUNTRY_CURRENCIES export: MYR/SGD/THB/PHP/IDR/VND
- Added COUNTRY_CALLING_CODES export: +60/+65/+66/+63/+62/+84

### Files Modified

- constants/regions.ts: extended all exports; added COUNTRY_CURRENCIES, COUNTRY_CALLING_CODES
- i18n/en.json, my.json, zh.json, ta.json: regions country/city keys for PH/ID/VN added

### Architecture Decisions

- All Task 81 MY/SG/TH entries preserved exactly — no renames or reordering.

### Next Up

- Task 90: Onboarding & Discovery — Philippines, Indonesia, Vietnam

---

## [Phase 4 Pre-flight — Admin Custom Claim Setup] — 2026-06-22

### Completed

- Set `admin: true` custom claim for the approved Firebase Auth admin UID
- Verified via Firebase Admin SDK `getUser()`

### Next Up

- Task 94: Admin dashboard scaffold and auth

---

## [Phase 4 Pre-flight — Admin Hosting Setup] — 2026-06-22

### Completed

- Created secondary Firebase Hosting site `fitlink-admin`
- Configured Firebase Hosting deploy targets: `app` → `gym-dating-dev`, `admin` → `fitlink-admin`
- Added multi-site Hosting config to `firebase.json` with admin SPA rewrite

### Files Modified

- firebase.json: added `hosting` array with `app` and `admin` targets
- .firebaserc: added Hosting target mappings for `gym-dating-dev`
- .gitignore: ignored `admin/build/`

### Next Up

- Set `admin: true` custom claims for approved admin Firebase Auth UIDs
