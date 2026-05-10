import React, { useEffect, useRef, useState } from 'react'

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/Button'
import { OTPInput } from '@/components/ui/OTPInput'

import {
  AppError,
  getPendingConfirmation,
  sendOTP,
  setPendingConfirmation,
  verifyOTP,
} from '@/services/firebase/auth'

import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

import { colors, spacing, typography } from '@/constants/theme'
import { mapFirebaseError } from '@/utils/errorUtils'

type OTPVerifyRouteProp = RouteProp<AuthStackParamList, 'OTPVerify'>
type OTPVerifyNavProp = StackNavigationProp<AuthStackParamList, 'OTPVerify'>

const RESEND_SECONDS = 60

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
  const [otpKey, setOtpKey] = useState(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCountdown = (): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
    }

    setCountdown(RESEND_SECONDS)
    timerRef.current = setInterval(() => {
      setCountdown((previousValue) => {
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

  useEffect(() => {
    startCountdown()

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const resetError = (): void => {
    setError(null)
    setHasError(false)
  }

  const handleOTPComplete = async (otp: string): Promise<void> => {
    const confirmation = getPendingConfirmation()

    if (confirmation === null) {
      setError('errors.generic')
      setHasError(true)
      return
    }

    resetError()
    setIsVerifying(true)

    try {
      await verifyOTP(confirmation, otp)
      setPendingConfirmation(null)
    } catch (caughtError) {
      setError(getAuthErrorKey(caughtError))
      setHasError(true)
      setOtpKey((previousValue) => previousValue + 1)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async (): Promise<void> => {
    if (countdown > 0) {
      return
    }

    setIsResending(true)
    resetError()

    try {
      const newConfirmation = await sendOTP(phoneNumber)
      setPendingConfirmation(newConfirmation)
      setOtpKey((previousValue) => previousValue + 1)
      startCountdown()
    } catch (caughtError) {
      setError(getAuthErrorKey(caughtError))
      setHasError(true)
    } finally {
      setIsResending(false)
    }
  }

  const handleBackPress = (): void => {
    navigation.goBack()
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
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
          <Text style={styles.title}>{t('auth.otp.title')}</Text>
          <Text style={styles.subtitle}>
            {t('auth.otp.subtitle', { phone: phoneNumber })}
          </Text>

          <View style={styles.otpWrapper}>
            <OTPInput
              key={otpKey}
              onComplete={handleOTPComplete}
              onReset={resetError}
              error={hasError}
              disabled={isVerifying}
            />
          </View>

          {error !== null && <Text style={styles.errorText}>{t(error)}</Text>}

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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
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
  otpWrapper: {
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  verifyingText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  resendWrapper: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  countdown: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
  },
})
