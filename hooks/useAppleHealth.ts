import { useCallback, useEffect, useRef } from 'react'

import { AppState, Platform } from 'react-native'
import type { AppStateStatus } from 'react-native'

import { useAuthStore } from '@/store/authStore'
import { useFitnessStore } from '@/store/fitnessStore'

import {
  fetchAppleHealthTodayStats,
  requestAppleHealthPermissions,
  setAppleHealthConnected,
  updateAppleHealthFirestore,
} from '@/services/healthKit'

import type { TodayStats } from '@/types/fitness'

interface UseAppleHealthReturn {
  isConnected: boolean
  todayStats: TodayStats | null
  sync: () => Promise<void>
  disconnect: () => Promise<void>
}

const createNoopPromise = (): Promise<void> => Promise.resolve()

export const useAppleHealth = (): UseAppleHealthReturn => {
  if (Platform.OS !== 'ios') {
    return {
      isConnected: false,
      todayStats: null,
      sync: createNoopPromise,
      disconnect: createNoopPromise,
    }
  }

  const { user } = useAuthStore()
  const { connections, todayStats, setConnectionStatus, fetchTodayStats } =
    useFitnessStore()

  const isConnected = connections.appleHealth?.connected ?? false
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const syncInFlightRef = useRef<boolean>(false)

  const sync = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'ios') {
      return
    }

    if (user?.uid === undefined || syncInFlightRef.current) {
      return
    }

    const uid = user.uid
    syncInFlightRef.current = true

    try {
      const stats = await fetchAppleHealthTodayStats()
      await updateAppleHealthFirestore(uid, {
        steps: stats.steps,
        distance: stats.distance,
        calories: stats.calories,
        workouts: stats.workouts,
      })
      await fetchTodayStats(uid)
    } finally {
      syncInFlightRef.current = false
    }
  }, [fetchTodayStats, user?.uid])

  const disconnect = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'ios') {
      return
    }

    if (user?.uid === undefined) {
      return
    }

    await setAppleHealthConnected(user.uid, false)
    setConnectionStatus('appleHealth', { connected: false, lastSync: null })
  }, [setConnectionStatus, user?.uid])

  useEffect(() => {
    if (Platform.OS !== 'ios' || user?.uid === undefined) {
      return
    }

    const uid = user.uid

    const initialiseAppleHealth = async (): Promise<void> => {
      if (!isConnected) {
        const granted = await requestAppleHealthPermissions()

        if (!granted) {
          return
        }

        await setAppleHealthConnected(uid, true)
        setConnectionStatus('appleHealth', {
          connected: true,
          lastSync: null,
        })
      }

      await sync()
    }

    void initialiseAppleHealth()
  }, [isConnected, setConnectionStatus, sync, user?.uid])

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return
    }

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus): void => {
        if (
          appStateRef.current.match(/inactive|background/) !== null &&
          nextState === 'active' &&
          isConnected
        ) {
          void sync()
        }

        appStateRef.current = nextState
      }
    )

    return (): void => {
      subscription.remove()
    }
  }, [isConnected, sync])

  return {
    isConnected,
    todayStats,
    sync,
    disconnect,
  }
}
