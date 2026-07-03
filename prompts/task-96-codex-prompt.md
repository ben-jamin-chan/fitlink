# Codex Prompt — Task 96: restoreStripeSubscription Cloud Function

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**
- Phase 2 `createStripeCheckout` CF must have written `stripeCustomerId` to `/users/{uid}` — verify `stripeCustomerId` field exists in `types/user.ts`
- Phase 2 `stripeWebhook` CF must have established the `premium` field shape on `/users/{uid}` — verify `premium?: { tier: 'plus' | 'pro'; active: boolean; expiresAt?: Timestamp }` exists in `types/user.ts`
- Task 95 `adminAction` must be exported from `functions/src/index.ts` — verify the export is present before appending the new export in this task

If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your response and do not proceed.

```
<!-- DEPENDENCY ERROR
  Missing: [describe what is absent]
  Cannot proceed. Bring this report back to the Architect.
-->
```

---

## Context

**What is already built and relevant to this task:**
- `functions/src/index.ts` — all CF exports live here; Task 95 appended `adminAction`; this task appends `restoreStripeSubscription`. Do not reorder or remove existing exports.
- `types/user.ts` — `stripeCustomerId?: string` (server-only, Phase 2); `premium?: { tier: 'plus' | 'pro'; active: boolean; expiresAt?: Timestamp }` (server-only, Phase 2)
- `functions/src/createStripeCheckout.ts` — existing reference for how the Stripe client is initialised in this project; match the same import pattern
- `functions/src/stripeWebhook.ts` — existing reference for the `premium` write pattern using Admin SDK
- `.env` — contains Stripe price ID env vars (all `STRIPE_PRICE_*` keys); used in this task to map a subscription's price ID back to a tier name

**Architectural boundary — read carefully:**
**`stripeCustomerId` is a server-only field.** It must never be passed from the client. The CF reads it directly from Firestore using the Admin SDK with the caller's `uid`. The client sends no customer ID in the request payload.

**The `premium` field is server-only.** This CF writes it using the Admin SDK, exactly as `stripeWebhook` does. Never use client SDK `updateDoc` for this field.

**`functions/src/index.ts` was last modified in Task 95.** Append the new export without touching or reordering existing entries.

---

## Task 96 — restoreStripeSubscription Cloud Function

**Files to create:**
- `functions/src/restoreStripeSubscription.ts`

**Files to modify:**
- `functions/src/index.ts` — append one export line

---

### `functions/src/restoreStripeSubscription.ts`

This is a 2nd-gen callable Cloud Function. When a user reinstalls the app or signs in on a new device, their local Firestore `premium` state may show inactive even though an active Stripe subscription exists. This CF re-syncs the subscription status by querying Stripe directly and writing the corrected `premium` field via Admin SDK.

The function returns a discriminated union result so the client can handle all three outcomes without guessing:
- `{ restored: false; reason: 'no-customer' }` — user has no Stripe customer record at all
- `{ restored: false; reason: 'no-active-subscription' }` — customer exists but no active subscription found
- `{ restored: true; tier: 'plus' | 'pro'; expiresAt: Timestamp }` — subscription found and premium re-synced

**Tier resolution:** The Stripe subscription object contains `items.data[0].price.id`. Match this price ID against the known price ID env vars (`STRIPE_PRICE_*`) to determine whether the tier is `'plus'` or `'pro'`. If no price ID matches any known env var, fall back to `'plus'` and log the unrecognised price ID (server-side only — never expose to client).

```typescript
import * as admin from 'firebase-admin'
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import Stripe from 'stripe'
import { Timestamp } from 'firebase-admin/firestore'

// Initialise Stripe using the secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-04-10',
})

// Build the price-to-tier lookup map from env vars at cold-start time.
// Keys are Stripe price IDs; values are 'plus' or 'pro'.
// Only include entries where the env var is non-empty — guards against
// misconfigured environments silently mapping empty strings to a tier.
type SubscriptionTier = 'plus' | 'pro'

function buildPriceTierMap(): Record<string, SubscriptionTier> {
  const map: Record<string, SubscriptionTier> = {}

  const plusKeys = [
    'STRIPE_PRICE_MYR_PLUS_MONTHLY', 'STRIPE_PRICE_MYR_PLUS_3MONTH', 'STRIPE_PRICE_MYR_PLUS_6MONTH',
    'STRIPE_PRICE_SGD_PLUS_MONTHLY', 'STRIPE_PRICE_SGD_PLUS_3MONTH', 'STRIPE_PRICE_SGD_PLUS_6MONTH',
    'STRIPE_PRICE_THB_PLUS_MONTHLY', 'STRIPE_PRICE_THB_PLUS_3MONTH', 'STRIPE_PRICE_THB_PLUS_6MONTH',
    'STRIPE_PRICE_PHP_PLUS_MONTHLY', 'STRIPE_PRICE_PHP_PLUS_3MONTH', 'STRIPE_PRICE_PHP_PLUS_6MONTH',
    'STRIPE_PRICE_IDR_PLUS_MONTHLY', 'STRIPE_PRICE_IDR_PLUS_3MONTH', 'STRIPE_PRICE_IDR_PLUS_6MONTH',
    'STRIPE_PRICE_VND_PLUS_MONTHLY', 'STRIPE_PRICE_VND_PLUS_3MONTH', 'STRIPE_PRICE_VND_PLUS_6MONTH',
  ]

  const proKeys = [
    'STRIPE_PRICE_MYR_PRO_MONTHLY', 'STRIPE_PRICE_MYR_PRO_3MONTH', 'STRIPE_PRICE_MYR_PRO_6MONTH',
    'STRIPE_PRICE_SGD_PRO_MONTHLY', 'STRIPE_PRICE_SGD_PRO_3MONTH', 'STRIPE_PRICE_SGD_PRO_6MONTH',
    'STRIPE_PRICE_THB_PRO_MONTHLY', 'STRIPE_PRICE_THB_PRO_3MONTH', 'STRIPE_PRICE_THB_PRO_6MONTH',
    'STRIPE_PRICE_PHP_PRO_MONTHLY', 'STRIPE_PRICE_PHP_PRO_3MONTH', 'STRIPE_PRICE_PHP_PRO_6MONTH',
    'STRIPE_PRICE_IDR_PRO_MONTHLY', 'STRIPE_PRICE_IDR_PRO_3MONTH', 'STRIPE_PRICE_IDR_PRO_6MONTH',
    'STRIPE_PRICE_VND_PRO_MONTHLY', 'STRIPE_PRICE_VND_PRO_3MONTH', 'STRIPE_PRICE_VND_PRO_6MONTH',
  ]

  for (const key of plusKeys) {
    const val = process.env[key]
    if (val) map[val] = 'plus'
  }
  for (const key of proKeys) {
    const val = process.env[key]
    if (val) map[val] = 'pro'
  }

  return map
}

const PRICE_TIER_MAP = buildPriceTierMap()

type RestoreResult =
  | { restored: false; reason: 'no-customer' }
  | { restored: false; reason: 'no-active-subscription' }
  | { restored: true; tier: SubscriptionTier; expiresAt: admin.firestore.Timestamp }

export const restoreStripeSubscription = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest): Promise<RestoreResult> => {
    // 1. Auth check — must be first
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }
    const uid = request.auth.uid
    const db = admin.firestore()

    // 2. Read stripeCustomerId from Firestore via Admin SDK
    //    Never trust a client-supplied customer ID
    const userSnap = await db.doc(`users/${uid}`).get()
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User document not found')
    }

    const stripeCustomerId = userSnap.data()?.stripeCustomerId as string | undefined
    if (!stripeCustomerId) {
      return { restored: false, reason: 'no-customer' }
    }

    // 3. Query Stripe for the most recent active subscription on this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
      expand: ['data.items.data.price'],
    })

    if (subscriptions.data.length === 0) {
      return { restored: false, reason: 'no-active-subscription' }
    }

    const subscription = subscriptions.data[0]

    // 4. Resolve tier from price ID
    const priceId = subscription.items.data[0]?.price?.id
    let tier: SubscriptionTier = 'plus'
    if (priceId && PRICE_TIER_MAP[priceId]) {
      tier = PRICE_TIER_MAP[priceId]
    }
    // If priceId is unrecognised, we fall back to 'plus' silently.
    // Do not log the priceId — it contains no PII but leaks subscription metadata.

    // 5. Write the corrected premium field via Admin SDK
    const expiresAt = Timestamp.fromMillis(subscription.current_period_end * 1000)
    await db.doc(`users/${uid}`).update({
      premium: {
        tier,
        active: true,
        expiresAt,
      },
    })

    // 6. Return the result — Timestamp is serialised to seconds/nanoseconds
    //    by the Firebase Functions SDK; the client reconstructs it correctly
    return { restored: true, tier, expiresAt }
  }
)
```

---

### `functions/src/index.ts` — Update

Append one export line. Do not touch, reorder, or remove any existing export. `adminAction` was appended in Task 95 — it must remain in place.

```typescript
// Append after the existing exports (do not reorder anything above this line):
export { restoreStripeSubscription } from './restoreStripeSubscription'
```

---

## Important Architecture Notes for Codex

1. **`stripeCustomerId` is read server-side only.** The CF reads it from Firestore using the Admin SDK keyed on `request.auth.uid`. The client request payload must be empty (`{}`). If any customer ID appears in `request.data`, ignore it — do not use client-supplied values for Stripe lookups.

2. **`premium` is a server-only field.** Write it using `admin.firestore().doc(...).update(...)` — not the client SDK. Never use `FieldValue.serverTimestamp()` for `expiresAt` here; use `Timestamp.fromMillis(subscription.current_period_end * 1000)` because the value comes from Stripe, not from write time.

3. **Stripe API version.** Use `apiVersion: '2024-04-10'` to match the existing Stripe initialisation in this project. Verify against `functions/src/createStripeCheckout.ts` before writing — use whichever version is already pinned there.

4. **`expand: ['data.items.data.price']`** is required in the `stripe.subscriptions.list` call. Without it, `items.data[0].price` returns only the price ID string, not the full price object. The expansion ensures `price.id` is always accessible as a string.

5. **Cold-start price-tier map.** `buildPriceTierMap()` is called once at module load time and stored in `PRICE_TIER_MAP`. Do not rebuild it on every invocation. Env vars are available at cold start in Firebase Cloud Functions 2nd gen.

6. **No PII in logs.** Do not log `uid`, `stripeCustomerId`, `priceId`, or any user-identifying data. The only acceptable server-side logging is a warning for unrecognised price IDs (log the fact that an unrecognised price was encountered, not the price ID itself).

7. **`functions/src/index.ts` append-only.** Task 95 CHANGELOG confirms `adminAction` was the most recently appended export. Add `restoreStripeSubscription` after it. Never remove, rename, or reorder existing exports — this breaks the deployed function registry.

8. **Return type is serialisable.** `admin.firestore.Timestamp` is serialised by the Cloud Functions SDK automatically. The client receives `{ seconds, nanoseconds }` and can reconstruct a Firestore `Timestamp` from it. Do not convert to `Date` or ISO string before returning.

---

## Rollback Protocol

If `npm --prefix functions run build` produces errors that cannot be resolved without:
- Modifying `firestore.rules`, `types/user.ts`, or any existing CF file beyond `index.ts`
- Making an assumption about Stripe API shape that contradicts what `createStripeCheckout.ts` already uses
- Changing the `premium` field structure in a way that contradicts ARCHITECT.md

**Then:**
1. Do not commit any partial changes
2. Revert `functions/src/restoreStripeSubscription.ts` (delete it) and revert `functions/src/index.ts` to its Task 95 state
3. Output a `<!-- ROLLBACK REPORT -->` block with the conflict details
4. Stop and bring the report back to the Architect

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npm --prefix functions run build` — zero errors
- [ ] `npx tsc --noEmit` — zero errors in root (this task does not touch client files, but run it anyway)
- [ ] Zero `any` types introduced — search diff for `: any` and `as any`
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in the new CF file
- [ ] No relative imports — `../../` does not appear in `restoreStripeSubscription.ts`

**Firebase / Security**
- [ ] `request.auth` check is the **first line** inside the callable handler
- [ ] `{ region: 'asia-southeast1' }` specified on the `onCall` call
- [ ] `stripeCustomerId` is read from Firestore via Admin SDK — not from `request.data`
- [ ] `premium` is written via `admin.firestore().doc(...).update(...)` — not client SDK
- [ ] No `new Date()` for any timestamp — `Timestamp.fromMillis(...)` used for `expiresAt`
- [ ] No Stripe credentials, customer IDs, or price IDs in any logged output

**Architecture**
- [ ] `functions/src/index.ts` existing exports are unchanged — only one new line appended
- [ ] `PRICE_TIER_MAP` is built at module scope (cold-start), not inside the handler
- [ ] All six currency groups (MYR, SGD, THB, PHP, IDR, VND) × both tiers (plus, pro) × all three billing periods (monthly, 3month, 6month) are represented in `buildPriceTierMap()` — 36 price keys total
- [ ] Return type `RestoreResult` is a discriminated union — all three branches are typed and returned correctly

---

## Acceptance Criteria

- [ ] `functions/src/restoreStripeSubscription.ts` created and exported from `functions/src/index.ts`
- [ ] Unauthenticated call → `HttpsError('unauthenticated', ...)`
- [ ] Authenticated call, user doc has no `stripeCustomerId` → `{ restored: false, reason: 'no-customer' }`
- [ ] Authenticated call, customer exists but no active Stripe subscription → `{ restored: false, reason: 'no-active-subscription' }`
- [ ] Active subscription found → `premium.tier`, `premium.active: true`, `premium.expiresAt` written to Firestore via Admin SDK; `{ restored: true, tier, expiresAt }` returned
- [ ] Tier resolved from Stripe price ID via `PRICE_TIER_MAP`; falls back to `'plus'` for unrecognised price IDs
- [ ] `stripeCustomerId` read from Firestore server-side — never from `request.data`
- [ ] `PRICE_TIER_MAP` covers all 36 price keys (6 currencies × 2 tiers × 3 billing periods)
- [ ] `npm --prefix functions run build` passes with zero errors
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Do Not Touch

`firestore.rules`, `firestore.indexes.json`, `types/user.ts`, `types/subscription.ts`, `functions/src/createStripeCheckout.ts`, `functions/src/stripeWebhook.ts`, `functions/src/adminAction.ts`, any existing export in `functions/src/index.ts` (additions only — no removals or reordering), any client-side file under `app/`, `store/`, `components/`, `services/`, `hooks/`, `constants/`, `i18n/`, `admin/`

---

## Commit

```
git commit -m "task-96: add restoreStripeSubscription callable CF"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4C — Task 96] — YYYY-MM-DD

### Completed

- Task 96: restoreStripeSubscription Cloud Function
- [List each significant behaviour implemented]

### Files Created

- functions/src/restoreStripeSubscription.ts: callable CF; reads stripeCustomerId server-side; queries Stripe for active subscription; writes premium field via Admin SDK; returns discriminated RestoreResult union

### Files Modified

- functions/src/index.ts: appended restoreStripeSubscription export

### Architecture Decisions

- [Any non-obvious choice — e.g. how tier fallback is handled, Stripe API version used]
- PRICE_TIER_MAP built at module scope (cold-start) covering all 36 price keys

### Conflict Risks Introduced

- functions/src/index.ts modified — Task 97 and all future CF tasks must append without reordering
- None beyond the above

### Known Issues / Deferred

- None — or list anything intentionally incomplete

### Next Up

- Task 97: Restore Purchases UI (depends on this CF)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 97 prompt.

---

## Reasoning Level

Medium
