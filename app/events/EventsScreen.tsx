import React, { useCallback, useEffect, useState } from 'react'

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { ListRenderItem, TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useEventsStore } from '@/store/eventsStore'
import { useProfileStore } from '@/store/profileStore'

import { EventCard } from '@/components/events/EventCard'

import type {
  EventsStackParamList,
  MainTabParamList,
} from '@/app/navigation/MainTabNavigator'
import type { FitlinkEvent } from '@/types/event'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type EventsScreenNavigationProp = CompositeNavigationProp<
  StackNavigationProp<EventsStackParamList, 'Events'>,
  BottomTabNavigationProp<MainTabParamList>
>

type EventsTabKey = 'discover' | 'my'

interface EventsScreenProps {
  navigation: EventsScreenNavigationProp
}

interface EventsScreenStyles {
  container: ViewStyle
  emptyAction: ViewStyle
  emptyActionText: TextStyle
  emptyContainer: ViewStyle
  emptyText: TextStyle
  emptyWrap: ViewStyle
  fab: ViewStyle
  header: ViewStyle
  listContent: ViewStyle
  loadingWrap: ViewStyle
  screenTitle: TextStyle
  tab: ViewStyle
  tabActive: ViewStyle
  tabLabel: TextStyle
  tabLabelActive: TextStyle
  tabRow: ViewStyle
}

const EVENT_TABS: EventsTabKey[] = ['discover', 'my']
const EMPTY_ICON_SIZE = 48
const FAB_ICON_SIZE = 56

export default function EventsScreen({
  navigation,
}: EventsScreenProps): React.JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<EventsTabKey>('discover')
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const userId = useAuthStore((state) => state.user?.uid)
  const city = useProfileStore((state) => state.profile?.location.city ?? '')
  const upcomingEvents = useEventsStore((state) => state.upcomingEvents)
  const myEvents = useEventsStore((state) => state.myEvents)
  const isLoading = useEventsStore((state) => state.isLoading)
  const fetchUpcomingEvents = useEventsStore(
    (state) => state.fetchUpcomingEvents
  )
  const fetchMyEvents = useEventsStore((state) => state.fetchMyEvents)

  const loadDiscover = useCallback(async (): Promise<void> => {
    await fetchUpcomingEvents(city)
  }, [city, fetchUpcomingEvents])

  const loadMyEvents = useCallback(async (): Promise<void> => {
    if (userId === undefined) {
      return
    }

    await fetchMyEvents(userId)
  }, [fetchMyEvents, userId])

  useEffect(() => {
    if (activeTab === 'discover') {
      void loadDiscover()
      return
    }

    void loadMyEvents()
  }, [activeTab, loadDiscover, loadMyEvents])

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true)

    try {
      if (activeTab === 'discover') {
        await loadDiscover()
        return
      }

      await loadMyEvents()
    } finally {
      setIsRefreshing(false)
    }
  }, [activeTab, loadDiscover, loadMyEvents])

  const handleCardPress = useCallback(
    (eventId: string): void => {
      navigation.navigate('EventDetail', { eventId })
    },
    [navigation]
  )

  const renderEvent: ListRenderItem<FitlinkEvent> = useCallback(
    ({ item }) => (
      <EventCard
        event={item}
        currentUserId={userId ?? ''}
        onPress={handleCardPress}
      />
    ),
    [handleCardPress, userId]
  )

  const handleCreateEvent = (): void => {
    navigation.navigate('CreateEvent')
  }

  const listData = activeTab === 'discover' ? upcomingEvents : myEvents
  const emptyText =
    activeTab === 'discover'
      ? t('events.discover.empty')
      : t('events.myEvents.empty')

  const renderEmpty = (): React.JSX.Element | null => {
    if (isLoading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )
    }

    return (
      <View style={styles.emptyWrap}>
        <Ionicons
          name="calendar-outline"
          size={EMPTY_ICON_SIZE}
          color={colors.gray[300]}
        />
        <Text style={styles.emptyText}>{emptyText}</Text>
        {activeTab === 'discover' && (
          <TouchableOpacity
            style={styles.emptyAction}
            onPress={handleCreateEvent}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyActionText}>
              {t('events.discover.createCta')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>{t('events.title')}</Text>
      </View>

      <View style={styles.tabRow}>
        {EVENT_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab && styles.tabLabelActive,
              ]}
            >
              {tab === 'discover'
                ? t('events.tabs.discover')
                : t('events.tabs.myEvents')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item: FitlinkEvent): string => item.id}
        renderItem={renderEvent}
        contentContainerStyle={
          listData.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateEvent}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={FAB_ICON_SIZE} color={colors.primary} />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create<EventsScreenStyles>({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  emptyAction: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  emptyActionText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    color: colors.gray[500],
    fontSize: typography.sizes.md,
    textAlign: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  fab: {
    bottom: spacing.xl,
    position: 'absolute',
    right: spacing.lg,
  },
  header: {
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  loadingWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  screenTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  tab: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  tabLabelActive: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
})
