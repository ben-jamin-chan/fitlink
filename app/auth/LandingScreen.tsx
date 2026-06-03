import React, { useEffect, useState } from 'react'

import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import appleAuth from '@invertase/react-native-apple-authentication'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'

import { Button } from '@/components/ui/Button'

import {
  signInWithAppleCredential,
  signInWithGoogleCredential,
} from '@/services/firebase/auth'

import { mapFirebaseError } from '@/utils/errorUtils'

import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'

import { colors, spacing, typography } from '@/constants/theme'

// Required by expo-auth-session. Completes the OAuth session redirect on app return.
WebBrowser.maybeCompleteAuthSession()

type LandingNavProp = StackNavigationProp<AuthStackParamList, 'Landing'>

const TERMS_URL = 'https://example.com/terms'
const PRIVACY_URL = 'https://example.com/privacy'

const getErrorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null
  }

  return typeof error.code === 'string' ? error.code : null
}

const isErrorTranslationKey = (code: string): boolean => {
  return code.startsWith('auth.') || code.startsWith('errors.')
}

const getAuthErrorKey = (error: unknown): string => {
  const code = getErrorCode(error)

  if (code !== null && isErrorTranslationKey(code)) {
    return code
  }

  return mapFirebaseError(error)
}

const isAppleCancelError = (error: unknown): boolean => {
  return getErrorCode(error) === appleAuth.Error.CANCELED
}

export default function LandingScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<LandingNavProp>()
  const isLoading = useAuthStore((state) => state.isLoading)
  const setError = useAuthStore((state) => state.setError)
  const setIsLoading = useAuthStore((state) => state.setIsLoading)
  const setUser = useAuthStore((state) => state.setUser)

  const [googleLoading, setGoogleLoading] = useState<boolean>(false)
  const [appleLoading, setAppleLoading] = useState<boolean>(false)

  // Google OAuth hook must be called unconditionally at component top level.
  // Google Sign-In via expo-auth-session requires a development build.
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  })

  useEffect((): void => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken ?? response.params.id_token

      if (!idToken) {
        setError('auth.google.missingToken')
        setGoogleLoading(false)
        return
      }

      void handleGoogleToken(idToken)
    } else if (
      response?.type === 'error' ||
      response?.type === 'dismiss' ||
      response?.type === 'cancel'
    ) {
      setGoogleLoading(false)
    }
  }, [response])

  const handleGoogleToken = async (idToken: string): Promise<void> => {
    try {
      setIsLoading(true)
      const credential = await signInWithGoogleCredential(idToken)
      setUser(credential.user)
    } catch (error: unknown) {
      setError(mapFirebaseError(error))
    } finally {
      setIsLoading(false)
      setGoogleLoading(false)
    }
  }

  const handleGooglePress = (): void => {
    setGoogleLoading(true)
    void promptAsync()
  }

  const handleApplePress = async (): Promise<void> => {
    if (!appleAuth.isSupported) {
      return
    }

    setAppleLoading(true)
    setIsLoading(true)

    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      })

      const { identityToken, nonce } = appleAuthRequestResponse

      if (!identityToken || nonce.length === 0) {
        setError('auth.apple.missingToken')
        return
      }

      const credential = await signInWithAppleCredential(identityToken, nonce)
      setUser(credential.user)
    } catch (error: unknown) {
      if (!isAppleCancelError(error)) {
        setError(getAuthErrorKey(error))
      }
    } finally {
      setIsLoading(false)
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
          onPress={handleGooglePress}
          variant="outline"
          loading={googleLoading}
          disabled={!request || googleLoading}
        />
        {Platform.OS === 'ios' && (
          <>
            <View style={styles.gap} />
            <Button
              label={t('auth.landing.continueApple')}
              onPress={handleApplePress}
              variant="outline"
              loading={appleLoading}
              disabled={!appleAuth.isSupported || isLoading || appleLoading}
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
  } as ViewStyle,
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  } as ViewStyle,
  logoText: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  } as TextStyle,
  tagline: {
    fontSize: typography.sizes.lg,
    color: colors.gray[600],
    textAlign: 'center',
  } as TextStyle,
  buttonContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  } as ViewStyle,
  gap: {
    height: spacing.md,
  } as ViewStyle,
  termsContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  } as ViewStyle,
  termsText: {
    fontSize: typography.sizes.xs,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: typography.sizes.xs * typography.lineHeights.relaxed,
  } as TextStyle,
  termsLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  } as ViewStyle,
  termsLink: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  } as TextStyle,
})
