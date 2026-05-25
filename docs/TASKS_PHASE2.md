# TASKS_PHASE2.md — [APP_NAME]
# Phase 2: Growth (Months 4–6)

> **How to use this file:**
> - One task at a time in Codex. Never batch multiple tasks in one prompt.
> - Check off each task after Codex completes and you have reviewed the diff.
> - Git commit after every task: `git commit -m "task-XX: <description>"`
> - Task numbers continue from Phase 1. Phase 1 ended at Task 46. Phase 2 begins at Task 47.
> - If Codex drifts or produces unexpected output, bring the diff back to claude.ai Architect for review.
> - Tasks are ordered by dependency — do not skip ahead.

---

## Phase 2 Scope

Phase 2 ships four major epics on top of the working Phase 1 MVP:

1. **EAS Build & Submission** — Production build pipeline for TestFlight and Play Store
2. **Premium Subscriptions** — Stripe integration, local payment methods, subscription lifecycle
3. **Photo Verification** — Cloud Vision selfie verification, verified badge
4. **Fitness Integrations** — Strava OAuth, Apple Health (iOS), Google Fit (Android)

**Deferred items from Phase 1 being resolved in Phase 2:**
- `UpsellModal` "Upgrade Now" CTA → wired to real `PremiumScreen`
- `signInWithGoogle` production flow → `expo-auth-session` replacing `signInWithPopup`
- `signInWithApple` stub → `@invertase/react-native-apple-authentication` full implementation
- `console.error` in `ErrorBoundary` → Firebase Crashlytics
- Background `lastActive` silent push → scheduled Cloud Function
- Server-side daily likes enforcement → Cloud Function transaction
- Upsell reason differentiation (likes vs superLike)

**New Firestore schema additions (Phase 2):**

`/users/{userId}` — new fields:
```typescript
photoVerified: boolean          // was `verified` in Phase 1 — aliased for clarity
verifiedAt?: Timestamp
stripeCustomerId?: string
premium: {
  active: boolean
  tier: 'plus' | 'pro' | null
  subscriptionId: string | null
  expiresAt: Timestamp | null
}
fitnessTracking: {
  appleHealth?: { connected: boolean; lastSync: Timestamp }
  googleFit?:   { connected: boolean; lastSync: Timestamp }
  strava?:      { connected: boolean; accessToken: string; refreshToken: string; expiresAt: number; lastSync: Timestamp }
  todayStats?: {
    steps: number
    distance: number      // km
    calories: number
    workouts: Array<{ type: string; duration: number; distance?: number }>
    updatedAt: Timestamp
  }
  shareOnProfile: boolean
}
```

> **Migration note:** Phase 1 used `subscription.tier: 'free' | 'premium'` and `verified: boolean`.
> Phase 2 introduces `premium.active`, `premium.tier: 'plus' | 'pro'`, and renames `verified` to
> `photoVerified`. Update `types/user.ts` in Task 47 before any other Phase 2 task runs.

---

## ⚙️ PRE-FLIGHT: Manual Setup (Before Task 47)

These steps require your browser and third-party consoles — Codex cannot do them.

**Step A — Stripe**
1. Create a Stripe account at https://dashboard.stripe.com
2. Create two products: "fitlink Plus" and "fitlink Pro"
3. For each product, create pricing plans:
   - Monthly, 3-month, 6-month (per PRD Section 5.12 pricing table)
   - Note all Price IDs (format: `price_xxxx`) — you'll need them in `.env`
4. Enable payment methods in Stripe Dashboard: Cards, FPX (Malaysia), GrabPay
5. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
6. Add to `.env`:
   ```
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxx
   STRIPE_SECRET_KEY=sk_test_xxxx              # Cloud Functions only — never EXPO_PUBLIC_
   STRIPE_WEBHOOK_SECRET=whsec_xxxx
   STRIPE_PRICE_PLUS_MONTHLY=price_xxxx
   STRIPE_PRICE_PLUS_3MONTH=price_xxxx
   STRIPE_PRICE_PLUS_6MONTH=price_xxxx
   STRIPE_PRICE_PRO_MONTHLY=price_xxxx
   STRIPE_PRICE_PRO_3MONTH=price_xxxx
   STRIPE_PRICE_PRO_6MONTH=price_xxxx
   ```

**Step B — Strava API**
1. Create a Strava API application at https://www.strava.com/settings/api
2. Set Authorization Callback Domain to your app scheme (e.g. `fitlink`)
3. Add to `.env`:
   ```
   EXPO_PUBLIC_STRAVA_CLIENT_ID=xxxxx
   STRAVA_CLIENT_SECRET=xxxxx          # Cloud Functions only
   ```

**Step C — Google Cloud Vision API**
1. In Firebase Console → Project Settings → enable Cloud Vision API
2. Or in Google Cloud Console, enable Vision API for your Firebase project
3. No additional key needed — Cloud Functions use Application Default Credentials

**Step D — EAS Setup**
1. Install EAS CLI: `npm install -g eas-cli`
2. Log in: `eas login`
3. Configure: `eas build:configure` (creates `eas.json`)
4. Add your Apple Developer Team ID and Google Play credentials

✅ Pre-flight complete when: Stripe Price IDs in `.env`, Strava app created, EAS configured.

---

## 🏗️ PHASE 2A: Types, Schema & Dependency Updates

### Task 47 — Update TypeScript Types for Phase 2
- **File(s):** `types/user.ts`, `types/subscription.ts`
- **Action:**
  - `types/user.ts`:
    - Rename `verified: boolean` → `photoVerified: boolean` (update all references)
    - Add `verifiedAt?: Timestamp`
    - Replace `subscription: { tier: 'free' | 'premium'; expiresAt?: Timestamp }` with:
      ```typescript
      premium: {
        active: boolean
        tier: 'plus' | 'pro' | null
        subscriptionId: string | null
        expiresAt: Timestamp | null
      }
      ```
    - Add `stripeCustomerId?: string`
    - Add `fitnessTracking` field per schema above
  - `types/subscription.ts`:
    - Add `PremiumTier`: `'plus' | 'pro'`
    - Add `PremiumStatus` interface: `{ active: boolean; tier: PremiumTier | null; subscriptionId: string | null; expiresAt: Timestamp | null }`
    - Add `StripePrice` interface: `{ priceId: string; amount: number; currency: string; interval: 'month' | '3month' | '6month' }`
    - Add `FitnessTrackingSource`: `'appleHealth' | 'googleFit' | 'strava'`
    - Add `TodayStats` interface: `{ steps: number; distance: number; calories: number; workouts: WorkoutSession[]; updatedAt: Timestamp }`
    - Add `WorkoutSession` interface: `{ type: string; duration: number; distance?: number; calories?: number }`
  - Update every file that reads `user.verified` → `user.photoVerified`
  - Update every file that reads `subscription.tier === 'premium'` → `premium.active === true`
  - Run `npx tsc --noEmit` after — zero errors required before proceeding to Task 48
- **Output:** Types updated, all references migrated, tsc clean

---

### Task 48 — Install Phase 2 Dependencies
- **File(s):** `package.json`
- **Action:**
  ```bash
  npx expo install \
    @stripe/stripe-react-native \
    expo-camera \
    expo-linking \
    expo-web-browser \
    expo-auth-session \
    expo-crypto

  npm install --save-dev \
    @types/stripe__stripe-js
  ```
  For Apple Sign-In (requires development build — not Expo Go):
  ```bash
  npx expo install @invertase/react-native-apple-authentication
  ```
  Update `app.json` plugins:
  ```json
  {
    "plugins": [
      "@stripe/stripe-react-native",
      "expo-camera",
      ["@invertase/react-native-apple-authentication", {}]
    ]
  }
  ```
  Add `StripeProvider` to `App.tsx` wrapping `AppRoot`:
  ```tsx
  import { StripeProvider } from '@stripe/stripe-react-native'

  // Inside the provider tree, wrapping AppRoot:
  <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
    <AppRoot />
  </StripeProvider>
  ```
- **Output:** Dependencies installed, `StripeProvider` in place, tsc clean

---

### Task 49 — EAS Build Configuration
- **File(s):** `eas.json`, `app.json`
- **Action:**
  - Create `eas.json`:
    ```json
    {
      "cli": { "version": ">= 10.0.0" },
      "build": {
        "development": {
          "developmentClient": true,
          "distribution": "internal",
          "ios": { "simulator": true },
          "env": { "APP_ENV": "development" }
        },
        "preview": {
          "distribution": "internal",
          "env": { "APP_ENV": "staging" }
        },
        "production": {
          "autoIncrement": true,
          "env": { "APP_ENV": "production" }
        }
      },
      "submit": {
        "production": {
          "ios": {
            "appleId": "YOUR_APPLE_ID",
            "ascAppId": "YOUR_ASC_APP_ID",
            "appleTeamId": "YOUR_TEAM_ID"
          },
          "android": {
            "serviceAccountKeyPath": "./google-play-key.json",
            "track": "internal"
          }
        }
      }
    }
    ```
  - Update `app.json`:
    - `"bundleIdentifier"`: `"com.[yourname].[appname]"` (iOS)
    - `"package"`: `"com.[yourname].[appname]"` (Android)
    - `"version"`: `"1.0.0"`
    - `"buildNumber"`: `"1"` (iOS)
    - `"versionCode"`: `1` (Android)
    - Add `"scheme"`: `"fitlink"` (for deep links — Strava OAuth redirect)
  - Add `eas.json` and `google-play-key.json` to `.gitignore`
  - Document build commands in a `BUILD.md` file:
    ```markdown
    # Build Commands
    
    Development build (simulator):
    eas build --profile development --platform ios
    
    Internal distribution (device testing):
    eas build --profile preview --platform all
    
    Production:
    eas build --profile production --platform all
    eas submit --profile production --platform all
    ```
- **Output:** `eas.json` created, `app.json` has bundle IDs and scheme, `BUILD.md` documents commands

---

## 💳 PHASE 2B: Premium Subscriptions

### Task 50 — Stripe Cloud Functions
- **File(s):** `functions/src/createStripeCheckout.ts`, `functions/src/stripeWebhook.ts`
- **Action:**
  - Install in functions: `npm install stripe` inside `functions/`
  - Add to `functions/.env` (Firebase Functions config):
    ```
    STRIPE_SECRET_KEY=sk_test_xxxx
    STRIPE_WEBHOOK_SECRET=whsec_xxxx
    ```
  - `createStripeCheckout.ts` — 2nd gen callable function (`asia-southeast1`):
    1. Auth check (throw `unauthenticated` if no `request.auth`)
    2. Accept `{ priceId: string }` from request data — validate it's one of the known price IDs
    3. Get/create Stripe customer: check `users/{uid}.stripeCustomerId`, create if absent, write back
    4. Create Stripe subscription with `payment_behavior: 'default_incomplete'`, expand `latest_invoice.payment_intent`
    5. Return `{ subscriptionId, clientSecret, customerId }`
  - `stripeWebhook.ts` — 2nd gen HTTP function (`asia-southeast1`):
    1. Verify Stripe signature via `stripe.webhooks.constructEvent`
    2. Handle `customer.subscription.created` + `customer.subscription.updated`:
       - Determine tier from price ID (`plus` or `pro`)
       - Update `users/{uid}.premium`: `{ active: true, tier, subscriptionId, expiresAt }`
    3. Handle `customer.subscription.deleted`:
       - Update `users/{uid}.premium`: `{ active: false, tier: null, subscriptionId: null, expiresAt: null }`
    4. Return 200 on success, 400 on signature failure
  - Add `stripeWebhook` URL to Stripe Dashboard webhooks (document in `BUILD.md`)
  - All Firestore writes use `admin.firestore.FieldValue.serverTimestamp()` — never `new Date()`
  - All functions export from `functions/src/index.ts`
- **Output:** Functions deploy to emulator, webhook handles subscription events, Firestore updates correctly

---

### Task 51 — Subscription Store
- **File(s):** `store/subscriptionStore.ts`, `services/stripe.ts`
- **Action:**
  - `services/stripe.ts`:
    - `getStripePrices(country: string): StripePrice[]` — returns localised price list from constants (not API call — prices are hardcoded per PRD Section 5.12)
    - `createSubscription(priceId: string): Promise<{ clientSecret: string; subscriptionId: string }>` — calls `createStripeCheckout` Cloud Function
    - `getCurrency(country: string): string` — maps country to currency code per PRD Section 4.4.2
  - `store/subscriptionStore.ts`:
    - State: `isLoading: boolean`, `error: string | null`, `selectedTier: 'plus' | 'pro'`, `selectedInterval: 'month' | '3month' | '6month'`
    - Actions:
      - `setSelectedTier(tier)`
      - `setSelectedInterval(interval)`
      - `subscribe(): Promise<boolean>` — calls `stripe.createSubscription()`, initiates `presentPaymentSheet()`
      - `restorePurchases()` — stub for Phase 3 (App Store receipt validation)
    - Derive `currentPremiumStatus` from `profileStore.profile.premium`
    - Helper: `isPremium(): boolean` — `profile.premium.active === true && expiresAt > now`
- **Output:** Store and service compile, `isPremium()` returns correct value

---

### Task 52 — Premium Screen UI
- **File(s):** `app/settings/PremiumScreen.tsx`, `components/ui/PremiumBadge.tsx`
- **Action:**
  - `PremiumBadge.tsx`: Small inline badge. Props: `tier: 'plus' | 'pro'`. Plus → blue gradient label. Pro → gold gradient label. Used in Settings and Profile screens.
  - `PremiumScreen.tsx`:
    - Hero section: gradient background (primary → secondary), headline and subheadline (i18n), Lottie placeholder (use an `<Animated.View>` pulsing heart if Lottie not installed)
    - Billing period selector: 3-tab segmented control (Monthly, 3 Months, 6 Months). Show savings badge on 3-month and 6-month options.
    - Two plan cards (horizontal scroll): Plus and Pro. Each shows: price for selected interval, billed-as text, feature list with checkmarks. Pro card shows "Most Popular" badge.
    - Feature comparison table (collapsible): Free / Plus / Pro columns
    - Fixed bottom bar: "Subscribe for {price}" button — calls `subscriptionStore.subscribe()`
    - Success modal (after `subscribe()` resolves): confetti animation, "Welcome to Premium!" headline, unlocked features list, "Start Exploring" dismiss button
    - Failure: `Alert` with error message and retry option
    - Existing premium users: show current plan status, renewal date, "Manage Subscription" button (opens Stripe customer portal via `Linking.openURL`)
    - All prices from `stripe.getStripePrices(user.location.country)` — localised per PRD
    - All text through `t()`, all styles in `StyleSheet.create`
  - Wire `UpsellModal` "Upgrade Now" CTA → `navigation.navigate('Premium')` (resolves Phase 1 deferred item)
- **Output:** Premium screen renders, plan selection updates price, subscribe flow initiates Stripe payment sheet

---

### Task 53 — Stripe Payment Sheet Integration
- **File(s):** `app/settings/PremiumScreen.tsx` (update), `store/subscriptionStore.ts` (update)
- **Action:**
  - In `subscriptionStore.subscribe()`, after getting `clientSecret` from Cloud Function:
    ```typescript
    import { useStripe } from '@stripe/stripe-react-native'

    const { initPaymentSheet, presentPaymentSheet } = useStripe()

    await initPaymentSheet({
      merchantDisplayName: 'fitlink',
      paymentIntentClientSecret: clientSecret,
      allowsDelayedPaymentMethods: true,
      returnURL: 'fitlink://payment-complete',
      appearance: { colors: { primary: colors.primary } },
      defaultBillingDetails: { email: user.email },
    })

    const { error } = await presentPaymentSheet()
    if (error) throw new Error(error.message)
    ```
  - Since `useStripe` is a hook, the `initPaymentSheet`/`presentPaymentSheet` logic must live in
    `PremiumScreen.tsx` (inside the component), not in the store. Refactor `subscriptionStore.subscribe()` to return the `clientSecret` and let the screen component handle the Stripe sheet presentation.
  - Handle deep link return from payment: `fitlink://payment-complete` — use `expo-linking` `useURL()` to detect return and show success modal
  - Add `expo-linking` config to `app.json` scheme if not already set (Task 49 should have done this)
- **Output:** Full payment flow works end to end in Stripe test mode — card `4242 4242 4242 4242` succeeds, `4000 0000 0000 9995` fails gracefully

---

### Task 54 — Premium Feature Gates
- **File(s):** `store/discoveryStore.ts`, `components/discovery/UpsellModal.tsx`, `app/matches/MatchesScreen.tsx`, `app/chat/ChatScreen.tsx`
- **Action:**
  - Replace all `subscription.tier === 'premium'` checks with `subscriptionStore.isPremium()` or `profile.premium.active`
  - `discoveryStore`:
    - `swipeRight()` daily limit: differentiate upsell reason — `'likes'` when at cap, `'superLike'` when non-premium taps super like
    - Rewind action: if not premium → `showUpsell('rewind')` — new reason type
  - `UpsellModal`: Add `reason` prop handling for `'rewind'` (headline: "Rewind Your Last Swipe") and `'superLike'` (headline: "Super Like Your Favourites") — resolves Phase 1 deferred item
  - `MatchesScreen` search/filter: show `PremiumBadge` on locked features, tap → navigate to `PremiumScreen`
  - `ChatScreen` read receipts: only show blue double-tick if `isPremium()`
  - Unlimited likes: in `discoveryStore.swipeRight()`, skip daily limit check if `isPremium()`
  - Priority profile (Pro tier): no client change — handled server-side in `getDiscoveryStack` scoring
- **Output:** Premium gates work correctly for all feature categories

---

### Task 55 — Server-Side Daily Likes Enforcement (Cloud Function)
- **File(s):** `functions/src/recordSwipe.ts` (new), `store/discoveryStore.ts` (update)
- **Action:**
  - Create `recordSwipe` as a 2nd gen callable function (`asia-southeast1`):
    - Accepts `{ targetId: string; direction: 'like' | 'pass' | 'superlike' }`
    - Auth check
    - For `like` and `superlike`:
      - Run Firestore transaction: read `users/{uid}/dailyLikes/doc`, check count vs limit (50 for free, unlimited for premium), increment atomically with `FieldValue.increment(1)`, reset if `resetAt` has passed
      - If over limit: throw `HttpsError('resource-exhausted', 'daily_limit')`
      - Write to `/swipes/{uid}/likes/{targetId}` or `/swipes/{uid}/passes/{targetId}`
    - For `pass`: write directly, no limit check
    - Return `{ success: true, remainingLikes: number }`
  - Update `discoveryStore.swipeRight()` and `swipeSuperLike()` to call `recordSwipe` Cloud Function instead of writing to Firestore directly from the client
  - Update `discoveryStore.swipeLeft()` likewise
  - Handle `resource-exhausted` error code from function → trigger `showUpsell('likes')`
  - This resolves Phase 1 deferred: "Server-side cap enforcement deferred to Phase 2"
- **Constraints:** Firestore swipe writes must now happen server-side only. Remove direct client writes to `/swipes/` subcollection. Update `firestore.rules` to deny client writes to `/swipes/`.
- **Output:** Swipe writes go through Cloud Function, daily limit is transaction-safe, client-side direct writes are blocked by rules

---

## 📸 PHASE 2C: Photo Verification

### Task 56 — Photo Verification Cloud Function
- **File(s):** `functions/src/verifyProfilePhoto.ts`
- **Action:**
  - 2nd gen callable function (`asia-southeast1`)
  - Accept `{ selfieUri: string }` — the selfie has been uploaded to a temporary Storage path before calling
  - Auth check
  - Use `@google-cloud/vision` (install in functions):
    ```bash
    cd functions && npm install @google-cloud/vision
    ```
  - Logic:
    1. Get user's primary photo URL from `users/{uid}.photos[0]`
    2. Run `client.faceDetection()` on selfie — fail if no face detected or confidence < 0.8
    3. Run `client.safeSearchDetection()` on selfie — fail if `adult === 'VERY_LIKELY'`
    4. Run `client.faceDetection()` on profile photo — fail if no face
    5. Compare face landmarks — simplified scoring (see PRD 6.1.2). Return `verified: false` with `reason` string if score < 0.7
    6. On success: update `users/{uid}`: `{ photoVerified: true, verifiedAt: serverTimestamp() }`. Delete temporary selfie from Storage.
    7. Enforce max 3 attempts/day: check `/users/{uid}/verificationAttempts` subcollection doc, increment, block if >= 3
  - Return `{ verified: boolean; reason?: string }`
- **Output:** Function deploys, returns correct result for face-present and face-absent test images

---

### Task 57 — Photo Verification UI Flow
- **File(s):** `app/profile/PhotoVerificationScreen.tsx`, `components/profile/SelfieCameraView.tsx`
- **Action:**
  - `SelfieCameraView.tsx`: Uses `expo-camera`. Shows front camera preview with face oval overlay (SVG circle centered on screen). Capture button. Retake button. Request camera permission; show graceful denial state.
  - `PhotoVerificationScreen.tsx` — 3-step flow:
    1. **Instructions screen**: headline, photo guidelines list, pose examples (use static illustrations with Ionicons), "Start Verification" button
    2. **Camera screen**: renders `SelfieCameraView`. On capture:
       - Compress captured photo with `compressImage()` from `utils/imageUtils.ts`
       - Upload to `users/{uid}/verification/selfie_temp.jpg` in Storage (temporary path)
       - Call `verifyProfilePhoto` Cloud Function with Storage path
       - Show `LoadingOverlay` with message "Verifying..."
    3. **Result screen**:
       - Success: confetti, "You're Verified!" headline, blue checkmark, auto-dismiss after 3s → back to Profile
       - Failure: error reason text (from function), "Try Again" button (navigates back to camera), attempt counter ("Attempt 2 of 3")
  - After verified: `profileStore.updateProfile({ photoVerified: true })` to refresh local state
  - Navigate to `PhotoVerificationScreen` from:
    - `ProfileScreen` "Verify Now" card (only shown when `!profile.photoVerified`)
    - `SettingsScreen` verification row
  - Add `PhotoVerification` to `RootStackParamList` in `RootNavigator.tsx`
- **Output:** Full verification flow works: camera → selfie → Cloud Function → verified badge appears on profile

---

### Task 58 — Verified Badge Integration
- **File(s):** `components/discovery/SwipeCard.tsx`, `components/discovery/FullProfileModal.tsx`, `app/matches/MatchesScreen.tsx`, `app/chat/ChatScreen.tsx`, `app/profile/ProfileScreen.tsx`
- **Action:**
  - All references to `user.verified` → `user.photoVerified` (should be done after Task 47, but confirm here)
  - Ensure verified badge (blue checkmark Ionicons `checkmark-circle`) renders consistently in:
    - SwipeCard (bottom left, alongside name)
    - FullProfileModal (next to name)
    - MatchCard in grid (small overlay badge)
    - ChatScreen header (next to name)
    - Own ProfileScreen header
  - Tap verified badge anywhere → brief `Alert` or `Tooltip`: "This user's identity has been verified"
  - Discovery scoring: `getDiscoveryStack` Cloud Function already awards +2 for `photoVerified` — confirm this field name matches updated schema
- **Output:** Verified badge displays consistently across all surfaces using `photoVerified` field

---

## 🏃 PHASE 2D: Fitness Integrations

### Task 59 — Fitness Tracking Types and Store
- **File(s):** `types/fitness.ts` (new), `store/fitnessStore.ts` (new)
- **Action:**
  - `types/fitness.ts`:
    - `FitnessSource`: `'appleHealth' | 'googleFit' | 'strava'`
    - `TodayStats` interface (steps, distance, calories, workouts, updatedAt, source)
    - `WorkoutSession` interface (type, duration, distance?, calories?, elevation?)
    - `StravaActivity` interface (matching Strava API response shape)
    - `FitnessConnectionStatus` interface: `{ connected: boolean; lastSync: Timestamp | null }`
  - `store/fitnessStore.ts`:
    - State: `todayStats: TodayStats | null`, `connections: Record<FitnessSource, FitnessConnectionStatus>`, `isLoading: boolean`, `shareOnProfile: boolean`
    - Actions:
      - `fetchTodayStats()` — reads `users/{uid}.fitnessTracking.todayStats` from Firestore
      - `setShareOnProfile(enabled: boolean)` — updates Firestore `fitnessTracking.shareOnProfile`
      - `connectSource(source: FitnessSource)` — dispatches to platform-specific service
      - `disconnectSource(source: FitnessSource)` — clears tokens, updates Firestore
      - `syncNow(source: FitnessSource)` — triggers appropriate sync
    - Persist: `shareOnProfile` and `connections` to AsyncStorage
- **Output:** Store and types compile with zero errors

---

### Task 60 — Strava OAuth Integration
- **File(s):** `services/strava.ts`, `functions/src/exchangeStravaToken.ts`, `functions/src/syncStravaActivity.ts`
- **Action:**
  - `services/strava.ts`:
    - `connectStrava(): Promise<boolean>`:
      1. Build Strava OAuth URL with `expo-auth-session` `makeRedirectUri` and `expo-web-browser` `openAuthSessionAsync`
      2. Parse `code` from redirect response URL
      3. Call `exchangeStravaToken` Cloud Function with `{ code }`
      4. Update `fitnessStore.connections.strava`
      5. Return `true` on success
    - `syncStrava(): Promise<TodayStats>`: calls `syncStravaActivity` Cloud Function
    - `disconnectStrava(): Promise<void>`: updates Firestore to clear Strava tokens and `connected: false`
  - `functions/src/exchangeStravaToken.ts` — 2nd gen callable (`asia-southeast1`):
    - Accept `{ code: string }`
    - Exchange code for tokens via `https://www.strava.com/oauth/token` (POST)
    - Encrypt refresh token using Node.js `crypto.createCipheriv` (AES-256-CBC, key from env)
    - Write to `users/{uid}.fitnessTracking.strava`: `{ connected: true, accessToken, refreshToken: encrypted, expiresAt, lastSync: serverTimestamp() }`
    - Add `STRAVA_CLIENT_SECRET` and `STRAVA_TOKEN_ENCRYPTION_KEY` to `functions/.env`
  - `functions/src/syncStravaActivity.ts` — 2nd gen callable (`asia-southeast1`):
    - Refresh Strava token if expired (decrypt refresh token, re-encrypt new one, store back)
    - Fetch activities from last 7 days via Strava API
    - Calculate today's stats (distance km, calories, workouts array)
    - Write to `users/{uid}.fitnessTracking.todayStats` with `serverTimestamp()`
    - Return `TodayStats`
- **Constraints:** Strava `client_secret` and encryption key are Cloud Function environment variables only — never in client bundle.
- **Output:** Strava OAuth flow completes, tokens stored encrypted, today's stats sync to Firestore

---

### Task 61 — Apple Health Integration (iOS)
- **File(s):** `services/healthKit.ts`, `hooks/useAppleHealth.ts`
- **Action:**
  - Install: `npx expo install react-native-health`
  - Add to `app.json` plugins: `"react-native-health"` with required permissions
  - `services/healthKit.ts`:
    - `isAvailable(): boolean` — `Platform.OS === 'ios'` guard
    - `requestPermissions(): Promise<boolean>` — `AppleHealthKit.initHealthKit()` with Steps, DistanceWalkingRunning, ActiveEnergyBurned, Workout permissions
    - `fetchTodayStats(): Promise<TodayStats>` — reads steps, distance (m → km), active calories, workout sessions for today
    - `updateFirestore(uid: string, stats: TodayStats): Promise<void>` — writes to `users/{uid}.fitnessTracking.todayStats`
    - `setConnected(uid: string, connected: boolean): Promise<void>` — updates `fitnessTracking.appleHealth.connected` and `lastSync`
  - `hooks/useAppleHealth.ts`:
    - Calls `healthKit.requestPermissions()` on mount (iOS only — `Platform.OS !== 'ios'` early return)
    - Auto-syncs on foreground (`AppState` listener)
    - Exposes `{ isConnected, todayStats, sync, disconnect }`
  - Integrate into `fitnessStore.connectSource('appleHealth')` and `syncNow('appleHealth')`
- **Constraints:** Every `healthKit` call must be guarded with `Platform.OS === 'ios'`. Never call on Android.
- **Output:** Apple Health permissions requested on iOS, today's stats fetch and write to Firestore

---

### Task 62 — Google Fit Integration (Android)
- **File(s):** `services/googleFit.ts`, `hooks/useGoogleFit.ts`
- **Action:**
  - Install: `npx expo install react-native-google-fit`
  - `services/googleFit.ts`:
    - `isAvailable(): boolean` — `Platform.OS === 'android'` guard
    - `requestPermissions(): Promise<boolean>` — `GoogleFit.authorize()` with `FITNESS_ACTIVITY_READ`, `FITNESS_LOCATION_READ`, `FITNESS_BODY_READ` scopes
    - `fetchTodayStats(): Promise<TodayStats>` — getDailyStepCountSamples, getDailyDistanceSamples, getDailyCalorieSamples, getActivitySamples for today
    - `updateFirestore(uid, stats)` and `setConnected(uid, connected)` — same pattern as healthKit
  - `hooks/useGoogleFit.ts` — same pattern as `useAppleHealth` but Android-only guard
  - Integrate into `fitnessStore`
- **Constraints:** Every `googleFit` call guarded with `Platform.OS === 'android'`. Never call on iOS.
- **Output:** Google Fit permissions requested on Android, today's stats sync to Firestore

---

### Task 63 — Fitness Activity Display on Profiles
- **File(s):** `components/profile/TodayActivityCard.tsx`, `components/discovery/FullProfileModal.tsx`, `app/profile/ProfileScreen.tsx`
- **Action:**
  - `TodayActivityCard.tsx`:
    - Props: `stats: TodayStats`, `source: FitnessSource`, `isOwn: boolean`
    - Displays: 👟 Steps, 🔥 Calories, 📏 Distance (km) in a horizontal row
    - Shows most recent workout if `stats.workouts.length > 0`: "{type} — {duration} min"
    - Source logo placeholder text (Strava / Apple Health / Google Fit)
    - "Last updated {relative time}" below
    - If `isOwn`: tap → detailed breakdown modal stub
    - No stats? Return `null` (render nothing)
  - `FullProfileModal.tsx`:
    - Add "Today's Activity" section after "Shared Interests" — only render if:
      1. The viewed user has `fitnessTracking.shareOnProfile === true`
      2. `fitnessTracking.todayStats` exists and `updatedAt` is within last 24h
    - Render `<TodayActivityCard stats={...} source={...} isOwn={false} />`
  - `ProfileScreen.tsx`:
    - Add "Today's Activity" card section (always visible to own user regardless of `shareOnProfile`)
    - "Connected Apps" row below: lists connected sources with green dot, "Sync Now" button
    - "Share activity on profile" toggle → `fitnessStore.setShareOnProfile()`
  - `SwipeCard.tsx`: show "Active today" chip badge if `todayStats.updatedAt` is within last 24h and `shareOnProfile === true`
- **Output:** Activity card renders with live data, toggle controls sharing, "Active today" badge appears in discovery

---

### Task 64 — Connected Apps Settings Screen
- **File(s):** `app/settings/ConnectedAppsScreen.tsx`
- **Action:**
  - New screen in Settings navigator: "Connected Apps"
  - List of integrations:
    - **Apple Health** (iOS only — `Platform.OS === 'ios'`):
      - Toggle: connected / not connected
      - Last synced timestamp
      - "Sync Now" button (calls `fitnessStore.syncNow('appleHealth')`, shows brief spinner)
    - **Google Fit** (Android only — `Platform.OS === 'android'`):
      - Same layout as Apple Health
    - **Strava** (both platforms):
      - "Connect" button → `strava.connectStrava()` (if not connected)
      - "Disconnect" button with confirmation alert (if connected)
      - Last synced timestamp + "Sync Now"
  - Share settings section:
    - "Show activity on profile" toggle → `fitnessStore.setShareOnProfile()`
    - Helper text: "Your today's activity stats will be visible to your matches"
  - Navigate to this screen from `SettingsScreen` "Connected Apps" row
  - Add `ConnectedApps` to navigation param list
  - All text through `t()`, all platform guards with `Platform.OS`
- **Output:** Connected Apps screen shows correct integrations per platform, connect/disconnect/sync all work

---

## 🔧 PHASE 2E: Auth Production Fixes

### Task 65 — Google Sign-In Production Flow
- **File(s):** `services/firebase/auth.ts`, `app/auth/LandingScreen.tsx`
- **Action:**
  - Replace `signInWithPopup` (Expo Go only) with `expo-auth-session` + `makeRedirectUri` flow:
    ```typescript
    import * as Google from 'expo-auth-session/providers/google'
    import * as WebBrowser from 'expo-web-browser'

    WebBrowser.maybeCompleteAuthSession()

    export const signInWithGoogle = async (): Promise<UserCredential> => {
      const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
      })
      // ... handle response, exchange for Firebase credential
    }
    ```
  - Since `Google.useAuthRequest` is a hook, it cannot live in `auth.ts`. Refactor:
    - `auth.ts`: export `signInWithGoogleCredential(idToken: string): Promise<UserCredential>` — takes the token from the hook and signs in
    - `LandingScreen.tsx`: use `Google.useAuthRequest` hook, call `promptAsync()` on button tap, on response call `auth.signInWithGoogleCredential(idToken)`
  - Add to `.env.example`:
    ```
    EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO=xxxx.apps.googleusercontent.com
    EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=xxxx.apps.googleusercontent.com
    EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=xxxx.apps.googleusercontent.com
    ```
- **Output:** Google Sign-In works in development builds (not Expo Go), no `signInWithPopup` in codebase

---

### Task 66 — Apple Sign-In Production Flow
- **File(s):** `services/firebase/auth.ts`, `app/auth/LandingScreen.tsx`
- **Action:**
  - Replace stub with `@invertase/react-native-apple-authentication`:
    ```typescript
    import appleAuth from '@invertase/react-native-apple-authentication'
    import { OAuthProvider, signInWithCredential } from 'firebase/auth'

    export const signInWithApple = async (): Promise<UserCredential> => {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      })

      const { identityToken, nonce } = appleAuthRequestResponse
      if (!identityToken) throw new AppError('apple-auth-failed', 'Apple Sign In failed')

      const provider = new OAuthProvider('apple.com')
      const credential = provider.credential({ idToken: identityToken, rawNonce: nonce })
      return signInWithCredential(auth, credential)
    }
    ```
  - Guard with `appleAuth.isSupported` check
  - This requires a **development build** — document in `BUILD.md` that Apple Sign-In cannot be tested in Expo Go
- **Output:** Apple Sign-In works in development builds on physical iOS device, stub removed

---

### Task 67 — Firebase Crashlytics Integration
- **File(s):** `services/crashlytics.ts`, `components/ui/ErrorBoundary.tsx`, `app.json`
- **Action:**
  - Install: `npx expo install @react-native-firebase/app @react-native-firebase/crashlytics`
  - Add to `app.json` plugins: `"@react-native-firebase/app"`, `"@react-native-firebase/crashlytics"`
  - `services/crashlytics.ts`:
    - `logError(error: Error, context?: Record<string, string>): void` — wraps `crashlytics().recordError(error)`, sets custom attributes if context provided
    - `setUser(uid: string): void` — `crashlytics().setUserId(uid)` — called after login
    - `log(message: string): void` — `crashlytics().log(message)` for breadcrumbs
  - `ErrorBoundary.tsx`: replace `console.error` in `componentDidCatch` with `crashlytics.logError(error, { componentStack: info.componentStack })`
  - Call `crashlytics.setUser(uid)` in `authStore` after successful login
  - This resolves Phase 1 deferred: "Crashlytics integration deferred to Phase 2"
- **Constraints:** `@react-native-firebase` requires a development build — document in `BUILD.md`. Cannot test in Expo Go.
- **Output:** Error boundary logs to Crashlytics, user ID tagged on login

---

## 🔒 PHASE 2F: Security Hardening

### Task 68 — Update Firestore Security Rules for Phase 2
- **File(s):** `firestore.rules`
- **Action:** Add/update rules for Phase 2 collections and changed write patterns:
  - `/swipes/{userId}/likes/{targetId}` and `/swipes/{userId}/passes/{targetId}`:
    - **Deny all client writes** (writes now go through `recordSwipe` Cloud Function)
    - Read: still allowed for own userId or targetId
  - `/users/{userId}`:
    - Deny client writes to `premium.*`, `photoVerified`, `verifiedAt`, `banned`, `age` (server-only)
    - Allow client writes to `fitnessTracking.shareOnProfile` (user preference toggle)
    - Deny client writes to `fitnessTracking.strava.*` (tokens managed by Cloud Function only)
    - Allow client writes to `fitnessTracking.appleHealth.connected` and `fitnessTracking.googleFit.connected` (set locally on permission grant)
  - `/users/{userId}/verificationAttempts` (document):
    - Deny all client reads/writes (managed by `verifyProfilePhoto` Cloud Function)
  - `/users/{userId}/dailyLikes` (document):
    - Deny all client writes (managed by `recordSwipe` Cloud Function — resolves Phase 1 deferred)
    - Allow client reads (to display remaining count in UI)
- **Output:** Updated rules deployed to emulator, all new server-only fields protected

---

### Task 69 — Phase 2 Firestore Indexes
- **File(s):** `firestore.indexes.json`
- **Action:** Add composite indexes needed for Phase 2 queries:
  - `users`: (`premium.active` ASC, `location.city` ASC, `banned` ASC, `paused` ASC, `lastActive` DESC) — for priority profile boosting in discovery
  - `users`: (`fitnessTracking.shareOnProfile` ASC, `fitnessTracking.todayStats.updatedAt` DESC) — for "Active today" badge filtering
  - Confirm existing Phase 1 indexes still present and valid
- **Output:** `firestore.indexes.json` valid, deployable

---

## ✅ PHASE 2 DONE CHECKLIST

Before declaring Phase 2 ready for public App Store / Play Store launch:

**EAS Build**
- [ ] `eas.json` configured for development, preview, production profiles
- [ ] Development build runs on physical iOS device
- [ ] Development build runs on physical Android device
- [ ] `BUILD.md` documents all build and submit commands

**Premium Subscriptions**
- [ ] Stripe Cloud Functions deploy and pass emulator tests
- [ ] Premium screen renders with correct localised pricing
- [ ] Payment sheet opens and processes test card successfully
- [ ] Webhook updates Firestore `premium.*` within 30 seconds
- [ ] `isPremium()` gates all premium features correctly
- [ ] Unlimited likes work for premium users, daily limit still enforced for free users
- [ ] UpsellModal reasons correctly differentiated (likes / superLike / rewind)
- [ ] "Upgrade Now" CTA navigates to PremiumScreen (Phase 1 stub resolved)

**Photo Verification**
- [ ] Camera permission requested and handled gracefully on both platforms
- [ ] Selfie capture → upload → Cloud Function → result flow completes
- [ ] Verified badge displays on all profile surfaces using `photoVerified` field
- [ ] Max 3 verification attempts per day enforced server-side
- [ ] Re-verification prompt shown when primary photo changes

**Fitness Integrations**
- [ ] Strava OAuth flow completes, tokens stored encrypted in Firestore
- [ ] Apple Health permissions requested on iOS, stats sync correctly
- [ ] Google Fit permissions requested on Android, stats sync correctly
- [ ] `TodayActivityCard` renders correctly with live data
- [ ] "Active today" badge appears in discovery cards for active users
- [ ] Share toggle controls profile visibility of stats
- [ ] Connected Apps screen shows correct integrations per platform

**Auth Production Fixes**
- [ ] Google Sign-In works in development build (no `signInWithPopup`)
- [ ] Apple Sign-In works on physical iOS device (no stub)
- [ ] Crashlytics logs errors from ErrorBoundary

**Security**
- [ ] `/swipes/` client writes denied by Firestore rules
- [ ] `premium.*` and `photoVerified` denied from client writes
- [ ] `recordSwipe` Cloud Function enforces daily limit transactionally
- [ ] Phase 2 Firestore indexes deployed

**Code Quality**
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Zero `any` usage
- [ ] Zero `console.log` in client files
- [ ] All new strings through `t()` with entries in all 4 language files
- [ ] All Phase 1 deferred items resolved or explicitly re-deferred with documented reason

---

## Deferred to Phase 3

The following items are explicitly out of scope for Phase 2 and will be addressed in `TASKS_PHASE3.md`:

- Video profiles
- Voice messages in chat
- Events / gym meetups
- Gym check-ins via Google Places
- Admin moderation dashboard (web)
- App Store receipt validation for `restorePurchases()`
- SEA market expansion (Singapore, Thailand — new user regions)
- Background fetch for `lastActive` when app is fully quit
- RTL layout support (Arabic/Urdu)
- Incognito mode (Pro tier feature — UI gate exists, backend deferred)
- Profile boost (Pro tier feature — 1x per month)

---

*TASKS_PHASE2.md — [APP_NAME] | May 2026*
*Generate TASKS_PHASE3.md after Phase 2 ships.*
*Task numbers: Phase 2 runs Task 47–69 (23 tasks).*
