# CONVENTIONS.md — [APP_NAME]
# Codex must follow every rule in this file on every task, no exceptions.

---

## 1. Language & TypeScript

- **TypeScript strict mode everywhere** — `"strict": true` in `tsconfig.json`
- **Zero `any`** — not a single `any` type is permitted anywhere in the codebase
- **No type assertions (`as`)** unless absolutely unavoidable — if used, add a comment explaining why
- All function arguments and return types must be explicitly typed
- Use `unknown` over `any` when type is genuinely unknown, then narrow it with type guards
- Use `interface` for object shapes, `type` for unions and primitives
- Export all types as named exports from `types/` — never define types inline in component files
- Use `Timestamp` from `firebase/firestore` for all date fields — never `Date` or `string` for timestamps

---

## 2. Path Aliases

This project uses `@/` as a path alias for the project root. This must be configured in two places:

**`tsconfig.json`:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**`babel.config.js`:**
```javascript
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['.'],
        alias: { '@': '.' }
      }],
      'react-native-reanimated/plugin'  // must be last
    ]
  }
}
```

Install the babel plugin: `npm install --save-dev babel-plugin-module-resolver`

All internal imports must use `@/` — never use relative paths like `../../components/ui/Button`:

```typescript
// ✅ Correct
import { Button } from '@/components/ui/Button'
import type { UserProfile } from '@/types/user'

// ❌ Wrong
import { Button } from '../../components/ui/Button'
```

---

## 3. File & Folder Naming

| What | Convention | Example |
|---|---|---|
| Screen components | PascalCase + "Screen" | `DiscoveryScreen.tsx` |
| Reusable components | PascalCase | `SwipeCard.tsx`, `MessageBubble.tsx` |
| Zustand stores | camelCase + "Store" | `authStore.ts`, `discoveryStore.ts` |
| Custom hooks | camelCase + "use" prefix | `useLastActive.ts`, `useBiometric.ts` |
| Service files | camelCase | `auth.ts`, `firestore.ts`, `strava.ts` |
| Utility functions | camelCase | `imageUtils.ts`, `errorUtils.ts` |
| Type files | camelCase | `user.ts`, `match.ts`, `message.ts` |
| Constants | camelCase for objects, SCREAMING_SNAKE_CASE for values | `colors.ts`, `MAX_PHOTOS = 6` |
| Translation keys | dot notation, lowercase | `auth.login.title`, `errors.required` |
| Cloud Functions | camelCase | `onSwipeCreated.ts`, `getDiscoveryStack.ts` |

---

## 4. Exports

- **Named exports only** for all components, hooks, utilities, types, and stores
- **Default exports** are allowed only for screen-level components (React Navigation requirement)
- Never use `export default` on hooks, stores, services, or utilities

```typescript
// ✅ Correct
export const SwipeCard = ({ user }: SwipeCardProps) => { ... }
export interface UserProfile { ... }
export const useLastActive = () => { ... }

// ❌ Wrong
export default SwipeCard
export default useLastActive
```

---

## 5. Component Structure

Every component file must follow this exact import and declaration order:

```typescript
// 1. React imports
import React, { useState, useEffect } from 'react'

// 2. React Native imports
import { View, Text, StyleSheet } from 'react-native'

// 3. Third-party libraries (alphabetical)
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'

// 4. Internal — stores
import { useAuthStore } from '@/store/authStore'

// 5. Internal — components
import { Button } from '@/components/ui/Button'

// 6. Internal — hooks
import { useLastActive } from '@/hooks/useLastActive'

// 7. Internal — services
import { signOut } from '@/services/firebase/auth'

// 8. Internal — types
import type { UserProfile } from '@/types/user'

// 9. Internal — constants
import { colors, spacing } from '@/constants/theme'

// 10. Props interface (always directly above component)
interface SwipeCardProps {
  user: UserProfile
  onSwipe: (direction: 'left' | 'right' | 'up') => void
}

// 11. Component (named export)
export const SwipeCard = ({ user, onSwipe }: SwipeCardProps) => {
  // hooks declared first
  // derived state / computed values
  // handlers
  // render / return
}

// 12. StyleSheet at the very bottom
const styles = StyleSheet.create({ ... })
```

---

## 6. Styling Rules

- **Zero inline styles** — not a single `style={{ ... }}` in JSX, ever, no exceptions
- All styles defined in `StyleSheet.create({})` at the bottom of each file
- All color values from `constants/colors.ts` — never hardcode hex codes in component files
- All spacing values from `constants/spacing.ts` — never hardcode pixel numbers
- All font sizes from `constants/typography.ts` — never hardcode font sizes
- Import everything from `constants/theme.ts` which re-exports colors, spacing, and typography

```typescript
// ✅ Correct
import { colors, spacing, typography } from '@/constants/theme'

const styles = StyleSheet.create({
  container: { padding: spacing.md, backgroundColor: colors.background },
  title: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold }
})

// ❌ Wrong
<View style={{ padding: 16, backgroundColor: '#F5F5F5' }}>
<Text style={{ fontSize: 18 }}>Hello</Text>
```

---

## 7. State Management

- **Zustand** for all global/shared state — auth, profile, discovery, matches, chat, onboarding
- **React Hook Form** for all form state — never `useState` for form fields
- **Zod** for all form validation schemas — define schemas in the same file as the form, above the component
- **No `useState`** for data that comes from Firebase or needs to be shared between screens
- **`useState`** is only acceptable for purely local UI state (modal open/closed, active tab index, etc.)
- Zustand stores that need to survive app restarts use `zustand/middleware/persist` with `AsyncStorage`: auth, onboarding draft, user preferences

```typescript
// ✅ Correct — local UI state only
const [isModalOpen, setIsModalOpen] = useState(false)

// ❌ Wrong — server data must live in a store, not component state
const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
```

---

## 8. Internationalisation (i18n)

- **Zero hardcoded strings** in any component, screen, or hook
- Every user-facing string goes through `useTranslation()` and is defined in `i18n/en.json`
- Translation key format: `namespace.section.key`
  - `auth.phone.placeholder`
  - `onboarding.step1.firstName.label`
  - `errors.network.timeout`
  - `discovery.emptyState.title`
- When adding a new key, add it to all 4 files (`en.json`, `my.json`, `zh.json`, `ta.json`) — use the English value as a placeholder in non-English files until a real translation is provided
- Error messages are also translated — never show raw error strings to users

---

## 9. Platform (iOS & Android)

- **The app must work on both iOS and Android** — non-negotiable
- Use `Platform.OS === 'ios'` for platform-specific logic
- Apple Sign-In: iOS only — `{Platform.OS === 'ios' && <AppleSignInButton />}`
- Apple HealthKit: iOS only — guarded with `Platform.OS === 'ios'` (Phase 2)
- Google Fit: Android only — guarded with `Platform.OS === 'android'` (Phase 2)
- Biometric: use `expo-local-authentication` — handles Face ID and fingerprint automatically across platforms
- Haptics: use `expo-haptics` — cross-platform
- Never use a platform-specific API without a `Platform.OS` guard
- After every task, ask: "Would this break on Android?" and "Would this break on iOS?"

---

## 10. Firebase Rules

### Client-side
- **Never write business-critical data from the client** — match creation, age calculation, subscription status, ban logic, and report processing all happen in Cloud Functions only
- All Firestore client writes must be covered by security rules
- Never expose Firebase config in source code — read from `process.env` (`EXPO_PUBLIC_` prefix) only
- Use `serverTimestamp()` from `firebase/firestore` for all client-side timestamp writes — never `new Date()`

### Cloud Functions (2nd gen)
- This project uses **Firebase Cloud Functions 2nd generation** — the function signatures are different from v1
- Always verify the caller is authenticated at the top of every callable function:

```typescript
// ✅ Correct — 2nd gen callable function auth check
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'

export const getDiscoveryStack = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }
  const userId = request.auth.uid
  // ... rest of function
})

// ❌ Wrong — this is the v1 API, do not use
export const getDiscoveryStack = functions.https.onCall(async (data, context) => {
  if (!context.auth) { ... }  // context.auth is v1 only
})
```

- Use `admin.firestore.FieldValue.serverTimestamp()` for all Firestore timestamp writes inside Cloud Functions — never `new Date()`
- All Cloud Functions export from `asia-southeast1` region:

```typescript
import { onCall } from 'firebase-functions/v2/https'

export const myFunction = onCall({ region: 'asia-southeast1' }, async (request) => {
  ...
})
```

---

## 11. Animations (Reanimated 3)

This project uses **React Native Reanimated 3** with **react-native-gesture-handler v2**. The Reanimated 2 API (`useAnimatedGestureHandler`) is **deprecated and removed** — do not use it.

The correct pattern for gesture-driven animations in Reanimated 3:

```typescript
// ✅ Correct — Reanimated 3 + RNGH v2 pattern
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'

export const SwipeCard = ({ onSwipeLeft, onSwipeRight }: SwipeCardProps) => {
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX
      translateY.value = event.translationY
    })
    .onEnd((event) => {
      if (event.translationX > 100) {
        runOnJS(onSwipeRight)()           // ← runOnJS to call JS-thread callback
      } else if (event.translationX < -100) {
        runOnJS(onSwipeLeft)()
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 })
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 })
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${(translateX.value / 300) * 15}deg` },
    ]
  }))

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* card content */}
      </Animated.View>
    </GestureDetector>
  )
}

// ❌ Wrong — Reanimated 2 API, removed in Reanimated 3
const gestureHandler = useAnimatedGestureHandler({
  onActive: (event) => { translateX.value = event.translationX },
  onEnd: () => { setSwipeDirection('left') }   // also wrong — no state on UI thread
})
```

**Rules:**
- All animations: `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming`
- Gestures: `Gesture.Pan()` inside `GestureDetector` — never `PanResponder`
- **60fps target** — never update React state from inside a worklet (the `.onUpdate` or `.onEnd` callbacks)
- Use `runOnJS()` for any JS-thread side effect (store updates, navigation, callbacks)
- Swipe thresholds: 100px horizontal (like/pass), 100px vertical (super like)
- Swipe rotation range: -15° to +15° based on horizontal drag
- Snap-back spring: `{ damping: 15, stiffness: 150 }`

---

## 12. Image Handling

- All user-uploaded images must be compressed before upload: max 1080px wide, 80% quality, max 2MB
- Use `expo-image-manipulator` for compression — the compression utility lives in `utils/imageUtils.ts`
- Always show a `LoadingOverlay` during photo upload
- Firebase Storage path: `users/{userId}/photos/{index}.jpg`
- Store only download URLs in Firestore — never base64 strings
- Use `expo-image-picker` for camera and gallery access — always request permissions first and handle denial gracefully

---

## 13. Error Handling

- All Firebase and async calls wrapped in `try/catch`
- Never show raw Firebase error codes or messages to users
- All Firebase errors are mapped to user-friendly translated strings via `mapFirebaseError(error)` from `utils/errorUtils.ts` — this utility must be created as part of the auth service setup
- Error categories:
  - Network errors → toast with retry option
  - Auth errors → inline below the relevant field, never as an alert
  - Validation errors → inline below the relevant field via React Hook Form
  - Fatal/unexpected errors → caught by `ErrorBoundary` at app root
- Always show a loading indicator — never leave the user with no visual feedback during async operations

```typescript
// ✅ Correct
import { mapFirebaseError } from '@/utils/errorUtils'

try {
  await signInWithPhone(phoneNumber)
} catch (error) {
  const message = mapFirebaseError(error)   // returns i18n key or translated string
  setError('phone', { message })            // React Hook Form inline error
}

// ❌ Wrong
try {
  await signInWithPhone(phoneNumber)
} catch (error) {
  alert(error.message)   // raw Firebase error, exposes internals, terrible UX
}
```

---

## 14. Security & Privacy

- Rate limiting: 5 auth attempts per hour — enforced server-side via Firebase App Check
- OTP: 60-second resend timer on client, max 5 attempts on server
- Age gate: 18+ enforced server-side in `onUserCreated` Cloud Function — any client-side check is UX only, not security
- PDPA compliance: account deletion must remove all data from Firestore, Cloud Storage, and Firebase Auth in one operation
- Never log PII (names, phone numbers, emails, locations) to console in production
- Strava OAuth tokens stored in Firestore — never in AsyncStorage
- Daily like limit: 50 likes/day for free users — tracked in Firestore, not client-side only

---

## 15. Folder Ownership

Codex must not create files outside the designated folder for each concern:

| Concern | Folder |
|---|---|
| Screen-level UI | `app/{feature}/` |
| Reusable UI primitives | `components/ui/` |
| Feature-specific components | `components/{feature}/` |
| Global state (Zustand stores) | `store/` |
| Firebase service calls | `services/firebase/` |
| Third-party API calls | `services/` |
| Custom hooks | `hooks/` |
| TypeScript types and interfaces | `types/` |
| App constants and theme tokens | `constants/` |
| Pure utility functions | `utils/` |
| Translation files | `i18n/` |
| Cloud Functions | `functions/src/` |

---

## 16. Git Discipline

- One commit per completed task — never batch multiple tasks in one commit
- Commit message format: `task-XX: short description`
  - `task-05: set up theme system`
  - `task-13: build OTP verify screen`
- Never commit with TypeScript errors — run `tsc --noEmit` before committing
- Never commit with `console.log` statements left in component or service files
- `.env` is never committed — only `.env.example` with empty values

---

*CONVENTIONS.md — [APP_NAME] | April 2026*
*This file must be @-referenced in every Codex prompt. Do not modify without updating ARCHITECT.md accordingly.*
