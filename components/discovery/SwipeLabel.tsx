import React from 'react'

import { StyleSheet, Text } from 'react-native'

import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type SwipeLabelType = 'like' | 'nope' | 'super'

interface SwipeLabelProps {
  type: SwipeLabelType
  opacity: SharedValue<number>
}

export const SwipeLabel = ({
  type,
  opacity,
}: SwipeLabelProps): React.JSX.Element => {
  const { t } = useTranslation()

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[styles.label, labelStyles[type], animatedStyle]}>
      <Text style={[styles.text, textStyles[type]]}>
        {t(`discovery.swipe.${type}`)}
      </Text>
    </Animated.View>
  )
}

const labelStyles = StyleSheet.create({
  like: {
    borderColor: colors.primary,
    left: spacing.lg,
    top: spacing.xl,
    transform: [{ rotate: '-15deg' }],
  },
  nope: {
    borderColor: colors.danger,
    right: spacing.lg,
    top: spacing.xl,
    transform: [{ rotate: '15deg' }],
  },
  super: {
    alignSelf: 'center',
    borderColor: colors.secondary,
    bottom: spacing.xxl,
  },
})

const textStyles = StyleSheet.create({
  like: {
    color: colors.primary,
  },
  nope: {
    color: colors.danger,
  },
  super: {
    color: colors.secondary,
  },
})

const styles = StyleSheet.create({
  label: {
    borderRadius: borderRadius.md,
    borderWidth: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: 'absolute',
    zIndex: 15,
  },
  text: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: 2,
  },
})
