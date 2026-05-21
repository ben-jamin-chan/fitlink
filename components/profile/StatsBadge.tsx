import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/constants/theme'

interface StatsBadgeProps {
  value: number | string
  label: string
}

export const StatsBadge = ({
  value,
  label,
}: StatsBadgeProps): React.JSX.Element => {
  return (
    <View style={styles.container}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: spacing.md,
  },
  label: {
    color: colors.gray[500],
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.gray[900],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs / 2,
  },
})
