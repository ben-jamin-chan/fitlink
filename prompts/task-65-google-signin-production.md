# CODEX PROMPT — Task 65: Google Sign-In Production Flow

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 64 (Connected Apps Settings Screen) is complete. Phase 2D (fitness integrations) is fully
shipped. This task begins Phase 2E: Auth Production Fixes.

The current `signInWithGoogle` implementation in `services/firebase/auth.ts` uses
`signInWithPopup` — a Firebase web API that only functions inside Expo Go's dev environment and
is incompatible with production development builds. This must be replaced with the
`expo-auth-session` / `expo-web-browser` OAuth flow, which works correctly in EAS development
builds on physical devices.

**Architectural boundary:** `Google.useAuthRequest` is a React hook and therefore cannot live
in `services/firebase/auth.ts` (a plain TypeScript module). The refactor splits
responsibilities: `auth.ts` exports a new `signInWithGoogleCredential(idToken: string)` function
that accepts a token and completes the Firebase sign-in, while `LandingScreen.tsx` owns the
`Google.useAuthRequest` hook call and the `promptAsync()` trigger. This is the established
pattern for `useStripe` / `PremiumScreen` (Tasks 51–53) — follow it exactly.

**Do not introduce `signInWithPopup` anywhere. If it appears in any file after this task, that
is a regression.**

Existing files Codex must read before starting:

- `services/firebase/auth.ts` — currently exports `signInWithGoogle()` using `signInWithPopup`;
  `signInWithEmail`, `signInWithApple` stub, `signOut`, `AppError` type all already defined here
- `app/auth/LandingScreen.tsx` — calls `auth.signInWithGoogle()` from a button press handler;
  uses `useNavigation`, `authStore`, `Button` and `Input` components already built
- `store/authStore.ts` — `setUser()`, `setLoading()`, `setError()` actions available; persisted
  with AsyncStorage
- `utils/errorUtils.ts` — `mapFirebaseError(error)` returns i18n-keyed error strings
- `.env.example` — existing EXPO_PUBLIC_ keys for Firebase; Google client ID keys must be added
  here
- `i18n/en.json` — `auth.*` namespace already seeded; `auth.google.*` keys must be added if any
  new user-facing strings are introduced

**expo-auth-session** and **expo-web-browser** were both installed in Task 48. Do not install
them again.

---

## Task 65 — Google Sign-In Production Flow

**Files to modify:**
- `services/firebase/auth.ts` — replace `signInWithGoogle` with `signInWithGoogleCredential(idToken)`
- `app/auth/LandingScreen.tsx` — add `Google.useAuthRequest` hook; wire `promptAsync()` to button; call `signInWithGoogleCredential` on response
- `.env.example` — append three Google client ID placeholder keys
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `auth.google.missingToken` key

---

### `services/firebase/auth.ts` — Update

Replace the existing `signInWithGoogle` function. Everything else in the file (`signInWithApple`
stub, `signInWithEmail`, `signUpWithEmail`, `sendOTP`, `verifyOTP`, `signOut`,
`subscribeToAuthState`, `AppError`, `mapFirebaseError` import) must remain completely unchanged.

```typescript
// REMOVE the existing signInWithGoogle implementation that uses signInWithPopup:
// export const signInWithGoogle = async (): Promise<UserCredential> => {
//   const provider = new GoogleAuthProvider()
//   return signInWithPopup(auth, provider)
// }

// ADD in its place — import GoogleAuthProvider and signInWithCredential
// if not already imported at the top of the file:
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'

/**
 * Completes Google Sign-In using an ID token obtained from the expo-auth-session
 * OAuth flow in LandingScreen.tsx. Never call signInWithPopup — it is incompatible
 * with EAS development builds and is not used anywhere in this project.
 */
export const signInWithGoogleCredential = async (
  idToken: string,
): Promise<UserCredential> => {
  const credential = GoogleAuthProvider.credential(idToken)
  return signInWithCredential(auth, credential)
}
```

> Do not touch `signInWithApple`, `signInWithEmail`, `signUpWithEmail`, `sendOTP`,
> `verifyOTP`, `signOut`, `subscribeToAuthState`, `AppError`, or any imports that already
> exist in this file. Only add the new export and remove the old `signInWithGoogle`.

---

### `app/auth/LandingScreen.tsx` — Update

Add the `Google.useAuthRequest` hook at the top of the component and wire the `promptAsync()`
call to the existing "Continue with Google" button. Handle the response in a `useEffect`.

The full updated implementation scaffold is shown below. Study the existing file structure
(button layout, Apple guard, i18n, theme tokens, error handling) and preserve it exactly —
only the Google sign-in wiring changes. If the existing file has additional UI elements
(terms link tappable, dividers, sign-up route) that are not shown in the scaffold, preserve
them as-is and integrate the Google hook changes around them.

```typescript
// 1. React imports
import React, { useEffect, useState } from 'react'

// 2. React Native imports
import { View, Text, StyleSheet, Platform, ViewStyle, TextStyle } from 'react-native'

// 3. Third-party libraries (alphabetical)
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { useTranslation } from 'react-i18next'

// 4. Internal — stores
import { useAuthStore } from '@/store/authStore'

// 5. Internal — components
import { Button } from '@/components/ui/Button'

// 6. Internal — services
import { signInWithGoogleCredential, signInWithApple } from '@/services/firebase/auth'

// 7. Internal — types
import type { StackNavigationProp } from '@react-navigation/stack'
import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

// 8. Internal — constants
import { colors, spacing, typography } from '@/constants/theme'

// Required by expo-auth-session — completes the OAuth session redirect on app return.
// Must be called at module level (outside the component), not inside useEffect.
WebBrowser.maybeCompleteAuthSession()

type LandingScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Landing'>

interface LandingScreenProps {
  navigation: LandingScreenNavigationProp
}

export default function LandingScreen({ navigation }: LandingScreenProps): React.JSX.Element {
  const { t } = useTranslation()
  const { setUser, setLoading, setError } = useAuthStore()
  const [googleLoading, setGoogleLoading] = useState<boolean>(false)

  // Google OAuth hook — must be called unconditionally at component top level.
  // NOTE: Google Sign-In via expo-auth-session requires a development build.
  // It does not work in Expo Go. See BUILD.md for development build instructions.
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  })

  // Handle the OAuth response from expo-auth-session
  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken
      if (!idToken) {
        setError(t('auth.google.missingToken'))
        setGoogleLoading(false)
        return
      }
      void handleGoogleToken(idToken)
    } else if (response?.type === 'error' || response?.type === 'dismiss') {
      setGoogleLoading(false)
    }
  }, [response])

  const handleGoogleToken = async (idToken: string): Promise<void> => {
    try {
      setLoading(true)
      const credential = await signInWithGoogleCredential(idToken)
      setUser(credential.user)
    } catch (error) {
      setError(t('errors.generic'))
    } finally {
      setLoading(false)
      setGoogleLoading(false)
    }
  }

  const handleGooglePress = (): void => {
    setGoogleLoading(true)
    void promptAsync()
  }

  const handleApplePress = async (): Promise<void> => {
    try {
      setLoading(true)
      const credential = await signInWithApple()
      setUser(credential.user)
    } catch (error) {
      setError(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.appName}>{t('app.name')}</Text>
        <Text style={styles.tagline}>{t('auth.landing.tagline')}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={t('auth.landing.continuePhone')}
          variant="primary"
          onPress={() => navigation.navigate('PhoneLogin')}
        />

        <Button
          label={t('auth.landing.continueEmail')}
          variant="outline"
          onPress={() => navigation.navigate('EmailLogin')}
        />

        {/* disabled={!request} guards against calling promptAsync() before the hook
            has initialized. request is null until expo-auth-session is ready. */}
        <Button
          label={t('auth.landing.continueGoogle')}
          variant="outline"
          loading={googleLoading}
          disabled={!request || googleLoading}
          onPress={handleGooglePress}
        />

        {Platform.OS === 'ios' && (
          <Button
            label={t('auth.landing.continueApple')}
            variant="outline"
            onPress={() => void handleApplePress()}
          />
        )}
      </View>

      <Text style={styles.terms}>{t('auth.landing.termsNotice')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  } as ViewStyle,
  hero: {
    alignItems: 'center',
  } as ViewStyle,
  appName: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  } as TextStyle,
  tagline: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    textAlign: 'center',
  } as TextStyle,
  actions: {
    gap: spacing.md,
  } as ViewStyle,
  terms: {
    fontSize: typography.sizes.xs,
    color: colors.gray[400],
    textAlign: 'center',
  } as TextStyle,
})
```

---

### `.env.example` — Update

Append the following three keys at the bottom of the existing `.env.example` file. Do not
remove or reorder any existing keys.

```
# Google OAuth Client IDs (from Google Cloud Console — Credentials page)
# Required for Google Sign-In in EAS development builds (expo-auth-session)
# See: https://docs.expo.dev/guides/google-authentication/
EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO=
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=
```

---

### `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Add the following key under the `auth` namespace. If `auth.google` already exists as an object,
add `missingToken` as a property of it. If `auth.google` does not yet exist, add the object.
Check before writing — do not add a duplicate key.

Mirror the same key to `my.json`, `zh.json`, and `ta.json` using the English value as a
placeholder.

```json
{
  "auth": {
    "google": {
      "missingToken": "Google sign-in failed. Please try again."
    }
  }
}
```

---

## Important Architecture Notes for Codex

1. **`signInWithPopup` must not exist anywhere after this task.** Run
   `rg signInWithPopup --glob '*.ts' --glob '*.tsx'` before marking the task done. Any
   occurrence is a regression that blocks the EAS production build.

2. **`Google.useAuthRequest` is a hook — it belongs in the component, not the service.**
   It returns `[request, response, promptAsync]`. Only `promptAsync()` is called from the
   button handler. The `response` is processed exclusively in a `useEffect`. Do not move this
   hook into `auth.ts` or any non-component file.

3. **`WebBrowser.maybeCompleteAuthSession()` must be called at module level in
   `LandingScreen.tsx`, outside the component function.** Placing it inside `useEffect` or
   the component body will cause OAuth redirects to fail silently on return to the app.

4. **The Google button must gate on `!request`.** The `request` object from `useAuthRequest`
   is `null` until the hook finishes initializing. Calling `promptAsync()` before `request`
   is ready throws an unhandled promise rejection. The correct guard is
   `disabled={!request || googleLoading}`.

5. **`signInWithGoogleCredential` in `auth.ts` is a plain async function, not a hook.**
   It accepts `idToken: string` and calls Firebase's `signInWithCredential`. Do not add
   `useAuthRequest`, `WebBrowser`, or any hook-related imports to `auth.ts`.

6. **This task only fixes Google Sign-In.** The `signInWithApple` stub in `auth.ts` and the
   Apple button in `LandingScreen.tsx` are addressed in Task 66. Do not modify either beyond
   what already exists.

7. **No new packages needed.** `expo-auth-session` and `expo-web-browser` were both installed
   in Task 48. Do not run `npm install` or `npx expo install` for these packages.

8. **The `response.authentication?.idToken` access must be null-guarded.** `authentication`
   can be `null` even on a `'success'` response in edge cases. The implementation must check
   for a missing `idToken` and call `setError` with the `auth.google.missingToken` i18n key
   before returning.

---

## Acceptance Criteria

- [ ] `services/firebase/auth.ts` exports `signInWithGoogleCredential(idToken: string): Promise<UserCredential>` as a named export
- [ ] The old `signInWithGoogle` function (using `signInWithPopup`) is completely removed from `auth.ts`
- [ ] `signInWithPopup` does not appear in any `.ts` or `.tsx` file in the client codebase (`rg signInWithPopup` returns zero results)
- [ ] `LandingScreen.tsx` calls `Google.useAuthRequest` unconditionally at component top level
- [ ] `WebBrowser.maybeCompleteAuthSession()` is called at module level in `LandingScreen.tsx` (outside the component function)
- [ ] The Google button passes `disabled={!request || googleLoading}` — not just `disabled={googleLoading}`
- [ ] `response` from `useAuthRequest` is handled in a `useEffect` with `[response]` in its dependency array
- [ ] On `response.type === 'success'`, `idToken` is null-checked before calling `signInWithGoogleCredential`
- [ ] `handleGoogleToken` calls `signInWithGoogleCredential(idToken)` and passes `credential.user` to `authStore.setUser()`
- [ ] `setGoogleLoading(false)` is called in all branches of the response handler (success, error, dismiss, missing token)
- [ ] `signInWithApple` stub in `auth.ts` is unchanged
- [ ] `.env.example` has the three `EXPO_PUBLIC_GOOGLE_CLIENT_ID_*` keys appended with no existing keys removed
- [ ] `i18n/en.json` contains `auth.google.missingToken` with no duplicate keys
- [ ] `auth.google.missingToken` is mirrored to `my.json`, `zh.json`, and `ta.json`
- [ ] All user-facing strings use `t()` — no hardcoded English text in JSX
- [ ] All styles in `StyleSheet.create({})` — zero `style={{ }}` in JSX
- [ ] All imports use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/subscriptionStore.ts`, `store/fitnessStore.ts`,
`services/firebase/config.ts`, `services/strava.ts`, `services/healthKit.ts`,
`services/googleFit.ts`, `hooks/useAppleHealth.ts`, `hooks/useGoogleFit.ts`,
`functions/`, `firestore.rules`, `firestore.indexes.json`, `constants/`, `types/`,
`components/`, `app/navigation/`, `app/settings/`, `app/discovery/`, `app/matches/`,
`app/chat/`, `app/profile/`, `app/onboarding/`

---

## Commit

```
git commit -m "task-65: replace signInWithPopup with expo-auth-session google oauth flow"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2E — Task 65] — YYYY-MM-DD

### Completed

- Task 65: Google Sign-In production flow — signInWithPopup replaced with expo-auth-session OAuth
- services/firebase/auth.ts: signInWithGoogle removed; signInWithGoogleCredential(idToken) added as named export
- LandingScreen.tsx: Google.useAuthRequest hook wired; WebBrowser.maybeCompleteAuthSession() at module level; promptAsync() triggers OAuth browser flow; response handled in useEffect; signInWithGoogleCredential called on success; disabled guard includes !request
- .env.example: EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO/IOS/ANDROID keys appended
- i18n: auth.google.missingToken added to all 4 language files

### Files Created / Modified

- services/firebase/auth.ts: signInWithGoogle removed, signInWithGoogleCredential(idToken) added
- app/auth/LandingScreen.tsx: Google.useAuthRequest hook, WebBrowser.maybeCompleteAuthSession(), handleGooglePress, handleGoogleToken, !request disabled guard on Google button
- .env.example: three EXPO_PUBLIC_GOOGLE_CLIENT_ID_* placeholder keys appended
- i18n/en.json: auth.google.missingToken added
- i18n/my.json, zh.json, ta.json: auth.google.missingToken mirrored with English placeholder

### Architecture Decisions

- [Document any non-obvious choices — e.g. how the hook / service split was wired in the specific LandingScreen structure that existed]

### Known Issues / Deferred

- Google Sign-In requires a development build; cannot be verified in Expo Go
- Apple Sign-In stub unchanged — addressed in Task 66

### Next Up

- Task 66: Apple Sign-In Production Flow (replace signInWithApple stub with @invertase/react-native-apple-authentication)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 66 prompt.

---

## Reasoning Level

Medium
