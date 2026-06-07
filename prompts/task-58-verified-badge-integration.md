# CODEX PROMPT — Task 58: Verified Badge Integration

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 57 (Photo Verification UI Flow) is complete. The `PhotoVerificationScreen` and
`SelfieCameraView` components are built, the `verifyProfilePhoto` Cloud Function
writes `photoVerified: true` to Firestore on success, and `profileStore` refreshes
the local `photoVerified` flag after the Cloud Function confirms verification.

Task 47 migrated the field name from `verified` to `photoVerified` across all
type definitions. However, the badge rendering across the five surfaces listed in
Task 58 needs to be audited and made fully consistent, including the tap-to-explain
tooltip behaviour and the `photoVerified` field name being used correctly everywhere.

**Existing files Codex needs to read before touching anything:**

- `types/user.ts` — `UserProfile.photoVerified: boolean` (migrated in Task 47).
  Confirm `user.verified` does not appear anywhere in the codebase before writing code.
- `components/discovery/SwipeCard.tsx` — card renders name, age, distance, activity
  badges, fitness level badge. Verified badge presence here must be confirmed/added.
- `components/discovery/FullProfileModal.tsx` — full profile layout with name,
  location, bio, fitness cards, shared interests. Badge sits next to name.
- `app/matches/MatchesScreen.tsx` — grid of `MatchCard` items; each card is a
  pressable thumbnail. Badge is a small overlay.
- `app/chat/ChatScreen.tsx` — header shows other user's circular photo and name.
  Badge is inline next to name in the header.
- `app/profile/ProfileScreen.tsx` — own profile view. Badge is in the header section
  next to name/location.
- `components/ui/VerifiedBadge.tsx` — **does not yet exist**. Create it in this task
  as the single source of truth for the verified checkmark UI.
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add
  `profile.verifiedBadge.tooltip` key to all four files.

**Architectural boundary:**
**`VerifiedBadge` is a passive display component only — it never reads from any
store or calls any service. It receives `visible: boolean` and `size?: 'sm' | 'md'`
as props and renders or returns null. All logic for whether a user is verified lives
in the parent component that reads `user.photoVerified`.**

---

## Task 58 — Verified Badge Integration

**Files to create:**
- `components/ui/VerifiedBadge.tsx`

**Files to modify:**
- `components/discovery/SwipeCard.tsx` — add `VerifiedBadge` next to name, wire to `user.photoVerified`
- `components/discovery/FullProfileModal.tsx` — add `VerifiedBadge` next to name in header, wire to `user.photoVerified`
- `app/matches/MatchesScreen.tsx` — add `VerifiedBadge` as a small overlay on each `MatchCard`, wire to `match.otherUser.photoVerified`
- `app/chat/ChatScreen.tsx` — add `VerifiedBadge` inline next to name in the chat header, wire to `otherUser.photoVerified`
- `app/profile/ProfileScreen.tsx` — confirm or add `VerifiedBadge` next to name in the header section, wire to `profile.photoVerified`
- `i18n/en.json` — add `profile.verifiedBadge.tooltip`
- `i18n/my.json` — mirror with English placeholder
- `i18n/zh.json` — mirror with English placeholder
- `i18n/ta.json` — mirror with English placeholder

---

### `components/ui/VerifiedBadge.tsx`

The single source of truth for the verified checkmark UI. Renders a blue
`checkmark-circle` Ionicon. Returns `null` when `visible` is false so callers
can render it unconditionally without an `&&` guard (though callers may still
guard if they prefer). Used on five surfaces: SwipeCard, FullProfileModal,
MatchCard overlay, ChatScreen header, ProfileScreen header.

The `'sm'` size (16px icon, used on SwipeCard chips row and MatchCard overlay)
keeps the icon subtle so it does not crowd the card. The `'md'` size (20px icon,
used on FullProfileModal name row, ChatScreen header, ProfileScreen header) is
more prominent for larger contexts.

On long-press, show a brief `Alert` explaining the badge. The alert text comes
from i18n so it works in all four languages.

```typescript
// 1. React imports
import React from 'react'

// 2. React Native imports
import { TouchableOpacity, Alert, StyleSheet, ViewStyle } from 'react-native'

// 3. Third-party libraries
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

// 4. Internal — constants
import { colors } from '@/constants/theme'

// 5. Props interface (directly above component)
interface VerifiedBadgeProps {
  visible: boolean
  size?: 'sm' | 'md'
}

// 6. Component (named export)
export const VerifiedBadge = ({ visible, size = 'md' }: VerifiedBadgeProps): React.JSX.Element | null => {
  const { t } = useTranslation()

  if (!visible) return null

  const iconSize = size === 'sm' ? 16 : 20

  const handleLongPress = (): void => {
    Alert.alert('', t('profile.verifiedBadge.tooltip'))
  }

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      style={styles.container}
      accessible
      accessibilityLabel={t('profile.verifiedBadge.tooltip')}
      accessibilityRole="image"
    >
      <Ionicons
        name="checkmark-circle"
        size={iconSize}
        color={colors.secondary}
      />
    </TouchableOpacity>
  )
}

// 7. StyleSheet at the very bottom
const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
})
```

---

### `components/discovery/SwipeCard.tsx` — Update

Confirm or add `VerifiedBadge` in the name row at the bottom of the card,
directly after the name + age text. Use `size="sm"` so it sits comfortably
within the card's gradient overlay text row.

```typescript
// Add import (in the Internal — components section, alphabetically):
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'

// In the JSX, in the bottom-left name row — locate the name/age Text and
// add VerifiedBadge immediately after it, inside the same row View:
//
// Before (approximate existing shape):
//   <View style={styles.nameRow}>
//     <Text style={styles.nameText}>{user.firstName}, {user.age}</Text>
//   </View>
//
// After:
//   <View style={styles.nameRow}>
//     <Text style={styles.nameText}>{user.firstName}, {user.age}</Text>
//     <VerifiedBadge visible={user.photoVerified} size="sm" />
//   </View>
```

Do not touch the gesture handler, animation values, LIKE/NOPE/SUPER overlays,
activity badge chips, photo carousel, or StyleSheet.

---

### `components/discovery/FullProfileModal.tsx` — Update

Add `VerifiedBadge` in the name row of the Basic Info section (the section that
shows name, age, location, and distance). Use `size="md"`.

```typescript
// Add import (in the Internal — components section, alphabetically):
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'

// In the JSX, locate the name/age Text in the Basic Info section.
// Add VerifiedBadge immediately after the name Text, inside the same
// horizontal row View:
//
// Before (approximate existing shape):
//   <View style={styles.nameRow}>
//     <Text style={styles.nameText}>{user.firstName}, {user.age}</Text>
//   </View>
//
// After:
//   <View style={styles.nameRow}>
//     <Text style={styles.nameText}>{user.firstName}, {user.age}</Text>
//     <VerifiedBadge visible={user.photoVerified} size="md" />
//   </View>
```

Do not touch the photo carousel, action buttons (Pass/Like/Super Like), report
button, shared interests section, close handler, or StyleSheet.

---

### `app/matches/MatchesScreen.tsx` — Update

The Matches tab renders a grid of match cards. Each card (`MatchCard` or inline
pressable, however it is currently implemented) shows the other user's primary
photo, name, and badges. Add `VerifiedBadge` as a small overlay badge on the
card, positioned bottom-left over the photo (same row as the name chip, or as a
standalone absolute-positioned badge if the card does not already have a name row
overlay). Use `size="sm"`.

```typescript
// Add import (in the Internal — components section, alphabetically):
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'

// In the match card render, locate where the match's name or photo renders.
// Add VerifiedBadge inside the card's name overlay row (or bottom overlay if
// no name row exists yet), reading from match.otherUser.photoVerified:
//
// Example (adapt to actual JSX shape):
//   <View style={styles.nameRow}>
//     <Text style={styles.matchName} numberOfLines={1}>{match.otherUser.firstName}</Text>
//     <VerifiedBadge visible={match.otherUser.photoVerified} size="sm" />
//   </View>
```

Do not touch the NEW badge, unread count badge, online indicator dot, long-press
action sheet (View Profile / Unmatch / Report), Messages tab list view,
pull-to-refresh, real-time subscription logic, or StyleSheet for items unrelated
to the badge row.

---

### `app/chat/ChatScreen.tsx` — Update

The chat header shows the other user's circular photo and name. Add `VerifiedBadge`
inline next to the name `Text` in the header centre area. Use `size="md"`.

```typescript
// Add import (in the Internal — components section, alphabetically):
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'

// In the custom header centre section, locate the other user's name Text.
// Add VerifiedBadge immediately after the name Text in the same row View:
//
// Before (approximate existing shape):
//   <View style={styles.headerCenter}>
//     <Text style={styles.headerName}>{otherUser.firstName}</Text>
//     <Text style={styles.headerStatus}>{onlineStatusText}</Text>
//   </View>
//
// After:
//   <View style={styles.headerCenter}>
//     <View style={styles.headerNameRow}>
//       <Text style={styles.headerName}>{otherUser.firstName}</Text>
//       <VerifiedBadge visible={otherUser.photoVerified} size="md" />
//     </View>
//     <Text style={styles.headerStatus}>{onlineStatusText}</Text>
//   </View>
//
// Add headerNameRow to StyleSheet:
//   headerNameRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   } as ViewStyle,
```

Do not touch the message list, input bar, typing indicator, read receipts, image
send flow, online presence logic, unmatch flow, or any existing StyleSheet entries
unrelated to the header name row.

---

### `app/profile/ProfileScreen.tsx` — Update

The own profile header section already shows name, age, and location. Confirm
`VerifiedBadge` is present here. If it exists, confirm it reads `profile.photoVerified`
(not `profile.verified`). If it is absent, add it next to the name Text. Use `size="md"`.

```typescript
// Add import if not already present:
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'

// In the header name row, confirm or add VerifiedBadge:
//
//   <View style={styles.nameRow}>
//     <Text style={styles.nameText}>{profile.firstName}, {profile.age}</Text>
//     <VerifiedBadge visible={profile.photoVerified} size="md" />
//   </View>
//
// If a prior "Verify Now" card already gates on !profile.photoVerified, that
// existing logic must NOT be changed. VerifiedBadge and the "Verify Now" card
// are independent: VerifiedBadge shows when verified, the "Verify Now" card
// shows when not verified.
```

Do not touch the stats row (Likes, Matches, Days Active), photo grid, edit
profile navigation, settings navigation, connected apps section, or any
existing StyleSheet entries unrelated to the header name row.

---

### i18n updates

Add the following key to all four language files under the `profile` namespace.

**`i18n/en.json`** — add inside the `"profile"` object:
```json
"verifiedBadge": {
  "tooltip": "This user's identity has been verified"
}
```

**`i18n/my.json`** — add inside the `"profile"` object (English placeholder):
```json
"verifiedBadge": {
  "tooltip": "This user's identity has been verified"
}
```

**`i18n/zh.json`** — add inside the `"profile"` object (English placeholder):
```json
"verifiedBadge": {
  "tooltip": "This user's identity has been verified"
}
```

**`i18n/ta.json`** — add inside the `"profile"` object (English placeholder):
```json
"verifiedBadge": {
  "tooltip": "This user's identity has been verified"
}
```

---

## Important Architecture Notes for Codex

1. **`photoVerified` is the canonical field name.** Task 47 renamed `verified` to
   `photoVerified` across all types. Before writing any code, run:
   `grep -r "user\.verified\b\|profile\.verified\b\|\.verified\b" --include="*.ts" --include="*.tsx" .`
   and fix any remaining references to use `.photoVerified` instead. Do not rename
   `photoVerified` or introduce any alias.

2. **`VerifiedBadge` has no store dependency.** It receives `visible: boolean` as a
   prop and must not import from `@/store/profileStore`, `@/store/authStore`, or
   any other store. The parent component is responsible for reading `user.photoVerified`
   and passing it as `visible`.

3. **Long-press triggers an `Alert`, not an inline tooltip.** React Native does not
   have a native tooltip primitive. Use `Alert.alert('', t('profile.verifiedBadge.tooltip'))`
   inside `onLongPress`. Do not install any third-party tooltip library for this task.

4. **No inline styles.** All layout properties — including any new `headerNameRow`
   entry added to `ChatScreen` — must be added to the file's existing
   `StyleSheet.create({})` block at the bottom of the file. Zero `style={{ }}` in JSX.

5. **The `getDiscoveryStack` Cloud Function awards +2 points for `photoVerified`.** That
   field name was set correctly in Task 56 and Task 57. Do not touch any Cloud Function
   files in this task.

6. **`VerifiedBadge` must be a named export only.** Do not use `export default`.
   It is a reusable UI primitive, not a screen. See CONVENTIONS.md Section 4.

7. **Do not modify `firestore.rules`, `functions/`, or any store files** in this task.
   This is a pure UI integration task.

---

## Acceptance Criteria

- [ ] `components/ui/VerifiedBadge.tsx` created and exports `VerifiedBadge` as a named export
- [ ] `VerifiedBadge` renders `Ionicons checkmark-circle` in `colors.secondary` (blue)
- [ ] `VerifiedBadge` returns `null` when `visible` is `false` — no empty space or placeholder
- [ ] `VerifiedBadge` `size="sm"` renders a 16px icon; `size="md"` renders a 20px icon
- [ ] `VerifiedBadge` long-press triggers `Alert.alert` with text from `t('profile.verifiedBadge.tooltip')`
- [ ] `VerifiedBadge` imports no store, service, or hook other than `useTranslation`
- [ ] `SwipeCard.tsx` renders `VerifiedBadge` with `visible={user.photoVerified}` and `size="sm"` in the name row
- [ ] `FullProfileModal.tsx` renders `VerifiedBadge` with `visible={user.photoVerified}` and `size="md"` in the Basic Info name row
- [ ] `MatchesScreen.tsx` renders `VerifiedBadge` with `visible={match.otherUser.photoVerified}` and `size="sm"` on each match card
- [ ] `ChatScreen.tsx` renders `VerifiedBadge` with `visible={otherUser.photoVerified}` and `size="md"` in the header name row
- [ ] `ProfileScreen.tsx` renders `VerifiedBadge` with `visible={profile.photoVerified}` and `size="md"` in the header name row
- [ ] `profile.verifiedBadge.tooltip` key present in all four i18n files (`en`, `my`, `zh`, `ta`)
- [ ] Zero remaining references to `user.verified`, `profile.verified`, or `.verified` (non-`photoVerified`) in any `.ts` or `.tsx` file — confirmed via grep
- [ ] All imports use `@/` alias — no relative paths
- [ ] All new style entries in `StyleSheet.create({})` — zero `style={{ }}` in JSX
- [ ] All colors from `constants/theme` — `colors.secondary` for the badge, no hardcoded hex
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`functions/`, `firestore.rules`, `storage.rules`, `store/`, `services/`,
`types/user.ts`, `types/match.ts`, `types/message.ts`, `types/subscription.ts`,
`constants/`, `app/navigation/RootNavigator.tsx`, `app/onboarding/`,
`app/auth/`, `app/settings/PremiumScreen.tsx`, `components/discovery/UpsellModal.tsx`,
`components/ui/PremiumBadge.tsx`, `App.tsx`, `AGENTS.md`

---

## Commit

```
git commit -m "task-58: verified badge integration across all five profile surfaces"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2C — Task 58] — YYYY-MM-DD

### Completed

- Task 58: Verified badge integration complete — consistent rendering across all five surfaces
- VerifiedBadge: new named-export primitive, sm (16px) / md (20px) sizes, long-press Alert tooltip
- SwipeCard: VerifiedBadge sm in name row, reads user.photoVerified
- FullProfileModal: VerifiedBadge md in Basic Info name row, reads user.photoVerified
- MatchesScreen: VerifiedBadge sm overlay on each match card, reads match.otherUser.photoVerified
- ChatScreen: VerifiedBadge md inline in header name row, reads otherUser.photoVerified
- ProfileScreen: VerifiedBadge md in header name row, reads profile.photoVerified
- i18n: profile.verifiedBadge.tooltip added to all 4 language files

### Files Created / Modified

- components/ui/VerifiedBadge.tsx: created — named export, sm/md sizes, long-press tooltip Alert
- components/discovery/SwipeCard.tsx: VerifiedBadge sm added to name row
- components/discovery/FullProfileModal.tsx: VerifiedBadge md added to Basic Info name row
- app/matches/MatchesScreen.tsx: VerifiedBadge sm added to match card overlay
- app/chat/ChatScreen.tsx: VerifiedBadge md added to header name row, headerNameRow style added
- app/profile/ProfileScreen.tsx: VerifiedBadge md confirmed/added to header name row
- i18n/en.json, my.json, zh.json, ta.json: profile.verifiedBadge.tooltip added

### Architecture Decisions

- VerifiedBadge has zero store/service dependencies — visibility driven entirely by props
- Long-press tooltip uses Alert.alert (no third-party tooltip library) — consistent with existing Alert patterns in the codebase
- size prop defaults to 'md'; callers only need to pass size="sm" for compact card surfaces

### Known Issues / Deferred

- None

### Verification

- npx tsc --noEmit passes
- grep confirms zero remaining .verified (non-photoVerified) references

### Next Up

- Task 59: Fitness Tracking Types and Store (types/fitness.ts, store/fitnessStore.ts)
```

---

## Reasoning Level

Medium
