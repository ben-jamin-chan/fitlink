@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2B begins here. Tasks 47–49 are complete:

- `types/user.ts` — `UserProfile` updated; `premium: PremiumStatus` replaces old `subscription`; `photoVerified` replaces `verified`; `stripeCustomerId?: string` added; `fitnessTracking?: FitnessTracking` added
- `types/subscription.ts` — full rewrite; exports `PremiumTier`, `PremiumStatus`, `StripePrice`, `FitnessTrackingSource`, `WorkoutSession`, `TodayStats`, `FitnessSourceConnection`, `StravaConnection`, `FitnessTracking`
- `services/firebase/config.ts` — exports `app`, `auth`, `db`, `storage`, `rtdb`
- `store/profileStore.ts` — `profile.premium.active` is the gate for premium features; `stripeCustomerId` is a server-only field never written from the client
- `eas.json` — development, preview, production build profiles configured
- `app.json` — scheme `fitlink` confirmed; bundle IDs `com.fitlink.app` set
- `functions/src/onUserCreated.ts`, `functions/src/onSwipeCreated.ts`, `functions/src/getDiscoveryStack.ts` — exist from Phase 1, use the **2nd gen** function API (`onCall` from `firebase-functions/v2/https`, `CallableRequest`)

**What does NOT exist yet:**
- `functions/src/createStripeCheckout.ts` — create in this task
- `functions/src/stripeWebhook.ts` — create in this task
- `functions/src/index.ts` — may exist with Phase 1 exports; update to add new exports

**Critical constraints pre-empted:**

> **`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are Cloud Function environment variables only.** They are never prefixed `EXPO_PUBLIC_`, never read from the client bundle, and never logged anywhere. They live exclusively in `functions/.env` (local emulator) and Firebase Functions secrets (production).

> **All Firestore writes inside Cloud Functions use `admin.firestore.FieldValue.serverTimestamp()`** — never `new Date()` or `Timestamp.now()`.

> **All Cloud Functions use `region('asia-southeast1')` and the 2nd gen API** — the `request: CallableRequest` pattern, not the v1 `(data, context)` pattern.

> **`createStripeCheckout` must validate the incoming `priceId`** against a hardcoded allowlist of known price IDs before calling Stripe. Do not create subscriptions for arbitrary price IDs.

> **`stripeWebhook` must verify the Stripe signature before processing any event.** If verification fails, return HTTP 400 immediately.

> **The webhook handler must use `req.rawBody`** (a `Buffer` provided by Firebase Functions) for Stripe signature verification. Do not use `JSON.parse(req.body)` for the verification step.

---

## Task 50 — Stripe Cloud Functions (`createStripeCheckout`, `stripeWebhook`)

**Files to create:**
- `functions/src/createStripeCheckout.ts`
- `functions/src/stripeWebhook.ts`

**Files to modify:**
- `functions/package.json` — add `stripe` dependency
- `functions/.env` — add Stripe secrets (template only — actual values filled by developer)
- `functions/.env.example` — add Stripe secret key placeholders (committed to git)
- `functions/src/index.ts` — export the two new functions

---

### Step 0 — Install Stripe in the functions package

Run this from inside the `functions/` directory:

```bash
cd functions && npm install stripe
```

Also install types:

```bash
npm install --save-dev @types/stripe
```

Confirm `functions/package.json` now lists `"stripe"` under `dependencies`.

---

### `functions/.env.example`

Add the following lines to the existing `functions/.env.example` (or create it if absent). These are committed to git as documentation — no real values:

```
STRIPE_SECRET_KEY=sk_test_
STRIPE_WEBHOOK_SECRET=whsec_
STRIPE_PRICE_PLUS_MONTHLY=price_
STRIPE_PRICE_PLUS_3MONTH=price_
STRIPE_PRICE_PLUS_6MONTH=price_
STRIPE_PRICE_PRO_MONTHLY=price_
STRIPE_PRICE_PRO_3MONTH=price_
STRIPE_PRICE_PRO_6MONTH=price_
```

Add the same keys (with empty values) to `functions/.env` so the local emulator can start. The developer fills in real values before testing.

---

### `functions/src/createStripeCheckout.ts`

This is a **2nd gen HTTP callable function** that creates a Stripe subscription for an authenticated user and returns the `clientSecret` needed by the Stripe Payment Sheet on the client.

**Flow:**
1. Authenticate the caller — throw `unauthenticated` if `request.auth` is absent
2. Validate `priceId` against the allowlist of known price IDs from `process.env`
3. Read the calling user's Firestore doc to get their existing `stripeCustomerId`
4. If no `stripeCustomerId`: create a Stripe customer, write `stripeCustomerId` back to Firestore
5. Create a Stripe subscription with `payment_behavior: 'default_incomplete'` and expand `latest_invoice.payment_intent`
6. Return `{ subscriptionId, clientSecret, customerId }`

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import Stripe from 'stripe'

// Initialise admin only once across all functions
if (admin.apps.length === 0) {
  admin.initializeApp()
}

/**
 * Returns the set of valid Stripe price IDs sourced from Cloud Function
 * environment variables. Called at request time so env vars are always fresh.
 */
const getAllowedPriceIds = (): Set<string> => {
  const ids = [
    process.env.STRIPE_PRICE_PLUS_MONTHLY,
    process.env.STRIPE_PRICE_PLUS_3MONTH,
    process.env.STRIPE_PRICE_PLUS_6MONTH,
    process.env.STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_PRO_3MONTH,
    process.env.STRIPE_PRICE_PRO_6MONTH,
  ].filter((id): id is string => typeof id === 'string' && id.length > 0)

  return new Set(ids)
}

/**
 * Determines the premium tier ('plus' | 'pro') from a Stripe price ID.
 * Matches on the env var values at runtime — no string pattern matching on price IDs.
 */
const getTierFromPriceId = (priceId: string): 'plus' | 'pro' => {
  const proIds = new Set([
    process.env.STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_PRO_3MONTH,
    process.env.STRIPE_PRICE_PRO_6MONTH,
  ])
  return proIds.has(priceId) ? 'pro' : 'plus'
}

export const createStripeCheckout = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<{ priceId: string }>) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to subscribe.')
    }

    const uid = request.auth.uid
    const { priceId } = request.data

    // 2. Validate priceId against allowlist
    if (typeof priceId !== 'string' || !getAllowedPriceIds().has(priceId)) {
      throw new HttpsError('invalid-argument', 'Invalid price ID.')
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      throw new HttpsError('internal', 'Stripe is not configured.')
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

    // 3. Get or create Stripe customer
    const userRef = admin.firestore().doc(`users/${uid}`)
    const userSnap = await userRef.get()

    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.')
    }

    const userData = userSnap.data() as Record<string, unknown>
    let customerId = typeof userData.stripeCustomerId === 'string'
      ? userData.stripeCustomerId
      : null

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { firebaseUID: uid },
        ...(typeof userData.email === 'string' ? { email: userData.email } : {}),
      })
      customerId = customer.id

      // 4. Write customerId back — server timestamp for lastActive touch
      await userRef.update({
        stripeCustomerId: customerId,
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    // 5. Create subscription (incomplete — payment not collected yet)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        firebaseUID: uid,
        tier: getTierFromPriceId(priceId),
      },
    })

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null

    if (!paymentIntent?.client_secret) {
      throw new HttpsError('internal', 'Failed to create payment intent.')
    }

    // 6. Return to client — client uses clientSecret to present Stripe Payment Sheet
    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
      customerId,
    }
  }
)
```

---

### `functions/src/stripeWebhook.ts`

This is a **2nd gen HTTP (non-callable) endpoint** that receives Stripe webhook events and updates Firestore accordingly. It must verify the Stripe signature on every request before processing.

**Handles:**
- `customer.subscription.created` — activate premium in Firestore
- `customer.subscription.updated` — update tier or status
- `customer.subscription.deleted` — deactivate premium in Firestore

```typescript
import { onRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import Stripe from 'stripe'

// Guard against double-init if index.ts already called initializeApp()
if (admin.apps.length === 0) {
  admin.initializeApp()
}

/**
 * Maps a Stripe customer ID to a Firebase UID via Firestore query.
 * Returns null if no user is found.
 */
const findUserByCustomerId = async (
  customerId: string
): Promise<string | null> => {
  const snapshot = await admin
    .firestore()
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get()

  if (snapshot.empty) return null
  return snapshot.docs[0].id
}

/**
 * Determines tier label from a subscription's price IDs.
 * Falls back to 'plus' if price ID does not match a known Pro price.
 */
const getTierFromSubscription = (subscription: Stripe.Subscription): 'plus' | 'pro' => {
  const priceId = subscription.items.data[0]?.price?.id ?? ''
  const proIds = new Set([
    process.env.STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_PRO_3MONTH,
    process.env.STRIPE_PRICE_PRO_6MONTH,
  ])
  return proIds.has(priceId) ? 'pro' : 'plus'
}

export const stripeWebhook = onRequest(
  { region: 'asia-southeast1' },
  async (req, res) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripeSecretKey || !webhookSecret) {
      console.error('stripeWebhook: Stripe env vars not configured.')
      res.sendStatus(500)
      return
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
    const sig = req.headers['stripe-signature']

    if (!sig) {
      res.status(400).send('Missing stripe-signature header.')
      return
    }

    let event: Stripe.Event

    try {
      // req.rawBody is a Buffer provided by Firebase Functions — required for signature verification
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('stripeWebhook: signature verification failed:', message)
      res.status(400).send(`Webhook signature verification failed: ${message}`)
      return
    }

    // ── Handle subscription lifecycle events ──────────────────────────────────

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id

      const uid = await findUserByCustomerId(customerId)
      if (!uid) {
        console.error('stripeWebhook: no user found for customer:', customerId)
        res.sendStatus(200) // Acknowledge to Stripe — not our user
        return
      }

      const tier = getTierFromSubscription(subscription)
      const isActive = subscription.status === 'active' || subscription.status === 'trialing'
      const expiresAt = admin.firestore.Timestamp.fromMillis(
        subscription.current_period_end * 1000
      )

      await admin.firestore().doc(`users/${uid}`).update({
        'premium.active': isActive,
        'premium.tier': isActive ? tier : null,
        'premium.subscriptionId': subscription.id,
        'premium.expiresAt': isActive ? expiresAt : null,
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
      })

      console.log(`stripeWebhook: premium updated for uid=${uid} tier=${tier} active=${isActive}`)
      res.sendStatus(200)
      return
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id

      const uid = await findUserByCustomerId(customerId)
      if (!uid) {
        console.error('stripeWebhook: no user found for customer:', customerId)
        res.sendStatus(200)
        return
      }

      await admin.firestore().doc(`users/${uid}`).update({
        'premium.active': false,
        'premium.tier': null,
        'premium.subscriptionId': null,
        'premium.expiresAt': null,
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
      })

      console.log(`stripeWebhook: premium cancelled for uid=${uid}`)
      res.sendStatus(200)
      return
    }

    // Acknowledge all other event types without processing
    res.sendStatus(200)
  }
)
```

---

### `functions/src/index.ts` — Update

Add the two new exports alongside the existing Phase 1 exports. Do not remove or modify any existing export.

```typescript
// Add these two lines to the existing Phase 1 exports:
export { createStripeCheckout } from './createStripeCheckout'
export { stripeWebhook } from './stripeWebhook'
```

The existing Phase 1 exports (`onUserCreated`, `onSwipeCreated`, `getDiscoveryStack`, `onNewMessage`, `moderatePhoto`, `moderateBio`, `checkReportThreshold`) must remain unchanged.

---

## Important Architecture Notes for Codex

1. **2nd gen function signatures only.** `onCall` from `firebase-functions/v2/https` receives a single `request: CallableRequest` object. The caller's UID is at `request.auth.uid`. There is no `context` parameter. Never use the v1 `(data, context)` pattern.

2. **`admin.initializeApp()` guard.** Both files contain `if (admin.apps.length === 0) { admin.initializeApp() }`. This prevents duplicate initialisation when multiple function files are bundled together via `functions/src/index.ts`. Do not remove this guard from either file.

3. **`req.rawBody` is mandatory for webhook signature verification.** Firebase Functions automatically populates `req.rawBody` as a `Buffer`. Using `JSON.parse(req.body)` instead would break HMAC verification and allow unsigned events to be processed. Never modify or parse `rawBody` before passing it to `stripe.webhooks.constructEvent`.

4. **Stripe API version must be pinned.** Both files specify `{ apiVersion: '2023-10-16' }` in the Stripe constructor. Do not omit this — Stripe's TypeScript SDK requires it for type safety.

5. **`getTierFromPriceId` / `getTierFromSubscription` use env var comparisons, not string pattern matching.** Price IDs are opaque strings (e.g. `price_1P...`). Never try to infer tier from the ID format. Always compare against the known env var values.

6. **`findUserByCustomerId` queries Firestore — it is an async operation.** It must be `await`-ed. The result may be `null` if Stripe fires a webhook for a customer that has since been deleted from Firestore. In that case, respond with HTTP 200 to prevent Stripe retrying.

7. **Subscription `status` can be `'trialing'` as well as `'active'`.** The `isActive` check covers both: `subscription.status === 'active' || subscription.status === 'trialing'`. A trialing user should have full premium access.

8. **No `console.log` with PII.** Log UIDs and tier labels for debugging. Never log email addresses, names, or Stripe customer objects directly.

9. **`functions/.env` is gitignored.** The template `functions/.env.example` is committed. The developer must copy it to `functions/.env` and populate real values. Add a comment in `functions/.env.example` reminding them to do this.

10. **Cloud Functions must be deployed before Task 53 (Stripe Payment Sheet).** The client cannot call `createStripeCheckout` until it is live in the emulator or production. Document the emulator start command in `BUILD.md` if not already there: `firebase emulators:start --only functions,firestore`.

---

## Acceptance Criteria

- [ ] `functions/src/createStripeCheckout.ts` created and exports `createStripeCheckout` as a named export
- [ ] `functions/src/stripeWebhook.ts` created and exports `stripeWebhook` as a named export
- [ ] Both functions export with `{ region: 'asia-southeast1' }`
- [ ] `createStripeCheckout` uses `onCall` from `firebase-functions/v2/https` with `CallableRequest` — not the v1 API
- [ ] `stripeWebhook` uses `onRequest` from `firebase-functions/v2/https`
- [ ] `createStripeCheckout` throws `HttpsError('unauthenticated')` when `request.auth` is null
- [ ] `createStripeCheckout` throws `HttpsError('invalid-argument')` when `priceId` is not in the allowlist
- [ ] `stripeWebhook` returns HTTP 400 if `stripe-signature` header is missing
- [ ] `stripeWebhook` returns HTTP 400 if `stripe.webhooks.constructEvent` throws (signature mismatch)
- [ ] `stripeWebhook` uses `req.rawBody` (not `req.body`) for signature verification
- [ ] `customer.subscription.created` and `customer.subscription.updated` correctly update `users/{uid}.premium.*` in Firestore
- [ ] `customer.subscription.deleted` sets `premium.active: false`, `premium.tier: null`, `premium.subscriptionId: null`, `premium.expiresAt: null`
- [ ] All Firestore writes use `admin.firestore.FieldValue.serverTimestamp()` — no `new Date()`
- [ ] `admin.initializeApp()` guard present in both files
- [ ] `stripe` added to `functions/package.json` dependencies
- [ ] `functions/.env.example` updated with all 8 Stripe env var keys
- [ ] `functions/src/index.ts` exports both new functions alongside existing Phase 1 exports
- [ ] `npx tsc --noEmit` inside `functions/` passes with zero errors
- [ ] Zero `any` usage in both new files
- [ ] No `console.log` with email addresses or Stripe customer objects
- [ ] No Stripe secrets referenced anywhere in client-side files (`app/`, `components/`, `store/`, `hooks/`, `services/`)

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/profileStore.ts`, `services/firebase/config.ts`,
`types/user.ts`, `types/subscription.ts`, `types/match.ts`, `types/message.ts`,
`constants/`, `i18n/`, `firestore.rules`, `eas.json`,
`functions/src/onUserCreated.ts`, `functions/src/onSwipeCreated.ts`,
`functions/src/getDiscoveryStack.ts`, `functions/src/onNewMessage.ts`,
`functions/src/moderatePhoto.ts`, `functions/src/moderateBio.ts`,
`functions/src/checkReportThreshold.ts`

---

## Commit

```
git commit -m "task-50: stripe cloud functions createStripeCheckout and stripeWebhook"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2B — Task 50] — YYYY-MM-DD

### Completed

- Task 50: Stripe Cloud Functions implemented
- createStripeCheckout: 2nd gen callable function, creates Stripe subscription, returns clientSecret
- stripeWebhook: 2nd gen HTTP function, verifies Stripe signature, handles subscription lifecycle events
- stripe npm package installed in functions/
- functions/.env.example updated with all 8 Stripe env var keys

### Files Created / Modified

- functions/src/createStripeCheckout.ts: created — onCall function, price allowlist validation, get/create Stripe customer, create subscription, return clientSecret
- functions/src/stripeWebhook.ts: created — onRequest function, signature verification via req.rawBody, handles created/updated/deleted subscription events
- functions/src/index.ts: two new exports added
- functions/package.json: stripe added to dependencies
- functions/.env.example: 8 Stripe env var key placeholders added

### Architecture Decisions

- getTierFromPriceId compares against env var values, not string patterns — price IDs are opaque
- findUserByCustomerId uses a Firestore query (not a cache) — ensures correctness over performance for low-frequency webhook events
- Both files guard admin.initializeApp() with apps.length check — safe for multi-function bundle
- stripeWebhook acknowledges unknown event types with HTTP 200 to prevent Stripe retry storms

### Known Issues / Deferred

- Stripe webhook URL must be registered in Stripe Dashboard after first Functions deployment (documented in BUILD.md)
- functions/.env must be populated with real Stripe test keys before emulator testing

### Next Up

- Task 51: Subscription Store (store/subscriptionStore.ts, services/stripe.ts)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 51 prompt.

---

## Reasoning Level

High — Cloud Functions with Stripe integration, signature verification, Firestore transactions, and security-sensitive environment variable handling.
