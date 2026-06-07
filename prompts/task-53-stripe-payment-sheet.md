@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2B is in progress. Tasks 47–52 are complete. The project compiles with zero TypeScript
errors. The following files are directly relevant to this task:

- `app/settings/PremiumScreen.tsx` — **Primary file for this task.** Currently renders the full
  premium UI (hero, tier selector, billing interval, plan cards, fixed subscribe button, and the
  existing-premium view). `beginSubscription()` from `subscriptionStore` is already called on
  button tap. It stores the Stripe `clientSecret` in `subscriptionStore.pendingClientSecret` but
  does NOT yet open the payment sheet. The success modal scaffold is absent.
- `store/subscriptionStore.ts` — Holds `pendingClientSecret: string | null` in state.
  `beginSubscription()` calls the `createStripeCheckout` Cloud Function and writes the returned
  `clientSecret` into state. `clearPendingClientSecret()` resets it to `null`. `isPremium()`
  derives live premium status from `profileStore.profile.premium`.
- `services/stripe.ts` — `createSubscription(priceId)` calls the Cloud Function and returns
  `{ clientSecret, subscriptionId }`. Not called directly from the screen — goes through the store.
- `app/navigation/RootNavigator.tsx` — `Premium` is already registered in `RootStackParamList`
  and the stack. The app scheme `fitlink` is set in `app.json` (Task 49), enabling
  `fitlink://payment-complete` deep links.
- `store/profileStore.ts` — Live Firestore listener on `users/{uid}` — premium status updates
  triggered by the Stripe webhook will propagate here automatically.
- `components/ui/LoadingOverlay.tsx` — `visible: boolean`, `message?: string`. Use during sheet
  initialisation.
- `constants/theme.ts` — All colors, spacing, typography tokens.
- `i18n/en.json` — `subscription.*` keys already exist. New keys for the success modal must be
  added here and mirrored in `my.json`, `zh.json`, `ta.json`.

**Critical architectural boundary from TASKS_PHASE2.md Task 53:**
`useStripe()` is a React hook and cannot be called inside a Zustand store action.
`initPaymentSheet` and `presentPaymentSheet` must be called from inside `PremiumScreen.tsx`
(the React component), not from `subscriptionStore`. The store's role is only to hold
`pendingClientSecret` and expose `clearPendingClientSecret()`. The screen watches
`pendingClientSecret` via a `useEffect` and drives the Stripe sheet lifecycle entirely.

**Do not refactor `subscriptionStore.beginSubscription()` to return `clientSecret` directly.**
The existing pattern (state-based, not return-value-based) is intentional and must be preserved
because it decouples the async Cloud Function call from the hook-based Stripe sheet lifecycle.

---

## Task 53 — Stripe Payment Sheet Integration

**Files to modify:**
- `app/settings/PremiumScreen.tsx` — Add `useStripe` hook, `useEffect` watching
  `pendingClientSecret`, `initPaymentSheet`, `presentPaymentSheet`, success modal, and deep link
  return handling via `expo-linking`
- `i18n/en.json` — Add `subscription.success.*` keys for the success modal
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Mirror new keys with English placeholders

**Files to create:**
- None — this task is entirely additive changes to `PremiumScreen.tsx` and i18n files

---

### `app/settings/PremiumScreen.tsx` — Update

This is the primary and most substantial change in this task. All Stripe sheet logic lives here.

#### What to add

**1. Imports**

Add to the existing import block (maintain the order from CONVENTIONS.md Section 5):

```typescript
// Third-party
import { useStripe } from '@stripe/stripe-react-native'
import * as Linking from 'expo-linking'

// Internal — hooks (add after existing hook imports)
// No new hook files — useStripe and Linking are used directly in the screen
```

**2. Hook and state declarations** — add inside the component body, after existing hooks:

```typescript
const { initPaymentSheet, presentPaymentSheet } = useStripe()
const pendingClientSecret = useSubscriptionStore(
  (s) => s.pendingClientSecret
)
const clearPendingClientSecret = useSubscriptionStore(
  (s) => s.clearPendingClientSecret
)

// Local UI state — not shared, so useState is appropriate here
const [isSheetLoading, setIsSheetLoading] = useState<boolean>(false)
const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false)
```

**3. `useEffect` watching `pendingClientSecret`** — add after the state declarations:

```typescript
useEffect(() => {
  if (!pendingClientSecret) return

  const openPaymentSheet = async (): Promise<void> => {
    setIsSheetLoading(true)

    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'fitlink',
      paymentIntentClientSecret: pendingClientSecret,
      allowsDelayedPaymentMethods: true,
      returnURL: 'fitlink://payment-complete',
      appearance: {
        colors: {
          primary: colors.primary,
        },
      },
      defaultBillingDetails: {
        email: profile?.email ?? undefined,
      },
    })

    setIsSheetLoading(false)

    if (initError) {
      clearPendingClientSecret()
      Alert.alert(
        t('subscription.error.title'),
        t('subscription.error.initFailed'),
        [{ text: t('common.ok') }]
      )
      return
    }

    const { error: presentError } = await presentPaymentSheet()

    clearPendingClientSecret()

    if (presentError) {
      if (presentError.code !== 'Canceled') {
        Alert.alert(
          t('subscription.error.title'),
          presentError.message,
          [
            { text: t('subscription.error.retry'), onPress: handleSubscribe },
            { text: t('common.cancel'), style: 'cancel' },
          ]
        )
      }
      // Canceled: user dismissed sheet — do nothing, return silently
      return
    }

    // Payment succeeded — show success modal
    // Premium status will update automatically via profileStore Firestore listener
    // when the stripeWebhook Cloud Function fires
    setShowSuccessModal(true)
  }

  void openPaymentSheet()
}, [pendingClientSecret]) // eslint-disable-line react-hooks/exhaustive-deps
```

> Note: `initPaymentSheet`, `presentPaymentSheet`, `clearPendingClientSecret`, `t`, `profile`,
> `colors`, and `handleSubscribe` are all stable references within the component scope.
> The exhaustive-deps lint rule would flag them, but the intent is to trigger only when
> `pendingClientSecret` changes. Add the eslint-disable comment as shown.

**4. Deep link return handler** — add a second `useEffect` below the first:

```typescript
useEffect(() => {
  const handleDeepLink = (event: { url: string }): void => {
    if (event.url.startsWith('fitlink://payment-complete')) {
      // Payment sheet returned via deep link (3D Secure or bank redirect)
      // The Stripe webhook will update Firestore; profileStore listener handles state
      setShowSuccessModal(true)
    }
  }

  const subscription = Linking.addEventListener('url', handleDeepLink)
  return () => subscription.remove()
}, [])
```

**5. `LoadingOverlay` during sheet initialisation** — add inside the JSX return, as the last
child before the closing fragment/View:

```tsx
<LoadingOverlay
  visible={isSheetLoading}
  message={t('subscription.sheet.loading')}
/>
```

**6. Success modal** — add inside the JSX return, positioned after `LoadingOverlay`:

```tsx
<Modal
  visible={showSuccessModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowSuccessModal(false)}
>
  <View style={styles.successOverlay}>
    <View style={styles.successCard}>
      {/* Icon */}
      <Ionicons
        name="checkmark-circle"
        size={64}
        color={colors.primary}
        style={styles.successIcon}
      />

      {/* Headline */}
      <Text style={styles.successHeadline}>
        {t('subscription.success.headline')}
      </Text>

      {/* Subheadline */}
      <Text style={styles.successSubheadline}>
        {t('subscription.success.subheadline')}
      </Text>

      {/* Unlocked features list */}
      <View style={styles.successFeatures}>
        {[
          t('subscription.success.feature1'),
          t('subscription.success.feature2'),
          t('subscription.success.feature3'),
          t('subscription.success.feature4'),
        ].map((feature) => (
          <View key={feature} style={styles.successFeatureRow}>
            <Ionicons
              name="checkmark"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.successFeatureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Button
        label={t('subscription.success.cta')}
        variant="primary"
        onPress={() => {
          setShowSuccessModal(false)
          navigation.goBack()
        }}
      />
    </View>
  </View>
</Modal>
```

**7. New StyleSheet entries** — add to the existing `StyleSheet.create({})` at the bottom of the
file (do not remove or change existing style keys):

```typescript
successOverlay: {
  flex: 1,
  backgroundColor: colors.overlay,
  justifyContent: 'flex-end',
} as ViewStyle,
successCard: {
  backgroundColor: colors.surface,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  padding: spacing.xl,
  alignItems: 'center',
  paddingBottom: spacing.xxxl,
} as ViewStyle,
successIcon: {
  marginBottom: spacing.md,
} as ViewStyle,
successHeadline: {
  fontSize: typography.sizes.xxl,
  fontWeight: typography.weights.bold,
  color: colors.gray[800],
  textAlign: 'center',
  marginBottom: spacing.sm,
} as TextStyle,
successSubheadline: {
  fontSize: typography.sizes.md,
  color: colors.gray[600],
  textAlign: 'center',
  marginBottom: spacing.lg,
} as TextStyle,
successFeatures: {
  width: '100%',
  marginBottom: spacing.xl,
} as ViewStyle,
successFeatureRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: spacing.sm,
  gap: spacing.sm,
} as ViewStyle,
successFeatureText: {
  fontSize: typography.sizes.md,
  color: colors.gray[800],
} as TextStyle,
```

**8. Missing React Native import** — ensure `Modal` and `Alert` are imported from `react-native`
in the existing import block. Add them if not already present.

---

### `i18n/en.json` — Update

Add the following keys inside the existing `subscription` namespace. Nest them under
`subscription.success`, `subscription.sheet`, and `subscription.error`. Do not remove or rename
any existing keys.

```json
"subscription": {
  "...existing keys unchanged...",

  "sheet": {
    "loading": "Preparing payment..."
  },

  "success": {
    "headline": "Welcome to Premium!",
    "subheadline": "Your subscription is now active. Enjoy the full fitlink experience.",
    "feature1": "Unlimited likes",
    "feature2": "See who liked you",
    "feature3": "Super Likes & Rewind",
    "feature4": "Advanced filters",
    "cta": "Start Exploring"
  },

  "error": {
    "title": "Payment Error",
    "initFailed": "Could not prepare payment. Please try again.",
    "retry": "Try Again"
  }
}
```

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Mirror the exact same key structure added to `en.json`. Use the English values as placeholders
for all three files. Structure must be identical — keys must exist in all 4 files per
CONVENTIONS.md Section 8.

```json
"sheet": {
  "loading": "Preparing payment..."
},
"success": {
  "headline": "Welcome to Premium!",
  "subheadline": "Your subscription is now active. Enjoy the full fitlink experience.",
  "feature1": "Unlimited likes",
  "feature2": "See who liked you",
  "feature3": "Super Likes & Rewind",
  "feature4": "Advanced filters",
  "cta": "Start Exploring"
},
"error": {
  "title": "Payment Error",
  "initFailed": "Could not prepare payment. Please try again.",
  "retry": "Try Again"
}
```

---

## Important Architecture Notes for Codex

1. **`useStripe()` must be called at the top level of `PremiumScreen`.** It is a React hook and
   cannot be called inside a callback, `useEffect`, or the store. `initPaymentSheet` and
   `presentPaymentSheet` are destructured from `useStripe()` once and used inside the effect.

2. **`pendingClientSecret` drives the sheet, not `beginSubscription()`'s return value.** The
   button tap calls `beginSubscription()` (store action). The store writes `clientSecret` to
   `pendingClientSecret` in state. The `useEffect` watching `pendingClientSecret` then drives
   `initPaymentSheet` → `presentPaymentSheet`. Do not change this flow.

3. **Do not call `clearPendingClientSecret()` before `presentPaymentSheet` resolves.** It must
   be called after — whether the sheet succeeded, failed, or was canceled — to prevent the
   `useEffect` from re-triggering on the same secret.

4. **The `Canceled` error code must be handled silently.** When a user closes the Stripe sheet
   without completing payment, `presentPaymentSheet` returns `error.code === 'Canceled'`. This is
   not an error — do not show an alert. Return silently.

5. **Do not poll Firestore or manually update `profileStore` after payment success.** The
   `stripeWebhook` Cloud Function updates `users/{uid}.premium` asynchronously. The live
   Firestore listener on `profileStore` (wired in Task 51) will receive the update automatically.
   The success modal appears immediately on sheet resolution; premium features unlock when
   Firestore propagates (typically within seconds).

6. **`defaultBillingDetails.email` must be `string | undefined`, not `string | null`.** The
   Stripe SDK types do not accept `null`. Use `profile?.email ?? undefined` to convert null to
   undefined.

7. **`LoadingOverlay` covers only the sheet initialisation phase** (`isSheetLoading`), not the
   entire subscribe flow. The button's existing `isLoading` state (from `subscriptionStore`)
   covers the Cloud Function call. These are two distinct loading states.

8. **`returnURL` must match the scheme in `app.json`** — `'fitlink://payment-complete'`. This
   was set in Task 49. Do not change this value.

9. **`Modal` from `react-native` is used for the success overlay** — not a custom modal
   component. The success modal is a one-off UI for this screen only and does not warrant a
   shared component.

10. **No inline styles.** All new styles go in the existing `StyleSheet.create({})` at the
    bottom of `PremiumScreen.tsx`. All values from `constants/theme`.

---

## Acceptance Criteria

- [ ] `PremiumScreen.tsx` imports `useStripe` from `@stripe/stripe-react-native` and
  `Linking` from `expo-linking`
- [ ] `initPaymentSheet` and `presentPaymentSheet` are destructured from `useStripe()` at the
  component top level
- [ ] A `useEffect` watching only `pendingClientSecret` calls `initPaymentSheet` then
  `presentPaymentSheet` in sequence — never concurrently
- [ ] `clearPendingClientSecret()` is called after `presentPaymentSheet` resolves in all
  branches (success, failure, and cancel)
- [ ] `Canceled` error code from `presentPaymentSheet` is handled silently — no alert shown
- [ ] Non-canceled sheet errors show an `Alert` with "Try Again" and "Cancel" options
- [ ] `initPaymentSheet` failure shows an `Alert` and returns early — does not proceed to `presentPaymentSheet`
- [ ] `LoadingOverlay` renders with `visible={isSheetLoading}` and message from i18n
- [ ] Success modal renders after `presentPaymentSheet` resolves without error
- [ ] Success modal "Start Exploring" button dismisses the modal and calls `navigation.goBack()`
- [ ] Deep link `useEffect` listens for `fitlink://payment-complete` and sets
  `showSuccessModal(true)` on match
- [ ] Deep link listener is removed on component unmount via the `remove()` cleanup
- [ ] `defaultBillingDetails.email` uses `?? undefined` (not `?? null`) for type safety
- [ ] `subscription.sheet.loading`, `subscription.success.*`, and `subscription.error.*` keys
  added to all 4 language files with identical structure
- [ ] Zero inline styles — all new styles in `StyleSheet.create({})`
- [ ] Zero new `any` types introduced
- [ ] All imports use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`store/subscriptionStore.ts`, `services/stripe.ts`, `functions/src/createStripeCheckout.ts`,
`functions/src/stripeWebhook.ts`, `store/profileStore.ts`, `app/navigation/RootNavigator.tsx`,
`components/ui/PremiumBadge.tsx`, `firestore.rules`, `constants/`, `types/`

---

## Testing Guidance (Manual — Not Automated)

Before committing, test the payment sheet with Stripe test cards in the emulator or a
development build:

| Card Number | Expected Result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds → success modal appears |
| `4000 0000 0000 9995` | Payment fails → error alert with retry |
| User dismisses sheet | Silent return, no alert, no success modal |
| `4000 0025 0000 3155` | 3D Secure redirect → `fitlink://payment-complete` deep link triggers success modal |

Use any future expiry date (e.g. `12/30`) and any 3-digit CVC.

---

## Commit

```
git commit -m "task-53: Stripe payment sheet integration with success modal and deep link return"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2B — Task 53] — YYYY-MM-DD

### Completed

- Task 53: Stripe payment sheet fully integrated into PremiumScreen
- useEffect watches pendingClientSecret from subscriptionStore; triggers initPaymentSheet → presentPaymentSheet lifecycle
- Canceled sheet handled silently; non-canceled errors show Alert with retry
- initPaymentSheet failure shows Alert and exits early
- Success modal shown on sheet resolution (slides up from bottom, checkmark icon, feature list, Start Exploring CTA)
- Deep link handler for fitlink://payment-complete covers 3D Secure redirect flows
- LoadingOverlay shown during sheet initialisation phase
- subscription.sheet.*, subscription.success.*, subscription.error.* i18n keys added to all 4 language files

### Files Created / Modified

- app/settings/PremiumScreen.tsx: useStripe hook, two useEffects (pendingClientSecret + deep link), success modal JSX + styles, LoadingOverlay wired
- i18n/en.json: subscription.sheet.loading, subscription.success.*, subscription.error.* added
- i18n/my.json, zh.json, ta.json: same keys mirrored with English placeholders

### Architecture Decisions

- Sheet lifecycle driven by pendingClientSecret state (not beginSubscription return value) — required because useStripe() is a hook and must be called at component top level
- clearPendingClientSecret() called after presentPaymentSheet resolves in all branches — prevents useEffect re-trigger
- profileStore Firestore listener handles premium state propagation — no manual Firestore read after payment
- Success modal appears immediately on sheet resolution; premium feature unlock follows asynchronously via webhook

### Known Issues / Deferred

- Stripe Customer Portal URL remains a placeholder — production portal session requires a Cloud Function (deferred Phase 3)
- Lottie animation in success modal is a static icon placeholder

### Next Up

- Task 54: Premium Feature Gates (replace all subscription.tier checks with isPremium(), wire upsell reasons, read receipts, unlimited likes)
```
