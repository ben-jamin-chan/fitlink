import React from 'react'

import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { NavigatorScreenParams } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'

import { useAuthStore } from '@/store/authStore'

import { AuthNavigator } from '@/app/navigation/AuthNavigator'
import { MainTabNavigator } from '@/app/navigation/MainTabNavigator'
import { OnboardingNavigator } from '@/app/onboarding/OnboardingNavigator'

import type { AuthStackParamList } from '@/app/navigation/AuthNavigator'
import type { MainTabParamList } from '@/app/navigation/MainTabNavigator'

import { colors } from '@/constants/theme'

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>
  MainTabs: NavigatorScreenParams<MainTabParamList>
  Onboarding: undefined
}

const Stack = createStackNavigator<RootStackParamList>()

export const RootNavigator = (): React.JSX.Element => {
  const { isAuthenticated, isLoading, hasCompletedOnboarding } = useAuthStore()

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !hasCompletedOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  )
}

const screenOptions = {
  headerShown: false,
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
})
