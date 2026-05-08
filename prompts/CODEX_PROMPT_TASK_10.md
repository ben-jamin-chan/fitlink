# CODEX PROMPT — Task 10
# Auth Zustand Store (Full Implementation)

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1.4 complete. The following now exist and must not be touched unless explicitly stated:
- `services/firebase/auth.ts` — exports: `sendOTP`, `verifyOTP`, `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `signInWithApple`, `signOut`, `getCurrentUser`, `subscribeToAuthState`, `AppError`
- `utils/errorUtils.ts` — exports: `mapFirebaseError`, `isFirebaseError`
- `store/authStore.ts` — currently a **stub** with minimal state, no persistence, no Firebase listener
- `app/navigation/RootNavigator.tsx` — reads `isAuthenticated`, `isLoading`, `hasCompletedOnboarding` from authStore

Task 10 replaces the stub `store/authStore.ts` with the full implementation. This is the store that gates all navigation — getting it right is critical. No UI files are created in this task.

---

## Task 10 — Auth Zustand Store (Full Implementation)

**Files to modify:**
- `store/authStore.ts` — full rewrite, replacing the stub

**Files to create:**
- None

---

### `store/authStore.ts` — Full Rewrite

The store must do four things:
1. Hold auth state (`user`, `isAuthenticated`, `isLoading`, `error`)
2. Persist `isAuthenticated` and `hasCompletedOnboarding` across app restarts via AsyncStorage
3. Wire the Firebase `onAuthStateChanged` listener on initialisation so navigation reacts automatically
4. Expose actions that screens call directly (logout, clearError, setHasCompletedOnboarding)

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User } from 'firebase/auth'
import { subscribeToAuthState, signOut as firebaseSignOut } from '@/services/firebase/auth'
import type { AppError } from '@/services/firebase/auth'

// State shape
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null                // i18n key, not translated string
  hasCompletedOnboarding: boolean

  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  setHasCompletedOnboarding: (completed: boolean) => void
  logout: () => Promise<void>
  initialise: () => () => void        // returns unsubscribe fn
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,              // true on boot — prevents flash of wrong navigator
      error: null,
      hasCompletedOnboarding: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: user !== null,
          isLoading: false,
        }),

      setIsLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      setHasCompletedOnboarding: (completed) =>
        set({ hasCompletedOnboarding: completed }),

      logout: async () => {
        try {
          await firebaseSignOut()
          set({
            user: null,
            isAuthenticated: false,
            hasCompletedOnboarding: false,
            error: null,
          })
        } catch (err) {
          const appError = err as AppError
          set({ error: appError.code })
        }
      },

      initialise: () => {
        const unsubscribe = subscribeToAuthState((user) => {
          get().setUser(user)
        })
        return unsubscribe
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist these fields — never persist isLoading or error
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
)
```

---

### Wire `initialise()` in `App.tsx`

Modify App.tsx to call initialise() in a useEffect:

```typescript
import React, { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { StyleSheet } from 'react-native'
import { RootNavigator } from '@/app/navigation/RootNavigator'
import { useAuthStore } from '@/store/authStore'
import '@/i18n/index'

export default function App(): React.JSX.Element {
  const initialise = useAuthStore((state) => state.initialise)

  useEffect(() => {
    const unsubscribe = initialise()
    return unsubscribe
  }, [initialise])

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
```

---

## Navigation Flow After This Task

| State | Navigator shown |
|---|---|
| isLoading: true | Spinner (ActivityIndicator in RootNavigator) |
| isAuthenticated: false | AuthNavigator |
| isAuthenticated: true + hasCompletedOnboarding: false | Onboarding placeholder |
| isAuthenticated: true + hasCompletedOnboarding: true | MainTabNavigator |

isLoading starts true on boot, preventing the wrong navigator from flashing before Firebase confirms auth state.

---

## Acceptance Criteria

- [ ] store/authStore.ts fully rewritten — no stub code remaining
- [ ] isLoading starts as true on app boot
- [ ] subscribeToAuthState called inside initialise(), unsubscribe fn returned
- [ ] App.tsx calls initialise() in useEffect with cleanup return
- [ ] Persistence covers only isAuthenticated and hasCompletedOnboarding
- [ ] logout() resets hasCompletedOnboarding to false
- [ ] tsc --noEmit passes with zero errors
- [ ] Zero any usage
- [ ] No UI code in store file

## Do Not Touch
services/firebase/auth.ts, utils/errorUtils.ts, app/navigation/, types/, constants/, i18n/

## Commit
git commit -m "task-10: auth store full implementation with firebase listener and persistence"

---

## After This Session

Update CHANGELOG.md:

## [Phase 1.5] — YYYY-MM-DD
### Completed
- Task 10: authStore fully implemented — replaces stub
- Firebase onAuthStateChanged wired via initialise() called in App.tsx
- AsyncStorage persistence for isAuthenticated and hasCompletedOnboarding
- Navigation now reacts automatically to auth state changes

### Files Created / Modified
- store/authStore.ts: full rewrite with persist middleware, initialise(), logout()
- App.tsx: added useEffect to call initialise() and wire cleanup

### Next Up
- Task 11: Landing screen + Button component

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 11 prompt.

---

## Reasoning Level
Medium — store pattern is explicit, but the isLoading boot state, Firebase listener, and persist partialize interaction requires careful assembly.
