import { useEffect, useRef } from 'react'

import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'

import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { useAuthStore } from '@/store/authStore'

import { db } from '@/services/firebase/config'

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000

export const useLastActive = (): void => {
  const { isAuthenticated, user } = useAuthStore()

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const appStateSubscriptionRef = useRef<
    ReturnType<typeof AppState.addEventListener> | null
  >(null)

  useEffect(() => {
    if (!isAuthenticated || user?.uid === undefined) {
      return
    }

    const uid = user.uid

    const writeLastActive = async (): Promise<void> => {
      try {
        await updateDoc(doc(db, 'users', uid), {
          lastActive: serverTimestamp(),
        })
      } catch {
        return undefined
      }
    }

    const startHeartbeat = (): void => {
      void writeLastActive()

      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }

      intervalRef.current = setInterval(() => {
        void writeLastActive()
      }, HEARTBEAT_INTERVAL_MS)
    }

    const stopHeartbeat = (): void => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      void writeLastActive()
    }

    const handleAppStateChange = (nextState: AppStateStatus): void => {
      if (nextState === 'active') {
        startHeartbeat()
        return
      }

      if (nextState === 'background' || nextState === 'inactive') {
        stopHeartbeat()
      }
    }

    startHeartbeat()

    appStateSubscriptionRef.current = AppState.addEventListener(
      'change',
      handleAppStateChange
    )

    return (): void => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      if (appStateSubscriptionRef.current !== null) {
        appStateSubscriptionRef.current.remove()
        appStateSubscriptionRef.current = null
      }
    }
  }, [isAuthenticated, user?.uid])
}
