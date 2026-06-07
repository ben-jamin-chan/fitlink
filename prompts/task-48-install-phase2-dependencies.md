@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1 is complete (Tasks 01–46). Phase 2 has begun. Task 47 is done: all TypeScript types
have been migrated for the Phase 2 schema. The key changes from Task 47 are:

- `types/user.ts`: `verified` → `photoVerified`, `subscription` → `premium: PremiumStatus`,
  added `verifiedAt?`, `stripeCustomerId?`, `fitnessTracking?: FitnessTracking`
- `types/subscription.ts`: full rewrite with `PremiumTier`, `PremiumStatus`, `StripePrice`,
  `FitnessTrackingSource`, `WorkoutSession`, `TodayStats`, `FitnessSourceConnection`,
  `StravaConnection`, `FitnessTracking`
- All client files migrated from `subscription.tier === 'premium'` → `premium.active === true`
- All client files migrated from `user.verified` → `user.photoVerified`
- `tsc --noEmit` passes with zero errors

The following libraries are **not yet installed** and are required for Phase 2:
- `@stripe/stripe-react-native` — payment sheet UI
- `expo-camera` — selfie capture for photo verification
- `expo-linking` — deep link handling (Strava OAuth redirect, Stripe return URL)
- `expo-web-browser` — OAuth browser sessions
- `expo-auth-session` — Strava and Google OAuth flows
- `expo-crypto` — nonce generation for Apple Sign-In
- `@invertase/react-native-apple-authentication` — production Apple Sign-In

**This task is purely dependency installation and `App.tsx` wiring of `StripeProvider`.
No screens, stores, or services are built here. Those begin in Task 50.**

**Do not implement any Stripe payment logic in this task. `StripeProvider` is a wrapper
only — it takes the publishable key from `process.env` and wraps `AppRoot`. No
`initPaymentSheet`, no `presentPaymentSheet`, no other Stripe calls.**

**Do not implement any camera, OAuth, or auth logic. Those belong to Tasks 53, 60, 65, 66.**

---

## Task 48 — Install Phase 2 Dependencies

**Files to modify:**
- `package.json` — new dependencies added via install commands
- `app.json` — three new plugins added
- `App.tsx` — `StripeProvider` wraps `AppRoot`
- `.env.example` — Stripe publishable key placeholder added
- `BUILD.md` — created (new file documenting build requirements)

---

### Install commands

Run these in sequence from the project root. Do not batch into one command — run each
separately so errors are isolated:

```bash
npx expo install \
  @stripe/stripe-react-native \
  expo-camera \
  expo-linking \
  expo-web-browser \
  expo-auth-session \
  expo-crypto
```

```bash
npx expo install @invertase/react-native-apple-authentication
```

After installation, verify `package.json` contains all seven packages. Run
`npx tsc --noEmit` — it must pass with zero errors before proceeding.

---

### `app.json` — Update plugins array

Add three plugins to the existing `plugins` array. The array already contains entries from
Phase 1 (e.g. `expo-localization`, `expo-local-authentication`). Append to the existing
array — do not replace it:

```json
{
  "expo": {
    "plugins": [
      "@stripe/stripe-react-native",
      "expo-camera",
      ["@invertase/react-native-apple-authentication", {}]
    ]
  }
}
```

The `expo-camera` plugin entry must appear **before** the Apple authentication entry.
`expo-linking` and `expo-auth-session` do not require plugin entries.

Confirm the `"scheme"` key is present in `app.json` at the top level of the `"expo"` object.
If it is missing, add it:

```json
{
  "expo": {
    "scheme": "fitlink"
  }
}
```

This scheme is required for deep link return URLs used by Strava OAuth (Task 60) and
Stripe payment completion (Task 53).

---

### `App.tsx` — Add `StripeProvider`

Import `StripeProvider` from `@stripe/stripe-react-native` and wrap `AppRoot` with it.

The current provider tree in `App.tsx` is:

```tsx
<GestureHandlerRootView style={styles.root}>
  <SafeAreaProvider>
    <NavigationContainer ref={navigationRef}>
      <AppRoot />
    </NavigationContainer>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

Update it to:

```tsx
import { StripeProvider } from '@stripe/stripe-react-native'

<GestureHandlerRootView style={styles.root}>
  <SafeAreaProvider>
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}>
      <NavigationContainer ref={navigationRef}>
        <AppRoot />
      </NavigationContainer>
    </StripeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

**Placement rules:**
- `StripeProvider` must be **inside** `GestureHandlerRootView` and `SafeAreaProvider`
- `StripeProvider` must be **outside** `NavigationContainer` (so it is available to all
  screens before navigation initialises)
- `GestureHandlerRootView` remains the outermost wrapper — do not move it

**Do not** pass `merchantIdentifier` to `StripeProvider` in this task — Apple Pay
configuration is out of scope for Phase 2.

If `process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` resolves to `undefined` at runtime
during development (before `.env` is populated), the empty string fallback `''` is
acceptable — Stripe will log a warning but will not crash the app.

---

### `.env.example` — Add Stripe key placeholder

Add one new line to the existing `.env.example`. Do not remove any existing keys:

```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

This goes in `.env.example` only — never in `.env` in source control.

---

### `BUILD.md` — Create (new file)

Create `BUILD.md` in the project root with the following content exactly:

```markdown
# BUILD.md — [APP_NAME]

## Prerequisites

- EAS CLI installed: `npm install -g eas-cli`
- Logged in: `eas login`
- `.env` populated from `.env.example` with real Firebase and Stripe values
- `GoogleService-Info.plist` placed at project root (iOS)
- `google-services.json` placed at project root (Android)

## Build Commands

### Development build (iOS Simulator)
```bash
eas build --profile development --platform ios
```

### Development build (Android Emulator)
```bash
eas build --profile development --platform android
```

### Internal distribution (physical device testing)
```bash
eas build --profile preview --platform all
```

### Production build
```bash
eas build --profile production --platform all
```

### Submit to stores
```bash
eas submit --profile production --platform all
```

## Features Requiring a Development Build

The following features **cannot be tested in Expo Go** and require a development build
on a physical device:

| Feature | Reason |
|---|---|
| Apple Sign-In | `@invertase/react-native-apple-authentication` is a native module |
| Google Sign-In (production) | `expo-auth-session` redirect requires custom scheme registered in native layer |
| Firebase Crashlytics | `@react-native-firebase/crashlytics` is a native module |
| Stripe payment sheet | `@stripe/stripe-react-native` requires native Stripe SDK |
| Photo verification camera | `expo-camera` requires native camera entitlements |
| Apple Health | `react-native-health` is a native module (iOS only) |
| Google Fit | `react-native-google-fit` is a native module (Android only) |

## Stripe Webhook

After deploying Cloud Functions, register the webhook URL in the Stripe Dashboard:

```
https://{region}-{project-id}.cloudfunctions.net/stripeWebhook
```

Events to subscribe:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Copy the webhook signing secret to `functions/.env` as `STRIPE_WEBHOOK_SECRET`.

## Strava OAuth Redirect URI

When registering your Strava API application, set the Authorization Callback Domain to:

```
fitlink
```

The full redirect URI used in the app is: `fitlink://strava-auth`
```

---

## Important Architecture Notes for Codex

1. **`StripeProvider` is a wrapper only in this task.** No payment logic is implemented
   here. The `publishableKey` prop is wired and that is the entirety of the Stripe work
   in Task 48. All `initPaymentSheet`, `presentPaymentSheet`, and Cloud Function calls
   are Task 53.

2. **`GestureHandlerRootView` must remain the outermost wrapper.** Do not reorder the
   existing provider hierarchy. `StripeProvider` slots between `SafeAreaProvider` and
   `NavigationContainer` only.

3. **`expo-camera`, `expo-linking`, `expo-web-browser`, `expo-auth-session`, `expo-crypto`
   are installed but not imported anywhere in this task.** They will be imported by their
   respective service files in Tasks 57, 60, 65, and 66.

4. **`@invertase/react-native-apple-authentication` is installed but not imported.** The
   production Apple Sign-In implementation is Task 66. The existing stub in
   `services/firebase/auth.ts` is untouched.

5. **Do not run `eas build:configure` in this task.** EAS configuration (`eas.json`) is
   Task 49. This task only installs packages and wires `StripeProvider`.

6. **The `"scheme": "fitlink"` value in `app.json` must be lowercase.** Expo deep link
   scheme matching is case-sensitive on Android.

---

## Acceptance Criteria

- [ ] All seven packages appear in `package.json` dependencies:
  `@stripe/stripe-react-native`, `expo-camera`, `expo-linking`, `expo-web-browser`,
  `expo-auth-session`, `expo-crypto`, `@invertase/react-native-apple-authentication`
- [ ] `app.json` plugins array includes `"@stripe/stripe-react-native"`, `"expo-camera"`,
  and `["@invertase/react-native-apple-authentication", {}]`
- [ ] `app.json` has `"scheme": "fitlink"` at the top level of the `"expo"` object
- [ ] `App.tsx` imports `StripeProvider` from `@stripe/stripe-react-native`
- [ ] `StripeProvider` wraps `NavigationContainer` with `publishableKey` from
  `process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''`
- [ ] Provider order is: `GestureHandlerRootView` → `SafeAreaProvider` → `StripeProvider`
  → `NavigationContainer` → `AppRoot`
- [ ] `.env.example` contains `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=` (no value)
- [ ] `BUILD.md` created at project root with all sections populated
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No new `any` types introduced
- [ ] No Stripe payment logic, no camera logic, no OAuth logic in any file

---

## Do Not Touch

`types/user.ts`, `types/subscription.ts`, `types/match.ts`, `types/message.ts`,
`constants/`, `i18n/`, `firestore.rules`, `firestore.indexes.json`,
`services/firebase/auth.ts`, `store/authStore.ts`, `store/discoveryStore.ts`,
`store/profileStore.ts`, `functions/`

---

## Commit

```
git commit -m "task-48: install phase 2 dependencies, wire StripeProvider"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2A — Task 48] — YYYY-MM-DD

### Completed

- Task 48: Phase 2 dependencies installed, StripeProvider wired in App.tsx
- Installed: @stripe/stripe-react-native, expo-camera, expo-linking, expo-web-browser,
  expo-auth-session, expo-crypto, @invertase/react-native-apple-authentication
- app.json: three plugins added, scheme "fitlink" confirmed
- App.tsx: StripeProvider wraps NavigationContainer with publishable key from env
- BUILD.md: created with build commands, feature requirements, Stripe webhook setup

### Files Created / Modified

- package.json: seven new Phase 2 dependencies added
- app.json: @stripe/stripe-react-native, expo-camera, @invertase/react-native-apple-authentication plugins added; scheme: "fitlink" confirmed
- App.tsx: StripeProvider imported and added to provider tree
- .env.example: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY placeholder added
- BUILD.md: created — build commands, development-build-only feature list, Stripe webhook and Strava redirect URI docs

### Architecture Decisions

- StripeProvider placed inside SafeAreaProvider but outside NavigationContainer — available
  to all screens without needing navigation context
- publishableKey falls back to empty string if env not populated — logs a Stripe warning
  but does not crash; acceptable for development before .env is configured

### Known Issues / Deferred

- None — this is a pure installation task, no runtime behaviour changes

### Next Up

- Task 49: EAS Build configuration (eas.json, app.json bundle identifiers, BUILD.md commands)
```
