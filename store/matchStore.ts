import type { Unsubscribe } from 'firebase/firestore'
import { create } from 'zustand'

import { useAuthStore } from '@/store/authStore'
import {
  deleteMatch,
  getUserProfile,
  resetUnreadCount,
  subscribeToMatches,
} from '@/services/firebase/firestore'

import type { Match, MatchWithProfile } from '@/types/match'

interface MatchState {
  matches: MatchWithProfile[]
  isLoading: boolean
  error: string | null
  newMatchIds: string[]
}

interface MatchActions {
  subscribeToMatches: (userId: string) => void
  unsubscribeFromMatches: () => void
  unmatch: (matchId: string) => Promise<void>
  markAsRead: (matchId: string) => Promise<void>
  clearNewMatch: (matchId: string) => void
  clearNewMatchId: (matchId: string) => void
}

type MatchStore = MatchState & MatchActions

const initialState: MatchState = {
  matches: [],
  isLoading: true,
  error: null,
  newMatchIds: [],
}

let unsubscribeFromFirestore: Unsubscribe | null = null

const resolveMatch = async (
  match: Match,
  currentUserId: string
): Promise<MatchWithProfile | null> => {
  const otherUserId = match.users.find((id) => id !== currentUserId)

  if (otherUserId === undefined) {
    return null
  }

  const otherUser = await getUserProfile(otherUserId)

  if (otherUser === null) {
    return null
  }

  return { ...match, otherUser }
}

export const useMatchStore = create<MatchStore>()((set, get) => ({
  ...initialState,

  subscribeToMatches: (userId: string): void => {
    if (unsubscribeFromFirestore !== null) {
      return
    }

    set({ isLoading: true, error: null })

    unsubscribeFromFirestore = subscribeToMatches(
      userId,
      async (rawMatches: Match[]): Promise<void> => {
        const settled = await Promise.allSettled(
          rawMatches.map((match) => resolveMatch(match, userId))
        )

        const resolved: MatchWithProfile[] = settled
          .filter(
            (result): result is PromiseFulfilledResult<MatchWithProfile> =>
              result.status === 'fulfilled' && result.value !== null
          )
          .map((result) => result.value)

        const previousIds = new Set(get().matches.map((match) => match.id))
        const arrivedIds = resolved
          .filter((match) => !previousIds.has(match.id))
          .map((match) => match.id)

        set((state) => ({
          matches: resolved,
          isLoading: false,
          error: null,
          newMatchIds: state.isLoading
            ? state.newMatchIds
            : [...state.newMatchIds, ...arrivedIds],
        }))
      },
      (error: Error): void => {
        set({ isLoading: false, error: error.message })
      }
    )
  },

  unsubscribeFromMatches: (): void => {
    if (unsubscribeFromFirestore !== null) {
      unsubscribeFromFirestore()
      unsubscribeFromFirestore = null
    }

    set(initialState)
  },

  unmatch: async (matchId: string): Promise<void> => {
    set((state) => ({
      matches: state.matches.filter((match) => match.id !== matchId),
      newMatchIds: state.newMatchIds.filter((id) => id !== matchId),
    }))

    try {
      await deleteMatch(matchId)
    } catch (error: unknown) {
      console.error('[matchStore] unmatch failed:', error)
    }
  },

  markAsRead: async (matchId: string): Promise<void> => {
    const userId = useAuthStore.getState().user?.uid

    if (userId === undefined) {
      return
    }

    set((state) => ({
      newMatchIds: state.newMatchIds.filter((id) => id !== matchId),
    }))

    try {
      await resetUnreadCount(matchId, userId)
    } catch (error: unknown) {
      console.error('[matchStore] markAsRead failed:', error)
    }
  },

  clearNewMatch: (matchId: string): void => {
    set((state) => ({
      newMatchIds: state.newMatchIds.filter((id) => id !== matchId),
    }))
  },

  clearNewMatchId: (matchId: string): void => {
    get().clearNewMatch(matchId)
  },
}))
