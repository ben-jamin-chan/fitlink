import AsyncStorage from '@react-native-async-storage/async-storage'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { db } from '@/services/firebase/config'

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
        void uid
        console.warn(
          `[fitnessStore] connectSource('${source}') called before service wiring is available.`
        )
      },

      disconnectSource: async (
        uid: string,
        source: FitnessSource
      ): Promise<void> => {
        void uid
        console.warn(
          `[fitnessStore] disconnectSource('${source}') called before service wiring is available.`
        )
        set((state) => ({
          connections: {
            ...state.connections,
            [source]: createDisconnectedStatus(),
          },
        }))
      },

      syncNow: async (uid: string, source: FitnessSource): Promise<void> => {
        console.warn(
          `[fitnessStore] syncNow('${source}') called before service wiring is available.`
        )
        await get().fetchTodayStats(uid)
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
