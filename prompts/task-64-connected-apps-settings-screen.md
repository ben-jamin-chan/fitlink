# Codex Prompt — Task 64: Connected Apps Settings Screen

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2D fitness integrations (Tasks 59–63) are fully complete. Every service, hook, store, and UI surface needed by this task already exists:

- `store/fitnessStore.ts` — `useFitnessStore` with `connectSource`, `disconnectSource`, `syncNow`, `setShareOnProfile`, `fetchTodayStats`; `connections: Record<FitnessSource, FitnessConnectionStatus>` and `shareOnProfile: boolean` in state; both persisted via AsyncStorage
- `services/healthKit.ts` — `requestAppleHealthPermissions`, `fetchAppleHealthTodayStats`, `setAppleHealthConnected`; every exported function is guarded with `Platform.OS === 'ios'`
- `hooks/useAppleHealth.ts` — `useAppleHealth(uid?)` returns `{ isConnected, todayStats, sync(), disconnect() }`; AppState foreground auto-sync; `syncInFlightRef` re-entrant guard
- `services/googleFit.ts` — same shape as `healthKit.ts` but guarded with `Platform.OS === 'android'`; exports `requestGoogleFitPermissions`, `fetchGoogleFitTodayStats`, `setGoogleFitConnected`
- `hooks/useGoogleFit.ts` — `useGoogleFit(uid?)` returns `{ isConnected, todayStats, sync(), disconnect() }`
- `services/strava.ts` — `connectStrava()`, `syncStrava()`, `disconnectStrava()`; OAuth browser flow via `expo-web-browser`
- `types/fitness.ts` — `FitnessSource` (`'appleHealth' | 'googleFit' | 'strava'`), `FitnessConnectionStatus`, `TodayStats`, `WorkoutSession`
- `types/subscription.ts` — full Phase 2 type set; `FitnessSourceConnection`, `StravaConnection`, `FitnessTracking` interfaces
- `app/settings/SettingsScreen.tsx` — has a "Connected Apps" row that currently calls a stub (Alert or navigation placeholder added in Task 63); this task replaces it with `navigation.navigate('ConnectedApps')`
- `app/navigation/MainTabNavigator.tsx` — `SettingsStackNavigator` is a Stack containing `SettingsScreen` and `DeleteAccountScreen`; `ConnectedApps` must be added to this stack
- `components/ui/LoadingOverlay.tsx` — `visible: boolean`, optional `message?: string`
- `components/settings/SettingsRow.tsx` — toggle, navigate, destructive, info variants; accepts `onPress`, `value`, `label`, `sublabel`
- `components/settings/SettingsSection.tsx` — section wrapper with optional title and `danger` styling
- `i18n/en.json` — `fitness.appleHealth.*`, `fitness.googleFit.*`, `fitness.strava.*`, `fitness.connectedApps.*`, `fitness.activity.*` keys already present from Tasks 61–63
- `store/authStore.ts` — `uid: string | null` available from `useAuthStore`
- `constants/theme.ts` — `colors`, `spacing`, `typography` re-exports

**Critical architectural boundary: this screen must never call `healthKit.*` or `googleFit.*` service functions directly.** All Apple Health and Google Fit operations go through the hooks (`useAppleHealth`, `useGoogleFit`) and `fitnessStore` actions. Those hooks own the `syncInFlightRef` re-entrant guard. Calling service functions directly would bypass that guard and duplicate logic.

**Platform guards are mandatory on every conditional render.** `Platform.OS === 'ios'` for Apple Health, `Platform.OS === 'android'` for Google Fit. A missing guard crashes the app on the other platform because the underlying native libraries are not compiled in.

---

## Task 64 — Connected Apps Settings Screen

**Files to create:**
- `app/settings/ConnectedAppsScreen.tsx`

**Files to modify:**
- `app/navigation/MainTabNavigator.tsx` — add `ConnectedApps` to `SettingsStackParamList` and register the screen in `SettingsStackNavigator`
- `app/settings/SettingsScreen.tsx` — replace the Connected Apps row stub with `navigation.navigate('ConnectedApps')`
- `i18n/en.json` — add `settings.connectedApps.*` keys (navigation title and share-section strings)
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — mirror the same keys with English placeholder values

---

### `app/settings/ConnectedAppsScreen.tsx`

This is a screen-level component (default export per CONVENTIONS.md Section 4). It renders the full connect / disconnect / sync UI for all three fitness sources, followed by the share toggle section. Reads state from `useAppleHealth`, `useGoogleFit`, and `useFitnessStore`. All mutations go through those hooks and the store.

A per-source `isSyncing` local `useState<boolean>` value drives the brief `ActivityIndicator` spinner on "Sync Now" for the duration of the async call. These are local UI state only — not store state.

Strava disconnect must show a confirmation `Alert` before calling `disconnectStrava()` from `services/strava.ts` AND `fitnessStore.disconnectSource('strava', uid)`. The service call clears Firestore; the store action updates local Zustand state so the UI reflects the change immediately.

The share settings section at the bottom always renders regardless of which sources are connected.

```typescript
import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import type { Timestamp } from 'firebase/firestore'

import { useFitnessStore } from '@/store/fitnessStore'
import { useAuthStore } from '@/store/authStore'
import { useAppleHealth } from '@/hooks/useAppleHealth'
import { useGoogleFit } from '@/hooks/useGoogleFit'
import { connectStrava, syncStrava, disconnectStrava } from '@/services/strava'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { SettingsRow } from '@/components/settings/SettingsRow'
import { colors, spacing, typography } from '@/constants/theme'

// ─── Relative-time helper (display only — no Firestore writes) ────────────────

const formatLastSynced = (
  ts: Timestamp | null | undefined,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string => {
  if (!ts) return t('fitness.connectedApps.neverSynced')
  const diffMin = Math.floor((Date.now() - ts.toMillis()) / 60_000)
  if (diffMin < 1) return t('fitness.connectedApps.justNow')
  if (diffMin < 60) return t('fitness.connectedApps.minutesAgo', { n: diffMin })
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return t('fitness.connectedApps.hoursAgo', { n: diffHr })
  return t('fitness.connectedApps.daysAgo', { n: Math.floor(diffHr / 24) })
}

// ─── Reusable Sync Now button ─────────────────────────────────────────────────

interface SyncButtonProps {
  onPress: () => void
  isSyncing: boolean
  label: string
}

const SyncButton = ({ onPress, isSyncing, label }: SyncButtonProps): React.JSX.Element => (
  <TouchableOpacity style={styles.syncButton} onPress={onPress} disabled={isSyncing}>
    {isSyncing ? (
      <ActivityIndicator size="small" color={colors.primary} />
    ) : (
      <Text style={styles.syncButtonText}>{label}</Text>
    )}
  </TouchableOpacity>
)

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ConnectedAppsScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const uid = useAuthStore((s) => s.uid) ?? ''

  const shareOnProfile = useFitnessStore((s) => s.shareOnProfile)
  const stravaConnection = useFitnessStore((s) => s.connections.strava)
  const appleHealthConnection = useFitnessStore((s) => s.connections.appleHealth)
  const googleFitConnection = useFitnessStore((s) => s.connections.googleFit)
  const setShareOnProfile = useFitnessStore((s) => s.setShareOnProfile)
  const disconnectSource = useFitnessStore((s) => s.disconnectSource)

  // Platform-specific hooks — each returns early on the wrong platform
  const appleHealth = useAppleHealth(uid)
  const googleFit = useGoogleFit(uid)

  // Per-source sync spinners (local UI state — not store state)
  const [isSyncingApple, setIsSyncingApple] = useState<boolean>(false)
  const [isSyncingGoogleFit, setIsSyncingGoogleFit] = useState<boolean>(false)
  const [isSyncingStrava, setIsSyncingStrava] = useState<boolean>(false)
  const [isConnectingStrava, setIsConnectingStrava] = useState<boolean>(false)

  // ── Apple Health handlers (iOS only) ────────────────────────────────────────
  const handleAppleHealthToggle = useCallback(async (enabled: boolean): Promise<void> => {
    if (enabled) {
      await appleHealth.sync()
    } else {
      appleHealth.disconnect()
    }
  }, [appleHealth])

  const handleAppleHealthSync = useCallback(async (): Promise<void> => {
    if (isSyncingApple) return
    setIsSyncingApple(true)
    try {
      await appleHealth.sync()
    } finally {
      setIsSyncingApple(false)
    }
  }, [appleHealth, isSyncingApple])

  // ── Google Fit handlers (Android only) ──────────────────────────────────────
  const handleGoogleFitToggle = useCallback(async (enabled: boolean): Promise<void> => {
    if (enabled) {
      await googleFit.sync()
    } else {
      googleFit.disconnect()
    }
  }, [googleFit])

  const handleGoogleFitSync = useCallback(async (): Promise<void> => {
    if (isSyncingGoogleFit) return
    setIsSyncingGoogleFit(true)
    try {
      await googleFit.sync()
    } finally {
      setIsSyncingGoogleFit(false)
    }
  }, [googleFit, isSyncingGoogleFit])

  // ── Strava handlers (both platforms) ────────────────────────────────────────
  const handleStravaConnect = useCallback(async (): Promise<void> => {
    if (isConnectingStrava) return
    setIsConnectingStrava(true)
    try {
      await connectStrava()
    } catch {
      Alert.alert(t('fitness.strava.connectErrorTitle'), t('fitness.strava.connectErrorMessage'))
    } finally {
      setIsConnectingStrava(false)
    }
  }, [isConnectingStrava, t])

  const handleStravaDisconnect = useCallback((): void => {
    Alert.alert(
      t('fitness.strava.disconnectTitle'),
      t('fitness.strava.disconnectMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('fitness.strava.disconnectConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectStrava()
              disconnectSource('strava', uid)
            } catch {
              Alert.alert(
                t('fitness.strava.disconnectErrorTitle'),
                t('fitness.strava.disconnectErrorMessage'),
              )
            }
          },
        },
      ],
    )
  }, [disconnectSource, uid, t])

  const handleStravaSync = useCallback(async (): Promise<void> => {
    if (isSyncingStrava) return
    setIsSyncingStrava(true)
    try {
      await syncStrava()
    } catch {
      Alert.alert(
        t('fitness.connectedApps.syncErrorTitle'),
        t('fitness.connectedApps.syncErrorMessage'),
      )
    } finally {
      setIsSyncingStrava(false)
    }
  }, [isSyncingStrava, t])

  // ── Share toggle ──────────────────────────────────────────────────────────────
  const handleShareToggle = useCallback((enabled: boolean): void => {
    setShareOnProfile(enabled, uid)
  }, [setShareOnProfile, uid])

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Apple Health — iOS only */}
      {Platform.OS === 'ios' && (
        <SettingsSection title={t('fitness.appleHealth.title')}>
          <SettingsRow
            label={t('fitness.appleHealth.title')}
            sublabel={
              appleHealth.isConnected
                ? formatLastSynced(appleHealthConnection?.lastSync, t)
                : t('fitness.connectedApps.notConnected')
            }
            value={appleHealth.isConnected}
            onPress={() => { void handleAppleHealthToggle(!appleHealth.isConnected) }}
            variant="toggle"
          />
          {appleHealth.isConnected && (
            <View style={styles.actionRow}>
              <SyncButton
                onPress={() => { void handleAppleHealthSync() }}
                isSyncing={isSyncingApple}
                label={t('fitness.connectedApps.syncNow')}
              />
            </View>
          )}
        </SettingsSection>
      )}

      {/* Google Fit — Android only */}
      {Platform.OS === 'android' && (
        <SettingsSection title={t('fitness.googleFit.title')}>
          <SettingsRow
            label={t('fitness.googleFit.title')}
            sublabel={
              googleFit.isConnected
                ? formatLastSynced(googleFitConnection?.lastSync, t)
                : t('fitness.connectedApps.notConnected')
            }
            value={googleFit.isConnected}
            onPress={() => { void handleGoogleFitToggle(!googleFit.isConnected) }}
            variant="toggle"
          />
          {googleFit.isConnected && (
            <View style={styles.actionRow}>
              <SyncButton
                onPress={() => { void handleGoogleFitSync() }}
                isSyncing={isSyncingGoogleFit}
                label={t('fitness.connectedApps.syncNow')}
              />
            </View>
          )}
        </SettingsSection>
      )}

      {/* Strava — both platforms */}
      <SettingsSection title={t('fitness.strava.title')}>
        {stravaConnection?.connected ? (
          <>
            <View style={styles.stravaConnectedRow}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.primary}
                style={styles.stravaCheckIcon}
              />
              <Text style={styles.stravaConnectedLabel}>{t('fitness.strava.connected')}</Text>
              <Text style={styles.lastSyncedText}>
                {formatLastSynced(stravaConnection.lastSync, t)}
              </Text>
            </View>
            <View style={styles.stravaActionRow}>
              <SyncButton
                onPress={() => { void handleStravaSync() }}
                isSyncing={isSyncingStrava}
                label={t('fitness.connectedApps.syncNow')}
              />
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={handleStravaDisconnect}
              >
                <Text style={styles.disconnectButtonText}>{t('fitness.strava.disconnect')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.connectRow}>
            <View style={styles.connectInfo}>
              <Text style={styles.connectLabel}>{t('fitness.strava.title')}</Text>
              <Text style={styles.connectSublabel}>{t('fitness.connectedApps.notConnected')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.connectButton, isConnectingStrava && styles.connectButtonDisabled]}
              onPress={() => { void handleStravaConnect() }}
              disabled={isConnectingStrava}
            >
              {isConnectingStrava ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.connectButtonText}>{t('fitness.strava.connect')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SettingsSection>

      {/* Share Settings — always visible */}
      <SettingsSection title={t('settings.connectedApps.shareSection')}>
        <SettingsRow
          label={t('settings.connectedApps.shareLabel')}
          sublabel={t('settings.connectedApps.shareHelper')}
          value={shareOnProfile}
          onPress={() => handleShareToggle(!shareOnProfile)}
          variant="toggle"
        />
      </SettingsSection>

    </ScrollView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  content: {
    paddingBottom: spacing.xxl,
  } as ViewStyle,
  actionRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'flex-start',
  } as ViewStyle,
  syncButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 88,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  syncButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  } as TextStyle,
  stravaConnectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  } as ViewStyle,
  stravaCheckIcon: {
    marginRight: spacing.xs,
  } as ViewStyle,
  stravaConnectedLabel: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray[800],
  } as TextStyle,
  lastSyncedText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
  } as TextStyle,
  stravaActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  } as ViewStyle,
  disconnectButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    minWidth: 88,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  disconnectButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.danger,
  } as TextStyle,
  connectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  } as ViewStyle,
  connectInfo: {
    flex: 1,
    marginRight: spacing.sm,
  } as ViewStyle,
  connectLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray[800],
  } as TextStyle,
  connectSublabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginTop: 2,
  } as TextStyle,
  connectButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    minWidth: 88,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  connectButtonDisabled: {
    opacity: 0.6,
  } as ViewStyle,
  connectButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  } as TextStyle,
})
```

---

### `app/navigation/MainTabNavigator.tsx` — Update

Add `ConnectedApps` to `SettingsStackParamList` and register `ConnectedAppsScreen` in `SettingsStackNavigator`. Do not touch any other navigators, tab definitions, or screen registrations.

```typescript
// 1. Add to imports at the top of the file:
import ConnectedAppsScreen from '@/app/settings/ConnectedAppsScreen'

// 2. Add ConnectedApps to SettingsStackParamList (alongside existing Settings and DeleteAccount):
type SettingsStackParamList = {
  Settings: undefined
  DeleteAccount: undefined
  ConnectedApps: undefined  // add this line
}

// 3. Inside SettingsStackNavigator JSX, after the existing DeleteAccount screen:
<SettingsStack.Screen
  name="ConnectedApps"
  component={ConnectedAppsScreen}
  options={{ title: t('settings.connectedApps.title') }}
/>
```

Do not touch `MainTabParamList`, tab icon definitions, `MatchesNavigator`, or any other part of this file.

---

### `app/settings/SettingsScreen.tsx` — Update

Locate the Connected Apps row. It currently has a stub `onPress` (Alert, console.log, or no-op added in Task 63). Replace only the `onPress` value. Do not touch any other row, section, style, or import in the file.

```typescript
// Replace whatever the stub onPress currently is with:
onPress={() => navigation.navigate('ConnectedApps')}
```

If `navigation` is not already declared in `SettingsScreen`, add it at the top of the component:
```typescript
import { useNavigation } from '@react-navigation/native'
// ...
const navigation = useNavigation()
```

Do not change any other part of `SettingsScreen.tsx`.

---

### `i18n/en.json` — Update

Add these four keys to the existing `settings` object. All `fitness.*` keys were already added by Tasks 61–63 — do not duplicate or replace them. Merge only:

```json
{
  "settings": {
    "connectedApps": {
      "title": "Connected Apps",
      "shareSection": "Activity Sharing",
      "shareLabel": "Show activity on profile",
      "shareHelper": "Your today's activity stats will be visible to your matches"
    }
  }
}
```

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Mirror the same four keys with English placeholder values in each file:

```json
{
  "settings": {
    "connectedApps": {
      "title": "Connected Apps",
      "shareSection": "Activity Sharing",
      "shareLabel": "Show activity on profile",
      "shareHelper": "Your today's activity stats will be visible to your matches"
    }
  }
}
```

---

## Important Architecture Notes for Codex

1. **Never import from `services/healthKit.ts` or `services/googleFit.ts` in this screen.** All Apple Health operations go through `useAppleHealth()` and all Google Fit operations go through `useGoogleFit()`. Those hooks own the `syncInFlightRef` guard. A direct service import bypasses the guard and risks concurrent sync calls.

2. **Every Apple Health JSX block must be inside `{Platform.OS === 'ios' && (...)}`. Every Google Fit JSX block must be inside `{Platform.OS === 'android' && (...)}`.** These native libraries crash on the wrong platform — there are no exceptions.

3. **Strava disconnect is two sequential calls: `disconnectStrava()` first (Firestore cleanup), then `disconnectSource('strava', uid)` (Zustand store update).** Both must be inside the same `try/catch`. Show an error `Alert` only if the combined operation fails.

4. **`isSyncingApple`, `isSyncingGoogleFit`, `isSyncingStrava`, `isConnectingStrava` are `useState<boolean>` local to this screen.** They must not be added to `fitnessStore`. They exist only to disable the button and show a spinner for the duration of the async call, then reset in the `finally` block.

5. **`formatLastSynced` uses `Date.now()` for comparison — not for any Firestore write.** Using `Date.now()` for display utilities is explicitly permitted. `new Date()` and client-side `Timestamp` construction for Firestore writes are what CONVENTIONS.md prohibits. Pass `appleHealthConnection?.lastSync`, `googleFitConnection?.lastSync`, and `stravaConnection?.lastSync` directly to `formatLastSynced` — all are typed `Timestamp | null | undefined` and the helper handles those cases gracefully.

6. **The screen title is set via `options={{ title: t('settings.connectedApps.title') }}` on the `Stack.Screen` registration in `MainTabNavigator.tsx`.** Do not set a custom header or `navigation.setOptions` inside `ConnectedAppsScreen` — the navigator owns the header.

7. **`SettingsRow` with `variant="toggle"` receives `onPress` — not a `Switch` `onValueChange` prop.** Inspect the existing `SettingsRow.tsx` props interface before wiring. Do not add a standalone `Switch` component to this screen; delegate to `SettingsRow` entirely.

8. **`gap` in `StyleSheet.create` requires React Native 0.71+ (which Expo SDK 52 satisfies).** Use it freely in row layouts. If `gap` causes a type error on a specific RN version, replace with `marginRight` on child elements.

---

## Acceptance Criteria

- [ ] `app/settings/ConnectedAppsScreen.tsx` created with a default export (screen-level per CONVENTIONS.md Section 4)
- [ ] Apple Health section renders **only** when `Platform.OS === 'ios'` — completely absent from the Android render tree
- [ ] Google Fit section renders **only** when `Platform.OS === 'android'` — completely absent from the iOS render tree
- [ ] Strava section renders on both platforms regardless of `Platform.OS`
- [ ] Apple Health toggle calls `useAppleHealth().sync()` on enable and `useAppleHealth().disconnect()` on disable — no direct `healthKit.*` or `googleFit.*` import anywhere in this file
- [ ] Google Fit toggle calls `useGoogleFit().sync()` on enable and `useGoogleFit().disconnect()` on disable
- [ ] "Sync Now" button shows `ActivityIndicator` while syncing and is `disabled`; button re-enables in the `finally` block on resolve or reject
- [ ] Strava "Connect" button calls `connectStrava()` and shows `ActivityIndicator` during the async call; `disabled` while in flight
- [ ] Strava "Disconnect" shows `Alert.alert` with cancel and destructive confirm before calling `disconnectStrava()` + `disconnectSource('strava', uid)` in the confirmed handler
- [ ] Share toggle reads `shareOnProfile` from `useFitnessStore` and calls `setShareOnProfile(!shareOnProfile, uid)` on press
- [ ] `formatLastSynced` returns the `'fitness.connectedApps.neverSynced'` translation result when `lastSync` is `null` or `undefined`; returns a relative time string otherwise
- [ ] `ConnectedApps: undefined` added to `SettingsStackParamList` in `MainTabNavigator.tsx`
- [ ] `ConnectedAppsScreen` registered as `<SettingsStack.Screen name="ConnectedApps" ... />` with `options.title` using the i18n key
- [ ] `SettingsScreen.tsx` Connected Apps row `onPress` navigates to `'ConnectedApps'` — no stub remaining
- [ ] `settings.connectedApps.title`, `shareSection`, `shareLabel`, `shareHelper` added to `en.json`, `my.json`, `zh.json`, `ta.json`
- [ ] Zero inline `style={{ }}` in JSX — all styles in `StyleSheet.create({})` at the bottom of the file
- [ ] Zero hardcoded user-facing strings in JSX — all through `t()`
- [ ] Zero `any` in the file
- [ ] All imports use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/fitnessStore.ts`, `services/healthKit.ts`, `services/googleFit.ts`, `services/strava.ts`, `hooks/useAppleHealth.ts`, `hooks/useGoogleFit.ts`, `types/fitness.ts`, `types/subscription.ts`, `types/user.ts`, `constants/`, `firestore.rules`, `functions/`, `components/profile/TodayActivityCard.tsx`, `components/discovery/SwipeCard.tsx`, `components/discovery/FullProfileModal.tsx`, `app/profile/ProfileScreen.tsx`, `store/profileStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`, `store/subscriptionStore.ts`

---

## Commit

```
git commit -m "task-64: connected apps settings screen with platform-specific fitness integrations"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2D — Task 64] — YYYY-MM-DD

### Completed

- Task 64: Connected Apps Settings Screen
- ConnectedAppsScreen: full connect/disconnect/sync UI for Apple Health (iOS only), Google Fit (Android only), Strava (both platforms); formatLastSynced relative-time helper; Strava disconnect Alert confirmation; share toggle wired to fitnessStore.setShareOnProfile
- MainTabNavigator: ConnectedApps added to SettingsStackParamList and SettingsStackNavigator
- SettingsScreen: Connected Apps row stub replaced with navigation.navigate('ConnectedApps')
- i18n: settings.connectedApps.title, shareSection, shareLabel, shareHelper added to all 4 language files

### Files Created / Modified

- app/settings/ConnectedAppsScreen.tsx: created — default export screen, platform-guarded Apple Health / Google Fit sections, Strava connect/disconnect flow, SyncButton inline component, share toggle
- app/navigation/MainTabNavigator.tsx: ConnectedApps added to SettingsStackParamList and stack
- app/settings/SettingsScreen.tsx: Connected Apps row onPress stub replaced with navigation.navigate('ConnectedApps')
- i18n/en.json: settings.connectedApps.* keys added
- i18n/my.json, zh.json, ta.json: same keys mirrored with English placeholders

### Architecture Decisions

- [Describe any non-obvious choices made during implementation]

### Known Issues / Deferred

- [Anything intentionally left incomplete]

### Next Up

- Task 65: Google Sign-In Production Flow (replace signInWithPopup with expo-auth-session, refactor to signInWithGoogleCredential in auth.ts, update LandingScreen.tsx)
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

Medium
