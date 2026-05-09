# CODEX PROMPT — Task 12
# Phone Login Screen + PhoneInput Component

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1.6 complete. The following now exist and must not be touched unless explicitly stated:
- `components/ui/Button.tsx` — primary/outline/ghost variants, loading, disabled
- `app/auth/LandingScreen.tsx` — complete, navigates to PhoneLogin and EmailLogin
- `services/firebase/auth.ts` — exports `sendOTP(phoneNumber): Promise<ConfirmationResult>` and `verifyOTP`
- `app/navigation/AuthNavigator.tsx` — `AuthStackParamList` has `OTPVerify: { phoneNumber: string }`
- `i18n/en.json` — strings exist under `auth.phone`, `auth.otp`, `errors.auth`

Task 12 builds the phone login screen. The key technical challenge: Firebase's `ConfirmationResult` object cannot be passed as a React Navigation route param — it is a live object with methods, not a serialisable value. The solution is a module-level variable in the auth service that both PhoneLoginScreen (writer) and OTPVerifyScreen (reader, Task 13) access.

---

## Task 12 — Phone Login Screen + PhoneInput Component

**Files to create:**
- `components/ui/PhoneInput.tsx`
- `app/auth/PhoneLoginScreen.tsx`

**Files to modify:**
- `services/firebase/auth.ts` — add 3 exports for ConfirmationResult handoff
- `app/navigation/AuthNavigator.tsx` — swap PhoneLoginPlaceholder for real screen

---

### `services/firebase/auth.ts` — Add Confirmation Result Store

Add these three exports to the existing file after the imports. Do not modify any existing functions:

```typescript
// Module-level store for ConfirmationResult.
// ConfirmationResult cannot be serialised into nav params or AsyncStorage.
// PhoneLoginScreen writes it; OTPVerifyScreen reads it.
let _pendingConfirmation: ConfirmationResult | null = null

export const setPendingConfirmation = (result: ConfirmationResult | null): void => {
  _pendingConfirmation = result
}

export const getPendingConfirmation = (): ConfirmationResult | null => {
  return _pendingConfirmation
}
```

---

### `components/ui/PhoneInput.tsx`

Country code selector (bottom sheet) + phone number field. No external picker library — use a FlatList modal with SEA-focused country list.

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'

interface CountryCode {
  code: string
  flag: string
  name: string
}

const COUNTRY_CODES: CountryCode[] = [
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+1',  flag: '🇺🇸', name: 'United States' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
]

interface PhoneInputProps {
  value: string
  onChangeText: (text: string) => void
  onCountryCodeChange: (code: string) => void
  selectedCountryCode: string
  error?: string
  placeholder?: string
}

export const PhoneInput = ({
  value,
  onChangeText,
  onCountryCodeChange,
  selectedCountryCode,
  error,
  placeholder = '12 345 6789',
}: PhoneInputProps): React.JSX.Element => {
  const [modalVisible, setModalVisible] = useState(false)

  const selectedCountry =
    COUNTRY_CODES.find((c) => c.code === selectedCountryCode) ?? COUNTRY_CODES[0]

  const handleSelect = (country: CountryCode): void => {
    onCountryCodeChange(country.code)
    setModalVisible(false)
  }

  return (
    <View>
      <View style={[styles.container, error ? styles.containerError : undefined]}>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={styles.code}>{selectedCountry.code}</Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.gray[400]}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={15}
        />
      </View>
      {error !== undefined && error !== '' && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rowFlag}>{item.flag}</Text>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    height: 52,
    overflow: 'hidden',
  } as ViewStyle,
  containerError: {
    borderColor: colors.danger,
  } as ViewStyle,
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  } as ViewStyle,
  flag: {
    fontSize: typography.sizes.lg,
  } as TextStyle,
  code: {
    fontSize: typography.sizes.md,
    color: colors.gray[800],
    fontWeight: typography.weights.medium,
  } as TextStyle,
  chevron: {
    fontSize: typography.sizes.xs,
    color: colors.gray[500],
  } as TextStyle,
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.gray[300],
  } as ViewStyle,
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  } as TextStyle,
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  } as TextStyle,
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '60%',
  } as ViewStyle,
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray[300],
    borderRadius: borderRadius.full,
    alignSelf: 'center',
    marginVertical: spacing.md,
  } as ViewStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  } as ViewStyle,
  rowFlag: {
    fontSize: typography.sizes.xl,
  } as TextStyle,
  rowName: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[800],
  } as TextStyle,
  rowCode: {
    fontSize: typography.sizes.md,
    color: colors.gray[500],
    fontWeight: typography.weights.medium,
  } as TextStyle,
})
```

---

### `app/auth/PhoneLoginScreen.tsx`

React Hook Form + Zod validation. On OTP send success: store `ConfirmationResult` via `setPendingConfirmation`, navigate to `OTPVerify` with the full phone number. Client-side lockout after 5 failed attempts.

```typescript
import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Button } from '@/components/ui/Button'
import { sendOTP, setPendingConfirmation } from '@/services/firebase/auth'
import { mapFirebaseError } from '@/utils/errorUtils'
import { colors, spacing, typography } from '@/constants/theme'
import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

type PhoneLoginNavProp = StackNavigationProp<AuthStackParamList, 'PhoneLogin'>

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'errors.required')
    .regex(/^\d{7,12}$/, 'errors.auth.invalidPhone'),
})

type PhoneFormData = z.infer<typeof phoneSchema>

const MAX_ATTEMPTS = 5
const LOCKOUT_SECONDS = 60

export default function PhoneLoginScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<PhoneLoginNavProp>()

  const [countryCode, setCountryCode] = useState('+60')
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: '' },
  })

  useEffect(() => {
    if (lockoutRemaining > 0) {
      timerRef.current = setInterval(() => {
        setLockoutRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [lockoutRemaining])

  const isLocked = lockoutRemaining > 0

  const onSubmit = async (data: PhoneFormData): Promise<void> => {
    if (isLocked) return
    const fullPhone = `${countryCode}${data.phoneNumber}`
    setSubmitError(null)
    setIsLoading(true)
    try {
      const result = await sendOTP(fullPhone)
      setPendingConfirmation(result)
      navigation.navigate('OTPVerify', { phoneNumber: fullPhone })
    } catch (err) {
      const newCount = attemptCount + 1
      setAttemptCount(newCount)
      if (newCount >= MAX_ATTEMPTS) {
        setLockoutRemaining(LOCKOUT_SECONDS)
        setAttemptCount(0)
        setSubmitError('errors.auth.tooManyAttempts')
      } else {
        setSubmitError(mapFirebaseError(err))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.phone.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.phone.subtitle')}</Text>

        <View style={styles.inputWrapper}>
          <Controller
            control={control}
            name="phoneNumber"
            render={({ field: { onChange, value } }) => (
              <PhoneInput
                value={value}
                onChangeText={onChange}
                onCountryCodeChange={setCountryCode}
                selectedCountryCode={countryCode}
                error={
                  errors.phoneNumber
                    ? t(errors.phoneNumber.message ?? 'errors.required')
                    : undefined
                }
              />
            )}
          />
        </View>

        {submitError !== null && (
          <Text style={styles.errorText}>
            {submitError === 'errors.auth.tooManyAttempts'
              ? t(submitError, { minutes: '1' })
              : t(submitError)}
          </Text>
        )}

        <View style={styles.buttonWrapper}>
          <Button
            label={
              isLocked
                ? t('auth.otp.resendIn', { seconds: lockoutRemaining })
                : t('auth.phone.send')
            }
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            disabled={isLocked}
          />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  inputWrapper: {
    marginBottom: spacing.md,
  } as ViewStyle,
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.md,
  } as TextStyle,
  buttonWrapper: {
    marginTop: spacing.lg,
  } as ViewStyle,
})
```

---

### `app/navigation/AuthNavigator.tsx` — Update

```typescript
// Add import:
import PhoneLoginScreen from '@/app/auth/PhoneLoginScreen'

// Replace:
<Stack.Screen name="PhoneLogin" component={PhoneLoginPlaceholder} />
// With:
<Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
```

Remove `PhoneLoginPlaceholder` definition entirely. Do not touch anything else.

---

## Acceptance Criteria

- [ ] `PhoneInput` renders country flag, code, divider, and text field in one row
- [ ] Tapping country code opens bottom sheet with 9 country options
- [ ] Selecting a country updates flag + code and closes modal
- [ ] Red border and error text appear when `error` prop is set
- [ ] Zod validation blocks submit on empty or invalid format
- [ ] Submit calls `sendOTP(countryCode + phoneNumber)` with button in loading state
- [ ] Success: `setPendingConfirmation` called, navigates to OTPVerify with phoneNumber param
- [ ] Failure: error text shown below input
- [ ] 5 failures: 60-second lockout, button disabled with countdown label
- [ ] Back arrow returns to Landing
- [ ] Zero hardcoded strings, zero inline styles
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`components/ui/Button.tsx`, `app/auth/LandingScreen.tsx`, `store/authStore.ts`, `types/`, `constants/`, `i18n/`, `App.tsx`, `RootNavigator.tsx`, `MainTabNavigator.tsx`

## Commit
`git commit -m "task-12: phone login screen and phone input component"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1.7] — YYYY-MM-DD
### Completed
- Task 12: Phone login screen built, PhoneInput component created
- services/firebase/auth.ts: added setPendingConfirmation/getPendingConfirmation for ConfirmationResult handoff
- AuthNavigator updated to use real PhoneLoginScreen

### Files Created / Modified
- components/ui/PhoneInput.tsx: country code picker (9 SEA+global codes), phone field, error state
- app/auth/PhoneLoginScreen.tsx: RHF+Zod, sendOTP, 5-attempt lockout with countdown
- services/firebase/auth.ts: module-level ConfirmationResult store (3 new exports)
- app/navigation/AuthNavigator.tsx: PhoneLoginPlaceholder replaced with PhoneLoginScreen

### Known Issues / Deferred
- sendOTP in Expo Go requires test phone numbers in Firebase Console (no reCAPTCHA yet)
- Add test number: Firebase Console → Authentication → Sign-in method → Phone → Test numbers

### Next Up
- Task 13: OTP verify screen + OTPInput component
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 13 prompt.

---

## Reasoning Level
Medium
