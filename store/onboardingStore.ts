import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type {
  DrinkingStatus,
  FitnessLevel,
  Gender,
  LookingFor,
  SmokingStatus,
} from '@/types/user'

export interface OnboardingDraft {
  firstName?: string
  dateOfBirth?: string
  gender?: Gender
  city?: string
  country?: string
  photoUris?: string[]
  activities?: string[]
  fitnessLevel?: FitnessLevel
  workoutFrequency?: string
  dietaryPreference?: string
  fitnessGoals?: string[]
  smoking?: SmokingStatus
  drinking?: DrinkingStatus
  bio?: string
  height?: number
  religion?: string
  lookingFor?: LookingFor[]
  preferredAgeMin?: number
  preferredAgeMax?: number
  preferredDistanceKm?: number
  preferredGenders?: string[]
}

interface OnboardingState {
  draft: OnboardingDraft
  currentStep: number
  updateDraft: (partial: Partial<OnboardingDraft>) => void
  setCurrentStep: (step: number) => void
  clearDraft: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      draft: {},
      currentStep: 1,

      updateDraft: (partial: Partial<OnboardingDraft>): void => {
        set((state) => ({
          draft: { ...state.draft, ...partial },
        }))
      },

      setCurrentStep: (step: number): void => {
        set({ currentStep: step })
      },

      clearDraft: (): void => {
        set({ draft: {}, currentStep: 1 })
      },
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        draft: state.draft,
        currentStep: state.currentStep,
      }),
    }
  )
)
