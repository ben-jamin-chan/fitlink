import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { create } from 'zustand'

import { db } from '@/services/firebase/config'
import {
  getDailyLikesDoc,
  incrementDailyLikes,
} from '@/services/firebase/firestore'

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
  isRefetching: boolean
}

interface DiscoveryActions {
  fetchStack: (userId: string) => Promise<void>
  swipeRight: (
    userId: string,
    targetId: string,
    isPremium: boolean
  ) => Promise<'ok' | 'limit_reached'>
  swipeLeft: (userId: string, targetId: string) => Promise<void>
  swipeSuperLike: (
    userId: string,
    targetId: string,
    isPremium: boolean
  ) => Promise<'ok' | 'premium_required'>
  checkDailyLimit: (userId: string) => Promise<void>
  advanceStack: () => void
  clearError: () => void
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
  isRefetching: false,
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

    set({ isLoading: true, error: null })

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

  swipeRight: async (
    userId: string,
    targetId: string,
    isPremium: boolean
  ): Promise<'ok' | 'limit_reached'> => {
    let nextDailyLikesCount = get().dailyLikesCount

    if (!isPremium) {
      try {
        const dailyLikes = await getDailyLikesDoc(userId)
        nextDailyLikesCount = dailyLikes.count

        if (dailyLikes.count >= FREE_DAILY_LIKE_LIMIT) {
          set({
            dailyLikesCount: dailyLikes.count,
            isLimitReached: true,
          })
          return 'limit_reached'
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Daily limit check failed'
        set({ error: message })
        return 'limit_reached'
      }
    }

    try {
      const swipeRef = doc(db, 'swipes', userId, 'likes', targetId)
      await setDoc(swipeRef, {
        swiperId: userId,
        targetId,
        isSuperLike: false,
        createdAt: serverTimestamp(),
      })

      if (!isPremium) {
        await incrementDailyLikes(userId)
        nextDailyLikesCount += 1
        set({
          dailyLikesCount: nextDailyLikesCount,
          isLimitReached: nextDailyLikesCount >= FREE_DAILY_LIKE_LIMIT,
        })
      }

      get().advanceStack()
      return 'ok'
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swipe failed'
      set({ error: message })
      return 'ok'
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
      console.warn('swipeLeft write failed:', error)
    } finally {
      get().advanceStack()
    }
  },

  swipeSuperLike: async (
    userId: string,
    targetId: string,
    isPremium: boolean
  ): Promise<'ok' | 'premium_required'> => {
    if (!isPremium) {
      return 'premium_required'
    }

    try {
      const swipeRef = doc(db, 'swipes', userId, 'likes', targetId)
      await setDoc(swipeRef, {
        swiperId: userId,
        targetId,
        isSuperLike: true,
        createdAt: serverTimestamp(),
      })
      get().advanceStack()
      return 'ok'
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Super like failed'
      set({ error: message })
      return 'ok'
    }
  },

  checkDailyLimit: async (userId: string): Promise<void> => {
    try {
      const data = await getDailyLikesDoc(userId)
      set({
        dailyLikesCount: data.count,
        isLimitReached: data.count >= FREE_DAILY_LIKE_LIMIT,
      })
    } catch (error) {
      console.warn('checkDailyLimit failed:', error)
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

  reset: (): void => {
    set(initialState)
  },
}))
