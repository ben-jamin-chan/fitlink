import React, { useEffect, useState } from 'react'

import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'

import { NavigatorScreenParams } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'

import BiometricPromptScreen from '@/app/auth/BiometricPromptScreen'
import { AuthNavigator } from '@/app/navigation/AuthNavigator'
import { MainTabNavigator } from '@/app/navigation/MainTabNavigator'
import { OnboardingNavigator } from '@/app/onboarding/OnboardingNavigator'
import PhotoVerificationScreen from '@/app/profile/PhotoVerificationScreen'
import PremiumScreen from '@/app/settings/PremiumScreen'

import {
  checkBiometricSupport,
  getBiometricEnabled,
  getBiometricPromptShown,
  markBiometricPromptShown,
  setBiometricEnabled,
} from '@/hooks/useBiometric'

import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'
import type { MainTabParamList } from '@/app/navigation/MainTabNavigator'

import { colors } from '@/constants/theme'

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>
  MainTabs: NavigatorScreenParams<MainTabParamList>
  Onboarding: undefined
  BiometricPrompt: undefined
  Premium: undefined
  PhotoVerification: undefined
}

const Stack = createStackNavigator<RootStackParamList>()

export const RootNavigator = (): React.JSX.Element | null => {
  const { t } = useTranslation()
  const {
    isAuthenticated,
    isLoading,
    hasCompletedOnboarding,
    biometricVerified,
    setBiometricVerified,
  } = useAuthStore()
  const [biometricReady, setBiometricReady] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setBiometricVerified(false)
      setBiometricReady(false)
      return
    }

    const evaluateBiometric = async (): Promise<void> => {
      try {
        const support = await checkBiometricSupport()

        if (!support.isSupported || !support.isEnrolled) {
          setBiometricVerified(true)
          setBiometricReady(true)
          return
        }

        const promptAlreadyShown = await getBiometricPromptShown()

        if (!promptAlreadyShown) {
          await markBiometricPromptShown()

          Alert.alert(
            t('biometric.enableTitle'),
            t('biometric.enableSubtitle'),
            [
              {
                text: t('biometric.enableSkip'),
                style: 'cancel',
                onPress: () => {
                  void setBiometricEnabled(false).finally(() => {
                    setBiometricVerified(true)
                    setBiometricReady(true)
                  })
                },
              },
              {
                text: t('biometric.enableConfirm'),
                onPress: () => {
                  void setBiometricEnabled(true).finally(() => {
                    setBiometricReady(true)
                  })
                },
              },
            ],
            { cancelable: false }
          )
          return
        }

        const enabled = await getBiometricEnabled()

        if (!enabled) {
          setBiometricVerified(true)
        }

        setBiometricReady(true)
      } catch {
        setBiometricVerified(true)
        setBiometricReady(true)
      }
    }

    void evaluateBiometric()
  }, [isAuthenticated, setBiometricVerified, t])

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (isAuthenticated && !biometricReady) {
    return null
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !hasCompletedOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : !biometricVerified ? (
        <Stack.Screen
          name="BiometricPrompt"
          component={BiometricPromptScreen}
          options={biometricScreenOptions}
        />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen
            name="Premium"
            component={PremiumScreen}
            options={{
              headerBackTitle: '',
              headerShown: true,
              title: t('subscription.screenTitle'),
            }}
          />
          <Stack.Screen
            name="PhotoVerification"
            component={PhotoVerificationScreen}
            options={{
              headerBackTitle: '',
              headerShown: true,
              title: t('verification.navigationTitle'),
            }}
          />
        </>
      )}
    </Stack.Navigator>
  )
}

const screenOptions = {
  headerShown: false,
}

const biometricScreenOptions = {
  headerShown: false,
  gestureEnabled: false,
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
})
