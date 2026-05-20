# CODEX PROMPT — Task 34
# Match Celebration Modal — Confetti, Animations, Icebreaker, Navigation

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1D tasks 29–33 are complete. Relevant existing files:

- `store/matchStore.ts` — `matches: MatchWithProfile[]`, `newMatchIds: string[]`, `subscribeToMatches()`, `unmatch()`, `markAsRead()`. The `newMatchIds` array holds match IDs where the match was just created (mutual like detected). This is the trigger signal for the celebration modal.
- `store/discoveryStore.ts` — `swipeRight()`, `swipeLeft()`, `swipeSuperLike()` — swipe actions that ultimately produce matches
- `store/authStore.ts` — `user.uid` available
- `types/match.ts` — `MatchWithProfile` (extends `Match`, adds `otherUser: UserProfile`)
- `types/user.ts` — `UserProfile` (has `firstName`, `photos: string[]`, `activities: string[]`)
- `app/discovery/DiscoveryScreen.tsx` — renders SwipeCards, ActionButtons; this is where the modal will be surfaced
- `app/navigation/MainTabNavigator.tsx` — bottom tabs: Discover, Matches, Profile, Settings
- `app/chat/ChatScreen.tsx` — navigation target after "Send Message" tap
- `components/ui/Button.tsx` — `variant: 'primary' | 'outline' | 'ghost'`, `label`, `onPress`, `loading`, `disabled`
- `constants/theme.ts` — `colors`, `spacing`, `typography`, `borderRadius` all exported
- `i18n/en.json` — add strings under `discovery.matchCelebration.*`

**Important:** `react-native-confetti-cannon` must be installed as part of this task. It is not yet in `package.json`.

---

## Task 34 — Match Celebration Modal

**Files to create:**
- `components/discovery/MatchCelebrationModal.tsx`

**Files to modify:**
- `app/discovery/DiscoveryScreen.tsx` — mount the modal, wire to `matchStore.newMatchIds`
- `store/matchStore.ts` — add `clearNewMatch(matchId: string)` action
- `i18n/en.json` — add `discovery.matchCelebration.*` keys
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — same keys, English placeholder values

**Package to install:**
```bash
npx expo install react-native-confetti-cannon
```

---

## New i18n Keys

Add to all four locale files. Use these English values; other languages use the same English text as placeholders until translated by a native speaker.

```json
"discovery": {
  "matchCelebration": {
    "headline": "It's a Match!",
    "subheadline": "You and {{name}} liked each other",
    "sharedActivities": "You both love {{activities}}",
    "sendMessage": "Send Message",
    "keepSwiping": "Keep Swiping",
    "icebreakerPrefix": "Hey {{name}}! I see you're into {{activity}} too —"
  }
}
```

---

## `store/matchStore.ts` — Add `clearNewMatch`

Add one action to the existing store. Do not touch any other state or actions.

```typescript
// Add to actions:
clearNewMatch: (matchId: string) => void
```

Implementation:
```typescript
clearNewMatch: (matchId) =>
  set((state) => ({
    newMatchIds: state.newMatchIds.filter((id) => id !== matchId),
  })),
```

---

## `components/discovery/MatchCelebrationModal.tsx`

Full implementation below. Read all architecture notes before writing any code.

```typescript
import React, { useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated'
import ConfettiCannon from 'react-native-confetti-cannon'
import { useNavigation } from '@react-navigation/native'
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useMatchStore } from '@/store/matchStore'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'
import type { UserProfile } from '@/types/user'
import type { MainTabParamList } from '@/app/navigation/MainTabNavigator'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const PHOTO_SIZE = 110
const PHOTO_BORDER = 3

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MatchCelebrationModalProps {
  matchId: string
  otherUser: UserProfile
  currentUserPhoto: string    // primary photo URI of the logged-in user
  onDismiss: () => void
}

// ---------------------------------------------------------------------------
// Shared activities helper
// ---------------------------------------------------------------------------

const getSharedActivities = (
  myActivities: string[],
  theirActivities: string[]
): string[] =>
  myActivities.filter((a) => theirActivities.includes(a))

const formatActivitiesList = (activities: string[]): string => {
  if (activities.length === 0) return ''
  if (activities.length === 1) return activities[0]
  if (activities.length === 2) return `${activities[0]} and ${activities[1]}`
  return `${activities.slice(0, 2).join(', ')} and more`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MatchCelebrationModal = ({
  matchId,
  otherUser,
  currentUserPhoto,
  onDismiss,
}: MatchCelebrationModalProps): React.JSX.Element => {
  const { t } = useTranslation()
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>()
  const { clearNewMatch } = useMatchStore()
  const confettiRef = useRef<ConfettiCannon>(null)

  // Reanimated values
  const modalTranslateY = useSharedValue(SCREEN_HEIGHT)
  const photo1Scale = useSharedValue(0)
  const photo2Scale = useSharedValue(0)
  const headlineOpacity = useSharedValue(0)
  const subOpacity = useSharedValue(0)
  const badgesOpacity = useSharedValue(0)
  const buttonsOpacity = useSharedValue(0)

  // ---------------------------------------------------------------------------
  // Entry animation sequence
  //
  // Timeline:
  //   0ms   modal slides up from bottom (spring)
  //   250ms confetti fires
  //   300ms photo 1 pops in (spring overshoot)
  //   450ms photo 2 pops in (spring overshoot)
  //   550ms headline fades in
  //   700ms subheadline + shared badges fade in
  //   850ms buttons fade in
  // ---------------------------------------------------------------------------

  const fireConfetti = useCallback((): void => {
    confettiRef.current?.start()
  }, [])

  useEffect(() => {
    // Modal slide up
    modalTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 })

    // Confetti fires after modal settles
    const confettiTimeout = setTimeout(() => {
      fireConfetti()
    }, 250)

    // Photos pop in
    photo1Scale.value = withDelay(
      300,
      withSequence(
        withSpring(1.15, { damping: 8, stiffness: 200 }),
        withSpring(1.0, { damping: 12, stiffness: 200 })
      )
    )
    photo2Scale.value = withDelay(
      450,
      withSequence(
        withSpring(1.15, { damping: 8, stiffness: 200 }),
        withSpring(1.0, { damping: 12, stiffness: 200 })
      )
    )

    // Text elements fade in
    headlineOpacity.value = withDelay(550, withTiming(1, { duration: 250 }))
    subOpacity.value = withDelay(700, withTiming(1, { duration: 250 }))
    badgesOpacity.value = withDelay(700, withTiming(1, { duration: 250 }))
    buttonsOpacity.value = withDelay(850, withTiming(1, { duration: 300 }))

    return () => clearTimeout(confettiTimeout)
  }, []) // Run once on mount — intentionally no deps

  // ---------------------------------------------------------------------------
  // Animated styles
  // ---------------------------------------------------------------------------

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalTranslateY.value }],
  }))
  const photo1Style = useAnimatedStyle(() => ({
    transform: [{ scale: photo1Scale.value }],
  }))
  const photo2Style = useAnimatedStyle(() => ({
    transform: [{ scale: photo2Scale.value }],
  }))
  const headlineStyle = useAnimatedStyle(() => ({ opacity: headlineOpacity.value }))
  const subStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }))
  const buttonsStyle = useAnimatedStyle(() => ({ opacity: buttonsOpacity.value }))

  // ---------------------------------------------------------------------------
  // Dismiss flow (close modal + remove from newMatchIds)
  // ---------------------------------------------------------------------------

  const handleDismiss = useCallback((): void => {
    // Slide back down before calling onDismiss
    modalTranslateY.value = withTiming(
      SCREEN_HEIGHT,
      { duration: 300 },
      (finished) => {
        if (finished) {
          runOnJS(clearNewMatch)(matchId)
          runOnJS(onDismiss)()
        }
      }
    )
  }, [matchId, onDismiss, clearNewMatch, modalTranslateY])

  // ---------------------------------------------------------------------------
  // Navigation to chat
  // ---------------------------------------------------------------------------

  const handleSendMessage = useCallback((): void => {
    // Build icebreaker suggestion from first shared activity
    const shared = getSharedActivities(
      [], // currentUser activities — passed in from parent; see DiscoveryScreen wiring
      otherUser.activities
    )
    const icebreaker =
      shared.length > 0
        ? t('discovery.matchCelebration.icebreakerPrefix', {
            name: otherUser.firstName,
            activity: shared[0],
          })
        : undefined

    handleDismiss()

    // Navigate: MainTab → Matches tab → ChatScreen
    // ChatScreen is nested inside MatchesStack; navigate to it with matchId + icebreaker
    navigation.navigate('Matches', {
      screen: 'ChatScreen',
      params: { matchId, icebreakerSuggestion: icebreaker },
    } as never) // cast needed due to nested navigator type complexity
  }, [matchId, otherUser, navigation, handleDismiss, t])

  // ---------------------------------------------------------------------------
  // Shared activities display
  // ---------------------------------------------------------------------------

  const sharedActivities = getSharedActivities([], otherUser.activities)
  const activitiesLabel =
    sharedActivities.length > 0
      ? t('discovery.matchCelebration.sharedActivities', {
          activities: formatActivitiesList(sharedActivities),
        })
      : null

  const otherUserPhoto =
    otherUser.photos.length > 0 ? otherUser.photos[0] : null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal
      visible
      transparent
      animationType="none"      // We handle animation ourselves
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleDismiss} />

      {/* Confetti — rendered above backdrop, behind modal sheet */}
      <ConfettiCannon
        ref={confettiRef}
        count={120}
        origin={{ x: SCREEN_WIDTH / 2, y: -10 }}
        autoStart={false}
        fadeOut
        fallSpeed={3000}
        explosionSpeed={400}
        colors={[
          colors.primary,
          colors.secondary,
          colors.warning,
          '#FF69B4',
          '#FFD700',
        ]}
      />

      {/* Modal sheet */}
      <Animated.View style={[styles.sheet, modalStyle]}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Headline */}
        <Animated.View style={headlineStyle}>
          <Text style={styles.headline}>
            {t('discovery.matchCelebration.headline')}
          </Text>
        </Animated.View>

        {/* Photos row */}
        <View style={styles.photosRow}>
          <Animated.View style={[styles.photoWrapper, photo1Style]}>
            <Image
              source={{ uri: currentUserPhoto }}
              style={styles.photo}
            />
          </Animated.View>

          {/* Heart between photos */}
          <Text style={styles.heartEmoji}>💚</Text>

          <Animated.View style={[styles.photoWrapper, photo2Style]}>
            {otherUserPhoto !== null ? (
              <Image
                source={{ uri: otherUserPhoto }}
                style={styles.photo}
              />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]} />
            )}
          </Animated.View>
        </View>

        {/* Subheadline + names */}
        <Animated.View style={[styles.textCenter, subStyle]}>
          <Text style={styles.subheadline}>
            {t('discovery.matchCelebration.subheadline', {
              name: otherUser.firstName,
            })}
          </Text>

          {/* Shared activities badge row */}
          {activitiesLabel !== null && (
            <View style={styles.sharedBadge}>
              <Text style={styles.sharedBadgeText}>{activitiesLabel}</Text>
            </View>
          )}
        </Animated.View>

        {/* Action buttons */}
        <Animated.View style={[styles.buttons, buttonsStyle]}>
          <Button
            label={t('discovery.matchCelebration.sendMessage')}
            onPress={handleSendMessage}
            variant="primary"
          />
          <Button
            label={t('discovery.matchCelebration.keepSwiping')}
            onPress={handleDismiss}
            variant="outline"
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  } as ViewStyle,
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
    alignItems: 'center',
    minHeight: SCREEN_HEIGHT * 0.55,
  } as ViewStyle,
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[200],
    marginBottom: spacing.lg,
  } as ViewStyle,
  headline: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  } as TextStyle,
  photosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  } as ViewStyle,
  photoWrapper: {
    borderRadius: PHOTO_SIZE / 2 + PHOTO_BORDER,
    borderWidth: PHOTO_BORDER,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  } as ViewStyle,
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
  } as ImageStyle,
  photoPlaceholder: {
    backgroundColor: colors.gray[200],
  } as ImageStyle,
  heartEmoji: {
    fontSize: 32,
    marginHorizontal: spacing.xs,
  } as TextStyle,
  textCenter: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  } as ViewStyle,
  subheadline: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: spacing.md,
  } as TextStyle,
  sharedBadge: {
    backgroundColor: colors.primary + '1A',   // 10% opacity primary
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  } as ViewStyle,
  sharedBadgeText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  } as TextStyle,
  buttons: {
    width: '100%',
    gap: spacing.sm,
  } as ViewStyle,
})
```

---

## `app/discovery/DiscoveryScreen.tsx` — Wire the Modal

Add the following to the existing `DiscoveryScreen`. Do not rewrite the screen — make targeted additions only.

### Imports to add
```typescript
import { MatchCelebrationModal } from '@/components/discovery/MatchCelebrationModal'
import { useMatchStore } from '@/store/matchStore'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
```

### Inside the component, add:
```typescript
const { newMatchIds, matches, clearNewMatch } = useMatchStore()
const { profile } = useProfileStore()

// The first pending new match to celebrate (one at a time)
const pendingMatchId = newMatchIds.length > 0 ? newMatchIds[0] : null

// Resolve the full MatchWithProfile for the pending match
const pendingMatch = pendingMatchId !== null
  ? matches.find((m) => m.id === pendingMatchId) ?? null
  : null

const currentUserPhoto = profile?.photos[0] ?? ''

const handleModalDismiss = (): void => {
  // clearNewMatch is also called inside the modal's dismiss animation callback,
  // but we add it here as a safety net in case onRequestClose fires on Android.
  if (pendingMatchId !== null) {
    clearNewMatch(pendingMatchId)
  }
}
```

### Pass currentUser activities to the modal

The `MatchCelebrationModal` currently calls `getSharedActivities([], otherUser.activities)` with a hardcoded empty array. Update the component signature to accept `currentUserActivities: string[]` and pass `profile?.activities ?? []` from `DiscoveryScreen`. Then replace the `[]` in both `getSharedActivities` calls inside the modal with `currentUserActivities`.

**This is the correct fix for the placeholder `[]` in the modal code above.** Codex must make this change — do not ship the modal with hardcoded `[]` for the current user's activities.

Updated `MatchCelebrationModalProps`:
```typescript
interface MatchCelebrationModalProps {
  matchId: string
  otherUser: UserProfile
  currentUserPhoto: string
  currentUserActivities: string[]   // ← add this
  onDismiss: () => void
}
```

### Render the modal at the bottom of the JSX return, inside the root View, after the swipe stack and action buttons:

```tsx
{pendingMatch !== null && (
  <MatchCelebrationModal
    matchId={pendingMatch.id}
    otherUser={pendingMatch.otherUser}
    currentUserPhoto={currentUserPhoto}
    currentUserActivities={profile?.activities ?? []}
    onDismiss={handleModalDismiss}
  />
)}
```

---

## Important Architecture Notes for Codex

### 1. One modal at a time — queue-draining pattern

`newMatchIds` is an array. If two mutual likes arrive in quick succession, the modal shows the first one. When it is dismissed (and `clearNewMatch` runs), `pendingMatchId` shifts to the next element, and the modal re-mounts for the next match. No complex queue logic needed — React's re-render handles it automatically.

### 2. `handleDismiss` uses Reanimated `withTiming` callback with `runOnJS`

The dismiss animation completes before `clearNewMatch` and `onDismiss` are called. This prevents a flash where the parent re-renders (removing the modal) while the slide-down animation is still in progress. Never call `clearNewMatch` or `onDismiss` directly from the backdrop `Pressable` without going through `handleDismiss`.

### 3. Confetti fires via imperative `ref.current?.start()`

`ConfettiCannon` is set to `autoStart={false}`. It fires via `setTimeout` after the modal slide-up spring settles (250ms). Do not set `autoStart={true}` — it would fire before the modal is visible.

### 4. Animation values reset on unmount — no manual cleanup needed

Each `useSharedValue` is scoped to the component instance. When the modal unmounts between two consecutive celebrations (one match dismissed, next match pending), the values initialise fresh on the next mount. Do not add a reset `useEffect` on unmount.

### 5. `navigation.navigate('Matches', { screen: 'ChatScreen', params: {...} })`

This assumes `ChatScreen` is nested inside the Matches tab stack (as per ARCHITECT.md). The `as never` cast suppresses TypeScript errors from nested navigator type inference — this is acceptable here (see CONVENTIONS.md: `as` is allowed with a comment). Add the comment:

```typescript
// as never: nested navigator param types are inferred correctly at runtime
// but TypeScript cannot resolve them statically across tab + stack boundary
navigation.navigate('Matches', { screen: 'ChatScreen', params: { matchId, icebreakerSuggestion: icebreaker } } as never)
```

### 6. `borderRadius.full` and `borderRadius.xl`

These values must exist in `constants/theme.ts`. If `borderRadius` is not yet exported from theme, add it now:

```typescript
// constants/theme.ts (or constants/spacing.ts)
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  full: 9999,
} as const
```

Then re-export from `constants/theme.ts`:
```typescript
export { borderRadius } from './spacing'
```

### 7. No `react-native-confetti-cannon` types package needed

The library ships its own TypeScript declarations. Do not install `@types/react-native-confetti-cannon`.

### 8. `services/firebase/realtime.ts` — remove duplicate unread increment

Per the architectural decision made in Task 33: `{recipientId}_unread` is now incremented server-side by the `onNewMessage` Cloud Function. If `realtime.ts`'s `sendMessage` function also increments `{userId}_unread` on the Firestore match document, remove that increment now to prevent double-counting. This is the client-side cleanup flagged after Task 33 completed.

---

## Acceptance Criteria

- [ ] `react-native-confetti-cannon` installed via `npx expo install`
- [ ] `MatchCelebrationModal` created in `components/discovery/`
- [ ] Modal slides up from bottom with spring animation on mount
- [ ] Confetti fires ~250ms after modal appears
- [ ] Both user photos pop in sequentially with spring overshoot (scale > 1 then settle)
- [ ] Headline "It's a Match!" fades in after photos
- [ ] Shared activities badge shows correctly when activities overlap; hidden when none shared
- [ ] "Send Message" button navigates to ChatScreen with `matchId` and icebreaker suggestion
- [ ] "Keep Swiping" button dismisses modal with slide-down animation
- [ ] Backdrop tap dismisses modal
- [ ] Dismiss animation completes before `clearNewMatch` is called (no flash)
- [ ] `clearNewMatch(matchId)` removed from `matchStore.newMatchIds` after dismiss
- [ ] If multiple matches arrive in sequence, second modal appears after first is dismissed
- [ ] `currentUserActivities` prop correctly wired from `profileStore.profile.activities`
- [ ] `getSharedActivities` uses real `currentUserActivities`, not hardcoded `[]`
- [ ] `borderRadius` exported from `constants/theme.ts` (add if missing)
- [ ] `services/firebase/realtime.ts` `sendMessage` does **not** increment `_unread` on Firestore match doc (removed per Task 33 follow-up)
- [ ] New i18n keys added to all four locale files
- [ ] Zero inline styles
- [ ] Zero `any` types
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`functions/src/`, `store/authStore.ts`, `store/chatStore.ts`, `store/discoveryStore.ts` (except reading from it if needed), `app/chat/ChatScreen.tsx`, `components/ui/`, `types/`, `services/firebase/auth.ts`, `services/firebase/config.ts`, `hooks/`

## Commit
`git commit -m "task-34: match celebration modal with confetti and animated photo reveal"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1D — Task 34] — YYYY-MM-DD
### Completed
- Task 34: MatchCelebrationModal — confetti, animated photo pop-in, shared activities badge,
  Send Message → ChatScreen navigation, Keep Swiping dismiss

### Files Created / Modified
- components/discovery/MatchCelebrationModal.tsx: full celebration modal with Reanimated 3
  animation sequence, ConfettiCannon, icebreaker suggestion, queue-draining dismiss pattern
- app/discovery/DiscoveryScreen.tsx: modal wired to matchStore.newMatchIds, pendingMatch resolved
- store/matchStore.ts: clearNewMatch(matchId) action added
- services/firebase/realtime.ts: duplicate _unread increment removed (now Cloud Function only)
- constants/theme.ts: borderRadius exported (if was missing)
- i18n/*.json: discovery.matchCelebration.* keys added to all four locale files

### Packages Added
- react-native-confetti-cannon

### Architecture Decisions
- One modal at a time: newMatchIds[0] drives render; clearNewMatch shifts queue
- Dismiss animation gate: runOnJS(clearNewMatch) fires only after withTiming completes
- Confetti imperative ref + setTimeout: avoids firing before modal is visible

### Known Issues / Deferred
- Icebreaker pre-fill in ChatScreen input not yet implemented (ChatInput just receives
  icebreakerSuggestion param; wiring to defaultValue is a minor ChatScreen update)

### Next Up
- Task 35: ProfileStore — fetchProfile, updateProfile, uploadPhoto, deletePhoto
```

Then bring ARCHITECT.md + this CHANGELOG entry to claude.ai for the Task 35 prompt.

---

## Reasoning Level
High — animation sequencing with Reanimated 3, confetti timing, dismiss-gate pattern with `runOnJS`, cross-tab navigation typing, and the `currentUserActivities` prop correction from the modal stub all require careful coordination.
