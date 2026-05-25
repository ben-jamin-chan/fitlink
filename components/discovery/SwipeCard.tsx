import React, { useEffect, useState } from 'react'

import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'

import { ActivityBadge } from '@/components/discovery/ActivityBadge'
import { SwipeLabel } from '@/components/discovery/SwipeLabel'

import type { UserProfile } from '@/types/user'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const SWIPE_THRESHOLD = 100
const SUPER_LIKE_THRESHOLD = 100
const OFFSCREEN_DISTANCE = 500
const STACK_SCALE = [1, 0.95, 0.9] as const
const STACK_OFFSET_Y = [0, 12, 24] as const
const SNAP_BACK_CONFIG = { damping: 15, stiffness: 150 } as const
const EXIT_SPRING_CONFIG = { damping: 18, stiffness: 120 } as const
const ONE_HOUR_IN_MS = 1000 * 60 * 60
const HOURS_IN_DAY = 24
const DOT_SIZE = 6
const DOT_RADIUS = DOT_SIZE / 2
const GRADIENT_COLORS = [colors.transparent, colors.black] as const

interface SwipeCardProps {
  user: UserProfile
  onSwipeRight: () => void
  onSwipeLeft: () => void
  onSuperLike: () => void
  onTap: () => void
  isTop: boolean
  stackIndex: number
}

export const SwipeCard = ({
  user,
  onSwipeRight,
  onSwipeLeft,
  onSuperLike,
  onTap,
  isTop,
  stackIndex,
}: SwipeCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  useEffect(() => {
    setCurrentPhotoIndex(0)
  }, [user.uid])

  const likeOpacity = useDerivedValue(() =>
    interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  )

  const nopeOpacity = useDerivedValue(() =>
    interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  )

  const superOpacity = useDerivedValue(() =>
    interpolate(
      translateY.value,
      [-SUPER_LIKE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  )

  const handleSwipeRight = (): void => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onSwipeRight()
  }

  const handleSwipeLeft = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSwipeLeft()
  }

  const handleSuperLike = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    onSuperLike()
  }

  const handlePreviousPhoto = (): void => {
    setCurrentPhotoIndex((index) => Math.max(index - 1, 0))
  }

  const handleNextPhoto = (): void => {
    setCurrentPhotoIndex((index) => Math.min(index + 1, user.photos.length - 1))
  }

  const getActiveLabel = (): string => {
    const ms = Date.now() - user.lastActive.toMillis()
    const hours = ms / ONE_HOUR_IN_MS

    if (hours < 1) {
      return t('discovery.activeNow')
    }

    if (hours < HOURS_IN_DAY) {
      return t('discovery.activeHoursAgo', { count: Math.floor(hours) })
    }

    return t('discovery.activeDaysAgo', {
      count: Math.floor(hours / HOURS_IN_DAY),
    })
  }

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((event) => {
      translateX.value = event.translationX
      translateY.value = event.translationY
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(
          OFFSCREEN_DISTANCE,
          EXIT_SPRING_CONFIG,
          (finished) => {
            if (finished) {
              runOnJS(handleSwipeRight)()
            }
          },
        )
        translateY.value = withSpring(event.translationY, EXIT_SPRING_CONFIG)
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(
          -OFFSCREEN_DISTANCE,
          EXIT_SPRING_CONFIG,
          (finished) => {
            if (finished) {
              runOnJS(handleSwipeLeft)()
            }
          },
        )
        translateY.value = withSpring(event.translationY, EXIT_SPRING_CONFIG)
      } else if (event.translationY < -SUPER_LIKE_THRESHOLD) {
        translateY.value = withSpring(
          -OFFSCREEN_DISTANCE,
          EXIT_SPRING_CONFIG,
          (finished) => {
            if (finished) {
              runOnJS(handleSuperLike)()
            }
          },
        )
        translateX.value = withSpring(event.translationX, EXIT_SPRING_CONFIG)
      } else {
        translateX.value = withSpring(0, SNAP_BACK_CONFIG)
        translateY.value = withSpring(0, SNAP_BACK_CONFIG)
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-width / 2, 0, width / 2],
          [-15, 0, 15],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }))

  const backgroundStyle = {
    transform: [
      { scale: STACK_SCALE[stackIndex] ?? STACK_SCALE[2] },
      { translateY: STACK_OFFSET_Y[stackIndex] ?? STACK_OFFSET_Y[2] },
    ],
  }

  const photoUri = user.photos[currentPhotoIndex] ?? user.photos[0]
  const activeLabel = getActiveLabel()

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, isTop ? animatedStyle : backgroundStyle]}>
        <Image
          source={{ uri: photoUri }}
          style={styles.photo}
          resizeMode="cover"
        />

        {isTop && (
          <View style={styles.photoNavRow}>
            <TouchableOpacity
              style={styles.photoNavLeft}
              onPress={handlePreviousPhoto}
              activeOpacity={1}
            />
            <TouchableOpacity
              style={styles.photoNavCenter}
              onPress={onTap}
              activeOpacity={1}
            />
            <TouchableOpacity
              style={styles.photoNavRight}
              onPress={handleNextPhoto}
              activeOpacity={1}
            />
          </View>
        )}

        {user.photos.length > 1 && (
          <View style={styles.dotsRow}>
            {user.photos.map((photo, index) => (
              <View
                key={photo}
                style={[
                  styles.dot,
                  index === currentPhotoIndex
                    ? styles.dotActive
                    : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        )}

        <LinearGradient colors={GRADIENT_COLORS} style={styles.gradient} />

        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>
            {user.firstName}, {user.age}
          </Text>
          <Text style={styles.distanceText}>{activeLabel}</Text>
          <Text style={styles.cityText}>{user.location.city}</Text>
          <View style={styles.badgesRow}>
            {user.activities.slice(0, 2).map((activity) => (
              <ActivityBadge key={activity} activity={activity} />
            ))}
            <ActivityBadge activity={user.fitnessLevel} />
          </View>
        </View>

        {user.photoVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={colors.secondary}
            />
          </View>
        )}

        <SwipeLabel type="like" opacity={likeOpacity} />
        <SwipeLabel type="nope" opacity={nopeOpacity} />
        <SwipeLabel type="super" opacity={superOpacity} />
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    flex: 1,
    overflow: 'hidden',
  },
  cityText: {
    color: colors.gray[300],
    fontSize: typography.sizes.sm,
  },
  distanceText: {
    color: colors.gray[200],
    fontSize: typography.sizes.sm,
  },
  dot: {
    backgroundColor: colors.white,
    borderRadius: DOT_RADIUS,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  dotActive: {
    opacity: 1,
  },
  dotInactive: {
    opacity: 0.4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: spacing.md,
    zIndex: 5,
  },
  gradient: {
    bottom: 0,
    height: '45%',
    left: 0,
    opacity: 0.75,
    position: 'absolute',
    right: 0,
  },
  infoContainer: {
    bottom: spacing.xl,
    gap: spacing.xs,
    left: spacing.md,
    position: 'absolute',
    right: spacing.md,
  },
  nameText: {
    color: colors.white,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  photoNavCenter: {
    flex: 1,
  },
  photoNavLeft: {
    flex: 1,
  },
  photoNavRight: {
    flex: 1,
  },
  photoNavRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 10,
  },
  verifiedBadge: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    zIndex: 5,
  },
})
