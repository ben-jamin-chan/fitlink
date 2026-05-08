import React, { useState } from 'react'

import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'

import { Button } from '@/components/ui/Button'

import { signInWithApple, signInWithGoogle } from '@/services/firebase/auth'

import { mapFirebaseError } from '@/utils/errorUtils'

import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

import { colors, spacing, typography } from '@/constants/theme'

type LandingNavProp = StackNavigationProp<AuthStackParamList, 'Landing'>

const TERMS_URL = 'https://example.com/terms'
const PRIVACY_URL = 'https://example.com/privacy'

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
    } catch (err: unknown) {
      setError(mapFirebaseError(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleAppleSignIn = async (): Promise<void> => {
    setAppleLoading(true)

    try {
      await signInWithApple()
    } catch (err: unknown) {
      setError(mapFirebaseError(err))
    } finally {
      setAppleLoading(false)
    }
  }

  const handleTermsPress = (): void => {
    void Linking.openURL(TERMS_URL)
  }

  const handlePrivacyPress = (): void => {
    void Linking.openURL(PRIVACY_URL)
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>
          {t('auth.landing.appName', { defaultValue: '[APP_NAME]' })}
        </Text>
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
        <Text style={styles.termsText}>{t('auth.landing.terms')}</Text>
        <View style={styles.termsLinks}>
          <Text style={styles.termsLink} onPress={handleTermsPress}>
            {t('settings.terms')}
          </Text>
          <Text style={styles.termsLink} onPress={handlePrivacyPress}>
            {t('settings.privacy')}
          </Text>
        </View>
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
    lineHeight: typography.sizes.xs * typography.lineHeights.relaxed,
  },
  termsLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  termsLink: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
})
