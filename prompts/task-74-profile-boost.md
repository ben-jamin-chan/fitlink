# CODEX PROMPT — Task 74: Profile Boost (Pro Tier)

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Tasks 70–73 are complete. The following existing files are directly relevant to this task:

- `types/user.ts` — `UserProfile` already includes optional Phase 3 boost field: `boost?: { activatedAt: Timestamp; expiresAt: Timestamp }` (added in Task 70). Do not touch this file.
- `functions/src/getDiscoveryStack.ts` — 2nd-gen callable in `asia-southeast1`. Already applies premium-active candidate prioritisation and incognito exclusion (Task 73). This is where boost scoring uplift will be applied.
- `functions/src/index.ts` — Exports all Cloud Functions. `activateBoost` must be appended here.
- `store/profileStore.ts` — `updateProfile(partial: Partial<UserProfile>): Promise<void>` action exists. `profile` state holds the current user's `UserProfile`. Do not add boost activation logic to this store — boost writes are server-owned.
- `components/settings/IncognitoToggleCard.tsx` — Pattern reference for a self-contained Pro-gated settings card with `PremiumBadge`, `Switch`, toast feedback, and typed navigation prop. Follow the same structure for `BoostCard`.
- `components/ui/PremiumBadge.tsx` — Renders `'plus' | 'pro'` tier badge. Import directly.
- `app/settings/SettingsScreen.tsx` — Privacy section already has `IncognitoToggleCard`. The new `BoostCard` goes in a new **Premium** section (below Privacy, above Support).
- `app/profile/ProfileScreen.tsx` — Profile screen that must show the active boost status and the "Boost Profile" CTA button.
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — All four language files must receive new `profile.boost.*` and `settings.boost.*` keys.
- `firestore.rules` — `boost` is a server-only field. The existing `doesNotModifyServerOnlyFields()` helper must be extended to block client writes to `boost`. **Do not rewrite the entire rules file — add `boost` to the deny-list only.**

**Boost contract (non-negotiable):**
- Pro tier only (`premium.tier === 'pro'`). Plus-tier and free users see the card but are redirected to `PremiumScreen`.
- 1 boost per calendar month. The server enforces this — the client only displays state.
- A boost lasts **30 minutes** from activation. After expiry the field remains in Firestore but `expiresAt` is in the past; the client reads this as inactive.
- Boost scoring uplift: `+20` added to a boosted user's discovery score inside `getDiscoveryStack` when `boost.expiresAt > now`. This is server-only — no client scoring logic.
- `boost.activatedAt` and `boost.expiresAt` are written exclusively by the `activateBoost` Cloud Function using `admin.firestore.FieldValue.serverTimestamp()` / `admin.firestore.Timestamp.fromMillis()`. **No client writes to `boost.*` whatsoever.**

**Do not:**
- Add `boost` writes or reads directly from any client Zustand store action.
- Call `profileStore.updateProfile({ boost: ... })` — boost state is read from `profileStore.profile.boost` (already synced from Firestore) but never written from the client.
- Create a new screen — boost is surfaced via a card in `SettingsScreen` and a status row + button on `ProfileScreen`.

---

## Task 74 — Profile Boost (Pro Tier, 1× Per Month)

**Files to create:**
- `functions/src/activateBoost.ts`
- `components/profile/BoostCard.tsx`

**Files to modify:**
- `functions/src/getDiscoveryStack.ts` — add boost score uplift (+20) for boosted candidates
- `functions/src/index.ts` — append `activateBoost` export
- `app/settings/SettingsScreen.tsx` — add `BoostCard` in a new Premium section
- `app/profile/ProfileScreen.tsx` — add boost status row and "Boost Profile" button
- `firestore.rules` — add `boost` to server-only field deny-list
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `profile.boost.*` and `settings.boost.*` keys

---

### `functions/src/activateBoost.ts`

2nd-gen callable function (`asia-southeast1`). This is the sole authority for writing `boost` to Firestore. It enforces the Pro gate, the monthly cap, and the 30-minute expiry — all server-side.

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

const BOOST_DURATION_MS = 30 * 60 * 1000 // 30 minutes
const REGION = 'asia-southeast1'

export const activateBoost = onCall({ region: REGION }, async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }

  const uid = request.auth.uid
  const db = admin.firestore()
  const userRef = db.doc(`users/${uid}`)
  const userSnap = await userRef.get()

  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'User document not found')
  }

  const userData = userSnap.data()!

  // Pro gate — must be active Pro subscriber
  const isPro =
    userData.premium?.active === true && userData.premium?.tier === 'pro'

  if (!isPro) {
    throw new HttpsError('permission-denied', 'profile_boost_pro_required')
  }

  // Monthly cap — one boost per calendar month
  const existingBoost = userData.boost as
    | { activatedAt: admin.firestore.Timestamp; expiresAt: admin.firestore.Timestamp }
    | undefined

  if (existingBoost?.activatedAt) {
    const activatedAt = existingBoost.activatedAt.toDate()
    const now = new Date()
    const sameMonth =
      activatedAt.getFullYear() === now.getFullYear() &&
      activatedAt.getMonth() === now.getMonth()

    if (sameMonth) {
      throw new HttpsError('resource-exhausted', 'profile_boost_already_used_this_month')
    }
  }

  // Write boost with server-authoritative timestamps
  const now = Date.now()
  const expiresAt = admin.firestore.Timestamp.fromMillis(now + BOOST_DURATION_MS)

  await userRef.update({
    boost: {
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    },
  })

  return {
    success: true,
    expiresAt: expiresAt.toMillis(),
  }
})
```

---

### `functions/src/getDiscoveryStack.ts` — Update

Add boost score uplift of +20 for any candidate whose `boost.expiresAt` is in the future. Insert this scoring block inside the candidate scoring loop, after the existing `premium.active` and `photoVerified` scoring checks. Do not touch any other logic in this file.

```typescript
// ADD this block inside the candidate scoring loop, after the photoVerified score check:

// Boost uplift — active boost gives significant discovery priority
const boostData = candidate.boost as
  | { expiresAt: admin.firestore.Timestamp }
  | undefined

if (boostData?.expiresAt) {
  const boostExpiresMs = boostData.expiresAt.toMillis()
  if (boostExpiresMs > Date.now()) {
    score += 20
  }
}
```

Do not touch the incognito exclusion logic, the premium candidate query path, the baseline candidate query path, or the function export.

---

### `functions/src/index.ts` — Update

Append the `activateBoost` export after the existing `rewindSwipe` and `createCustomerPortalSession` exports. Do not reorder or remove any existing exports.

```typescript
// ADD this line after the last existing export:
export { activateBoost } from './activateBoost'
```

---

### `components/profile/BoostCard.tsx`

Self-contained boost card used in both `SettingsScreen` and `ProfileScreen`. It reads boost state from `profileStore.profile.boost`, derives active/inactive/used-this-month status locally, calls `activateBoost` on tap, and handles the Pro gate by navigating to `PremiumScreen`.

Follow the same structural pattern as `components/settings/IncognitoToggleCard.tsx`: typed navigation prop, no store dispatch for server writes, `PremiumBadge` for the Pro indicator, toast feedback.

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { StackNavigationProp } from '@react-navigation/stack'

import { useProfileStore } from '@/store/profileStore'
import { PremiumBadge } from '@/components/ui/PremiumBadge'
import { colors, spacing, typography } from '@/constants/theme'
import type { RootStackParamList } from '@/app/navigation/RootNavigator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivateBoostResponse {
  success: boolean
  expiresAt: number
}

interface BoostCardProps {
  navigation: StackNavigationProp<RootStackParamList>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBoostActive(expiresAt: { toMillis(): number } | undefined): boolean {
  if (!expiresAt) return false
  return expiresAt.toMillis() > Date.now()
}

function isBoostUsedThisMonth(
  activatedAt: { toDate(): Date } | undefined,
): boolean {
  if (!activatedAt) return false
  const activated = activatedAt.toDate()
  const now = new Date()
  return (
    activated.getFullYear() === now.getFullYear() &&
    activated.getMonth() === now.getMonth()
  )
}

function formatTimeRemaining(expiresAtMs: number): string {
  const remaining = expiresAtMs - Date.now()
  if (remaining <= 0) return '0m'
  const minutes = Math.ceil(remaining / 60000)
  return `${minutes}m`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BoostCard = ({ navigation }: BoostCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const profile = useProfileStore((s) => s.profile)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const isPro = profile?.premium?.active === true && profile?.premium?.tier === 'pro'
  const boost = profile?.boost as
    | { activatedAt: { toDate(): Date }; expiresAt: { toMillis(): number } }
    | undefined

  const active = isBoostActive(boost?.expiresAt)
  const usedThisMonth = !active && isBoostUsedThisMonth(boost?.activatedAt)

  const showToast = (message: string): void => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handlePress = async (): Promise<void> => {
    if (!isPro) {
      navigation.navigate('Premium')
      return
    }

    if (active) {
      showToast(t('profile.boost.alreadyActive'))
      return
    }

    if (usedThisMonth) {
      showToast(t('profile.boost.alreadyUsedThisMonth'))
      return
    }

    setIsLoading(true)
    try {
      const functions = getFunctions(undefined, 'asia-southeast1')
      const activateBoost = httpsCallable<Record<string, never>, ActivateBoostResponse>(
        functions,
        'activateBoost',
      )
      await activateBoost({})
      showToast(t('profile.boost.activated'))
    } catch {
      showToast(t('profile.boost.error'))
    } finally {
      setIsLoading(false)
    }
  }

  const statusLabel = (): string => {
    if (active && boost?.expiresAt) {
      return t('profile.boost.activeTimeRemaining', {
        time: formatTimeRemaining(boost.expiresAt.toMillis()),
      })
    }
    if (usedThisMonth) return t('profile.boost.usedThisMonth')
    return t('profile.boost.available')
  }

  const buttonDisabled = isLoading || active || usedThisMonth

  return (
    <View style={styles.container}>
      {toastMessage !== null && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="rocket-outline" size={22} color={colors.warning} />
        </View>

        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('profile.boost.title')}</Text>
            <PremiumBadge tier="pro" />
          </View>
          <Text style={styles.subtitle}>{statusLabel()}</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, buttonDisabled && styles.buttonDisabled]}
          onPress={handlePress}
          disabled={buttonDisabled}
          accessibilityLabel={t('profile.boost.buttonLabel')}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{t('profile.boost.buttonLabel')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    overflow: 'hidden',
  } as ViewStyle,
  toast: {
    backgroundColor: colors.gray[800],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  } as ViewStyle,
  toastText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  } as TextStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  } as ViewStyle,
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  textWrap: {
    flex: 1,
  } as ViewStyle,
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
  } as TextStyle,
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
  } as TextStyle,
  button: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  buttonDisabled: {
    backgroundColor: colors.gray[400],
  } as ViewStyle,
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
})
```

---

### `app/settings/SettingsScreen.tsx` — Update

Add a new **Premium** settings section between the Privacy section and the Support section. Render `BoostCard` inside it. Also import the `IncognitoToggleCard`-style navigation prop passing pattern if not already present.

```typescript
// ADD import:
import { BoostCard } from '@/components/profile/BoostCard'

// ADD this section in the JSX, between the Privacy section and the Support section:

{/* Premium Section */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>{t('settings.sections.premium')}</Text>
  <BoostCard navigation={navigation} />
</View>
```

Do not touch the Privacy section (which contains `IncognitoToggleCard`), the Account section, the Discovery section, the Notifications section, the Support section, or the Danger Zone section.

---

### `app/profile/ProfileScreen.tsx` — Update

Add a boost status row and "Boost Profile" CTA button inside the **Action Buttons** area at the bottom of the profile screen, after the existing "Edit Profile" button and before "Settings". Show the row only when the user is a Pro subscriber. The row uses `BoostCard` in a compact inline variant — but since `BoostCard` already handles all states, simply render it directly.

```typescript
// ADD import:
import { BoostCard } from '@/components/profile/BoostCard'

// ADD inside the action buttons area, after the "Edit Profile" button,
// conditionally rendered for Pro users only:

{profile.premium?.active === true && profile.premium?.tier === 'pro' && (
  <BoostCard navigation={navigation} />
)}
```

Do not touch the photo grid, stats row, bio section, fitness cards, lifestyle cards, connected apps row, or the verified badge logic.

---

### `firestore.rules` — Update

Add `'boost'` to the existing `doesNotModifyServerOnlyFields()` helper's deny-list. This is a targeted, single-line addition — do not restructure or rewrite any other part of the rules file.

```javascript
// LOCATE the doesNotModifyServerOnlyFields() function.
// ADD 'boost' to its deny-list alongside the existing server-only fields.
// The updated function should block client writes to:
// age, banned, banReason, bannedAt, photoVerified, verifiedAt,
// stripeCustomerId, premium, subscription (legacy), boost

// ALSO add to doesNotSetServerOnlyFieldsOnCreate() in the same way —
// clients must not set boost on document creation either.
```

Do not touch any other rule, match block, helper function, or allow/deny expression.

---

### `i18n/en.json` — Update

Add the following keys. Place `profile.boost.*` inside the existing `profile` namespace and `settings.boost.*` / `settings.sections.premium` inside the existing `settings` namespace. Do not remove any existing keys.

```json
{
  "profile": {
    "boost": {
      "title": "Profile Boost",
      "available": "Available this month",
      "activeTimeRemaining": "Active — {{time}} remaining",
      "usedThisMonth": "Used this month · Resets next month",
      "alreadyActive": "Your boost is already active",
      "alreadyUsedThisMonth": "You've already used your boost this month",
      "activated": "Boost activated! You're now at the top of the stack.",
      "error": "Could not activate boost. Please try again.",
      "buttonLabel": "Boost"
    }
  },
  "settings": {
    "sections": {
      "premium": "Premium"
    },
    "boost": {
      "title": "Profile Boost",
      "description": "Move to the top of the discovery stack for 30 minutes. Once per month."
    }
  }
}
```

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Mirror the identical key structure from `en.json` with the same English strings as placeholders. All three files must receive the same keys — no file may be left incomplete.

```json
{
  "profile": {
    "boost": {
      "title": "Profile Boost",
      "available": "Available this month",
      "activeTimeRemaining": "Active — {{time}} remaining",
      "usedThisMonth": "Used this month · Resets next month",
      "alreadyActive": "Your boost is already active",
      "alreadyUsedThisMonth": "You've already used your boost this month",
      "activated": "Boost activated! You're now at the top of the stack.",
      "error": "Could not activate boost. Please try again.",
      "buttonLabel": "Boost"
    }
  },
  "settings": {
    "sections": {
      "premium": "Premium"
    },
    "boost": {
      "title": "Profile Boost",
      "description": "Move to the top of the discovery stack for 30 minutes. Once per month."
    }
  }
}
```

---

## Important Architecture Notes for Codex

1. **Boost writes are server-only.** `activateBoost` is the exclusive writer of `boost.activatedAt` and `boost.expiresAt`. No client store, hook, or component may call `updateDoc` or `profileStore.updateProfile()` with a `boost` payload. Firestore rules will block any such attempt. The client reads `profileStore.profile.boost` (already synced from Firestore via the existing profile listener) — it never writes it.

2. **`getFunctions` callable pattern — do not use the regional callable pattern from `discoveryStore`.** `BoostCard` calls `activateBoost` via `httpsCallable` from `firebase/functions` with `getFunctions(undefined, 'asia-southeast1')`. This is consistent with how other callables (`rewindSwipe`, `createCustomerPortalSession`) are invoked from components that cannot use hooks requiring store wiring.

3. **Pro gate only — Plus is not enough.** The Pro gate check is `premium.active === true && premium.tier === 'pro'`. A Plus subscriber (`premium.tier === 'plus'`) must be redirected to `PremiumScreen` identically to a free user. This check is enforced in both `BoostCard` (client navigation) and `activateBoost` (server `HttpsError`).

4. **Monthly cap uses calendar month, not rolling 30 days.** Both the Cloud Function and the client-side `isBoostUsedThisMonth()` helper compare `activatedAt.getFullYear() === now.getFullYear() && activatedAt.getMonth() === now.getMonth()`. Do not implement a 30-day rolling window.

5. **Boost scoring uplift is +20 in `getDiscoveryStack` only.** The score increment must be placed inside the existing candidate scoring loop, after the `photoVerified` block, and before the loop's final push to the results array. Do not add scoring logic anywhere else. Do not modify the query filters, the incognito exclusion, or the premium-pool query path.

6. **`firestore.rules` is a targeted one-word addition.** Only `'boost'` is added to `doesNotModifyServerOnlyFields()` and `doesNotSetServerOnlyFieldsOnCreate()`. No other rule block may be changed. Do not add a new match block for `boost`.

7. **`BoostCard` renders in both `SettingsScreen` and `ProfileScreen` — no duplication.** The single `BoostCard` component handles all states (available, active, used-this-month, non-Pro). Do not create a separate `BoostStatusRow` or `BoostButton` component.

8. **`types/user.ts` is already correct — do not touch it.** `boost?: { activatedAt: Timestamp; expiresAt: Timestamp }` was added in Task 70. The `BoostCard` casts `profile.boost` locally because the Firestore SDK returns `Timestamp` objects at runtime matching the type definition.

---

## Acceptance Criteria

- [ ] `functions/src/activateBoost.ts` created and exports `activateBoost` as a named export
- [ ] `activateBoost` throws `HttpsError('permission-denied')` for non-Pro callers (Plus and free)
- [ ] `activateBoost` throws `HttpsError('resource-exhausted')` when boost has already been used in the current calendar month
- [ ] `activateBoost` writes `boost.activatedAt` using `admin.firestore.FieldValue.serverTimestamp()` and `boost.expiresAt` using `admin.firestore.Timestamp.fromMillis(now + 30 * 60 * 1000)`
- [ ] `activateBoost` appended to `functions/src/index.ts` — no existing export removed or reordered
- [ ] `functions/src/getDiscoveryStack.ts` applies +20 score uplift for candidates whose `boost.expiresAt.toMillis() > Date.now()`
- [ ] `components/profile/BoostCard.tsx` created and exports `BoostCard` as a named export
- [ ] `BoostCard` navigates to `Premium` screen for non-Pro users on press without calling the Cloud Function
- [ ] `BoostCard` shows correct status label for all three states: available, active (with remaining time), used-this-month
- [ ] `BoostCard` disables the button and shows `ActivityIndicator` while `isLoading` is true
- [ ] `BoostCard` button is disabled when boost is already active or already used this month
- [ ] `SettingsScreen` renders `BoostCard` in a new Premium section — existing sections unchanged
- [ ] `ProfileScreen` renders `BoostCard` only when `profile.premium?.tier === 'pro'`
- [ ] `firestore.rules` deny-list in `doesNotModifyServerOnlyFields()` includes `'boost'`
- [ ] `firestore.rules` deny-list in `doesNotSetServerOnlyFieldsOnCreate()` includes `'boost'`
- [ ] `profile.boost.*` and `settings.boost.*` and `settings.sections.premium` keys present in all four language files (`en`, `my`, `zh`, `ta`)
- [ ] All imports use `@/` alias — no relative paths in any touched file
- [ ] Zero `any` in all touched files
- [ ] Zero inline `style={{ }}` in all touched files
- [ ] Zero `console.*` calls in all touched files
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm --prefix functions run build` passes with zero errors

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `types/user.ts`,
`types/event.ts`, `types/checkin.ts`, `types/match.ts`, `types/message.ts`,
`types/subscription.ts`, `constants/`, `services/firebase/auth.ts`,
`services/firebase/firestore.ts`, `services/firebase/storage.ts`,
`services/firebase/realtime.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`,
`store/chatStore.ts`, `store/subscriptionStore.ts`, `store/fitnessStore.ts`,
`components/settings/IncognitoToggleCard.tsx`, `components/ui/PremiumBadge.tsx`,
`components/ui/Button.tsx`, `components/ui/LoadingOverlay.tsx`,
`functions/src/rewindSwipe.ts`, `functions/src/createCustomerPortalSession.ts`,
`functions/src/recordSwipe.ts`, `functions/src/onSwipeCreated.ts`,
`functions/src/onUserCreated.ts`, `functions/src/verifyProfilePhoto.ts`,
`functions/src/createStripeCheckout.ts`, `functions/src/stripeWebhook.ts`,
`functions/src/exchangeStravaToken.ts`, `functions/src/syncStravaActivity.ts`,
`firestore.indexes.json`, `babel.config.js`, `tsconfig.json`, `app.json`, `eas.json`

---

## Commit

```
git commit -m "task-74: profile boost — activateBoost CF, BoostCard, discovery scoring, rules hardening"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3A - Task 74] - YYYY-MM-DD

### Completed

- Task 74: Profile Boost for Pro-tier users
- activateBoost: 2nd-gen callable enforcing Pro gate, calendar-month cap (1 per month), and 30-minute expiry; writes boost.activatedAt and boost.expiresAt server-side
- getDiscoveryStack: +20 score uplift applied for candidates with an active boost (expiresAt > now)
- BoostCard: self-contained Pro-gated card with available/active/used-this-month states, time-remaining display, and PremiumScreen navigation for non-Pro users
- SettingsScreen: new Premium section added with BoostCard
- ProfileScreen: BoostCard rendered for Pro users in the action buttons area
- firestore.rules: boost added to doesNotModifyServerOnlyFields() and doesNotSetServerOnlyFieldsOnCreate() deny-lists
- profile.boost.* and settings.boost.* i18n keys added to all 4 language files

### Files Created / Modified

- functions/src/activateBoost.ts: created — Pro gate, monthly cap, serverTimestamp writes, returns expiresAt millis
- functions/src/getDiscoveryStack.ts: boost score uplift block added inside candidate scoring loop
- functions/src/index.ts: activateBoost export appended
- components/profile/BoostCard.tsx: created — all boost states, Pro gate navigation, httpsCallable, toast feedback
- app/settings/SettingsScreen.tsx: Premium section and BoostCard added
- app/profile/ProfileScreen.tsx: BoostCard rendered for Pro users
- firestore.rules: boost added to both server-only field deny-list helpers
- i18n/en.json, my.json, zh.json, ta.json: profile.boost.* and settings.boost.* and settings.sections.premium keys added
- CHANGELOG.md: Task 74 completion entry added

### Architecture Decisions

- [Describe any non-obvious decisions made during implementation]

### Known Issues / Deferred

- None

### Next Up

- Task 75: [Next Phase 3 task]
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

High — involves a new Cloud Function with two enforcement layers (Pro gate + calendar-month cap), a Firestore rules change, a scoring change inside an existing callable, and a multi-surface UI component that must correctly derive state from Firestore-sourced data without any client writes.
