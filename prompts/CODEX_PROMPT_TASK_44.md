# CODEX PROMPT — Task 44
# Daily Like Limit Enforcement

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1F in progress. Task 43 (biometric auth) is complete. Relevant existing files:

- `store/discoveryStore.ts` — `swipeRight()`, `swipeSuperLike()` actions exist; `dailyLikesCount` state field exists as a stub (initialised to `0`, never actually read from Firestore). `fetchStack()` and `swipeLeft()` are implemented and working. Do not break them.
- `store/authStore.ts` — `user` (FirebaseUser), `isAuthenticated`, `profile` available. `useAuthStore` exported.
- `services/firebase/firestore.ts` — `createUserProfile()`, `updateUserProfile()` exist. `getDailyLikesCount()` and `incrementDailyLikes()` **do not exist yet** — this task creates them.
- `types/user.ts` — `UserProfile` typed. `SubscriptionTier` (`'free' | 'premium'`) in `types/subscription.ts`.
- `store/profileStore.ts` — `profile: UserProfile | null`. `useProfileStore` exported.
- `components/ui/Button.tsx`, `components/ui/LoadingOverlay.tsx` — exist and usable.
- `store/toastStore.ts` — `showToast(message, type)` exported as plain function (not hook).
- `i18n/en.json` — add keys under `discovery.limit.*` (see strings section below).

The **free user daily like cap is 50**. This is tracked in Firestore at `/users/{userId}/dailyLikes` (a **document**, not a collection). The document schema from ARCHITECT.md:

```typescript
{
  count: number;       // likes used today
  resetAt: Timestamp;  // midnight of the day count was started, in user's local timezone
}
```

The cap is **client-enforced in Phase 1** (server-side enforcement is a Phase 2 Cloud Function concern). The client must read the Firestore doc before each `swipeRight` and `swipeSuperLike`, check if reset is due, and block the action if `count >= 50` for free users.

Premium users (`profile.subscription.tier === 'premium'`) bypass the daily limit entirely.

---

## Task 44 — Daily Like Limit Enforcement

**Files to create:**
- `components/discovery/UpsellModal.tsx`

**Files to modify:**
- `services/firebase/firestore.ts` — add `getDailyLikesDoc`, `incrementDailyLikes`
- `store/discoveryStore.ts` — enforce limit in `swipeRight` and `swipeSuperLike`, drive upsell modal state
- `app/discovery/DiscoveryScreen.tsx` — mount `UpsellModal`, wire to store
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `discovery.limit.*` keys

---

### `services/firebase/firestore.ts` — Add Daily Likes Helpers

Add the following two exported functions to the existing file. Do **not** touch any existing functions.

```typescript
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase/config'

const DAILY_LIKE_CAP = 50

interface DailyLikesDoc {
  count: number
  resetAt: Timestamp
}

/**
 * Returns { count, remaining } for the user's daily like quota.
 * Resets the Firestore doc to { count: 0 } if resetAt is before today midnight.
 * Creates the doc with count: 0 if it does not exist yet.
 */
export const getDailyLikesDoc = async (
  userId: string
): Promise<{ count: number; remaining: number }> => {
  const ref = doc(db, 'users', userId, 'dailyLikes', 'doc')
  const snap = await getDoc(ref)

  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  if (!snap.exists()) {
    // First like ever — create the doc
    await setDoc(ref, {
      count: 0,
      resetAt: Timestamp.fromDate(todayMidnight),
    })
    return { count: 0, remaining: DAILY_LIKE_CAP }
  }

  const data = snap.data() as DailyLikesDoc
  const resetAtDate = data.resetAt.toDate()

  if (resetAtDate < todayMidnight) {
    // New day — reset the counter
    await setDoc(ref, {
      count: 0,
      resetAt: Timestamp.fromDate(todayMidnight),
    })
    return { count: 0, remaining: DAILY_LIKE_CAP }
  }

  const remaining = Math.max(0, DAILY_LIKE_CAP - data.count)
  return { count: data.count, remaining }
}

/**
 * Increments the daily like count by 1.
 * Must be called AFTER getDailyLikesDoc confirms the action is permitted.
 * Does NOT re-check the cap — caller is responsible for the guard.
 */
export const incrementDailyLikes = async (userId: string): Promise<void> => {
  const ref = doc(db, 'users', userId, 'dailyLikes', 'doc')
  // Use a regular number increment — FieldValue.increment from admin SDK not available client-side
  const snap = await getDoc(ref)
  const current = snap.exists() ? (snap.data() as DailyLikesDoc).count : 0
  await updateDoc(ref, { count: current + 1 })
}
```

> **Note on path:** The Firestore schema in ARCHITECT.md defines `/users/{userId}/dailyLikes` as a **document** (not a collection). To model this as a subcollection document, the path is `users/{userId}/dailyLikes/doc` — a single fixed document inside a subcollection named `dailyLikes`. This matches Firestore's requirement that every document lives inside a collection.

---

### `store/discoveryStore.ts` — Enforce Limit

Update the existing store. Keep all existing state and actions intact. Make only the following changes:

**Add to state:**
```typescript
isUpsellVisible: boolean
```
Initial value: `false`

**Add actions:**
```typescript
showUpsell: () => void      // sets isUpsellVisible: true
hideUpsell: () => void      // sets isUpsellVisible: false
```

**Rewrite `swipeRight`:**

The existing `swipeRight` writes the like to Firestore without checking the daily limit. Replace the body with:

```typescript
swipeRight: async (targetId: string): Promise<void> => {
  const { user } = useAuthStore.getState()
  const { profile } = useProfileStore.getState()

  if (user === null) return

  // Premium users skip the cap
  const isPremium = profile?.subscription?.tier === 'premium'

  if (!isPremium) {
    const { remaining } = await getDailyLikesDoc(user.uid)
    if (remaining <= 0) {
      set({ isUpsellVisible: true })
      return
    }
  }

  // Write the like
  const likeRef = doc(db, 'swipes', user.uid, 'likes', targetId)
  await setDoc(likeRef, {
    swiperId: user.uid,
    targetId,
    isSuperLike: false,
    createdAt: serverTimestamp(),
  })

  // Increment counter (non-premium only)
  if (!isPremium) {
    await incrementDailyLikes(user.uid)
  }

  set((state) => ({
    dailyLikesCount: state.dailyLikesCount + (isPremium ? 0 : 1),
    stack: state.stack.filter((u) => u.uid !== targetId),
  }))
},
```

**Rewrite `swipeSuperLike`:**

The existing stub checks premium tier but does not check the daily limit. Replace:

```typescript
swipeSuperLike: async (targetId: string): Promise<void> => {
  const { user } = useAuthStore.getState()
  const { profile } = useProfileStore.getState()

  if (user === null) return

  const isPremium = profile?.subscription?.tier === 'premium'

  // Super like is premium-only in Phase 1
  if (!isPremium) {
    set({ isUpsellVisible: true })
    return
  }

  // Premium users: no daily cap on super likes
  const likeRef = doc(db, 'swipes', user.uid, 'likes', targetId)
  await setDoc(likeRef, {
    swiperId: user.uid,
    targetId,
    isSuperLike: true,
    createdAt: serverTimestamp(),
  })

  set((state) => ({
    stack: state.stack.filter((u) => u.uid !== targetId),
  }))
},
```

**Add required imports at top of store file:**
```typescript
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { getDailyLikesDoc, incrementDailyLikes } from '@/services/firebase/firestore'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
```

---

### `components/discovery/UpsellModal.tsx`

Modal shown when a free user hits the daily like cap or attempts a premium-only action (super like). Phase 1 implementation: informational only. "Upgrade Now" is a stub CTA (shows a coming-soon toast). This will be wired to the real Stripe flow in Phase 2.

```typescript
import React from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { colors, spacing, typography } from '@/constants/theme'
import { showToast } from '@/store/toastStore'

interface UpsellModalProps {
  visible: boolean
  onDismiss: () => void
  /** 'likes' = daily cap reached. 'superLike' = premium feature gate. */
  reason: 'likes' | 'superLike'
}

const BENEFITS: Array<{ icon: keyof typeof Ionicons.glyphMap; key: string }> = [
  { icon: 'heart-outline', key: 'unlimitedLikes' },
  { icon: 'star-outline', key: 'superLikes' },
  { icon: 'eye-outline', key: 'seeWhoLiked' },
  { icon: 'arrow-undo-outline', key: 'rewind' },
  { icon: 'flash-outline', key: 'priority' },
]

export const UpsellModal = ({
  visible,
  onDismiss,
  reason,
}: UpsellModalProps): React.JSX.Element => {
  const { t } = useTranslation()

  const handleUpgrade = (): void => {
    // Phase 2 will navigate to PremiumScreen — stub for now
    showToast(t('discovery.limit.comingSoon'), 'info')
    onDismiss()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="flash" size={40} color={colors.warning} />
            <Text style={styles.headline}>
              {reason === 'likes'
                ? t('discovery.limit.outOfLikes')
                : t('discovery.limit.premiumFeature')}
            </Text>
            <Text style={styles.subheadline}>
              {t('discovery.limit.upgradeSubtitle')}
            </Text>
          </View>

          {/* Benefits list */}
          <View style={styles.benefits}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.key} style={styles.benefitRow}>
                <Ionicons
                  name={benefit.icon}
                  size={20}
                  color={colors.primary}
                  style={styles.benefitIcon}
                />
                <Text style={styles.benefitText}>
                  {t(`discovery.limit.benefits.${benefit.key}`)}
                </Text>
              </View>
            ))}
          </View>

          {/* CTAs */}
          <View style={styles.actions}>
            <Button
              label={t('discovery.limit.upgradeCta')}
              onPress={handleUpgrade}
              variant="primary"
            />
            <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
              <Text style={styles.dismissText}>
                {t('discovery.limit.maybeLater')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  } as ViewStyle,
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  } as ViewStyle,
  headline: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    marginTop: spacing.md,
    textAlign: 'center',
  } as TextStyle,
  subheadline: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: spacing.sm,
  } as TextStyle,
  benefits: {
    marginBottom: spacing.xl,
  } as ViewStyle,
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  } as ViewStyle,
  benefitIcon: {
    marginRight: spacing.md,
  } as ViewStyle,
  benefitText: {
    fontSize: typography.sizes.md,
    color: colors.gray[700],
  } as TextStyle,
  actions: {
    gap: spacing.sm,
  } as ViewStyle,
  dismissButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  } as ViewStyle,
  dismissText: {
    fontSize: typography.sizes.md,
    color: colors.gray[500],
  } as TextStyle,
})
```

---

### `app/discovery/DiscoveryScreen.tsx` — Mount UpsellModal

Add the following to the existing `DiscoveryScreen`:

1. **Import:**
```typescript
import { UpsellModal } from '@/components/discovery/UpsellModal'
import { useDiscoveryStore } from '@/store/discoveryStore'
```

2. **Read upsell state from store:**
```typescript
const isUpsellVisible = useDiscoveryStore((s) => s.isUpsellVisible)
const hideUpsell = useDiscoveryStore((s) => s.hideUpsell)
// Track reason for modal (likes cap vs super like gate)
// discoveryStore exposes this via isUpsellVisible only for Phase 1.
// Default reason to 'likes' — super like path also sets isUpsellVisible,
// so DiscoveryScreen passes reason based on context if needed.
// For Phase 1 simplicity: always pass reason="likes" here.
// The modal headline differs by reason, but both CTAs are stubs.
```

3. **Mount modal at the bottom of the return JSX** (inside the outermost `View`, after all other children):
```tsx
<UpsellModal
  visible={isUpsellVisible}
  onDismiss={hideUpsell}
  reason="likes"
/>
```

Do not restructure `DiscoveryScreen` otherwise. The swipe card stack, action buttons, empty state, and loading indicator must remain unchanged.

---

### i18n — Add `discovery.limit.*` Keys

Add the following to **all four** language files (`en.json`, `my.json`, `zh.json`, `ta.json`). Non-English files use the English values as placeholders.

```json
"discovery": {
  "limit": {
    "outOfLikes": "You're Out of Likes",
    "premiumFeature": "Premium Feature",
    "upgradeSubtitle": "Upgrade to Premium and unlock the full fitlink experience.",
    "upgradeCta": "Upgrade Now",
    "maybeLater": "Maybe Later",
    "comingSoon": "Premium subscriptions coming soon!",
    "benefits": {
      "unlimitedLikes": "Unlimited Likes every day",
      "superLikes": "5 Super Likes per week",
      "seeWhoLiked": "See who liked you",
      "rewind": "Rewind your last swipe",
      "priority": "Priority profile in discovery"
    }
  }
}
```

Merge these keys into the existing `"discovery"` object in each file — do **not** replace the existing keys (`noMore`, `refresh`, etc.).

---

## Architecture Notes for Codex

### Daily Likes Doc Path
The path `users/{userId}/dailyLikes/doc` is a single Firestore document at a fixed ID (`doc`) inside a subcollection named `dailyLikes`. The ARCHITECT.md schema describes it as `/users/{userId}/dailyLikes (document, not collection)` — Firestore requires every document to sit inside a collection, so a single-document subcollection is the correct pattern. The `firestore.rules` from Task 39 already covers `/users/{userId}` subtree. No new security rule is needed for this subcollection read in Phase 1 (the existing rule `allow read, write: if request.auth.uid == userId` on the user subtree covers it). Do not touch `firestore.rules`.

### No FieldValue.increment Client-Side
`FieldValue.increment` from the Firebase Admin SDK is not available on the client-side Firebase JS SDK in the same way. The `incrementDailyLikes` helper reads the current count and writes `current + 1`. This is safe for Phase 1 single-device use. Race conditions at scale are handled server-side in Phase 2 (Cloud Function with transactions).

### Reset Logic
The `resetAt` Timestamp stores midnight of the day the count started. On each `getDailyLikesDoc` call, the client compares `resetAt` against today's local midnight. If `resetAt < todayMidnight`, the doc is reset. This means the cap resets at midnight **local time** as specified in TASKS.md.

### `swipeRight` Import Conflict
`discoveryStore.ts` will now import `getDailyLikesDoc` from `services/firebase/firestore.ts` AND also import `doc`, `setDoc`, `serverTimestamp` from `firebase/firestore`. These are different modules — ensure both import paths are correct and distinct.

### Upsell `reason` Prop — Phase 1 Simplification
Both the daily-cap path and the super-like gate path set `isUpsellVisible: true`. The `DiscoveryScreen` passes `reason="likes"` by default to `UpsellModal`. This is acceptable for Phase 1. In Phase 2, a separate `upsellReason: 'likes' | 'superLike'` field can be added to the store to make the headline more precise. Do not over-engineer this now.

### Do Not Touch
- `components/ui/Button.tsx` — no changes
- `store/authStore.ts` — no changes
- `store/profileStore.ts` — no changes
- `store/toastStore.ts` — no changes
- `firestore.rules` — no changes
- `functions/` — no changes (server-side enforcement is Phase 2)
- Any existing `discoveryStore` state or actions not mentioned above (`fetchStack`, `swipeLeft`, `stack`, `isLoading`, `error`, `currentIndex`)

---

## Acceptance Criteria

- [ ] `getDailyLikesDoc(userId)` reads Firestore `users/{userId}/dailyLikes/doc`, resets if stale, creates if missing — returns `{ count, remaining }`
- [ ] `incrementDailyLikes(userId)` increments the count by 1
- [ ] Free user who has 0 likes used: `swipeRight` proceeds normally, increments count
- [ ] Free user who has 50 likes used: `swipeRight` sets `isUpsellVisible: true` and does NOT write to Firestore
- [ ] Premium user: `swipeRight` bypasses `getDailyLikesDoc` entirely and does NOT call `incrementDailyLikes`
- [ ] Free user taps Super Like: `swipeSuperLike` sets `isUpsellVisible: true`, no Firestore write
- [ ] Premium user taps Super Like: `swipeSuperLike` writes `isSuperLike: true` like doc normally
- [ ] `UpsellModal` renders with correct headline for `reason="likes"`, benefit list, two buttons
- [ ] "Upgrade Now" shows info toast ("Premium subscriptions coming soon!") and dismisses modal
- [ ] "Maybe Later" dismisses modal
- [ ] Modal mounts in `DiscoveryScreen` and is driven by `isUpsellVisible` from store
- [ ] `discovery.limit.*` i18n keys present in all 4 language files
- [ ] Existing `swipeLeft`, `fetchStack`, card rendering, action buttons — all unaffected
- [ ] Zero inline styles
- [ ] Zero TypeScript errors (`tsc --noEmit` passes)
- [ ] No `any` types introduced

---

## Commit

```
git commit -m "task-44: daily like limit enforcement with upsell modal"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1F — Task 44] — YYYY-MM-DD

### Completed

- Task 44: Daily like limit enforcement — free users capped at 50 likes/day
- getDailyLikesDoc() reads, resets, and creates the dailyLikes subcollection doc
- incrementDailyLikes() increments count after a successful swipeRight
- swipeRight() checks cap before writing like; blocks and shows upsell if at limit
- swipeSuperLike() gates non-premium users behind upsell modal
- UpsellModal component created — informational Phase 1 stub, "Upgrade Now" shows toast
- DiscoveryScreen mounts UpsellModal driven by discoveryStore.isUpsellVisible

### Files Created / Modified

- services/firebase/firestore.ts: getDailyLikesDoc, incrementDailyLikes added
- store/discoveryStore.ts: isUpsellVisible state, showUpsell/hideUpsell actions, swipeRight and swipeSuperLike rewritten with limit enforcement
- components/discovery/UpsellModal.tsx: modal with reason prop, benefits list, stub upgrade CTA
- app/discovery/DiscoveryScreen.tsx: UpsellModal mounted, wired to store
- i18n/en.json, my.json, zh.json, ta.json: discovery.limit.* keys added

### Architecture Decisions

- Daily likes doc stored at users/{userId}/dailyLikes/doc (single-doc subcollection pattern)
- Reset logic uses local midnight comparison — resets at local midnight as spec'd
- No FieldValue.increment client-side — read-then-write pattern; race condition safe for Phase 1
- Premium check reads from profileStore.profile.subscription.tier
- Upsell reason fixed to 'likes' in DiscoveryScreen for Phase 1 simplicity

### Known Issues / Deferred

- Server-side cap enforcement (Cloud Function transaction) deferred to Phase 2
- Upsell reason differentiation (likes vs superLike headline) deferred to Phase 2
- "Upgrade Now" CTA is a stub — Stripe PremiumScreen navigation deferred to Phase 2

### Next Up

- Task 45: lastActive heartbeat (useLastActive hook, AppState listener, 5-min interval)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 45 prompt.

---

## Reasoning Level
Medium
