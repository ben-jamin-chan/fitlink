# CODEX PROMPT — Task 14
# Email Login + Sign Up Screens + Input Component

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1.8 complete. Auth screens built so far:
- `app/auth/LandingScreen.tsx` — complete
- `app/auth/PhoneLoginScreen.tsx` — complete, uses `PhoneInput` + `Button`
- `app/auth/OTPVerifyScreen.tsx` — complete, uses `OTPInput` + `Button`
- `components/ui/Button.tsx` — all variants working
- `services/firebase/auth.ts` — exports `signInWithEmail`, `signUpWithEmail`
- `app/navigation/AuthNavigator.tsx` — still has `EmailLoginPlaceholder` and `SignUpPlaceholder`
- `i18n/en.json` — strings under `auth.email`, `auth.signup`, `errors.auth`

Task 14 completes the auth flow by building email login and sign up screens, and the reusable `Input` component that both screens (and future onboarding screens) use. After this task, all auth entry points are real screens.

---

## Task 14 — Email Login + Sign Up Screens + Input Component

**Files to create:**
- `components/ui/Input.tsx`
- `app/auth/EmailLoginScreen.tsx`
- `app/auth/SignUpScreen.tsx`

**Files to modify:**
- `app/navigation/AuthNavigator.tsx` — swap both remaining placeholders

---

### `components/ui/Input.tsx`

Reusable themed text input with label, inline error, and password visibility toggle. Used by EmailLogin, SignUp, and all onboarding form steps.

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardTypeOptions,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'

interface InputProps {
  label?: string
  placeholder?: string
  value: string
  onChangeText: (text: string) => void
  error?: string
  secureTextEntry?: boolean
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoComplete?: string
  textContentType?: string
  editable?: boolean
  multiline?: boolean
  numberOfLines?: number
  maxLength?: number
  onBlur?: () => void
}

export const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  editable = true,
  multiline = false,
  numberOfLines,
  maxLength,
  onBlur,
}: InputProps): React.JSX.Element => {
  const [isVisible, setIsVisible] = useState(false)

  const isSecure = secureTextEntry && !isVisible

  return (
    <View style={styles.wrapper}>
      {label !== undefined && label !== '' && (
        <Text style={styles.label}>{label}</Text>
      )}

      <View style={[
        styles.container,
        error !== undefined && error !== '' && styles.containerError,
        !editable && styles.containerDisabled,
        multiline && styles.containerMultiline,
      ]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.gray[400]}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete as 'off' | undefined}
          textContentType={textContentType as 'none' | undefined}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          onBlur={onBlur}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setIsVisible((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.gray[500]}
            />
          </TouchableOpacity>
        )}
      </View>

      {error !== undefined && error !== '' && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  } as ViewStyle,
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[700],
    marginBottom: spacing.xs,
  } as TextStyle,
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    height: 52,
    paddingHorizontal: spacing.md,
  } as ViewStyle,
  containerError: {
    borderColor: colors.danger,
  } as ViewStyle,
  containerDisabled: {
    backgroundColor: colors.gray[100],
    opacity: 0.7,
  } as ViewStyle,
  containerMultiline: {
    height: 'auto',
    minHeight: 52,
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  } as ViewStyle,
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  } as TextStyle,
  inputMultiline: {
    textAlignVertical: 'top',
  } as TextStyle,
  eyeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  } as ViewStyle,
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  } as TextStyle,
})
```

---

### `app/auth/EmailLoginScreen.tsx`

Email + password form with React Hook Form + Zod. On success, `RootNavigator` handles routing automatically via the auth listener.

```typescript
import React, { useState } from 'react'
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
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { signInWithEmail } from '@/services/firebase/auth'
import { mapFirebaseError } from '@/utils/errorUtils'
import { colors, spacing, typography } from '@/constants/theme'
import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

type EmailLoginNavProp = StackNavigationProp<AuthStackParamList, 'EmailLogin'>

const loginSchema = z.object({
  email: z.string().min(1, 'errors.required').email('errors.auth.invalidEmail'),
  password: z.string().min(1, 'errors.required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function EmailLoginScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<EmailLoginNavProp>()
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setSubmitError(null)
    setIsLoading(true)
    try {
      await signInWithEmail(data.email, data.password)
      // RootNavigator handles navigation automatically via authStore listener
    } catch (err) {
      setSubmitError(mapFirebaseError(err))
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
        <Text style={styles.title}>{t('auth.email.title')}</Text>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.email.emailPlaceholder')}
                placeholder={t('auth.email.emailPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email ? t(errors.email.message ?? 'errors.required') : undefined}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            )}
          />

          <View style={styles.fieldGap} />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.email.passwordPlaceholder')}
                placeholder={t('auth.email.passwordPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password ? t(errors.password.message ?? 'errors.required') : undefined}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
              />
            )}
          />
        </View>

        {submitError !== null && (
          <Text style={styles.errorText}>{t(submitError)}</Text>
        )}

        <View style={styles.buttonWrapper}>
          <Button
            label={t('auth.email.login')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.email.noAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.footerLink}>{t('auth.email.signup')}</Text>
          </TouchableOpacity>
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
    marginBottom: spacing.xl,
  } as TextStyle,
  form: {
    marginBottom: spacing.md,
  } as ViewStyle,
  fieldGap: {
    height: spacing.md,
  } as ViewStyle,
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.md,
  } as TextStyle,
  buttonWrapper: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  } as ViewStyle,
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  } as ViewStyle,
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
  } as TextStyle,
  footerLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
})
```

---

### `app/auth/SignUpScreen.tsx`

Email + password + confirm password. Zod validates password strength (min 8 chars, at least 1 uppercase, at least 1 number) and that both passwords match.

```typescript
import React, { useState } from 'react'
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
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { signUpWithEmail } from '@/services/firebase/auth'
import { mapFirebaseError } from '@/utils/errorUtils'
import { colors, spacing, typography } from '@/constants/theme'
import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

type SignUpNavProp = StackNavigationProp<AuthStackParamList, 'SignUp'>

const signUpSchema = z
  .object({
    email: z.string().min(1, 'errors.required').email('errors.auth.invalidEmail'),
    password: z
      .string()
      .min(8, 'errors.auth.weakPassword')
      .regex(/[A-Z]/, 'errors.auth.weakPassword')
      .regex(/[0-9]/, 'errors.auth.weakPassword'),
    confirmPassword: z.string().min(1, 'errors.required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'errors.auth.passwordMismatch',
    path: ['confirmPassword'],
  })

type SignUpFormData = z.infer<typeof signUpSchema>

export default function SignUpScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<SignUpNavProp>()
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: SignUpFormData): Promise<void> => {
    setSubmitError(null)
    setIsLoading(true)
    try {
      await signUpWithEmail(data.email, data.password)
      // RootNavigator handles navigation automatically via authStore listener
    } catch (err) {
      setSubmitError(mapFirebaseError(err))
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
        <Text style={styles.title}>{t('auth.signup.title')}</Text>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.signup.emailPlaceholder')}
                placeholder={t('auth.signup.emailPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email ? t(errors.email.message ?? 'errors.required') : undefined}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            )}
          />

          <View style={styles.fieldGap} />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.signup.passwordPlaceholder')}
                placeholder={t('auth.signup.passwordPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password ? t(errors.password.message ?? 'errors.required') : undefined}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
            )}
          />

          <View style={styles.fieldGap} />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.signup.confirmPlaceholder')}
                placeholder={t('auth.signup.confirmPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={
                  errors.confirmPassword
                    ? t(errors.confirmPassword.message ?? 'errors.required')
                    : undefined
                }
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
            )}
          />
        </View>

        {submitError !== null && (
          <Text style={styles.errorText}>{t(submitError)}</Text>
        )}

        <View style={styles.buttonWrapper}>
          <Button
            label={t('auth.signup.create')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.signup.hasAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('EmailLogin')}>
            <Text style={styles.footerLink}>{t('auth.signup.login')}</Text>
          </TouchableOpacity>
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
    marginBottom: spacing.xl,
  } as TextStyle,
  form: {
    marginBottom: spacing.md,
  } as ViewStyle,
  fieldGap: {
    height: spacing.md,
  } as ViewStyle,
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.md,
  } as TextStyle,
  buttonWrapper: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  } as ViewStyle,
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  } as ViewStyle,
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
  } as TextStyle,
  footerLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
})
```

---

### `app/navigation/AuthNavigator.tsx` — Update

Replace both remaining placeholders:

```typescript
// Add imports:
import EmailLoginScreen from '@/app/auth/EmailLoginScreen'
import SignUpScreen from '@/app/auth/SignUpScreen'

// Replace:
<Stack.Screen name="EmailLogin" component={EmailLoginPlaceholder} />
<Stack.Screen name="SignUp" component={SignUpPlaceholder} />

// With:
<Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
<Stack.Screen name="SignUp" component={SignUpScreen} />
```

Remove both `EmailLoginPlaceholder` and `SignUpPlaceholder` definitions entirely. `AuthNavigator` should now have zero inline placeholder components — all 5 screens are real.

---

## Acceptance Criteria

- [ ] `Input` renders label (if provided), text field, and error text
- [ ] `Input` with `secureTextEntry` shows eye toggle button — tapping shows/hides password
- [ ] `Input` shows red border and error text when `error` prop is set
- [ ] `EmailLoginScreen`: email + password fields, Zod validation, inline field errors
- [ ] `EmailLoginScreen`: submit calls `signInWithEmail`, shows loading on button
- [ ] `EmailLoginScreen`: failed login shows error below form (not as alert)
- [ ] `EmailLoginScreen`: "Sign Up" link navigates to `SignUpScreen`
- [ ] `SignUpScreen`: email + password + confirm password, all Zod validation
- [ ] `SignUpScreen`: password strength enforced (min 8, 1 uppercase, 1 number)
- [ ] `SignUpScreen`: passwords not matching shows error on confirm field
- [ ] `SignUpScreen`: submit calls `signUpWithEmail`, shows loading on button
- [ ] `SignUpScreen`: "Log In" link navigates to `EmailLoginScreen`
- [ ] Both screens: success triggers automatic navigation via auth listener — no manual navigate
- [ ] `AuthNavigator`: all 5 screens are real — zero inline placeholders remain
- [ ] All text through `t()`, zero inline styles
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`components/ui/Button.tsx`, `components/ui/PhoneInput.tsx`, `components/ui/OTPInput.tsx`, all existing auth screens, `store/authStore.ts`, `services/firebase/auth.ts`, `types/`, `constants/`, `i18n/`, `App.tsx`, `RootNavigator.tsx`, `MainTabNavigator.tsx`

## Commit
`git commit -m "task-14: email login and sign up screens with input component"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1.9] — YYYY-MM-DD
### Completed
- Task 14: Email login and sign up screens built, Input component created
- All 5 auth screens are now real — AuthNavigator has zero placeholder components
- Authentication phase (Tasks 08–14) complete

### Files Created / Modified
- components/ui/Input.tsx: label, error, secureTextEntry with eye toggle, multiline support
- app/auth/EmailLoginScreen.tsx: RHF+Zod, signInWithEmail, inline errors, link to SignUp
- app/auth/SignUpScreen.tsx: RHF+Zod, signUpWithEmail, password strength, confirm match
- app/navigation/AuthNavigator.tsx: EmailLoginPlaceholder and SignUpPlaceholder removed

### Next Up
- Task 15: Onboarding shell — OnboardingNavigator, ProgressDots, onboardingStore
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 15 prompt.

---

## Reasoning Level
Medium
