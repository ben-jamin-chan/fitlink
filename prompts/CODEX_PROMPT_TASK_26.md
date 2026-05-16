# CODEX PROMPT — Task 26
# SwipeCard Component (Reanimated 3, Gesture.Pan(), 60fps)

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3.4 complete. Relevant existing files:

- `store/discoveryStore.ts` — `stack: UserProfile[]`, `currentIndex: number`, `swipeRight(targetId)`, `swipeLeft(targetId)`, `swipeSuperLike(targetId)`, `advanceStack()` all implemented; `dailyLikesCount` and `dailyLimitReached` state available
- `types/user.ts` — `UserProfile` interface with `photos: string[]`, `firstName`, `age`, `location.city`, `activities: string[]`, `fitnessLevel`, `verified: boolean`, `lastActive: Timestamp`
- `constants/theme.ts` — `colors`, `spacing`, `typography`, `borderRadius` all exported
- `react-native-reanimated` (v3) and `react-native-gesture-handler` (v2) — both installed in Task 02
- `expo-haptics` — installed in Task 02
- `components/ui/` — `Button`, `Input`, `LoadingOverlay`, `Toast` all exist; do not modify them
- `i18n/en.json` — `discovery.*` keys already seeded

Task 26 builds the `SwipeCard` component. It is consumed by `DiscoveryScreen` in Task 27. The card must animate at 60fps using the **Reanimated 3 + RNGH v2** pattern. The deprecated `useAnimatedGestureHandler` API must not appear anywhere — use `Gesture.Pan()` inside `GestureDetector` as specified in CONVENTIONS.md Section 11.

---

## Task 26 — SwipeCard Component

**Files to create:**
- `components/discovery/SwipeCard.tsx`
- `components/discovery/SwipeLabel.tsx`
- `components/discovery/ActivityBadge.tsx`

**Files to modify:**
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add any missing `discovery.swipe.*` keys used in this component

**Do not touch:**
- `store/discoveryStore.ts`
- `types/user.ts`
- `constants/`
- `components/ui/`
- `App.tsx`
- Any navigation files
- Any screen files (Task 27 scope)

---

## Detailed Spec

### Architecture — Reanimated 3 Pattern (MANDATORY)

CONVENTIONS.md Section 11 is the authority. Summary of the required pattern:

```typescript
// ✅ CORRECT — Reanimated 3 + RNGH v2
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'

const translateX = useSharedValue(0)
const translateY = useSharedValue(0)

const panGesture = Gesture.Pan()
  .onUpdate((event) => {
    translateX.value = event.translationX
    translateY.value = event.translationY
  })
  .onEnd((event) => {
    if (event.translationX > SWIPE_THRESHOLD) {
      runOnJS(onSwipeRight)()
    } else if (event.translationX < -SWIPE_THRESHOLD) {
      runOnJS(onSwipeLeft)()
    } else if (event.translationY < -SWIPE_THRESHOLD) {
      runOnJS(onSuperLike)()
    } else {
      translateX.value = withSpring(0, SNAP_BACK_CONFIG)
      translateY.value = withSpring(0, SNAP_BACK_CONFIG)
    }
  })

// ❌ WRONG — do not use this API
const gestureHandler = useAnimatedGestureHandler({ ... }) // Removed in Reanimated 3
```

**Spring config for snap-back** (from CONVENTIONS.md):
```typescript
const SNAP_BACK_CONFIG = { damping: 15, stiffness: 150 }
```

**Swipe thresholds** (from CONVENTIONS.md):
```typescript
const SWIPE_THRESHOLD = 100   // px horizontal for like/pass
const SUPER_LIKE_THRESHOLD = 100  // px vertical (negative = up)
```

**Exit animation:** When a swipe threshold is crossed, fly the card off screen in the swipe direction before calling the JS-thread callback. Use `withSpring` to a value of `±500` (offscreen), then call `runOnJS(callback)()` in the `.onEnd` after updating the shared values. Do not call `runOnJS` inside `.onUpdate`.

---

### `components/discovery/ActivityBadge.tsx`

Small pill chip showing a single activity string. Used in the card overlay and later in the full profile modal.

```typescript
interface ActivityBadgeProps {
  activity: string
  highlighted?: boolean   // true when activity is shared with viewer (Phase 2 use)
}
```

- Background: `colors.overlay` (semi-transparent black) when not highlighted, `colors.primary` when highlighted
- Text: `colors.white`, `typography.sizes.xs`, `typography.weights.semibold`
- Padding: `spacing.xs` vertical, `spacing.sm` horizontal
- Border radius: `borderRadius.full` (add `borderRadius.full = 999` to `constants/theme.ts` if not present — check first before adding)
- No inline styles

---

### `components/discovery/SwipeLabel.tsx`

Animated overlay label that fades in as the card is dragged. Three variants: LIKE, NOPE, SUPER.

```typescript
interface SwipeLabelProps {
  type: 'like' | 'nope' | 'super'
  opacity: Animated.SharedValue<number>   // driven by parent's translateX/translateY
}
```

- LIKE: green border + green text, rotated -15°, top-left of card
- NOPE: red border + red text, rotated +15°, top-right of card
- SUPER: blue border + blue text, centred bottom of card, no rotation
- Border: 3px solid, border radius `borderRadius.md`
- Text: `typography.sizes.xl`, `typography.weights.bold`, letter spacing 2
- Use `useAnimatedStyle` to apply `opacity` from the shared value passed in
- No inline styles; all positioning via `StyleSheet.create` with `position: 'absolute'`

---

### `components/discovery/SwipeCard.tsx`

This is the main deliverable for Task 26.

#### Props

```typescript
interface SwipeCardProps {
  user: UserProfile
  onSwipeRight: () => void       // called after exit animation completes
  onSwipeLeft: () => void
  onSuperLike: () => void
  onTap: () => void              // open full profile modal (Task 28)
  isTop: boolean                 // true = top card (receives gestures), false = background card
  stackIndex: number             // 0 = top, 1 = second, 2 = third — drives scale/translateY offset
}
```

#### Layout

The card must fill the available space passed by its parent container. Use `flex: 1` on the outer `Animated.View`. Do not hardcode card dimensions — the parent (`DiscoveryScreen`) will set width/height via a wrapping `View`.

**Layers (bottom to top):**
1. Primary photo — `Image` with `resizeMode: 'cover'`, fills entire card
2. Photo pagination dots — top centre, only if `user.photos.length > 1`
3. Gradient overlay — bottom 45% of card using `expo-linear-gradient` (install if not present: `npx expo install expo-linear-gradient`) — transparent at top, `rgba(0,0,0,0.75)` at bottom
4. Text overlay (pinned to bottom-left over gradient):
   - Name + Age: `{user.firstName}, {user.age}` — `typography.sizes.xl`, `typography.weights.bold`, `colors.white`
   - Distance: `{distanceLabel}` — `typography.sizes.sm`, `colors.gray[200]` — see distance label logic below
   - Activity badges row: first 2 activities from `user.activities` as `<ActivityBadge>` chips, horizontal, gap `spacing.xs`
   - Fitness level badge: same `ActivityBadge` component, `highlighted={false}`, shows `user.fitnessLevel`
5. Verified badge — top-right, only if `user.verified === true` — blue checkmark circle (`Ionicons name="checkmark-circle"`, size 24, color `colors.secondary`)
6. SwipeLabel overlays: LIKE (top-left), NOPE (top-right), SUPER (bottom-centre) — opacity driven by drag

#### Distance label logic

```typescript
// lastActive is a Firestore Timestamp
const getActiveLabel = (lastActive: Timestamp): string => {
  const ms = Date.now() - lastActive.toMillis()
  const hours = ms / (1000 * 60 * 60)
  if (hours < 1) return t('discovery.activeNow')
  if (hours < 24) return t('discovery.activeHoursAgo', { count: Math.floor(hours) })
  return t('discovery.activeDaysAgo', { count: Math.floor(hours / 24) })
}
```

Show this as the "distance" line for Phase 1 (actual GPS distance is Phase 2). Use `user.location.city` as a second line below the name if you need to fill the space.

#### Photo pagination dots

```typescript
// Only render if user.photos.length > 1
// Active dot: colors.white, size 6, opacity 1
// Inactive dot: colors.white, size 6, opacity 0.4
// Horizontal row, centred, gap spacing.xs
// Track currentPhotoIndex in useState
```

Photo navigation: tapping the **left third** of the card = previous photo; tapping the **right third** = next photo. The **centre third** tap = call `onTap` (open profile modal). Use `onPress` on three invisible `TouchableOpacity` strips layered over the card — only on the `isTop` card.

#### Background card scaling

When `isTop === false`, the card should not receive gestures. Apply a static scale and vertical offset based on `stackIndex`:

```typescript
const STACK_SCALE = [1, 0.95, 0.90]
const STACK_OFFSET_Y = [0, 12, 24]  // pixels pushed down

// Background cards use a non-animated static transform:
const backgroundStyle = {
  transform: [
    { scale: STACK_SCALE[stackIndex] ?? 0.90 },
    { translateY: STACK_OFFSET_Y[stackIndex] ?? 24 },
  ]
}
```

When `isTop === true`, the animated transform drives scale and position via `useAnimatedStyle`:

```typescript
const animatedStyle = useAnimatedStyle(() => ({
  transform: [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { rotate: `${interpolate(
        translateX.value,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-15, 0, 15],
        Extrapolation.CLAMP
      )}deg` },
  ],
}))
```

#### Label opacity derivation

```typescript
// LIKE label opacity: driven by positive translateX
const likeOpacity = useAnimatedStyle(() => ({
  opacity: interpolate(
    translateX.value,
    [0, SWIPE_THRESHOLD],
    [0, 1],
    Extrapolation.CLAMP
  ),
}))

// NOPE label opacity: driven by negative translateX
const nopeOpacity = useAnimatedStyle(() => ({
  opacity: interpolate(
    translateX.value,
    [-SWIPE_THRESHOLD, 0],
    [1, 0],
    Extrapolation.CLAMP
  ),
}))

// SUPER label opacity: driven by negative translateY (upward drag)
const superOpacity = useAnimatedStyle(() => ({
  opacity: interpolate(
    translateY.value,
    [-SUPER_LIKE_THRESHOLD, 0],
    [1, 0],
    Extrapolation.CLAMP
  ),
}))
```

Pass the raw `SharedValue<number>` to `SwipeLabel` — do NOT pass a derived animated style. `SwipeLabel` accepts the shared value and runs its own `useAnimatedStyle` internally.

#### Haptics

Call `expo-haptics` in the JS-thread callbacks (not in worklets):

```typescript
import * as Haptics from 'expo-haptics'

const handleSwipeRight = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  onSwipeRight()
}

const handleSwipeLeft = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  onSwipeLeft()
}

const handleSuperLike = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  onSuperLike()
}
```

#### Full structure outline

```typescript
export const SwipeCard = ({
  user,
  onSwipeRight,
  onSwipeLeft,
  onSuperLike,
  onTap,
  isTop,
  stackIndex,
}: SwipeCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  // Derived opacity shared values for labels
  // ... (as shown above)

  const panGesture = Gesture.Pan()
    .enabled(isTop)   // background cards do not receive gestures
    .onUpdate(...)
    .onEnd(...)

  const tapGesture = Gesture.Tap()
    .enabled(isTop)
    .onEnd(...)   // handled via TouchableOpacity strips instead — see photo navigation

  const animatedStyle = useAnimatedStyle(...)

  const activeLabel = getActiveLabel(user.lastActive)

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, isTop ? animatedStyle : backgroundStyle]}>
        {/* Primary photo */}
        <Image
          source={{ uri: user.photos[currentPhotoIndex] ?? user.photos[0] }}
          style={styles.photo}
          resizeMode="cover"
        />

        {/* Photo navigation strips (isTop only) */}
        {isTop && (
          <View style={styles.photoNavRow}>
            <TouchableOpacity style={styles.photoNavLeft} onPress={handlePrevPhoto} activeOpacity={1} />
            <TouchableOpacity style={styles.photoNavCenter} onPress={onTap} activeOpacity={1} />
            <TouchableOpacity style={styles.photoNavRight} onPress={handleNextPhoto} activeOpacity={1} />
          </View>
        )}

        {/* Pagination dots */}
        {user.photos.length > 1 && (
          <View style={styles.dotsRow}>
            {user.photos.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentPhotoIndex ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={styles.gradient}
        />

        {/* Text overlay */}
        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{user.firstName}, {user.age}</Text>
          <Text style={styles.distanceText}>{activeLabel}</Text>
          <Text style={styles.cityText}>{user.location.city}</Text>
          <View style={styles.badgesRow}>
            {user.activities.slice(0, 2).map((activity) => (
              <ActivityBadge key={activity} activity={activity} />
            ))}
            <ActivityBadge activity={user.fitnessLevel} />
          </View>
        </View>

        {/* Verified badge */}
        {user.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
          </View>
        )}

        {/* Swipe labels */}
        <SwipeLabel type="like" opacity={/* likeSharedValue */} />
        <SwipeLabel type="nope" opacity={/* nopeSharedValue */} />
        <SwipeLabel type="super" opacity={/* superSharedValue */} />
      </Animated.View>
    </GestureDetector>
  )
}
```

> Note: `SwipeLabel` must accept a `Animated.SharedValue<number>` (not a plain number or animated style object). Define a proper typed interface using `SharedValue` from `react-native-reanimated`.

---

## i18n Keys to Add

Add these keys to all 4 language files (`en.json`, `my.json`, `zh.json`, `ta.json`). Non-English files use English as placeholder:

```json
"discovery": {
  "activeNow": "Active now",
  "activeHoursAgo_one": "Active {{count}}h ago",
  "activeHoursAgo_other": "Active {{count}}h ago",
  "activeDaysAgo_one": "Active {{count}}d ago",
  "activeDaysAgo_other": "Active {{count}}d ago",
  "swipe": {
    "like": "LIKE",
    "nope": "NOPE",
    "super": "SUPER"
  }
}
```

Merge these with any existing `discovery.*` keys — do not overwrite keys already present.

---

## expo-linear-gradient

If `expo-linear-gradient` is not yet installed:

```bash
npx expo install expo-linear-gradient
```

Import as:
```typescript
import { LinearGradient } from 'expo-linear-gradient'
```

Check `package.json` before running install to avoid re-installing.

---

## StyleSheet Notes

All styles in `StyleSheet.create({})` at the bottom of each file. No inline styles anywhere.

Key styles to include in `SwipeCard.tsx`:

```typescript
const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.gray[200],
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  photoNavRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 10,
  },
  photoNavLeft: { flex: 1 },
  photoNavCenter: { flex: 1 },
  photoNavRight: { flex: 1 },
  dotsRow: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    zIndex: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  dotActive: { opacity: 1 },
  dotInactive: { opacity: 0.4 },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
  infoContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.md,
    right: spacing.md,
    gap: spacing.xs,
  },
  nameText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  distanceText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[200],
  },
  cityText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[300],
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  verifiedBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 5,
  },
})
```

---

## Important Architecture Notes for Codex

1. **`Gesture.Pan().enabled(isTop)`** — background cards must have `.enabled(false)` so gestures pass through only to the top card. This is the correct RNGH v2 pattern. Do not conditionally omit `GestureDetector` — always render it, use `.enabled()`.

2. **No state updates inside worklets.** The `.onUpdate` and `.onEnd` callbacks run on the UI thread. The only state mutation allowed there is updating `SharedValue`s. All Zustand store calls (`swipeRight`, `swipeLeft`, etc.) must be wrapped in `runOnJS`.

3. **Exit animation before callback.** On threshold cross in `.onEnd`, animate the card off screen first (update `translateX.value` / `translateY.value` to ±500), then call `runOnJS(callback)()`. This ensures the visual exit happens before the card is removed from the stack by the store.

4. **`SwipeLabel` shared value type.** Use `SharedValue<number>` from `react-native-reanimated`:
   ```typescript
   import type { SharedValue } from 'react-native-reanimated'
   
   interface SwipeLabelProps {
     type: 'like' | 'nope' | 'super'
     opacity: SharedValue<number>
   }
   ```
   Then inside `SwipeLabel`, call `useAnimatedStyle(() => ({ opacity: props.opacity.value }))`.

5. **`borderRadius.lg`** — check `constants/theme.ts` / `constants/spacing.ts`. If `borderRadius` is not yet exported from theme, add it to `constants/theme.ts` as:
   ```typescript
   export const borderRadius = { sm: 4, md: 8, lg: 16, xl: 24, full: 999 } as const
   ```
   and re-export from `constants/theme.ts`. Do not add inline values.

6. **Photo navigation tap zones.** The three invisible `TouchableOpacity` strips (left/centre/right thirds) must have `activeOpacity={1}` so they don't flash on tap. They sit above the `LinearGradient` and text layers but below the swipe labels. Only rendered when `isTop === true`.

7. **`colors.gray[900]`** — check that this shade exists in `constants/colors.ts`. If only `gray[800]` exists, use `gray[800]` for dark text. Do not hardcode hex values.

---

## Acceptance Criteria

- [ ] `ActivityBadge.tsx` created — renders activity string as a pill chip, no inline styles
- [ ] `SwipeLabel.tsx` created — LIKE/NOPE/SUPER variants, opacity driven by `SharedValue<number>`, no inline styles
- [ ] `SwipeCard.tsx` created — full card layout as specified
- [ ] `Gesture.Pan()` used inside `GestureDetector` — no `useAnimatedGestureHandler` anywhere
- [ ] Background cards (isTop=false) do not receive gestures (`.enabled(false)`)
- [ ] Stack offset and scale applied to background cards via static transform (not animated)
- [ ] Rotation range is -15° to +15° derived from `translateX` via `interpolate`
- [ ] LIKE label fades in on right drag, NOPE on left drag, SUPER on upward drag
- [ ] Snap-back spring uses `{ damping: 15, stiffness: 150 }` config
- [ ] Swipe threshold is 100px for all three directions
- [ ] Exit animation fires card off screen before JS callback is called
- [ ] `runOnJS` used for all JS-thread side effects (haptics, store callbacks)
- [ ] Haptics fire correctly per swipe direction (Success / Light / Heavy)
- [ ] Photo carousel: tap left third = prev photo, tap centre = onTap, tap right third = next photo
- [ ] Pagination dots render only when `user.photos.length > 1`
- [ ] Verified badge renders only when `user.verified === true`
- [ ] Active status label shown (derived from `user.lastActive`)
- [ ] First 2 activities + fitness level shown as `ActivityBadge` chips
- [ ] `expo-linear-gradient` installed and gradient overlay renders
- [ ] All i18n keys added to all 4 language files
- [ ] No inline styles anywhere across all 3 files
- [ ] No hardcoded hex colours or pixel values
- [ ] `tsc --noEmit` passes with zero errors
- [ ] No `any` types

## Do Not Touch

`store/discoveryStore.ts`, `store/authStore.ts`, `types/user.ts`, `services/`, `hooks/`, `App.tsx`, all navigation files, all screen files (`app/`), `components/ui/`, `functions/`

## Commit

```
git commit -m "task-26: swipe card component with reanimated 3 gesture pan, labels, photo carousel"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3.5] — YYYY-MM-DD
### Completed
- Task 26: SwipeCard component built (Reanimated 3, Gesture.Pan(), 60fps)
- ActivityBadge chip component created
- SwipeLabel overlay component created (LIKE/NOPE/SUPER, SharedValue-driven opacity)
- expo-linear-gradient installed and gradient overlay implemented
- Photo carousel with left/centre/right tap zones
- Haptics wired per swipe direction

### Files Created / Modified
- components/discovery/SwipeCard.tsx: full swipe card with gesture, animation, exit, layout
- components/discovery/SwipeLabel.tsx: LIKE/NOPE/SUPER labels driven by SharedValue opacity
- components/discovery/ActivityBadge.tsx: pill chip for activity and fitness level display
- constants/theme.ts: borderRadius added if not already present
- i18n/en.json, my.json, zh.json, ta.json: discovery.swipe.* and activeNow/activeHoursAgo/activeDaysAgo keys added

### Known Issues / Deferred
- Actual GPS distance from viewer not shown — deferred to Phase 2; city name and lastActive shown instead
- Pinch-to-zoom on card photo deferred to FullProfileModal (Task 28)
- "Active today" badge from fitness tracker data deferred to Phase 2 (Strava/Health integration)

### Next Up
- Task 27: DiscoveryScreen (renders card stack, wires ActionButtons to discoveryStore, empty state, upsell modal stub)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 27 prompt.

---

## Reasoning Level
High
