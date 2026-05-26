# BUILD.md — [APP_NAME]

> Build and submission reference for the EAS (Expo Application Services) pipeline.
> Update this file when adding new build profiles, environment variables, or submission steps.

---

## Prerequisites

### EAS CLI
```bash
npm install -g eas-cli
eas login          # Log in with your Expo account
eas whoami         # Confirm login
```

### One-time project link
```bash
eas build:configure    # Creates / validates eas.json, links project to EAS
```

---

## Environment Variables

All client-side env vars must use the `EXPO_PUBLIC_` prefix so Expo exposes them to the JS bundle.
Server-only vars (Stripe secret, Strava secret) are set in Firebase Functions config — never in the client bundle.

Copy `.env.example` → `.env` and fill in all values before running any build:

| Variable | Used by | Notes |
|---|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase JS SDK | From Firebase Console → Project Settings |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase JS SDK | |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase JS SDK | |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase JS SDK | |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase JS SDK | |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase JS SDK | |
| `EXPO_PUBLIC_FIREBASE_DATABASE_URL` | Realtime Database | |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe SDK | `pk_test_` for dev, `pk_live_` for production |
| `EXPO_PUBLIC_STRAVA_CLIENT_ID` | Strava OAuth | From https://www.strava.com/settings/api |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO` | Google Sign-In (Expo Go) | From Google Cloud Console |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` | Google Sign-In (iOS) | From Google Cloud Console |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID` | Google Sign-In (Android) | From Google Cloud Console |

Firebase Functions secrets (set with Firebase CLI, never exposed to the Expo client bundle):

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

Stripe price IDs are non-secret server-side Functions env vars. Keep them in `functions/.env`
for local emulator work and in the Functions deploy environment for production.

---

## Build Commands

### Development Build (Simulator — iOS)
Use this for day-to-day development when Expo Go is insufficient (Stripe, Apple Sign-In, Crashlytics, HealthKit).

```bash
eas build --profile development --platform ios
```

Output: `.tar.gz` archive — drag into the iOS Simulator.

### Development Build (Physical Device — Android)
```bash
eas build --profile development --platform android
```

Output: `.apk` — install with `adb install <file>.apk`.

### Development Build (Both Platforms)
```bash
eas build --profile development --platform all
```

---

### Preview Build (Internal Distribution — Physical Devices)
Use this for QA testing, stakeholder demos, and beta tester distribution via TestFlight / Firebase App Distribution.

```bash
# Both platforms
eas build --profile preview --platform all

# iOS only
eas build --profile preview --platform ios

# Android only
eas build --profile preview --platform android
```

iOS output: `.ipa` distributed via TestFlight internal group.
Android output: `.apk` distributed via Firebase App Distribution or direct install.

---

### Production Build (App Store + Play Store)
```bash
# Build
eas build --profile production --platform all

# Submit immediately after build
eas submit --profile production --platform all

# Or submit an existing build by ID
eas submit --profile production --platform ios --id <build-id>
eas submit --profile production --platform android --id <build-id>
```

> `autoIncrement: true` in `eas.json` bumps `buildNumber` (iOS) and `versionCode` (Android) automatically on every production build. To bump the user-visible version (`"version"` in `app.json`), update it manually before building.

---

## App Store Submission Setup

### iOS — Apple Developer Portal
1. Create App ID at https://developer.apple.com/account/resources/identifiers
   - Bundle ID: `com.fitlink.app`
   - Capabilities: Push Notifications, Sign In with Apple
2. Create App record in App Store Connect at https://appstoreconnect.apple.com
   - Note the **App ID (ascAppId)** — update `eas.json` submit → ios → `ascAppId`
3. Update `eas.json` submit block:
   ```json
   "ios": {
     "appleId": "your@email.com",
     "ascAppId": "1234567890",
     "appleTeamId": "XXXXXXXXXX"
   }
   ```

### Android — Google Play Console
1. Create app at https://play.google.com/console
2. Create a Service Account with `Release Manager` role
3. Download the service account JSON key → save as `google-play-key.json` in project root
4. `google-play-key.json` is gitignored — never commit it

---

## Features Requiring a Development Build

The following features **cannot be tested in Expo Go**. Always use a development build for these:

| Feature | Why |
|---|---|
| Stripe Payment Sheet | Native Stripe SDK — not available in Expo Go |
| Apple Sign-In | Requires native entitlement |
| Google Sign-In (production) | `expo-auth-session` native redirect |
| Firebase Crashlytics | `@react-native-firebase` native module |
| Apple HealthKit | `react-native-health` native module |
| Google Fit | `react-native-google-fit` native module |
| Push Notifications (APNs) | Requires device + APNs certificate |

---

## Stripe Setup

### Local Emulator
Copy the Functions env template and fill in at minimum `STRIPE_SECRET_KEY` and
the six `STRIPE_PRICE_*` values before calling `createStripeCheckout` locally:

```bash
cp functions/.env.example functions/.env
firebase emulators:start --only functions,firestore
```

When testing webhooks locally, forward Stripe events to the Functions emulator:

```bash
stripe listen --forward-to http://127.0.0.1:5001/YOUR_PROJECT_ID/asia-southeast1/stripeWebhook
```

Copy the printed `whsec_...` value into `functions/.env` as
`STRIPE_WEBHOOK_SECRET`.

### Webhook Endpoint
After deploying Cloud Functions, register the webhook in the Stripe Dashboard:

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://asia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net/stripeWebhook`
3. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **Signing secret** → add to Firebase Functions config:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

### Test Cards
| Card Number | Scenario |
|---|---|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Declined |
| `4000 0025 0000 3155` | 3D Secure required |
| `4000 0000 0000 0069` | Expired card |

---

## Strava OAuth Setup

The Strava redirect URI must match exactly what is registered in the Strava API dashboard.

- **Redirect URI:** `fitlink://strava-auth` (matches `"scheme": "fitlink"` in `app.json`)
- Register this URI at: https://www.strava.com/settings/api → Authorization Callback Domain
- Set the domain to `fitlink` (the scheme, not the full URI)

---

## Firebase Emulator (Local Development)

For Task 50 Stripe Cloud Functions work, run Functions with Firestore:

```bash
firebase emulators:start --only functions,firestore
```

Run the full emulator suite before testing Cloud Functions locally:

```bash
firebase emulators:start --import=./emulator-data --export-on-exit
```

Emulators used:
- Auth: port 9099
- Firestore: port 8080
- Functions: port 5001
- Storage: port 9199
- Realtime Database: port 9000

---

## Version Bump Checklist (Before Each Production Release)

- [ ] Update `"version"` in `app.json` (e.g. `"1.0.0"` → `"1.1.0"`)
- [ ] `buildNumber` and `versionCode` auto-increment via EAS — no manual change needed
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npx expo export` dry run to catch bundle errors
- [ ] Tag the release commit: `git tag v1.1.0 && git push --tags`
- [ ] Build production: `eas build --profile production --platform all`
- [ ] Submit: `eas submit --profile production --platform all`
