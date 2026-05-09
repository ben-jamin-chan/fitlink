import React, { useEffect, useRef, useState } from 'react'

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { PhoneInput } from '@/components/ui/PhoneInput'

import {
  AppError,
  sendOTP,
  setPendingConfirmation,
} from '@/services/firebase/auth'

import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

import { colors, spacing, typography } from '@/constants/theme'
import { mapFirebaseError } from '@/utils/errorUtils'

type PhoneLoginNavProp = StackNavigationProp<AuthStackParamList, 'PhoneLogin'>

type PhoneFormData = z.infer<typeof phoneSchema>

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'errors.required')
    .regex(/^\d{7,12}$/, 'errors.auth.invalidPhone'),
})

const MAX_ATTEMPTS = 5
const LOCKOUT_SECONDS = 60

const isAppError = (error: unknown): error is AppError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  )
}

const getAuthErrorKey = (error: unknown): string => {
  if (isAppError(error)) {
    return error.code
  }

  return mapFirebaseError(error)
}

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
        setLockoutRemaining((previousValue) => {
          if (previousValue <= 1) {
            if (timerRef.current !== null) {
              clearInterval(timerRef.current)
            }

            return 0
          }

          return previousValue - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
      }
    }
  }, [lockoutRemaining])

  const isLocked = lockoutRemaining > 0

  const onSubmit = async (data: PhoneFormData): Promise<void> => {
    if (isLocked) {
      return
    }

    const fullPhone = `${countryCode}${data.phoneNumber}`
    setSubmitError(null)
    setIsLoading(true)

    try {
      const result = await sendOTP(fullPhone)
      setPendingConfirmation(result)
      navigation.navigate('OTPVerify', { phoneNumber: fullPhone })
    } catch (error) {
      const newCount = attemptCount + 1
      setAttemptCount(newCount)

      if (newCount >= MAX_ATTEMPTS) {
        setLockoutRemaining(LOCKOUT_SECONDS)
        setAttemptCount(0)
        setSubmitError('errors.auth.tooManyAttempts')
      } else {
        setSubmitError(getAuthErrorKey(error))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackPress = (): void => {
    navigation.goBack()
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={styles.back}
        onPress={handleBackPress}
        activeOpacity={0.7}
        accessibilityLabel={t('common.back')}
      >
        <Ionicons
          name="arrow-back"
          size={typography.sizes.xl}
          color={colors.gray[700]}
        />
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
                placeholder={t('auth.phone.placeholder')}
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
  },
  back: {
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    marginBottom: spacing.xl,
  },
  inputWrapper: {
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  buttonWrapper: {
    marginTop: spacing.lg,
  },
})
