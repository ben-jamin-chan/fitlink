import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User } from 'firebase/auth'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  signOut as firebaseSignOut,
  subscribeToAuthState,
} from '@/services/firebase/auth'
import type { AppError } from '@/services/firebase/auth'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  hasCompletedOnboarding: boolean
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  setHasCompletedOnboarding: (completed: boolean) => void
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

      logout: async (): Promise<void> => {
        try {
          await firebaseSignOut()
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
          get().setUser(user)
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
