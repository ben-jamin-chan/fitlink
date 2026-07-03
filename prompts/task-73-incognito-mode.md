# CODEX PROMPT — Task 73: Incognito Mode (Pro Tier)

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Tasks 70–72 are complete. The following files are confirmed built and available:

- `types/user.ts` — `UserProfile` now includes optional `incognito?: boolean` field added in Task 70 (Phase 3 type scaffolding); do not redefine this field
- `store/authStore.ts` — `useAuthStore()` exposes `user.uid` as the authenticated user ID
- `store/profileStore.ts` — `useProfileStore()` exposes `profile: UserProfile | null` and `updateProfile(partial: Partial<UserProfile>): Promise<void>` which writes to `/users/{uid}` via `updateDoc`
- `store/discoveryStore.ts` — `getDiscoveryStack` Cloud Function call is in `fetchStack()`; `swipeRight`, `swipeLeft`, `swipeSuperLike`, and `rewind` actions all exist; `isRewinding` state exists
- `store/subscriptionStore.ts` — `isPremium(): boolean` checks `profile.premium.active`; `selectedTier` state is available to distinguish `'plus'` vs `'pro'`
- `components/ui/PremiumBadge.tsx` — `PremiumBadge` component accepts `tier: 'plus' | 'pro'`; named export
- `components/ui/Button.tsx` — `primary`, `outline`, `ghost` variants; `loading` and `disabled` props; named export
- `components/discovery/UpsellModal.tsx` — accepts `reason: 'likes' | 'superLike' | 'rewind'`; shows paywall; named export
- `app/settings/SettingsScreen.tsx` — existing settings screen; has a Privacy section with the "Pause Account" toggle
- `app/settings/PremiumScreen.tsx` — Pro features list already mentions Incognito Mode as a bullet; "Upgrade Now" CTA navigates here
- `functions/src/getDiscoveryStack.ts` — filters candidates with `banned === false` and `paused === false`; does not yet filter by `incognito`
- `functions/src/index.ts` — all Cloud Functions exported here; `rewindSwipe` was last appended in Task 72
- `firestore.rules` — `premium.*`, `photoVerified`, `verifiedAt`, `banned`, `age` are server-only write fields; `fitnessTracking.shareOnProfile` is client-writable; `paused` is client-writable
- `i18n/en.json`, `my.json`, `zh.json`, `ta.json` — `discovery.rewind.*` keys were last added in Task 72; all four files must remain in sync

**Incognito Mode definition:**
When a Pro-tier user enables Incognito Mode (`incognito: true` on their user document), their profile is excluded from the discovery stacks of users who have not already matched with them. They can still swipe and appear to existing matches in chat. They appear normally to no one new until Incognito is disabled.

**Architectural boundary — client writes `incognito` directly:**
Unlike `premium.*` and `photoVerified`, the `incognito` flag is a user preference — not a server-enforced security boundary. It is safe to write `incognito` from the client via `profileStore.updateProfile()` the same way `paused` is toggled. There is no Cloud Function required for the toggle itself. The enforcement happens inside `getDiscoveryStack` (server-side, Cloud Function), which already owns the filtering logic.

**Architectural boundary — no new `UpsellModal` reason required:**
The existing `UpsellModal` with `reason: 'superLike'` or `reason: 'likes'` is sufficient. Incognito upsell uses a direct navigation to `PremiumScreen` (same pattern as the rewind premium gate in `ActionButtons`), not a new modal reason.

**Architectural boundary — discovery filtering is the only Cloud Function change:**
Only `functions/src/getDiscoveryStack.ts` is modified on the backend side. No new Cloud Function is created for this task.

---

## Task 73 — Incognito Mode (Pro Tier)

**Files to create:**
- `components/settings/IncognitoToggleCard.tsx`

**Files to modify:**
- `functions/src/getDiscoveryStack.ts` — add `incognito !== true` filter to candidate exclusion logic
- `app/settings/SettingsScreen.tsx` — add Incognito Mode row to Privacy section
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `settings.incognito.*` keys

---

### `components/settings/IncognitoToggleCard.tsx`

This is a self-contained settings card component for the Privacy section of `SettingsScreen`. It renders the Incognito Mode toggle with:
- A header row: ghost/spy icon (`Ionicons` `eye-off-outline`), title, `PremiumBadge tier="pro"` badge
- A description subtitle explaining what Incognito Mode does
- A `Switch` (React Native) that reflects `profile.incognito ?? false`
- On toggle for a **Pro user**: calls `profileStore.updateProfile({ incognito: nextValue })` with a loading state while the Firestore write resolves; shows a success toast on completion and an error toast on failure
- On toggle for a **non-Pro user**: does NOT write to Firestore; instead navigates to `PremiumScreen` immediately with `navigation.navigate('Premium')`
- The `Switch` is disabled while `isUpdating` is true to prevent double-taps
- Uses `useProfileStore` and `useSubscriptionStore` — no props needed for profile state (reads from store directly)
- Accepts `navigation` as a prop typed with `StackNavigationProp` so it can navigate to `Premium`

```typescript
// 1. React imports
import React, { useState } from 'react'

// 2. React Native imports
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'

// 3. Third-party libraries
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { StackNavigationProp } from '@react-navigation/stack'

// 4. Internal — stores
import { useProfileStore } from '@/store/profileStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'

// 5. Internal — components
import { PremiumBadge } from '@/components/ui/PremiumBadge'

// 6. Internal — utils
import { showToast } from '@/components/ui/Toast'

// 8. Internal — types
import type { RootStackParamList } from '@/app/navigation/RootNavigator'

// 9. Internal — constants
import { colors, spacing, typography } from '@/constants/theme'

// 10. Props interface
interface IncognitoToggleCardProps {
  navigation: StackNavigationProp<RootStackParamList>
}

export const IncognitoToggleCard = ({
  navigation,
}: IncognitoToggleCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const { profile, updateProfile } = useProfileStore()
  const { isPremium, selectedTier } = useSubscriptionStore()

  const [isUpdating, setIsUpdating] = useState<boolean>(false)

  const isProUser = isPremium() && selectedTier === 'pro'
  const isIncognito = profile?.incognito ?? false

  const handleToggle = async (nextValue: boolean): Promise<void> => {
    if (!isProUser) {
      // Non-Pro users: navigate to PremiumScreen for upsell
      navigation.navigate('Premium')
      return
    }

    setIsUpdating(true)
    try {
      await updateProfile({ incognito: nextValue })
      showToast(
        nextValue
          ? t('settings.incognito.enabledToast')
          : t('settings.incognito.disabledToast'),
        'success',
      )
    } catch {
      showToast(t('settings.incognito.errorToast'), 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconTitleRow}>
          <Ionicons
            name="eye-off-outline"
            size={22}
            color={colors.gray[800]}
            style={styles.icon}
          />
          <Text style={styles.title}>{t('settings.incognito.title')}</Text>
        </View>
        <View style={styles.badgeRow}>
          <PremiumBadge tier="pro" />
          <Switch
            value={isProUser ? isIncognito : false}
            onValueChange={handleToggle}
            disabled={isUpdating}
            trackColor={{ false: colors.gray[200], true: colors.primary }}
            thumbColor={colors.white}
            style={styles.switch}
          />
        </View>
      </View>
      <Text style={styles.description}>{t('settings.incognito.description')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  } as ViewStyle,
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  } as ViewStyle,
  icon: {
    marginRight: spacing.sm,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray[800],
    flex: 1,
  } as TextStyle,
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  } as ViewStyle,
  switch: {
    // no extra styles required — layout controlled by badgeRow
  } as ViewStyle,
  description: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    lineHeight: typography.sizes.sm * 1.5,
  } as TextStyle,
})
```

---

### `functions/src/getDiscoveryStack.ts` — Update

Add `incognito !== true` to the candidate exclusion filter. Incognito users must not appear in new discovery stacks; they can still appear to users who have already matched with them (match visibility is not managed by `getDiscoveryStack`, so no change is needed elsewhere).

The filter must be added inside the Firestore query's candidate exclusion step — alongside the existing `banned === false` and `paused === false` checks. This is the only change to this file.

```typescript
// In the candidate query filter block, add this condition alongside the existing filters:
// .where('banned', '==', false)
// .where('paused', '==', false)
// ADD:
.where('incognito', 'in', [false, null])
// Rationale: Firestore does not support `!= true`, but `in [false, null]` correctly
// excludes documents where incognito === true, while including documents where
// incognito === false or the field is absent (existing users without the field set).
// This must be added consistently to BOTH the premium-leading query and the baseline
// location query that were introduced in Task 69.
```

> Do not touch the scoring algorithm, the `excludeIds` set construction, the response shape, or any other filter condition. Only the candidate exclusion `where` clauses change.

---

### `app/settings/SettingsScreen.tsx` — Update

Add `IncognitoToggleCard` to the existing Privacy section, directly below the existing "Pause Account" toggle row. Do not remove or reorder any existing rows.

```typescript
// Add import at the top of the file (internal components section):
import { IncognitoToggleCard } from '@/components/settings/IncognitoToggleCard'

// In the Privacy section JSX, after the existing Pause Account row:
<IncognitoToggleCard navigation={navigation} />
```

> Do not touch any other section of `SettingsScreen.tsx`. The existing pause toggle, blocked users row, language selector, notification toggles, and danger zone must remain unchanged.

---

### `i18n/en.json` — Update

Add the following keys under the `settings` namespace. Add them as a new `incognito` object alongside the existing `settings.*` keys:

```json
"incognito": {
  "title": "Incognito Mode",
  "description": "Browse profiles without appearing in anyone's discovery stack. Your existing matches can still message you.",
  "enabledToast": "Incognito Mode enabled",
  "disabledToast": "Incognito Mode disabled",
  "errorToast": "Failed to update Incognito Mode. Please try again."
}
```

> Add this block inside the existing `"settings"` object in `en.json`. Do not restructure any existing keys.

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Add the same `incognito` block to each file under `settings`, using the English values as placeholders (per CONVENTIONS.md Section 8 — placeholder rule for non-English files):

```json
"incognito": {
  "title": "Incognito Mode",
  "description": "Browse profiles without appearing in anyone's discovery stack. Your existing matches can still message you.",
  "enabledToast": "Incognito Mode enabled",
  "disabledToast": "Incognito Mode disabled",
  "errorToast": "Failed to update Incognito Mode. Please try again."
}
```

> Add to the `"settings"` object in each file. Do not modify any other existing keys in any language file.

---

## Important Architecture Notes for Codex

1. **`incognito` is a client-writable preference field.** Unlike `premium.*`, `photoVerified`, `verifiedAt`, `banned`, and `age`, the `incognito` field is a user-controlled preference and is written directly from `profileStore.updateProfile()` via `updateDoc`. No Cloud Function is needed for the toggle. The existing `firestore.rules` already permits client writes to user preference fields (same pattern as `paused`). Do not create a new Cloud Function for this toggle.

2. **Firestore `in [false, null]` is the correct exclusion pattern.** Firestore does not support `!= true`. The `in [false, null]` filter correctly excludes documents where `incognito === true` while passing documents where `incognito === false` or where the field does not exist on legacy user documents. Apply this filter to both the premium-leading query and the baseline location query inside `getDiscoveryStack.ts`.

3. **`selectedTier` from `subscriptionStore` determines Pro vs Plus.** The `isPremium()` helper only confirms that the subscription is active. Incognito Mode is Pro-tier only. Both conditions must be true: `isPremium() === true` AND `selectedTier === 'pro'`. A Plus-tier premium user tapping the toggle must be redirected to `PremiumScreen`, not allowed to enable Incognito.

4. **The `Switch` must be visually `value={false}` for non-Pro users.** A non-Pro user whose stored `profile.incognito` might technically be `true` (e.g., they downgraded) must see the toggle in the OFF position and be redirected to `PremiumScreen` on tap — they should not see the Incognito state as active while not on the Pro tier.

5. **No new `UpsellModal` reason is introduced.** The non-Pro tap path navigates directly to `PremiumScreen` using `navigation.navigate('Premium')`. Do not add a new `reason` prop to `UpsellModal` and do not modify `UpsellModal.tsx` in this task.

6. **`navigation` prop on `IncognitoToggleCard` must be typed.** Use `StackNavigationProp<RootStackParamList>` — import `RootStackParamList` from `@/app/navigation/RootNavigator`. Do not use `useNavigation()` hook inside the component; accept `navigation` as an explicit prop so the parent screen controls the navigation context.

7. **`showToast` is a singleton utility.** Import it from `@/components/ui/Toast` exactly as it is imported elsewhere in the codebase. Do not instantiate a new toast component or add local state for toast visibility.

---

## Acceptance Criteria

- [ ] `components/settings/IncognitoToggleCard.tsx` created and exports `IncognitoToggleCard` as a named export
- [ ] Toggle reads `profile?.incognito ?? false` from `profileStore` — not from local component state
- [ ] Pro user toggling ON: calls `updateProfile({ incognito: true })`, shows success toast, switch reflects new value after Firestore write resolves
- [ ] Pro user toggling OFF: calls `updateProfile({ incognito: false })`, shows success toast
- [ ] Plus user tapping toggle: navigates to `PremiumScreen` without writing to Firestore
- [ ] Non-premium user tapping toggle: navigates to `PremiumScreen` without writing to Firestore
- [ ] `Switch` is disabled (`disabled={isUpdating}`) while the Firestore write is in-flight
- [ ] `Switch` shows `value={false}` for any non-Pro user regardless of stored `incognito` value
- [ ] `PremiumBadge tier="pro"` renders in the header row of the card
- [ ] `IncognitoToggleCard` added to `SettingsScreen.tsx` Privacy section below the Pause Account row
- [ ] `functions/src/getDiscoveryStack.ts` adds `.where('incognito', 'in', [false, null])` to both the premium-leading candidate query and the baseline location candidate query
- [ ] `settings.incognito.*` keys added to all 4 language files (`en.json`, `my.json`, `zh.json`, `ta.json`) with no missing keys in any file
- [ ] All imports use `@/` alias — no relative paths anywhere in new or modified files
- [ ] All styles in `StyleSheet.create({})` — zero `style={{ }}` inline styles
- [ ] All colors, spacing, and typography values from `constants/theme` — no hardcoded hex codes or pixel values
- [ ] Zero `any` usage across all created and modified files
- [ ] Zero `console.*` calls in any touched client file or Cloud Function file
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm --prefix functions run build` passes with zero errors

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`,
`store/chatStore.ts`, `services/firebase/config.ts`, `services/firebase/auth.ts`,
`services/stripe.ts`, `types/user.ts`, `types/event.ts`, `types/checkin.ts`,
`types/subscription.ts`, `constants/`, `components/ui/UpsellModal.tsx`,
`components/ui/Button.tsx`, `components/ui/PremiumBadge.tsx`,
`components/discovery/ActionButtons.tsx`, `firestore.rules`, `firestore.indexes.json`,
`functions/src/rewindSwipe.ts`, `functions/src/createCustomerPortalSession.ts`,
`functions/src/recordSwipe.ts`, `functions/src/onSwipeCreated.ts`

---

## Commit

```
git commit -m "task-73: incognito mode for pro tier users"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3A — Task 73] — YYYY-MM-DD

### Completed

- Task 73: Incognito Mode for Pro-tier users
- IncognitoToggleCard: self-contained settings card with Pro gate, Switch, PremiumBadge, and success/error toast wiring
- getDiscoveryStack: incognito filter added to both premium-leading and baseline candidate queries using `in [false, null]` pattern
- SettingsScreen: IncognitoToggleCard added to Privacy section below Pause Account row
- settings.incognito.* i18n keys added to all 4 language files

### Files Created / Modified

- components/settings/IncognitoToggleCard.tsx: created — Pro-gated incognito toggle card with store integration and navigation prop
- functions/src/getDiscoveryStack.ts: incognito exclusion filter added to both candidate query paths
- app/settings/SettingsScreen.tsx: IncognitoToggleCard import and render added to Privacy section
- i18n/en.json, my.json, zh.json, ta.json: settings.incognito.* keys added

### Architecture Decisions

- incognito is written directly from profileStore.updateProfile() — same pattern as paused — because it is a user-controlled preference, not a server-enforced security boundary
- Non-Pro (including Plus-tier) users are redirected to PremiumScreen on toggle tap; no new UpsellModal reason was introduced
- Firestore `in [false, null]` is used instead of `!= true` because Firestore does not support not-equal filters on boolean fields in composite index queries

### Known Issues / Deferred

- [Note any TypeScript errors or lint findings, or write "None"]

### Next Up

- Task 74: Profile Boost (Pro tier — 1x per month visibility multiplier)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 74 prompt.

---

## Reasoning Level

High — this task involves a server-side Cloud Function query change (both candidate query paths in `getDiscoveryStack` must be updated atomically), a Pro-tier gate that distinguishes between Plus and Pro subscriptions (not just `isPremium()`), and a Firestore filter pattern (`in [false, null]`) that is non-obvious and easy to get wrong. The client toggle also requires careful handling of the non-Pro downgrade edge case where `profile.incognito` could be `true` while `selectedTier` is no longer `'pro'`.
