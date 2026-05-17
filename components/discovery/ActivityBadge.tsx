import React from 'react'

import { StyleSheet, Text, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

export type ActivityBadgeVariant = 'activity' | 'level' | 'shared'

interface ActivityBadgeProps {
  activity?: string
  label?: string
  highlighted?: boolean
  variant?: ActivityBadgeVariant
}

export const ActivityBadge = ({
  activity,
  label,
  highlighted = false,
  variant,
}: ActivityBadgeProps): React.JSX.Element => {
  const displayLabel = label ?? activity ?? ''
  const effectiveVariant: ActivityBadgeVariant | undefined = highlighted
    ? 'shared'
    : variant

  return (
    <View style={[styles.badge, getBadgeStyle(effectiveVariant)]}>
      <Text style={[styles.label, getLabelStyle(effectiveVariant)]}>
        {displayLabel}
      </Text>
    </View>
  )
}

const getBadgeStyle = (
  variant: ActivityBadgeVariant | undefined,
): ViewStyle => {
  if (variant === 'shared') {
    return styles.shared
  }

  if (variant === 'level') {
    return styles.level
  }

  if (variant === 'activity') {
    return styles.activity
  }

  return styles.default
}

const getLabelStyle = (
  variant: ActivityBadgeVariant | undefined,
): TextStyle => {
  if (variant === 'shared') {
    return styles.sharedLabel
  }

  if (variant === 'activity') {
    return styles.darkLabel
  }

  return styles.lightLabel
}

const styles = StyleSheet.create({
  activity: {
    backgroundColor: colors.gray[100],
  },
  badge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  darkLabel: {
    color: colors.gray[800],
  },
  default: {
    backgroundColor: colors.overlay,
  },
  level: {
    backgroundColor: colors.secondary,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  lightLabel: {
    color: colors.white,
  },
  shared: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sharedLabel: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
})
