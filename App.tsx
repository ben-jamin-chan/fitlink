import React, { useEffect } from 'react'

import '@/services/firebase/config'
import '@/i18n'

import { NavigationContainer } from '@react-navigation/native'
import type { NavigationContainerRef } from '@react-navigation/native'
import * as SplashScreen from 'expo-splash-screen'
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer ref={navigationRef}>
            <AppRoot />
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
