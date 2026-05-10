import React, { useState } from 'react'

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
import { SafeAreaView } from 'react-native-safe-area-context'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

import { AppError, signInWithEmail } from '@/services/firebase/auth'

import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

import { colors, spacing, typography } from '@/constants/theme'
import { mapFirebaseError } from '@/utils/errorUtils'

type EmailLoginNavProp = StackNavigationProp<AuthStackParamList, 'EmailLogin'>

type LoginFormData = z.infer<typeof loginSchema>

const loginSchema = z.object({
  email: z.string().min(1, 'errors.required').email('errors.auth.invalidEmail'),
  password: z.string().min(1, 'errors.required'),
})

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
    } catch (error) {
      setSubmitError(getAuthErrorKey(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackPress = (): void => {
    navigation.goBack()
  }

  const handleSignUpPress = (): void => {
    navigation.navigate('SignUp')
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
                  error={
                    errors.email
                      ? t(errors.email.message ?? 'errors.required')
                      : undefined
                  }
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
                  error={
                    errors.password
                      ? t(errors.password.message ?? 'errors.required')
                      : undefined
                  }
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
            <TouchableOpacity onPress={handleSignUpPress} activeOpacity={0.7}>
              <Text style={styles.footerLink}>{t('auth.email.signup')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
    marginBottom: spacing.xl,
  },
  form: {
    marginBottom: spacing.md,
  },
  fieldGap: {
    height: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  buttonWrapper: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
  },
  footerLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
})
