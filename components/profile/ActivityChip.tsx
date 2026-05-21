import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface ActivityChipProps {
  label: string
  highlighted?: boolean
}

export const ActivityChip = ({
  label,
  highlighted = false,
}: ActivityChipProps): React.JSX.Element => {
  return (
    <View style={[styles.chip, highlighted && styles.chipHighlighted]}>
      <Text style={[styles.label, highlighted && styles.labelHighlighted]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.gray[100],
    borderColor: colors.gray[200],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipHighlighted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    color: colors.gray[700],
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  labelHighlighted: {
    color: colors.white,
  },
})
