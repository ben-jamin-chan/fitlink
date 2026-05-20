import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'

import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useDiscoveryStore } from '@/store/discoveryStore'
import { useMatchStore } from '@/store/matchStore'
import { useProfileStore } from '@/store/profileStore'

import { ActionButtons } from '@/components/discovery/ActionButtons'
import { EmptyState } from '@/components/discovery/EmptyState'
import { FullProfileModal } from '@/components/discovery/FullProfileModal'
import { MatchCelebrationModal } from '@/components/discovery/MatchCelebrationModal'
import { SwipeCard } from '@/components/discovery/SwipeCard'
import {
  UpsellModal,
  type UpsellTrigger,
} from '@/components/discovery/UpsellModal'

import type { UserProfile } from '@/types/user'

import { colors, spacing } from '@/constants/theme'

const STACK_SIZE = 3

const DiscoveryScreen = (): React.JSX.Element | null => {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.user?.uid)
  const stack = useDiscoveryStore((state) => state.stack)
  const currentIndex = useDiscoveryStore((state) => state.currentIndex)
  const isLoading = useDiscoveryStore((state) => state.isLoading)
  const isRefetching = useDiscoveryStore((state) => state.isRefetching)
  const dailyLimitReached = useDiscoveryStore(
    (state) => state.dailyLimitReached,
  )
  const fetchStack = useDiscoveryStore((state) => state.fetchStack)
  const swipeRight = useDiscoveryStore((state) => state.swipeRight)
  const swipeLeft = useDiscoveryStore((state) => state.swipeLeft)
  const swipeSuperLike = useDiscoveryStore((state) => state.swipeSuperLike)
  const advanceStack = useDiscoveryStore((state) => state.advanceStack)
  const newMatchIds = useMatchStore((state) => state.newMatchIds)
  const matches = useMatchStore((state) => state.matches)
  const clearNewMatch = useMatchStore((state) => state.clearNewMatch)
  const profile = useProfileStore((state) => state.profile)
  const fetchProfile = useProfileStore((state) => state.fetchProfile)

  const [upsellVisible, setUpsellVisible] = useState(false)
  const [upsellTrigger, setUpsellTrigger] =
    useState<UpsellTrigger>('super_like')
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
  const isPremium = false

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

  useEffect(() => {
    if (dailyLimitReached) {
      setUpsellTrigger('daily_limit')
      setUpsellVisible(true)
    }
  }, [dailyLimitReached])

  if (!userId) {
    return null
  }

  const handleSwipeRight = (): void => {
    const target = visibleStack[0]

    if (!target) {
      return
    }

    void swipeRight(userId, target.uid, isPremium).then((result) => {
      if (result === 'ok') {
        advanceStack()
      }
    })
  }

  const handleSwipeLeft = (): void => {
    const target = visibleStack[0]

    if (!target) {
      return
    }

    void swipeLeft(userId, target.uid).then(() => {
      advanceStack()
    })
  }

  const handleSuperLike = (): void => {
    if (!isPremium) {
      setUpsellTrigger('super_like')
      setUpsellVisible(true)
      return
    }

    const target = visibleStack[0]

    if (!target) {
      return
    }

    void swipeSuperLike(userId, target.uid, isPremium).then((result) => {
      if (result === 'ok') {
        advanceStack()
      }
    })
  }

  const handleRewind = (): void => {
    if (!isPremium) {
      setUpsellTrigger('rewind')
      setUpsellVisible(true)
      return
    }

    // TODO: Phase 2 — implement undo stack
  }

  const handleUpgrade = (): void => {
    Alert.alert(
      t('discovery.upsell.comingSoon'),
      t('discovery.upsell.comingSoonMsg'),
    )
    setUpsellVisible(false)
    // TODO: Phase 2 — navigate to PremiumScreen
  }

  const handleTapInfo = (user: UserProfile): void => {
    setModalProfile(user)
  }

  const handleRefresh = (): void => {
    void fetchStack(userId)
  }

  const handleEditPreferences = (): void => {
    // TODO: Task 38 — navigate to Settings preferences
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
        isPremium={isPremium}
        disabled={isLoading || isStackEmpty}
      />

      <UpsellModal
        visible={upsellVisible}
        trigger={upsellTrigger}
        onDismiss={() => setUpsellVisible(false)}
        onUpgrade={handleUpgrade}
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
