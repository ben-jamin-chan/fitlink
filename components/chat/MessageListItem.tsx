import React, { useMemo, useRef } from 'react'

import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Timestamp } from 'firebase/firestore'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import type { MatchWithProfile } from '@/types/match'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000
const AVATAR_SIZE = spacing.xxxl - spacing.xs
const AVATAR_RADIUS = AVATAR_SIZE / 2
const ONLINE_DOT_SIZE = spacing.sm + spacing.xs / 2
const SWIPE_REVEAL_WIDTH = spacing.xxl + spacing.xl
const SWIPE_REVEAL_THRESHOLD = AVATAR_SIZE

const getUnreadCount = (
  match: MatchWithProfile,
  currentUserId: string
): number => {
  // Firestore stores unread counts under dynamic user-id keys.
  const unreadValue = (match as Record<string, unknown>)[
    `${currentUserId}_unread`
  ] as number | undefined

  return typeof unreadValue === 'number' ? unreadValue : 0
}

const isOnline = (lastActive: Timestamp): boolean => {
  return Timestamp.now().toMillis() - lastActive.toMillis() < ONLINE_THRESHOLD_MS
}

const formatRelativeTime = (
  timestamp: Timestamp | null | undefined,
  t: TFunction
): string => {
  if (timestamp == null) {
    return ''
  }

  const now = Timestamp.now().toMillis()
  const then = timestamp.toMillis()
  const diff = now - then

  if (diff < 60 * 1000) {
    return t('matches.time.justNow')
  }

  if (diff < 60 * 60 * 1000) {
    return t('matches.time.minutesAgo', {
      count: Math.floor(diff / (60 * 1000)),
    })
  }

  if (diff < 24 * 60 * 60 * 1000) {
    return t('matches.time.hoursAgo', {
      count: Math.floor(diff / (60 * 60 * 1000)),
    })
  }

  if (diff < 48 * 60 * 60 * 1000) {
    return t('matches.time.yesterday')
  }

  const timestampDate = timestamp.toDate()
  const nowDate = new Date()
  const startOfWeek = new Date(nowDate)
  startOfWeek.setDate(nowDate.getDate() - nowDate.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  if (timestampDate >= startOfWeek) {
    return timestampDate.toLocaleDateString('en-US', { weekday: 'short' })
  }

  return timestampDate.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  })
}

interface MessageListItemProps {
  match: MatchWithProfile
  currentUserId: string
  onPress: () => void
  onSwipeUnmatch: () => void
}

export const MessageListItem = ({
  match,
  currentUserId,
  onPress,
  onSwipeUnmatch,
}: MessageListItemProps): React.JSX.Element => {
  const { t } = useTranslation()
  const otherUser = match.otherUser
  const unreadCount = getUnreadCount(match, currentUserId)
  const translateX = useRef(new Animated.Value(0)).current
  const primaryPhoto = otherUser.photos[0] ?? ''
  const online = isOnline(otherUser.lastActive)
  const relativeTime = formatRelativeTime(match.lastMessageAt, t)
  const preview = match.lastMessage ?? t('matches.messages.noMessages')
  const foregroundAnimatedStyle = useMemo(
    () => ({
      transform: [{ translateX }],
    }),
    [translateX]
  )

  const animateRow = (toValue: number): void => {
    Animated.timing(translateX, {
      toValue,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState): boolean => {
        return (
          Math.abs(gestureState.dx) > spacing.sm &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        )
      },
      onPanResponderMove: (_, gestureState): void => {
        const nextValue = Math.max(
          -SWIPE_REVEAL_WIDTH,
          Math.min(0, gestureState.dx)
        )
        translateX.setValue(nextValue)
      },
      onPanResponderRelease: (_, gestureState): void => {
        if (gestureState.dx < -SWIPE_REVEAL_THRESHOLD) {
          animateRow(-SWIPE_REVEAL_WIDTH)
          return
        }

        animateRow(0)
      },
      onPanResponderTerminate: (): void => {
        animateRow(0)
      },
    })
  ).current

  const handleUnmatchPress = (): void => {
    animateRow(0)
    onSwipeUnmatch()
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.unmatchAction}
        onPress={handleUnmatchPress}
        activeOpacity={0.8}
      >
        <Text style={styles.unmatchText}>{t('matches.actions.unmatch')}</Text>
      </TouchableOpacity>

      <Animated.View
        style={[styles.rowForeground, foregroundAnimatedStyle]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.pressable}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <View style={styles.avatarWrap}>
            <Image source={{ uri: primaryPhoto }} style={styles.avatar} />
            {online && <View style={styles.onlineDot} />}
          </View>

          <View style={styles.content}>
            <View style={styles.topRow}>
              <Text style={styles.name} numberOfLines={1}>
                {otherUser.firstName}
              </Text>
              <Text style={styles.timestamp}>{relativeTime}</Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.preview} numberOfLines={2}>
                {preview}
              </Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.gray[200],
    borderRadius: AVATAR_RADIUS,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  avatarWrap: {
    height: AVATAR_SIZE,
    position: 'relative',
    width: AVATAR_SIZE,
  },
  container: {
    backgroundColor: colors.danger,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    color: colors.gray[900],
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  onlineDot: {
    backgroundColor: colors.online,
    borderColor: colors.white,
    borderRadius: borderRadius.full,
    borderWidth: spacing.xs / 2,
    bottom: 0,
    height: ONLINE_DOT_SIZE,
    position: 'absolute',
    right: 0,
    width: ONLINE_DOT_SIZE,
  },
  pressable: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  preview: {
    color: colors.gray[500],
    flex: 1,
    fontSize: typography.sizes.sm,
  },
  previewRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowForeground: {
    backgroundColor: colors.background,
  },
  timestamp: {
    color: colors.gray[500],
    fontSize: typography.sizes.xs,
    marginLeft: spacing.sm,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  unmatchAction: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: SWIPE_REVEAL_WIDTH,
  },
  unmatchText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    minHeight: spacing.lg,
    minWidth: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
})
