import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User } from 'firebase/auth'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  signOut as firebaseSignOut,
  subscribeToAuthState,
} from '@/services/firebase/auth'
import { unregisterPushNotifications } from '@/services/notifications'
import { useProfileStore } from '@/store/profileStore'

import type { AppError } from '@/services/firebase/auth'
import type { UserProfile } from '@/types/user'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  hasCompletedOnboarding: boolean
  biometricVerified: boolean
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  setHasCompletedOnboarding: (completed: boolean) => void
  setBiometricVerified: (verified: boolean) => void
  logout: () => Promise<void>
  initialise: () => () => void
}

const isAppError = (error: unknown): error is AppError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  )
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      hasCompletedOnboarding: false,
      biometricVerified: false,

      setUser: (user: User | null): void => {
        set({
          user,
          isAuthenticated: user !== null,
          isLoading: false,
        })
      },

      setIsLoading: (loading: boolean): void => {
        set({ isLoading: loading })
      },

      setError: (error: string | null): void => {
        set({ error })
      },

      clearError: (): void => {
        set({ error: null })
      },

      setHasCompletedOnboarding: (completed: boolean): void => {
        set({ hasCompletedOnboarding: completed })
      },

      setBiometricVerified: (verified: boolean): void => {
        set({ biometricVerified: verified })
      },

      logout: async (): Promise<void> => {
        try {
          const currentUserId = get().user?.uid

          if (currentUserId !== undefined) {
            await unregisterPushNotifications(currentUserId).catch(() => {
              return undefined
            })
          }

          await firebaseSignOut()
          useProfileStore.getState().reset()
          set({
            user: null,
            isAuthenticated: false,
            hasCompletedOnboarding: false,
            error: null,
          })
        } catch (error: unknown) {
          const errorCode = isAppError(error) ? error.code : 'errors.generic'
          set({ error: errorCode })
        }
      },

      initialise: (): (() => void) => {
        const unsubscribe = subscribeToAuthState((user: User | null): void => {
          if (user === null) {
            useProfileStore.getState().reset()
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              hasCompletedOnboarding: false,
              error: null,
            })
            return
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: true,
            error: null,
          })

          void useProfileStore
            .getState()
            .fetchProfile(user.uid)
            .then((profile: UserProfile | null): void => {
              set({
                hasCompletedOnboarding: profile !== null,
                isLoading: false,
              })
            })
        })

        return unsubscribe
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
)
