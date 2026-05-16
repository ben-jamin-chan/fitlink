import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface ActivityBadgeProps {
  activity: string
  highlighted?: boolean
}

export const ActivityBadge = ({
  activity,
  highlighted = false,
}: ActivityBadgeProps): React.JSX.Element => {
  return (
    <View style={[styles.badge, highlighted ? styles.highlighted : styles.default]}>
      <Text style={styles.label}>{activity}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  default: {
    backgroundColor: colors.overlay,
  },
  highlighted: {
    backgroundColor: colors.primary,
  },
  label: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
})
