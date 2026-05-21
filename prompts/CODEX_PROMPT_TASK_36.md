# CODEX PROMPT — Task 36
# Profile Screen — Own Profile View

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1E in progress. Task 35 (profileStore) is complete. Relevant existing files:

- `store/profileStore.ts` — `fetchProfile`, `updateProfile`, `uploadPhoto`, `deletePhoto`, optimistic rollback. State: `profile: UserProfile | null`, `isLoading: boolean`, `error: string | null`.
- `store/authStore.ts` — `user` (Firebase user), `isAuthenticated`. Calls `profileStore.fetchProfile` on login, `profileStore.reset()` on logout.
- `components/profile/PhotoGrid.tsx` — 3-column grid, 6 slots, 3:4 aspect ratio, Primary badge, remove button. **Reuse as read-only display here** (no editing on ProfileScreen — that is EditProfileScreen's job, Task 37).
- `types/user.ts` — `UserProfile` interface, all fields matching ARCHITECT.md schema including `verified`, `paused`, `banned`, `stats`, `subscription`, `activities`, `fitnessLevel`, `fitnessGoals`, `dietaryPreference`, `smoking`, `drinking`, `height`, `religion`, `workoutFrequency`.
- `constants/theme.ts` — all color, spacing, typography tokens.
- `components/ui/Button.tsx` — `primary`, `outline`, `ghost` variants.
- `components/ui/LoadingOverlay.tsx` — full-screen spinner.
- `i18n/en.json` — strings; `profile.*` namespace partially populated; add any missing keys here.
- `app/navigation/MainTabNavigator.tsx` — Profile tab currently renders a placeholder. **Replace the placeholder** with `ProfileScreen`.

Task 36 builds the **own profile view screen** — read-only display of all user data with navigation to edit and settings. It does NOT implement editing (Task 37) or settings (Task 38).

---

## Task 36 — Profile Screen

**Files to create:**
- `app/profile/ProfileScreen.tsx`
- `components/profile/StatsBadge.tsx`
- `components/profile/InfoCard.tsx`
- `components/profile/ActivityChip.tsx`

**Files to modify:**
- `app/navigation/MainTabNavigator.tsx` — replace Profile tab placeholder with `ProfileScreen`
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add any missing `profile.*` keys

---

### `components/profile/ActivityChip.tsx`

Small pill-shaped chip displaying a single activity name. Used in profile cards and on this screen. Reusable by FullProfileModal (Task 28) if not already defined there — **if `ActivityChip` already exists, skip creation and import from its existing path**.

```typescript
import React from 'react'
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { colors, spacing, typography } from '@/constants/theme'

interface ActivityChipProps {
  label: string
  highlighted?: boolean   // true = primary color bg (shared activity use-case)
}

export const ActivityChip = ({ label, highlighted = false }: ActivityChipProps): React.JSX.Element => {
  return (
    <View style={[styles.chip, highlighted && styles.chipHighlighted]}>
      <Text style={[styles.label, highlighted && styles.labelHighlighted]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[200],
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  } as ViewStyle,
  chipHighlighted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  } as ViewStyle,
  label: {
    fontSize: typography.sizes.xs,
    color: colors.gray[700],
    fontWeight: typography.weights.medium,
  } as TextStyle,
  labelHighlighted: {
    color: colors.white,
  } as TextStyle,
})
```

---

### `components/profile/StatsBadge.tsx`

Single stat display (number + label). Used in the 3-column stats row on ProfileScreen.

```typescript
import React from 'react'
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { colors, spacing, typography } from '@/constants/theme'

interface StatsBadgeProps {
  value: number | string
  label: string
}

export const StatsBadge = ({ value, label }: StatsBadgeProps): React.JSX.Element => {
  return (
    <View style={styles.container}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  } as ViewStyle,
  value: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: 2,
  } as TextStyle,
  label: {
    fontSize: typography.sizes.xs,
    color: colors.gray[500],
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
})
```

---

### `components/profile/InfoCard.tsx`

Reusable bordered card for grouping profile detail rows (Basic Info, Fitness Profile, Lifestyle sections). Props include a title, optional edit button handler, and `children`.

```typescript
import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography } from '@/constants/theme'

interface InfoCardProps {
  title: string
  onEdit?: () => void       // if provided, shows edit icon in top-right
  children: React.ReactNode
}

export const InfoCard = ({ title, onEdit, children }: InfoCardProps): React.JSX.Element => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onEdit !== undefined && (
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="pencil-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  )
}

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  value: string
}

export const InfoRow = ({ icon, label, value }: InfoRowProps): React.JSX.Element => {
  return (
    <View style={rowStyles.row}>
      <Ionicons name={icon} size={16} color={colors.gray[500]} style={rowStyles.icon} />
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
    padding: spacing.md,
    marginBottom: spacing.md,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
  } as TextStyle,
})

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  } as ViewStyle,
  icon: {
    marginRight: spacing.sm,
    width: 20,
  } as ViewStyle,
  label: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    flex: 1,
  } as TextStyle,
  value: {
    fontSize: typography.sizes.sm,
    color: colors.gray[800],
    fontWeight: typography.weights.medium,
    flexShrink: 1,
    textAlign: 'right',
  } as TextStyle,
})
```

---

### `app/profile/ProfileScreen.tsx`

Full own-profile view. Reads from `profileStore.profile`. Shows all sections from TASKS.md FR-4.1.1.

**Section order (ScrollView):**

1. **Hero photo** — `profile.photos[0]` as full-width image, 16:9 aspect ratio. `LinearGradient` overlay (bottom 40%) from transparent to `rgba(0,0,0,0.7)`. Name + age in white bold text over gradient (bottom-left). Location (city) in white below. Verified badge (blue checkmark `Ionicons` `checkmark-circle`) next to name if `profile.verified === true`. Edit button (pencil icon, white, top-right floating, navigates to `EditProfileScreen`).

2. **Stats row** — 3 columns separated by vertical dividers using `StatsBadge`:
   - Matches → `profile.stats.matches`
   - Likes → `profile.stats.likes`
   - Days Active → calculated from `profile.createdAt` to today (in days)

3. **Photo grid** — Use `PhotoGrid` from `components/profile/PhotoGrid.tsx` in **read-only mode**. Pass `readOnly={true}` prop — add this prop to `PhotoGrid` if it does not already exist (see note below). Photos shown but no add/remove interaction.

4. **Verification card** — Only shown if `profile.verified === false`. Card with blue checkmark icon, headline "Verify Your Profile", subtitle from i18n, "Verify Now" button (stub `onPress` — logs to console with TODO comment; full implementation is Phase 2). Use `colors.secondary` (blue) for accent.

5. **Bio section** — `InfoCard` with title from i18n `profile.about`. Text rendered inside. If bio is longer than 200 characters, truncate to 200 with "...Read more" tappable suffix that expands inline (local `useState<boolean>` for expanded state — this is acceptable as purely local UI state per CONVENTIONS.md Section 7).

6. **Basic Info card** — `InfoCard` with `onEdit={() => navigation.navigate('EditProfile')}`. Rows using `InfoRow`:
   - Height → `${profile.height} cm`
   - Location → `${profile.location.city}, ${profile.location.country}`
   - Religion → `profile.religion ?? t('profile.notSpecified')`

7. **Fitness Profile card** — `InfoCard` with edit button → `EditProfile`.
   - Activities: Render `ActivityChip` components in a `flexWrap: 'wrap'` `View`
   - Level: `InfoRow` with dumbbell icon
   - Frequency: `InfoRow` with calendar icon
   - Goals: list rendered as comma-separated text in an `InfoRow`

8. **Lifestyle card** — `InfoCard` with edit button → `EditProfile`.
   - Diet: `InfoRow` with restaurant icon
   - Smoking: `InfoRow` with `flame-outline` icon
   - Drinking: `InfoRow` with `wine-outline` icon

9. **Action buttons** — stacked at bottom with `spacing.lg` top margin:
   - "Edit Profile" — `Button` variant `primary` → `navigation.navigate('EditProfile')`
   - "Settings" — `Button` variant `outline` → `navigation.navigate('Settings')`
   - "Get Premium" — `Button` variant `primary` with `colors.secondary` background override — only shown if `profile.subscription.tier === 'free'`. On press: stub `console.log('TODO: navigate to PremiumScreen')`.

**Loading state:** If `profileStore.isLoading === true` or `profile === null`, render `LoadingOverlay visible={true}` instead of the ScrollView.

**Error state:** If `profileStore.error !== null` and `profile === null`, render a centered `View` with error text and a "Retry" `Button` that calls `profileStore.fetchProfile(authStore.user.uid)`.

**Navigation types:** `ProfileScreen` is part of `MainTabParamList`. It also needs to navigate to `'EditProfile'` and `'Settings'` which are in a **Stack** wrapping the tabs or in the same tab stack. Add `EditProfile` and `Settings` as screens to the Profile tab stack in `MainTabNavigator.tsx` (see modification instructions below).

```typescript
// Minimal interface example — Codex fills in full implementation:

import React, { useState } from 'react'
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  // ...
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { LinearGradient } from 'expo-linear-gradient'
import { useProfileStore } from '@/store/profileStore'
import { useAuthStore } from '@/store/authStore'
import { PhotoGrid } from '@/components/profile/PhotoGrid'
import { StatsBadge } from '@/components/profile/StatsBadge'
import { InfoCard, InfoRow } from '@/components/profile/InfoCard'
import { ActivityChip } from '@/components/profile/ActivityChip'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { colors, spacing, typography } from '@/constants/theme'
// ... types
```

> **`expo-linear-gradient` note:** Install if not already present: `npx expo install expo-linear-gradient`. Do not use inline `style` for gradient colours — pass them as the `colors` prop to `LinearGradient`.

---

### `app/navigation/MainTabNavigator.tsx` — Modifications

The Profile tab currently shows a placeholder. Replace it with a **Stack navigator** inside the Profile tab so `ProfileScreen` can navigate to `EditProfileScreen` and `SettingsScreen` without leaving the tab bar.

```typescript
// Add new stack for the Profile tab:

import { createStackNavigator } from '@react-navigation/stack'
import ProfileScreen from '@/app/profile/ProfileScreen'
// EditProfileScreen and SettingsScreen are stubs for now (Tasks 37 and 38):
const EditProfilePlaceholder = (): React.JSX.Element => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>Edit Profile — Task 37</Text>
  </View>
)
const SettingsPlaceholder = (): React.JSX.Element => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>Settings — Task 38</Text>
  </View>
)

export type ProfileStackParamList = {
  Profile: undefined
  EditProfile: undefined
  Settings: undefined
}

const ProfileStack = createStackNavigator<ProfileStackParamList>()

const ProfileStackNavigator = (): React.JSX.Element => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen name="Profile" component={ProfileScreen} />
    <ProfileStack.Screen name="EditProfile" component={EditProfilePlaceholder} />
    <ProfileStack.Screen name="Settings" component={SettingsPlaceholder} />
  </ProfileStack.Navigator>
)

// Then in the bottom tab definition, replace the Profile screen with:
<Tab.Screen name="ProfileTab" component={ProfileStackNavigator} ... />
```

> When Tasks 37 and 38 are implemented, simply replace the placeholder components with the real screens — no nav changes needed.

---

### `PhotoGrid.tsx` — `readOnly` prop addition

`PhotoGrid` in `components/profile/PhotoGrid.tsx` currently always shows interactive add/remove controls. Add a `readOnly?: boolean` prop (default `false`). When `readOnly === true`:
- Empty slots are NOT rendered (only show filled slots)
- Remove ("X") button is NOT rendered on filled slots
- "+" tap is disabled / not rendered
- The Primary badge still appears on slot 0

This makes `PhotoGrid` usable for display purposes on `ProfileScreen` without code duplication. The onboarding and edit profile screens continue to pass `readOnly={false}` (default) and retain full interactivity.

---

### i18n keys to add

Add any of the following that are missing to **all 4 locale files** (`en.json`, `my.json`, `zh.json`, `ta.json`). Use the English value as placeholder in non-English files.

```json
{
  "profile": {
    "editProfile": "Edit Profile",
    "settings": "Settings",
    "getPremium": "Get Premium",
    "verifyNow": "Verify Now",
    "verifyTitle": "Verify Your Profile",
    "verifySubtitle": "Stand out and build trust with a verified badge",
    "readMore": "Read more",
    "readLess": "Read less",
    "notSpecified": "Not specified",
    "daysActive": "Days Active",
    "matches": "Matches",
    "likes": "Likes",
    "about": "About Me",
    "basicInfo": "Basic Info",
    "fitnessProfile": "Fitness & Activities",
    "lifestyle": "Lifestyle",
    "height": "Height",
    "location": "Location",
    "religion": "Religion",
    "level": "Fitness Level",
    "frequency": "Workout Frequency",
    "goals": "Goals",
    "diet": "Diet",
    "smoking": "Smoking",
    "drinking": "Drinking",
    "retry": "Retry",
    "loadError": "Could not load profile"
  }
}
```

---

## Important Architecture Notes for Codex

1. **No profile editing in this task.** `ProfileScreen` is read-only. All edit navigation is stubs pointing to `EditProfilePlaceholder`. Full edit screen is Task 37.

2. **Stats calculation for Days Active.** Calculate from `profile.createdAt` (Firestore `Timestamp`). Use `profile.createdAt.toDate()` and diff with `new Date()`. Round to whole days. Handle the case where `createdAt` may be `undefined` (return `'—'` string).

3. **Verified badge logic.** `profile.verified` maps to the `verified` field from ARCHITECT.md schema (some earlier tasks used `photoVerified` — use whichever field name is in your actual `UserProfile` type in `types/user.ts`; add a comment if there is a discrepancy).

4. **LinearGradient.** Use `expo-linear-gradient`. The gradient sits as an `absolute` positioned `View` over the hero image — not as a sibling. Pattern:
   ```tsx
   <View style={styles.heroContainer}>
     <Image source={{ uri: profile.photos[0] }} style={styles.heroImage} />
     <LinearGradient
       colors={['transparent', 'rgba(0,0,0,0.75)']}
       style={styles.heroGradient}
     />
     <View style={styles.heroTextContainer}>
       {/* name, age, location, verified badge */}
     </View>
   </View>
   ```

5. **No `useState` for profile data.** Profile data comes entirely from `profileStore`. Only `isExpanded` (bio read-more toggle) uses `useState` — this is explicitly permitted by CONVENTIONS.md Section 7 as local UI state.

6. **`Get Premium` button styling.** `Button.tsx` currently accepts `variant`. If it does not accept a `backgroundColor` override prop, do one of:
   - Add an optional `backgroundColor?: string` prop to `Button.tsx` (preferred — keep it generic)
   - Or render a custom styled `TouchableOpacity` inline for the premium button (acceptable fallback)
   Do NOT add inline styles to the `Button` component's internal `StyleSheet` for this one-off color.

7. **Navigation typing.** `ProfileScreen` uses `StackNavigationProp<ProfileStackParamList>` not the tab navigator type. The screen is mounted inside `ProfileStackNavigator`.

8. **`PhotoGrid` in read-only mode.** Only the slot count changes (no empty slots shown). The grid stays 3-column but the last row may be incomplete — this is expected and acceptable.

---

## Acceptance Criteria

- [ ] `ProfileScreen` renders without crash when `profileStore.profile` is populated
- [ ] `LoadingOverlay` shown while `isLoading === true`
- [ ] Error state with Retry shown when `error !== null` and `profile === null`
- [ ] Hero image displays `photos[0]` at 16:9 ratio with gradient overlay
- [ ] Name, age, city shown over hero gradient
- [ ] Verified badge (blue checkmark) visible only when `profile.verified === true`
- [ ] Stats row shows correct Matches, Likes, and Days Active values
- [ ] Photo grid shows profile photos in read-only mode (no add/remove controls)
- [ ] Verification card visible only when `profile.verified === false`
- [ ] Bio truncates at 200 chars with "Read more" toggle
- [ ] Basic Info card shows height, location, religion rows with edit button → EditProfilePlaceholder
- [ ] Fitness Profile card shows activity chips, level, frequency, goals with edit button → EditProfilePlaceholder
- [ ] Lifestyle card shows diet, smoking, drinking rows with edit button → EditProfilePlaceholder
- [ ] "Edit Profile" button navigates to `EditProfilePlaceholder`
- [ ] "Settings" button navigates to `SettingsPlaceholder`
- [ ] "Get Premium" button visible only for `subscription.tier === 'free'` users
- [ ] `ProfileStackNavigator` wired into MainTabNavigator Profile tab
- [ ] All text via `t()`, zero hardcoded strings
- [ ] Zero inline styles
- [ ] `tsc --noEmit` passes with zero errors
- [ ] `PhotoGrid` accepts and respects `readOnly` prop

## Do Not Touch
`store/profileStore.ts`, `store/authStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`, `store/onboardingStore.ts`, `services/firebase/`, `functions/`, `types/`, `components/ui/` (except `Button.tsx` if adding `backgroundColor` prop), `app/auth/`, `app/onboarding/`, `app/discovery/`, `app/matches/`, `app/chat/`, `App.tsx`

## Commit
`git commit -m "task-36: profile screen with hero, stats, info cards, read-only photo grid"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1E — Task 36] — YYYY-MM-DD

### Completed

- Task 36: ProfileScreen built — hero photo, stats row, read-only photo grid, verification card, bio with read-more, Basic Info / Fitness / Lifestyle InfoCards, action buttons
- ProfileStackNavigator added inside MainTabNavigator Profile tab; EditProfile and Settings stubs ready for Tasks 37 and 38

### Files Created / Modified

- app/profile/ProfileScreen.tsx: full own-profile view (read-only)
- components/profile/StatsBadge.tsx: value + label stat display
- components/profile/InfoCard.tsx: bordered card + InfoRow helper
- components/profile/ActivityChip.tsx: pill chip for activity display (or reused if already existing)
- components/profile/PhotoGrid.tsx: added readOnly prop — empty slots and controls hidden in read-only mode
- app/navigation/MainTabNavigator.tsx: Profile tab replaced with ProfileStackNavigator (Profile → EditProfile stub → Settings stub)
- i18n/en.json, my.json, zh.json, ta.json: profile.* keys completed

### Packages Added

- expo-linear-gradient (if not already installed)

### Architecture Decisions

- ProfileScreen is strictly read-only; no form state, no writes
- ProfileStackNavigator wraps Profile tab so edit/settings nav doesn't dismiss tab bar
- Days Active calculated from createdAt.toDate() diff — returns '—' if field missing
- Bio read-more toggle uses local useState<boolean> — explicitly permitted per CONVENTIONS.md §7
- PhotoGrid readOnly prop: hides empty slots and remove controls, preserves Primary badge

### Known Issues / Deferred

- "Verify Now" button is a stub (console.log + TODO) — full verification flow is Phase 2
- "Get Premium" button is a stub — PremiumScreen is Phase 2
- Photo drag-to-reorder deferred to Phase 2
- Profile view count (profile.stats.views) not tracked yet; stats row shows matches + likes + days active only

### Next Up

- Task 37: EditProfileScreen — pre-filled React Hook Form + Zod, photo management, save to profileStore
```

Then bring ARCHITECT.md + this CHANGELOG entry to claude.ai for the Task 37 prompt.

---

## Reasoning Level
Medium-High
