# Codex Prompt — Task 100: Blocked Users Screen (v2 — includes firestore.rules fix)

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 99 must have modified `app/settings/SettingsScreen.tsx` — verify the file contains the Danger Zone section with the Delete Account row already wired. Do **not** touch that row.
- Task 99 must have modified `app/navigation/MainTabNavigator.tsx` — verify the file includes `DeleteAccountScreen` in the Settings stack. You will append `BlockedUsersScreen`; do not reorder or remove existing entries.
- Verify the actual blocked subcollection path by reading `functions/src/unmatchUser.ts`. ✅ (Already confirmed from v1 run: path is `/blocked/{uid}/users/{blockedId}`.)

> **Rules dependency gap (resolved in this task):** `firestore.rules` currently has a deny-all rule on `/blocked`. This was correct when only the Admin SDK wrote these docs, but the Blocked Users screen requires client-side reads and deletes. This task explicitly adds the scoped rule alongside the screen. See "Important Architecture Notes" #1.

If the dependency on `SettingsScreen.tsx` or `MainTabNavigator.tsx` is absent: output a `<!-- DEPENDENCY ERROR -->` block, list what is missing, and do not proceed.

---

## Context

The `/blocked/{uid}/users/{blockedId}` subcollection has been written by the unmatch flow (via `functions/src/unmatchUser.ts`) since Phase 1/2. Each document under that path represents a user the authenticated user has blocked. The blocked user's identity is the document ID (`blockedId`).

**`firestore.rules`** currently has `allow read: if false; allow write: if false` for `/blocked`. This task opens up a scoped read and delete rule for the authenticated user's own blocked subcollection. The rule is additive — no existing rule is removed or loosened.

**`app/settings/SettingsScreen.tsx`** — modified in Task 99. You are adding a "Blocked Users" row to the **Privacy section** only. Do not touch the Danger Zone section or the Delete Account row.

**`app/navigation/MainTabNavigator.tsx`** — modified in Task 99. Append `BlockedUsersScreen` to the existing Settings stack. Never rewrite or reorder.

**`store/profileStore.ts`** — provides `profileStore.profile.uid`. Do not modify this store.

**`services/firebase/config.ts`** — already exports `db` (Firestore client). Use it for reads and deletes. Do not create a new Firebase initialisation.

**`app/settings/BlockedUsersScreen.tsx` does not yet exist.** Create it.

**Architecture boundary:** Unblocking is a direct client `deleteDoc`. No Cloud Function. The screen performs Firestore reads and deletes only.

---

## Task 100 — Blocked Users Screen

**Files to create:**
- `app/settings/BlockedUsersScreen.tsx`

**Files to modify:**
- `firestore.rules` — add scoped read + delete rule for `/blocked/{uid}/users/{blockedId}`
- `app/settings/SettingsScreen.tsx` — add "Blocked Users" row to Privacy section only
- `app/navigation/MainTabNavigator.tsx` — append `BlockedUsersScreen` to Settings stack
- `i18n/en.json` — add `settings.blocked.*` keys
- `i18n/my.json` — mirror keys (English placeholders)
- `i18n/zh.json` — mirror keys (English placeholders)
- `i18n/ta.json` — mirror keys (English placeholders)

---

### `firestore.rules` — Update (append scoped rule only)

> Locate the existing `/blocked/{userId}/{document=**}` match block. Replace only that block with the following. Do not touch any other rule. Do not rewrite the file.

```
// /blocked — blocked-user subcollection
// The parent doc and wildcard catch-all remain deny-all (Admin SDK writes only).
// The /users subcollection is opened for the authenticated owner: read own list,
// delete own entries (unblock). No client write (create) is permitted.
match /blocked/{userId} {
  allow read, write: if false;

  match /users/{blockedId} {
    allow read: if request.auth != null && request.auth.uid == userId;
    allow delete: if request.auth != null && request.auth.uid == userId;
    allow create, update: if false;
  }
}
```

> This replaces the single existing `/blocked/{userId}/{document=**}` deny-all block.
> If the existing rule uses a different match path structure, adapt the replacement to
> match the same outer path while adding the `users` subcollection rule inside it.
> Never broaden rules beyond what is shown above.

---

### `app/settings/BlockedUsersScreen.tsx`

Default-exported screen. Loads the authenticated user's blocked list, fetches display info for each entry, and allows the user to unblock with a confirmation dialog.

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

      // Fetch display info in parallel; handle deleted accounts gracefully
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
          : t('settings.blocked.confirmUnblock.message', { name: entry.firstName }),
        [
          { text: t('common.cancel'), style: 'cancel' },
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
                Alert.alert(t('errors.generic.title'), t('errors.generic.message'))
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
            {item.photoUrl !== null && !item.isDeleted ? (
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
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.unblockText}>{t('settings.blocked.unblock')}</Text>
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

> Add a "Blocked Users" navigation row to the Privacy section. Match the exact row component and chevron pattern used by the other navigable rows in this file. Do not touch the Danger Zone section, the Delete Account row, or any other row.

```typescript
// In the Privacy section of the settings list, add:
{
  label: t('settings.blocked.title'),
  onPress: () => navigation.navigate('BlockedUsers'),
  // Use the same navigable row component/style as other settings rows with a chevron
}
```

---

### `app/navigation/MainTabNavigator.tsx` — Update (append only)

> Append after the existing `DeleteAccountScreen` stack entry. Do not reorder or remove any existing entries.

```typescript
// Add import:
import BlockedUsersScreen from '@/app/settings/BlockedUsersScreen'

// Append to the Settings Stack.Navigator:
<Stack.Screen
  name="BlockedUsers"
  component={BlockedUsersScreen}
  options={{ title: t('settings.blocked.title') }}
/>
```

---

### i18n files — Update (all 4 files)

Add under `settings`. Use English values as placeholders in `my.json`, `zh.json`, `ta.json`. Never remove or rename existing keys.

**`i18n/en.json`:**
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

**`i18n/my.json`**, **`i18n/zh.json`**, **`i18n/ta.json`** — mirror the same structure with English values as placeholders.

---

## Important Architecture Notes for Codex

1. **`firestore.rules` change is intentional and scoped.** The existing deny-all on `/blocked` was correct when only the Admin SDK wrote to it. Opening the `/users` subcollection for owner reads and deletes is the minimum permission needed for this screen. The rule structure must be:
   - Outer `/blocked/{userId}`: still `allow read, write: if false`
   - Inner `/blocked/{userId}/users/{blockedId}`: `read` if owner; `delete` if owner; `create` and `update` still `if false`
   
   Do not open any broader path. Do not use a wildcard `{document=**}` that would also cover the `users` subcollection — the subcollection must be explicitly named.

2. **Subcollection path is `/blocked/{uid}/users/{blockedId}`.** Confirmed from `functions/src/unmatchUser.ts` in the pre-task check (v1 run). Use this exact path in all Firestore reads and the `deleteDoc` call.

3. **`Promise.allSettled` for user profile fetches.** Blocked users may have deleted their accounts. Never use `Promise.all` — a single missing `/users/{blockedId}` document must not abort the entire list load. Fulfilled entries with `isDeleted: true` render with a placeholder avatar.

4. **Optimistic removal after unblock.** After a successful `deleteDoc`, filter the entry out of local `entries` state immediately. Do not re-fetch the full list from Firestore.

5. **No Cloud Function for unblock.** Direct `deleteDoc` on the blocked subcollection document. No callable, no batch.

6. **`common.cancel` i18n key.** Already present from Phase 1/2. Do not add it again.

7. **Default export.** `BlockedUsersScreen` must be a default export — this is the CONVENTIONS.md Section 4 exception for screen components.

8. **Navigator title `t()` call.** Match whatever pattern already exists in `MainTabNavigator.tsx` for translated screen titles (some navigators use a function passed to `options`, others use a hook at the top of the navigator component). Do not introduce a new pattern.

---

## Rollback Protocol

If `npx tsc --noEmit` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Broadening the Firestore rule beyond the scoped pattern above, OR
- Changing the navigator in a way that removes or reorders existing screen registrations

**Then:**
1. Do not commit any partial changes
2. Revert all touched files to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block with the file, error, and what is needed
4. Stop. Bring the report to the Architect.

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
- [ ] `firestore.rules` change is additive only — no existing rule removed or loosened
- [ ] The `users` subcollection rule inside `/blocked` uses `request.auth.uid == userId` — owner-only
- [ ] `allow create, update: if false` is present on the `users` subcollection rule
- [ ] No server-only fields written from the client
- [ ] No Firestore writes other than `deleteDoc` on the blocked subcollection

**Architecture**
- [ ] `BlockedUsersScreen` uses `Promise.allSettled` (not `Promise.all`)
- [ ] Optimistic removal: `setEntries` filters locally after `deleteDoc` — no full re-fetch
- [ ] `BlockedUsersScreen` is a default export
- [ ] `MainTabNavigator.tsx` retains all screens from before this task — none removed or reordered
- [ ] `SettingsScreen.tsx` Danger Zone section and Delete Account row unchanged
- [ ] No Cloud Function introduced or called for unblock

**Platform**
- [ ] Ask: "Would this break on Android?" — answer must be No
- [ ] Ask: "Would this break on iOS?" — answer must be No

---

## Acceptance Criteria

- [ ] `app/settings/BlockedUsersScreen.tsx` created and registered as `'BlockedUsers'` in the Settings stack
- [ ] `firestore.rules` updated: `/blocked/{userId}/users/{blockedId}` allows owner read and delete; create/update remain denied
- [ ] Screen loads `/blocked/{uid}/users` subcollection on mount
- [ ] Each blocked user shows first name and primary photo (or placeholder avatar for deleted accounts / missing photo)
- [ ] Deleted accounts render as "Deleted User" with placeholder — no crash
- [ ] "Unblock" shows a confirmation Alert; on confirm, `deleteDoc` the subcollection document and remove the entry from local state
- [ ] Pull-to-refresh re-fetches from Firestore
- [ ] Empty state displays `settings.blocked.empty.title` and `settings.blocked.empty.subtitle`
- [ ] Loading state shows `ActivityIndicator` during initial fetch
- [ ] "Blocked Users" row added to the Privacy section of `SettingsScreen.tsx`; navigates to `BlockedUsersScreen`
- [ ] Danger Zone section and Delete Account row in `SettingsScreen.tsx` unchanged
- [ ] All `settings.blocked.*` i18n keys present in all 4 language files
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Do Not Touch

`functions/src/` (any file), `store/profileStore.ts`, `services/firebase/config.ts`, `types/`, `constants/`, `App.tsx`, `store/authStore.ts`, `app/settings/DeleteAccountScreen.tsx`, `app/settings/PremiumScreen.tsx` — the Danger Zone section and Delete Account navigation row in `app/settings/SettingsScreen.tsx` must remain exactly as Task 99 left them. `firestore.indexes.json` — no new index needed for this screen's queries.

---

## Commit

```
git commit -m "task-100: blocked users screen + firestore rules"
```

---

## After This Session

Update `CHANGELOG.md` using this template:

```
## [Phase 4D — Task 100] — YYYY-MM-DD

### Completed

- Task 100: Blocked Users screen
- firestore.rules: opened /blocked/{userId}/users/{blockedId} for owner read and delete

### Files Created

- app/settings/BlockedUsersScreen.tsx: blocked list UI with unblock confirmation and deleted-account handling

### Files Modified

- firestore.rules: added scoped owner read/delete rule for /blocked/{userId}/users subcollection
- app/settings/SettingsScreen.tsx: added Blocked Users row to Privacy section
- app/navigation/MainTabNavigator.tsx: appended BlockedUsersScreen to Settings stack
- i18n/en.json: added settings.blocked.* keys
- i18n/my.json: mirrored settings.blocked.* keys (English placeholders)
- i18n/zh.json: mirrored settings.blocked.* keys (English placeholders)
- i18n/ta.json: mirrored settings.blocked.* keys (English placeholders)

### Architecture Decisions

- firestore.rules change is additive: the outer /blocked/{userId} deny-all is preserved;
  the /users subcollection is explicitly named and opened for owner reads and deletes only.
  create and update remain denied because unmatchUser CF (Admin SDK) is the only writer.

### Conflict Risks Introduced

- firestore.rules modified — Task 106 (Phase 4 rules: admin audit & warnings) also touches
  this file; review before generating Task 106 prompt
- app/settings/SettingsScreen.tsx modified — verify before any future settings task
- app/navigation/MainTabNavigator.tsx modified — verify before any future navigation task
- None beyond the above

### Known Issues / Deferred

- [Anything intentionally left incomplete]

### Verification

- Pre-task dependency verified: SettingsScreen.tsx has Task 99 Danger Zone row
- Pre-task dependency verified: MainTabNavigator.tsx includes DeleteAccountScreen
- Pre-task dependency verified: /blocked/{uid}/users/{blockedId} path confirmed from unmatchUser.ts
- firestore.rules change confirmed additive — no existing rule removed
- `npx tsc --noEmit` passes
- [Any additional focused scan results]

### Next Up

- Task 101: Safety Center screen
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 101 prompt.
Run SECURITY_REVIEW_CHECKLIST.md against this diff before committing (firestore.rules changed).

---

## Reasoning Level

Medium

## 🔒 Security Review Required

This task modifies `firestore.rules`. Before committing, paste `SECURITY_REVIEW_CHECKLIST.md`
into a fresh Codex session with the diff attached.
