# CODEX PROMPT — Task 08
# Navigation Shell

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1.2 complete. The following now exist and must not be touched:
- `types/` — user, match, message, subscription interfaces
- `constants/` — colors, spacing, typography, theme
- `services/firebase/config.ts` — Firebase init (auth, db, storage, rtdb)
- `i18n/` — index.ts + 4 language JSON files
- `@/` path alias configured in tsconfig.json and babel.config.js

Task 08 establishes the full navigation shell and rewrites App.tsx with the correct provider stack. This is the last foundational task before auth screens begin. After this task, every screen placeholder will be reachable.

---

## Task 08 — Navigation Shell

**Files to create:**
- `store/authStore.ts` (stub — full implementation in Task 10)
- `app/navigation/RootNavigator.tsx`
- `app/navigation/AuthNavigator.tsx`
- `app/navigation/MainTabNavigator.tsx`

**Files to modify:**
- `App.tsx` (full rewrite)

---

### Navigation Type Definitions

Define navigation param lists at the top of each navigator file — do not create a separate types file for these.

**In `app/navigation/AuthNavigator.tsx`:**
```typescript
export type AuthStackParamList = {
  Landing: undefined
  PhoneLogin: undefined
  OTPVerify: { phoneNumber: string }
  EmailLogin: undefined
  SignUp: undefined
}
```

**In `app/navigation/MainTabNavigator.tsx`:**
```typescript
export type MainTabParamList = {
  Discover: undefined
  Matches: undefined
  Profile: undefined
  Settings: undefined
}
```

**In `app/navigation/RootNavigator.tsx`:**
```typescript
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>
  Main: NavigatorScreenParams<MainTabParamList>
  Onboarding: undefined
}
```

---

### `store/authStore.ts` (stub)

Create a minimal Zustand store with just enough state for RootNavigator to determine which navigator to show. This will be fully implemented in Task 10.

```typescript
import { create } from 'zustand'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  hasCompletedOnboarding: boolean
  setIsAuthenticated: (value: boolean) => void
  setIsLoading: (value: boolean) => void
  setHasCompletedOnboarding: (value: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: false,
  hasCompletedOnboarding: false,
  setIsAuthenticated: (value) => set({ isAuthenticated: value }),
  setIsLoading: (value) => set({ isLoading: value }),
  setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
}))
```

Note: No persistence yet — that is added in Task 10 when Firebase auth state listener is wired up.

---

### `app/navigation/RootNavigator.tsx`

```typescript
import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { NavigatorScreenParams } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useAuthStore } from '@/store/authStore'
import { AuthNavigator } from '@/app/navigation/AuthNavigator'
import { MainTabNavigator } from '@/app/navigation/MainTabNavigator'
import { colors } from '@/constants/theme'
import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'
import type { MainTabParamList } from '@/app/navigation/MainTabNavigator'

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>
  Main: NavigatorScreenParams<MainTabParamList>
  Onboarding: undefined
}

const Stack = createStackNavigator<RootStackParamList>()

export const RootNavigator = (): React.JSX.Element => {
  const { isAuthenticated, isLoading, hasCompletedOnboarding } = useAuthStore()

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !hasCompletedOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingPlaceholder} />
      ) : (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  )
}

// Temporary placeholder — replaced in Task 15
const OnboardingPlaceholder = (): React.JSX.Element => (
  <View style={styles.placeholder}>
  </View>
)

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
```

---

### `app/navigation/AuthNavigator.tsx`

```typescript
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack'
import { colors, typography, spacing } from '@/constants/theme'

export type AuthStackParamList = {
  Landing: undefined
  PhoneLogin: undefined
  OTPVerify: { phoneNumber: string }
  EmailLogin: undefined
  SignUp: undefined
}

const Stack = createStackNavigator<AuthStackParamList>()

export const AuthNavigator = (): React.JSX.Element => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: colors.background },
    }}
  >
    <Stack.Screen name="Landing" component={LandingPlaceholder} />
    <Stack.Screen name="PhoneLogin" component={PhoneLoginPlaceholder} />
    <Stack.Screen name="OTPVerify" component={OTPVerifyPlaceholder} />
    <Stack.Screen name="EmailLogin" component={EmailLoginPlaceholder} />
    <Stack.Screen name="SignUp" component={SignUpPlaceholder} />
  </Stack.Navigator>
)

// Temporary placeholders — each replaced in Tasks 11–14
const LandingPlaceholder = (): React.JSX.Element => (
  <PlaceholderScreen name="Landing" />
)
const PhoneLoginPlaceholder = (): React.JSX.Element => (
  <PlaceholderScreen name="Phone Login" />
)
const OTPVerifyPlaceholder = (): React.JSX.Element => (
  <PlaceholderScreen name="OTP Verify" />
)
const EmailLoginPlaceholder = (): React.JSX.Element => (
  <PlaceholderScreen name="Email Login" />
)
const SignUpPlaceholder = (): React.JSX.Element => (
  <PlaceholderScreen name="Sign Up" />
)

interface PlaceholderScreenProps {
  name: string
}

const PlaceholderScreen = ({ name }: PlaceholderScreenProps): React.JSX.Element => (
  <View style={styles.container}>
    <Text style={styles.text}>{name}</Text>
  </View>
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  text: {
    fontSize: typography.sizes.lg,
    color: colors.gray[600],
  },
})
```

---

### `app/navigation/MainTabNavigator.tsx`

```typescript
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { colors, typography } from '@/constants/theme'

export type MainTabParamList = {
  Discover: undefined
  Matches: undefined
  Profile: undefined
  Settings: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_ICONS: Record<keyof MainTabParamList, { active: IoniconName; inactive: IoniconName }> = {
  Discover: { active: 'flame', inactive: 'flame-outline' },
  Matches: { active: 'heart', inactive: 'heart-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
}

export const MainTabNavigator = (): React.JSX.Element => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.gray[400],
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabLabel,
      tabBarIcon: ({ focused, color, size }) => {
        const icons = TAB_ICONS[route.name as keyof MainTabParamList]
        const iconName = focused ? icons.active : icons.inactive
        return <Ionicons name={iconName} size={size} color={color} />
      },
    })}
  >
    <Tab.Screen name="Discover" component={DiscoverPlaceholder} />
    <Tab.Screen name="Matches" component={MatchesPlaceholder} />
    <Tab.Screen name="Profile" component={ProfilePlaceholder} />
    <Tab.Screen name="Settings" component={SettingsPlaceholder} />
  </Tab.Navigator>
)

// Temporary placeholders — each replaced in later tasks
const DiscoverPlaceholder = (): React.JSX.Element => <PlaceholderScreen name="Discover" />
const MatchesPlaceholder = (): React.JSX.Element => <PlaceholderScreen name="Matches" />
const ProfilePlaceholder = (): React.JSX.Element => <PlaceholderScreen name="Profile" />
const SettingsPlaceholder = (): React.JSX.Element => <PlaceholderScreen name="Settings" />

interface PlaceholderScreenProps {
  name: string
}

const PlaceholderScreen = ({ name }: PlaceholderScreenProps): React.JSX.Element => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>{name}</Text>
  </View>
)

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.gray[200],
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 4,
    height: 60,
  },
  tabLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  placeholderText: {
    fontSize: typography.sizes.lg,
    color: colors.gray[600],
  },
})
```

---

### `App.tsx` (full rewrite)

Replace the entire file. Provider order is critical — do not change it:

```typescript
import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { StyleSheet } from 'react-native'
import { RootNavigator } from '@/app/navigation/RootNavigator'
import '@/i18n/index'

export default function App(): React.JSX.Element {
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
  root: {
    flex: 1,
  },
})
```

**Critical rules for App.tsx:**
- `GestureHandlerRootView` is the outermost wrapper — never move it
- `import '@/i18n/index'` initialises i18n as a side effect before first render
- `App` uses `export default` — this is the one file where default export is required (Expo entry point)
- No other logic in App.tsx — all routing lives in RootNavigator

---

## Acceptance Criteria

- [ ] App boots with `npx expo start` — no crashes on iOS simulator and Android
- [ ] Bottom tab bar visible with 4 tabs: Discover, Matches, Profile, Settings
- [ ] All 4 tabs are tappable and show their placeholder screen name
- [ ] Navigating to auth screens is possible by temporarily setting `isAuthenticated: false` in authStore (default)
- [ ] `tsc --noEmit` passes with zero errors
- [ ] No inline styles anywhere — all styles in `StyleSheet.create({})`
- [ ] No hardcoded strings — placeholder screen names are acceptable for now as they are dev-only scaffolding
- [ ] `GestureHandlerRootView` is the outermost element in App.tsx

## Do Not Touch
`types/`, `constants/`, `services/`, `i18n/`, `babel.config.js`, `tsconfig.json`

## Commit
`git commit -m "task-08: navigation shell with auth and main tab navigators"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1.3] — YYYY-MM-DD
### Completed
- Task 08: Navigation shell complete — RootNavigator, AuthNavigator, MainTabNavigator
- App.tsx rewritten with correct provider order (GestureHandlerRootView → SafeAreaProvider → NavigationContainer)
- authStore stub created for navigation gating
- All 5 auth screens and 4 main tab screens have placeholder components

### Files Created / Modified
- App.tsx: full rewrite with correct provider stack
- app/navigation/RootNavigator.tsx: root stack, auth gating logic
- app/navigation/AuthNavigator.tsx: stack navigator for auth screens
- app/navigation/MainTabNavigator.tsx: bottom tab navigator with Ionicons
- store/authStore.ts: stub store (isAuthenticated, isLoading, hasCompletedOnboarding)

### Next Up
- Task 09: Auth service layer (signInWithPhone, verifyOTP, signInWithEmail, signOut)
- Prerequisite for Task 09: populate .env with Firebase values, add GoogleService-Info.plist and google-services.json
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 09 prompt.

---

## Reasoning Level
**Medium** — structured navigator setup with explicit patterns provided. No creative decisions needed.
