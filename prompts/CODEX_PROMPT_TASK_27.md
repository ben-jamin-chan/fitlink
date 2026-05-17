# CODEX PROMPT — Task 27
# DiscoveryScreen + ActionButtons

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3.5 complete. Relevant existing files:

- `store/discoveryStore.ts` — `stack: UserProfile[]`, `currentIndex: number`, `isLoading: boolean`, `isRefetching: boolean`, `dailyLikesCount: number`. Actions: `fetchStack(userId)`, `swipeRight(targetId)`, `swipeLeft(targetId)`, `swipeSuperLike(targetId)`, `advanceStack()`. `isRefetching` is set `true` when stack drops to ≤ 3 cards — the screen must observe this and call `fetchStack(userId)` itself.
- `components/discovery/SwipeCard.tsx` — animated card (Reanimated 3, Gesture.Pan). Props: `user: UserProfile`, `onSwipeLeft: () => void`, `onSwipeRight: () => void`, `onSuperLike: () => void`, `onTapInfo: () => void`, `isTop: boolean`, `stackIndex: number` (0 = top).
- `components/discovery/SwipeLabel.tsx` — shared-value-driven LIKE/NOPE/SUPER overlays (internal to SwipeCard; no changes needed here).
- `components/discovery/ActivityBadge.tsx` — pill chip; used by SwipeCard internally.
- `store/authStore.ts` — `useAuthStore()` exposes `user.uid` and `profile.subscription.tier`.
- `store/profileStore.ts` — `useProfileStore()` exposes `profile: UserProfile | null`.
- `components/ui/Button.tsx` — available for reuse.
- `constants/theme.ts` — `colors`, `spacing`, `typography` all exported.
- `i18n/en.json` — `discovery.*` keys exist. Add new keys for this task under `discovery.empty.*` and `discovery.upsell.*`.
- `expo-haptics` installed.

Task 27 builds the **DiscoveryScreen** that orchestrates the card stack and the **ActionButtons** row. It also adds an **UpsellModal** stub (no real paywall yet — Phase 2) and an **EmptyState** view.

---

## Task 27 — DiscoveryScreen + ActionButtons

**Files to create:**
- `components/discovery/ActionButtons.tsx`
- `components/discovery/EmptyState.tsx`
- `components/discovery/UpsellModal.tsx`
- `app/discovery/DiscoveryScreen.tsx`

**Files to modify:**
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add missing keys
- `app/navigation/MainTabNavigator.tsx` — swap Discover tab placeholder with real `DiscoveryScreen`

---

### `components/discovery/ActionButtons.tsx`

Five circular action buttons rendered in a horizontal row. Each button triggers a discoveryStore action and plays haptic feedback. Premium-gated buttons (Rewind, Super Like) show a lock indicator when the user is on the free tier — tapping them opens the upsell modal instead.

**Props interface:**

```typescript
interface ActionButtonsProps {
  onPass: () => void
  onLike: () => void
  onSuperLike: () => void
  onRewind: () => void
  onInfo: () => void
  isPremium: boolean
  disabled: boolean   // true while stack is loading or empty
}
```

**Button specs (left to right):**

| Button | Icon | Color | Size | Premium gate |
|---|---|---|---|---|
| Rewind | `reload-outline` (Ionicons) | `colors.warning` | 46px circle | Yes — show lock overlay if free |
| Pass | `close` | `colors.danger` | 56px circle (larger) | No |
| Super Like | `star` | `colors.secondary` | 46px circle | Yes — show lock overlay if free |
| Like | `heart` | `colors.primary` | 56px circle (larger) | No |
| Info | `information-circle-outline` | `colors.purple` | 46px circle | No |

Each button:
- White background circle, colored icon
- `elevation: 4` / `shadowColor` shadow (theme-consistent)
- `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on all taps
- `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` on Like and Pass
- `Haptics.notificationAsync(NotificationFeedbackType.Success)` on Super Like (if premium)
- `disabled` prop → reduce opacity to 0.4, not pressable

Premium gate: if `isPremium === false` and button is gated, render a small `lock-closed` Ionicon badge (size 12, white) in the top-right corner of the button circle. The `onPress` for these buttons must call `onSuperLike` or `onRewind` — the **DiscoveryScreen** decides whether to route those to the store or to the upsell modal based on `isPremium`.

No inline styles. All sizing from `spacing` and explicit pixel constants defined at the top of the file as `const BUTTON_LG = 56` and `const BUTTON_SM = 46`.

---

### `components/discovery/EmptyState.tsx`

Shown when `discoveryStore.stack` is empty and `isLoading === false`.

**Props:**

```typescript
interface EmptyStateProps {
  onRefresh: () => void
  onEditPreferences: () => void
}
```

**Layout (centred, flex: 1):**
- Ionicons `search-outline` icon, size 80, color `colors.gray[400]`
- Headline: `t('discovery.empty.title')` — "No more profiles nearby"
- Subtitle: `t('discovery.empty.subtitle')` — "Check back later or expand your distance range"
- Two buttons stacked:
  - "Refresh" (`primary` variant, full width, calls `onRefresh`)
  - "Edit Preferences" (`outline` variant, full width, calls `onEditPreferences` — navigates to Settings; stub `() => {}` is acceptable if Settings screen navigation is not yet wired from here)

---

### `components/discovery/UpsellModal.tsx`

Stub paywall modal. Shown when a free user taps a premium-gated button. Full Stripe integration is Phase 2; this is a presentational-only modal.

**Props:**

```typescript
interface UpsellModalProps {
  visible: boolean
  trigger: 'super_like' | 'rewind' | 'daily_limit'
  onDismiss: () => void
  onUpgrade: () => void   // stub: shows Coming Soon alert for now
}
```

**Layout (Modal, animationType "slide", presentationStyle "pageSheet"):**
- Drag handle bar at top (short rounded rect, `colors.gray[300]`)
- Headline based on `trigger`:
  - `'daily_limit'` → `t('discovery.upsell.outOfLikes')` — "You're Out of Likes"
  - `'super_like'` → `t('discovery.upsell.superLike')` — "Unlock Super Likes"
  - `'rewind'` → `t('discovery.upsell.rewind')` — "Unlock Rewind"
- Icon: `star` (Ionicons, size 48, color `colors.secondary`) for super_like/rewind; `heart` for daily_limit
- Benefits list (4 items with `checkmark-circle` Ionicon, `colors.primary`):
  - `t('discovery.upsell.benefit1')` — "Unlimited Likes"
  - `t('discovery.upsell.benefit2')` — "5 Super Likes per week"
  - `t('discovery.upsell.benefit3')` — "Rewind last swipe"
  - `t('discovery.upsell.benefit4')` — "See who liked you"
- "Upgrade to Premium" button (`primary` variant, calls `onUpgrade`)
- "Maybe Later" ghost button (calls `onDismiss`)

`onUpgrade` implementation in `DiscoveryScreen`: `Alert.alert(t('discovery.upsell.comingSoon'), t('discovery.upsell.comingSoonMsg'))` then call `onDismiss()`. Do not navigate anywhere — Phase 2 wires this to `PremiumScreen`. Add a `// TODO: Phase 2 — navigate to PremiumScreen` comment.

---

### `app/discovery/DiscoveryScreen.tsx`

The main discovery view. Reads from `discoveryStore` and `authStore`, renders the card stack, action buttons, and modals.

**Key logic:**

**Card stack rendering:**
- Render the top 3 cards from `discoveryStore.stack` (index 0 = top card)
- Render them in reverse order (`[2, 1, 0]`) so index 0 is on top in z-order — React Native renders last child on top
- Pass `stackIndex={i}` to each `SwipeCard` so the card can apply scale/offset for the "stack depth" visual:
  - `stackIndex === 0` → scale 1.0, translateY 0 (top card, fully interactive)
  - `stackIndex === 1` → scale 0.96, translateY 8 (behind, not interactive)
  - `stackIndex === 2` → scale 0.92, translateY 16 (furthest back, not interactive)
- Only `stackIndex === 0` card has gestures enabled (`isTop={true}`); the others receive `isTop={false}` and must not respond to gestures

**Swipe handlers (called by the top SwipeCard's callbacks):**

```typescript
const handleSwipeRight = (): void => {
  const target = stack[0]
  if (!target) return
  void swipeRight(target.uid)
  advanceStack()
}

const handleSwipeLeft = (): void => {
  const target = stack[0]
  if (!target) return
  void swipeLeft(target.uid)
  advanceStack()
}

const handleSuperLike = (): void => {
  if (!isPremium) {
    setUpsellTrigger('super_like')
    setUpsellVisible(true)
    return
  }
  const target = stack[0]
  if (!target) return
  void swipeSuperLike(target.uid)
  advanceStack()
}

const handleRewind = (): void => {
  if (!isPremium) {
    setUpsellTrigger('rewind')
    setUpsellVisible(true)
    return
  }
  // TODO: Phase 2 — implement undo stack
}

const handleUpgrade = (): void => {
  Alert.alert(t('discovery.upsell.comingSoon'), t('discovery.upsell.comingSoonMsg'))
  setUpsellVisible(false)
  // TODO: Phase 2 — navigate to PremiumScreen
}
```

**Auto-refetch when `isRefetching === true`:**

```typescript
useEffect(() => {
  if (isRefetching && userId) {
    void fetchStack(userId)
  }
}, [isRefetching, userId])
```

**Daily limit upsell:** If `discoveryStore` does not yet expose a `dailyLimitReached: boolean`, add it now. Set it `true` inside `swipeRight()` when the daily count is exhausted. Reset to `false` on `fetchStack()`. Observe it in `DiscoveryScreen`:

```typescript
useEffect(() => {
  if (dailyLimitReached) {
    setUpsellTrigger('daily_limit')
    setUpsellVisible(true)
  }
}, [dailyLimitReached])
```

**Initial fetch on mount:**

```typescript
useEffect(() => {
  if (userId && stack.length === 0 && !isLoading) {
    void fetchStack(userId)
  }
}, [userId])
```

**Full profile modal:** `onTapInfo` from `SwipeCard` sets a `selectedUser: UserProfile | null` state. For now, show a temporary stub:

```typescript
const handleTapInfo = (user: UserProfile): void => {
  // TODO: Task 28 — open FullProfileModal
  Alert.alert(user.firstName, user.bio ?? '')
}
```

**Screen structure (no ScrollView — fixed layout):**

```tsx
<SafeAreaView style={styles.container}>
  {/* Card stack area — flex: 1 */}
  <View style={styles.stackArea}>
    {isLoading && stack.length === 0 && (
      <ActivityIndicator size="large" color={colors.primary} />
    )}
    {!isLoading && stack.length === 0 && (
      <EmptyState
        onRefresh={() => { if (userId) void fetchStack(userId) }}
        onEditPreferences={() => {}}  // TODO: Task 38 — navigate to Settings preferences
      />
    )}
    {stack.slice(0, 3).map((user, i) => (
      <SwipeCard
        key={user.uid}
        user={user}
        stackIndex={i}
        isTop={i === 0}
        onSwipeRight={handleSwipeRight}
        onSwipeLeft={handleSwipeLeft}
        onSuperLike={handleSuperLike}
        onTapInfo={() => handleTapInfo(user)}
      />
    )).reverse()}
  </View>

  {/* Action buttons — fixed height at bottom */}
  <ActionButtons
    onPass={handleSwipeLeft}
    onLike={handleSwipeRight}
    onSuperLike={handleSuperLike}
    onRewind={handleRewind}
    onInfo={() => { if (stack[0]) handleTapInfo(stack[0]) }}
    isPremium={isPremium}
    disabled={isLoading || stack.length === 0}
  />

  {/* Upsell modal */}
  <UpsellModal
    visible={upsellVisible}
    trigger={upsellTrigger}
    onDismiss={() => setUpsellVisible(false)}
    onUpgrade={handleUpgrade}
  />
</SafeAreaView>
```

**Derive `isPremium`:**

```typescript
const subscription = useAuthStore(s => s.profile?.subscription)
const isPremium =
  subscription?.tier === 'premium' &&
  (subscription.expiresAt == null ||
    subscription.expiresAt.toMillis() > Date.now())
```

**`userId`:** read from `useAuthStore(s => s.user?.uid)`. If `null`, render `null` — the auth guard is in `RootNavigator`.

**Local state required:**

```typescript
const [upsellVisible, setUpsellVisible] = useState(false)
const [upsellTrigger, setUpsellTrigger] = useState<'super_like' | 'rewind' | 'daily_limit'>('super_like')
```

---

### i18n keys to add

Add to all 4 JSON files (`en.json`, `my.json`, `zh.json`, `ta.json`). Use English values as placeholders in non-English files.

```json
{
  "discovery": {
    "empty": {
      "title": "No more profiles nearby",
      "subtitle": "Check back later or expand your distance range",
      "refresh": "Refresh",
      "editPreferences": "Edit Preferences"
    },
    "upsell": {
      "outOfLikes": "You're Out of Likes",
      "superLike": "Unlock Super Likes",
      "rewind": "Unlock Rewind",
      "upgradeCta": "Upgrade to Premium",
      "maybeLater": "Maybe Later",
      "benefit1": "Unlimited Likes",
      "benefit2": "5 Super Likes per week",
      "benefit3": "Rewind last swipe",
      "benefit4": "See who liked you",
      "comingSoon": "Coming Soon",
      "comingSoonMsg": "Premium subscriptions launching soon!"
    }
  }
}
```

---

### `app/navigation/MainTabNavigator.tsx` — Update

```typescript
// Add import:
import DiscoveryScreen from '@/app/discovery/DiscoveryScreen'

// Replace the Discover tab placeholder:
<Tab.Screen name="Discover" component={DiscoveryScreen} options={{ ... }} />
```

Do not touch other tab screens or their options.

---

## Important Architecture Notes for Codex

1. **Card z-ordering.** React Native renders children in order — last child is on top. Render `stack.slice(0,3).map(...).reverse()` so `stack[0]` (the top card) is the last element rendered and therefore visually on top.

2. **Gesture isolation.** Only `isTop={true}` card should have a live `GestureDetector`. Cards with `isTop={false}` must have their pan gesture disabled (`Gesture.Pan().enabled(false)` or conditional rendering). Without this, all three cards capture touches simultaneously and swipes misbehave.

3. **`advanceStack()` ownership.** The screen calls `advanceStack()` after the swipe handler completes. `SwipeCard` reports the swipe outcome via callback — the screen drives stack advancement. Do not call store actions inside `SwipeCard`.

4. **No Firestore writes in this file.** All Firestore writes go through `discoveryStore`. `DiscoveryScreen` calls store actions only.

5. **`dailyLimitReached` flag.** If `discoveryStore` does not already expose `dailyLimitReached: boolean`, add it in this task. Set it `true` inside `swipeRight()` when the limit check returns `remaining === 0`. Reset it to `false` at the top of `fetchStack()`. Do not parse error strings to detect this condition.

6. **`UpsellModal` is a stub.** No payment logic. Mark every upgrade path with `// TODO: Phase 2 — wire to PremiumScreen`. The modal must dismiss cleanly with no side effects.

7. **`SafeAreaView` from `react-native-safe-area-context`**, not from `react-native`. Required for correct insets on notched devices.

8. **No ScrollView on DiscoveryScreen.** The card stack and action buttons fill the screen using `flex` layout. A `ScrollView` breaks gesture handling on the cards.

9. **`stackArea` must have `position: 'relative'` and `overflow: 'hidden'`** so cards that fly off-screen during exit animations clip correctly and don't render outside the stack region.

---

## Acceptance Criteria

- [ ] `ActionButtons` renders 5 buttons in correct order with correct colors and sizes
- [ ] Rewind and Super Like show lock badge (`lock-closed` icon) when `isPremium === false`
- [ ] All 5 buttons fire haptic feedback on press
- [ ] `ActionButtons` is fully disabled (opacity 0.4, not pressable) when `disabled === true`
- [ ] `EmptyState` renders icon, title, subtitle, Refresh and Edit Preferences buttons
- [ ] Tapping Refresh on `EmptyState` calls `fetchStack(userId)`
- [ ] `UpsellModal` opens when free user taps Super Like (trigger: `'super_like'`)
- [ ] `UpsellModal` opens when free user taps Rewind (trigger: `'rewind'`)
- [ ] `UpsellModal` opens when daily like limit is reached (trigger: `'daily_limit'`)
- [ ] `UpsellModal` shows correct headline for each trigger type
- [ ] `UpsellModal` "Upgrade to Premium" tap shows Coming Soon alert and dismisses modal
- [ ] `UpsellModal` "Maybe Later" dismisses without side effects
- [ ] `DiscoveryScreen` renders top 3 cards with correct z-order (`stack[0]` on top)
- [ ] Cards rendered in reverse order so top card is last in DOM (visually on top)
- [ ] Card depth visual: `stackIndex === 1` slightly scaled and offset, `stackIndex === 2` further
- [ ] Only the top card (`isTop={true}`) responds to swipe gestures
- [ ] Swipe right → `swipeRight(uid)` + `advanceStack()` called
- [ ] Swipe left → `swipeLeft(uid)` + `advanceStack()` called
- [ ] Swipe up + premium → `swipeSuperLike(uid)` + `advanceStack()` called
- [ ] Swipe up + free → `UpsellModal` opens; no store write occurs
- [ ] `fetchStack` called on mount if stack is empty
- [ ] `fetchStack` called automatically when `isRefetching === true`
- [ ] `ActivityIndicator` shown during initial load (stack empty + isLoading true)
- [ ] `EmptyState` shown when stack empty and `isLoading === false`
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Zero inline styles — all styling in `StyleSheet.create({})`
- [ ] All user-facing strings through `t()`

## Do Not Touch
`components/discovery/SwipeCard.tsx`, `components/discovery/SwipeLabel.tsx`, `components/discovery/ActivityBadge.tsx`, `store/authStore.ts`, `store/profileStore.ts`, `services/firebase/`, `types/`, `constants/`, `App.tsx`, `app/navigation/RootNavigator.tsx`, `app/navigation/AuthNavigator.tsx`, all onboarding screens, all auth screens

## Commit
`git commit -m "task-27: discovery screen with card stack, action buttons, empty state, upsell modal stub"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3.6] — YYYY-MM-DD
### Completed
- Task 27: DiscoveryScreen built — card stack orchestration, z-ordered rendering, gesture isolation
- ActionButtons component: 5 buttons, haptics, premium lock badge, disabled state
- EmptyState component: icon, copy, Refresh and Edit Preferences CTAs
- UpsellModal stub: trigger-aware headline, benefits list, Coming Soon alert on upgrade tap
- dailyLimitReached flag added to discoveryStore (if not already present)
- i18n keys added: discovery.empty.* and discovery.upsell.*
- MainTabNavigator Discover tab wired to real DiscoveryScreen

### Files Created / Modified
- components/discovery/ActionButtons.tsx: 5 action buttons, haptics, premium gate lock badge
- components/discovery/EmptyState.tsx: empty stack view with refresh CTA
- components/discovery/UpsellModal.tsx: presentational paywall stub, 3 trigger types
- app/discovery/DiscoveryScreen.tsx: card stack, swipe handlers, auto-refetch, upsell integration
- store/discoveryStore.ts: dailyLimitReached boolean added (if missing)
- i18n/en.json, my.json, zh.json, ta.json: discovery.empty.* and discovery.upsell.* keys added
- app/navigation/MainTabNavigator.tsx: Discover tab placeholder replaced with DiscoveryScreen

### Known Issues / Deferred
- FullProfileModal (Task 28) not yet built — onTapInfo shows Alert stub with TODO comment
- Rewind action is no-op even for premium users — full undo stack deferred to Phase 2
- Edit Preferences button in EmptyState calls no-op stub — wired in Task 38 (SettingsScreen)
- UpsellModal onUpgrade shows Coming Soon alert only — Phase 2 wires to PremiumScreen

### Next Up
- Task 28: FullProfileModal (scrollable profile view, shared-interest highlights, photo fullscreen, like/pass/super like from modal)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 28 prompt.

---

## Reasoning Level
Medium
