# CODEX PROMPT — Task 51: Subscription Store
# [APP_NAME] — Phase 2B: Premium Subscriptions

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2B is underway. Task 50 (Stripe Cloud Functions) is complete. The following are confirmed available:

- `functions/src/createStripeCheckout.ts` — 2nd gen callable; accepts `{ priceId: string }`, returns `{ subscriptionId, clientSecret, customerId }`
- `functions/src/stripeWebhook.ts` — handles `customer.subscription.created/updated/deleted`, updates `users/{uid}.premium.*` in Firestore
- `types/user.ts` — `UserProfile` has `premium: PremiumStatus` and `stripeCustomerId?: string`
- `types/subscription.ts` — exports `PremiumTier`, `PremiumStatus`, `StripePrice`, `FitnessTrackingSource`, `WorkoutSession`, `TodayStats`, `FitnessSourceConnection`, `StravaConnection`, `FitnessTracking`
- `store/profileStore.ts` — `profile: UserProfile | null`, `updateProfile(partial)`, server-controlled fields (`premium`, `photoVerified`, etc.) are excluded from client writes
- `store/authStore.ts` — `user: FirebaseUser | null`, `isAuthenticated: boolean`
- `store/discoveryStore.ts` — references `profile.premium.active` for premium gates (migrated in Task 47); `showUpsellModal` action exists
- `app/settings/SettingsScreen.tsx` — has a "Upgrade to Premium" placeholder banner; reads `profile.premium.active`
- `services/firebase/firestore.ts` — `createUserProfile()` and `updateUserProfile()` exported; Firestore `db` instance exported from `services/firebase/config.ts`
- `constants/theme.ts` — re-exports `colors`, `spacing`, `typography`
- `i18n/en.json` — add all new i18n keys for this task before referencing them in code

**What does NOT yet exist (Task 51 creates these):**
- `services/stripe.ts` — does not exist
- `store/subscriptionStore.ts` — does not exist

**Key architectural boundary:** The `initPaymentSheet` / `presentPaymentSheet` Stripe SDK calls are React hooks (`useStripe`) and **must not** live in `services/stripe.ts` or `store/subscriptionStore.ts`. Those hooks can only be called inside a React component. Task 51's store must store the `clientSecret` in state so that the screen component (built in Task 52/53) can drive the Stripe sheet. This is explicitly required by TASKS_PHASE2.md Task 53.

**Pricing data is hardcoded per PRD Section 5.12.** No Stripe Prices API call is made to fetch prices — they are returned from a local constant keyed by country.

---

## Task 51 — Subscription Store

**Files to create:**
- `services/stripe.ts`
- `store/subscriptionStore.ts`

**Files to modify:**
- `types/subscription.ts` — add `amountDisplay: string` to `StripePrice` if not already present
- `i18n/en.json` — add `subscription.*` keys
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — mirror new keys with English placeholder values
- `.env.example` — append 6 `EXPO_PUBLIC_STRIPE_PRICE_*` keys

---

### `services/stripe.ts`

Pure service module — no React hooks, no Zustand. Responsible for:
1. Mapping a user's country to a currency code
2. Returning the hardcoded price list for a given country (per PRD Section 5.12)
3. Calling the `createStripeCheckout` Cloud Function and returning the result

```typescript
// 1. Firebase imports
import { getFunctions, httpsCallable } from 'firebase/functions'

// 2. Internal — types
import type { StripePrice } from '@/types/subscription'

// ─────────────────────────────────────────────
// Local types (internal to this file)
// ─────────────────────────────────────────────

type BillingInterval = 'month' | '3month' | '6month'
type PremiumTierKey = 'plus' | 'pro'

interface PricingEntry {
  amount: number         // in smallest currency unit (e.g. sen for MYR)
  amountDisplay: string  // formatted display string e.g. "RM 29.90"
  currency: string
  interval: BillingInterval
  priceId: string        // read from process.env EXPO_PUBLIC_ vars
}

interface CreateCheckoutResult {
  clientSecret: string
  subscriptionId: string
  customerId: string
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  Malaysia: 'MYR',
  Singapore: 'SGD',
  Thailand: 'THB',
  Philippines: 'PHP',
  Indonesia: 'IDR',
  Vietnam: 'VND',
} as const

const DEFAULT_CURRENCY = 'MYR'

// Per PRD Section 5.12 — all prices hardcoded, priceId from env vars
const PRICING_TABLE: Record<
  string,
  Record<PremiumTierKey, Record<BillingInterval, PricingEntry>>
> = {
  MYR: {
    plus: {
      month:   { amount: 2990,  amountDisplay: 'RM 29.90',  currency: 'MYR', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY ?? '' },
      '3month':{ amount: 8091,  amountDisplay: 'RM 80.91',  currency: 'MYR', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH ?? '' },
      '6month':{ amount: 14352, amountDisplay: 'RM 143.52', currency: 'MYR', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH ?? '' },
    },
    pro: {
      month:   { amount: 4990,  amountDisplay: 'RM 49.90',  currency: 'MYR', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '' },
      '3month':{ amount: 13473, amountDisplay: 'RM 134.73', currency: 'MYR', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH ?? '' },
      '6month':{ amount: 23952, amountDisplay: 'RM 239.52', currency: 'MYR', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH ?? '' },
    },
  },
  SGD: {
    plus: {
      month:   { amount: 1290,  amountDisplay: 'S$12.90',   currency: 'SGD', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY ?? '' },
      '3month':{ amount: 3483,  amountDisplay: 'S$34.83',   currency: 'SGD', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH ?? '' },
      '6month':{ amount: 6192,  amountDisplay: 'S$61.92',   currency: 'SGD', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH ?? '' },
    },
    pro: {
      month:   { amount: 1990,  amountDisplay: 'S$19.90',   currency: 'SGD', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '' },
      '3month':{ amount: 5373,  amountDisplay: 'S$53.73',   currency: 'SGD', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH ?? '' },
      '6month':{ amount: 9552,  amountDisplay: 'S$95.52',   currency: 'SGD', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH ?? '' },
    },
  },
  THB: {
    plus: {
      month:   { amount: 29900,  amountDisplay: '฿299',     currency: 'THB', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY ?? '' },
      '3month':{ amount: 80700,  amountDisplay: '฿807',     currency: 'THB', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH ?? '' },
      '6month':{ amount: 143500, amountDisplay: '฿1,435',   currency: 'THB', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH ?? '' },
    },
    pro: {
      month:   { amount: 49900,  amountDisplay: '฿499',     currency: 'THB', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '' },
      '3month':{ amount: 134700, amountDisplay: '฿1,347',   currency: 'THB', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH ?? '' },
      '6month':{ amount: 239500, amountDisplay: '฿2,395',   currency: 'THB', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH ?? '' },
    },
  },
  PHP: {
    plus: {
      month:   { amount: 49900,  amountDisplay: '₱499',     currency: 'PHP', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY ?? '' },
      '3month':{ amount: 134700, amountDisplay: '₱1,347',   currency: 'PHP', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH ?? '' },
      '6month':{ amount: 239500, amountDisplay: '₱2,395',   currency: 'PHP', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH ?? '' },
    },
    pro: {
      month:   { amount: 79900,  amountDisplay: '₱799',     currency: 'PHP', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '' },
      '3month':{ amount: 215700, amountDisplay: '₱2,157',   currency: 'PHP', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH ?? '' },
      '6month':{ amount: 383500, amountDisplay: '₱3,835',   currency: 'PHP', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH ?? '' },
    },
  },
  IDR: {
    plus: {
      month:   { amount: 12900000, amountDisplay: 'Rp 129,000', currency: 'IDR', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY ?? '' },
      '3month':{ amount: 34830000, amountDisplay: 'Rp 348,300', currency: 'IDR', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH ?? '' },
      '6month':{ amount: 61920000, amountDisplay: 'Rp 619,200', currency: 'IDR', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH ?? '' },
    },
    pro: {
      month:   { amount: 19900000, amountDisplay: 'Rp 199,000', currency: 'IDR', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '' },
      '3month':{ amount: 53730000, amountDisplay: 'Rp 537,300', currency: 'IDR', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH ?? '' },
      '6month':{ amount: 95520000, amountDisplay: 'Rp 955,200', currency: 'IDR', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH ?? '' },
    },
  },
  VND: {
    plus: {
      month:   { amount: 24900000,  amountDisplay: '₫249,000',   currency: 'VND', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY ?? '' },
      '3month':{ amount: 67230000,  amountDisplay: '₫672,300',   currency: 'VND', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH ?? '' },
      '6month':{ amount: 119520000, amountDisplay: '₫1,195,200', currency: 'VND', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH ?? '' },
    },
    pro: {
      month:   { amount: 39900000,  amountDisplay: '₫399,000',   currency: 'VND', interval: 'month',   priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '' },
      '3month':{ amount: 107730000, amountDisplay: '₫1,077,300', currency: 'VND', interval: '3month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH ?? '' },
      '6month':{ amount: 191520000, amountDisplay: '₫1,915,200', currency: 'VND', interval: '6month',  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH ?? '' },
    },
  },
}

// ─────────────────────────────────────────────
// Exported functions
// ─────────────────────────────────────────────

/**
 * Maps a user's country string to an ISO 4217 currency code.
 * Falls back to MYR if country is not in the SEA market map.
 */
export const getCurrency = (country: string): string =>
  COUNTRY_CURRENCY_MAP[country] ?? DEFAULT_CURRENCY

/**
 * Returns the full localised price table for a given country.
 * Returns MYR prices as fallback if country is unmapped.
 */
export const getStripePrices = (
  country: string,
): Record<PremiumTierKey, Record<BillingInterval, PricingEntry>> => {
  const currency = getCurrency(country)
  return PRICING_TABLE[currency] ?? PRICING_TABLE[DEFAULT_CURRENCY]
}

/**
 * Convenience function — returns the StripePrice for a specific tier + interval + country.
 * Used by subscriptionStore.beginSubscription() and PremiumScreen.
 */
export const getPrice = (
  country: string,
  tier: PremiumTierKey,
  interval: BillingInterval,
): StripePrice => {
  const prices = getStripePrices(country)
  const entry = prices[tier][interval]
  return {
    priceId: entry.priceId,
    amount: entry.amount,
    amountDisplay: entry.amountDisplay,
    currency: entry.currency,
    interval: entry.interval,
  }
}

/**
 * Calls the createStripeCheckout Cloud Function.
 * Returns clientSecret, subscriptionId, customerId.
 *
 * NOTE: This function does NOT call initPaymentSheet or presentPaymentSheet.
 * Those are Stripe React hooks and must be called from PremiumScreen (Task 52/53).
 */
export const createSubscription = async (
  priceId: string,
): Promise<CreateCheckoutResult> => {
  const functions = getFunctions()
  const createCheckout = httpsCallable<
    { priceId: string },
    CreateCheckoutResult
  >(functions, 'createStripeCheckout')

  const result = await createCheckout({ priceId })
  return result.data
}
```

---

### `store/subscriptionStore.ts`

Owns all UI state for the Premium purchase flow. Calls `services/stripe.ts` and surfaces `pendingClientSecret` for `PremiumScreen` to consume with `useStripe()`.

```typescript
// 1. Third-party libraries
import { create } from 'zustand'

// 2. Internal — services
import { createSubscription, getPrice } from '@/services/stripe'

// 3. Internal — stores (getState only — no hook import at module level)
import { useProfileStore } from '@/store/profileStore'

// 4. Internal — types
import type { PremiumTier } from '@/types/subscription'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type BillingInterval = 'month' | '3month' | '6month'

interface SubscriptionState {
  selectedTier: PremiumTier
  selectedInterval: BillingInterval
  isLoading: boolean
  error: string | null
  // clientSecret from Cloud Function — read by PremiumScreen to initiate Stripe sheet
  pendingClientSecret: string | null
  pendingSubscriptionId: string | null
}

interface SubscriptionActions {
  setSelectedTier: (tier: PremiumTier) => void
  setSelectedInterval: (interval: BillingInterval) => void
  clearError: () => void
  /**
   * Calls createStripeCheckout Cloud Function and stores the returned clientSecret
   * in pendingClientSecret. The calling screen must then call initPaymentSheet()
   * and presentPaymentSheet() via useStripe() — this store does NOT do that.
   * Returns true on success, false on error.
   */
  beginSubscription: (country: string) => Promise<boolean>
  /** Called by PremiumScreen after presentPaymentSheet() succeeds. */
  onPaymentComplete: () => void
  /** Called by PremiumScreen after presentPaymentSheet() fails or is cancelled. */
  onPaymentFailed: (errorMessage: string) => void
  /** Phase 3 stub — App Store / Play Store receipt validation. */
  restorePurchases: () => Promise<void>
  /**
   * Derives live premium status from profileStore.
   * Single source of truth — do not duplicate premium state here.
   */
  isPremium: () => boolean
}

type SubscriptionStore = SubscriptionState & SubscriptionActions

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  // ── Initial state ──
  selectedTier: 'plus',
  selectedInterval: 'month',
  isLoading: false,
  error: null,
  pendingClientSecret: null,
  pendingSubscriptionId: null,

  // ── Actions ──

  setSelectedTier: (tier) => set({ selectedTier: tier }),

  setSelectedInterval: (interval) => set({ selectedInterval: interval }),

  clearError: () => set({ error: null }),

  beginSubscription: async (country) => {
    const { selectedTier, selectedInterval } = get()
    set({ isLoading: true, error: null, pendingClientSecret: null, pendingSubscriptionId: null })

    try {
      const price = getPrice(country, selectedTier, selectedInterval)

      if (!price.priceId) {
        throw new Error('Stripe price ID is not configured. Check EXPO_PUBLIC_STRIPE_PRICE_* in .env.')
      }

      const { clientSecret, subscriptionId } = await createSubscription(price.priceId)

      set({
        isLoading: false,
        pendingClientSecret: clientSecret,
        pendingSubscriptionId: subscriptionId,
      })

      return true
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to start subscription. Please try again.'
      set({ isLoading: false, error: message, pendingClientSecret: null })
      return false
    }
  },

  onPaymentComplete: () => {
    set({ pendingClientSecret: null, pendingSubscriptionId: null, error: null })
    // profileStore picks up premium update via its Firestore listener —
    // no manual update needed here. stripeWebhook writes premium.* server-side.
  },

  onPaymentFailed: (errorMessage) => {
    set({ pendingClientSecret: null, pendingSubscriptionId: null, error: errorMessage })
  },

  restorePurchases: async () => {
    // TODO Phase 3: Implement App Store / Play Store receipt validation.
  },

  isPremium: () => {
    // Read from profileStore — single source of truth for premium status.
    const profile = useProfileStore.getState().profile
    if (!profile) return false
    const { active, expiresAt } = profile.premium
    if (!active) return false
    if (expiresAt === null) return false
    // Firestore Timestamp — compare milliseconds with current time
    return expiresAt.toMillis() > Date.now()
  },
}))
```

---

### `types/subscription.ts` — Update

Add `amountDisplay` to `StripePrice` if not already present. Check first — if it exists, skip this change.

```typescript
// Update the existing StripePrice interface to include amountDisplay:
export interface StripePrice {
  priceId: string
  amount: number
  amountDisplay: string   // formatted display string e.g. "RM 29.90", "S$12.90"
  currency: string
  interval: 'month' | '3month' | '6month'
}
```

---

### `i18n/en.json` — Update

Append the `subscription` block inside the top-level JSON object. Do not alter any existing keys.

```json
"subscription": {
  "errors": {
    "noClientSecret": "Failed to initialise payment. Please try again.",
    "paymentFailed": "Payment failed. Please check your details and try again.",
    "priceNotConfigured": "Pricing is not available at the moment. Please try again later.",
    "generic": "Something went wrong. Please try again."
  },
  "restore": "Restore Purchases",
  "restoring": "Restoring...",
  "tier": {
    "plus": "Plus",
    "pro": "Pro"
  },
  "interval": {
    "month": "Monthly",
    "3month": "3 Months",
    "6month": "6 Months"
  },
  "savings": {
    "3month": "Save 10%",
    "6month": "Save 20%"
  }
}
```

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Mirror the identical `subscription` block in each file with the same English values as placeholders. Real translations filled in separately.

---

### `.env.example` — Update

Append these lines. Do not remove existing lines.

```
# Stripe Price IDs — obtain from Stripe Dashboard after creating Plus and Pro products
# EXPO_PUBLIC_ prefix is correct — these are public identifiers, not secrets
EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY=price_
EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH=price_
EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH=price_
EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_
EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH=price_
EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH=price_
```

---

## Important Architecture Notes for Codex

1. **`pendingClientSecret` in state, not a return value.** `beginSubscription()` stores the Cloud Function result in `pendingClientSecret`. `PremiumScreen` reads this from the store after `beginSubscription()` returns `true`, then calls `initPaymentSheet()` + `presentPaymentSheet()` using `useStripe()`. This split is mandatory — hooks cannot live in Zustand stores.

2. **`isPremium()` reads `profileStore`, never local state.** `profile.premium` is the Firestore source of truth, written exclusively by `stripeWebhook`. Do not add a separate `isPremiumUser` field to `subscriptionStore`. Any component that needs a premium gate should call `useSubscriptionStore.getState().isPremium()`.

3. **No Stripe SDK imports in `services/stripe.ts` or `store/subscriptionStore.ts`.** `@stripe/stripe-react-native` exports (`useStripe`, `initPaymentSheet`, `presentPaymentSheet`) are React hooks and must only appear in React component files. They are not used in this task.

4. **`PRICING_TABLE` is the single source of truth for all prices.** Do not add price constants to `subscriptionStore` or `PremiumScreen`. Both call `getPrice()` or `getStripePrices()` from `services/stripe.ts`.

5. **Price IDs are `EXPO_PUBLIC_` env vars.** They are not secret (Stripe price IDs are public identifiers). `STRIPE_SECRET_KEY` remains in `functions/.env` only — never add it to the client `.env`.

6. **`restorePurchases` is a stub.** Add a `// TODO Phase 3` comment inside the function body. Do not implement receipt validation.

7. **No `persist` middleware.** `selectedTier` and `selectedInterval` are ephemeral UI state — intentional. Only `authStore` and `onboardingStore` use AsyncStorage persistence.

8. **`err` must be typed `unknown` in catch blocks.** Narrow before use — see `beginSubscription` scaffold above.

---

## Acceptance Criteria

- [ ] `services/stripe.ts` created, exports: `getCurrency`, `getStripePrices`, `createSubscription`, `getPrice`
- [ ] `store/subscriptionStore.ts` created, exports `useSubscriptionStore` as a named export
- [ ] `isPremium()` returns `false` when `profile` is `null`
- [ ] `isPremium()` returns `false` when `premium.active === false`
- [ ] `isPremium()` returns `false` when `premium.expiresAt` is in the past
- [ ] `isPremium()` returns `true` when `premium.active === true` and `expiresAt` is in the future
- [ ] `beginSubscription()` sets `isLoading: true` at the start of the call
- [ ] `beginSubscription()` sets `pendingClientSecret` and returns `true` on Cloud Function success
- [ ] `beginSubscription()` sets `error` and returns `false` on Cloud Function failure
- [ ] `onPaymentComplete()` clears `pendingClientSecret` and `pendingSubscriptionId`
- [ ] `onPaymentFailed(msg)` clears pending state and sets `error` to `msg`
- [ ] `getStripePrices('Malaysia')` returns MYR pricing table with correct `amountDisplay` values
- [ ] `getStripePrices('Singapore')` returns SGD pricing table
- [ ] `getStripePrices('UnknownCountry')` falls back to MYR pricing table
- [ ] All 6 countries from PRD Section 5.12 are present in `PRICING_TABLE`
- [ ] `StripePrice` in `types/subscription.ts` includes `amountDisplay: string`
- [ ] `i18n/en.json` has all `subscription.*` keys
- [ ] `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` mirror `subscription.*` with English placeholders
- [ ] `.env.example` has all 6 `EXPO_PUBLIC_STRIPE_PRICE_*` keys
- [ ] No Stripe SDK hooks anywhere in `services/stripe.ts` or `store/subscriptionStore.ts`
- [ ] No `any` in any new or modified file
- [ ] All imports use `@/` alias — no relative paths
- [ ] `tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/profileStore.ts`, `store/discoveryStore.ts`,
`services/firebase/config.ts`, `services/firebase/auth.ts`, `services/firebase/firestore.ts`,
`functions/src/createStripeCheckout.ts`, `functions/src/stripeWebhook.ts`,
`types/user.ts`, `constants/`, `firestore.rules`, `firestore.indexes.json`

---

## Commit

```
git commit -m "task-51: subscription store and stripe service"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2B — Task 51] — YYYY-MM-DD

### Completed

- Task 51: Subscription store and Stripe service layer implemented
- services/stripe.ts: getCurrency, getStripePrices, createSubscription, getPrice — all 6 SEA currencies, prices from env vars
- store/subscriptionStore.ts: selectedTier/interval UI state, beginSubscription() stores clientSecret in state, isPremium() derives from profileStore

### Files Created / Modified

- services/stripe.ts: created — hardcoded pricing table for MYR/SGD/THB/PHP/IDR/VND, Cloud Function caller
- store/subscriptionStore.ts: created — purchase flow state machine, isPremium() gate
- types/subscription.ts: StripePrice.amountDisplay field added (if was missing)
- i18n/en.json: subscription.* keys added
- i18n/my.json, zh.json, ta.json: subscription.* keys mirrored with English placeholders
- .env.example: 6 EXPO_PUBLIC_STRIPE_PRICE_* keys appended

### Architecture Decisions

- clientSecret surfaced via pendingClientSecret state (not function return) — required because useStripe() hook must be called from PremiumScreen component, not from the store
- isPremium() reads profileStore.profile.premium directly — no duplication of premium state in subscriptionStore
- PRICING_TABLE hardcoded per PRD 5.12 — no Stripe API call to fetch prices
- Price IDs in EXPO_PUBLIC_ env vars — public Stripe identifiers, not secrets
- No persist on subscriptionStore — selectedTier/selectedInterval are ephemeral UI state

### Known Issues / Deferred

- restorePurchases() is a stub with TODO Phase 3 comment
- EXPO_PUBLIC_STRIPE_PRICE_* in .env.example are empty placeholders — developer populates from Stripe Dashboard before testing PremiumScreen (Tasks 52/53)

### Next Up

- Task 52: Premium Screen UI (app/settings/PremiumScreen.tsx, components/ui/PremiumBadge.tsx)
```
