# CODEX PROMPT — Task 13
# OTP Verify Screen + OTPInput Component

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1.7 complete. The following now exist and must not be touched unless explicitly stated:
- `components/ui/Button.tsx` — primary/outline/ghost variants
- `components/ui/PhoneInput.tsx` — country code picker + phone field
- `app/auth/PhoneLoginScreen.tsx` — calls `sendOTP`, calls `setPendingConfirmation`, navigates to OTPVerify with `{ phoneNumber }`
- `services/firebase/auth.ts` — exports `verifyOTP(confirmation, otp)`, `getPendingConfirmation()`, `sendOTP()`
- `store/authStore.ts` — Firebase listener wired; `setUser()` triggers `RootNavigator` to switch to main app automatically
- `app/navigation/AuthNavigator.tsx` — `OTPVerify: { phoneNumber: string }` in AuthStackParamList, still has `OTPVerifyPlaceholder`
- `i18n/en.json` — strings under `auth.otp` and `errors.auth`

Task 13 builds the OTP verify screen. On successful verification, `verifyOTP` returns a `UserCredential` — the Firebase auth state listener in `authStore` fires automatically and `RootNavigator` switches the user to the main app. No manual `navigation.navigate()` call is needed on success.

---

## Task 13 — OTP Verify Screen + OTPInput Component

**Files to create:**
- `components/ui/OTPInput.tsx`
- `app/auth/OTPVerifyScreen.tsx`

**Files to modify:**
- `app/navigation/AuthNavigator.tsx` — swap `OTPVerifyPlaceholder` for real screen

---

### `components/ui/OTPInput.tsx`

Six individual single-digit boxes. Auto-advance on input, backspace moves to previous box, paste fills all boxes, calls `onComplete` automatically when all six are filled.

```typescript
import React, { useRef, useState } from 'react'
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  TextInputChangeEventData,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'

const OTP_LENGTH = 6

interface OTPInputProps {
  onComplete: (otp: string) => void
  onReset?: () => void
  error?: boolean
  disabled?: boolean
}

export const OTPInput = ({
  onComplete,
  onReset,
  error = false,
  disabled = false,
}: OTPInputProps): React.JSX.Element => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null))

  const focusBox = (index: number): void => {
    if (index >= 0 && index < OTP_LENGTH) {
      inputRefs.current[index]?.focus()
    }
  }

  const handleChange = (
    event: NativeSyntheticEvent<TextInputChangeEventData>,
    index: number
  ): void => {
    const text = event.nativeEvent.text

    // Handle paste: text.length > 1 means a full OTP was pasted
    if (text.length > 1) {
      const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH)
      const newDigits = Array(OTP_LENGTH).fill('')
      for (let i = 0; i < cleaned.length; i++) {
        newDigits[i] = cleaned[i]
      }
      setDigits(newDigits)
      focusBox(Math.min(cleaned.length - 1, OTP_LENGTH - 1))
      if (cleaned.length === OTP_LENGTH) {
        onComplete(cleaned)
      }
      return
    }

    const digit = text.replace(/\D/g, '')
    if (digit.length === 0) return

    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)

    if (index < OTP_LENGTH - 1) {
      focusBox(index + 1)
    }

    if (newDigits.every((d) => d !== '')) {
      onComplete(newDigits.join(''))
    } else {
      onReset?.()
    }
  }

  const handleKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ): void => {
    if (event.nativeEvent.key === 'Backspace') {
      const newDigits = [...digits]
      if (newDigits[index] !== '') {
        newDigits[index] = ''
        setDigits(newDigits)
        onReset?.()
      } else if (index > 0) {
        newDigits[index - 1] = ''
        setDigits(newDigits)
        focusBox(index - 1)
        onReset?.()
      }
    }
  }

  return (
    <View style={styles.container}>
      {Array(OTP_LENGTH)
        .fill(null)
        .map((_, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref
            }}
            style={[
              styles.box,
              digits[index] !== '' && styles.boxFilled,
              error && styles.boxError,
            ]}
            value={digits[index]}
            onChange={(e) => handleChange(e, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            selectTextOnFocus
            editable={!disabled}
            textAlign="center"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
        ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  } as ViewStyle,
  box: {
    flex: 1,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    backgroundColor: colors.surface,
  } as TextStyle,
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  } as TextStyle,
  boxError: {
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  } as TextStyle,
})
```

---

### `app/auth/OTPVerifyScreen.tsx`

Reads `phoneNumber` from route params. Gets `ConfirmationResult` from `getPendingConfirmation()`. Auto-verifies on 6-digit completion. On success, navigation is handled automatically by `RootNavigator`.

```typescript
import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { OTPInput } from '@/components/ui/OTPInput'
import { Button } from '@/components/ui/Button'
import {
  verifyOTP,
  sendOTP,
  getPendingConfirmation,
  setPendingConfirmation,
} from '@/services/firebase/auth'
import { mapFirebaseError } from '@/utils/errorUtils'
import { colors, spacing, typography } from '@/constants/theme'
import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

type OTPVerifyRouteProp = RouteProp<AuthStackParamList, 'OTPVerify'>
type OTPVerifyNavProp = StackNavigationProp<AuthStackParamList, 'OTPVerify'>

const RESEND_SECONDS = 60

export default function OTPVerifyScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const route = useRoute<OTPVerifyRouteProp>()
  const navigation = useNavigation<OTPVerifyNavProp>()
  const { phoneNumber } = route.params

  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_SECONDS)
  const [otpKey, setOtpKey] = useState(0)   // increment to remount OTPInput and clear boxes

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    startCountdown()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startCountdown = (): void => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCountdown(RESEND_SECONDS)
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleOTPComplete = async (otp: string): Promise<void> => {
    const confirmation = getPendingConfirmation()
    if (confirmation === null) {
      setError('errors.generic')
      setHasError(true)
      return
    }

    setError(null)
    setHasError(false)
    setIsVerifying(true)

    try {
      await verifyOTP(confirmation, otp)
      setPendingConfirmation(null)
      // RootNavigator handles navigation automatically via authStore listener
    } catch (err) {
      setError(mapFirebaseError(err))
      setHasError(true)
      setOtpKey((prev) => prev + 1)   // clear boxes on wrong OTP
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async (): Promise<void> => {
    if (countdown > 0) return
    setIsResending(true)
    setError(null)
    setHasError(false)

    try {
      const newConfirmation = await sendOTP(phoneNumber)
      setPendingConfirmation(newConfirmation)
      setOtpKey((prev) => prev + 1)
      startCountdown()
    } catch (err) {
      setError(mapFirebaseError(err))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.otp.title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.otp.subtitle', { phone: phoneNumber })}
        </Text>

        <View style={styles.otpWrapper}>
          <OTPInput
            key={otpKey}
            onComplete={handleOTPComplete}
            onReset={() => {
              setError(null)
              setHasError(false)
            }}
            error={hasError}
            disabled={isVerifying}
          />
        </View>

        {error !== null && (
          <Text style={styles.errorText}>{t(error)}</Text>
        )}

        {isVerifying && (
          <Text style={styles.verifyingText}>{t('common.loading')}</Text>
        )}

        <View style={styles.resendWrapper}>
          {countdown > 0 ? (
            <Text style={styles.countdown}>
              {t('auth.otp.resendIn', { seconds: countdown })}
            </Text>
          ) : (
            <Button
              label={t('auth.otp.resend')}
              onPress={handleResend}
              variant="ghost"
              loading={isResending}
              fullWidth={false}
            />
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  } as ViewStyle,
  back: {
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  } as ViewStyle,
  backText: {
    fontSize: typography.sizes.xl,
    color: colors.gray[700],
  } as TextStyle,
  content: {
    flex: 1,
    paddingTop: spacing.xl,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
  } as TextStyle,
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    marginBottom: spacing.xl,
  } as TextStyle,
  otpWrapper: {
    marginBottom: spacing.md,
  } as ViewStyle,
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.sm,
  } as TextStyle,
  verifyingText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.sm,
  } as TextStyle,
  resendWrapper: {
    alignItems: 'center',
    marginTop: spacing.xl,
  } as ViewStyle,
  countdown: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
  } as TextStyle,
})
```

---

### `app/navigation/AuthNavigator.tsx` — Update

```typescript
// Add import:
import OTPVerifyScreen from '@/app/auth/OTPVerifyScreen'

// Replace:
<Stack.Screen name="OTPVerify" component={OTPVerifyPlaceholder} />
// With:
<Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
```

Remove `OTPVerifyPlaceholder` definition entirely. Touch nothing else.

---

## Full Phone Auth Flow After This Task

```
Landing → "Continue with Phone"
  → PhoneLoginScreen: enter number → sendOTP → setPendingConfirmation → navigate OTPVerify
  → OTPVerifyScreen: enter 6 digits → verifyOTP(getPendingConfirmation(), otp)
  → success: authStore listener fires → RootNavigator switches to MainTabNavigator
```

---

## Acceptance Criteria

- [ ] OTPInput renders 6 boxes in a row
- [ ] Typing a digit advances focus to next box automatically
- [ ] Backspace on filled box clears it; backspace on empty box moves to previous
- [ ] Pasting a 6-digit string fills all boxes and triggers `onComplete`
- [ ] Filled boxes: green border; error state: red border
- [ ] All 6 digits filled → `verifyOTP` called automatically
- [ ] Wrong OTP: error shown, boxes cleared (key increments)
- [ ] Resend countdown starts at 60s on mount
- [ ] Resend button only enabled when countdown reaches 0
- [ ] Resend: calls `sendOTP`, updates pending confirmation, resets boxes and countdown
- [ ] Successful verify: user lands on Discover tab (no manual navigate call)
- [ ] All text through `t()`, zero inline styles
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`components/ui/Button.tsx`, `components/ui/PhoneInput.tsx`, `app/auth/LandingScreen.tsx`, `app/auth/PhoneLoginScreen.tsx`, `store/authStore.ts`, `types/`, `constants/`, `i18n/`, `App.tsx`, `RootNavigator.tsx`, `MainTabNavigator.tsx`

## Commit
`git commit -m "task-13: otp verify screen and otp input component"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1.8] — YYYY-MM-DD
### Completed
- Task 13: OTP verify screen built, OTPInput component created
- Full phone auth flow end-to-end: Phone → OTP → main app (Discover tab)
- AuthNavigator updated to use real OTPVerifyScreen

### Files Created / Modified
- components/ui/OTPInput.tsx: 6-box input, auto-advance, backspace, paste support, auto-submit
- app/auth/OTPVerifyScreen.tsx: auto-verify on completion, resend with countdown, error clears boxes
- app/navigation/AuthNavigator.tsx: OTPVerifyPlaceholder replaced with OTPVerifyScreen

### Next Up
- Task 14: Email login + sign up screens + Input component
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 14 prompt.

---

## Reasoning Level
Medium
