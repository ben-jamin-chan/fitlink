@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2A is in progress. Tasks 47 and 48 are complete:

- `types/user.ts` — Phase 2 schema live; `photoVerified`, `premium`, `fitnessTracking` fields present
- `types/subscription.ts` — `PremiumTier`, `PremiumStatus`, `TodayStats`, `WorkoutSession`, `StravaConnection`, `FitnessTracking` all exported
- `package.json` — Phase 2 dependencies installed: `@stripe/stripe-react-native`, `expo-camera`, `expo-linking`, `expo-web-browser`, `expo-auth-session`, `expo-crypto`, `@invertase/react-native-apple-authentication`
- `app.json` — plugins array includes `@stripe/stripe-react-native`, `expo-camera`, Apple Sign-In entitlement. Scheme `"fitlink"` is already set.
- `App.tsx` — `StripeProvider` wraps the provider tree with `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `.env.example` — `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` placeholder present
- `BUILD.md` — created in Task 48 with initial build commands; this task expands it significantly

**This task is purely configuration and documentation — no runtime application code changes.** No changes to any file under `app/`, `components/`, `store/`, `services/`, `hooks/`, `types/`, `constants/`, `utils/`, or `i18n/`. Do not touch those directories.

**The `eas.json` file does not exist yet.** Create it fresh — do not attempt to update a non-existent file.

**`app.json` already has `"scheme": "fitlink"` set from Task 48.** Do not remove or change it. Only add the fields listed below (bundle identifiers, version, build numbers).

**`BUILD.md` already exists from Task 48.** Replace its contents entirely with the expanded version defined in this task — do not append or partially merge.

---

## Task 49 — EAS Build Configuration

**Files to create:**
- `eas.json`

**Files to modify:**
- `app.json` — add bundle identifiers, version, and build number fields only
- `BUILD.md` — full replacement with expanded build, submit, and ops documentation
- `.gitignore` — add `google-play-key.json` and `eas.json` secrets note

---

### `eas.json`

Create this file at the project root. It defines three build profiles: `development` (simulator + device, development client), `preview` (internal distribution, physical device testing), and `production` (store submission, auto-increment build numbers).

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "APP_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "APP_ENV": "staging"
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "APP_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID_EMAIL",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_APPLE_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "internal"
      }
    }
  }
}
```

> **Note:** The three placeholder strings (`YOUR_APPLE_ID_EMAIL`, `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_APPLE_TEAM_ID`) are intentional — the developer fills these in before their first production submission. Leave them exactly as shown.

---

### `app.json` — Update

Add the following fields only. Do not modify anything else — specifically do not touch `"scheme"`, `"plugins"`, or the existing `"ios.entitlements"` block added in Task 48.

Under `"expo.ios"`, add:
```json
"bundleIdentifier": "com.fitlink.app",
"buildNumber": "1"
```

Under `"expo.android"`, add:
```json
"package": "com.fitlink.app",
"versionCode": 1
```

Under `"expo"` (top level), ensure the following is present (add if missing, do not change if already present):
```json
"version": "1.0.0"
```

The resulting `ios` block (showing only the fields relevant to this task, existing fields stay):
```json
"ios": {
  "bundleIdentifier": "com.fitlink.app",
  "buildNumber": "1",
  "supportsTablet": true,
  "entitlements": {
    "com.apple.developer.applesignin": ["Default"]
  }
}
```

The resulting `android` block:
```json
"android": {
  "package": "com.fitlink.app",
  "versionCode": 1,
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  }
}
```

> **Bundle ID choice:** `com.fitlink.app` is used throughout. If the developer has already registered a different bundle ID with Apple/Google, they replace this value — the string itself is a placeholder.

---

### `BUILD.md` — Full Replacement

Replace the entire contents of `BUILD.md` with the following:

```markdown
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

EAS secret env vars (set via `eas secret:create` — not in `.env`):

```bash
eas secret:create --scope project --name STRIPE_SECRET_KEY --value sk_live_xxxx
eas secret:create --scope project --name STRAVA_CLIENT_SECRET --value xxxx
eas secret:create --scope project --name STRAVA_TOKEN_ENCRYPTION_KEY --value xxxx
```

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
```

---

### `.gitignore` — Update

Add the following lines to the existing `.gitignore`. Do not remove any existing entries.

```
# EAS / Play Store credentials
google-play-key.json

# EAS local overrides (if any)
.eas/
```

> `eas.json` itself is **not** gitignored — it contains no secrets (secrets go via `eas secret:create`). Only `google-play-key.json` (the Play Store service account key) is ignored.

---

## Important Architecture Notes for Codex

1. **No application code changes in this task.** Nothing under `app/`, `components/`, `store/`, `services/`, `hooks/`, `types/`, `constants/`, `utils/`, or `i18n/` is touched. If any of those directories appear in a diff, that is architectural drift.

2. **Bundle ID is `com.fitlink.app` throughout.** Use it in both `ios.bundleIdentifier` and `android.package` in `app.json`. It must be identical in both places.

3. **`"scheme": "fitlink"` is already set in `app.json` from Task 48.** Do not add it again or change it. The Strava redirect URI `fitlink://strava-auth` and Stripe return URL `fitlink://payment-complete` both depend on this scheme.

4. **`autoIncrement: true` applies to the production profile only.** Development and preview builds do not auto-increment — this is intentional so simulator/device test builds don't exhaust build numbers.

5. **`eas.json` is committed to git.** It contains no secrets. All secret values (`STRIPE_SECRET_KEY`, `STRAVA_CLIENT_SECRET`, etc.) are set via `eas secret:create` or Firebase Functions config — never written into `eas.json` or `.env`.

6. **`google-play-key.json` must be gitignored.** It is a service account private key. Committing it would be a security incident.

7. **`BUILD.md` is a full replacement.** Do not append to the Task 48 version — overwrite it entirely with the content specified above.

8. **Do not run `eas build:configure`** — the prompt documents it as a prerequisite CLI command for the developer to run manually, not something Codex executes. Codex only creates/modifies files.

---

## Acceptance Criteria

- [ ] `eas.json` created at project root with `development`, `preview`, and `production` build profiles
- [ ] `eas.json` `submit.production.ios` block has the three placeholder strings (`YOUR_APPLE_ID_EMAIL`, `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_APPLE_TEAM_ID`) — not empty strings, not removed
- [ ] `app.json` has `"bundleIdentifier": "com.fitlink.app"` under `ios`
- [ ] `app.json` has `"buildNumber": "1"` under `ios`
- [ ] `app.json` has `"package": "com.fitlink.app"` under `android`
- [ ] `app.json` has `"versionCode": 1` under `android`
- [ ] `app.json` has `"version": "1.0.0"` at the top-level `expo` object
- [ ] `app.json` existing `"scheme": "fitlink"` and `"plugins"` array are unchanged
- [ ] `app.json` existing `ios.entitlements` block from Task 48 is unchanged
- [ ] `BUILD.md` contains all seven sections: Prerequisites, Environment Variables, Build Commands, App Store Submission Setup, Features Requiring a Development Build, Stripe Setup, Strava OAuth Setup, Firebase Emulator, Version Bump Checklist
- [ ] `.gitignore` has `google-play-key.json` and `.eas/` entries
- [ ] No files under `app/`, `components/`, `store/`, `services/`, `hooks/`, `types/`, `constants/`, `utils/`, or `i18n/` are modified
- [ ] `npx tsc --noEmit` passes with zero errors after this task (no TS changes, so this is a sanity check)

---

## Do Not Touch

`App.tsx`, `store/`, `services/`, `components/`, `app/`, `hooks/`, `types/`, `constants/`, `utils/`, `i18n/`, `firestore.rules`, `firestore.indexes.json`, `babel.config.js`, `tsconfig.json`, `package.json`

---

## Commit

```
git commit -m "task-49: EAS build configuration, bundle identifiers, expanded BUILD.md"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2A — Task 49] — YYYY-MM-DD

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
```

---

## Reasoning Level

Low — configuration files and documentation only, no logic or state management.
