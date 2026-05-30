# CHANGELOG.md — [APP_NAME]

> Update this file at the end of every completed phase or significant implementation session. The Architect reads the latest entry to restore context at the start of each new session.

---

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
