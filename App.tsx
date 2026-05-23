import React, { useEffect, useRef } from 'react'

import { StyleSheet } from 'react-native'

import { NavigationContainer } from '@react-navigation/native'
import type { NavigationContainerRef } from '@react-navigation/native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Toast } from '@/components/ui/Toast'

import { RootNavigator } from '@/app/navigation/RootNavigator'
import { useNotifications } from '@/hooks/useNotifications'

import type { RootStackParamList } from '@/app/navigation/RootNavigator'

import '@/i18n/index'

const AppRoot = (): React.JSX.Element => {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null)
  const initialise = useAuthStore((state) => state.initialise)

  useNotifications(navigationRef)

  useEffect(() => {
    const unsubscribe = initialise()

    return unsubscribe
  }, [initialise])

  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigator />
    </NavigationContainer>
  )
}

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <Toast />
          <AppRoot />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
