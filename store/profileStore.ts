import { create } from 'zustand'
import { Timestamp, serverTimestamp } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'

import {
  getUserProfile,
  removePhotoFromProfile,
  subscribeToUserProfile,
  updateUserProfile,
} from '@/services/firebase/firestore'
import {
  deleteProfilePhoto,
  uploadProfilePhoto,
  uploadVideoProfile,
} from '@/services/firebase/storage'
import { useAuthStore } from '@/store/authStore'

import { compressImage } from '@/utils/imageUtils'

import type { UserProfile } from '@/types/user'
import type { PremiumTier } from '@/types/subscription'

const MAX_PROFILE_PHOTOS = 6

type EditableProfileUpdate = Partial<
  Omit<
    UserProfile,
    | 'uid'
    | 'age'
    | 'stats'
    | 'premium'
    | 'banned'
    | 'photoVerified'
    | 'verifiedAt'
    | 'stripeCustomerId'
    | 'boost'
    | 'gymCheckin'
    | 'createdAt'
    | 'lastActive'
  >
>

interface PhotoVerificationRefresh {
  photoVerified: true
}

type ProfileUpdateInput = EditableProfileUpdate | PhotoVerificationRefresh

interface RestoredPremiumInput {
  tier: string
  active: boolean
  expiresAt: unknown
}

interface ProfileState {
  profile: UserProfile | null
  isLoading: boolean
  error: string | null
}

interface ProfileActions {
  fetchProfile: (userId: string) => Promise<UserProfile | null>
  startProfileListener: (userId: string) => void
  stopProfileListener: () => void
  updateProfile: (partial: ProfileUpdateInput) => Promise<void>
  uploadPhoto: (uri: string, index: number) => Promise<void>
  deletePhoto: (index: number) => Promise<void>
  updateVideoProfile: (localUri: string) => Promise<void>
  removeVideoProfile: () => Promise<void>
  restorePremium: (premium: RestoredPremiumInput) => void
  clearError: () => void
  reset: () => void
  clearProfile: () => void
}

type ProfileStore = ProfileState & ProfileActions

const initialState: ProfileState = {
  profile: null,
  isLoading: false,
  error: null,
}

let profileUnsubscribe: Unsubscribe | null = null
let subscribedProfileUserId: string | null = null

const stopProfileSubscription = (): void => {
  profileUnsubscribe?.()
  profileUnsubscribe = null
  subscribedProfileUserId = null
}

const isPhotoVerificationRefresh = (
  partial: ProfileUpdateInput
): partial is PhotoVerificationRefresh => {
  return 'photoVerified' in partial && partial.photoVerified === true
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const getRestoredPremiumTier = (tier: string): PremiumTier => {
  return tier === 'pro' ? 'pro' : 'plus'
}

const getRestoredPremiumExpiresAt = (value: unknown): Timestamp | null => {
  if (value instanceof Timestamp) {
    return value
  }

  if (!isRecord(value)) {
    return null
  }

  const seconds = value.seconds ?? value._seconds
  const nanoseconds = value.nanoseconds ?? value._nanoseconds

  if (typeof seconds !== 'number' || typeof nanoseconds !== 'number') {
    return null
  }

  return new Timestamp(seconds, nanoseconds)
}

export const useProfileStore = create<ProfileStore>()((set, get) => ({
  ...initialState,

  fetchProfile: async (userId: string): Promise<UserProfile | null> => {
    set({ isLoading: true, error: null })

    try {
      const profile = await getUserProfile(userId)
      set({ profile, isLoading: false, error: null })
      return profile
    } catch {
      set({ isLoading: false, error: 'profile.errors.fetchFailed' })
      return null
    }
  },

  startProfileListener: (userId: string): void => {
    if (subscribedProfileUserId === userId) {
      return
    }

    stopProfileSubscription()
    subscribedProfileUserId = userId

    profileUnsubscribe = subscribeToUserProfile(
      userId,
      (profile: UserProfile | null): void => {
        set({ profile, isLoading: false, error: null })
      },
      (): void => {
        set({ isLoading: false, error: 'profile.errors.fetchFailed' })
      }
    )
  },

  stopProfileListener: (): void => {
    stopProfileSubscription()
  },

  updateProfile: async (partial: ProfileUpdateInput): Promise<void> => {
    const { profile } = get()
    const userId = useAuthStore.getState().user?.uid

    if (profile === null || userId === undefined) {
      set({ error: 'profile.errors.notAuthenticated' })
      return
    }

    if (isPhotoVerificationRefresh(partial)) {
      set({
        profile: { ...profile, photoVerified: true },
        isLoading: false,
        error: null,
      })
      return
    }

    const snapshot = profile
    set({ profile: { ...profile, ...partial }, isLoading: true, error: null })

    try {
      await updateUserProfile(userId, {
        ...partial,
        lastActive: serverTimestamp(),
      })
      set({ isLoading: false, error: null })
    } catch {
      set({
        profile: snapshot,
        isLoading: false,
        error: 'profile.errors.updateFailed',
      })
    }
  },

  uploadPhoto: async (uri: string, index: number): Promise<void> => {
    const { profile } = get()
    const userId = useAuthStore.getState().user?.uid

    if (profile === null || userId === undefined) {
      set({ error: 'profile.errors.notAuthenticated' })
      return
    }

    if (!Number.isInteger(index) || index < 0 || index >= MAX_PROFILE_PHOTOS) {
      set({ error: 'profile.errors.uploadFailed' })
      return
    }

    set({ isLoading: true, error: null })

    try {
      const compressedUri = await compressImage(uri)
      const downloadUrl = await uploadProfilePhoto(
        userId,
        index,
        compressedUri
      )
      const updatedPhotos = [...profile.photos]
      const shouldPromptReverification = index === 0 && profile.photoVerified

      if (index < updatedPhotos.length) {
        updatedPhotos[index] = downloadUrl
      } else {
        updatedPhotos.push(downloadUrl)
      }

      await updateUserProfile(userId, {
        photos: updatedPhotos,
        lastActive: serverTimestamp(),
      })

      set({
        profile: {
          ...profile,
          photos: updatedPhotos,
          photoVerified: shouldPromptReverification
            ? false
            : profile.photoVerified,
        },
        isLoading: false,
        error: null,
      })
    } catch {
      set({ isLoading: false, error: 'profile.errors.uploadFailed' })
    }
  },

  deletePhoto: async (index: number): Promise<void> => {
    const { profile } = get()
    const userId = useAuthStore.getState().user?.uid

    if (profile === null || userId === undefined) {
      set({ error: 'profile.errors.notAuthenticated' })
      return
    }

    if (profile.photos.length <= 1) {
      set({ error: 'profile.errors.minPhotos' })
      return
    }

    const photoUrl = profile.photos[index]
    if (photoUrl === undefined) {
      set({ error: 'profile.errors.photoNotFound' })
      return
    }

    const snapshot = profile
    const updatedPhotos = profile.photos.filter(
      (_photo: string, photoIndex: number): boolean => photoIndex !== index
    )
    const shouldPromptReverification = index === 0 && profile.photoVerified

    set({
      profile: {
        ...profile,
        photos: updatedPhotos,
        photoVerified: shouldPromptReverification
          ? false
          : profile.photoVerified,
      },
      isLoading: true,
      error: null,
    })

    try {
      await removePhotoFromProfile(userId, photoUrl)
      await deleteProfilePhoto(photoUrl)
      set({ isLoading: false, error: null })
    } catch {
      set({
        profile: snapshot,
        isLoading: false,
        error: 'profile.errors.deleteFailed',
      })
    }
  },

  /**
   * Uploads a local video, then persists the returned URL through updateProfile.
   */
  updateVideoProfile: async (localUri: string): Promise<void> => {
    const uid = get().profile?.uid

    if (uid === undefined) {
      throw new Error('profile.errors.notAuthenticated')
    }

    const videoProfileUrl = await uploadVideoProfile(uid, localUri)
    await get().updateProfile({ videoProfileUrl })

    const profileError = get().error
    if (profileError !== null) {
      throw new Error(profileError)
    }
  },

  /**
   * Clears the video URL only; the fixed Storage blob is cleaned up in Phase 4.
   */
  removeVideoProfile: async (): Promise<void> => {
    await get().updateProfile({ videoProfileUrl: '' })

    const profileError = get().error
    if (profileError !== null) {
      throw new Error(profileError)
    }
  },

  restorePremium: (premium: RestoredPremiumInput): void => {
    set((state) => ({
      profile:
        state.profile !== null
          ? {
              ...state.profile,
              premium: {
                ...state.profile.premium,
                active: premium.active,
                tier: getRestoredPremiumTier(premium.tier),
                expiresAt: getRestoredPremiumExpiresAt(premium.expiresAt),
              },
            }
          : state.profile,
    }))
  },

  clearError: (): void => {
    set({ error: null })
  },

  reset: (): void => {
    stopProfileSubscription()
    set(initialState)
  },

  clearProfile: (): void => {
    stopProfileSubscription()
    set(initialState)
  },
}))
