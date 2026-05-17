import React from 'react'

import {
  ActionSheetIOS,
  Alert,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Timestamp } from 'firebase/firestore'
import { useTranslation } from 'react-i18next'

import { useMatchStore } from '@/store/matchStore'

import type { MatchWithProfile } from '@/types/match'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

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

interface MatchCardProps {
  match: MatchWithProfile
  currentUserId: string
  onPress: () => void
  onLongPress: () => void
}

export const MatchCard = ({
  match,
  currentUserId,
  onPress,
  onLongPress,
}: MatchCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const unmatch = useMatchStore((state) => state.unmatch)
  const otherUser = match.otherUser
  const unreadCount = getUnreadCount(match, currentUserId)
  const showUnreadBadge = unreadCount > 0
  const showNewBadge = !showUnreadBadge && match.lastMessage == null
  const primaryPhoto = otherUser.photos[0] ?? ''
  const online = isOnline(otherUser.lastActive)

  const handleUnmatch = (): void => {
    Alert.alert(
      t('matches.unmatch.title', { name: otherUser.firstName }),
      t('matches.unmatch.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('matches.unmatch.confirm'),
          style: 'destructive',
          onPress: () => {
            void unmatch(match.id)
          },
        },
      ]
    )
  }

  const handleLongPress = (): void => {
    onLongPress()

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t('matches.actions.viewProfile'),
            t('matches.actions.unmatch'),
            t('matches.actions.report'),
            t('common.cancel'),
          ],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 3,
        },
        (buttonIndex: number): void => {
          if (buttonIndex === 0) {
            // TODO: open FullProfileModal
          }

          if (buttonIndex === 1) {
            handleUnmatch()
          }

          if (buttonIndex === 2) {
            // TODO: report flow Task 38
          }
        }
      )
      return
    }

    Alert.alert(otherUser.firstName, '', [
      {
        text: t('matches.actions.viewProfile'),
        onPress: (): void => {
          // TODO: open FullProfileModal
        },
      },
      {
        text: t('matches.actions.unmatch'),
        style: 'destructive',
        onPress: handleUnmatch,
      },
      {
        text: t('matches.actions.report'),
        onPress: (): void => {
          // TODO: report flow Task 38
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.85}
    >
      <ImageBackground
        source={{ uri: primaryPhoto }}
        style={styles.image}
        imageStyle={styles.imageRadius}
      >
        <LinearGradient
          colors={[colors.transparent, colors.overlay]}
          style={styles.gradient}
        />

        <View style={styles.badgeStack}>
          {showNewBadge && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{t('matches.badge.new')}</Text>
            </View>
          )}

          {showUnreadBadge && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {otherUser.firstName}
          </Text>
          {otherUser.verified && (
            <Ionicons
              name="checkmark-circle"
              size={spacing.md - spacing.xs / 2}
              color={colors.secondary}
            />
          )}
        </View>

        {online && <View style={styles.onlineDot} />}
      </ImageBackground>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  badgeStack: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
  },
  card: {
    aspectRatio: 3 / 4,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    width: '100%',
  },
  gradient: {
    bottom: 0,
    height: '40%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  image: {
    flex: 1,
  },
  imageRadius: {
    borderRadius: borderRadius.md,
  },
  name: {
    color: colors.white,
    flexShrink: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  nameRow: {
    alignItems: 'center',
    bottom: spacing.xs,
    flexDirection: 'row',
    gap: spacing.xs,
    left: spacing.xs,
    maxWidth: '78%',
    position: 'absolute',
  },
  newBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  newBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  onlineDot: {
    backgroundColor: colors.online,
    borderColor: colors.white,
    borderRadius: borderRadius.full,
    borderWidth: spacing.xs / 2,
    bottom: spacing.xs,
    height: spacing.sm + spacing.xs / 2,
    position: 'absolute',
    right: spacing.xs,
    width: spacing.sm + spacing.xs / 2,
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: borderRadius.full,
    minHeight: spacing.lg,
    minWidth: spacing.lg,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
})
