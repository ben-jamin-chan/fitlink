import React, { useCallback, useEffect, useState } from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'

import { Button } from '@/components/ui/Button'

import { authenticateWithBiometric } from '@/hooks/useBiometric'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

export default function BiometricPromptScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const { setBiometricVerified, logout } = useAuthStore()

  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  const triggerBiometric = useCallback(async (): Promise<void> => {
    setIsAuthenticating(true)
    setHasFailed(false)

    const result = await authenticateWithBiometric(
      t('biometric.promptTitle'),
      t('biometric.promptCancelLabel')
    )

    setIsAuthenticating(false)

    if (result.success) {
      setBiometricVerified(true)
      return
    }

    setHasFailed(true)
  }, [setBiometricVerified, t])

  useEffect(() => {
    void triggerBiometric()
  }, [triggerBiometric])

  const handleUsePassword = async (): Promise<void> => {
    await logout()
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons
          name="finger-print-outline"
          size={spacing.xxxl}
          color={colors.primary}
        />
      </View>

      <Text style={styles.title}>{t('biometric.promptTitle')}</Text>
      <Text style={styles.subtitle}>{t('biometric.promptSubtitle')}</Text>

      {hasFailed && (
        <View style={styles.errorWrapper}>
          <Text style={styles.errorText}>
            {t('biometric.fallbackMessage')}
          </Text>
        </View>
      )}

      <View style={styles.buttonStack}>
        {hasFailed ? (
          <>
            <Button
              label={t('common.retry')}
              variant="primary"
              onPress={() => {
                void triggerBiometric()
              }}
              loading={isAuthenticating}
            />
            <Button
              label={t('biometric.promptCancelLabel')}
              variant="outline"
              onPress={() => {
                void handleUsePassword()
              }}
            />
          </>
        ) : (
          <Button
            label={t('biometric.promptCancelLabel')}
            variant="outline"
            onPress={() => {
              void handleUsePassword()
            }}
            loading={isAuthenticating}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrapper: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorWrapper: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
  buttonStack: {
    width: '100%',
    gap: spacing.sm,
  },
})
