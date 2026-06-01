import { useCallback, useEffect, useRef } from 'react'

import { AppState, Platform } from 'react-native'
import type { AppStateStatus } from 'react-native'

import { useAuthStore } from '@/store/authStore'
import { useFitnessStore } from '@/store/fitnessStore'

import {
  fetchGoogleFitTodayStats,
  isGoogleFitAvailable,
  setGoogleFitConnected,
  updateGoogleFitFirestore,
} from '@/services/googleFit'

import type { TodayStats } from '@/types/fitness'

interface UseGoogleFitReturn {
  isConnected: boolean
  todayStats: TodayStats | null
  sync: (uid?: string) => Promise<void>
  disconnect: (uid?: string) => Promise<void>
}

const createNoopPromise = (): Promise<void> => Promise.resolve()

export const useGoogleFit = (): UseGoogleFitReturn => {
  if (Platform.OS !== 'android') {
    return {
      isConnected: false,
      todayStats: null,
      sync: createNoopPromise,
      disconnect: createNoopPromise,
    }
  }

  const { user } = useAuthStore()
  const { connections, todayStats, fetchTodayStats, setConnectionStatus } =
    useFitnessStore()

  const isConnected = connections.googleFit?.connected ?? false
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const syncInFlightRef = useRef<boolean>(false)

  const getSyncUid = useCallback(
    (uid?: string): string | null => uid ?? user?.uid ?? null,
    [user?.uid]
  )

  const sync = useCallback(
    async (uid?: string): Promise<void> => {
      if (Platform.OS !== 'android') {
        return
      }

      if (!isGoogleFitAvailable() || syncInFlightRef.current) {
        return
      }

      const syncUid = getSyncUid(uid)

      if (syncUid === null) {
        return
      }

      syncInFlightRef.current = true

      try {
        const stats = await fetchGoogleFitTodayStats()
        await updateGoogleFitFirestore(syncUid, {
          steps: stats.steps,
          distance: stats.distance,
          calories: stats.calories,
          workouts: stats.workouts,
        })
        await fetchTodayStats(syncUid)
      } finally {
        syncInFlightRef.current = false
      }
    },
    [fetchTodayStats, getSyncUid]
  )

  const disconnect = useCallback(
    async (uid?: string): Promise<void> => {
      if (Platform.OS !== 'android') {
        return
      }

      const syncUid = getSyncUid(uid)

      if (syncUid === null) {
        return
      }

      await setGoogleFitConnected(syncUid, false)
      setConnectionStatus('googleFit', { connected: false, lastSync: null })
    },
    [getSyncUid, setConnectionStatus]
  )

  useEffect(() => {
    if (Platform.OS !== 'android' || !isConnected) {
      return
    }

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus): void => {
        if (
          appStateRef.current.match(/inactive|background/) !== null &&
          nextState === 'active'
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
