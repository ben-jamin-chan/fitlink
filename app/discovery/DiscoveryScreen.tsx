import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useDiscoveryStore } from '@/store/discoveryStore'
import { useMatchStore } from '@/store/matchStore'
import { useProfileStore } from '@/store/profileStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'

import { ActionButtons } from '@/components/discovery/ActionButtons'
import { EmptyState } from '@/components/discovery/EmptyState'
import { FullProfileModal } from '@/components/discovery/FullProfileModal'
import { MatchCelebrationModal } from '@/components/discovery/MatchCelebrationModal'
import { SwipeCard } from '@/components/discovery/SwipeCard'
import { UpsellModal } from '@/components/discovery/UpsellModal'

import type { UserProfile } from '@/types/user'

import { colors, spacing } from '@/constants/theme'

const STACK_SIZE = 3

const DiscoveryScreen = (): React.JSX.Element | null => {
  const userId = useAuthStore((state) => state.user?.uid)
  const stack = useDiscoveryStore((state) => state.stack)
  const currentIndex = useDiscoveryStore((state) => state.currentIndex)
  const isLoading = useDiscoveryStore((state) => state.isLoading)
  const isRefetching = useDiscoveryStore((state) => state.isRefetching)
  const fetchStack = useDiscoveryStore((state) => state.fetchStack)
  const swipeRight = useDiscoveryStore((state) => state.swipeRight)
  const swipeLeft = useDiscoveryStore((state) => state.swipeLeft)
  const swipeSuperLike = useDiscoveryStore((state) => state.swipeSuperLike)
  const rewind = useDiscoveryStore((state) => state.rewind)
  const advanceStack = useDiscoveryStore((state) => state.advanceStack)
  const newMatchIds = useMatchStore((state) => state.newMatchIds)
  const matches = useMatchStore((state) => state.matches)
  const clearNewMatch = useMatchStore((state) => state.clearNewMatch)
  const profile = useProfileStore((state) => state.profile)
  const fetchProfile = useProfileStore((state) => state.fetchProfile)
  const upsellVisible = useSubscriptionStore((state) => state.upsellVisible)
  const upsellReason = useSubscriptionStore((state) => state.upsellReason)
  const hideUpsell = useSubscriptionStore((state) => state.hideUpsell)

  const [modalProfile, setModalProfile] = useState<UserProfile | null>(null)

  const visibleStack = useMemo(
    () => stack.slice(currentIndex, currentIndex + STACK_SIZE),
    [currentIndex, stack],
  )
  const pendingMatchId = newMatchIds.length > 0 ? newMatchIds[0] : null
  const pendingMatch =
    pendingMatchId !== null
      ? matches.find((match) => match.id === pendingMatchId) ?? null
      : null
  const currentUserPhoto = profile?.photos[0] ?? ''

  useEffect(() => {
    if (userId && profile?.uid !== userId) {
      void fetchProfile(userId)
    }
  }, [fetchProfile, profile?.uid, userId])

  useEffect(() => {
    if (userId && stack.length === 0 && !isLoading) {
      void fetchStack(userId)
    }
  }, [fetchStack, isLoading, stack.length, userId])

  useEffect(() => {
    if (isRefetching && userId) {
      void fetchStack(userId)
    }
  }, [fetchStack, isRefetching, userId])

  if (!userId) {
    return null
  }

  const handleSwipeRight = (): void => {
    const target = visibleStack[0]

    if (!target) {
      return
    }

    void swipeRight(target.uid).catch(() => undefined)
  }

  const handleSwipeLeft = (): void => {
    const target = visibleStack[0]

    if (!target) {
      return
    }

    void swipeLeft(userId, target.uid)
      .then(() => {
        advanceStack()
      })
      .catch(() => undefined)
  }

  const handleSuperLike = (): void => {
    const target = visibleStack[0]

    if (!target) {
      return
    }

    void swipeSuperLike(target.uid).catch(() => undefined)
  }

  const handleRewind = (): void => {
    rewind()
  }

  const handleTapInfo = (user: UserProfile): void => {
    setModalProfile(user)
  }

  const handleRefresh = (): void => {
    void fetchStack(userId)
  }

  const handleEditPreferences = (): void => {
    // TODO: Task 38 - navigate to Settings preferences
  }

  const handleTopInfo = (): void => {
    const target = visibleStack[0]

    if (target) {
      handleTapInfo(target)
    }
  }

  const handleModalDismiss = useCallback((): void => {
    if (pendingMatchId !== null) {
      clearNewMatch(pendingMatchId)
    }
  }, [clearNewMatch, pendingMatchId])

  const isStackEmpty = visibleStack.length === 0

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stackArea}>
        {isLoading && isStackEmpty && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {!isLoading && isStackEmpty && (
          <EmptyState
            onRefresh={handleRefresh}
            onEditPreferences={handleEditPreferences}
          />
        )}

        {visibleStack
          .map((user, index) => (
            <View key={user.uid} style={styles.cardSlot}>
              <SwipeCard
                user={user}
                stackIndex={index}
                isTop={index === 0}
                onSwipeRight={handleSwipeRight}
                onSwipeLeft={handleSwipeLeft}
                onSuperLike={handleSuperLike}
                onTap={() => handleTapInfo(user)}
              />
            </View>
          ))
          .reverse()}
      </View>

      <ActionButtons
        onPass={handleSwipeLeft}
        onLike={handleSwipeRight}
        onSuperLike={handleSuperLike}
        onRewind={handleRewind}
        onInfo={handleTopInfo}
        disabled={isLoading || isStackEmpty}
      />

      <UpsellModal
        visible={upsellVisible}
        onDismiss={hideUpsell}
        reason={upsellReason}
      />

      <FullProfileModal
        visible={modalProfile !== null}
        profile={modalProfile}
        viewerProfile={null}
        onClose={() => setModalProfile(null)}
        onActionComplete={() => {
          setModalProfile(null)
          advanceStack()
        }}
      />

      {pendingMatch !== null && (
        <MatchCelebrationModal
          matchId={pendingMatch.id}
          otherUser={pendingMatch.otherUser}
          currentUserPhoto={currentUserPhoto}
          currentUserActivities={profile?.activities ?? []}
          onDismiss={handleModalDismiss}
        />
      )}
    </SafeAreaView>
  )
}

export default DiscoveryScreen

const styles = StyleSheet.create({
  cardSlot: {
    bottom: spacing.md,
    left: spacing.md,
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
  },
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  stackArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
})
