import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import type { Insets, TextStyle, ViewStyle } from 'react-native'

import AsyncStorage from '@react-native-async-storage/async-storage'
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
import { MatchFilterSheet } from '@/components/matches/MatchFilterSheet'
import { Button } from '@/components/ui/Button'
import { PremiumBadge } from '@/components/ui/PremiumBadge'

import { useMatchFilter } from '@/hooks/useMatchFilter'

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
const SEARCH_ICON_SIZE = spacing.lg - spacing.xs
const SEARCH_CONTROL_SIZE = spacing.xl + spacing.sm
const SAFETY_PROMPT_STORAGE_KEY = 'fitlink-safety-prompt-shown'
const FILTER_HIT_SLOP: Insets = {
  bottom: spacing.sm,
  left: spacing.sm,
  right: spacing.sm,
  top: spacing.sm,
}

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
  const [filterSheetVisible, setFilterSheetVisible] = useState(false)
  const [safetyPromptVisible, setSafetyPromptVisible] = useState(false)
  const safetyPromptChecked = useRef(false)
  const {
    filter,
    setQuery,
    toggleActivity,
    setRecentlyActiveOnly,
    resetFilter,
    isFilterActive,
    filteredMatches,
    activeFilterCount,
  } = useMatchFilter()
  const isPremium = useMemo(
    () => getIsPremium(),
    [getIsPremium, premiumStatus]
  )

  const allMatches = useMemo(
    () =>
      filteredMatches
        .slice()
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()),
    [filteredMatches]
  )

  const conversations = useMemo(
    () =>
      filteredMatches
        .filter((match) => match.lastMessage != null)
        .slice()
        .sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis() ?? 0
          const bTime = b.lastMessageAt?.toMillis() ?? 0

          return bTime - aTime
        }),
    [filteredMatches]
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

  useEffect((): (() => void) | undefined => {
    if (matches.length === 0 || safetyPromptChecked.current) {
      return undefined
    }

    let isMounted = true

    const checkSafetyPrompt = async (): Promise<void> => {
      safetyPromptChecked.current = true

      try {
        const shown = await AsyncStorage.getItem(SAFETY_PROMPT_STORAGE_KEY)

        if (shown === null && isMounted) {
          setSafetyPromptVisible(true)
        }
      } catch {
        return
      }
    }

    void checkSafetyPrompt()

    return (): void => {
      isMounted = false
    }
  }, [matches.length])

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

  const handleSafetyPromptDismiss = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(SAFETY_PROMPT_STORAGE_KEY, 'true')
    } finally {
      setSafetyPromptVisible(false)
    }
  }, [])

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

  const renderFilterEmptyState = (): React.JSX.Element => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{t('matches.search.noResults')}</Text>
      <Text style={styles.emptySub}>{t('matches.search.noResultsHint')}</Text>
      <Button
        variant="outline"
        label={t('matches.filter.reset')}
        onPress={resetFilter}
      />
    </View>
  )

  if (userId === undefined) {
    return null
  }

  const renderMatchesTab = (): React.JSX.Element => {
    if (isLoading && matches.length === 0) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )
    }

    if (matches.length === 0) {
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

    if (filteredMatches.length === 0 && isFilterActive) {
      return renderFilterEmptyState()
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
    if (isLoading && matches.length === 0) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )
    }

    if (filteredMatches.length === 0 && matches.length > 0 && isFilterActive) {
      return renderFilterEmptyState()
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

      {isPremium ? (
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons
              name="search-outline"
              size={SEARCH_ICON_SIZE}
              color={colors.gray[400]}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t('matches.search.placeholder')}
              placeholderTextColor={colors.gray[400]}
              value={filter.query}
              onChangeText={setQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.filterButton,
              isFilterActive && styles.filterButtonActive,
            ]}
            onPress={() => setFilterSheetVisible(true)}
            hitSlop={FILTER_HIT_SLOP}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={spacing.lg}
              color={isFilterActive ? colors.white : colors.gray[600]}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeLabel}>
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.searchRowLocked}
          onPress={() => navigation.navigate('Premium')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="search-outline"
            size={SEARCH_ICON_SIZE}
            color={colors.gray[400]}
          />
          <Text style={styles.searchLockedLabel}>
            {t('matches.search.premiumOnly')}
          </Text>
          <PremiumBadge tier="plus" size="sm" />
        </TouchableOpacity>
      )}

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
      <MatchFilterSheet
        visible={filterSheetVisible}
        filter={filter}
        onToggleActivity={toggleActivity}
        onSetRecentlyActiveOnly={setRecentlyActiveOnly}
        onReset={resetFilter}
        onClose={() => setFilterSheetVisible(false)}
      />
      <Modal
        visible={safetyPromptVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={(): void => {
          void handleSafetyPromptDismiss()
        }}
      >
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <View style={styles.promptIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={spacing.xxl}
                color={colors.primary}
              />
            </View>
            <Text style={styles.promptTitle}>
              {t('safety.prompt.title')}
            </Text>
            <Text style={styles.promptBody}>{t('safety.prompt.body')}</Text>
            <Pressable
              style={styles.promptButton}
              onPress={(): void => {
                void handleSafetyPromptDismiss()
              }}
              accessibilityRole="button"
            >
              <Text style={styles.promptButtonText}>
                {t('safety.prompt.cta')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  filterBadge: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: borderRadius.full,
    height: spacing.md,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: spacing.md,
  } as ViewStyle,
  filterBadgeLabel: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  } as TextStyle,
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    height: SEARCH_CONTROL_SIZE,
    justifyContent: 'center',
    width: SEARCH_CONTROL_SIZE,
  } as ViewStyle,
  filterButtonActive: {
    backgroundColor: colors.primary,
  } as ViewStyle,
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  messageSeparator: {
    backgroundColor: colors.gray[200],
    height: StyleSheet.hairlineWidth,
    marginLeft: AVATAR_SEPARATOR_OFFSET,
  },
  promptBody: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  promptButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
  },
  promptButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  promptCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
  },
  promptIconWrap: {
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  promptOverlay: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  promptTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  searchIcon: {
    marginRight: spacing.xs,
  } as TextStyle,
  searchInput: {
    color: colors.gray[800],
    flex: 1,
    fontSize: typography.sizes.md,
    height: SEARCH_CONTROL_SIZE,
  } as TextStyle,
  searchInputWrap: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    flex: 1,
    flexDirection: 'row',
    height: SEARCH_CONTROL_SIZE,
    paddingHorizontal: spacing.sm,
  } as ViewStyle,
  searchLockedLabel: {
    color: colors.gray[400],
    flex: 1,
    fontSize: typography.sizes.md,
  } as TextStyle,
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
  } as ViewStyle,
  searchRowLocked: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  } as ViewStyle,
  tabBar: {
    borderBottomColor: colors.gray[200],
    borderBottomWidth: StyleSheet.hairlineWidth,
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
