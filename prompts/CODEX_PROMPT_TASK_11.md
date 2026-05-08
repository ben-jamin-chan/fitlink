# CODEX PROMPT — Task 11
# Landing Screen + Button Component

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1.5 complete. The following now exist and must not be touched unless explicitly stated:
- `store/authStore.ts` — full implementation, Firebase listener wired, persisted
- `services/firebase/auth.ts` — exports `signInWithGoogle`, `signInWithApple`, `AppError`
- `app/navigation/AuthNavigator.tsx` — has placeholder `LandingPlaceholder` component inline
- `i18n/en.json` — all landing screen strings exist under `auth.landing` and `errors` keys
- `utils/errorUtils.ts` — `mapFirebaseError` available
- `constants/theme.ts` — `colors`, `spacing`, `typography`, `borderRadius` all exported

Task 11 builds the first real visible screen. It creates the `Button` UI primitive (used by all auth and onboarding screens) and the `LandingScreen`. After this task, the app will show a real landing screen instead of the "Landing" placeholder text.

---

## Task 11 — Landing Screen + Button Component

**Files to create:**
- `components/ui/Button.tsx`
- `app/auth/LandingScreen.tsx`

**Files to modify:**
- `app/navigation/AuthNavigator.tsx` — swap `LandingPlaceholder` for real `LandingScreen`

---

### `components/ui/Button.tsx`

The primary UI primitive used across the entire app. Every auth and onboarding screen uses it.

```typescript
import React from 'react'
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'

export type ButtonVariant = 'primary' | 'outline' | 'ghost'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
}

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
}: ButtonProps): React.JSX.Element => {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.white : colors.primary}
        />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  } as ViewStyle,
  fullWidth: {
    width: '100%',
  } as ViewStyle,
  primary: {
    backgroundColor: colors.primary,
  } as ViewStyle,
  outline: {
    backgroundColor: colors.transparent,
    borderWidth: 1.5,
    borderColor: colors.primary,
  } as ViewStyle,
  ghost: {
    backgroundColor: colors.transparent,
  } as ViewStyle,
  disabled: {
    opacity: 0.5,
  } as ViewStyle,
  label: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
  primaryLabel: {
    color: colors.white,
  } as TextStyle,
  outlineLabel: {
    color: colors.primary,
  } as TextStyle,
  ghostLabel: {
    color: colors.primary,
  } as TextStyle,
})
```

---

### `app/auth/LandingScreen.tsx`

The first screen users see. On successful Google or Apple sign-in, do NOT call `navigation.navigate()` — the `RootNavigator` handles routing automatically via the `authStore` listener wired in Task 10.

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  Platform,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { signInWithGoogle, signInWithApple } from '@/services/firebase/auth'
import { useAuthStore } from '@/store/authStore'
import { mapFirebaseError } from '@/utils/errorUtils'
import { colors, spacing, typography } from '@/constants/theme'
import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

type LandingNavProp = StackNavigationProp<AuthStackParamList, 'Landing'>

export default function LandingScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<LandingNavProp>()
  const setError = useAuthStore((state) => state.setError)

  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)

  const handleGoogleSignIn = async (): Promise<void> => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      // RootNavigator handles navigation automatically via authStore
    } catch (err) {
      setError(mapFirebaseError(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleAppleSignIn = async (): Promise<void> => {
    setAppleLoading(true)
    try {
      await signInWithApple()
    } catch (err) {
      setError(mapFirebaseError(err))
    } finally {
      setAppleLoading(false)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>[APP_NAME]</Text>
        <Text style={styles.tagline}>{t('auth.landing.tagline')}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          label={t('auth.landing.continuePhone')}
          onPress={() => navigation.navigate('PhoneLogin')}
          variant="primary"
        />
        <View style={styles.gap} />
        <Button
          label={t('auth.landing.continueEmail')}
          onPress={() => navigation.navigate('EmailLogin')}
          variant="outline"
        />
        <View style={styles.gap} />
        <Button
          label={t('auth.landing.continueGoogle')}
          onPress={handleGoogleSignIn}
          variant="outline"
          loading={googleLoading}
        />
        {Platform.OS === 'ios' && (
          <>
            <View style={styles.gap} />
            <Button
              label={t('auth.landing.continueApple')}
              onPress={handleAppleSignIn}
              variant="outline"
              loading={appleLoading}
            />
          </>
        )}
      </View>

      <View style={styles.termsContainer}>
        <Text style={styles.termsText}>
          {t('auth.landing.terms')}{' '}
          <Text
            style={styles.termsLink}
            onPress={() => void Linking.openURL('https://example.com/terms')}
          >
            Terms of Service
          </Text>
          {' and '}
          <Text
            style={styles.termsLink}
            onPress={() => void Linking.openURL('https://example.com/privacy')}
          >
            Privacy Policy
          </Text>
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoText: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: typography.sizes.lg,
    color: colors.gray[600],
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  gap: {
    height: spacing.md,
  },
  termsContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  termsText: {
    fontSize: typography.sizes.xs,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: typography.sizes.xs * 1.6,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
})
```

---

### `app/navigation/AuthNavigator.tsx` — Update

Replace only the Landing screen registration. All other screens stay as placeholder components.

```typescript
// Add at top with other imports:
import LandingScreen from '@/app/auth/LandingScreen'

// Replace:
<Stack.Screen name="Landing" component={LandingPlaceholder} />

// With:
<Stack.Screen name="Landing" component={LandingScreen} />
```

Remove the `LandingPlaceholder` component definition entirely from the file — it is no longer needed. Do not touch `AuthStackParamList`, `AuthNavigator`, or any other screen registrations.

---

## Acceptance Criteria

- [ ] `Button` renders correctly in all three variants on device
- [ ] `Button` shows spinner when `loading={true}`, hides label
- [ ] `Button` is non-tappable when `disabled` or `loading`
- [ ] Landing screen shows: app name text, tagline, 3 auth buttons (4 on iOS), terms
- [ ] "Continue with Phone" navigates to PhoneLogin placeholder
- [ ] "Continue with Email" navigates to EmailLogin placeholder
- [ ] "Continue with Google" triggers loading state on button
- [ ] Apple button renders only on iOS
- [ ] `AuthNavigator` uses real `LandingScreen` — no more inline placeholder
- [ ] All text through `t()` — zero hardcoded strings
- [ ] Zero inline styles
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`store/authStore.ts`, `services/firebase/auth.ts`, `utils/errorUtils.ts`, `constants/`, `types/`, `i18n/`, `App.tsx`, `RootNavigator.tsx`, `MainTabNavigator.tsx`

## Commit
`git commit -m "task-11: landing screen and button component"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1.6] — YYYY-MM-DD
### Completed
- Task 11: Landing screen built, Button component created
- AuthNavigator updated to use real LandingScreen

### Files Created / Modified
- components/ui/Button.tsx: primary/outline/ghost variants, loading and disabled states
- app/auth/LandingScreen.tsx: logo, tagline, auth buttons (Apple iOS-only), terms
- app/navigation/AuthNavigator.tsx: LandingPlaceholder replaced with LandingScreen

### Next Up
- Task 12: Phone login screen + PhoneInput component
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 12 prompt.

---

## Reasoning Level
Medium
