# CODEX PROMPT — Task 42
# Push Notification Registration + Deep Link Handling

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1F in progress. Task 41 is complete. Relevant existing files:

- `store/authStore.ts` — `user` (FirebaseUser | null), `isAuthenticated`, `hasCompletedOnboarding`; `initialise()` wires `onAuthStateChanged`
- `store/toastStore.ts` — `showToast(message, type)` imperative singleton; usable outside React context
- `components/ui/Toast.tsx` — rendered in App.tsx above NavigationContainer
- `components/ui/LoadingOverlay.tsx` — modal-based overlay
- `components/ui/ErrorBoundary.tsx` — class component, outermost wrapper in App.tsx
- `App.tsx` — provider order: ErrorBoundary → GestureHandlerRootView → SafeAreaProvider → Toast + NavigationContainer → RootNavigator
- `app/navigation/RootNavigator.tsx` — reads `isAuthenticated` + `hasCompletedOnboarding` from authStore; renders AuthNavigator or MainTabNavigator
- `app/navigation/MainTabNavigator.tsx` — bottom tabs: Discover, Matches, Profile, Settings
- `store/matchStore.ts` — `subscribeToMatches()`, `matches: MatchWithProfile[]`
- `store/chatStore.ts` — `subscribeToChat(matchId)`, `messages`
- `services/firebase/firestore.ts` — `updateUserProfile(uid, partial)` exists; used here to save `expoPushToken`
- `expo-notifications` — installed in Task 02
- `i18n/en.json` — `notifications.*` keys need seeding (detailed below)

**Important — what already exists from Task 38 (Settings):**
- `services/notifications.ts` was partially created in Task 38 with a permission-request helper used by the Settings notifications toggle. Task 42 **extends** that file — it does not replace it. Read the existing file before writing.

---

## Task 42 — Push Notification Registration

**Files to create:**
- `hooks/useNotifications.ts`

**Files to modify:**
- `services/notifications.ts` — extend with full registration + send helpers
- `App.tsx` — call `useNotifications()` at root
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `notifications.*` keys

**Do NOT create a new Cloud Function in this task.** `onNewMessage` (Task 33) already sends push notifications server-side. This task is purely the **client-side** registration, token persistence, and incoming notification handling.

---

### `services/notifications.ts` — Extend

Read the existing file first. Preserve any existing exports. Add or replace the following:

```typescript
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/services/firebase/config'

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Requests push notification permission and returns the Expo push token.
 * Returns null if permission denied or device is a simulator.
 *
 * Call this once after the user is authenticated and has completed onboarding.
 * The token is saved to Firestore users/{uid}.expoPushToken.
 */
export const registerForPushNotifications = async (
  userId: string
): Promise<string | null> => {
  // Physical device check — simulators cannot receive push notifications
  const isDevice = await _isPhysicalDevice()
  if (!isDevice) {
    console.warn('[Notifications] Push notifications require a physical device.')
    return null
  }

  // Android: create notification channel (required for Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
    })
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    return null
  }

  // Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync()
  const token = tokenData.data

  // Persist to Firestore — field name must match ARCHITECT.md schema: expoPushToken
  await updateDoc(doc(db, 'users', userId), {
    expoPushToken: token,
  })

  return token
}

/**
 * Clears the expoPushToken from Firestore on logout.
 * Prevents push notifications being delivered after sign-out.
 */
export const unregisterPushNotifications = async (
  userId: string
): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), {
    expoPushToken: null,
  })
}

// Internal helper — expo-device is not installed; use Constants instead
const _isPhysicalDevice = async (): Promise<boolean> => {
  const Constants = await import('expo-constants')
  // isDevice is true on physical devices, false on simulators/emulators
  return Constants.default.isDevice === true
}
```

**Note on `expo-constants`:** It is included with Expo SDK and does not need a separate install.

---

### `hooks/useNotifications.ts`

This hook is called **once** at the app root (`App.tsx`). It handles:

1. Registration — runs once after auth + onboarding are complete
2. Foreground notification listener — shows in-app toast
3. Response listener — deep links on notification tap

```typescript
import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import type { Subscription } from 'expo-notifications'
import { useNavigation } from '@react-navigation/native'
import type { NavigationContainerRef } from '@react-navigation/native'
import { useAuthStore } from '@/store/authStore'
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from '@/services/notifications'
import { showToast } from '@/store/toastStore'
import { useTranslation } from 'react-i18next'
import type { MainTabParamList } from '@/app/navigation/MainTabNavigator'
import type { RootStackParamList } from '@/app/navigation/RootNavigator'

/**
 * Push notification payload shape sent by onNewMessage and onSwipeCreated
 * Cloud Functions. Must match the `data` field in those functions exactly.
 */
interface NotificationData {
  type: 'message' | 'match'
  matchId?: string
  senderId?: string
}

/**
 * useNotifications — call once in App.tsx.
 *
 * Registers for push on auth+onboarding completion.
 * Handles foreground toast and tap-to-navigate deep links.
 * Cleans up all listeners on unmount.
 */
export const useNotifications = (
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>>
): void => {
  const { t } = useTranslation()
  const { user, isAuthenticated, hasCompletedOnboarding } = useAuthStore()

  const notificationListener = useRef<Subscription | null>(null)
  const responseListener = useRef<Subscription | null>(null)
  const hasRegistered = useRef(false)

  // --- 1. Registration ---
  useEffect(() => {
    if (!isAuthenticated || !hasCompletedOnboarding || !user || hasRegistered.current) {
      return
    }

    hasRegistered.current = true

    registerForPushNotifications(user.uid).catch((error: unknown) => {
      // Non-fatal — user may have denied permission; proceed silently
      console.warn('[Notifications] Registration failed:', error)
    })

    // Cleanup: clear token on logout
    return () => {
      if (user) {
        unregisterPushNotifications(user.uid).catch(() => {
          // Best-effort cleanup
        })
      }
    }
  }, [isAuthenticated, hasCompletedOnboarding, user])

  // --- 2. Foreground notification listener ---
  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as NotificationData

        if (data.type === 'message') {
          showToast(
            notification.request.content.body ??
              t('notifications.newMessage'),
            'info'
          )
        } else if (data.type === 'match') {
          showToast(
            notification.request.content.body ??
              t('notifications.newMatch'),
            'success'
          )
        }
      })

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        )
      }
    }
  }, [t])

  // --- 3. Tap response → deep link ---
  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data =
          response.notification.request.content.data as NotificationData

        if (!navigationRef.current) return

        if (data.type === 'message' && data.matchId) {
          // Navigate to chat for the relevant match
          navigationRef.current.navigate('MainTabs', {
            screen: 'Matches',
          } as never)
          // Give the navigator a tick to mount before pushing ChatScreen
          setTimeout(() => {
            navigationRef.current?.navigate('Chat' as never, {
              matchId: data.matchId,
            } as never)
          }, 100)
        } else if (data.type === 'match') {
          // Navigate to Matches tab
          navigationRef.current.navigate('MainTabs', {
            screen: 'Matches',
          } as never)
        }
      })

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(
          responseListener.current
        )
      }
    }
  }, [navigationRef])

  // --- 4. Handle notification that launched the app from quit state ---
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || !navigationRef.current) return

      const data =
        response.notification.request.content.data as NotificationData

      if (data.type === 'message' && data.matchId) {
        setTimeout(() => {
          navigationRef.current?.navigate('Chat' as never, {
            matchId: data.matchId,
          } as never)
        }, 500) // wait for navigator to be ready
      }
    })
  }, [navigationRef])
}
```

---

### `App.tsx` — Update

`useNotifications` requires a `NavigationContainerRef` so it can imperatively navigate on notification tap. This means `App.tsx` must:

1. Create a `navigationRef` with `useRef` and pass it to both `NavigationContainer` and `useNotifications`
2. Call `useNotifications(navigationRef)` in a child component of `SafeAreaProvider` (hooks cannot be called before JSX returns)

The cleanest pattern is a thin `AppRoot` inner component:

```tsx
// App.tsx — revised structure

import React, { useRef } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import type { NavigationContainerRef } from '@react-navigation/native'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Toast } from '@/components/ui/Toast'
import { RootNavigator } from '@/app/navigation/RootNavigator'
import { useNotifications } from '@/hooks/useNotifications'
import type { RootStackParamList } from '@/app/navigation/RootNavigator'
import '@/i18n'

// Inner component — hooks live here so they are inside all providers
const AppRoot = (): React.JSX.Element => {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)

  useNotifications(navigationRef)

  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigator />
    </NavigationContainer>
  )
}

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Toast />
          <AppRoot />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
```

**Critical:** `GestureHandlerRootView` remains the outermost wrapper inside `ErrorBoundary`. Do not reorder providers.

If `RootStackParamList` does not yet export a `'MainTabs'` route (it should from Task 08), add it. The type must include:
```typescript
export type RootStackParamList = {
  Auth: undefined
  MainTabs: undefined   // ← confirm this exists; add if missing
  Onboarding: undefined
}
```

---

### i18n — Add `notifications.*` Keys

Add these keys to **all four** language files (`en.json`, `my.json`, `zh.json`, `ta.json`). Use the English values as placeholders in non-English files.

```json
"notifications": {
  "newMessage": "You have a new message",
  "newMatch": "You have a new match!",
  "permissionDenied": "Enable notifications in Settings to get match and message alerts",
  "permissionDeniedTitle": "Notifications Disabled"
}
```

---

## Architecture Notes for Codex

### 1. Physical device check
`expo-notifications` push tokens require a physical device. Simulator/emulator runs will skip registration silently (console.warn only — not an error toast). Do not show an error to the user when running on a simulator.

### 2. Token field name
The Firestore field **must** be `expoPushToken` — this is what `onNewMessage` (Cloud Function, Task 33) reads. Any other field name will break push delivery. Cross-check against ARCHITECT.md user schema.

### 3. Logout token cleanup
When the user logs out (via `authStore.logout()`), `unregisterPushNotifications` should be called to null out the token in Firestore. The existing `logout()` in `authStore.ts` should call this. Add the call there if it does not already exist — but only null the token, do not add unrelated logic.

### 4. Navigation ref pattern
`useNotifications` receives `navigationRef` as a parameter rather than calling `useNavigation()`. This is intentional — the hook is called from `AppRoot` which is above the navigator's provider scope where `useNavigation()` would throw. The ref is safe to pass because `NavigationContainer` accepts it via the `ref` prop.

### 5. Deep link timing
The `setTimeout` delays for cold-start deep links (100ms for `message`, 500ms for quit-state) are acceptable pragmatic solutions for navigator readiness. Do not replace with complex navigator state listeners for Phase 1.

### 6. `setNotificationHandler` placement
`Notifications.setNotificationHandler(...)` is called at **module scope** in `services/notifications.ts` (top-level, outside any function). This ensures it is registered before any notification can arrive, regardless of component mount order.

### 7. No new Cloud Function
This task is client-only. `onNewMessage` (Task 33) handles server-side push dispatch. Do not create or modify any Cloud Function in `functions/src/`.

---

## Acceptance Criteria

- [ ] `services/notifications.ts` exports `registerForPushNotifications(userId)` and `unregisterPushNotifications(userId)`
- [ ] `registerForPushNotifications` requests permission, gets Expo push token, writes it to `users/{userId}.expoPushToken` in Firestore
- [ ] On simulators/emulators, registration is skipped silently (console.warn, no error toast)
- [ ] Android notification channel `'default'` created with max importance
- [ ] `useNotifications(navigationRef)` hook created in `hooks/useNotifications.ts`
- [ ] Hook called from `AppRoot` inner component in `App.tsx` with `navigationRef`
- [ ] Foreground notifications (type: `'message'`) show info toast with notification body
- [ ] Foreground notifications (type: `'match'`) show success toast with notification body
- [ ] Tapping a `'message'` notification navigates to Matches tab and pushes ChatScreen with `matchId`
- [ ] Tapping a `'match'` notification navigates to Matches tab
- [ ] Cold-start (quit state) `'message'` notification deep links correctly after navigator is ready
- [ ] All notification listeners cleaned up on unmount (no memory leaks)
- [ ] `expoPushToken` field nulled in Firestore on logout
- [ ] `notifications.*` i18n keys added to all 4 language files
- [ ] Provider order in `App.tsx` unchanged: ErrorBoundary → GestureHandlerRootView → SafeAreaProvider → Toast + AppRoot(NavigationContainer)
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Zero `any` types
- [ ] No hardcoded strings — all toast messages use `t()`

## Do Not Touch
`functions/src/`, `store/authStore.ts` (except adding `unregisterPushNotifications` call in `logout()` if missing), `store/toastStore.ts`, `components/ui/Toast.tsx`, `components/ui/LoadingOverlay.tsx`, `components/ui/ErrorBoundary.tsx`, `firestore.rules`, `firestore.indexes.json`, all onboarding screens, all discovery/swipe components, all chat components

## Commit
`git commit -m "task-42: push notification registration and deep link handling"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1F — Task 42] — YYYY-MM-DD

### Completed

- Task 42: Push notification registration and deep link handling
- registerForPushNotifications() saves expoPushToken to Firestore on first auth + onboarding completion
- unregisterPushNotifications() nulls token on logout (prevents post-logout push delivery)
- useNotifications() hook wires foreground toast display and tap-to-navigate deep links
- App.tsx refactored with AppRoot inner component to satisfy hook-above-navigator constraint
- NavigationContainerRef passed into useNotifications for imperative navigation on notification tap
- Cold-start (quit state) notification response handled via getLastNotificationResponseAsync

### Files Created / Modified

- services/notifications.ts: extended with registerForPushNotifications, unregisterPushNotifications, setNotificationHandler at module scope
- hooks/useNotifications.ts: registration effect, foreground listener, response listener, cold-start handler
- App.tsx: AppRoot inner component, navigationRef, useNotifications() call
- store/authStore.ts: unregisterPushNotifications() call added to logout() if not already present
- i18n/en.json, my.json, zh.json, ta.json: notifications.* keys added

### Architecture Decisions

- useNotifications receives navigationRef param (not useNavigation hook) — hook called above navigator provider scope
- setNotificationHandler at module scope in notifications.ts — registered before any notification arrives
- Physical device check via expo-constants Constants.isDevice — simulator runs skip silently
- setTimeout delays (100ms/500ms) for deep link navigation timing — pragmatic for Phase 1
- expoPushToken nulled on logout via Admin SDK — prevents ghost notifications post sign-out

### Known Issues / Deferred

- Granular notification preference toggles (matches vs messages) stored in AsyncStorage (Task 38) are not yet wired to suppress specific notification types client-side — Cloud Function sends all; client-side filtering deferred to Phase 2
- Notification badge count reset on app open deferred to Phase 2
- Background fetch / background notification handling (iOS background modes) deferred to Phase 2

### Next Up

- Task 43: Biometric authentication (useBiometric hook, BiometricPrompt screen)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 43 prompt.

---

## Reasoning Level
Medium
