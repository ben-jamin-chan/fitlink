import { create } from 'zustand'
import { serverTimestamp } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'

import {
  getUserProfile,
  removePhotoFromProfile,
  subscribeToUserProfile,
  updateUserProfile,
} from '@/services/firebase/firestore'
import { deleteProfilePhoto, uploadProfilePhoto } from '@/services/firebase/storage'
import { useAuthStore } from '@/store/authStore'

import { compressImage } from '@/utils/imageUtils'

import type { UserProfile } from '@/types/user'

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
    | 'createdAt'
    | 'lastActive'
  >
>

interface PhotoVerificationRefresh {
  photoVerified: true
}

type ProfileUpdateInput = EditableProfileUpdate | PhotoVerificationRefresh

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
        profile: { ...profile, photos: updatedPhotos },
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

    set({
      profile: { ...profile, photos: updatedPhotos },
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
