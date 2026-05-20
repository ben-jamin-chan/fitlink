import React, { useCallback, useEffect, useRef } from 'react'

import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useNavigation } from '@react-navigation/native'
import type { TFunction } from 'i18next'
import ConfettiCannon from 'react-native-confetti-cannon'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'

import { useMatchStore } from '@/store/matchStore'

import { Button } from '@/components/ui/Button'

import type { MainTabParamList } from '@/app/navigation/MainTabNavigator'
import type { UserProfile } from '@/types/user'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const PHOTO_SIZE = spacing.xxxl + spacing.xxl
const PHOTO_BORDER = spacing.xs
const HEART_ICON_SIZE = typography.sizes.xxxl
const CONFETTI_ORIGIN = { x: SCREEN_WIDTH / 2, y: -spacing.sm }
const CONFETTI_COLORS = [
  colors.primary,
  colors.secondary,
  colors.warning,
  colors.danger,
  colors.info,
]

interface MatchCelebrationModalProps {
  matchId: string
  otherUser: UserProfile
  currentUserPhoto: string
  currentUserActivities: string[]
  onDismiss: () => void
}

const getSharedActivities = (
  myActivities: string[],
  theirActivities: string[]
): string[] =>
  myActivities.filter((activity: string): boolean =>
    theirActivities.includes(activity)
  )

const formatActivitiesList = (
  activities: string[],
  t: TFunction
): string => {
  if (activities.length === 0) {
    return ''
  }

  if (activities.length === 1) {
    return activities[0]
  }

  if (activities.length === 2) {
    return t('discovery.matchCelebration.activitiesTwo', {
      first: activities[0],
      second: activities[1],
    })
  }

  return t('discovery.matchCelebration.activitiesMore', {
    first: activities[0],
    second: activities[1],
  })
}

export const MatchCelebrationModal = ({
  matchId,
  otherUser,
  currentUserPhoto,
  currentUserActivities,
  onDismiss,
}: MatchCelebrationModalProps): React.JSX.Element => {
  const { t } = useTranslation()
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>()
  const clearNewMatch = useMatchStore((state) => state.clearNewMatch)
  const confettiRef = useRef<ConfettiCannon>(null)

  const modalTranslateY = useSharedValue(SCREEN_HEIGHT)
  const photo1Scale = useSharedValue(0)
  const photo2Scale = useSharedValue(0)
  const headlineOpacity = useSharedValue(0)
  const subOpacity = useSharedValue(0)
  const badgesOpacity = useSharedValue(0)
  const buttonsOpacity = useSharedValue(0)

  const fireConfetti = useCallback((): void => {
    confettiRef.current?.start()
  }, [])

  useEffect((): (() => void) => {
    modalTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 })

    const confettiTimeout = setTimeout((): void => {
      fireConfetti()
    }, 250)

    photo1Scale.value = withDelay(
      300,
      withSequence(
        withSpring(1.15, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      )
    )
    photo2Scale.value = withDelay(
      450,
      withSequence(
        withSpring(1.15, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      )
    )

    headlineOpacity.value = withDelay(550, withTiming(1, { duration: 250 }))
    subOpacity.value = withDelay(700, withTiming(1, { duration: 250 }))
    badgesOpacity.value = withDelay(700, withTiming(1, { duration: 250 }))
    buttonsOpacity.value = withDelay(850, withTiming(1, { duration: 300 }))

    return (): void => {
      clearTimeout(confettiTimeout)
    }
  }, [])

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalTranslateY.value }],
  }))
  const photo1Style = useAnimatedStyle(() => ({
    transform: [{ scale: photo1Scale.value }],
  }))
  const photo2Style = useAnimatedStyle(() => ({
    transform: [{ scale: photo2Scale.value }],
  }))
  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOpacity.value,
  }))
  const subStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
  }))
  const badgesStyle = useAnimatedStyle(() => ({
    opacity: badgesOpacity.value,
  }))
  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }))

  const handleDismiss = useCallback((): void => {
    modalTranslateY.value = withTiming(
      SCREEN_HEIGHT,
      { duration: 300 },
      (finished?: boolean): void => {
        if (finished) {
          runOnJS(clearNewMatch)(matchId)
          runOnJS(onDismiss)()
        }
      }
    )
  }, [clearNewMatch, matchId, modalTranslateY, onDismiss])

  const handleSendMessage = useCallback((): void => {
    const shared = getSharedActivities(
      currentUserActivities,
      otherUser.activities
    )
    const icebreaker =
      shared.length > 0
        ? t('discovery.matchCelebration.icebreakerPrefix', {
            name: otherUser.firstName,
            activity: shared[0],
          })
        : undefined

    handleDismiss()

    // as never: nested navigator param types are inferred correctly at runtime
    // but TypeScript cannot resolve them statically across tab + stack boundary
    navigation.navigate('Matches', {
      screen: 'Chat',
      params: { matchId, icebreakerSuggestion: icebreaker },
    } as never)
  }, [
    currentUserActivities,
    handleDismiss,
    matchId,
    navigation,
    otherUser.activities,
    otherUser.firstName,
    t,
  ])

  const sharedActivities = getSharedActivities(
    currentUserActivities,
    otherUser.activities
  )
  const activitiesLabel =
    sharedActivities.length > 0
      ? t('discovery.matchCelebration.sharedActivities', {
          activities: formatActivitiesList(sharedActivities, t),
        })
      : null
  const otherUserPhoto = otherUser.photos[0] ?? null
  const hasCurrentUserPhoto = currentUserPhoto.length > 0

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss} />

      <ConfettiCannon
        ref={confettiRef}
        count={120}
        origin={CONFETTI_ORIGIN}
        autoStart={false}
        fadeOut
        fallSpeed={3000}
        explosionSpeed={400}
        colors={CONFETTI_COLORS}
      />

      <Animated.View style={[styles.sheet, modalStyle]}>
        <View style={styles.handle} />

        <Animated.View style={headlineStyle}>
          <Text style={styles.headline}>
            {t('discovery.matchCelebration.headline')}
          </Text>
        </Animated.View>

        <View style={styles.photosRow}>
          <Animated.View style={[styles.photoWrapper, photo1Style]}>
            {hasCurrentUserPhoto ? (
              <Image source={{ uri: currentUserPhoto }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]} />
            )}
          </Animated.View>

          <Ionicons
            name="heart"
            size={HEART_ICON_SIZE}
            color={colors.primary}
            style={styles.heartIcon}
          />

          <Animated.View style={[styles.photoWrapper, photo2Style]}>
            {otherUserPhoto !== null ? (
              <Image source={{ uri: otherUserPhoto }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]} />
            )}
          </Animated.View>
        </View>

        <Animated.View style={[styles.textCenter, subStyle]}>
          <Text style={styles.subheadline}>
            {t('discovery.matchCelebration.subheadline', {
              name: otherUser.firstName,
            })}
          </Text>

          {activitiesLabel !== null && (
            <Animated.View style={[styles.sharedBadge, badgesStyle]}>
              <Text style={styles.sharedBadgeText}>{activitiesLabel}</Text>
            </Animated.View>
          )}
        </Animated.View>

        <Animated.View style={[styles.buttons, buttonsStyle]}>
          <Button
            label={t('discovery.matchCelebration.sendMessage')}
            onPress={handleSendMessage}
            variant="primary"
          />
          <Button
            label={t('discovery.matchCelebration.keepSwiping')}
            onPress={handleDismiss}
            variant="outline"
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  buttons: {
    gap: spacing.sm,
    width: '100%',
  },
  handle: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.sm,
    height: spacing.xs,
    marginBottom: spacing.lg,
    width: spacing.xxl - spacing.md,
  },
  headline: {
    color: colors.primary,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  heartIcon: {
    marginHorizontal: spacing.xs,
  },
  photo: {
    borderRadius: PHOTO_SIZE / 2,
    height: PHOTO_SIZE,
    width: PHOTO_SIZE,
  },
  photoPlaceholder: {
    backgroundColor: colors.gray[200],
  },
  photoWrapper: {
    borderColor: colors.primary,
    borderRadius: PHOTO_SIZE / 2 + PHOTO_BORDER,
    borderWidth: PHOTO_BORDER,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: spacing.xs },
    shadowOpacity: 0.3,
    shadowRadius: spacing.sm,
  },
  photosRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  sharedBadge: {
    backgroundColor: colors.gray[100],
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  sharedBadgeText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  sheet: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    bottom: 0,
    left: 0,
    minHeight: SCREEN_HEIGHT * 0.55,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    position: 'absolute',
    right: 0,
  },
  subheadline: {
    color: colors.gray[800],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  textCenter: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
})
