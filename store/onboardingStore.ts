import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { COUNTRY_TIMEZONES } from '@/constants/regions'
import type { SupportedCountry } from '@/constants/regions'
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
  country: string
  timezone: string
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

const DEFAULT_COUNTRY: SupportedCountry = 'Malaysia'
const DEFAULT_ONBOARDING_DRAFT: OnboardingDraft = {
  country: DEFAULT_COUNTRY,
  timezone: COUNTRY_TIMEZONES[DEFAULT_COUNTRY],
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      draft: { ...DEFAULT_ONBOARDING_DRAFT },
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
        set({ draft: { ...DEFAULT_ONBOARDING_DRAFT }, currentStep: 1 })
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
