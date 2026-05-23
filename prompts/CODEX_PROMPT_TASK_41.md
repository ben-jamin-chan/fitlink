# CODEX PROMPT — Task 41
# UI Polish: LoadingOverlay, ErrorBoundary, Toast

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1F in progress. Tasks 39, 39B, and 40 are complete:
- `firestore.rules` — full production security rules across all Phase 1 collections
- `functions/src/unmatchUser.ts` — bilateral unmatch Cloud Function
- `firestore.indexes.json` — 3 composite indexes + 1 field override deployed

Relevant existing files:
- `components/ui/Button.tsx` — primary/outline/ghost variants, loading and disabled states (Task 11)
- `components/ui/Input.tsx` — themed input, inline error support (Task 14)
- `App.tsx` — providers: `GestureHandlerRootView` → `SafeAreaProvider` → `NavigationContainer` → `RootNavigator`; `ErrorBoundary` is referenced in TASKS.md but **does not exist yet** — this task creates it
- `constants/theme.ts` — exports `colors`, `spacing`, `typography`, `borderRadius`
- `store/authStore.ts` — `useAuthStore` with `isAuthenticated`, `user`
- `utils/errorUtils.ts` — `mapFirebaseError()` returns i18n key or message string (Task 09)
- `i18n/en.json` — `errors.*` namespace exists; `ui.*` namespace not yet seeded

This task builds three global UI utility components. They are used across all existing screens and are referenced in later tasks (Tasks 42–46). All three must be production-ready, not stubs.

**Dependency note:** After Task 41, the `ErrorBoundary` must be wired into `App.tsx`. The `Toast` must expose a singleton `showToast()` callable from anywhere (services, stores, screens) without prop-drilling. The `LoadingOverlay` is a dumb presentational component used ad-hoc by screens.

---

## Task 41 — LoadingOverlay, ErrorBoundary, Toast

**Files to create:**
- `components/ui/LoadingOverlay.tsx`
- `components/ui/ErrorBoundary.tsx`
- `components/ui/Toast.tsx`
- `store/toastStore.ts`

**Files to modify:**
- `App.tsx` — wrap root in `ErrorBoundary`, mount `Toast` renderer
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `ui.*` keys

---

### `store/toastStore.ts`

Zustand store that holds the current toast state. Screens and services call `showToast()` from this store — no prop-drilling, no refs needed.

```typescript
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

interface ToastState {
  visible: boolean
  message: string
  type: ToastType
  showToast: (message: string, type?: ToastType) => void
  hideToast: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  type: 'info',

  showToast: (message, type = 'info') => {
    set({ visible: true, message, type })
  },

  hideToast: () => {
    set({ visible: false })
  },
}))

/**
 * Imperative singleton helper — call this anywhere outside React render
 * (stores, services, Cloud Function callbacks, catch blocks).
 *
 * Usage:
 *   import { showToast } from '@/store/toastStore'
 *   showToast('Profile saved', 'success')
 */
export const showToast = (message: string, type: ToastType = 'info'): void => {
  useToastStore.getState().showToast(message, type)
}
```

---

### `components/ui/Toast.tsx`

Singleton toast renderer. Mount exactly once in `App.tsx` above `NavigationContainer`. Auto-dismisses after 3 seconds. Only one toast shows at a time (new `showToast` call replaces the current one). Uses `Animated` (not Reanimated — no gesture involvement) for slide-in from top. Positioned below the status bar using `useSafeAreaInsets`.

```typescript
import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useToastStore, ToastType } from '@/store/toastStore'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'

const TOAST_DURATION_MS = 3000
const ANIMATION_DURATION_MS = 250

const TOAST_CONFIG: Record<ToastType, { bg: string; icon: string; iconColor: string }> = {
  success: {
    bg: colors.primary,
    icon: 'checkmark-circle',
    iconColor: colors.white,
  },
  error: {
    bg: colors.danger,
    icon: 'alert-circle',
    iconColor: colors.white,
  },
  info: {
    bg: colors.gray[800],
    icon: 'information-circle',
    iconColor: colors.white,
  },
}

export const Toast = (): React.JSX.Element => {
  const insets = useSafeAreaInsets()
  const { visible, message, type, hideToast } = useToastStore()
  const translateY = useRef(new Animated.Value(-100)).current
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      // Clear any existing auto-dismiss timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }

      // Slide in
      Animated.timing(translateY, {
        toValue: 0,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }).start()

      // Auto-dismiss
      timerRef.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -150,
          duration: ANIMATION_DURATION_MS,
          useNativeDriver: true,
        }).start(() => hideToast())
      }, TOAST_DURATION_MS)
    } else {
      // Reset off-screen
      translateY.setValue(-150)
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [visible, message])

  const config = TOAST_CONFIG[type]

  if (!visible) return <></>

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          top: insets.top + spacing.sm,
          transform: [{ translateY }],
        },
      ]}
    >
      <Ionicons
        name={config.icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={config.iconColor}
        style={styles.icon}
      />
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 10,          // Android shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  } as ViewStyle,
  icon: {
    marginRight: spacing.sm,
    flexShrink: 0,
  } as ViewStyle,
  message: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.white,
  } as TextStyle,
})
```

---

### `components/ui/LoadingOverlay.tsx`

Full-screen semi-transparent overlay with centered spinner. Used ad-hoc by screens during async operations (photo upload, profile save, sign in, etc.). Controlled by a `visible` prop — caller manages state.

```typescript
import React from 'react'
import {
  ActivityIndicator,
  Modal,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

export const LoadingOverlay = ({
  visible,
  message,
}: LoadingOverlayProps): React.JSX.Element => (
  <Modal
    transparent
    animationType="fade"
    visible={visible}
    statusBarTranslucent
  >
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        {message !== undefined && message.length > 0 && (
          <Text style={styles.message}>{message}</Text>
        )}
      </View>
    </View>
  </Modal>
)

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minWidth: 120,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  } as ViewStyle,
  message: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    textAlign: 'center',
    maxWidth: 180,
  } as TextStyle,
})
```

---

### `components/ui/ErrorBoundary.tsx`

React class component. Catches render-time errors anywhere in the subtree. Shows a friendly full-screen error screen with a "Try Again" button that resets boundary state. Logs the error to console (Crashlytics integration deferred to Phase 2). Does **not** use hooks (class component requirement for `componentDidCatch`).

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography } from '@/constants/theme'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // TODO Phase 2: replace with Firebase Crashlytics.recordError(error)
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', info.componentStack)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="warning-outline" size={56} color={colors.danger} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The app hit an unexpected error. Please try again.
          </Text>
          {__DEV__ && this.state.errorMessage.length > 0 && (
            <Text style={styles.devMessage}>{this.state.errorMessage}</Text>
          )}
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleReset}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonLabel}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  } as TextStyle,
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  } as TextStyle,
  devMessage: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontFamily: 'monospace',
    paddingHorizontal: spacing.sm,
  } as TextStyle,
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 100,
  } as ViewStyle,
  buttonLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  } as TextStyle,
})
```

---

### `App.tsx` — Update

Add `ErrorBoundary` wrapping the entire tree and mount `Toast` as a floating sibling above `NavigationContainer`. The correct final structure:

```tsx
// Add imports:
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Toast } from '@/components/ui/Toast'

// Wrap root — preserve existing provider order inside ErrorBoundary:
export default function App(): React.JSX.Element {
  // ... existing useEffect calls (initialise, useNotifications, useLastActive stubs) ...

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* Toast floats above everything, outside NavigationContainer */}
          <Toast />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
```

**Critical:** `ErrorBoundary` is the outermost wrapper — outside even `GestureHandlerRootView`. `Toast` is inside `SafeAreaProvider` (needs insets) but outside `NavigationContainer` (must float above all screens). Do not change any other logic in `App.tsx`.

---

### i18n keys to add

Add these keys to `i18n/en.json` under a new `ui` namespace. Copy the same English values as placeholders into `my.json`, `zh.json`, `ta.json`:

```json
{
  "ui": {
    "loading": "Loading...",
    "errorTitle": "Something went wrong",
    "errorSubtitle": "The app hit an unexpected error. Please try again.",
    "tryAgain": "Try Again",
    "toast": {
      "profileSaved": "Profile updated",
      "photoUploaded": "Photo uploaded",
      "photoRemoved": "Photo removed",
      "loggedOut": "You've been logged out",
      "networkError": "Network error. Please try again.",
      "genericError": "Something went wrong."
    }
  }
}
```

> **Note for Codex:** The `ErrorBoundary` currently uses hardcoded English strings (class component cannot use `useTranslation()`). This is intentional — it is a last-resort fallback. The i18n keys above are for use by Toast callers and future Crashlytics integration.

---

## Architecture Notes for Codex

1. **Toast is a singleton, not a hook.** The `showToast()` export from `store/toastStore.ts` is a plain function callable from anywhere — stores, services, catch blocks. Do not create a `useToast()` hook that requires React context.

2. **`Toast` must be inside `SafeAreaProvider`** to call `useSafeAreaInsets()`. It must be outside `NavigationContainer` so it renders above every screen including modals. The placement in `App.tsx` exactly as specified above satisfies both constraints.

3. **`ErrorBoundary` is a class component.** React's error boundary API (`getDerivedStateFromError` + `componentDidCatch`) only works in class components. Do not convert it to a functional component. Do not use hooks inside it.

4. **`LoadingOverlay` uses `Modal`** from React Native for true overlay behaviour on both iOS and Android. Using `position: 'absolute'` with `zIndex` is not reliable across nested navigators — `Modal` is correct here.

5. **No Reanimated in Toast.** The Toast uses React Native's built-in `Animated` API. Reanimated is reserved for gesture-driven animations (swipe cards). An `Animated.timing` on a position value is sufficient for a slide-in toast and avoids adding a worklet dependency to a utility component.

6. **`__DEV__` guard on error detail.** The `ErrorBoundary` shows the raw error message only when `__DEV__` is true (Expo dev builds). Production users see no internal error strings.

7. **Auto-dismiss timer reset.** If `showToast()` is called while a toast is already visible (e.g., rapid error events), the timer ref is cleared and restarted so the new toast gets a full 3 seconds. The `message` dependency in the `useEffect` ensures this works correctly.

---

## Acceptance Criteria

- [ ] `store/toastStore.ts` created — `useToastStore` hook and `showToast` singleton export
- [ ] `components/ui/Toast.tsx` created — slides in from top, auto-dismisses after 3s, success/error/info variants with correct colors and icons
- [ ] `components/ui/LoadingOverlay.tsx` created — full-screen modal overlay, spinner, optional message string
- [ ] `components/ui/ErrorBoundary.tsx` created — class component, catches render errors, friendly fallback UI, "Try Again" reset button
- [ ] `App.tsx` updated — `ErrorBoundary` outermost, `Toast` inside `SafeAreaProvider` above `NavigationContainer`
- [ ] `i18n/en.json` has `ui.*` keys; `my.json`, `zh.json`, `ta.json` have same keys with English placeholders
- [ ] Calling `showToast('Hello', 'success')` from a Zustand store action renders the Toast in the app
- [ ] Triggering a render error in a child component shows the `ErrorBoundary` fallback screen
- [ ] `LoadingOverlay` with `visible={true}` blocks interaction and shows spinner
- [ ] Zero inline styles across all three components
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`services/firebase/`, `store/authStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`, `store/profileStore.ts`, `store/onboardingStore.ts`, `firestore.rules`, `firestore.indexes.json`, `functions/`, `components/ui/Button.tsx`, `components/ui/Input.tsx`, all screen files

## Commit
`git commit -m "task-41: loading overlay, error boundary, and toast system"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1F — Task 41] — YYYY-MM-DD

### Completed
- Task 41: LoadingOverlay, ErrorBoundary, and Toast global UI utilities built
- toastStore singleton — showToast() callable from stores and services without prop-drilling
- Toast auto-dismisses after 3s, slide-in from top, success/error/info variants
- LoadingOverlay uses Modal for reliable cross-navigator overlay on iOS + Android
- ErrorBoundary class component wraps entire app in App.tsx — catches all render errors
- App.tsx updated with correct nesting: ErrorBoundary > GestureHandlerRootView > SafeAreaProvider > Toast + NavigationContainer

### Files Created / Modified
- store/toastStore.ts: Zustand toast state + showToast() imperative singleton export
- components/ui/Toast.tsx: animated toast renderer, Animated.timing slide-in, 3s auto-dismiss, timer reset on rapid calls
- components/ui/LoadingOverlay.tsx: Modal-based full-screen overlay, ActivityIndicator, optional message
- components/ui/ErrorBoundary.tsx: class component, getDerivedStateFromError + componentDidCatch, __DEV__ error detail guard
- App.tsx: ErrorBoundary outermost, Toast inside SafeAreaProvider above NavigationContainer
- i18n/en.json, my.json, zh.json, ta.json: ui.* keys added

### Architecture Decisions
- showToast() is a plain function (useToastStore.getState().showToast) — not a hook — so services and catch blocks can call it without React context
- Toast uses React Native Animated (not Reanimated) — no gesture involvement, worklet overhead unwarranted
- LoadingOverlay uses Modal not absolute position — reliable above all nested navigators
- ErrorBoundary hardcodes English — class component cannot use useTranslation(); acceptable for last-resort fallback
- __DEV__ guard prevents raw error messages leaking to production users

### Known Issues / Deferred
- ErrorBoundary does not call Crashlytics yet — console.error placeholder, Crashlytics integration deferred to Phase 2
- Toast does not support action buttons (e.g., "Retry") — deferred to Phase 2 if needed
- LoadingOverlay progress percentage prop not added — binary visible/hidden for Phase 1

### Next Up
- Task 42: Push notification registration (services/notifications.ts, hooks/useNotifications.ts, deep link handling)
```

Then return to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 42 prompt.

---

## Reasoning Level
Medium
