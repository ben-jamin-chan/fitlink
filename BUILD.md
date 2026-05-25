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
