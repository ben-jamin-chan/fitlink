import { doc, getDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { Functions, HttpsCallable } from 'firebase/functions'
import { create } from 'zustand'

import i18n from '@/i18n'
import { db } from '@/services/firebase/config'
import { getDailyLikesDoc } from '@/services/firebase/firestore'
import { useAuthStore } from '@/store/authStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { showToast } from '@/store/toastStore'

import type { UserProfile } from '@/types/user'

const FREE_DAILY_LIKE_LIMIT = 50
const REFETCH_THRESHOLD = 3

interface GetDiscoveryStackResponse {
  stack: string[]
}

type SwipeDirection = 'like' | 'pass' | 'superlike'

interface RecordSwipeRequest {
  targetId: string
  direction: SwipeDirection
}

interface RecordSwipeResponse {
  success: boolean
  remainingLikes: number
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
}

interface DiscoveryActions {
  fetchStack: (userId: string) => Promise<void>
  swipeRight: (targetId: string) => Promise<void>
  swipeLeft: (userId: string, targetId: string) => Promise<void>
  swipeSuperLike: (targetId: string) => Promise<void>
  rewind: () => void
  checkDailyLimit: (userId: string) => Promise<number>
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
  dailyLimitReached: false,
  isRefetching: false,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getCallableFunctions = (): Functions =>
  getFunctions(undefined, 'asia-southeast1')

const getRecordSwipeFn = (): HttpsCallable<
  RecordSwipeRequest,
  RecordSwipeResponse
> =>
  httpsCallable<RecordSwipeRequest, RecordSwipeResponse>(
    getCallableFunctions(),
    'recordSwipe'
  )

const getDailyLikesCountFromRemaining = (remainingLikes: number): number =>
  Math.max(0, FREE_DAILY_LIKE_LIMIT - remainingLikes)

const getErrorCode = (error: unknown): string | null => {
  if (!isRecord(error) || typeof error.code !== 'string') {
    return null
  }

  return error.code
}

const isDailyLimitError = (error: unknown): boolean =>
  getErrorCode(error) === 'functions/resource-exhausted'

const logUnexpectedSwipeError = (action: string, error: unknown): void => {
  // TODO Task 67: replace with crashlytics.logError
  console.error(`[discoveryStore] ${action} error:`, error)
}

const showSwipeErrorToast = (): void => {
  showToast(i18n.t('errors.generic'), 'error')
}

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
      const getStack = httpsCallable<
        Record<string, never>,
        GetDiscoveryStackResponse
      >(getCallableFunctions(), 'getDiscoveryStack')
      const result = await getStack({})
      const profiles = await resolveProfiles(result.data.stack)

      if (useSubscriptionStore.getState().isPremium()) {
        set({
          dailyLikesCount: 0,
          isLimitReached: false,
          dailyLimitReached: false,
        })
      } else {
        await get().checkDailyLimit(userId)
      }

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

      if (user === null) {
        return
      }

      const subscriptionStore = useSubscriptionStore.getState()
      const isPremium = subscriptionStore.isPremium()

      if (!isPremium && get().dailyLikesCount >= FREE_DAILY_LIKE_LIMIT) {
        subscriptionStore.showUpsell('likes')
        return
      }

      const recordSwipe = getRecordSwipeFn()
      const result = await recordSwipe({ targetId, direction: 'like' })

      set((state) => {
        const nextStack = state.stack.filter(
          (userProfile) => userProfile.uid !== targetId
        )
        const nextDailyLikesCount = isPremium
          ? state.dailyLikesCount
          : getDailyLikesCountFromRemaining(result.data.remainingLikes)
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
    } catch (error: unknown) {
      if (isDailyLimitError(error)) {
        useSubscriptionStore.getState().showUpsell('likes')
        set({
          dailyLikesCount: FREE_DAILY_LIKE_LIMIT,
          dailyLimitReached: true,
          isLimitReached: true,
        })
        return
      }

      logUnexpectedSwipeError('swipeRight', error)
      const message = error instanceof Error ? error.message : 'Swipe failed'
      set({ error: message })
      showSwipeErrorToast()
      throw error instanceof Error ? error : new Error(message)
    }
  },

  swipeLeft: async (userId: string, targetId: string): Promise<void> => {
    try {
      const { user } = useAuthStore.getState()

      if (user === null || user.uid !== userId) {
        throw new Error('Pass failed')
      }

      const recordSwipe = getRecordSwipeFn()
      await recordSwipe({ targetId, direction: 'pass' })
    } catch (error: unknown) {
      logUnexpectedSwipeError('swipeLeft', error)
      const message = error instanceof Error ? error.message : 'Pass failed'
      set({ error: message })
      showSwipeErrorToast()
      throw error instanceof Error ? error : new Error(message)
    }
  },

  swipeSuperLike: async (targetId: string): Promise<void> => {
    try {
      const { user } = useAuthStore.getState()

      if (user === null) {
        return
      }

      const subscriptionStore = useSubscriptionStore.getState()

      if (!subscriptionStore.isPremium()) {
        subscriptionStore.showUpsell('superLike')
        return
      }

      const recordSwipe = getRecordSwipeFn()
      await recordSwipe({ targetId, direction: 'superlike' })

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
    } catch (error: unknown) {
      if (isDailyLimitError(error)) {
        useSubscriptionStore.getState().showUpsell('likes')
        return
      }

      logUnexpectedSwipeError('swipeSuperLike', error)
      const message =
        error instanceof Error ? error.message : 'Super like failed'
      set({ error: message })
      showSwipeErrorToast()
      throw error instanceof Error ? error : new Error(message)
    }
  },

  rewind: (): void => {
    if (!useSubscriptionStore.getState().isPremium()) {
      useSubscriptionStore.getState().showUpsell('rewind')
      return
    }

    // TODO Phase 3: implement actual rewind logic (restore last swiped card).
  },

  checkDailyLimit: async (userId: string): Promise<number> => {
    try {
      const data = await getDailyLikesDoc(userId)
      set({
        dailyLikesCount: data.count,
        isLimitReached: data.remaining <= 0,
        dailyLimitReached: data.remaining <= 0,
      })

      return data.remaining
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Daily limit check failed'
      set({ error: message })

      return 0
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
