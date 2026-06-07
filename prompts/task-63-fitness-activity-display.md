@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 63 builds the fitness activity display layer — the UI surfaces that show `TodayStats`
data across the app. All underlying data infrastructure is complete:

- `types/fitness.ts` — canonical import point; exports `FitnessSource`, `TodayStats`,
  `WorkoutSession`, `FitnessConnectionStatus`. `TodayStats.updatedAt` is `Timestamp | null`
  (widened in Task 60 for the server-write placeholder).
- `types/subscription.ts` — `TodayStats`, `WorkoutSession`, `FitnessTrackingSource` definitions
  live here; `types/fitness.ts` re-exports them.
- `store/fitnessStore.ts` — `useFitnessStore` with: `todayStats: TodayStats | null`,
  `shareOnProfile: boolean`, `connections: Record<FitnessSource, FitnessConnectionStatus>`,
  `fetchTodayStats(uid)`, `setShareOnProfile(enabled)`, `syncNow(source)`.
- `hooks/useAppleHealth.ts` — `useAppleHealth` hook; exposes `{ isConnected, todayStats,
  sync, disconnect }`. iOS-only guard at hook level.
- `hooks/useGoogleFit.ts` — `useGoogleFit` hook; exposes `{ isConnected, todayStats,
  sync, disconnect }`. Android-only guard at hook level.
- `services/strava.ts` — `connectStrava`, `syncStrava`, `disconnectStrava` service functions.
- `store/authStore.ts` — `useAuthStore`; provides `uid: string | null`.
- `store/subscriptionStore.ts` — `useSubscriptionStore`; provides `isPremium()`.
- `components/discovery/FullProfileModal.tsx` — full-screen profile modal used from the
  discovery stack. Scrollable sections already include "What You Have in Common". New
  "Today's Activity" section inserts after it.
- `app/profile/ProfileScreen.tsx` — own profile screen. Displays the logged-in user's
  full profile. A new "Today's Activity" card section and a "Connected Apps" row insert
  below the existing stats row.
- `components/discovery/SwipeCard.tsx` — animated swipe card. Name row at bottom-left
  already carries `VerifiedBadge`. An "Active today" chip badge adds to that row.
- `constants/theme.ts` — re-exports `colors`, `spacing`, `typography`.
- `i18n/en.json` — already has `fitness.*` namespace from Task 59.
- All i18n keys for this task must be added to all four files (`en`, `my`, `zh`, `ta`).

**Architectural boundary — no platform-specific health library imports outside their
dedicated service/hook files.** `TodayActivityCard` and all screen-level components read
only from `fitnessStore` (for the own-profile surface) or from props passed by the parent
(for the match-profile surface). They never import `react-native-health` or
`react-native-google-fit` directly.

**Architectural boundary — `shareOnProfile` gates visibility on *other users'* profiles,
not on the own profile.** The logged-in user always sees their own activity card
regardless of the `shareOnProfile` toggle. The toggle only controls what matches see.

**Architectural boundary — no new Firestore writes in this task.** `TodayActivityCard`
and all modified screens are read-only consumers. `setShareOnProfile` is already implemented
in `fitnessStore`; screens call it directly.

**"Active today" badge in `SwipeCard` reads `fitnessTracking.shareOnProfile` and
`fitnessTracking.todayStats.updatedAt` from the candidate `UserProfile` prop.** The
discovery stack already carries `UserProfile` objects fetched by `getDiscoveryStack`; no
new Firestore field is introduced. The badge shows only when both conditions are true:
`shareOnProfile === true` AND `updatedAt` is within the last 24 hours. Because
`updatedAt` is `Timestamp | null`, the check must handle `null` safely.

---

## Task 63 — Fitness Activity Display on Profiles

**Files to create:**
- `components/profile/TodayActivityCard.tsx`

**Files to modify:**
- `components/discovery/FullProfileModal.tsx` — add "Today's Activity" section
- `app/profile/ProfileScreen.tsx` — add "Today's Activity" card + "Connected Apps" row
- `components/discovery/SwipeCard.tsx` — add "Active today" chip badge
- `i18n/en.json` — add `fitness.activity.*` and `fitness.connectedApps.*` keys
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — mirror new keys with English placeholders

---

### `components/profile/TodayActivityCard.tsx`

A pure display card. It receives `stats` and `source` as props and renders the activity
summary. It has no store subscriptions and no platform-specific imports — all data arrives
via props so the component is equally usable on own-profile and match-profile surfaces.

```typescript
// 1. React
import React from 'react'

// 2. React Native
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'

// 3. Third-party
import { useTranslation } from 'react-i18next'

// 4. Internal — types
import type { TodayStats } from '@/types/fitness'
import type { FitnessSource } from '@/types/fitness'

// 5. Internal — constants
import { colors, spacing, typography } from '@/constants/theme'

// Props interface
interface TodayActivityCardProps {
  stats: TodayStats
  source: FitnessSource
  /**
   * true  → own profile surface (always visible, no share-gate)
   * false → match profile surface (caller has already checked shareOnProfile)
   */
  isOwn: boolean
}

export const TodayActivityCard = ({
  stats,
  source,
  isOwn,
}: TodayActivityCardProps): React.JSX.Element => {
  const { t } = useTranslation()

  // Resolve source label from i18n
  const sourceLabel: string = (() => {
    if (source === 'appleHealth') return t('fitness.source.appleHealth')
    if (source === 'googleFit') return t('fitness.source.googleFit')
    return t('fitness.source.strava')
  })()

  // Relative "last updated" text
  const lastUpdatedLabel: string = (() => {
    if (stats.updatedAt === null) return t('fitness.activity.justSynced')
    const diffMs = Date.now() - stats.updatedAt.toMillis()
    const diffMin = Math.floor(diffMs / 60_000)
    if (diffMin < 1) return t('fitness.activity.justSynced')
    if (diffMin < 60)
      return t('fitness.activity.updatedMinutesAgo', { count: diffMin })
    const diffHr = Math.floor(diffMin / 60)
    return t('fitness.activity.updatedHoursAgo', { count: diffHr })
  })()

  // Most recent workout — first entry in the workouts array (already ordered by caller)
  const latestWorkout = stats.workouts.length > 0 ? stats.workouts[0] : null

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {t('fitness.activity.sectionTitle')}
        </Text>
        <Text style={styles.sourceLabel}>{sourceLabel}</Text>
      </View>

      {/* Stats row: steps / calories / distance */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statEmoji}>👟</Text>
          <Text style={styles.statValue}>
            {stats.steps.toLocaleString()}
          </Text>
          <Text style={styles.statUnit}>
            {t('fitness.activity.steps')}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statCell}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>
            {Math.round(stats.calories).toLocaleString()}
          </Text>
          <Text style={styles.statUnit}>
            {t('fitness.activity.calories')}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statCell}>
          <Text style={styles.statEmoji}>📏</Text>
          <Text style={styles.statValue}>
            {stats.distance.toFixed(1)}
          </Text>
          <Text style={styles.statUnit}>
            {t('fitness.activity.distanceKm')}
          </Text>
        </View>
      </View>

      {/* Latest workout row — only rendered when a workout exists */}
      {latestWorkout !== null && (
        <View style={styles.workoutRow}>
          <Text style={styles.workoutText}>
            {latestWorkout.type}
            {' — '}
            {t('fitness.activity.workoutDuration', {
              count: Math.round(latestWorkout.duration),
            })}
          </Text>
        </View>
      )}

      {/* Footer: last updated */}
      <Text style={styles.lastUpdated}>{lastUpdatedLabel}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  } as ViewStyle,
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
  } as TextStyle,
  sourceLabel: {
    fontSize: typography.sizes.xs,
    color: colors.gray[600],
  } as TextStyle,
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  } as ViewStyle,
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  } as ViewStyle,
  statEmoji: {
    fontSize: typography.sizes.lg,
  } as TextStyle,
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
  } as TextStyle,
  statUnit: {
    fontSize: typography.sizes.xs,
    color: colors.gray[600],
  } as TextStyle,
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.gray[200],
  } as ViewStyle,
  workoutRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  } as ViewStyle,
  workoutText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
  } as TextStyle,
  lastUpdated: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.xs,
    color: colors.gray[400],
  } as TextStyle,
})
```

---

### `components/discovery/FullProfileModal.tsx` — Update

Add a "Today's Activity" section **after** the existing "What You Have in Common" section.

The section must only render when **both** conditions are true:
1. The viewed user's `fitnessTracking.shareOnProfile === true`
2. The viewed user's `fitnessTracking.todayStats` exists AND `updatedAt` is within the
   last 24 hours (86 400 000 ms). Because `updatedAt` is `Timestamp | null`, guard it
   explicitly before calling `.toMillis()`.

The `UserProfile` type already carries `fitnessTracking` from the Task 47 schema update.
Read `profile.fitnessTracking` to obtain `shareOnProfile`, `todayStats`, and the active
source (first connected source in priority order: `appleHealth` → `googleFit` → `strava`).

```typescript
// Add import:
import { TodayActivityCard } from '@/components/profile/TodayActivityCard'
import type { FitnessSource } from '@/types/fitness'

// Helper — determine active FitnessSource from fitnessTracking connections.
// Returns null if no source is connected or stats are absent.
// Place this above the component, not inside it.
const resolveActiveSource = (
  fitnessTracking: UserProfile['fitnessTracking'],
): FitnessSource | null => {
  if (!fitnessTracking) return null
  if (fitnessTracking.appleHealth?.connected) return 'appleHealth'
  if (fitnessTracking.googleFit?.connected) return 'googleFit'
  if (fitnessTracking.strava?.connected) return 'strava'
  return null
}

// Inside the scrollable content, after the "What You Have in Common" section:
// Replace with the exact JSX block below. Do NOT touch any other section.

{(() => {
  const ft = profile.fitnessTracking
  if (!ft?.shareOnProfile) return null
  const { todayStats } = ft
  if (!todayStats) return null
  const { updatedAt } = todayStats
  if (updatedAt === null) return null
  const ageMs = Date.now() - updatedAt.toMillis()
  if (ageMs > 86_400_000) return null
  const activeSource = resolveActiveSource(ft)
  if (activeSource === null) return null
  return (
    <TodayActivityCard
      stats={todayStats}
      source={activeSource}
      isOwn={false}
    />
  )
})()}
```

Do **not** touch the photo carousel, basic info, bio, fitness profile card, lifestyle card,
about card, shared interests section, fixed bottom action bar, or any existing styles.

---

### `app/profile/ProfileScreen.tsx` — Update

**Two additions, both below the existing stats row:**

#### Addition 1 — "Today's Activity" card (own user)

The own-profile activity card is always visible to the logged-in user regardless of
`shareOnProfile`. Read data from `useFitnessStore`.

```typescript
// Add imports:
import { useFitnessStore } from '@/store/fitnessStore'
import { TodayActivityCard } from '@/components/profile/TodayActivityCard'
import type { FitnessSource } from '@/types/fitness'

// Inside the component, after existing store subscriptions:
const { todayStats, connections, shareOnProfile, setShareOnProfile, syncNow } =
  useFitnessStore()

// Helper — inline, same logic as FullProfileModal helper:
const resolveOwnActiveSource = (): FitnessSource | null => {
  if (connections.appleHealth.connected) return 'appleHealth'
  if (connections.googleFit.connected) return 'googleFit'
  if (connections.strava.connected) return 'strava'
  return null
}

// JSX — insert below the stats row, before the existing photo gallery / bio sections:
{todayStats !== null && resolveOwnActiveSource() !== null && (
  <TodayActivityCard
    stats={todayStats}
    source={resolveOwnActiveSource()!}
    isOwn={true}
  />
)}
```

> **Note on the non-null assertion:** `resolveOwnActiveSource()` is called twice in the
> JSX above. To avoid this, derive the source into a variable before the return:
> ```typescript
> const ownActiveSource = resolveOwnActiveSource()
> // Then in JSX:
> {todayStats !== null && ownActiveSource !== null && (
>   <TodayActivityCard stats={todayStats} source={ownActiveSource} isOwn={true} />
> )}
> ```
> Use the variable form — no non-null assertion (`!`) in JSX.

#### Addition 2 — "Connected Apps" row

A compact informational row listing which sources are connected, with a "Sync Now" button
for each connected source and a "Share activity on profile" toggle.

```typescript
// Add import:
import { Switch } from 'react-native'
import { useAuthStore } from '@/store/authStore'

// uid from authStore — already imported in existing ProfileScreen; add only if absent.
const { uid } = useAuthStore()

// JSX — insert directly after the TodayActivityCard block:
<View style={styles.connectedAppsSection}>
  <Text style={styles.connectedAppsTitle}>
    {t('fitness.connectedApps.title')}
  </Text>

  {/* Share toggle */}
  <View style={styles.shareToggleRow}>
    <Text style={styles.shareToggleLabel}>
      {t('fitness.connectedApps.shareToggleLabel')}
    </Text>
    <Switch
      value={shareOnProfile}
      onValueChange={(enabled: boolean) => {
        if (uid !== null) {
          setShareOnProfile(uid, enabled)
        }
      }}
      trackColor={{ false: colors.gray[400], true: colors.primary }}
      thumbColor={colors.white}
    />
  </View>

  {/* Connected source list — show only connected ones */}
  {connections.appleHealth.connected && (
    <View style={styles.connectedSourceRow}>
      <Text style={styles.connectedSourceName}>
        {t('fitness.source.appleHealth')}
      </Text>
      <Text
        style={styles.syncNowButton}
        onPress={() => { if (uid !== null) syncNow('appleHealth', uid) }}
      >
        {t('fitness.connectedApps.syncNow')}
      </Text>
    </View>
  )}
  {connections.googleFit.connected && (
    <View style={styles.connectedSourceRow}>
      <Text style={styles.connectedSourceName}>
        {t('fitness.source.googleFit')}
      </Text>
      <Text
        style={styles.syncNowButton}
        onPress={() => { if (uid !== null) syncNow('googleFit', uid) }}
      >
        {t('fitness.connectedApps.syncNow')}
      </Text>
    </View>
  )}
  {connections.strava.connected && (
    <View style={styles.connectedSourceRow}>
      <Text style={styles.connectedSourceName}>
        {t('fitness.source.strava')}
      </Text>
      <Text
        style={styles.syncNowButton}
        onPress={() => { if (uid !== null) syncNow('strava', uid) }}
      >
        {t('fitness.connectedApps.syncNow')}
      </Text>
    </View>
  )}

  {/* Empty state — no sources connected */}
  {!connections.appleHealth.connected &&
    !connections.googleFit.connected &&
    !connections.strava.connected && (
      <Text style={styles.noSourcesText}>
        {t('fitness.connectedApps.noSources')}
      </Text>
    )}
</View>
```

Add these styles to the existing `StyleSheet.create({})` at the bottom of
`ProfileScreen.tsx`. Do **not** replace the existing styles — append only:

```typescript
connectedAppsSection: {
  marginTop: spacing.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  backgroundColor: colors.surface,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.gray[200],
} as ViewStyle,
connectedAppsTitle: {
  fontSize: typography.sizes.md,
  fontWeight: typography.weights.semibold,
  color: colors.gray[800],
  marginBottom: spacing.sm,
} as TextStyle,
shareToggleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: spacing.xs,
  marginBottom: spacing.sm,
} as ViewStyle,
shareToggleLabel: {
  fontSize: typography.sizes.sm,
  color: colors.gray[800],
  flex: 1,
} as TextStyle,
connectedSourceRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: spacing.xs,
  borderTopWidth: 1,
  borderTopColor: colors.gray[200],
} as ViewStyle,
connectedSourceName: {
  fontSize: typography.sizes.sm,
  color: colors.gray[800],
} as TextStyle,
syncNowButton: {
  fontSize: typography.sizes.sm,
  color: colors.primary,
  fontWeight: typography.weights.medium,
} as TextStyle,
noSourcesText: {
  fontSize: typography.sizes.sm,
  color: colors.gray[600],
  marginTop: spacing.xs,
} as TextStyle,
```

Do **not** touch the existing photo header, quick stats row, verification card, bio
section, info cards, or "Get Premium" button logic.

---

### `components/discovery/SwipeCard.tsx` — Update

Add an "Active today" chip badge to the existing name row at the card's bottom-left.

The badge must only render when **both** conditions are met:
- `user.fitnessTracking?.shareOnProfile === true`
- `user.fitnessTracking?.todayStats?.updatedAt` is a non-null `Timestamp` AND within
  the last 24 hours (86 400 000 ms)

Because `user` is a `UserProfile` prop already passed to `SwipeCard`, no store imports
are needed in this component.

```typescript
// Add import:
import { useTranslation } from 'react-i18next'
// Note: if useTranslation is already imported in SwipeCard, do not duplicate the import.

// Inside the component — derive the badge flag before the return:
const isActiveTodayVisible: boolean = (() => {
  const ft = user.fitnessTracking
  if (!ft?.shareOnProfile) return false
  const updatedAt = ft.todayStats?.updatedAt ?? null
  if (updatedAt === null) return false
  return Date.now() - updatedAt.toMillis() <= 86_400_000
})()

// In JSX — inside the existing bottom-left name row, after the existing name/age Text
// and VerifiedBadge, add the badge only when visible:
{isActiveTodayVisible && (
  <View style={styles.activeTodayBadge}>
    <Text style={styles.activeTodayText}>
      {t('fitness.activity.activeTodayBadge')}
    </Text>
  </View>
)}
```

Add these styles to `SwipeCard`'s existing `StyleSheet.create({})`. Do **not** replace
any existing styles — append only:

```typescript
activeTodayBadge: {
  backgroundColor: colors.primary,
  borderRadius: 8,
  paddingHorizontal: spacing.sm,
  paddingVertical: 2,
  marginLeft: spacing.xs,
} as ViewStyle,
activeTodayText: {
  fontSize: typography.sizes.xs,
  fontWeight: typography.weights.semibold,
  color: colors.white,
} as TextStyle,
```

Do **not** touch the pan gesture logic, `useSharedValue` declarations, `useAnimatedStyle`,
label overlays (LIKE / NOPE / SUPER), photo pagination dots, gradient overlay, activity
chips, fitness level badge, or `VerifiedBadge` integration.

---

### `i18n/en.json` — Update

Add the following keys under the existing `fitness` namespace. Do **not** remove or rename
any existing `fitness.*` keys:

```json
{
  "fitness": {
    "activity": {
      "sectionTitle": "Today's Activity",
      "steps": "Steps",
      "calories": "Cal",
      "distanceKm": "km",
      "workoutDuration": "{{count}} min",
      "justSynced": "Just synced",
      "updatedMinutesAgo": "Updated {{count}}m ago",
      "updatedHoursAgo": "Updated {{count}}h ago",
      "activeTodayBadge": "Active today"
    },
    "connectedApps": {
      "title": "Connected Apps",
      "shareToggleLabel": "Share activity on profile",
      "syncNow": "Sync Now",
      "noSources": "No fitness apps connected. Connect one in Settings."
    }
  }
}
```

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Mirror the same key structure with English placeholder values for all three files. Add
them under the existing `fitness` namespace without touching any other keys.

---

## Important Architecture Notes for Codex

1. **`TodayActivityCard` has no store or service imports.** All data arrives via `stats`
   and `source` props. Components that render it are responsible for reading from
   `fitnessStore` or from `UserProfile.fitnessTracking` and passing the resolved values
   down. This keeps the card purely presentational and reusable across own-profile and
   match-profile surfaces.

2. **`shareOnProfile` gates match-visible surfaces only.** In `FullProfileModal` (a match
   or candidate's profile), the card renders only when `profile.fitnessTracking.shareOnProfile
   === true`. In `ProfileScreen` (the logged-in user's own profile), the card always renders
   when `todayStats` is non-null and a source is connected — the toggle has no effect on
   the own-profile view.

3. **`updatedAt` is `Timestamp | null`.** Always check for `null` before calling
   `.toMillis()`. The `null` case is the server-write placeholder used during the
   sync flow (Task 60). Any 24-hour staleness check must handle `null` by treating it
   as "not visible".

4. **No new Firestore writes introduced in this task.** `setShareOnProfile` already exists
   in `fitnessStore` from Task 59 and handles the Firestore write. `ProfileScreen` calls
   it on `Switch` toggle — no direct Firestore writes in UI components.

5. **`resolveActiveSource` / `resolveOwnActiveSource` helpers read from connections, not
   from `fitnessTracking.todayStats.source`.** The canonical source of truth for which
   integration is active is the `connections` record in `fitnessStore` (for own profile)
   or the `fitnessTracking.{source}.connected` booleans on `UserProfile` (for match
   profile). Priority order is: `appleHealth` → `googleFit` → `strava`.

6. **"Active today" badge in `SwipeCard` derives its state inline from the `user` prop.**
   No store subscriptions are added to `SwipeCard`. The component already receives the
   full `UserProfile` object, which carries `fitnessTracking` from the schema.

7. **No platform-specific imports in `TodayActivityCard`, `FullProfileModal`,
   `ProfileScreen`, or `SwipeCard`.** All health/fit library interactions remain inside
   `services/healthKit.ts`, `services/googleFit.ts`, `services/strava.ts`, and their
   respective hooks.

8. **Style type annotations are mandatory.** Every entry in `StyleSheet.create({})` must
   have an explicit `as ViewStyle`, `as TextStyle`, or `as ImageStyle` cast per
   CONVENTIONS.md §6.

---

## Acceptance Criteria

- [ ] `components/profile/TodayActivityCard.tsx` created and exports `TodayActivityCard`
      as a named export
- [ ] `TodayActivityCard` renders steps, calories, and distance in a horizontal row with
      emoji icons
- [ ] `TodayActivityCard` renders the latest workout row only when `stats.workouts.length > 0`
- [ ] `TodayActivityCard` displays the source label (`appleHealth` / `googleFit` / `strava`)
      via i18n key `fitness.source.*`
- [ ] `TodayActivityCard` renders "last updated" relative time via i18n keys
      `fitness.activity.updatedMinutesAgo` / `fitness.activity.updatedHoursAgo` /
      `fitness.activity.justSynced`
- [ ] `TodayActivityCard` has no store imports and no platform-specific imports
- [ ] `FullProfileModal` renders `TodayActivityCard` only when `shareOnProfile === true`
      AND `todayStats` exists AND `updatedAt` is non-null AND within last 24 h
- [ ] `FullProfileModal` does not render the activity section when any guard condition
      fails (shareOnProfile false, todayStats null, updatedAt null, or stale)
- [ ] `ProfileScreen` renders `TodayActivityCard` for the own user without a
      `shareOnProfile` guard
- [ ] `ProfileScreen` renders the "Connected Apps" section with the share toggle and
      per-source "Sync Now" links
- [ ] `ProfileScreen` "Connected Apps" section shows only connected sources
- [ ] `ProfileScreen` "Connected Apps" shows the empty-state text when no source is
      connected
- [ ] `Switch` toggle calls `setShareOnProfile(uid, enabled)` from `fitnessStore`
- [ ] "Sync Now" calls `syncNow(source, uid)` from `fitnessStore`
- [ ] `SwipeCard` shows "Active today" chip badge when `shareOnProfile === true` AND
      `updatedAt` is within last 24 h
- [ ] `SwipeCard` does not show "Active today" badge when `shareOnProfile` is false,
      `todayStats` is absent, or `updatedAt` is null or stale
- [ ] All new i18n keys added to `en.json`, `my.json`, `zh.json`, `ta.json`
- [ ] No hardcoded strings in any component — all text through `t()`
- [ ] No inline styles in any modified or created file — all styles in
      `StyleSheet.create({})`
- [ ] All colors, spacing, and typography from `constants/theme` — no hardcoded values
- [ ] All imports use `@/` alias — no relative paths
- [ ] Zero `any` usage across all created and modified files
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`,
`store/chatStore.ts`, `store/subscriptionStore.ts`, `services/firebase/config.ts`,
`services/firebase/auth.ts`, `services/firebase/realtime.ts`, `services/healthKit.ts`,
`services/googleFit.ts`, `services/strava.ts`, `hooks/useAppleHealth.ts`,
`hooks/useGoogleFit.ts`, `types/user.ts`, `types/fitness.ts`, `types/subscription.ts`,
`constants/`, `firestore.rules`, `functions/`

---

## Commit

```
git commit -m "task-63: fitness activity display — TodayActivityCard, FullProfileModal, ProfileScreen, SwipeCard active-today badge"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2D - Task 63] - YYYY-MM-DD

### Completed

- Task 63: Fitness activity display on profiles
- TodayActivityCard: new named-export presentational component — steps, calories, distance
  row, latest workout row, source label, last-updated relative timestamp
- FullProfileModal: "Today's Activity" section added after "What You Have in Common";
  gated on shareOnProfile === true AND updatedAt within 24 h
- ProfileScreen: "Today's Activity" card always visible for own user; "Connected Apps"
  section with share toggle and per-source Sync Now links
- SwipeCard: "Active today" chip badge derived inline from UserProfile.fitnessTracking;
  shown when shareOnProfile === true AND updatedAt within 24 h
- i18n: fitness.activity.* and fitness.connectedApps.* keys added to all 4 language files

### Files Created / Modified

- components/profile/TodayActivityCard.tsx: created — named export, no store imports,
  steps/calories/distance/workout/source/last-updated display
- components/discovery/FullProfileModal.tsx: Today's Activity section added with full
  share-gate logic
- app/profile/ProfileScreen.tsx: TodayActivityCard + Connected Apps section with share
  toggle and Sync Now
- components/discovery/SwipeCard.tsx: isActiveTodayVisible flag + Active today badge
- i18n/en.json: fitness.activity.* and fitness.connectedApps.* added
- i18n/my.json, zh.json, ta.json: same keys mirrored with English placeholders

### Architecture Decisions

- [Decisions made during implementation]

### Known Issues / Deferred

- [Any intentionally incomplete items]

### Next Up

- Task 64: Connected Apps Settings Screen (app/settings/ConnectedAppsScreen.tsx — full
  connect/disconnect/sync UI per platform, share toggle, navigation from SettingsScreen)
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

Medium
