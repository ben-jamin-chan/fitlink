# CODEX PROMPT — Task 71: Stripe Customer Portal Cloud Function

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3 has begun. Task 70 (Phase 3 type scaffolding) is complete:
- `types/user.ts` — Phase 3 optional fields appended (`timezone`, `incognito`, `boost`, `videoProfile`, denormalised gym check-in); all existing Phase 2 fields unchanged
- `types/event.ts` — `EventLocation`, `FitlinkEvent`, `EventRSVPStatus`, `EventWithAttendeeProfiles` exported
- `types/checkin.ts` — `GymCheckin`, `GymPlace` exported

Existing Cloud Functions in `functions/src/` (all 2nd gen, all exported from `functions/src/index.ts`):
- `createStripeCheckout.ts` — callable, creates Stripe subscription, returns `clientSecret`; uses `stripe` npm package and `STRIPE_SECRET_KEY` from `functions/.env`
- `stripeWebhook.ts` — HTTP, verifies Stripe signature, handles subscription lifecycle, updates `users/{uid}.premium.*`
- `recordSwipe.ts` — callable, Firestore transaction, daily-like cap enforcement
- `verifyProfilePhoto.ts` — callable, Cloud Vision face detection
- `exchangeStravaToken.ts` — callable, Strava OAuth token exchange, AES-256-CBC encryption
- `syncStravaActivity.ts` — callable, Strava activity fetch, token refresh
- `onNewMessage.ts` — RTDB trigger, Expo push notification delivery
- `onPrimaryPhotoChanged.ts` — Firestore trigger, clears `photoVerified`/`verifiedAt` on primary photo change
- `onUserCreated.ts` — Auth trigger, calculates `age`, sets default `premium` fields
- `unmatchUser.ts` — callable, deletes match + RTDB chat
- `getDiscoveryStack.ts` — callable, scored candidate query, premium-leading index

Existing client files relevant to this task:
- `app/settings/PremiumScreen.tsx` — "Manage Subscription" button for existing premium users currently calls `Linking.openURL(process.env.EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL ?? '')`. This is the **placeholder** that Task 71 replaces with an authenticated Cloud Function call.
- `store/subscriptionStore.ts` — `isPremium()` helper; `subscribe()` action calls `createStripeCheckout` then presents payment sheet
- `services/stripe.ts` — `createSubscription()` wraps the `createStripeCheckout` callable; `getCurrency()` and `getStripePrices()` helpers
- `i18n/en.json` — `premium.*` keys exist; `premium.portal.*` keys do not yet exist

**The problem this task solves:** The Stripe Customer Portal must be opened with an authenticated session URL generated server-side for the specific Stripe customer. A static public URL from an env var sends all users to the same generic portal without pre-authentication, which fails for users who have not previously set a default payment method or whose portal session has expired. The correct pattern is: client calls a Cloud Function → function creates a Stripe Billing Portal session for `stripeCustomerId` with a `return_url` → function returns `{ url }` → client opens the URL via `Linking.openURL`.

**Architectural boundary: `EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL` must be completely removed from the billing portal flow.** The env var itself can remain in `.env.example` as a commented-out legacy note, but `PremiumScreen.tsx` must no longer read it for the "Manage Subscription" action. The new flow is always Cloud Function → URL → `Linking.openURL`.

---

## Task 71 — Stripe Customer Portal Cloud Function

**Files to create:**
- `functions/src/createCustomerPortalSession.ts`

**Files to modify:**
- `functions/src/index.ts` — export `createCustomerPortalSession`
- `services/stripe.ts` — add `openCustomerPortal()` helper that calls the new callable
- `app/settings/PremiumScreen.tsx` — wire "Manage Subscription" to `openCustomerPortal()` instead of the env-var `Linking.openURL` placeholder
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `premium.portal.*` i18n keys

---

### `functions/src/createCustomerPortalSession.ts`

> 2nd-gen callable Cloud Function (`asia-southeast1`). Authenticated users with an active Stripe subscription call this to receive a one-time Stripe Billing Portal session URL pre-authenticated for their account. The function reads `stripeCustomerId` from the caller's Firestore user document, creates a portal session via the Stripe API, and returns the session URL. The client opens the URL with `Linking.openURL`.

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import Stripe from 'stripe'

// Return URL the Stripe portal redirects to after the user closes or completes an action.
// Deep-link back into the app using the registered scheme.
const PORTAL_RETURN_URL = 'fitlink://premium'

export const createCustomerPortalSession = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest): Promise<{ url: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to manage subscription.')
    }

    const uid = request.auth.uid

    // Retrieve stripeCustomerId from Firestore — never trust client-supplied IDs
    const userSnap = await admin.firestore().doc(`users/${uid}`).get()
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User document not found.')
    }

    const stripeCustomerId = userSnap.get('stripeCustomerId') as string | undefined
    if (!stripeCustomerId) {
      throw new HttpsError(
        'failed-precondition',
        'No Stripe customer record found. Please subscribe first.',
      )
    }

    // Initialise Stripe with the secret key from Cloud Function environment
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      throw new HttpsError('internal', 'Stripe configuration missing.')
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' })

    // Create an authenticated Stripe Billing Portal session for this customer
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: PORTAL_RETURN_URL,
    })

    return { url: session.url }
  },
)
```

---

### `functions/src/index.ts` — Update

> Add the new `createCustomerPortalSession` export alongside the existing function exports. Do not touch any other export or import.

```typescript
// Add this import alongside the existing function imports:
export { createCustomerPortalSession } from './createCustomerPortalSession'

// All existing exports remain exactly as they are — do not modify them:
// export { createStripeCheckout } from './createStripeCheckout'
// export { stripeWebhook } from './stripeWebhook'
// export { recordSwipe } from './recordSwipe'
// ... etc.
```

> Do not touch the existing exports. Only append the new export line.

---

### `services/stripe.ts` — Update

> Add `openCustomerPortal()` as a new named export. This function calls `createCustomerPortalSession`, receives the one-time URL, and opens it with `Linking`. It throws an `AppError`-shaped error on failure so `PremiumScreen` can display a translated error to the user.
>
> Do not touch the existing `createSubscription()`, `getStripePrices()`, or `getCurrency()` functions.

```typescript
// Add these imports at the top of the existing import block:
import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions'
import { Linking } from 'react-native'
// Note: 'firebase/functions' is already installed as part of the firebase package.

// Add the following named export after the existing exports:

export const openCustomerPortal = async (): Promise<void> => {
  const functions = getFunctions()
  const createPortalSession = httpsCallable<Record<string, never>, { url: string }>(
    functions,
    'createCustomerPortalSession',
  )

  const result: HttpsCallableResult<{ url: string }> = await createPortalSession({})
  const { url } = result.data

  if (!url) {
    throw new Error('portal_url_missing')
  }

  const canOpen = await Linking.canOpenURL(url)
  if (!canOpen) {
    throw new Error('portal_url_not_openable')
  }

  await Linking.openURL(url)
}
```

> **Important:** `getFunctions()` uses the Firebase app already initialised in `services/firebase/config.ts`. No second Firebase app initialisation is needed.

---

### `app/settings/PremiumScreen.tsx` — Update

> Replace the placeholder `Linking.openURL(process.env.EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL ?? '')` call with a call to `openCustomerPortal()` from `services/stripe.ts`. Show a loading indicator while the Cloud Function is in flight. Show a translated error `Alert` on failure. Do not touch any other part of the screen — plan cards, billing period selector, payment sheet logic, or StyleSheet must remain unchanged.

```typescript
// Add to the existing import from '@/services/stripe':
import { openCustomerPortal, createSubscription, getStripePrices, getCurrency } from '@/services/stripe'

// Add a new local state variable alongside any existing useState calls:
const [isPortalLoading, setIsPortalLoading] = useState<boolean>(false)

// Replace the existing handleManageSubscription (or inline Linking.openURL call) with:
const handleManageSubscription = async (): Promise<void> => {
  setIsPortalLoading(true)
  try {
    await openCustomerPortal()
  } catch {
    Alert.alert(
      t('premium.portal.errorTitle'),
      t('premium.portal.errorMessage'),
    )
  } finally {
    setIsPortalLoading(false)
  }
}

// Replace the "Manage Subscription" Button's onPress prop:
// Before:
//   onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL ?? '')}
// After:
//   onPress={handleManageSubscription}
//   loading={isPortalLoading}
//   disabled={isPortalLoading}

// Remove the now-unused reference to process.env.EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL
// and any Linking import that was used only for the portal (keep Linking if used elsewhere).
```

> Do not touch the payment sheet flow, the plan cards, the billing period selector, the success modal, or the StyleSheet. Only the "Manage Subscription" button handler and its loading state change.

---

### `i18n/en.json` — Update

> Add `premium.portal.*` keys inside the existing `premium` namespace. Do not modify any existing keys.

```json
// Inside the existing "premium" object, add:
"portal": {
  "errorTitle": "Could Not Open Portal",
  "errorMessage": "We were unable to open the subscription management portal. Please try again."
}
```

---

### `i18n/my.json` — Update

> Mirror the same keys with English placeholder values until native translations are provided.

```json
"portal": {
  "errorTitle": "Could Not Open Portal",
  "errorMessage": "We were unable to open the subscription management portal. Please try again."
}
```

---

### `i18n/zh.json` — Update

```json
"portal": {
  "errorTitle": "Could Not Open Portal",
  "errorMessage": "We were unable to open the subscription management portal. Please try again."
}
```

---

### `i18n/ta.json` — Update

```json
"portal": {
  "errorTitle": "Could Not Open Portal",
  "errorMessage": "We were unable to open the subscription management portal. Please try again."
}
```

---

## Important Architecture Notes for Codex

1. **`stripeCustomerId` must come from Firestore only — never from the client request.** The Cloud Function reads the customer ID from `admin.firestore().doc('users/${uid}')` using the authenticated `request.auth.uid`. If the client passes a `customerId` in the request body, it must be ignored entirely. This prevents impersonation attacks.

2. **No `EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL` in the portal flow.** The env var was a Phase 2 placeholder. After this task, the "Manage Subscription" button must not reference `process.env.EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL`. Remove every reference to that env var from `PremiumScreen.tsx`. The env var may remain as a commented-out note in `.env.example` for documentation purposes only.

3. **`PORTAL_RETURN_URL` uses the deep-link scheme `fitlink://premium`.** This scheme is already registered in `app.json` from Task 49 (EAS build configuration). The Stripe portal will redirect back to the app after the user finishes. No additional `expo-linking` handler is needed for this task — the app simply returns to foreground.

4. **2nd-gen callable function signature only.** The function must use `onCall` from `firebase-functions/v2/https` with `{ region: 'asia-southeast1' }` option, and `CallableRequest` type for the parameter. Do not use the v1 `functions.https.onCall` signature.

5. **`stripe` package is already installed in `functions/`.** The `createStripeCheckout.ts` function from Task 50 already added `stripe` to `functions/package.json`. Do not re-install it. Do not run `npm install stripe` again. Only add the new file and export.

6. **`getFunctions()` in `services/stripe.ts` uses the default Firebase app.** The Firebase app is initialised once in `services/firebase/config.ts`. `getFunctions()` with no argument picks it up automatically. Do not import or call `initializeApp()` again.

7. **Error handling in `openCustomerPortal` catches all errors with a bare `catch`.** The catch clause must be typeless (`catch`) — do not annotate it as `catch (error: unknown)` and then re-inspect, since the error message is not surfaced to the user anyway. The user always sees the translated `premium.portal.errorMessage` regardless of the underlying failure.

8. **All Cloud Function server-side errors use `HttpsError` only.** Never `throw new Error(...)` from inside the Cloud Function — the Stripe SDK may throw its own errors, so wrap the `stripe.billingPortal.sessions.create` call in a try/catch and rethrow as `HttpsError('internal', ...)` with no raw Stripe error details exposed.

---

## Acceptance Criteria

- [ ] `functions/src/createCustomerPortalSession.ts` created and exports `createCustomerPortalSession` as a named export
- [ ] `createCustomerPortalSession` is a 2nd-gen `onCall` function with `region: 'asia-southeast1'`
- [ ] Function throws `HttpsError('unauthenticated')` when `request.auth` is absent
- [ ] Function throws `HttpsError('failed-precondition')` when `stripeCustomerId` is absent from the user document
- [ ] `stripeCustomerId` is read from Firestore server-side using `request.auth.uid` — not from `request.data`
- [ ] `stripe.billingPortal.sessions.create` call is wrapped in try/catch that rethrows as `HttpsError('internal')`
- [ ] `functions/src/index.ts` exports `createCustomerPortalSession` — no other exports modified
- [ ] `services/stripe.ts` exports `openCustomerPortal()` as a named export — existing exports untouched
- [ ] `openCustomerPortal()` calls `httpsCallable` with the function name `'createCustomerPortalSession'`
- [ ] `openCustomerPortal()` calls `Linking.openURL(url)` with the URL returned by the Cloud Function
- [ ] `app/settings/PremiumScreen.tsx` "Manage Subscription" button uses `handleManageSubscription` — no reference to `process.env.EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL` remains in the file
- [ ] `isPortalLoading` state controls `loading` and `disabled` props on the "Manage Subscription" button
- [ ] `premium.portal.errorTitle` and `premium.portal.errorMessage` keys added to all four i18n files (`en.json`, `my.json`, `zh.json`, `ta.json`)
- [ ] All user-facing strings in `PremiumScreen.tsx` use `t()` — no new hardcoded English text
- [ ] All styles in `StyleSheet.create({})` — no new inline `style={{ }}` in JSX
- [ ] All imports in `services/stripe.ts` and `app/settings/PremiumScreen.tsx` use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task
- [ ] `npm --prefix functions run build` passes with zero errors after this task

---

## Do Not Touch

`types/user.ts`, `types/event.ts`, `types/checkin.ts`, `store/subscriptionStore.ts`,
`store/authStore.ts`, `store/profileStore.ts`, `services/firebase/config.ts`,
`services/firebase/auth.ts`, `functions/src/createStripeCheckout.ts`,
`functions/src/stripeWebhook.ts`, `functions/src/recordSwipe.ts`,
`functions/src/onPrimaryPhotoChanged.ts`, `functions/src/onUserCreated.ts`,
`functions/src/exchangeStravaToken.ts`, `functions/src/syncStravaActivity.ts`,
`functions/src/unmatchUser.ts`, `functions/src/getDiscoveryStack.ts`,
`functions/src/verifyProfilePhoto.ts`, `functions/src/onNewMessage.ts`,
`firestore.rules`, `firestore.indexes.json`, `constants/`, `app.json`, `eas.json`

---

## Commit

```
git commit -m "task-71: stripe customer portal cloud function and client wiring"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3A — Task 71] — YYYY-MM-DD

### Completed

- Task 71: Stripe Customer Portal Cloud Function
- createCustomerPortalSession: 2nd-gen callable (asia-southeast1); reads stripeCustomerId server-side, creates Stripe Billing Portal session, returns one-time URL
- openCustomerPortal(): new named export in services/stripe.ts; calls callable, opens URL via Linking
- PremiumScreen: "Manage Subscription" button wired to openCustomerPortal() with loading state; EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL placeholder removed from portal flow
- i18n: premium.portal.errorTitle and premium.portal.errorMessage added to all 4 language files

### Files Created / Modified

- functions/src/createCustomerPortalSession.ts: created — onCall function, Firestore stripeCustomerId lookup, Stripe portal session creation, returns { url }
- functions/src/index.ts: createCustomerPortalSession export appended
- services/stripe.ts: openCustomerPortal() named export added
- app/settings/PremiumScreen.tsx: handleManageSubscription wired to openCustomerPortal(), isPortalLoading state, EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL reference removed
- i18n/en.json, my.json, zh.json, ta.json: premium.portal.* keys added

### Architecture Decisions

- stripeCustomerId is always read from Firestore server-side using request.auth.uid to prevent impersonation
- Stripe portal return URL uses fitlink://premium deep-link scheme registered in app.json (Task 49)
- openCustomerPortal() catches all errors and surfaces only the translated premium.portal.errorMessage to the user

### Known Issues / Deferred

- Stripe Billing Portal must be enabled and configured in the Stripe Dashboard before this function returns a valid URL in production

### Next Up

- Task 72: [Next Phase 3 task]
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

Extra High

> Extra High because this task involves an atomic change across a Cloud Function (server-side Stripe API call with authentication guard), a client-side service wrapper, a screen component update (removing a live env-var reference), and i18n parity across four files — any one of which broken would leave the billing portal non-functional or introduce a security regression where client-supplied customer IDs are trusted.
