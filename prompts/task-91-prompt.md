# CODEX PROMPT — Task 91: Stripe Tier 2 PHP/IDR/VND Pricing & Local Payment Methods

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 89 must have exported `COUNTRY_CURRENCIES` from `constants/regions.ts` with entries for all 6 countries — verify it is present
- Task 90 must have extended `services/stripe.ts` to include `getPricesForCountry()` (or equivalent) returning PHP/IDR/VND price ID sets from `EXPO_PUBLIC_STRIPE_PRICE_PHP_*`, `EXPO_PUBLIC_STRIPE_PRICE_IDR_*`, `EXPO_PUBLIC_STRIPE_PRICE_VND_*` env vars — verify these are present
- Task 90 must have added 18 new PHP/IDR/VND Stripe price ID placeholder entries to `.env.example` — verify they are present

If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: <describe what is absent>
  Cannot proceed. Re-run Task 89 or 90 before this task.
-->
```

---

## Context

- `functions/src/createStripeCheckout.ts` — existing callable that creates Stripe checkout sessions; currently creates sessions without currency awareness. This task adds country→currency routing. **Do not rewrite the whole function — add the currency lookup and pass it to the session creation call.**
- `app/settings/PremiumScreen.tsx` — modified in Task 71 to wire `handleManageSubscription` → `openCustomerPortal()` with `isPortalLoading` state. These changes must be preserved exactly. This task adds PHP/IDR/VND price display formatting and the `getStripePrices()` / `getPricesForCountry()` hook-up for the subscription cards.
- `services/stripe.ts` — modified in Task 90 to return PHP/IDR/VND price ID sets and derive currency from `COUNTRY_CURRENCIES`. This task reads from it for the UI side. **Do not restructure `services/stripe.ts` in this task — it was just rewritten in Task 90.**
- `constants/regions.ts` — exports `COUNTRY_CURRENCIES: Record<SupportedCountry, string>` (Task 89). **Do not import this from the Cloud Function — Cloud Functions must not import from client `constants/` files. Inline the currency map in the CF.**
- `store/profileStore.ts` — holds `profile.location.country` (type `SupportedCountry`) which is used by `PremiumScreen` to determine which pricing to display.
- `.env.example` — already has 18 PHP/IDR/VND Stripe price ID placeholders from Task 90; **do not duplicate or remove them**.

**Critical architectural boundary: Cloud Functions must never import from `constants/regions.ts` or any client-side file.** The country→currency mapping must be inlined inside `createStripeCheckout.ts` as a local constant. This is not optional — client files are not in scope for the CF build.

**`PremiumScreen.tsx` was last modified in Task 71. Do not revert or remove the `handleManageSubscription` → `openCustomerPortal()` wiring or the `isPortalLoading` state added there.**

---

## Task 91 — Stripe Tier 2: PHP/IDR/VND Pricing & Local Payment Methods

**Files to modify:**
- `functions/src/createStripeCheckout.ts` — add country→currency routing
- `app/settings/PremiumScreen.tsx` — add PHP/IDR/VND currency formatting to price display

---

### `functions/src/createStripeCheckout.ts` — Update

Add country-to-currency routing so Stripe checkout sessions are created with the correct currency for each user. Read `users/{uid}.location.country` from Firestore and map it to a currency code before calling `stripe.checkout.sessions.create` (or `stripe.paymentIntents.create`, whichever the existing function uses).

Add the following inline map at the top of the file, below existing imports:

```typescript
// Inlined from constants/regions.ts — do not import client constants in Cloud Functions
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  Malaysia:    'MYR',
  Singapore:   'SGD',
  Thailand:    'THB',
  Philippines: 'PHP',
  Indonesia:   'IDR',
  Vietnam:     'VND',
}
```

Inside the callable body, after the `request.auth` check and before the Stripe session call, read the user's country:

```typescript
// Read country from Firestore — do not trust client-supplied value
const userSnap = await admin.firestore().doc(`users/${request.auth.uid}`).get()
const country: string = userSnap.data()?.location?.country ?? 'Malaysia'
const currency = COUNTRY_TO_CURRENCY[country] ?? 'MYR'
```

Pass `currency` into the Stripe session or payment intent creation call. The exact parameter name depends on which Stripe API the existing function uses:
- For `stripe.checkout.sessions.create`: add `currency` to the session params
- For `stripe.paymentIntents.create`: add `currency` to the intent params

For PHP, IDR, and VND, add a code comment noting that local payment methods (GCash/PayMaya for PH; OVO/GoPay/DANA for ID; MoMo/ZaloPay for VN) are enabled at the Stripe Dashboard level and do not require per-session `payment_method_types` configuration with the current Stripe SDK version:

```typescript
// PHP: GCash, PayMaya enabled at Stripe Dashboard level — no per-session config required
// IDR: OVO, GoPay, DANA enabled at Stripe Dashboard level — no per-session config required
// VND: MoMo, ZaloPay enabled at Stripe Dashboard level — no per-session config required
```

**Do not touch:**
- The `request.auth` check (must remain first line)
- The `region: 'asia-southeast1'` config
- Any existing price ID lookup logic
- The return value shape — only the internal Stripe call changes
- Any other existing logic in the function

Run `npm --prefix functions run build` to verify zero errors.

---

### `app/settings/PremiumScreen.tsx` — Update

Add PHP, IDR, and VND price display formatting to the `PriceDisplay` component (or wherever currency-formatted prices are rendered on this screen).

Locate the section that formats and displays the subscription price string. Add formatting logic for the three new currencies. The correct formats are:

```typescript
// Currency formatting — add these cases wherever MYR/SGD/THB are already handled
// PHP — Philippine Peso: symbol prefix, no decimal
// Example output: "₱499"
// IDR — Indonesian Rupiah: symbol prefix, thousands separator, no decimal
// Example output: "Rp 75.000"
// VND — Vietnamese Dong: symbol prefix, thousands separator, no decimal
// Example output: "₫199.000"

function formatPrice(amount: number, currency: string): string {
  switch (currency) {
    case 'MYR': return `RM${amount.toFixed(2)}`
    case 'SGD': return `S$${amount.toFixed(2)}`
    case 'THB': return `฿${amount.toFixed(0)}`
    case 'PHP': return `₱${amount.toFixed(0)}`
    case 'IDR': return `Rp ${amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
    case 'VND': return `₫${amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}`
    default:    return `${currency} ${amount.toFixed(2)}`
  }
}
```

If a `formatPrice` helper (or equivalent) already exists in the file, extend it with the PHP/IDR/VND cases. Do not create a second formatter — consolidate into the existing one.

The billing period savings labels (e.g. "Save 20%") are calculated as a percentage discount — these are currency-agnostic and require no changes as long as they are computed from amount comparisons, not currency-specific strings.

**Do not touch:**
- `handleManageSubscription` → `openCustomerPortal()` wiring (Task 71)
- `isPortalLoading` state (Task 71)
- Any existing MYR/SGD/THB formatting
- The subscription card layout or any existing JSX structure outside the price formatting
- `StyleSheet`, i18n keys, or existing navigation logic

---

## Important Architecture Notes for Codex

1. **Cloud Functions must not import client files.** `COUNTRY_TO_CURRENCY` must be a local constant inside `createStripeCheckout.ts`. Never import from `constants/regions.ts`, `services/`, or any other client-side path in a Cloud Function.

2. **Read country from Firestore server-side — never trust the client.** The user's `location.country` must be read via `admin.firestore()` inside the CF, not passed as a callable argument. A caller cannot be trusted to pass their own country correctly.

3. **Fallback to MYR if country is absent or unrecognised.** Pre-Task-81 users may not have `location.country` set. The fallback `?? 'Malaysia'` and the `?? 'MYR'` default in the currency lookup handle this case.

4. **Do not reconfigure `payment_method_types` per session for PH/ID/VN.** GCash, PayMaya, OVO, GoPay, DANA, MoMo, and ZaloPay are enabled at the Stripe Dashboard level. Adding them to `payment_method_types` per session is either unsupported or unnecessary in the current SDK version. Leave a code comment as specified above.

5. **Zero-decimal currencies.** PHP, IDR, and VND are zero-decimal currencies in Stripe — amounts passed to Stripe for these currencies must be in the smallest currency unit without a fractional component (e.g. 499 PHP, not 4.99). Verify the existing price amount handling does not introduce decimals for these currencies.

6. **Preserve Task 71 PremiumScreen changes.** The `handleManageSubscription` wiring and `isPortalLoading` state were added in Task 71 and must not be removed or overwritten.

7. **`services/stripe.ts` is read-only for this task.** It was rewritten in Task 90. This task only reads from it (via `getPricesForCountry` or equivalent); do not restructure it.

---

## Rollback Protocol

If `npx tsc --noEmit` or `npm --prefix functions run build` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Importing a client-side file from the Cloud Function, OR
- Changing the Stripe session return value shape in a way that breaks the client caller

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the file, the error, and what decision is needed
4. Stop. Do not attempt a workaround.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] `npm --prefix functions run build` — zero errors
- [ ] Zero `any` types introduced
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in any client or function file
- [ ] Zero inline styles — `style={{ }}` does not appear in any JSX
- [ ] Zero relative imports — `../../` does not appear in touched files
- [ ] No new user-facing strings added without entries in all 4 i18n files (en, my, zh, ta) — if any price-label strings were extracted to i18n, verify all 4 files are updated

**Firebase / Security**
- [ ] `createStripeCheckout.ts` still has `if (!request.auth) throw new HttpsError(...)` as the very first line of the callable body
- [ ] `createStripeCheckout.ts` still specifies `{ region: 'asia-southeast1' }`
- [ ] Country is read server-side from `admin.firestore()` — not from `request.data`
- [ ] `COUNTRY_TO_CURRENCY` map is defined locally inside `createStripeCheckout.ts` — no import from `constants/`
- [ ] No `stripeCustomerId` or Stripe secret key appears in any return value or console output

**Architecture**
- [ ] `handleManageSubscription` and `isPortalLoading` still present and unchanged in `PremiumScreen.tsx`
- [ ] `services/stripe.ts` structure is unchanged from Task 90
- [ ] PHP/IDR/VND formatting uses zero-decimal output (no `.toFixed(2)` for these currencies)
- [ ] IDR and VND use thousands separators; PHP does not

**Platform**
- [ ] Price formatting renders correctly on both iOS and Android (`toLocaleString` with explicit locale string is safe in Hermes/JSC)

---

## Acceptance Criteria

- [ ] `functions/src/createStripeCheckout.ts` reads `users/{uid}.location.country` server-side and maps it to a Stripe-compatible currency code before creating the session
- [ ] `COUNTRY_TO_CURRENCY` map is defined as a local constant in the CF file — no import from `constants/regions.ts`
- [ ] Fallback to `'MYR'` when country field is absent or unrecognised
- [ ] PHP, IDR, VND sessions use the correct currency code (`PHP`, `IDR`, `VND`)
- [ ] A code comment in the CF explains that GCash/PayMaya/OVO/GoPay/DANA/MoMo/ZaloPay are Dashboard-level, not per-session
- [ ] `app/settings/PremiumScreen.tsx` formats PHP as `₱NNN` (no decimal), IDR as `Rp N.NNN` (thousands, no decimal), VND as `₫N.NNN` (thousands, no decimal)
- [ ] Existing MYR/SGD/THB formatting is unchanged
- [ ] `handleManageSubscription` → `openCustomerPortal()` wiring and `isPortalLoading` from Task 71 are preserved and unchanged
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm --prefix functions run build` passes with zero errors

---

## Do Not Touch

`constants/regions.ts` (read-only — Task 89 output), `services/stripe.ts` (read-only — Task 90 output), `store/profileStore.ts`, `types/user.ts`, `App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `firestore.rules`, `firestore.indexes.json`, `.env.example` (already has all necessary placeholders from Task 90 — do not add or remove entries), `i18n/` (only add keys if new user-facing strings are introduced — never remove or rename existing keys)

---

## Commit

```
git commit -m "task-91: stripe tier 2 PHP/IDR/VND currency routing and price formatting"
```

---

## After This Session

Update `CHANGELOG.md` using this template:

```
## [Phase 4A — Task 91] — YYYY-MM-DD

### Completed

- Task 91: Stripe Tier 2 — PHP/IDR/VND Pricing & Local Payment Methods
- functions/src/createStripeCheckout.ts: reads location.country server-side; maps to currency via inlined COUNTRY_TO_CURRENCY map; passes currency to Stripe session creation; fallback to MYR
- app/settings/PremiumScreen.tsx: PHP (₱, no decimal), IDR (Rp, thousands, no decimal), VND (₫, thousands, no decimal) formatting added to price display

### Files Created

- None

### Files Modified

- functions/src/createStripeCheckout.ts: country→currency routing added; local COUNTRY_TO_CURRENCY map inlined; currency passed to Stripe session
- app/settings/PremiumScreen.tsx: PHP/IDR/VND price formatting added; Task 71 portal wiring preserved

### Architecture Decisions

- COUNTRY_TO_CURRENCY inlined in CF rather than imported from constants/regions.ts — Cloud Functions must not import client files
- Country read server-side from Firestore, not from request.data — prevents country spoofing
- Local payment methods (GCash, PayMaya, OVO, GoPay, DANA, MoMo, ZaloPay) enabled at Dashboard level; no per-session payment_method_types config required

### Conflict Risks Introduced

- None expected — Task 92 (security rules audit) will verify no new client-writable fields were introduced

### Known Issues / Deferred

- None

### Next Up

- Task 92: Phase 4 Firestore Security Rules Update
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 92 prompt.

---

## Reasoning Level

High
