# CODEX PROMPT — Task 30
# Matches Screen — Grid, Messages List, MatchCard, MessageListItem

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 4.1 complete. Relevant existing files:

- `store/matchStore.ts` — fully built: `matches: MatchWithProfile[]`, `newMatchIds: string[]`, `subscribeToMatches(userId)`, `unsubscribeFromMatches()`, `unmatch(matchId)`, `markAsRead(matchId)`. **`subscribeToMatches` is NOT yet called anywhere — Task 30 wires it.**
- `types/match.ts` — `Match`, `MatchWithProfile` fully typed; `MatchWithProfile` includes the other user's `UserProfile` as `otherUser`
- `types/user.ts` — `UserProfile` fully typed including `lastActive: Timestamp`, `photos: string[]`, `firstName: string`, `verified: boolean`
- `store/authStore.ts` — `user` (FirebaseUser), `isAuthenticated` available
- `app/navigation/MainTabNavigator.tsx` — Matches tab renders a placeholder screen; replace with `MatchesScreen` in this task
- `i18n/en.json` — `matches.*` namespace already seeded (titles, empty states, badges, action sheet labels)
- `constants/theme.ts` — all color, spacing, typography tokens available
- `components/ui/Button.tsx` — available for empty state CTAs
- `components/ui/LoadingOverlay.tsx` — available for loading states
- `app/discovery/DiscoveryScreen.tsx` and `components/discovery/FullProfileModal.tsx` — exist; navigation to `ChatScreen` from this task must use the same navigator structure

There is **no `ChatScreen` yet** (Task 32). Navigation to chat must use `navigation.navigate('Chat', { matchId })` — the route must be registered in the navigator even as a placeholder if it doesn't exist. Do not build `ChatScreen` here.

There is **no `@react-navigation/material-top-tabs` installed**. Do **not** install it. Use a custom two-button tab switcher built with `TouchableOpacity` and local state — this avoids an extra native dependency and keeps full styling control.

---

## Task 30 — Matches Screen

**Files to create:**
- `components/chat/MatchCard.tsx`
- `components/chat/MessageListItem.tsx`
- `app/matches/MatchesScreen.tsx`

**Files to modify:**
- `app/navigation/MainTabNavigator.tsx` — replace Matches tab placeholder with `MatchesScreen`
- `app/navigation/MainTabNavigator.tsx` — ensure `Chat` route is registered (placeholder screen if not yet built)

---

### Custom Tab Switcher Design

The "Matches" and "Messages" tabs are implemented entirely in `MatchesScreen.tsx` using a local `activeTab: 'matches' | 'messages'` state and a styled two-button row at the top. No third-party tab library.

```
┌─────────────────────────────────────────────┐
│  [  Matches  ]  [  Messages  ]              │  ← tab bar row
├─────────────────────────────────────────────┤
│                                             │
│  [photo] [photo] [photo]                    │  ← Matches tab: 3-col grid
│  [photo] [photo] [photo]                    │
│                                             │
│  OR                                         │
│                                             │
│  ○ Name     Last message...     2h  🔴3     │  ← Messages tab: flat list
│  ○ Name     Last message...    Mon          │
│                                             │
└─────────────────────────────────────────────┘
```

---

### `components/chat/MatchCard.tsx`

Used in the Matches grid tab. Props:

```typescript
interface MatchCardProps {
  match: MatchWithProfile
  currentUserId: string
  onPress: () => void
  onLongPress: () => void
}
```

**Layout:**
- Portrait card at 3:4 aspect ratio (one-third of screen width minus gaps)
- `ImageBackground` from the other user's `photos[0]`
- Bottom gradient overlay (dark, 40% height) for name legibility
- **Name** (white, bold, `typography.sizes.sm`) bottom-left over gradient
- **"NEW" badge** (top-right): green pill, text "NEW" — shows when `match.lastMessage` is `null` or `undefined`
- **Unread count badge** (top-right, below NEW if both): red circle with white count number — shows when `match[currentUserId + '_unread'] > 0`. If both NEW and unread apply, show only unread badge (unread takes priority).
- **Online indicator** (bottom-right, green filled circle 10px with white border): shows when `otherUser.lastActive` is within the last 5 minutes — compare using `Timestamp.now().toMillis() - otherUser.lastActive.toMillis() < 5 * 60 * 1000`
- **Verified badge** (bottom-left, next to name): blue checkmark icon (`Ionicons name="checkmark-circle"`) at 14px if `otherUser.verified === true`
- `borderRadius` on card: `borderRadius.md`
- `activeOpacity={0.85}` on the outer `TouchableOpacity`

**Long press** opens an `ActionSheetIOS` on iOS and `Alert` with options on Android (use `Platform.OS`). Options:
1. View Profile → no-op stub with `TODO: open FullProfileModal` comment
2. Unmatch → confirmation `Alert` before calling `matchStore.unmatch(match.id)`
3. Report → no-op stub with `TODO: report flow Task 38` comment
4. Cancel

```typescript
// Long press handler pattern
const handleLongPress = (): void => {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          t('matches.actions.viewProfile'),
          t('matches.actions.unmatch'),
          t('matches.actions.report'),
          t('common.cancel'),
        ],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 3,
      },
      (buttonIndex) => {
        if (buttonIndex === 0) { /* TODO: view profile */ }
        if (buttonIndex === 1) { handleUnmatch() }
        if (buttonIndex === 2) { /* TODO: report */ }
      }
    )
  } else {
    Alert.alert(
      otherUser.firstName,
      '',
      [
        { text: t('matches.actions.viewProfile'), onPress: () => { /* TODO */ } },
        { text: t('matches.actions.unmatch'), style: 'destructive', onPress: handleUnmatch },
        { text: t('matches.actions.report'), onPress: () => { /* TODO */ } },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    )
  }
}

const handleUnmatch = (): void => {
  Alert.alert(
    t('matches.unmatch.title', { name: otherUser.firstName }),
    t('matches.unmatch.message'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('matches.unmatch.confirm'),
        style: 'destructive',
        onPress: () => { unmatch(match.id) },
      },
    ]
  )
}
```

No inline styles. All layout in `StyleSheet.create`.

---

### `components/chat/MessageListItem.tsx`

Used in the Messages list tab. Props:

```typescript
interface MessageListItemProps {
  match: MatchWithProfile
  currentUserId: string
  onPress: () => void
  onSwipeUnmatch: () => void
}
```

**Layout (horizontal row):**
```
 ┌──────────────────────────────────────────────┐
 │ [●Photo60] Name (bold)              2h  [🔴3] │
 │            Last message preview...            │
 └──────────────────────────────────────────────┘
```

- **Avatar**: circular `Image`, 60×60, `borderRadius: 30`. Online dot (10px green circle, white border 2px) overlaid bottom-right of avatar — same 5-minute threshold as `MatchCard`.
- **Name**: `typography.sizes.md`, `typography.weights.semibold`, `colors.gray[900]`
- **Last message preview**: `typography.sizes.sm`, `colors.gray[500]`, `numberOfLines={2}`. Show `match.lastMessage` if present. If `null` / `undefined`, show `t('matches.messages.noMessages')`.
- **Timestamp** (top-right): formatted relative string. Use a pure `formatRelativeTime(timestamp: Timestamp | null | undefined): string` helper defined in the same file — not imported from elsewhere:
  - `null` / `undefined` → `''`
  - < 1 min → `t('matches.time.justNow')`
  - < 60 min → `t('matches.time.minutesAgo', { count: Math.floor(diff / 60000) })`
  - < 24h → `t('matches.time.hoursAgo', { count: Math.floor(diff / 3600000) })`
  - < 48h → `t('matches.time.yesterday')`
  - Same week → day name (`Mon`, `Tue`, etc.)
  - Older → `DD MMM` (e.g. `15 Jan`)
- **Unread badge** (top-right, below timestamp): red circle, white number — only when `match[currentUserId + '_unread'] > 0`.
- **Swipe-to-unmatch**: implement using a `View` with `PanResponder` or a simple `TouchableOpacity` revealed by translating the row — **do not install react-native-swipe-list-view or any new package**. A simpler acceptable pattern: right-side "Unmatch" button revealed by rendering it absolutely behind the row and using a `PanResponder` to slide the row left by up to 80px. On release if translation < -60px, snap to reveal; otherwise snap back. Call `onSwipeUnmatch` when revealed button is tapped. Use `Animated` (not Reanimated) for this row-level animation to keep the swipe isolated.
- Separator: `1px` line in `colors.gray[200]`, full width, `marginLeft: 60 + spacing.md` (aligned past avatar)

---

### `app/matches/MatchesScreen.tsx`

**State:**
```typescript
const [activeTab, setActiveTab] = useState<'matches' | 'messages'>('matches')
```

**On mount:**
- Call `subscribeToMatches(user.uid)` from `matchStore`
- Return cleanup calling `unsubscribeFromMatches()` from the `useEffect`

**Data derivation from `matchStore.matches`:**
```typescript
// Matches tab: ALL matches (with or without messages), sorted by createdAt desc
const allMatches = matches.slice().sort(
  (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()
)

// Messages tab: ONLY matches with at least one message, sorted by lastMessageAt desc
const conversations = matches
  .filter(m => m.lastMessage != null)
  .slice()
  .sort((a, b) => {
    const aTime = a.lastMessageAt?.toMillis() ?? 0
    const bTime = b.lastMessageAt?.toMillis() ?? 0
    return bTime - aTime
  })
```

**Header:**
- Screen title: `t('matches.title')` ("Matches")
- No back button (this is a bottom tab root screen)

**Tab bar row:**
```tsx
<View style={styles.tabBar}>
  <TouchableOpacity
    style={[styles.tabButton, activeTab === 'matches' && styles.tabButtonActive]}
    onPress={() => setActiveTab('matches')}
    activeOpacity={0.7}
  >
    <Text style={[styles.tabLabel, activeTab === 'matches' && styles.tabLabelActive]}>
      {t('matches.tabs.matches')}
    </Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={[styles.tabButton, activeTab === 'messages' && styles.tabButtonActive]}
    onPress={() => setActiveTab('messages')}
    activeOpacity={0.7}
  >
    <Text style={[styles.tabLabel, activeTab === 'messages' && styles.tabLabelActive]}>
      {t('matches.tabs.messages')}
    </Text>
  </TouchableOpacity>
</View>
```

Active tab style: bottom border `2px solid colors.primary`, label color `colors.primary`. Inactive: label color `colors.gray[500]`, no border.

**Matches tab content:**

When `isLoading` and `allMatches.length === 0`: show centered `ActivityIndicator` in `colors.primary`.

When `allMatches.length === 0` and not loading:
```tsx
// Empty state
<View style={styles.emptyState}>
  <Ionicons name="heart-outline" size={64} color={colors.gray[300]} />
  <Text style={styles.emptyTitle}>{t('matches.empty.matchesTitle')}</Text>
  <Text style={styles.emptySub}>{t('matches.empty.matchesSub')}</Text>
  <Button
    label={t('matches.empty.startSwiping')}
    onPress={() => navigation.navigate('Discover')}  // bottom tab navigate
  />
</View>
```

When matches exist: `FlatList` with `numColumns={3}`, `columnWrapperStyle` for gap, rendering `MatchCard` per item.

```typescript
const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = spacing.lg * 2
const GRID_GAP = spacing.sm
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING - GRID_GAP * 2) / 3
```

Each `MatchCard` `onPress` navigates: `navigation.navigate('Chat', { matchId: match.id })` and calls `markAsRead(match.id)`.

**Messages tab content:**

When `isLoading` and `conversations.length === 0`: show `ActivityIndicator`.

When `conversations.length === 0` and not loading:
```tsx
<View style={styles.emptyState}>
  <Ionicons name="chatbubble-outline" size={64} color={colors.gray[300]} />
  <Text style={styles.emptyTitle}>{t('matches.empty.messagesTitle')}</Text>
  <Text style={styles.emptySub}>{t('matches.empty.messagesSub')}</Text>
  <Button
    label={t('matches.empty.viewMatches')}
    onPress={() => setActiveTab('matches')}
    variant="outline"
  />
</View>
```

When conversations exist: `FlatList` (single column), `ItemSeparatorComponent` inline (a thin line view), rendering `MessageListItem` per item.

Each `MessageListItem`:
- `onPress`: `navigation.navigate('Chat', { matchId: match.id })` + `markAsRead(match.id)`
- `onSwipeUnmatch`: show unmatch confirmation `Alert`, then call `unmatch(match.id)` on confirm

Pull-to-refresh on both `FlatList`s: `refreshing={isLoading}` + `onRefresh={() => { unsubscribeFromMatches(); subscribeToMatches(user.uid) }}`

**Navigation types:**

Ensure `MatchesStackParamList` or the parent navigator has `Chat: { matchId: string }` registered. If `ChatScreen` does not exist yet, register a placeholder:

```typescript
// In MainTabNavigator or a wrapping MatchesStackNavigator
const ChatScreenPlaceholder = (): React.JSX.Element => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>Chat — Task 32</Text>
  </View>
)
```

The navigation to `Chat` must work without crashing even though `ChatScreen` is not yet built.

---

### Navigation Wiring — `app/navigation/MainTabNavigator.tsx`

The Matches bottom tab currently renders a placeholder. Replace it with `MatchesScreen`.

Because `MatchesScreen` needs to navigate to `ChatScreen` (a screen outside the tab), wrap the Matches tab in its own `Stack.Navigator`:

```typescript
// MatchesStack — wraps MatchesScreen and the future ChatScreen
import { createStackNavigator } from '@react-navigation/stack'

export type MatchesStackParamList = {
  MatchesList: undefined
  Chat: { matchId: string }
}

const MatchesStack = createStackNavigator<MatchesStackParamList>()

const MatchesNavigator = (): React.JSX.Element => (
  <MatchesStack.Navigator screenOptions={{ headerShown: false }}>
    <MatchesStack.Screen name="MatchesList" component={MatchesScreen} />
    <MatchesStack.Screen name="Chat" component={ChatScreenPlaceholder} />
  </MatchesStack.Navigator>
)

// Then in the bottom tab:
<Tab.Screen name="Matches" component={MatchesNavigator} />
```

**Do not change the tab icon, label, or order** — only replace the placeholder component.

---

## i18n Keys

The `matches.*` namespace is already seeded in all 4 language files (Task 29). Confirm the following keys exist and add any that are missing:

```json
{
  "matches": {
    "title": "Matches",
    "tabs": {
      "matches": "Matches",
      "messages": "Messages"
    },
    "empty": {
      "matchesTitle": "No Matches Yet",
      "matchesSub": "Start swiping to find your fitness match!",
      "startSwiping": "Start Swiping",
      "messagesTitle": "No Messages Yet",
      "messagesSub": "Say hi to your matches and break the ice!",
      "viewMatches": "View Matches"
    },
    "actions": {
      "viewProfile": "View Profile",
      "unmatch": "Unmatch",
      "report": "Report"
    },
    "unmatch": {
      "title": "Unmatch {{name}}?",
      "message": "This will remove the match and delete all messages.",
      "confirm": "Unmatch"
    },
    "messages": {
      "noMessages": "Say hello!"
    },
    "time": {
      "justNow": "Just now",
      "minutesAgo": "{{count}}m",
      "hoursAgo": "{{count}}h",
      "yesterday": "Yesterday"
    },
    "badge": {
      "new": "NEW"
    }
  }
}
```

Add to `my.json`, `zh.json`, `ta.json` with the same English values as placeholders.

---

## Architecture Notes for Codex

1. **No new packages.** Do not install `react-native-swipe-list-view`, `@react-navigation/material-top-tabs`, or any other package. Use only what is already installed.

2. **Custom tab switcher is intentional.** Material top tabs add a native dependency and extra config. The `TouchableOpacity` + `useState` pattern is the explicitly chosen approach.

3. **matchStore subscription lifecycle.** `subscribeToMatches` must be called inside a `useEffect` in `MatchesScreen` with `user.uid` as dependency. Cleanup (`unsubscribeFromMatches`) runs on unmount. Do not call subscription at the app root level — it belongs here.

4. **`markAsRead` on navigation.** Call `matchStore.markAsRead(match.id)` immediately when the user taps a match card or message row, before navigating to chat. This resets the unread badge optimistically.

5. **`MatchWithProfile` unread field access.** The unread count field is a dynamic key: `match[currentUserId + '_unread']`. Access it as `(match as Record<string, unknown>)[currentUserId + '_unread'] as number | undefined` to satisfy TypeScript strict mode without casting to `any`.

6. **No `ChatScreen` in scope.** Navigate to `Chat` using the stack registered in `MatchesNavigator`. A placeholder screen is sufficient — do not begin building `ChatScreen` (Task 32).

7. **Pull-to-refresh re-subscribes.** On refresh, call `unsubscribeFromMatches()` then `subscribeToMatches(user.uid)` to force a fresh listener rather than relying on Firestore cache.

8. **Swipe-to-unmatch uses `Animated`, not Reanimated.** This is intentional: the row-level swipe is a simple translate animation, not a 60fps gesture chain. Reanimated is reserved for the swipe card (Task 26). `PanResponder` + `Animated.Value` is the correct pattern here.

---

## Acceptance Criteria

- [ ] `MatchCard` renders photo, name, NEW badge, unread badge, online dot, verified badge correctly
- [ ] `MatchCard` long press shows action sheet (iOS) / alert (Android) with View Profile, Unmatch, Report, Cancel
- [ ] Unmatch from `MatchCard` shows confirmation alert; on confirm calls `matchStore.unmatch()`
- [ ] `MessageListItem` renders avatar, name, last message preview, relative timestamp, unread badge
- [ ] `MessageListItem` swipe-left reveals "Unmatch" button; tapping it shows confirmation then calls `matchStore.unmatch()`
- [ ] Online dot shows on both components only when `lastActive` within 5 minutes
- [ ] `MatchesScreen` mounts and calls `subscribeToMatches(user.uid)` exactly once
- [ ] `unsubscribeFromMatches()` called on screen unmount
- [ ] Matches tab shows 3-column grid of all matches, sorted by `createdAt` desc
- [ ] Messages tab shows flat list of matches with messages, sorted by `lastMessageAt` desc
- [ ] Tab switcher toggles correctly between views, active tab has `colors.primary` underline
- [ ] Both empty states render correctly with correct copy and CTAs
- [ ] Tapping a `MatchCard` navigates to `Chat` route with `matchId` param
- [ ] Tapping a `MessageListItem` navigates to `Chat` route with `matchId` param
- [ ] `markAsRead` is called on tap before navigation
- [ ] Pull-to-refresh works on both lists
- [ ] MainTabNavigator Matches tab now renders `MatchesNavigator` wrapping `MatchesScreen`
- [ ] `Chat` route registered in `MatchesStackParamList`, placeholder screen renders without crash
- [ ] Zero inline styles — all in `StyleSheet.create`
- [ ] All strings through `t()` — zero hardcoded text
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Zero uses of `any`

## Do Not Touch
`store/matchStore.ts`, `store/discoveryStore.ts`, `store/authStore.ts`, `services/firebase/firestore.ts`, `types/match.ts`, `types/user.ts`, `components/discovery/`, `app/discovery/`, `app/auth/`, `app/onboarding/`, `functions/`, `firestore.rules`, `i18n/index.ts`, `App.tsx`, `app/navigation/RootNavigator.tsx`, `app/navigation/AuthNavigator.tsx`

## Commit
`git commit -m "task-30: matches screen with grid, messages list, match card, message list item"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 4.2] — YYYY-MM-DD
### Completed
- Task 30: MatchesScreen built — 2-tab (Matches grid + Messages list), real-time from matchStore
- MatchCard component: photo, name, NEW badge, unread badge, online dot, verified badge, long-press action sheet
- MessageListItem component: avatar with online dot, name, message preview, relative timestamp, unread badge, swipe-to-unmatch
- MatchesNavigator (Stack) created to wrap MatchesScreen + Chat placeholder
- MainTabNavigator Matches tab wired to MatchesNavigator
- i18n matches.* keys confirmed / extended in all 4 language files

### Files Created / Modified
- components/chat/MatchCard.tsx: grid card component with badges and long-press actions
- components/chat/MessageListItem.tsx: list row with swipe-to-unmatch via PanResponder + Animated
- app/matches/MatchesScreen.tsx: tab switcher, grid, list, empty states, matchStore subscription
- app/navigation/MainTabNavigator.tsx: MatchesNavigator (stack) added, Chat placeholder registered
- i18n/en.json, my.json, zh.json, ta.json: matches.* keys confirmed / added

### Known Issues / Deferred
- Navigation to Chat uses placeholder screen — real ChatScreen built in Task 32
- "View Profile" in long-press action sheet is a no-op stub — wired when FullProfileModal accepts external trigger
- "Report" in long-press action sheet is a no-op stub — reporting service wired in Task 38

### Next Up
- Task 31: Chat Store (chatStore.ts, services/firebase/realtime.ts — RTDB subscription, send message, offline queue)
```

Then bring ARCHITECT.md + this CHANGELOG entry to claude.ai for the Task 31 prompt.

---

## Reasoning Level
Medium-High
