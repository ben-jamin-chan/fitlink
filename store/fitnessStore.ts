import { Platform } from 'react-native'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { db } from '@/services/firebase/config'
import {
  fetchGoogleFitTodayStats,
  isGoogleFitAvailable,
  requestGoogleFitPermissions,
  setGoogleFitConnected,
  updateGoogleFitFirestore,
} from '@/services/googleFit'
import {
  fetchAppleHealthTodayStats,
  requestAppleHealthPermissions,
  setAppleHealthConnected,
  updateAppleHealthFirestore,
} from '@/services/healthKit'
import {
  connectStrava,
  disconnectStrava,
  syncStrava,
} from '@/services/strava'

import type {
  FitnessConnectionStatus,
  FitnessSource,
  TodayStats,
} from '@/types/fitness'

interface UserFitnessTrackingSnapshot {
  fitnessTracking?: {
    todayStats?: TodayStats
  }
}

interface FitnessState {
  todayStats: TodayStats | null
  connections: Record<FitnessSource, FitnessConnectionStatus>
  shareOnProfile: boolean
  isLoading: boolean
  error: string | null
}

interface FitnessActions {
  fetchTodayStats: (uid: string) => Promise<void>
  setShareOnProfile: (uid: string, enabled: boolean) => Promise<void>
  connectSource: (uid: string, source: FitnessSource) => Promise<void>
  disconnectSource: (uid: string, source: FitnessSource) => Promise<void>
  syncNow: (uid: string, source: FitnessSource) => Promise<void>
  setConnectionStatus: (
    source: FitnessSource,
    status: FitnessConnectionStatus
  ) => void
  clearError: () => void
}

type FitnessStore = FitnessState & FitnessActions

const createDisconnectedStatus = (): FitnessConnectionStatus => ({
  connected: false,
  lastSync: null,
})

const defaultConnections: Record<FitnessSource, FitnessConnectionStatus> = {
  appleHealth: createDisconnectedStatus(),
  googleFit: createDisconnectedStatus(),
  strava: createDisconnectedStatus(),
}

export const useFitnessStore = create<FitnessStore>()(
  persist(
    (set, get) => ({
      todayStats: null,
      connections: defaultConnections,
      shareOnProfile: false,
      isLoading: false,
      error: null,

      fetchTodayStats: async (uid: string): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
          const userDocRef = doc(db, 'users', uid)
          const snapshot = await getDoc(userDocRef)

          if (!snapshot.exists()) {
            set({ todayStats: null, isLoading: false })
            return
          }

          // Safe cast: Firestore schema guarantees this shape when the field exists;
          // the null fallback handles older user documents without fitnessTracking.
          const data = snapshot.data() as UserFitnessTrackingSnapshot
          const todayStats = data.fitnessTracking?.todayStats ?? null

          set({ todayStats, isLoading: false })
        } catch {
          set({
            isLoading: false,
            error: 'fitness.errors.fetchFailed',
          })
        }
      },

      setShareOnProfile: async (
        uid: string,
        enabled: boolean
      ): Promise<void> => {
        const previousShareOnProfile = get().shareOnProfile

        set({ shareOnProfile: enabled, isLoading: true, error: null })

        try {
          await updateDoc(doc(db, 'users', uid), {
            'fitnessTracking.shareOnProfile': enabled,
          })
          set({ isLoading: false, error: null })
        } catch {
          set({
            shareOnProfile: previousShareOnProfile,
            isLoading: false,
            error: 'fitness.errors.shareFailed',
          })
        }
      },

      connectSource: async (
        uid: string,
        source: FitnessSource
      ): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
          if (source === 'strava') {
            await connectStrava(uid)
          } else if (source === 'appleHealth') {
            if (Platform.OS !== 'ios') {
              return
            }

            const granted = await requestAppleHealthPermissions()
            if (!granted) {
              return
            }

            await setAppleHealthConnected(uid, true)
            set((state) => ({
              connections: {
                ...state.connections,
                appleHealth: { connected: true, lastSync: null },
              },
            }))
          } else if (source === 'googleFit') {
            if (Platform.OS !== 'android' || !isGoogleFitAvailable()) {
              return
            }

            const granted = await requestGoogleFitPermissions()
            if (!granted) {
              return
            }

            await setGoogleFitConnected(uid, true)
            set((state) => ({
              connections: {
                ...state.connections,
                googleFit: { connected: true, lastSync: null },
              },
            }))

            const stats = await fetchGoogleFitTodayStats()
            set({ todayStats: stats })
            await updateGoogleFitFirestore(uid, stats)
            await get().fetchTodayStats(uid)
          }
        } finally {
          set({ isLoading: false })
        }
      },

      disconnectSource: async (
        uid: string,
        source: FitnessSource
      ): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
          if (source === 'strava') {
            await disconnectStrava(uid)
          } else if (source === 'appleHealth') {
            if (Platform.OS !== 'ios') {
              return
            }

            await setAppleHealthConnected(uid, false)
            get().setConnectionStatus('appleHealth', {
              connected: false,
              lastSync: null,
            })
          } else if (source === 'googleFit') {
            if (Platform.OS !== 'android') {
              return
            }

            await setGoogleFitConnected(uid, false)
            get().setConnectionStatus('googleFit', {
              connected: false,
              lastSync: null,
            })
          }
        } finally {
          set({ isLoading: false })
        }
      },

      syncNow: async (uid: string, source: FitnessSource): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
          if (source === 'strava') {
            const stats = await syncStrava()
            set({ todayStats: stats })
          } else if (source === 'appleHealth') {
            if (Platform.OS !== 'ios') {
              return
            }

            const stats = await fetchAppleHealthTodayStats()
            await updateAppleHealthFirestore(uid, {
              steps: stats.steps,
              distance: stats.distance,
              calories: stats.calories,
              workouts: stats.workouts,
            })
            await get().fetchTodayStats(uid)
          } else if (source === 'googleFit') {
            if (Platform.OS !== 'android') {
              return
            }

            const stats = await fetchGoogleFitTodayStats()
            set({ todayStats: stats })
            await updateGoogleFitFirestore(uid, stats)
            await get().fetchTodayStats(uid)
          }
        } finally {
          set({ isLoading: false })
        }
      },

      setConnectionStatus: (
        source: FitnessSource,
        status: FitnessConnectionStatus
      ): void => {
        set((state) => ({
          connections: { ...state.connections, [source]: status },
        }))
      },

      clearError: (): void => {
        set({ error: null })
      },
    }),
    {
      name: 'fitness-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        shareOnProfile: state.shareOnProfile,
        connections: state.connections,
      }),
    }
  )
)
