import { create } from 'zustand'

import { getUserProfile } from '@/services/firebase/firestore'

import type { UserProfile } from '@/types/user'

interface ProfileState {
  profile: UserProfile | null
  isLoading: boolean
  error: string | null
}

interface ProfileActions {
  fetchProfile: (userId: string) => Promise<void>
  clearProfile: () => void
}

type ProfileStore = ProfileState & ProfileActions

const initialState: ProfileState = {
  profile: null,
  isLoading: false,
  error: null,
}

export const useProfileStore = create<ProfileStore>()((set) => ({
  ...initialState,

  fetchProfile: async (userId: string): Promise<void> => {
    set({ isLoading: true, error: null })

    try {
      const profile = await getUserProfile(userId)
      set({ profile, isLoading: false, error: null })
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'errors.generic'
      set({ isLoading: false, error: errorMessage })
    }
  },

  clearProfile: (): void => {
    set(initialState)
  },
}))
