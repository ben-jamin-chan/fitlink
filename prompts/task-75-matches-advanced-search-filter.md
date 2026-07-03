# CODEX PROMPT — Task 75: Matches Advanced Search & Filter

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3A of [APP_NAME]. Tasks 01–74 are complete. The codebase is in a clean, tsc-passing state
after Task 74 (Profile Boost).

Existing files Codex must read before writing any code:

- `app/matches/MatchesScreen.tsx` — two-tab screen (Matches grid + Messages list); already imports
  `PremiumBadge` and stubs the search bar behind a premium paywall tap (Task 54 deferred item);
  the paywall tap currently navigates to `PremiumScreen` — this task replaces that stub with real
  filter/search UI
- `store/matchStore.ts` — `matches: MatchWithProfile[]` already populated via Firestore real-time
  listener; `subscribeToMatches()`, `unsubscribeFromMatches()`, `unmatch()`, `markAsRead()` already
  exported; Task 75 must not change any of these existing actions
- `types/match.ts` — `Match` and `MatchWithProfile` interfaces already defined; `MatchWithProfile`
  carries the other user's full `UserProfile`
- `types/user.ts` — `UserProfile` already has `activities: string[]`, `fitnessLevel`, `lastActive:
  Timestamp`; Phase 3 optional fields (`incognito`, `boost`, etc.) are already present
- `components/ui/PremiumBadge.tsx` — renders `plus` / `pro` tier badge; already used in
  `MatchesScreen`
- `components/ui/Button.tsx` — `primary` / `outline` / `ghost` variants; `loading` and `disabled`
  props; already used throughout the app
- `components/ui/Input.tsx` — `label`, `placeholder`, `error`, `secureTextEntry`,
  `keyboardType` props; already used in auth screens
- `store/subscriptionStore.ts` — `isPremium(): boolean` already exported; use this to gate the
  feature
- `app/navigation/MainTabNavigator.tsx` — `MatchesStackParamList` (or equivalent) already typed;
  Codex must confirm the exact param-list name before adding new screens
- `constants/theme.ts` — re-exports `colors`, `spacing`, `typography`; all style values must come
  from here
- `i18n/en.json` — translation keys already exist under `matches.*`; Task 75 must add new keys
  under `matches.search.*` and `matches.filter.*` to all 4 language files

**Architectural boundary — client-side filtering only.** The full `MatchWithProfile[]` array is
already in `matchStore`. All search and filter logic runs locally against that in-memory array.
**Do not add any new Firestore queries, Cloud Functions, or network calls for this feature.**
Filtering is pure TypeScript over already-fetched data.

**Architectural boundary — no matchStore changes to existing state or actions.** The filter/search
state lives entirely in the new `useMatchFilter` hook. `matchStore` is read-only in this task.

---

## Task 75 — Matches Advanced Search & Filter

**Files to create:**
- `hooks/useMatchFilter.ts`
- `components/matches/MatchFilterSheet.tsx`

**Files to modify:**
- `app/matches/MatchesScreen.tsx` — replace premium-paywall stub with real search bar and filter
  sheet; wire `useMatchFilter`
- `i18n/en.json` — add `matches.search.*` and `matches.filter.*` keys
- `i18n/my.json` — mirror new keys with English placeholders
- `i18n/zh.json` — mirror new keys with English placeholders
- `i18n/ta.json` — mirror new keys with English placeholders

---

### `hooks/useMatchFilter.ts`

> Pure filtering hook. Encapsulates all search and filter state so `MatchesScreen` stays
> presentational. Returns a filtered slice of `matchStore.matches` based on the current
> filter criteria. No Firestore reads. No side effects.

```typescript
import { useState, useMemo, useCallback } from 'react'

import { useMatchStore } from '@/store/matchStore'
import type { MatchWithProfile } from '@/types/match'

// ─── Filter shape ────────────────────────────────────────────────────────────

export interface MatchFilterState {
  query: string                          // free-text name search
  activities: string[]                   // selected activity chips (empty = any)
  recentlyActiveOnly: boolean            // true = only matches active in last 24 h
}

const DEFAULT_FILTER: MatchFilterState = {
  query: '',
  activities: [],
  recentlyActiveOnly: false,
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseMatchFilterReturn {
  filter: MatchFilterState
  setQuery: (query: string) => void
  toggleActivity: (activity: string) => void
  setRecentlyActiveOnly: (value: boolean) => void
  resetFilter: () => void
  isFilterActive: boolean
  filteredMatches: MatchWithProfile[]
  activeFilterCount: number
}

export const useMatchFilter = (): UseMatchFilterReturn => {
  const matches = useMatchStore((s) => s.matches)

  const [filter, setFilter] = useState<MatchFilterState>(DEFAULT_FILTER)

  // ── Setters ──────────────────────────────────────────────────────────────

  const setQuery = useCallback((query: string): void => {
    setFilter((prev) => ({ ...prev, query }))
  }, [])

  const toggleActivity = useCallback((activity: string): void => {
    setFilter((prev) => {
      const exists = prev.activities.includes(activity)
      const activities = exists
        ? prev.activities.filter((a) => a !== activity)
        : [...prev.activities, activity]
      return { ...prev, activities }
    })
  }, [])

  const setRecentlyActiveOnly = useCallback((value: boolean): void => {
    setFilter((prev) => ({ ...prev, recentlyActiveOnly: value }))
  }, [])

  const resetFilter = useCallback((): void => {
    setFilter(DEFAULT_FILTER)
  }, [])

  // ── Derived values ────────────────────────────────────────────────────────

  const isFilterActive = useMemo(
    () =>
      filter.query.trim().length > 0 ||
      filter.activities.length > 0 ||
      filter.recentlyActiveOnly,
    [filter],
  )

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filter.activities.length > 0) count += 1
    if (filter.recentlyActiveOnly) count += 1
    return count
    // query does not count toward the badge — it is always visible in the search bar
  }, [filter])

  const filteredMatches = useMemo((): MatchWithProfile[] => {
    const trimmedQuery = filter.query.trim().toLowerCase()
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000

    return matches.filter((m) => {
      const profile = m.otherUser

      // Name search
      if (
        trimmedQuery.length > 0 &&
        !profile.firstName.toLowerCase().includes(trimmedQuery)
      ) {
        return false
      }

      // Activity filter — match must share at least one selected activity
      if (filter.activities.length > 0) {
        const hasOverlap = filter.activities.some((a) =>
          profile.activities.includes(a),
        )
        if (!hasOverlap) return false
      }

      // Recently active filter — lastActive within last 24 hours
      if (filter.recentlyActiveOnly) {
        const lastActiveMs = profile.lastActive.toMillis()
        if (lastActiveMs < twentyFourHoursAgo) return false
      }

      return true
    })
  }, [matches, filter])

  return {
    filter,
    setQuery,
    toggleActivity,
    setRecentlyActiveOnly,
    resetFilter,
    isFilterActive,
    filteredMatches,
    activeFilterCount,
  }
}
```

---

### `components/matches/MatchFilterSheet.tsx`

> Bottom-sheet-style modal that lets the user configure activity chips and the recently-active
> toggle. Presented from `MatchesScreen` when the filter button is tapped. The caller owns the
> filter state via `useMatchFilter`; this component is purely presentational and calls the
> provided callbacks.
>
> Uses React Native `Modal` (not a third-party sheet) for zero new dependencies. Slides up via a
> simple `translateY` `Animated.Value` so it feels native without adding Reanimated complexity to
> a non-critical modal.
>
> The activity list matches the canonical list from PRD.md Section 5.2.3 — 16 activities in the
> same order as onboarding.

```typescript
import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useTranslation } from 'react-i18next'

import { colors, spacing, typography } from '@/constants/theme'
import { Button } from '@/components/ui/Button'
import type { MatchFilterState } from '@/hooks/useMatchFilter'

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ACTIVITIES: string[] = [
  'Gym',
  'Running',
  'Cycling',
  'Swimming',
  'Yoga',
  'Hiking',
  'CrossFit',
  'Boxing',
  'Dancing',
  'Badminton',
  'Football',
  'Basketball',
  'Tennis',
  'Martial Arts',
  'Rock Climbing',
  'Pilates',
]

// ─── Props ───────────────────────────────────────────────────────────────────

interface MatchFilterSheetProps {
  visible: boolean
  filter: MatchFilterState
  onToggleActivity: (activity: string) => void
  onSetRecentlyActiveOnly: (value: boolean) => void
  onReset: () => void
  onClose: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export const MatchFilterSheet = ({
  visible,
  filter,
  onToggleActivity,
  onSetRecentlyActiveOnly,
  onReset,
  onClose,
}: MatchFilterSheetProps): React.JSX.Element => {
  const { t } = useTranslation()
  const slideAnim = useRef(new Animated.Value(300)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 150,
      }).start()
    } else {
      slideAnim.setValue(300)
    }
  }, [visible, slideAnim])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('matches.filter.title')}</Text>
          <TouchableOpacity onPress={onReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.resetLabel}>{t('matches.filter.reset')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Recently Active Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextGroup}>
              <Text style={styles.toggleLabel}>
                {t('matches.filter.recentlyActive.label')}
              </Text>
              <Text style={styles.toggleSubtitle}>
                {t('matches.filter.recentlyActive.subtitle')}
              </Text>
            </View>
            <Switch
              value={filter.recentlyActiveOnly}
              onValueChange={onSetRecentlyActiveOnly}
              trackColor={{ false: colors.gray[200], true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {/* Activity Chips */}
          <Text style={styles.sectionLabel}>
            {t('matches.filter.activities.label')}
          </Text>
          <View style={styles.chipWrap}>
            {ALL_ACTIVITIES.map((activity) => {
              const selected = filter.activities.includes(activity)
              return (
                <TouchableOpacity
                  key={activity}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => onToggleActivity(activity)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[styles.chipLabel, selected && styles.chipLabelSelected]}
                  >
                    {activity}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        {/* Done button */}
        <View style={styles.footer}>
          <Button variant="primary" label={t('matches.filter.done')} onPress={onClose} />
        </View>
      </Animated.View>
    </Modal>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
  } as TextStyle,
  resetLabel: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  scroll: {
    flexGrow: 0,
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  } as ViewStyle,
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  } as ViewStyle,
  toggleTextGroup: {
    flex: 1,
    marginRight: spacing.md,
  } as ViewStyle,
  toggleLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray[800],
  } as TextStyle,
  toggleSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginTop: 2,
  } as TextStyle,
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.gray[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  } as TextStyle,
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  } as ViewStyle,
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gray[400],
    backgroundColor: colors.surface,
  } as ViewStyle,
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  } as ViewStyle,
  chipLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray[800],
  } as TextStyle,
  chipLabelSelected: {
    color: colors.white,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  } as ViewStyle,
})
```

---

### `app/matches/MatchesScreen.tsx` — Update

> Replace the existing premium-paywall stub for search/filter with the real search bar and filter
> sheet. Wire `useMatchFilter`. Pass `filteredMatches` into both the Matches grid and the Messages
> list instead of `matchStore.matches` directly.
>
> Do not touch: the existing `subscribeToMatches` / `unsubscribeFromMatches` lifecycle calls, the
> tab-switching logic, the `MatchCard` grid, the `MessageListItem` list, the unmatch swipe action,
> or the existing `StyleSheet` entries — only add new ones.

```typescript
// ── New imports to add (in correct section order per CONVENTIONS.md §5) ──────

// Third-party:
import { Ionicons } from '@expo/vector-icons'

// Internal — hooks:
import { useMatchFilter } from '@/hooks/useMatchFilter'

// Internal — components:
import { MatchFilterSheet } from '@/components/matches/MatchFilterSheet'

// ── New state inside the component ───────────────────────────────────────────

const isPremiumUser = useSubscriptionStore((s) => s.isPremium())

const [filterSheetVisible, setFilterSheetVisible] = useState(false)

const {
  filter,
  setQuery,
  toggleActivity,
  setRecentlyActiveOnly,
  resetFilter,
  isFilterActive,
  filteredMatches,
  activeFilterCount,
} = useMatchFilter()

// ── Replace the existing search-bar / filter stub in the JSX ─────────────────
//
// REMOVE this existing stub block (the PremiumBadge paywall tap that navigates
// to PremiumScreen):
//
//   <TouchableOpacity onPress={() => navigation.navigate('Premium')}>
//     <View style={styles.searchBarStub}>
//       <PremiumBadge tier="plus" />
//       <Text style={styles.searchBarPlaceholder}>
//         {t('matches.search.premiumOnly')}
//       </Text>
//     </View>
//   </TouchableOpacity>
//
// REPLACE with:

{isPremiumUser ? (
  <View style={styles.searchRow}>
    <View style={styles.searchInputWrap}>
      <Ionicons name="search-outline" size={18} color={colors.gray[400]} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder={t('matches.search.placeholder')}
        placeholderTextColor={colors.gray[400]}
        value={filter.query}
        onChangeText={setQuery}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
    <TouchableOpacity
      style={[styles.filterButton, isFilterActive && styles.filterButtonActive]}
      onPress={() => setFilterSheetVisible(true)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name="options-outline"
        size={20}
        color={isFilterActive ? colors.white : colors.gray[600]}
      />
      {activeFilterCount > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeLabel}>{activeFilterCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  </View>
) : (
  <TouchableOpacity
    style={styles.searchRowLocked}
    onPress={() => navigation.navigate('Premium')}
    activeOpacity={0.8}
  >
    <Ionicons name="search-outline" size={18} color={colors.gray[400]} />
    <Text style={styles.searchLockedLabel}>{t('matches.search.premiumOnly')}</Text>
    <PremiumBadge tier="plus" />
  </TouchableOpacity>
)}

// ── Render MatchFilterSheet just before the closing root View ─────────────────

<MatchFilterSheet
  visible={filterSheetVisible}
  filter={filter}
  onToggleActivity={toggleActivity}
  onSetRecentlyActiveOnly={setRecentlyActiveOnly}
  onReset={resetFilter}
  onClose={() => setFilterSheetVisible(false)}
/>

// ── Pass filteredMatches to both list renderers ───────────────────────────────
//
// In the Matches tab FlatList:
//   data={filteredMatches}            ← was: data={matches}
//
// In the Messages tab FlatList (messages tab only shows items with messages):
//   data={filteredMatches.filter((m) => m.lastMessage != null)}
//                                      ← was: data={matches.filter((m) => m.lastMessage != null)}
//
// When filteredMatches is empty but matches is not (i.e. filter is active with
// no results), show a dedicated empty state instead of the "no matches yet" one:
//
//   {filteredMatches.length === 0 && matches.length > 0 && isFilterActive && (
//     <View style={styles.emptyState}>
//       <Text style={styles.emptyTitle}>{t('matches.search.noResults')}</Text>
//       <Text style={styles.emptySubtitle}>{t('matches.search.noResultsHint')}</Text>
//       <Button variant="outline" label={t('matches.filter.reset')} onPress={resetFilter} />
//     </View>
//   )}

// ── New StyleSheet entries to add (do not remove any existing entries) ────────

searchRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  gap: spacing.sm,
} as ViewStyle,
searchInputWrap: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: colors.gray[100],
  borderRadius: 10,
  paddingHorizontal: spacing.sm,
  height: 40,
} as ViewStyle,
searchIcon: {
  marginRight: spacing.xs,
} as ViewStyle,
searchInput: {
  flex: 1,
  fontSize: typography.sizes.md,
  color: colors.gray[800],
  height: 40,
} as TextStyle,
filterButton: {
  width: 40,
  height: 40,
  borderRadius: 10,
  backgroundColor: colors.gray[100],
  alignItems: 'center',
  justifyContent: 'center',
} as ViewStyle,
filterButtonActive: {
  backgroundColor: colors.primary,
} as ViewStyle,
filterBadge: {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: colors.danger,
  alignItems: 'center',
  justifyContent: 'center',
} as ViewStyle,
filterBadgeLabel: {
  fontSize: 9,
  fontWeight: typography.weights.bold,
  color: colors.white,
} as TextStyle,
searchRowLocked: {
  flexDirection: 'row',
  alignItems: 'center',
  marginHorizontal: spacing.md,
  marginVertical: spacing.sm,
  backgroundColor: colors.gray[100],
  borderRadius: 10,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.sm,
} as ViewStyle,
searchLockedLabel: {
  flex: 1,
  fontSize: typography.sizes.md,
  color: colors.gray[400],
} as TextStyle,
```

> `TextInput` must be imported from `react-native` — add it to the existing React Native import
> block. `useSubscriptionStore` must be imported from `@/store/subscriptionStore`. Do not add any
> new third-party packages.

---

### `i18n/en.json` — Update

> Add the following keys. Insert them under the existing `matches` namespace. Do not remove or
> rename any existing key.

```json
{
  "matches": {
    "search": {
      "placeholder": "Search by name",
      "premiumOnly": "Search matches — Premium",
      "noResults": "No matches found",
      "noResultsHint": "Try clearing your filters or search term"
    },
    "filter": {
      "title": "Filter Matches",
      "reset": "Reset",
      "done": "Done",
      "recentlyActive": {
        "label": "Recently Active",
        "subtitle": "Active in the last 24 hours"
      },
      "activities": {
        "label": "Shared Activities"
      }
    }
  }
}
```

---

### `i18n/my.json` — Update

> Mirror the same key paths with English placeholder values (identical to `en.json` above).

---

### `i18n/zh.json` — Update

> Mirror the same key paths with English placeholder values (identical to `en.json` above).

---

### `i18n/ta.json` — Update

> Mirror the same key paths with English placeholder values (identical to `en.json` above).

---

## Important Architecture Notes for Codex

1. **No Firestore reads in this task.** All filtering is pure in-memory computation over
   `matchStore.matches`. Do not add `.where()` queries, `getDocs()` calls, or any Firebase read
   operations. The `useMatchFilter` hook is a `useMemo` chain only.

2. **`matchStore` is read-only in this task.** Do not modify `matchStore.ts` — no new state
   fields, no new actions, no new listeners. The hook reads `matches` via the existing Zustand
   selector pattern only.

3. **`filteredMatches` replaces `matches` in both FlatList `data` props.** After this task,
   both the Matches grid and the Messages list must render `filteredMatches`, not `matches`
   directly. The Messages list additionally filters for `m.lastMessage != null` as before —
   apply that filter on top of `filteredMatches`, not on `matches`.

4. **`TextInput` is from `react-native` — no new package.** Add it to the existing React Native
   import group in `MatchesScreen.tsx`. Do not install any search or input library.

5. **Filter sheet uses `React Native Modal`, not a third-party sheet.** Zero new package
   dependencies in `package.json` for this task.

6. **The empty-state for filter-with-no-results is distinct from the baseline empty-state.**
   The baseline "No Matches Yet" state (when `matches.length === 0`) must remain unchanged. The
   new filter-empty state only renders when `filteredMatches.length === 0 && matches.length > 0
   && isFilterActive`.

7. **`isPremiumUser` comes from `subscriptionStore.isPremium()`.** Import
   `useSubscriptionStore` from `@/store/subscriptionStore`. Do not read from
   `profileStore.profile.premium.active` directly — always go through the store helper.

8. **Activity chip list is hardcoded in `MatchFilterSheet`.** The `ALL_ACTIVITIES` constant
   inside `MatchFilterSheet.tsx` mirrors the canonical 16-activity list from onboarding (PRD §5.2.3)
   and must stay in that file — do not import it from a shared constants file (that file does not
   exist for activities).

---

## Acceptance Criteria

- [ ] `hooks/useMatchFilter.ts` created and exports `useMatchFilter` and `MatchFilterState` as
      named exports
- [ ] `components/matches/MatchFilterSheet.tsx` created and exports `MatchFilterSheet` as a named
      export
- [ ] `MatchFilterSheet` renders a `Modal` with activity chips for all 16 canonical activities and
      a recently-active `Switch`
- [ ] Selecting activity chips in the sheet narrows `filteredMatches` to only those matches whose
      `otherUser.activities` overlaps the selected set
- [ ] The recently-active toggle filters to matches whose `otherUser.lastActive` is within the
      last 24 hours
- [ ] The name search field filters by case-insensitive partial match on `otherUser.firstName`
- [ ] `resetFilter()` clears all three filter criteria and `isFilterActive` returns `false`
- [ ] `activeFilterCount` returns the number of non-query active filters (activities + recently
      active only; query is not counted)
- [ ] Premium users see the real search bar and filter button; non-premium users see the locked
      row that navigates to `PremiumScreen` on tap
- [ ] Filter button shows a red badge with `activeFilterCount` when `activeFilterCount > 0`
- [ ] Both FlatLists (Matches grid and Messages list) render `filteredMatches` (not the raw
      `matchStore.matches`)
- [ ] Filter-with-no-results empty state renders when `filteredMatches.length === 0 &&
      matches.length > 0 && isFilterActive`; the baseline "No Matches Yet" state is unaffected
- [ ] `i18n/en.json` has all new `matches.search.*` and `matches.filter.*` keys
- [ ] All 4 language files (`en`, `my`, `zh`, `ta`) contain the new keys (English placeholders for
      `my`, `zh`, `ta`)
- [ ] Zero hardcoded English strings in JSX — all text through `t()`
- [ ] Zero inline `style={{ }}` — all styles in `StyleSheet.create({})`
- [ ] Zero hardcoded colour, spacing, or typography values — all from `constants/theme`
- [ ] All imports use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`store/matchStore.ts`, `store/authStore.ts`, `store/subscriptionStore.ts`,
`services/firebase/config.ts`, `services/firebase/firestore.ts`, `types/match.ts`,
`types/user.ts`, `components/ui/Button.tsx`, `components/ui/Input.tsx`,
`components/ui/PremiumBadge.tsx`, `constants/`, `firestore.rules`,
`firestore.indexes.json`, `App.tsx`, `app/navigation/MainTabNavigator.tsx`

---

## Commit

```
git commit -m "task-75: matches advanced search and filter for premium users"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3A - Task 75] - YYYY-MM-DD

### Completed

- Task 75: Matches Advanced Search & Filter
- useMatchFilter: custom hook encapsulating name search, activity chip filter, and
  recently-active toggle over in-memory matchStore.matches; no Firestore reads
- MatchFilterSheet: bottom-sheet Modal with 16 activity chips, recently-active Switch,
  reset and done controls
- MatchesScreen: premium-paywall stub replaced with real search bar and filter button;
  non-premium users see locked row navigating to PremiumScreen; both FlatLists now
  render filteredMatches; filter-with-no-results empty state added
- matches.search.* and matches.filter.* i18n keys added to all 4 language files

### Files Created / Modified

- hooks/useMatchFilter.ts: created — MatchFilterState, useMatchFilter hook
- components/matches/MatchFilterSheet.tsx: created — bottom sheet modal for filter controls
- app/matches/MatchesScreen.tsx: search bar and filter sheet wired; filteredMatches
  passed to both FlatLists; filter empty-state added
- i18n/en.json, my.json, zh.json, ta.json: matches.search.* and matches.filter.* keys added

### Architecture Decisions

- [Describe any decisions made during implementation]

### Known Issues / Deferred

- None

### Next Up

- Task 76: [next task description]
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

Medium
