import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useMatchStore } from '@/store/matchStore'
import { useProfileStore } from '@/store/profileStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'

import { MatchCard } from '@/components/chat/MatchCard'
import { MessageListItem } from '@/components/chat/MessageListItem'
import { Button } from '@/components/ui/Button'
import { PremiumBadge } from '@/components/ui/PremiumBadge'

import type {
  MainTabParamList,
  MatchesStackParamList,
} from '@/app/navigation/MainTabNavigator'
import type { RootStackParamList } from '@/app/navigation/RootNavigator'
import type { MatchWithProfile } from '@/types/match'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type ActiveTab = 'matches' | 'messages'

type MatchesNavigationProp = CompositeNavigationProp<
  StackNavigationProp<MatchesStackParamList, 'MatchesList'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList>,
    StackNavigationProp<RootStackParamList>
  >
>

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = spacing.lg * 2
const GRID_GAP = spacing.sm
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING - GRID_GAP * 2) / 3
const AVATAR_SEPARATOR_OFFSET = spacing.xxxl - spacing.xs + spacing.md

const MatchesScreen = (): React.JSX.Element | null => {
  const { t } = useTranslation()
  const navigation = useNavigation<MatchesNavigationProp>()
  const userId = useAuthStore((state) => state.user?.uid)
  const matches = useMatchStore((state) => state.matches)
  const isLoading = useMatchStore((state) => state.isLoading)
  const subscribeToMatches = useMatchStore((state) => state.subscribeToMatches)
  const unsubscribeFromMatches = useMatchStore(
    (state) => state.unsubscribeFromMatches
  )
  const markAsRead = useMatchStore((state) => state.markAsRead)
  const unmatch = useMatchStore((state) => state.unmatch)
  const premiumStatus = useProfileStore((state) => state.profile?.premium)
  const getIsPremium = useSubscriptionStore((state) => state.isPremium)
  const [activeTab, setActiveTab] = useState<ActiveTab>('matches')
  const isPremium = useMemo(
    () => getIsPremium(),
    [getIsPremium, premiumStatus]
  )

  const allMatches = useMemo(
    () =>
      matches
        .slice()
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()),
    [matches]
  )

  const conversations = useMemo(
    () =>
      matches
        .filter((match) => match.lastMessage != null)
        .slice()
        .sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis() ?? 0
          const bTime = b.lastMessageAt?.toMillis() ?? 0

          return bTime - aTime
        }),
    [matches]
  )

  useEffect(() => {
    if (userId === undefined) {
      return undefined
    }

    subscribeToMatches(userId)

    return (): void => {
      unsubscribeFromMatches()
    }
  }, [subscribeToMatches, unsubscribeFromMatches, userId])

  const handleRefresh = useCallback((): void => {
    if (userId === undefined) {
      return
    }

    unsubscribeFromMatches()
    subscribeToMatches(userId)
  }, [subscribeToMatches, unsubscribeFromMatches, userId])

  const handleOpenChat = useCallback(
    (matchId: string): void => {
      void markAsRead(matchId)
      navigation.navigate('Chat', { matchId })
    },
    [markAsRead, navigation]
  )

  const handleUnmatch = useCallback(
    (match: MatchWithProfile): void => {
      Alert.alert(
        t('matches.unmatch.title', { name: match.otherUser.firstName }),
        t('matches.unmatch.message'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('matches.unmatch.confirm'),
            style: 'destructive',
            onPress: (): void => {
              void unmatch(match.id)
            },
          },
        ]
      )
    },
    [t, unmatch]
  )

  const handleSearchPress = useCallback((): void => {
    if (!isPremium) {
      navigation.navigate('Premium')
      return
    }

    // TODO Phase 3: open search/filter modal.
  }, [isPremium, navigation])

  const renderMatch = useCallback(
    ({ item }: { item: MatchWithProfile }): React.JSX.Element => (
      <View style={styles.gridItem}>
        <MatchCard
          match={item}
          currentUserId={userId ?? ''}
          onPress={() => handleOpenChat(item.id)}
          onLongPress={() => undefined}
        />
      </View>
    ),
    [handleOpenChat, userId]
  )

  const renderConversation = useCallback(
    ({ item }: { item: MatchWithProfile }): React.JSX.Element => (
      <MessageListItem
        match={item}
        currentUserId={userId ?? ''}
        onPress={() => handleOpenChat(item.id)}
        onSwipeUnmatch={() => handleUnmatch(item)}
      />
    ),
    [handleOpenChat, handleUnmatch, userId]
  )

  const renderMessageSeparator = useCallback(
    (): React.JSX.Element => <View style={styles.messageSeparator} />,
    []
  )

  if (userId === undefined) {
    return null
  }

  const renderMatchesTab = (): React.JSX.Element => {
    if (isLoading && allMatches.length === 0) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )
    }

    if (allMatches.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="heart-outline"
            size={spacing.xxxl}
            color={colors.gray[300]}
          />
          <Text style={styles.emptyTitle}>
            {t('matches.empty.matchesTitle')}
          </Text>
          <Text style={styles.emptySub}>{t('matches.empty.matchesSub')}</Text>
          <Button
            label={t('matches.empty.startSwiping')}
            onPress={() => navigation.navigate('Discover')}
          />
        </View>
      )
    }

    return (
      <FlatList
        data={allMatches}
        keyExtractor={(item: MatchWithProfile): string => item.id}
        renderItem={renderMatch}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        refreshing={isLoading}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
      />
    )
  }

  const renderMessagesTab = (): React.JSX.Element => {
    if (isLoading && conversations.length === 0) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )
    }

    if (conversations.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="chatbubble-outline"
            size={spacing.xxxl}
            color={colors.gray[300]}
          />
          <Text style={styles.emptyTitle}>
            {t('matches.empty.messagesTitle')}
          </Text>
          <Text style={styles.emptySub}>{t('matches.empty.messagesSub')}</Text>
          <Button
            label={t('matches.empty.viewMatches')}
            onPress={() => setActiveTab('matches')}
            variant="outline"
          />
        </View>
      )
    }

    return (
      <FlatList
        data={conversations}
        keyExtractor={(item: MatchWithProfile): string => item.id}
        renderItem={renderConversation}
        ItemSeparatorComponent={renderMessageSeparator}
        refreshing={isLoading}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
      />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('matches.title')}</Text>
      </View>

      <TouchableOpacity
        style={styles.searchRow}
        onPress={handleSearchPress}
        activeOpacity={0.8}
      >
        <Ionicons
          name="search-outline"
          size={typography.sizes.lg}
          color={colors.gray[600]}
        />
        <Text style={styles.searchPlaceholder}>
          {t('matches.searchPlaceholder')}
        </Text>
        {!isPremium && <PremiumBadge tier="plus" size="sm" />}
      </TouchableOpacity>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'matches' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('matches')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'matches' && styles.tabLabelActive,
            ]}
          >
            {t('matches.tabs.matches')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'messages' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('messages')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'messages' && styles.tabLabelActive,
            ]}
          >
            {t('matches.tabs.messages')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'matches' ? renderMatchesTab() : renderMessagesTab()}
      </View>
    </SafeAreaView>
  )
}

export default MatchesScreen

const styles = StyleSheet.create({
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptySub: {
    color: colors.gray[500],
    fontSize: typography.sizes.md,
    textAlign: 'center',
  },
  emptyTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  gridContent: {
    gap: GRID_GAP,
    padding: spacing.lg,
  },
  gridItem: {
    width: CARD_WIDTH,
  },
  gridRow: {
    gap: GRID_GAP,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  messageSeparator: {
    backgroundColor: colors.gray[200],
    height: 1,
    marginLeft: AVATAR_SEPARATOR_OFFSET,
  },
  searchPlaceholder: {
    color: colors.gray[600],
    flex: 1,
    fontSize: typography.sizes.md,
  },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tabBar: {
    borderBottomColor: colors.gray[200],
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  tabButton: {
    borderBottomColor: colors.transparent,
    borderBottomWidth: spacing.xs / 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    color: colors.gray[500],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  title: {
    color: colors.gray[900],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
})
