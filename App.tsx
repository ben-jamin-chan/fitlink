import React, { useEffect } from 'react'

import { StyleSheet } from 'react-native'

import { NavigationContainer } from '@react-navigation/native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Toast } from '@/components/ui/Toast'

import { RootNavigator } from '@/app/navigation/RootNavigator'

import '@/i18n/index'

export default function App(): React.JSX.Element {
  const initialise = useAuthStore((state) => state.initialise)

  useEffect(() => {
    const unsubscribe = initialise()

    return unsubscribe
  }, [initialise])

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <Toast />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
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
