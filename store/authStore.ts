import { create } from 'zustand'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  hasCompletedOnboarding: boolean
  setIsAuthenticated: (value: boolean) => void
  setIsLoading: (value: boolean) => void
  setHasCompletedOnboarding: (value: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: false,
  hasCompletedOnboarding: false,
  setIsAuthenticated: (value: boolean) => set({ isAuthenticated: value }),
  setIsLoading: (value: boolean) => set({ isLoading: value }),
  setHasCompletedOnboarding: (value: boolean) =>
    set({ hasCompletedOnboarding: value }),
}))
