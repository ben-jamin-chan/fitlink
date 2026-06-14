import { useEffect, useRef } from 'react'

import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'

import { useAuthStore } from '@/store/authStore'

import { updateLastActive } from '@/services/firebase/firestore'

const BACKGROUND_FETCH_TASK = 'fitlink-lastactive-fetch'

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const uid = await AsyncStorage.getItem('fitlink-uid')
    if (!uid) {
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    await updateLastActive(uid)
    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

export const useLastActive = (): void => {
  const uid = useAuthStore((state) => state.user?.uid ?? null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    if (uid === null) {
      return
    }

    const writeLastActive = (): void => {
      updateLastActive(uid).catch(() => {
        return undefined
      })
    }

    const startInterval = (): void => {
      writeLastActive()
      intervalRef.current = setInterval(writeLastActive, 5 * 60 * 1000)
    }

    const stopInterval = (): void => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus): void => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          startInterval()
        } else if (
          appStateRef.current === 'active' &&
          nextState.match(/inactive|background/)
        ) {
          writeLastActive()
          stopInterval()
        }

        appStateRef.current = nextState
      }
    )

    startInterval()

    return (): void => {
      subscription.remove()
      stopInterval()
    }
  }, [uid])

  useEffect(() => {
    BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 300,
      stopOnTerminate: false,
      startOnBoot: false,
    }).catch(() => {
      return undefined
    })

    return (): void => {
      BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK).catch(() => {
        return undefined
      })
    }
  }, [])
}
