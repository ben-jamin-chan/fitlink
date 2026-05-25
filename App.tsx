import React, { useEffect } from 'react'

import '@/services/firebase/config'
import '@/i18n'

import { NavigationContainer } from '@react-navigation/native'
import type { NavigationContainerRef } from '@react-navigation/native'
import { StripeProvider } from '@stripe/stripe-react-native'
import * as SplashScreen from 'expo-splash-screen'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Toast } from '@/components/ui/Toast'

import { RootNavigator } from '@/app/navigation/RootNavigator'
import { useLastActive } from '@/hooks/useLastActive'
import { useNotifications } from '@/hooks/useNotifications'

import type { RootStackParamList } from '@/app/navigation/RootNavigator'

const navigationRef =
  React.createRef<NavigationContainerRef<RootStackParamList>>()

void SplashScreen.preventAutoHideAsync()

const AppRoot = (): React.JSX.Element => {
  const initialise = useAuthStore((state) => state.initialise)

  useNotifications(navigationRef)
  useLastActive()

  useEffect(() => {
    const unsubscribe = initialise()

    return unsubscribe
  }, [initialise])

  return (
    <>
      <RootNavigator />
      <Toast />
    </>
  )
}

export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StripeProvider
            publishableKey={
              process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
            }
          >
            <NavigationContainer ref={navigationRef}>
              <AppRoot />
            </NavigationContainer>
          </StripeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
