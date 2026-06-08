import { useCallback, useMemo, useState } from 'react'

import { useMatchStore } from '@/store/matchStore'

import type { MatchWithProfile } from '@/types/match'

export interface MatchFilterState {
  query: string
  activities: string[]
  recentlyActiveOnly: boolean
}

export interface UseMatchFilterReturn {
  filter: MatchFilterState
  setQuery: (query: string) => void
  toggleActivity: (activity: string) => void
  setRecentlyActiveOnly: (value: boolean) => void
  resetFilter: () => void
  isFilterActive: boolean
  filteredMatches: MatchWithProfile[]
  activeFilterCount: number
}

const DEFAULT_FILTER: MatchFilterState = {
  query: '',
  activities: [],
  recentlyActiveOnly: false,
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export const useMatchFilter = (): UseMatchFilterReturn => {
  const matches = useMatchStore((state) => state.matches)
  const [filter, setFilter] = useState<MatchFilterState>(DEFAULT_FILTER)

  const setQuery = useCallback((query: string): void => {
    setFilter((previousFilter) => ({ ...previousFilter, query }))
  }, [])

  const toggleActivity = useCallback((activity: string): void => {
    setFilter((previousFilter) => {
      const isSelected = previousFilter.activities.includes(activity)
      const activities = isSelected
        ? previousFilter.activities.filter(
            (selectedActivity) => selectedActivity !== activity
          )
        : [...previousFilter.activities, activity]

      return { ...previousFilter, activities }
    })
  }, [])

  const setRecentlyActiveOnly = useCallback((value: boolean): void => {
    setFilter((previousFilter) => ({
      ...previousFilter,
      recentlyActiveOnly: value,
    }))
  }, [])

  const resetFilter = useCallback((): void => {
    setFilter(DEFAULT_FILTER)
  }, [])

  const isFilterActive = useMemo(
    (): boolean =>
      filter.query.trim().length > 0 ||
      filter.activities.length > 0 ||
      filter.recentlyActiveOnly,
    [filter]
  )

  const activeFilterCount = useMemo((): number => {
    let count = 0

    if (filter.activities.length > 0) {
      count += 1
    }

    if (filter.recentlyActiveOnly) {
      count += 1
    }

    return count
  }, [filter.activities.length, filter.recentlyActiveOnly])

  const filteredMatches = useMemo((): MatchWithProfile[] => {
    const trimmedQuery = filter.query.trim().toLowerCase()
    const recentlyActiveThreshold = Date.now() - ONE_DAY_MS

    return matches.filter((match) => {
      const profile = match.otherUser

      if (
        trimmedQuery.length > 0 &&
        !profile.firstName.toLowerCase().includes(trimmedQuery)
      ) {
        return false
      }

      if (filter.activities.length > 0) {
        const hasActivityOverlap = filter.activities.some((activity) =>
          profile.activities.includes(activity)
        )

        if (!hasActivityOverlap) {
          return false
        }
      }

      if (
        filter.recentlyActiveOnly &&
        profile.lastActive.toMillis() < recentlyActiveThreshold
      ) {
        return false
      }

      return true
    })
  }, [filter, matches])

  return {
    filter,
    setQuery,
    toggleActivity,
    setRecentlyActiveOnly,
    resetFilter,
    isFilterActive,
    filteredMatches,
    activeFilterCount,
  }
}
