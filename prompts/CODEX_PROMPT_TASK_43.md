# CODEX PROMPT — Task 43
# Biometric Authentication (useBiometric hook + BiometricPrompt)

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1F is nearly complete. Task 42 (push notification registration) is done. Relevant existing state:

- `store/authStore.ts` — `isAuthenticated: boolean`, `user: FirebaseUser | null`, `hasCompletedOnboarding: boolean`, `logout()` calls `unregisterPushNotifications()` then `signOut()`. Persisted via `AsyncStorage`.
- `app/navigation/RootNavigator.tsx` — Root stack renders `AuthNavigator` when `!isAuthenticated`, `MainTabs` when `isAuthenticated && hasCompletedOnboarding`, and `OnboardingNavigator` when `isAuthenticated && !hasCompletedOnboarding`.
- `App.tsx` — uses `AppRoot` inner component pattern (established in Task 42). `useNotifications(navigationRef)` called inside `AppRoot`. `GestureHandlerRootView → SafeAreaProvider → Toast → NavigationContainer` provider order is locked — do not change it.
- `expo-local-authentication` — installed in Task 02.
- `@react-native-async-storage/async-storage` — installed in Task 02.
- `services/firebase/auth.ts` — `signOut()` exported.
- `components/ui/Button.tsx`, `components/ui/LoadingOverlay.tsx` — available.
- `constants/theme.ts` — `colors`, `spacing`, `typography` all exported.
- `i18n/en.json` (and MY, ZH, TA) — biometric keys not yet added; this task adds them.

**What this task builds:**
Biometric auth is an opt-in convenience feature for returning users. The flow is:

1. After a user's **first successful login** (or onboarding completion), they are prompted once: "Enable Face ID / Touch ID?"
2. Their preference is saved to `AsyncStorage`.
3. On every **subsequent cold open** (app launched from quit state, user already authenticated in persisted store), a biometric prompt is shown as a re-verification gate before entering the main app.
4. If biometric fails or is cancelled, the user is given a "Use Password" fallback that calls `logout()` and returns them to `AuthNavigator` to sign in normally.
5. If the device doesn't support biometrics, the prompt is silently skipped — the user goes straight into the app.

This task does **not** replace Firebase Auth. The persisted `isAuthenticated` state from `authStore` still gates the navigator. Biometrics are a local second-factor re-check on cold start only.

---

## Task 43 — Biometric Authentication

**Files to create:**
- `hooks/useBiometric.ts`
- `app/auth/BiometricPromptScreen.tsx`

**Files to modify:**
- `app/navigation/RootNavigator.tsx` — add `BiometricPrompt` screen to root stack, insert biometric gate logic
- `store/authStore.ts` — add `biometricVerified: boolean` state + `setBiometricVerified()` action
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `biometric.*` keys

---

### i18n keys to add

Add the following under `"biometric"` in all four translation files. Use the English values as placeholders in MY, ZH, TA:

```json
"biometric": {
  "promptTitle": "Verify It's You",
  "promptSubtitle": "Use your biometric to continue",
  "promptCancelLabel": "Use Password",
  "enableTitle": "Enable Biometric Login?",
  "enableSubtitle": "Use Face ID or Touch ID to unlock fitlink faster next time.",
  "enableConfirm": "Enable",
  "enableSkip": "Not Now",
  "fallbackTitle": "Biometric Failed",
  "fallbackMessage": "We couldn't verify your identity. Please log in with your password.",
  "fallbackAction": "Log In",
  "notSupported": "Biometric authentication is not available on this device.",
  "notEnrolled": "No biometrics enrolled. Please set up Face ID or Touch ID in your device settings."
}
```

---

### `hooks/useBiometric.ts`

```typescript
import { useCallback } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'
const BIOMETRIC_PROMPT_SHOWN_KEY = 'biometric_prompt_shown'

export interface BiometricSupportResult {
  isSupported: boolean
  isEnrolled: boolean
  biometricType: LocalAuthentication.AuthenticationType[]
}

export interface BiometricAuthResult {
  success: boolean
  error?: string
}

/**
 * Returns whether the device hardware supports biometrics
 * and whether the user has enrolled biometrics in device settings.
 */
export const checkBiometricSupport = async (): Promise<BiometricSupportResult> => {
  const isSupported = await LocalAuthentication.hasHardwareAsync()
  if (!isSupported) {
    return { isSupported: false, isEnrolled: false, biometricType: [] }
  }
  const isEnrolled = await LocalAuthentication.isEnrolledAsync()
  const biometricType = await LocalAuthentication.supportedAuthenticationTypesAsync()
  return { isSupported, isEnrolled, biometricType }
}

/**
 * Returns whether the user has opted in to biometric login.
 */
export const getBiometricEnabled = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)
  return value === 'true'
}

/**
 * Saves the user's biometric preference.
 */
export const setBiometricEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false')
}

/**
 * Returns whether the one-time enable/skip prompt has already been shown
 * to this user after their first login.
 */
export const getBiometricPromptShown = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(BIOMETRIC_PROMPT_SHOWN_KEY)
  return value === 'true'
}

/**
 * Marks the enable/skip prompt as shown so it never appears again.
 */
export const markBiometricPromptShown = async (): Promise<void> => {
  await AsyncStorage.setItem(BIOMETRIC_PROMPT_SHOWN_KEY, 'true')
}

/**
 * Triggers the device biometric prompt and returns the result.
 * promptMessage is the string shown in the system prompt dialog.
 * cancelLabel is the text for the fallback/cancel button.
 */
export const authenticateWithBiometric = async (
  promptMessage: string,
  cancelLabel: string
): Promise<BiometricAuthResult> => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: true,  // we handle fallback ourselves via "Use Password"
      fallbackLabel: '',             // not shown when disableDeviceFallback is true
    })
    if (result.success) {
      return { success: true }
    }
    return {
      success: false,
      error: result.error ?? 'unknown',
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Authentication error'
    return { success: false, error: message }
  }
}

/**
 * Hook — exposes biometric helpers as stable callbacks.
 * Prefer importing the standalone functions directly in non-component contexts.
 */
export const useBiometric = (): {
  checkSupport: () => Promise<BiometricSupportResult>
  getEnabled: () => Promise<boolean>
  setEnabled: (enabled: boolean) => Promise<void>
  authenticate: (promptMessage: string, cancelLabel: string) => Promise<BiometricAuthResult>
} => {
  const checkSupport = useCallback(checkBiometricSupport, [])
  const getEnabled = useCallback(getBiometricEnabled, [])
  const setEnabled = useCallback(setBiometricEnabled, [])
  const authenticate = useCallback(authenticateWithBiometric, [])

  return { checkSupport, getEnabled, setEnabled, authenticate }
}
```

---

### `store/authStore.ts` — Additions only

Add `biometricVerified` to the store state and `setBiometricVerified` to the actions. Do not modify any existing fields, the `initialise()` listener, `logout()`, or the persist config.

```typescript
// Add to state interface:
biometricVerified: boolean

// Add to initial state (inside create()):
biometricVerified: false,

// Add to actions:
setBiometricVerified: (verified: boolean) =>
  set({ biometricVerified: verified }),
```

**Important:** `biometricVerified` must **NOT** be persisted — it must reset to `false` on every cold start. If the store uses a `partialize` option in its persist config, exclude `biometricVerified`. If it persists all state without `partialize`, add a `partialize` option that explicitly omits `biometricVerified`.

Example `partialize` addition:
```typescript
{
  name: 'auth-store',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    hasCompletedOnboarding: state.hasCompletedOnboarding,
    // biometricVerified intentionally excluded — resets every cold start
  }),
}
```

---

### `app/auth/BiometricPromptScreen.tsx`

This is a full-screen modal that gates access to the main app on cold start. It is shown by `RootNavigator` when:
- `isAuthenticated === true` (persisted)
- `biometricVerified === false`
- Biometric is supported + enrolled + user has opted in

```typescript
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import {
  checkBiometricSupport,
  authenticateWithBiometric,
} from '@/hooks/useBiometric'
import { colors, spacing, typography } from '@/constants/theme'
import type { RootStackParamList } from '@/app/navigation/RootNavigator'

type BiometricNavProp = StackNavigationProp<RootStackParamList, 'BiometricPrompt'>

export default function BiometricPromptScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<BiometricNavProp>()
  const { setBiometricVerified, logout } = useAuthStore()

  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  const triggerBiometric = async (): Promise<void> => {
    setIsAuthenticating(true)
    setHasFailed(false)

    const result = await authenticateWithBiometric(
      t('biometric.promptTitle'),
      t('biometric.promptCancelLabel')
    )

    setIsAuthenticating(false)

    if (result.success) {
      setBiometricVerified(true)
      // RootNavigator re-renders automatically when biometricVerified changes
    } else {
      // error === 'user_cancel' means they tapped "Use Password"
      // any other error means hardware failure / lockout / timeout
      setHasFailed(true)
    }
  }

  // Trigger automatically on mount
  useEffect(() => {
    void triggerBiometric()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUsePassword = async (): Promise<void> => {
    await logout()
    // RootNavigator will automatically navigate to AuthNavigator after logout
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons
          name="finger-print-outline"
          size={72}
          color={colors.primary}
        />
      </View>

      <Text style={styles.title}>{t('biometric.promptTitle')}</Text>
      <Text style={styles.subtitle}>{t('biometric.promptSubtitle')}</Text>

      {hasFailed && (
        <View style={styles.errorWrapper}>
          <Text style={styles.errorText}>{t('biometric.fallbackMessage')}</Text>
        </View>
      )}

      <View style={styles.buttonStack}>
        {hasFailed ? (
          <>
            <Button
              label={t('biometric.promptCancelLabel')}
              variant="primary"
              onPress={() => { void triggerBiometric() }}
              loading={isAuthenticating}
            />
            <Button
              label={t('biometric.fallbackAction')}
              variant="outline"
              onPress={() => { void handleUsePassword() }}
            />
          </>
        ) : (
          <Button
            label={t('biometric.promptCancelLabel')}
            variant="outline"
            onPress={() => { void handleUsePassword() }}
            loading={isAuthenticating}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  } as ViewStyle,
  iconWrapper: {
    marginBottom: spacing.xl,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: spacing.sm,
  } as TextStyle,
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: spacing.xl,
  } as TextStyle,
  errorWrapper: {
    backgroundColor: colors.danger + '18',  // danger at ~10% opacity
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  } as ViewStyle,
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    textAlign: 'center',
  } as TextStyle,
  buttonStack: {
    width: '100%',
    gap: spacing.sm,
  } as ViewStyle,
})
```

---

### `app/navigation/RootNavigator.tsx` — Updates

RootNavigator must handle two new responsibilities:

**1. Add `BiometricPrompt` to `RootStackParamList`:**
```typescript
export type RootStackParamList = {
  Auth: undefined
  Onboarding: undefined
  MainTabs: undefined
  BiometricPrompt: undefined   // ← add this
}
```

**2. Add the screen registration inside the Stack:**
```typescript
<Stack.Screen
  name="BiometricPrompt"
  component={BiometricPromptScreen}
  options={{ headerShown: false, gestureEnabled: false }}
/>
```
`gestureEnabled: false` prevents the user from swiping back past the biometric gate.

**3. Add biometric gate logic inside `RootNavigator`:**

Import the required helpers:
```typescript
import {
  checkBiometricSupport,
  getBiometricEnabled,
  getBiometricPromptShown,
  markBiometricPromptShown,
  setBiometricEnabled,
} from '@/hooks/useBiometric'
import BiometricPromptScreen from '@/app/auth/BiometricPromptScreen'
```

Add local state inside `RootNavigator`:
```typescript
const [showEnablePrompt, setShowEnablePrompt] = useState(false)
const [biometricReady, setBiometricReady] = useState(false)
```

Add a `useEffect` that runs once when `isAuthenticated` becomes `true`:
```typescript
useEffect(() => {
  if (!isAuthenticated) {
    setBiometricReady(false)
    return
  }

  const evaluateBiometric = async (): Promise<void> => {
    const support = await checkBiometricSupport()

    if (!support.isSupported || !support.isEnrolled) {
      // Device can't do biometrics — skip entirely
      setBiometricVerified(true)
      setBiometricReady(true)
      return
    }

    const promptAlreadyShown = await getBiometricPromptShown()
    if (!promptAlreadyShown) {
      // First login ever — show enable/skip prompt (handled by Alert below)
      await markBiometricPromptShown()

      Alert.alert(
        t('biometric.enableTitle'),
        t('biometric.enableSubtitle'),
        [
          {
            text: t('biometric.enableSkip'),
            style: 'cancel',
            onPress: () => {
              void setBiometricEnabled(false)
              setBiometricVerified(true)  // skip — go straight to app
              setBiometricReady(true)
            },
          },
          {
            text: t('biometric.enableConfirm'),
            onPress: () => {
              void setBiometricEnabled(true)
              // Do NOT set biometricVerified yet — BiometricPromptScreen will do it
              setBiometricReady(true)
            },
          },
        ],
        { cancelable: false }
      )
      return  // biometricReady stays false until alert resolves
    }

    // Prompt was already shown — check preference
    const enabled = await getBiometricEnabled()
    if (!enabled) {
      // User previously skipped — let them straight in
      setBiometricVerified(true)
    }
    // If enabled, biometricVerified stays false — BiometricPromptScreen handles it
    setBiometricReady(true)
  }

  void evaluateBiometric()
}, [isAuthenticated])
```

**4. Update the routing logic inside the navigator's render:**

```typescript
// Decide which screen to show
const getInitialRoute = (): keyof RootStackParamList => {
  if (!isAuthenticated) return 'Auth'
  if (!hasCompletedOnboarding) return 'Onboarding'
  if (!biometricVerified) return 'BiometricPrompt'
  return 'MainTabs'
}
```

Use a loading guard so the app doesn't flash the wrong screen while `biometricReady` is being determined:

```typescript
if (isAuthenticated && !biometricReady) {
  // Still evaluating biometric state — render blank while AsyncStorage resolves
  return null
}
```

Then your existing navigator structure renders normally with `initialRouteName={getInitialRoute()}`.

**Note:** Because `biometricVerified` is a Zustand store value (not local state), `RootNavigator` will re-render and pick up the new route automatically when `BiometricPromptScreen` calls `setBiometricVerified(true)`. No manual navigation call is needed inside `BiometricPromptScreen` on success.

---

## Architecture Notes for Codex

1. **No Firebase call in this task.** Biometric preference is local-only (`AsyncStorage`). Never write biometric state to Firestore.

2. **`biometricVerified` resets on every cold start** by design. It is excluded from the Zustand persist config. On the next cold open, `RootNavigator`'s `useEffect` re-runs the check and decides whether to show `BiometricPromptScreen` again. This is intentional — it is the re-verification gate.

3. **`disableDeviceFallback: true` in `authenticateAsync`.** We do not use the OS-level PIN/password fallback. Our own "Use Password" button calls `logout()` which returns the user to `AuthNavigator`. This gives us full control over the fallback UX.

4. **`gestureEnabled: false` on `BiometricPrompt`.** The user must not be able to swipe back past the gate into the main app. Always set this.

5. **Simulator behaviour.** `expo-local-authentication` on iOS Simulator returns `isSupported: false`. `RootNavigator` must handle this silently by calling `setBiometricVerified(true)` immediately and not showing the gate. The `checkBiometricSupport` check covers this.

6. **Alert in RootNavigator.** The one-time enable/skip prompt uses `Alert.alert` rather than a custom modal to keep this task scoped. A custom modal design is a Phase 2 polish item.

7. **`getBiometricEnabled` reading on every cold start** is safe — `AsyncStorage` reads are fast and only happen once per session inside the `useEffect`.

8. **TypeScript:** `setBiometricVerified` must be exported from `useAuthStore`. Import `Alert` from `react-native` in `RootNavigator`.

---

## Acceptance Criteria

- [ ] `hooks/useBiometric.ts` created — all 6 functions exported with correct TypeScript return types, zero `any`
- [ ] `useBiometric` hook exported as named export (not default)
- [ ] `biometricVerified: boolean` added to `authStore`, initialised to `false`, excluded from persist
- [ ] `setBiometricVerified()` action exported from `useAuthStore`
- [ ] `BiometricPromptScreen.tsx` created — full-screen, no header, auto-triggers biometric on mount
- [ ] Biometric success → `setBiometricVerified(true)` → `RootNavigator` re-renders to `MainTabs` automatically (no explicit `navigation.navigate` call in screen)
- [ ] Biometric fail → `hasFailed` state shown with error text and "Try Again" + "Use Password" buttons
- [ ] "Use Password" → `logout()` → navigator routes to `AuthNavigator`
- [ ] One-time enable/skip `Alert` shows after first successful login (when `biometricPromptShown` is not set)
- [ ] Alert "Not Now" → `setBiometricEnabled(false)`, user goes straight to app, prompt never shown again
- [ ] Alert "Enable" → `setBiometricEnabled(true)`, `BiometricPromptScreen` shown on this and all future cold starts
- [ ] On devices where `isSupported === false` or `isEnrolled === false`: skip silently, `setBiometricVerified(true)`, user enters app without prompt
- [ ] `BiometricPrompt` added to `RootStackParamList` with `gestureEnabled: false`
- [ ] `biometricReady` guard prevents flash of wrong screen while AsyncStorage resolves
- [ ] All biometric i18n keys added to all 4 language files
- [ ] Zero inline styles — all via `StyleSheet.create` and theme tokens
- [ ] Zero hardcoded strings — all via `useTranslation()`
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`App.tsx`, `hooks/useNotifications.ts`, `services/notifications.ts`, `services/firebase/auth.ts`, `store/onboardingStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`, `store/profileStore.ts`, `store/toastStore.ts`, `firestore.rules`, `firestore.indexes.json`, `functions/`, `components/ui/` (read-only for this task — only import from them), `types/`

## Commit
`git commit -m "task-43: biometric auth with enable prompt, cold-start gate, and use-password fallback"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1F — Task 43] — YYYY-MM-DD

### Completed

- Task 43: Biometric authentication — useBiometric hook, BiometricPromptScreen, RootNavigator gate
- One-time enable/skip Alert shown after first successful login (AsyncStorage flag)
- Cold-start gate: BiometricPromptScreen shown when isAuthenticated + biometricEnabled + !biometricVerified
- biometricVerified excluded from Zustand persist — resets on every cold start by design
- Device without biometric support (simulator, unenrolled) skips silently via setBiometricVerified(true)
- "Use Password" fallback calls logout() and routes user back to AuthNavigator

### Files Created / Modified

- hooks/useBiometric.ts: checkBiometricSupport, getBiometricEnabled, setBiometricEnabled, getBiometricPromptShown, markBiometricPromptShown, authenticateWithBiometric, useBiometric hook
- app/auth/BiometricPromptScreen.tsx: full-screen gate, auto-triggers on mount, fail state with retry + fallback
- app/navigation/RootNavigator.tsx: BiometricPrompt added to stack, biometricReady guard, one-time Alert, routing logic updated
- store/authStore.ts: biometricVerified state + setBiometricVerified action added, excluded from persist
- i18n/en.json, my.json, zh.json, ta.json: biometric.* keys added

### Architecture Decisions

- biometricVerified not persisted — intentional cold-start re-verification gate
- disableDeviceFallback: true — full control over "Use Password" UX, no OS PIN fallback
- gestureEnabled: false on BiometricPrompt screen — prevents swipe-back bypass
- Alert.alert for enable/skip prompt — custom modal deferred to Phase 2
- No Firestore writes — biometric preference is device-local only (AsyncStorage)

### Known Issues / Deferred

- Custom enable/skip modal UI (replace Alert) deferred to Phase 2
- Biometric lockout state (too many failures, hardware disabled) not specially handled — falls through to hasFailed state
- Android-specific biometric type display (fingerprint vs face) not differentiated in UI — generic icon used

### Next Up

- Task 44: Daily like limit enforcement (discoveryStore + firestore dailyLikes doc)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 44 prompt.

---

## Reasoning Level
Medium
