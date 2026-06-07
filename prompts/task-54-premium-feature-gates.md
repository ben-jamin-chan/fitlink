@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 53 is complete. The Stripe payment sheet is fully integrated into `PremiumScreen`.
`beginSubscription()` in `subscriptionStore` stores a `pendingClientSecret`, and
`PremiumScreen` watches it via `useEffect` to call `initPaymentSheet` → `presentPaymentSheet`.
The success modal renders on sheet resolution. Deep-link return for 3D Secure is handled.

Phase 1 used `subscription.tier === 'premium'` to gate features. Phase 2 replaced that field
with the `premium` object (`premium.active`, `premium.tier`). Task 47 migrated `types/user.ts`
and all references. Task 51 added `isPremium()` to `subscriptionStore`. Task 54 enforces those
gates consistently across every feature surface that was stubbed or incorrectly checked during
Phase 1.

**The `UpsellModal` "Upgrade Now" CTA was wired to navigate to `PremiumScreen` in Task 52.
Do not re-wire it. Confirm it is already navigating correctly and leave it untouched.**

Existing files Codex needs to know about:

- `store/subscriptionStore.ts` — `isPremium(): boolean` derives from `profileStore.profile.premium.active`. Also exposes `showUpsell(reason)` and `upsellReason` state (confirm these exist; add them if missing — see Task section below).
- `store/discoveryStore.ts` — `swipeRight()`, `swipeSuperLike()`, `swipeLeft()`, `checkDailyLimit()`, `dailyLikesCount`. Phase 1 had a `showUpsellModal: boolean` flag; Phase 2 must replace this with a `reason`-aware approach.
- `store/profileStore.ts` — `profile: UserProfile | null`, includes `profile.premium.active`.
- `components/discovery/UpsellModal.tsx` — receives `visible`, `reason`, `onClose`, `onUpgrade` props. Currently handles `'likes'` and `'superLike'` reason variants from Phase 1. Task 54 adds `'rewind'`.
- `app/discovery/DiscoveryScreen.tsx` — renders `SwipeCard` stack and `ActionButtons`. Passes swipe callbacks into `discoveryStore`.
- `components/discovery/ActionButtons.tsx` — 5-button row: Rewind, Pass, Super Like, Like, Info. Rewind and Super Like are premium-gated.
- `app/matches/MatchesScreen.tsx` — search/filter row exists as a stub or placeholder from Phase 1.
- `app/chat/ChatScreen.tsx` — message read receipts (blue double-tick) exist in `MessageBubble`.
- `components/chat/MessageBubble.tsx` — renders sent message with read receipt indicator.
- `components/ui/PremiumBadge.tsx` — created in Task 52, `plus`/`pro` variants, `sm`/`md` sizes.
- `app/settings/PremiumScreen.tsx` — already registered in `RootNavigator` and `RootStackParamList`.
- `types/user.ts` — `UserProfile.premium: { active: boolean; tier: 'plus' | 'pro' | null; subscriptionId: string | null; expiresAt: Timestamp | null }`.
- `types/subscription.ts` — `PremiumTier: 'plus' | 'pro'`.

**Architecture boundary:** Do not add Stripe imports or payment logic to any file in this task.
Task 54 is purely about reading premium status and routing to `PremiumScreen` or `UpsellModal`.
All payment flow lives in Tasks 50–53 and must not be touched here.

---

## Task 54 — Premium Feature Gates

**Files to modify:**
- `store/subscriptionStore.ts` — add `upsellVisible`, `upsellReason`, `showUpsell()`, `hideUpsell()` if not already present
- `store/discoveryStore.ts` — replace raw `showUpsellModal` flag with `subscriptionStore.showUpsell(reason)` calls; enforce unlimited likes for premium users
- `components/discovery/UpsellModal.tsx` — add `'rewind'` reason variant
- `app/discovery/DiscoveryScreen.tsx` — wire `UpsellModal` to `subscriptionStore` upsell state
- `components/discovery/ActionButtons.tsx` — guard Rewind tap for non-premium users
- `app/matches/MatchesScreen.tsx` — lock search/filter behind premium gate with `PremiumBadge`
- `components/chat/MessageBubble.tsx` — show blue double-tick only for premium senders
- `app/chat/ChatScreen.tsx` — pass `isPremium` down to `MessageBubble`

---

### `store/subscriptionStore.ts` — Update

Check whether `upsellVisible`, `upsellReason`, `showUpsell()`, and `hideUpsell()` already
exist in the store. If they do, leave them untouched and skip this section. If they are
missing, add the following to the store state and actions:

```typescript
// Add to state shape:
upsellVisible: boolean          // default: false
upsellReason: UpsellReason      // default: 'likes'

// Add to actions:
showUpsell: (reason: UpsellReason) => void
hideUpsell: () => void
```

Add the `UpsellReason` type to `types/subscription.ts` if it does not already exist:

```typescript
// types/subscription.ts — add if missing:
export type UpsellReason = 'likes' | 'superLike' | 'rewind'
```

Import `UpsellReason` in `subscriptionStore.ts`. The `showUpsell` action sets both
`upsellVisible: true` and `upsellReason: reason`. The `hideUpsell` action sets
`upsellVisible: false`. Do not reset `upsellReason` on hide — it must remain stable
while the modal animates out.

Do not add `upsellVisible` or `upsellReason` to the persisted slice. These are
ephemeral UI state and must not survive app restarts.

---

### `store/discoveryStore.ts` — Update

**Replace all `showUpsellModal: boolean` state** with calls to
`useSubscriptionStore.getState().showUpsell(reason)`. The discovery store must not own
upsell visibility state — that belongs to `subscriptionStore`.

**`swipeSuperLike(targetId: string): Promise<void>`**

Gate at the top of the function:

```typescript
import { useSubscriptionStore } from '@/store/subscriptionStore'

// Inside swipeSuperLike():
if (!useSubscriptionStore.getState().isPremium()) {
  useSubscriptionStore.getState().showUpsell('superLike')
  return
}
// ... rest of super like logic (write swipe to Firestore)
```

**`swipeRight(targetId: string): Promise<void>`**

Replace the Phase 1 `if (dailyLikesCount >= 50)` check with:

```typescript
const isPremium = useSubscriptionStore.getState().isPremium()

if (!isPremium) {
  const remaining = await checkDailyLimit()
  if (remaining <= 0) {
    useSubscriptionStore.getState().showUpsell('likes')
    return
  }
}
// ... rest of like logic (write swipe, increment dailyLikesCount if !isPremium)
```

Premium users skip the daily limit check entirely — no cap, no counter increment needed.

**`rewind(): void` (new action)**

Add a `rewind` action stub. Phase 1 had a Rewind button in `ActionButtons` that was
non-functional. Wire it now:

```typescript
rewind: () => {
  if (!useSubscriptionStore.getState().isPremium()) {
    useSubscriptionStore.getState().showUpsell('rewind')
    return
  }
  // TODO Phase 3: implement actual rewind logic (restore last swiped card)
  // For now: no-op for premium users (feature scaffold only)
}
```

Remove any `showUpsellModal`, `setShowUpsellModal`, or similar boolean flags from
the discovery store's state and actions. If `showUpsellModal` is referenced in
`DiscoveryScreen.tsx` or `ActionButtons.tsx`, those references must be updated as part
of this task.

---

### `components/discovery/UpsellModal.tsx` — Update

Add the `'rewind'` reason variant. The modal already handles `'likes'` and `'superLike'`.

```typescript
// Props interface — confirm or update:
interface UpsellModalProps {
  visible: boolean
  reason: UpsellReason
  onClose: () => void
  onUpgrade: () => void
}

// Inside the component, add rewind to the headline/body mapping:
const UPSELL_CONTENT: Record<UpsellReason, { headline: string; body: string }> = {
  likes: {
    headline: t('upsell.likes.headline'),   // "You're Out of Likes"
    body: t('upsell.likes.body'),
  },
  superLike: {
    headline: t('upsell.superLike.headline'),  // "Super Like Your Favourites"
    body: t('upsell.superLike.body'),
  },
  rewind: {
    headline: t('upsell.rewind.headline'),   // "Rewind Your Last Swipe"
    body: t('upsell.rewind.body'),
  },
}
```

Add the following i18n keys to all 4 language files (`en.json`, `my.json`, `zh.json`,
`ta.json`). Use English values in all files as placeholders:

```json
"upsell": {
  "likes": {
    "headline": "You're Out of Likes",
    "body": "Upgrade to Premium for unlimited likes every day."
  },
  "superLike": {
    "headline": "Super Like Your Favourites",
    "body": "Upgrade to Premium to send Super Likes and stand out."
  },
  "rewind": {
    "headline": "Rewind Your Last Swipe",
    "body": "Upgrade to Premium to undo swipes and get second chances."
  },
  "upgradeNow": "Upgrade Now",
  "maybeLater": "Maybe Later"
}
```

If `upsell.*` keys already exist for `likes` and `superLike` from Phase 1, update them
in place; do not duplicate. Add only the `rewind` variant and any missing keys.

The `onUpgrade` callback is already wired to navigate to `PremiumScreen` from Task 52.
Do not change it.

---

### `app/discovery/DiscoveryScreen.tsx` — Update

Replace any direct reference to `discoveryStore.showUpsellModal` with reads from
`subscriptionStore`:

```typescript
import { useSubscriptionStore } from '@/store/subscriptionStore'

// Inside DiscoveryScreen component:
const upsellVisible = useSubscriptionStore((s) => s.upsellVisible)
const upsellReason = useSubscriptionStore((s) => s.upsellReason)
const hideUpsell = useSubscriptionStore((s) => s.hideUpsell)

// UpsellModal usage:
<UpsellModal
  visible={upsellVisible}
  reason={upsellReason}
  onClose={hideUpsell}
  onUpgrade={() => {
    hideUpsell()
    navigation.navigate('Premium')
  }}
/>
```

Wire the Rewind button in `ActionButtons` to `discoveryStore.rewind()`. If `rewind`
is not currently called from `DiscoveryScreen`, add it now alongside the existing
pass/like/superLike/info callbacks passed into `ActionButtons`.

---

### `components/discovery/ActionButtons.tsx` — Update

Ensure the Rewind button calls `onRewind` (a prop). If `onRewind` is not already in
the props interface, add it:

```typescript
interface ActionButtonsProps {
  onRewind: () => void     // add if missing
  onPass: () => void
  onSuperLike: () => void
  onLike: () => void
  onInfo: () => void
}
```

The Rewind button itself does NOT gate on `isPremium` here — gating happens inside
`discoveryStore.rewind()`. The button always renders and always calls `onRewind`. This
keeps the action button component free of premium-status logic.

The Super Like button follows the same pattern — it always calls `onSuperLike`, and
`discoveryStore.swipeSuperLike()` handles the gate. Do not add `isPremium` checks
inside `ActionButtons`.

---

### `app/matches/MatchesScreen.tsx` — Update

The search/filter row is currently a stub or placeholder. Add a premium gate:

```typescript
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { PremiumBadge } from '@/components/ui/PremiumBadge'

// Inside MatchesScreen:
const isPremium = useSubscriptionStore((s) => s.isPremium())

// Search bar / filter row:
<TouchableOpacity
  style={styles.searchRow}
  onPress={() => {
    if (!isPremium) {
      navigation.navigate('Premium')
      return
    }
    // TODO Phase 3: open search/filter modal
  }}
  activeOpacity={0.8}
>
  <Ionicons name="search-outline" size={18} color={colors.gray[600]} />
  <Text style={styles.searchPlaceholder}>{t('matches.searchPlaceholder')}</Text>
  {!isPremium && <PremiumBadge tier="plus" size="sm" />}
</TouchableOpacity>
```

Add the following i18n key to all 4 language files:

```json
"matches": {
  "searchPlaceholder": "Search matches..."
}
```

If `matches.searchPlaceholder` already exists, leave it. Do not add the search/filter
modal logic — that is a Phase 3 item. Only the gate and visual indicator are in scope
for Task 54.

---

### `components/chat/MessageBubble.tsx` — Update

Add an `isPremium` prop to `MessageBubble`. The blue double-tick (read receipt) is only
shown if the current user is premium AND the message has been read by the recipient.

```typescript
// Update props interface:
interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  isPremium: boolean    // add this — controls read receipt visibility
}

// Inside render, for sent messages (isOwn === true):
// Show read receipt only when:
//   1. isOwn === true (only show on own sent messages)
//   2. message.readBy includes the other user's ID (already read)
//   3. isPremium === true

{isOwn && (
  <View style={styles.receiptRow}>
    {isPremium && message.readBy.length > 1 ? (
      // Blue double-tick: read
      <Ionicons name="checkmark-done" size={14} color={colors.secondary} />
    ) : (
      // Gray double-tick: delivered (shown to all users, premium or not)
      <Ionicons name="checkmark-done" size={14} color={colors.gray[400]} />
    )}
  </View>
)}
```

Rationale: gray double-tick (delivered) always visible for own messages. Blue double-tick
(read) is premium-only per PRD Section 5.8. Render the icon either way to avoid layout
shift; only the color and meaning differ.

---

### `app/chat/ChatScreen.tsx` — Update

Pass `isPremium` down to each `MessageBubble`:

```typescript
import { useSubscriptionStore } from '@/store/subscriptionStore'

// Inside ChatScreen:
const isPremium = useSubscriptionStore((s) => s.isPremium())

// In FlatList renderItem:
<MessageBubble
  message={item}
  isOwn={item.senderId === currentUserId}
  isPremium={isPremium}
/>
```

No other changes to `ChatScreen` are in scope for this task.

---

## Important Architecture Notes for Codex

1. **Upsell state lives in `subscriptionStore`, not `discoveryStore`.** The discovery store calls `useSubscriptionStore.getState().showUpsell(reason)` to trigger the modal. `DiscoveryScreen` reads `upsellVisible` and `upsellReason` from `subscriptionStore` directly. Never put `showUpsellModal: boolean` back in `discoveryStore`.

2. **`isPremium()` is the single source of truth.** It reads `profileStore.profile.premium.active`. Never check `profile.subscription.tier === 'premium'` (Phase 1 field — removed in Task 47). Never check `profile.premium.tier === 'plus'` as the sole gate — use `isPremium()` which checks `.active`.

3. **`ActionButtons` stays dumb.** It receives callbacks and calls them. Premium gating logic belongs in `discoveryStore` actions, not in the UI component. This is the correct pattern for testability and separation of concerns.

4. **`UpsellReason` type must be exported from `types/subscription.ts`.** Import it into every file that references the type. Do not redefine it inline.

5. **Read receipts — gray tick is always visible; blue tick is premium-only.** Do not hide the receipt icon entirely for non-premium users. Only the color changes. This matches the PRD spec and avoids layout shift in the message list.

6. **Unlimited likes for premium users — skip both the check AND the counter increment.** Free users increment `dailyLikesCount` in the store after a successful like. Premium users bypass this block entirely. Ensure the increment call is inside the `if (!isPremium)` block.

7. **Do not touch the Stripe payment flow.** No imports from `@stripe/stripe-react-native` belong in any file modified by this task. If Codex detects a Stripe import being added, that is out of scope.

8. **`rewind()` is a scaffold only.** For premium users, it is a no-op with a `// TODO Phase 3` comment. The actual card-restoration logic is deferred. The gate (showing upsell for non-premium) is the full Phase 2 deliverable for this action.

9. **All new strings through `t()`.** Every user-facing string in modified components must use `useTranslation()`. Add the keys to all 4 language files (`en.json`, `my.json`, `zh.json`, `ta.json`). Non-English files use the English value as a placeholder.

10. **Zero `any`. Zero inline styles.** Run `npx tsc --noEmit` after all edits. Fix all errors before declaring the task done.

---

## Acceptance Criteria

- [ ] `UpsellReason` type exported from `types/subscription.ts` with values `'likes' | 'superLike' | 'rewind'`
- [ ] `subscriptionStore` has `upsellVisible`, `upsellReason`, `showUpsell(reason)`, `hideUpsell()` — not persisted
- [ ] `discoveryStore` has no `showUpsellModal` boolean state — replaced with `subscriptionStore.showUpsell()`
- [ ] `discoveryStore.swipeSuperLike()` calls `showUpsell('superLike')` and returns early for non-premium users
- [ ] `discoveryStore.swipeRight()` skips daily limit check entirely for premium users; calls `showUpsell('likes')` when free user is at cap
- [ ] `discoveryStore.rewind()` action exists — calls `showUpsell('rewind')` for non-premium, no-op for premium
- [ ] `UpsellModal` renders correct headline and body for all 3 reason values (`likes`, `superLike`, `rewind`)
- [ ] `DiscoveryScreen` reads upsell state from `subscriptionStore`, not `discoveryStore`
- [ ] `ActionButtons` passes `onRewind` through to `discoveryStore.rewind()` via `DiscoveryScreen`
- [ ] `MatchesScreen` search row shows `PremiumBadge` when user is not premium; tapping navigates to `PremiumScreen`
- [ ] `MessageBubble` accepts `isPremium` prop; blue double-tick shown only when `isPremium === true` AND message is read; gray double-tick shown for all own messages
- [ ] `ChatScreen` passes `isPremium` from `subscriptionStore` to each `MessageBubble`
- [ ] All new `upsell.*` and `matches.searchPlaceholder` i18n keys added to all 4 language files
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Zero `any` usage in any modified file
- [ ] Zero inline `style={{ }}` in any modified JSX
- [ ] No Stripe imports added to any file in this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/profileStore.ts`, `services/stripe.ts`,
`functions/src/`, `services/firebase/config.ts`, `services/firebase/auth.ts`,
`services/firebase/firestore.ts`, `app/settings/PremiumScreen.tsx`,
`components/ui/PremiumBadge.tsx`, `app/navigation/RootNavigator.tsx`,
`firestore.rules`, `firestore.indexes.json`, `constants/`, `types/user.ts`,
`types/match.ts`, `types/message.ts`

---

## Commit

```
git commit -m "task-54: premium feature gates — upsell reasons, unlimited likes, rewind, read receipts, matches search lock"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2B — Task 54] — YYYY-MM-DD

### Completed

- Task 54: Premium feature gates wired across all surfaces
- UpsellReason type ('likes' | 'superLike' | 'rewind') added to types/subscription.ts
- subscriptionStore: upsellVisible, upsellReason, showUpsell(), hideUpsell() added
- discoveryStore: showUpsellModal flag removed; premium gates use subscriptionStore.showUpsell(); unlimited likes bypass for premium users; rewind() scaffold added
- UpsellModal: 'rewind' reason variant added with i18n keys in all 4 language files
- DiscoveryScreen: upsell state sourced from subscriptionStore
- ActionButtons: onRewind prop wired
- MatchesScreen: search row shows PremiumBadge and gates on isPremium()
- MessageBubble: isPremium prop added; blue double-tick gated; gray double-tick always shown
- ChatScreen: isPremium passed to MessageBubble from subscriptionStore

### Files Created / Modified

- types/subscription.ts: UpsellReason type added
- store/subscriptionStore.ts: upsell state and actions added
- store/discoveryStore.ts: premium gates updated, rewind() added, showUpsellModal removed
- components/discovery/UpsellModal.tsx: rewind reason variant, UPSELL_CONTENT map
- app/discovery/DiscoveryScreen.tsx: upsell wired to subscriptionStore, onRewind wired
- components/discovery/ActionButtons.tsx: onRewind prop added
- app/matches/MatchesScreen.tsx: search row premium gate and PremiumBadge
- components/chat/MessageBubble.tsx: isPremium prop, read receipt color logic
- app/chat/ChatScreen.tsx: isPremium from subscriptionStore passed to MessageBubble
- i18n/en.json: upsell.rewind.*, matches.searchPlaceholder added
- i18n/my.json, zh.json, ta.json: same keys mirrored

### Architecture Decisions

- [Note any non-obvious choices made during implementation]

### Known Issues / Deferred

- rewind() is a no-op for premium users — actual card restoration is Phase 3
- Matches search/filter modal is Phase 3 — only the gate UI is implemented here
- Stripe Customer Portal URL remains a placeholder (Task 52 deferred item)

### Next Up

- Task 55: Server-Side Daily Likes Enforcement (recordSwipe Cloud Function, Firestore transaction, block client writes to /swipes/)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 55 prompt.
