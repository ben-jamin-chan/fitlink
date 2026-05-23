import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { create } from 'zustand'

import { db } from '@/services/firebase/config'
import {
  getDailyLikesDoc,
  incrementDailyLikes,
} from '@/services/firebase/firestore'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'

import type { UserProfile } from '@/types/user'

const FREE_DAILY_LIKE_LIMIT = 50
const REFETCH_THRESHOLD = 3

interface GetDiscoveryStackResponse {
  stack: string[]
}

interface DiscoveryState {
  stack: UserProfile[]
  currentIndex: number
  isLoading: boolean
  error: string | null
  dailyLikesCount: number
  isLimitReached: boolean
  dailyLimitReached: boolean
  isRefetching: boolean
  isUpsellVisible: boolean
}

interface DiscoveryActions {
  fetchStack: (userId: string) => Promise<void>
  swipeRight: (targetId: string) => Promise<void>
  swipeLeft: (userId: string, targetId: string) => Promise<void>
  swipeSuperLike: (targetId: string) => Promise<void>
  checkDailyLimit: (userId: string) => Promise<void>
  advanceStack: () => void
  clearError: () => void
  showUpsell: () => void
  hideUpsell: () => void
  reset: () => void
}

type DiscoveryStore = DiscoveryState & DiscoveryActions

const initialState: DiscoveryState = {
  stack: [],
  currentIndex: 0,
  isLoading: false,
  error: null,
  dailyLikesCount: 0,
  isLimitReached: false,
  dailyLimitReached: false,
  isRefetching: false,
  isUpsellVisible: false,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isUserProfile = (value: unknown): value is UserProfile => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.uid === 'string' &&
    typeof value.firstName === 'string' &&
    typeof value.age === 'number' &&
    Array.isArray(value.photos) &&
    typeof value.banned === 'boolean' &&
    typeof value.paused === 'boolean'
  )
}

const fetchUserProfile = async (
  userId: string
): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', userId))

  if (!snap.exists()) {
    return null
  }

  const data = snap.data()

  if (!isUserProfile(data) || data.banned || data.paused) {
    return null
  }

  return { ...data, uid: snap.id }
}

const resolveProfiles = async (ids: string[]): Promise<UserProfile[]> => {
  const settled = await Promise.allSettled(ids.map(fetchUserProfile))

  return settled
    .filter(
      (result): result is PromiseFulfilledResult<UserProfile> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map((result) => result.value)
}

export const useDiscoveryStore = create<DiscoveryStore>()((set, get) => ({
  ...initialState,

  fetchStack: async (userId: string): Promise<void> => {
    if (get().isLoading) {
      return
    }

    set({ isLoading: true, error: null, dailyLimitReached: false })

    try {
      const functions = getFunctions(undefined, 'asia-southeast1')
      const getStack = httpsCallable<
        Record<string, never>,
        GetDiscoveryStackResponse
      >(functions, 'getDiscoveryStack')
      const result = await getStack({})
      const profiles = await resolveProfiles(result.data.stack)

      await get().checkDailyLimit(userId)

      set({
        stack: profiles,
        currentIndex: 0,
        isLoading: false,
        isRefetching: false,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load profiles'
      set({ isLoading: false, isRefetching: false, error: message })
    }
  },

  swipeRight: async (targetId: string): Promise<void> => {
    try {
      const { user } = useAuthStore.getState()
      const { profile } = useProfileStore.getState()

      if (user === null) {
        return
      }

      const isPremium = profile?.subscription?.tier === 'premium'
      let dailyLikesCount = get().dailyLikesCount

      if (!isPremium) {
        const { count, remaining } = await getDailyLikesDoc(user.uid)
        dailyLikesCount = count

        if (remaining <= 0) {
          set({
            dailyLikesCount: count,
            isLimitReached: true,
            dailyLimitReached: true,
            isUpsellVisible: true,
          })
          return
        }
      }

      const likeRef = doc(db, 'swipes', user.uid, 'likes', targetId)
      await setDoc(likeRef, {
        swiperId: user.uid,
        targetId,
        isSuperLike: false,
        createdAt: serverTimestamp(),
      })

      if (!isPremium) {
        await incrementDailyLikes(user.uid)
      }

      set((state) => {
        const nextStack = state.stack.filter(
          (userProfile) => userProfile.uid !== targetId
        )
        const nextDailyLikesCount = isPremium
          ? state.dailyLikesCount
          : dailyLikesCount + 1
        const remaining = nextStack.length - state.currentIndex
        const shouldRefetch =
          remaining <= REFETCH_THRESHOLD && !state.isLoading

        return {
          dailyLikesCount: nextDailyLikesCount,
          dailyLimitReached:
            !isPremium && nextDailyLikesCount >= FREE_DAILY_LIKE_LIMIT,
          isLimitReached:
            !isPremium && nextDailyLikesCount >= FREE_DAILY_LIKE_LIMIT,
          isRefetching: shouldRefetch ? true : state.isRefetching,
          stack: nextStack,
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swipe failed'
      set({ error: message })
    }
  },

  swipeLeft: async (userId: string, targetId: string): Promise<void> => {
    try {
      const passRef = doc(db, 'swipes', userId, 'passes', targetId)
      await setDoc(passRef, {
        swiperId: userId,
        targetId,
        createdAt: serverTimestamp(),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pass failed'
      set({ error: message })
    }
  },

  swipeSuperLike: async (targetId: string): Promise<void> => {
    try {
      const { user } = useAuthStore.getState()
      const { profile } = useProfileStore.getState()

      if (user === null) {
        return
      }

      const isPremium = profile?.subscription?.tier === 'premium'

      if (!isPremium) {
        set({ isUpsellVisible: true })
        return
      }

      const likeRef = doc(db, 'swipes', user.uid, 'likes', targetId)
      await setDoc(likeRef, {
        swiperId: user.uid,
        targetId,
        isSuperLike: true,
        createdAt: serverTimestamp(),
      })

      set((state) => {
        const nextStack = state.stack.filter(
          (userProfile) => userProfile.uid !== targetId
        )
        const remaining = nextStack.length - state.currentIndex
        const shouldRefetch =
          remaining <= REFETCH_THRESHOLD && !state.isLoading

        return {
          isRefetching: shouldRefetch ? true : state.isRefetching,
          stack: nextStack,
        }
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Super like failed'
      set({ error: message })
    }
  },

  checkDailyLimit: async (userId: string): Promise<void> => {
    try {
      const data = await getDailyLikesDoc(userId)
      set({
        dailyLikesCount: data.count,
        isLimitReached: data.remaining <= 0,
        dailyLimitReached: data.remaining <= 0,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Daily limit check failed'
      set({ error: message })
    }
  },

  advanceStack: (): void => {
    set((state) => {
      const currentIndex = state.currentIndex + 1
      const remaining = state.stack.length - currentIndex

      if (
        remaining <= REFETCH_THRESHOLD &&
        !state.isLoading &&
        !state.isRefetching
      ) {
        return { currentIndex, isRefetching: true }
      }

      return { currentIndex }
    })
  },

  clearError: (): void => {
    set({ error: null })
  },

  showUpsell: (): void => {
    set({ isUpsellVisible: true })
  },

  hideUpsell: (): void => {
    set({ isUpsellVisible: false })
  },

  reset: (): void => {
    set(initialState)
  },
}))
