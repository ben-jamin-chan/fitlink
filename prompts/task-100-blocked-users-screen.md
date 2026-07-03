# Codex Prompt — Task 100: Blocked Users Screen

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 92 must have written `/blocked/{uid}/{targetId}` collection rules — verify `firestore.rules` has a rule covering `/blocked/{uid}/{targetId}` that allows the authenticated user to read and delete their own blocked entries.
- Task 99 must have modified `app/settings/SettingsScreen.tsx` — verify the file exists and contains the Danger Zone section with the Delete Account row already wired. Do **not** touch that row.
- Task 99 must have modified `app/navigation/MainTabNavigator.tsx` — verify the file exists and already includes `DeleteAccountScreen` in the Settings stack. You will append `BlockedUsersScreen` to the same stack; do not reorder or remove existing entries.

If any listed dependency is absent: output a `<!-- DEPENDENCY ERROR -->` block at the top of your response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: [describe what is absent]
  Cannot proceed. Re-run [task] before this task.
-->
```

---

## Context

The `/blocked/{userId}/{blockedUserId}` subcollection has been written by the unmatch/block flow since Phase 1/2. Each document under that path represents a user the authenticated user has blocked. No schema changes are needed — this task is purely a read UI over an existing collection.

**`app/settings/SettingsScreen.tsx`** — modified in Task 99. The Danger Zone section and the Delete Account row were wired in that task. You are adding a "Blocked Users" row to the **Privacy section** only. Do not touch the Danger Zone section, the delete-account navigation, or any other existing row.

**`app/navigation/MainTabNavigator.tsx`** — modified in Task 99, which added `DeleteAccountScreen` to the Settings stack. You will append `BlockedUsersScreen` to the same stack. Use `append` semantics — never rewrite the navigator or reorder existing screen entries.

**`store/profileStore.ts`** — provides `profileStore.profile.uid` for the authenticated user ID. Do not modify this store.

**`services/firebase/config.ts`** — already exports `db` (Firestore client). Use it for Firestore reads and deletes in this screen. Do not create a new Firebase initialisation.

**`components/ui/`** — existing primitives. Use `LoadingOverlay` for async loading states, consistent with the rest of the settings screens.

**Blocked user document shape** (per Phase 1/2 implementation): the documents under `/blocked/{uid}/{blockedId}` do not need to contain any fields beyond their existence — the blocked user's identity is the document ID (`blockedId`). Read the user's display info (`firstName`, `photos`) from `/users/{blockedId}` after fetching the blocked list.

**Architecture boundary:** This screen performs client-side Firestore reads and deletes only. There is no Cloud Function for unblocking. The unblock operation is a direct `deleteDoc` on `/blocked/{uid}/{blockedId}`. Firestore security rules must already permit this (the authenticated user deleting their own blocked entries) — do not add a Cloud Function for this.

**`app/settings/BlockedUsersScreen.tsx` does not yet exist.** Create it.

---

## Task 100 — Blocked Users Screen

**Files to create:**
- `app/settings/BlockedUsersScreen.tsx`

**Files to modify:**
- `app/settings/SettingsScreen.tsx` — add "Blocked Users" row to the Privacy section only
- `app/navigation/MainTabNavigator.tsx` — append `BlockedUsersScreen` to the Settings stack
- `i18n/en.json` — add `settings.blocked.*` keys
- `i18n/my.json` — mirror keys (English placeholders)
- `i18n/zh.json` — mirror keys (English placeholders)
- `i18n/ta.json` — mirror keys (English placeholders)

---

### `app/settings/BlockedUsersScreen.tsx`

This is the Blocked Users settings screen. It loads the authenticated user's blocked list from Firestore, fetches display info for each blocked user, and allows the user to unblock anyone. It is a default-exported screen component (React Navigation requirement).

```typescript
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
} from 'firebase/firestore'
import { useProfileStore } from '@/store/profileStore'
import { db } from '@/services/firebase/config'
import { colors, spacing, typography } from '@/constants/theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockedEntry {
  blockedId: string
  firstName: string
  photoUrl: string | null
  isDeleted: boolean
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BlockedUsersScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const uid = useProfileStore((s) => s.profile?.uid)

  const [entries, setEntries] = useState<BlockedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Load blocked list on mount
  // -------------------------------------------------------------------------

  const loadBlockedUsers = useCallback(async (): Promise<void> => {
    if (!uid) return
    setLoading(true)
    try {
      const blockedSnap = await getDocs(collection(db, 'blocked', uid, 'users'))
      const blockedIds = blockedSnap.docs.map((d) => d.id)

      // Fetch display info for each blocked user in parallel; handle deleted accounts
      const resolved = await Promise.allSettled(
        blockedIds.map(async (blockedId): Promise<BlockedEntry> => {
          const userSnap = await getDoc(doc(db, 'users', blockedId))
          if (!userSnap.exists()) {
            return { blockedId, firstName: '', photoUrl: null, isDeleted: true }
          }
          const data = userSnap.data()
          return {
            blockedId,
            firstName: typeof data.firstName === 'string' ? data.firstName : '',
            photoUrl:
              Array.isArray(data.photos) && typeof data.photos[0] === 'string'
                ? data.photos[0]
                : null,
            isDeleted: false,
          }
        }),
      )

      const built: BlockedEntry[] = resolved
        .filter(
          (r): r is PromiseFulfilledResult<BlockedEntry> => r.status === 'fulfilled',
        )
        .map((r) => r.value)

      setEntries(built)
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    void loadBlockedUsers()
  }, [loadBlockedUsers])

  // -------------------------------------------------------------------------
  // Unblock handler
  // -------------------------------------------------------------------------

  const handleUnblock = useCallback(
    (entry: BlockedEntry): void => {
      Alert.alert(
        t('settings.blocked.confirmUnblock.title'),
        entry.isDeleted
          ? t('settings.blocked.confirmUnblock.messageDeleted')
          : t('settings.blocked.confirmUnblock.message', {
              name: entry.firstName,
            }),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('settings.blocked.unblock'),
            style: 'destructive',
            onPress: async () => {
              if (!uid) return
              setUnblockingId(entry.blockedId)
              try {
                await deleteDoc(doc(db, 'blocked', uid, 'users', entry.blockedId))
                setEntries((prev) =>
                  prev.filter((e) => e.blockedId !== entry.blockedId),
                )
              } catch {
                Alert.alert(
                  t('errors.generic.title'),
                  t('errors.generic.message'),
                )
              } finally {
                setUnblockingId(null)
              }
            },
          },
        ],
      )
    },
    [uid, t],
  )

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BlockedEntry>): React.JSX.Element => {
      const isUnblocking = unblockingId === item.blockedId
      const displayName = item.isDeleted
        ? t('settings.blocked.deletedUser')
        : item.firstName

      return (
        <View style={styles.row}>
          <View style={styles.avatar}>
            {item.photoUrl && !item.isDeleted ? (
              <Image
                source={{ uri: item.photoUrl }}
                style={styles.avatarImage}
                accessibilityLabel={displayName}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {item.isDeleted ? '?' : (item.firstName[0] ?? '?')}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.unblockButton,
              pressed && styles.unblockButtonPressed,
            ]}
            onPress={() => handleUnblock(item)}
            disabled={isUnblocking}
            accessibilityRole="button"
            accessibilityLabel={t('settings.blocked.unblock')}
          >
            {isUnblocking ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />
            ) : (
              <Text style={styles.unblockText}>
                {t('settings.blocked.unblock')}
              </Text>
            )}
          </Pressable>
        </View>
      )
    },
    [unblockingId, handleUnblock, t],
  )

  const keyExtractor = useCallback(
    (item: BlockedEntry): string => item.blockedId,
    [],
  )

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.centred, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={entries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={
          entries.length === 0 ? styles.emptyContainer : styles.listContent
        }
        onRefresh={loadBlockedUsers}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Text style={styles.emptyTitle}>
              {t('settings.blocked.empty.title')}
            </Text>
            <Text style={styles.emptySubtitle}>
              {t('settings.blocked.empty.subtitle')}
            </Text>
          </View>
        }
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const AVATAR_SIZE = 52

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  } as ViewStyle,
  listContent: {
    paddingTop: spacing.sm,
  } as ViewStyle,
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  emptyInner: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  } as ViewStyle,
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
    marginBottom: spacing.xs,
    textAlign: 'center',
  } as TextStyle,
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
  } as TextStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  } as ViewStyle,
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    marginRight: spacing.md,
  } as ViewStyle,
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  } as ImageStyle,
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  avatarInitial: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.gray[500],
  } as TextStyle,
  name: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[800],
    marginRight: spacing.sm,
  } as TextStyle,
  unblockButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  unblockButtonPressed: {
    opacity: 0.6,
  } as ViewStyle,
  unblockText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  } as TextStyle,
})
```

---

### `app/settings/SettingsScreen.tsx` — Update (Privacy section only)

> Only modify the Privacy section to add a "Blocked Users" navigation row. Do not touch the Danger Zone section, the Delete Account row, or any other section.

```typescript
// Add import at the top of the file (with other navigation imports):
import type { StackNavigationProp } from '@react-navigation/stack'
// (If StackNavigationProp is already imported, do not add a duplicate.)

// In the Privacy section of the settings list, add a row:
// This row should appear under any existing privacy rows (e.g. incognito, paused)
// and above the Danger Zone section.

// Example row shape — match the existing row component/pattern used in this file:
{
  label: t('settings.blocked.title'),
  onPress: () => navigation.navigate('BlockedUsers'),
  // use the same row component and chevron style as the other navigable rows in this file
}
```

> Do not alter the delete-account row, the Danger Zone section header, or any other row.
> Match the exact row component pattern already used by the other settings navigable rows
> (chevron icon, same padding, same typography). Do not inline styles.

---

### `app/navigation/MainTabNavigator.tsx` — Update (append only)

> Task 99 added `DeleteAccountScreen` to the Settings stack. Append `BlockedUsersScreen`
> to the same stack. Do not reorder, remove, or rewrite any existing screen entries.

```typescript
// Add import:
import BlockedUsersScreen from '@/app/settings/BlockedUsersScreen'

// Inside the Settings Stack.Navigator, append after the existing DeleteAccountScreen entry:
<Stack.Screen
  name="BlockedUsers"
  component={BlockedUsersScreen}
  options={{ title: t('settings.blocked.title') }}
/>
```

> Do not touch any other screen registrations in this navigator.

---

### i18n files — Update (all 4 files)

Add the following keys. Use the English values as placeholders in `my.json`, `zh.json`, and `ta.json`. Never remove or rename existing keys.

**`i18n/en.json`** — add under `settings`:
```json
"blocked": {
  "title": "Blocked Users",
  "empty": {
    "title": "No blocked users",
    "subtitle": "Users you block will appear here"
  },
  "unblock": "Unblock",
  "deletedUser": "Deleted User",
  "confirmUnblock": {
    "title": "Unblock user?",
    "message": "{{name}} will be able to see your profile and contact you again.",
    "messageDeleted": "This user's account has been deleted. Removing them from your blocked list."
  }
}
```

**`i18n/my.json`**, **`i18n/zh.json`**, **`i18n/ta.json`** — mirror the exact same structure with the English values as placeholders.

---

## Important Architecture Notes for Codex

1. **Subcollection path.** The blocked list lives at `/blocked/{uid}/users/{blockedId}`. The middle segment is `users`, not `blocked` — match the path the unmatch flow writes to. If your pre-task dependency check reveals the actual subcollection name differs (e.g. the segment is named differently), use whatever path is present in the codebase. Do not assume — verify.

2. **`Promise.allSettled` for user profile fetches.** Blocked users may have deleted their accounts. Use `Promise.allSettled`, not `Promise.all`, so a single missing user document does not abort the entire list load. Fulfilled entries with `isDeleted: true` are rendered with a placeholder avatar and the `t('settings.blocked.deletedUser')` label.

3. **Optimistic removal.** After a successful `deleteDoc`, remove the entry from local `entries` state immediately. Do not re-fetch the full list from Firestore on every unblock — this avoids unnecessary reads and keeps the UI snappy.

4. **No Firestore writes from this screen.** Unblocking is a `deleteDoc` on the blocked subcollection document. No `updateDoc`, `setDoc`, or batch write is needed.

5. **No Cloud Function.** Unblocking goes through a direct client `deleteDoc`. The Firestore rules must already permit the authenticated user to delete their own `/blocked/{uid}/users/{blockedId}` documents (this was part of the unmatch flow's rules). Do not introduce a callable for this operation.

6. **`common.cancel` i18n key.** The Alert cancel button uses `t('common.cancel')`. This key should already exist in all 4 i18n files from Phase 1/2. Do not add it again; do not hardcode the string.

7. **Navigator title.** The screen title in the stack navigator options reads from `t('settings.blocked.title')`. The `t()` call requires `useTranslation()` — use the navigator's existing pattern for translated titles (e.g. a function passed to `options`, or the pattern already established by other stack screens in `MainTabNavigator.tsx`). Match whatever pattern is already in use.

8. **Default export.** `BlockedUsersScreen` must be a default export (React Navigation screen requirement). This is an exception to the named-export-only rule in CONVENTIONS.md Section 4, consistent with all other screen components.

---

## Rollback Protocol

If `npx tsc --noEmit` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Making an assumption about the actual subcollection path that cannot be verified from the codebase, OR
- Changing the navigator in a way that breaks existing screen registrations

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the file, the error, and what information is needed
4. Stop. Do not attempt a workaround. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] Zero `any` types introduced
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in any client file
- [ ] Zero inline styles — `style={{ }}` does not appear in any JSX
- [ ] Zero relative imports — `../../` does not appear anywhere in touched files
- [ ] All new user-facing strings added to all 4 i18n files (en, my, zh, ta)
- [ ] All new constants use values from `constants/theme` — no hardcoded hex, px, or font sizes

**Firebase / Security**
- [ ] No server-only fields written from the client
- [ ] No Firestore writes other than `deleteDoc` on the blocked subcollection

**Architecture**
- [ ] `BlockedUsersScreen` uses `Promise.allSettled` for user profile fetches (not `Promise.all`)
- [ ] Optimistic removal: `setEntries` filters out the unblocked entry locally after `deleteDoc` succeeds — no full re-fetch
- [ ] `BlockedUsersScreen` is a default export
- [ ] `MainTabNavigator.tsx` still contains all screens it had before this task — none removed or reordered
- [ ] `SettingsScreen.tsx` Danger Zone section and Delete Account row are unchanged
- [ ] No Cloud Function introduced or called for the unblock action

**Platform**
- [ ] Ask: "Would this break on Android?" — answer must be No
- [ ] Ask: "Would this break on iOS?" — answer must be No

---

## Acceptance Criteria

- [ ] `app/settings/BlockedUsersScreen.tsx` created and registered in the Settings stack under the name `'BlockedUsers'`
- [ ] Screen loads the authenticated user's `/blocked/{uid}/users` subcollection on mount
- [ ] Each blocked user is displayed with their first name and primary photo (or placeholder avatar if account deleted or photo absent)
- [ ] Deleted accounts render as "Deleted User" with a placeholder avatar — they do not crash the list
- [ ] "Unblock" button shows a confirmation Alert before acting
- [ ] Successful unblock removes the entry from the list immediately without a full re-fetch
- [ ] Pull-to-refresh re-fetches the list from Firestore
- [ ] Empty state shows `settings.blocked.empty.title` and `settings.blocked.empty.subtitle`
- [ ] Loading state shows an `ActivityIndicator` while the initial fetch is in progress
- [ ] "Blocked Users" row added to the Privacy section of `SettingsScreen.tsx`; navigates to `BlockedUsersScreen`
- [ ] Danger Zone section and Delete Account row in `SettingsScreen.tsx` are unchanged
- [ ] All new i18n keys present in all 4 language files
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`functions/src/` (any file), `firestore.rules`, `firestore.indexes.json`, `store/profileStore.ts` (beyond reading `uid`), `services/firebase/config.ts`, `types/`, `constants/`, `App.tsx`, `store/authStore.ts`, `app/settings/DeleteAccountScreen.tsx`, `app/settings/PremiumScreen.tsx` — the Danger Zone section and Delete Account navigation row in `app/settings/SettingsScreen.tsx` must remain exactly as Task 99 left them.

---

## Commit

```
git commit -m "task-100: blocked users screen"
```

---

## After This Session

Update `CHANGELOG.md` using this template:

```
## [Phase 4D — Task 100] — YYYY-MM-DD

### Completed

- Task 100: Blocked Users screen
- [any other key deliverable]

### Files Created

- app/settings/BlockedUsersScreen.tsx: [brief description]

### Files Modified

- app/settings/SettingsScreen.tsx: [what changed]
- app/navigation/MainTabNavigator.tsx: [what changed]
- i18n/en.json: added settings.blocked.* keys
- i18n/my.json: mirrored settings.blocked.* keys (English placeholders)
- i18n/zh.json: mirrored settings.blocked.* keys (English placeholders)
- i18n/ta.json: mirrored settings.blocked.* keys (English placeholders)

### Architecture Decisions

- [Any non-obvious choice, e.g. the actual subcollection path used if it differed from /blocked/{uid}/users/{blockedId}]
- [Whether Promise.allSettled was used and why]

### Conflict Risks Introduced

- app/settings/SettingsScreen.tsx modified — [note if any upcoming task also touches it]
- app/navigation/MainTabNavigator.tsx modified — [note if any upcoming task also touches it]
- None — if no further conflicts are anticipated

### Known Issues / Deferred

- [Anything intentionally left incomplete]

### Verification

- Pre-task dependency verified: [list what was checked]
- `npx tsc --noEmit` passes
- [Any focused scan results]

### Next Up

- Task 101: Safety Center screen
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 101 prompt.

---

## Reasoning Level

Medium
